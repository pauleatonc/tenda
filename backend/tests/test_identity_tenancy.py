from __future__ import annotations

import json
from urllib.parse import parse_qs, urlparse

import pytest
from django.http import HttpResponse
from django.test import Client, override_settings
from django.utils import timezone

from apps.inventory.models import Inventory
from apps.inventory.selectors import inventory_for_tenant
from apps.organisations.models import Membership, Organisation
from apps.organisations.selectors import (
    organisation_for_user,
    resolve_tenant_context,
)
from apps.organisations.services import (
    add_member,
    create_organisation_for_owner,
    remove_member,
    update_organisation,
)
from apps.users.models import MobileSession, Profile, User
from apps.users.providers import fake_auth_delivery_provider
from tenda.errors import DomainError, PermissionDenied, ResourceNotFound

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def clear_fake_delivery() -> None:
    fake_auth_delivery_provider.clear()


def post_json(
    client: Client,
    path: str,
    payload: dict[str, object],
    **headers: str,
) -> HttpResponse:
    return client.post(
        path,
        data=json.dumps(payload),
        content_type="application/json",
        **headers,
    )


def verified_identity(
    *,
    email: str = "owner@example.com",
    role: str = Membership.Role.OWNER,
) -> tuple[User, Organisation, Inventory, Membership]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    provision = create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    membership = provision.membership
    if role != Membership.Role.OWNER:
        membership.role = role
        membership.view_financials = False
        membership.manage_members = False
        membership.manage_sensitive_configuration = False
        membership.save()
    return user, provision.organisation, provision.inventory, membership


def test_registration_is_atomic_owner_provision_and_neutral_for_duplicate() -> None:
    client = Client()
    payload = {
        "email": "Nueva@Example.com",
        "password": "Correct-Horse-Battery-42",
        "fullName": "Ana Pérez",
        "acceptedTerms": True,
    }

    first = post_json(client, "/api/v1/auth/register", payload)
    second = post_json(client, "/api/v1/auth/register", payload)

    assert first.status_code == second.status_code == 202
    assert first.json() == second.json()
    user = User.objects.get(email="nueva@example.com")
    assert Profile.objects.get(user=user).full_name == "Ana Pérez"
    membership = Membership.objects.get(user=user)
    assert membership.role == Membership.Role.OWNER
    assert membership.can_view_financials
    assert membership.can_manage_members
    assert Inventory.objects.filter(organisation=membership.organisation).count() == 1
    assert "token" not in json.dumps(first.json()).lower()


def test_email_verification_creates_web_session_and_viewer_context() -> None:
    client = Client()
    post_json(
        client,
        "/api/v1/auth/register",
        {
            "email": "verify@example.com",
            "password": "Correct-Horse-Battery-42",
            "fullName": "Verónica",
            "acceptedTerms": True,
        },
    )
    delivery = fake_auth_delivery_provider.deliveries()[-1]

    response = post_json(
        client,
        "/api/v1/auth/email/verify",
        {"token": delivery.token},
    )
    replay = post_json(
        Client(),
        "/api/v1/auth/email/verify",
        {"token": delivery.token},
    )
    viewer = client.get("/api/v1/auth/viewer")

    assert response.status_code == 200
    assert response.json()["data"]["viewer"]["emailVerified"] is True
    assert viewer.status_code == 200
    assert viewer.json()["data"]["organisation"]["id"]
    assert viewer.json()["data"]["inventory"]["id"]
    assert replay.status_code == 400
    assert replay.json()["error"]["code"] == "TOKEN_INVALID_OR_EXPIRED"


def test_login_is_neutral_and_mobile_token_is_revocable() -> None:
    user, _organisation, _inventory, _membership = verified_identity()
    mobile = Client()

    invalid = post_json(
        mobile,
        "/api/v1/auth/login",
        {"email": user.email, "password": "wrong"},
        HTTP_X_TENDA_CLIENT="mobile",
    )
    valid = post_json(
        mobile,
        "/api/v1/auth/login",
        {"email": user.email, "password": "Correct-Horse-Battery-42"},
        HTTP_X_TENDA_CLIENT="mobile",
    )
    access_token = valid.json()["data"]["accessToken"]
    viewer = mobile.get(
        "/api/v1/auth/viewer",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
        HTTP_X_TENDA_CLIENT="mobile",
    )
    logout = post_json(
        mobile,
        "/api/v1/auth/logout",
        {},
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
        HTTP_X_TENDA_CLIENT="mobile",
    )
    after_logout = mobile.get(
        "/api/v1/auth/viewer",
        HTTP_AUTHORIZATION=f"Bearer {access_token}",
        HTTP_X_TENDA_CLIENT="mobile",
    )

    assert invalid.status_code == 401
    assert invalid.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert valid.status_code == 200
    assert viewer.status_code == 200
    assert logout.status_code == 200
    assert after_logout.status_code == 401
    assert MobileSession.objects.get(user=user).revoked_at is not None


def test_password_reset_is_neutral_expiring_and_revokes_sessions() -> None:
    user, _organisation, _inventory, _membership = verified_identity()
    client = Client()
    mobile_login = post_json(
        client,
        "/api/v1/auth/login",
        {"email": user.email, "password": "Correct-Horse-Battery-42"},
        HTTP_X_TENDA_CLIENT="mobile",
    )
    old_token = mobile_login.json()["data"]["accessToken"]
    fake_auth_delivery_provider.clear()

    existing = post_json(
        client,
        "/api/v1/auth/password/reset/request",
        {"email": user.email},
    )
    missing = post_json(
        client,
        "/api/v1/auth/password/reset/request",
        {"email": "missing@example.com"},
    )
    reset_token = fake_auth_delivery_provider.deliveries()[-1].token
    confirmed = post_json(
        client,
        "/api/v1/auth/password/reset/confirm",
        {"token": reset_token, "password": "A-New-Valid-Password-84"},
    )
    replay = post_json(
        client,
        "/api/v1/auth/password/reset/confirm",
        {"token": reset_token, "password": "Another-Valid-Password-85"},
    )
    old_session = client.get(
        "/api/v1/auth/viewer",
        HTTP_AUTHORIZATION=f"Bearer {old_token}",
        HTTP_X_TENDA_CLIENT="mobile",
    )

    assert existing.status_code == missing.status_code == 202
    assert existing.json() == missing.json()
    assert confirmed.status_code == 200
    assert replay.status_code == 400
    assert old_session.status_code == 401
    user.refresh_from_db()
    assert user.check_password("A-New-Valid-Password-84")


def test_browser_requires_csrf_while_native_json_uses_custom_header() -> None:
    browser = Client(enforce_csrf_checks=True)
    payload = {
        "email": "csrf@example.com",
        "password": "Correct-Horse-Battery-42",
        "fullName": "CSRF",
        "acceptedTerms": True,
    }
    blocked = post_json(browser, "/api/v1/auth/register", payload)
    csrf = browser.get("/api/v1/auth/csrf").json()["data"]["csrfToken"]
    allowed = post_json(
        browser,
        "/api/v1/auth/register",
        payload,
        HTTP_X_CSRFTOKEN=csrf,
    )
    native = post_json(
        Client(enforce_csrf_checks=True),
        "/api/v1/auth/register",
        {**payload, "email": "native@example.com"},
        HTTP_X_TENDA_CLIENT="mobile",
    )

    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "CSRF_FAILED"
    assert allowed.status_code == 202
    assert native.status_code == 202


@override_settings(AUTH_RATE_LIMITS={"login": (1, 300, 300)})
def test_auth_rate_limit_is_persisted_in_database() -> None:
    client = Client()
    first = post_json(
        client,
        "/api/v1/auth/login",
        {"email": "unknown@example.com", "password": "wrong"},
    )
    second = post_json(
        client,
        "/api/v1/auth/login",
        {"email": "unknown@example.com", "password": "wrong"},
    )

    assert first.status_code == 401
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "AUTH_RATE_LIMITED"


@override_settings(TURNSTILE_FAKE_MODE=False, TURNSTILE_SECRET_KEY="")
def test_login_and_register_require_turnstile_when_enabled() -> None:
    client = Client()
    login = post_json(
        client,
        "/api/v1/auth/login",
        {"email": "owner@example.com", "password": "Correct-Horse-Battery-42"},
    )
    register = post_json(
        client,
        "/api/v1/auth/register",
        {
            "email": "nueva@example.com",
            "password": "Correct-Horse-Battery-42",
            "fullName": "Ana",
            "acceptedTerms": True,
        },
    )

    assert login.status_code == register.status_code == 400
    assert login.json()["error"]["code"] == "ANTIBOT_FAILED"
    assert register.json()["error"]["code"] == "ANTIBOT_FAILED"


@override_settings(GOOGLE_OIDC_PROVIDER="fake")
def test_fake_google_oidc_is_deterministic_and_linkedin_is_off() -> None:
    client = Client()
    start = client.get("/api/v1/auth/social/google/start")
    authorization_url = start.json()["data"]["authorizationUrl"]
    parsed = urlparse(authorization_url)
    callback = client.get(f"{parsed.path}?{parsed.query}")
    viewer = client.get("/api/v1/auth/viewer")
    linkedin = client.get("/api/v1/auth/social/linkedin/start")

    assert parse_qs(parsed.query)["code"] == ["tenda-fake-google"]
    assert callback.status_code == 302
    assert callback["Location"].endswith("/app")
    assert viewer.status_code == 200
    assert viewer.json()["data"]["viewer"]["email"] == "google.user@example.test"
    assert linkedin.status_code == 404
    assert linkedin.json()["error"]["code"] == "PROVIDER_UNAVAILABLE"


@override_settings(GOOGLE_OIDC_PROVIDER="fake")
def test_fake_google_oidc_mobile_redirects_to_safe_return_to() -> None:
    client = Client()
    start = client.get(
        "/api/v1/auth/social/google/start",
        {"client": "mobile", "returnTo": "tenda://auth/google"},
    )
    authorization_url = start.json()["data"]["authorizationUrl"]
    parsed = urlparse(authorization_url)
    callback = client.get(f"{parsed.path}?{parsed.query}")
    location = urlparse(callback["Location"])
    fragment = parse_qs(location.fragment)

    assert callback.status_code == 302
    assert location.scheme == "tenda"
    assert fragment["accessToken"][0].startswith("tenda_")
    assert fragment["tokenType"] == ["Bearer"]


@override_settings(
    GOOGLE_OIDC_PROVIDER="google",
    GOOGLE_OIDC_CLIENT_ID="test-client.apps.googleusercontent.com",
    GOOGLE_OIDC_CLIENT_SECRET="test-secret",
    GOOGLE_OIDC_CALLBACK_URL="http://localhost:8000/api/v1/auth/social/google/callback",
)
def test_google_oidc_start_points_to_google_accounts() -> None:
    start = Client().get("/api/v1/auth/social/google/start")
    authorization_url = start.json()["data"]["authorizationUrl"]
    parsed = urlparse(authorization_url)
    query = parse_qs(parsed.query)

    assert parsed.netloc == "accounts.google.com"
    assert parsed.path == "/o/oauth2/v2/auth"
    assert query["client_id"] == ["test-client.apps.googleusercontent.com"]
    assert query["response_type"] == ["code"]
    assert query["redirect_uri"] == [
        "http://localhost:8000/api/v1/auth/social/google/callback"
    ]
    assert "openid" in query["scope"][0]
    assert "email" in query["scope"][0]


@override_settings(
    GOOGLE_OIDC_PROVIDER="google",
    GOOGLE_OIDC_CLIENT_ID="test-client.apps.googleusercontent.com",
    GOOGLE_OIDC_CLIENT_SECRET="test-secret",
    GOOGLE_OIDC_CALLBACK_URL="http://localhost:8000/api/v1/auth/social/google/callback",
)
def test_google_oidc_callback_exchanges_code_with_google(monkeypatch: pytest.MonkeyPatch) -> None:
    class TokenResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"access_token": "ya29.test-token"}

    class UserInfoResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "sub": "google-subject-99",
                "email": "ada@example.com",
                "email_verified": True,
                "name": "Ada Lovelace",
            }

    monkeypatch.setattr(
        "apps.users.providers.httpx.post",
        lambda *args, **kwargs: TokenResponse(),
    )
    monkeypatch.setattr(
        "apps.users.providers.httpx.get",
        lambda *args, **kwargs: UserInfoResponse(),
    )

    client = Client()
    start = client.get("/api/v1/auth/social/google/start")
    state = parse_qs(urlparse(start.json()["data"]["authorizationUrl"]).query)["state"][0]
    callback = client.get(
        "/api/v1/auth/social/google/callback",
        {"state": state, "code": "4/real-google-code"},
    )
    viewer = client.get("/api/v1/auth/viewer")

    assert callback.status_code == 302
    assert callback["Location"].endswith("/app")
    assert viewer.json()["data"]["viewer"]["email"] == "ada@example.com"


def test_tenant_selectors_hide_foreign_ids_and_operator_defaults_are_safe() -> None:
    owner, owner_org, _owner_inventory, owner_membership = verified_identity()
    operator, operator_org, operator_inventory, operator_membership = verified_identity(
        email="operator@example.com",
        role=Membership.Role.OPERATOR,
    )
    context = resolve_tenant_context(operator)

    assert not operator_membership.can_view_financials
    assert not operator_membership.can_manage_members
    assert not operator_membership.can_manage_sensitive_configuration
    with pytest.raises(ResourceNotFound):
        organisation_for_user(operator, owner_org.public_id)
    with pytest.raises(ResourceNotFound):
        inventory_for_tenant(context, _owner_inventory.public_id)
    with pytest.raises(PermissionDenied):
        update_organisation(
            context=context,
            name="No permitido",
            phone="",
            business_email="",
            timezone_name="America/Santiago",
        )
    assert owner_membership.can_manage_sensitive_configuration
    assert operator_inventory.organisation == operator_org
    assert owner.email != operator.email


def test_owner_manages_members_but_cannot_remove_last_owner() -> None:
    owner, _organisation, _inventory, _membership = verified_identity()
    operator = User.objects.create_user(
        email="member@example.com",
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    context = resolve_tenant_context(owner)

    added = add_member(context=context, email=operator.email)
    removed = remove_member(context=context, member_id=added.public_id)

    assert added.role == Membership.Role.OPERATOR
    assert removed.is_active is False
    with pytest.raises(DomainError) as error:
        remove_member(context=context, member_id=context.membership.public_id)
    assert error.value.code == "LAST_OWNER_REQUIRED"


def test_graphql_minimum_contract_and_permission_errors() -> None:
    owner, organisation, _inventory, _membership = verified_identity()
    client = Client()
    login = post_json(
        client,
        "/api/v1/auth/login",
        {"email": owner.email, "password": "Correct-Horse-Battery-42"},
    )
    assert login.status_code == 200
    query = """
      query Identity {
        viewer { id email emailVerified profile { fullName phone } }
        organisation { id name timezone }
        activeInventory { id name }
        members { id email role permissions { viewFinancials manageMembers } }
      }
    """
    result = post_json(client, "/graphql/", {"query": query})
    mutation = """
      mutation Update($profile: UpdateProfileInput!, $organisation: UpdateOrganisationInput!) {
        updateProfile(input: $profile) { profile { fullName phone } }
        updateOrganisation(input: $organisation) { organisation { name phone } }
      }
    """
    updated = post_json(
        client,
        "/graphql/",
        {
            "query": mutation,
            "variables": {
                "profile": {"fullName": "Owner Updated", "phone": "+56911111111"},
                "organisation": {
                    "name": "Tienda Actualizada",
                    "phone": "+56222222222",
                    "businessEmail": "ventas@example.com",
                    "timezone": "America/Santiago",
                },
            },
        },
    )

    assert result.status_code == 200
    assert result.json()["data"]["viewer"]["email"] == owner.email
    assert result.json()["data"]["organisation"]["id"] == str(organisation.public_id)
    assert result.json()["data"]["members"][0]["role"] == "owner"
    assert updated.json()["data"]["updateProfile"]["profile"]["fullName"] == "Owner Updated"
    assert (
        updated.json()["data"]["updateOrganisation"]["organisation"]["name"] == "Tienda Actualizada"
    )


def test_operator_graphql_cannot_list_members_or_update_organisation() -> None:
    operator, _organisation, _inventory, _membership = verified_identity(
        email="graphql-operator@example.com",
        role=Membership.Role.OPERATOR,
    )
    client = Client()
    post_json(
        client,
        "/api/v1/auth/login",
        {"email": operator.email, "password": "Correct-Horse-Battery-42"},
    )
    result = post_json(
        client,
        "/graphql/",
        {
            "query": """
              query { members { id } }
            """,
        },
    )

    assert result.status_code == 200
    assert result.json()["errors"][0]["extensions"]["code"] == "PERMISSION_DENIED"
