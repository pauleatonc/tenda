"""Authentication commands. HTTP and GraphQL adapters only translate inputs/outputs."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlencode, urlparse

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.media_assets.models import MediaAsset
from apps.media_assets.services import ready_asset
from apps.notifications.outbox import enqueue_outbox_event
from apps.organisations.labels import role_label
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from tenda.crypto import encrypt_outbox_value
from tenda.errors import DomainError

from .models import (
    AuthRateLimitBucket,
    EmailVerificationToken,
    MobileSession,
    OIDCLoginState,
    PasswordResetToken,
    Profile,
    SocialIdentity,
    User,
)
from .providers import OIDCIdentity, get_oidc_provider
from .selectors import mobile_session_for_user


@dataclass(frozen=True, slots=True)
class RegistrationResult:
    created: bool
    context: TenantContext | None


@dataclass(frozen=True, slots=True)
class IssuedMobileSession:
    raw_token: str
    session: MobileSession


@dataclass(frozen=True, slots=True)
class OIDCStart:
    authorization_url: str


@dataclass(frozen=True, slots=True)
class AuthenticatedIdentity:
    user: User
    context: TenantContext
    created: bool = False


@dataclass(frozen=True, slots=True)
class OIDCCompletion:
    identity: AuthenticatedIdentity
    client: str
    return_to: str


def canonical_email(value: str) -> str:
    return User.objects.normalize_email(value).strip().lower()


def _token_digest(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _new_token() -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(32)
    return raw_token, _token_digest(raw_token)


def _validate_new_password(password: str, *, user: User | None = None) -> None:
    try:
        validate_password(password, user=user)
    except ValidationError as exc:
        messages = [str(message) for message in exc.messages]
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"password": messages},
        ) from exc


def _queue_auth_delivery(
    *,
    user: User,
    kind: str,
    recipient: str,
    raw_token: str,
    expires_at: datetime,
) -> None:
    membership = (
        user.memberships.filter(is_active=True, organisation__is_active=True)
        .select_related("organisation")
        .first()
    )
    enqueue_outbox_event(
        event_type=("auth.verify_email" if kind == "verify_email" else "auth.reset_password"),
        organisation=membership.organisation if membership is not None else None,
        aggregate_type="User",
        aggregate_public_id=str(user.public_id),
        deduplication_key=f"auth:{kind}:{_token_digest(raw_token)}",
        payload={
            "kind": kind,
            "recipient": recipient,
            "tokenCiphertext": encrypt_outbox_value(raw_token),
            "expiresAt": expires_at.isoformat(),
        },
    )


def issue_email_verification(user: User) -> EmailVerificationToken:
    EmailVerificationToken.objects.filter(
        user=user,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())
    raw_token, digest = _new_token()
    expires_at = timezone.now() + timedelta(
        seconds=int(getattr(settings, "AUTH_EMAIL_TOKEN_TTL_SECONDS", 86400))
    )
    token = EmailVerificationToken.objects.create(
        user=user,
        token_digest=digest,
        expires_at=expires_at,
    )
    _queue_auth_delivery(
        user=user,
        kind="verify_email",
        recipient=user.email,
        raw_token=raw_token,
        expires_at=expires_at,
    )
    return token


@transaction.atomic
def register(
    *,
    email: str,
    password: str,
    full_name: str,
    organisation_name: str | None = None,
) -> RegistrationResult:
    clean_email = canonical_email(email)
    if not clean_email:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"email": ["Ingresa tu correo."]},
        )
    existing = User.objects.select_for_update().filter(email=clean_email).first()
    if existing is not None:
        if existing.is_active and not existing.is_email_verified:
            issue_email_verification(existing)
        return RegistrationResult(created=False, context=None)

    _validate_new_password(password)
    try:
        with transaction.atomic():
            user = User.objects.create_user(email=clean_email, password=password)
    except IntegrityError:
        return RegistrationResult(created=False, context=None)

    profile = user.profile
    profile.full_name = full_name.strip()
    profile.save(update_fields=("full_name", "updated_at"))
    default_name = (
        organisation_name.strip()
        if organisation_name and organisation_name.strip()
        else (profile.full_name or clean_email.split("@", maxsplit=1)[0] or "Tienda")
    )
    provision = create_organisation_for_owner(owner=user, name=default_name)
    issue_email_verification(user)
    context = TenantContext(
        user=user,
        organisation=provision.organisation,
        membership=provision.membership,
        inventory=provision.inventory,
    )
    return RegistrationResult(created=True, context=context)


def authenticate_password(*, email: str, password: str) -> AuthenticatedIdentity:
    user = authenticate(email=canonical_email(email), password=password)
    if user is None or not user.is_active:
        raise DomainError(
            "INVALID_CREDENTIALS",
            "El correo o la contraseña no son correctos.",
            status=401,
        )
    typed_user = user
    if not typed_user.is_email_verified:
        raise DomainError(
            "EMAIL_UNVERIFIED",
            "Verifica tu correo antes de iniciar sesión.",
            status=403,
        )
    context = resolve_tenant_context(typed_user)
    return AuthenticatedIdentity(user=typed_user, context=context)


@transaction.atomic
def verify_email(*, raw_token: str) -> AuthenticatedIdentity:
    token = (
        EmailVerificationToken.objects.select_for_update()
        .select_related("user")
        .filter(token_digest=_token_digest(raw_token))
        .first()
    )
    if token is None or not token.is_usable:
        raise DomainError(
            "TOKEN_INVALID_OR_EXPIRED",
            "El enlace no es válido o ya expiró.",
            status=400,
        )
    now = timezone.now()
    token.consumed_at = now
    token.save(update_fields=("consumed_at",))
    user = token.user
    if user.email_verified_at is None:
        user.email_verified_at = now
        user.save(update_fields=("email_verified_at", "updated_at"))
    return AuthenticatedIdentity(user=user, context=resolve_tenant_context(user))


@transaction.atomic
def request_email_verification(*, email: str) -> None:
    user = (
        User.objects.select_for_update()
        .filter(
            email=canonical_email(email),
            is_active=True,
            email_verified_at__isnull=True,
        )
        .first()
    )
    if user is not None:
        issue_email_verification(user)


@transaction.atomic
def request_password_reset(*, email: str) -> None:
    user = (
        User.objects.select_for_update()
        .filter(
            email=canonical_email(email),
            is_active=True,
        )
        .first()
    )
    if user is None:
        return
    PasswordResetToken.objects.filter(
        user=user,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())
    raw_token, digest = _new_token()
    expires_at = timezone.now() + timedelta(
        seconds=int(getattr(settings, "AUTH_PASSWORD_RESET_TTL_SECONDS", 3600))
    )
    PasswordResetToken.objects.create(
        user=user,
        token_digest=digest,
        expires_at=expires_at,
    )
    _queue_auth_delivery(
        user=user,
        kind="reset_password",
        recipient=user.email,
        raw_token=raw_token,
        expires_at=expires_at,
    )


@transaction.atomic
def confirm_password_reset(*, raw_token: str, new_password: str) -> User:
    token = (
        PasswordResetToken.objects.select_for_update()
        .select_related("user")
        .filter(token_digest=_token_digest(raw_token))
        .first()
    )
    if token is None or not token.is_usable:
        raise DomainError(
            "TOKEN_INVALID_OR_EXPIRED",
            "El enlace no es válido o ya expiró.",
            status=400,
        )
    user = token.user
    _validate_new_password(new_password, user=user)
    token.consumed_at = timezone.now()
    token.save(update_fields=("consumed_at",))
    user.set_password(new_password)
    user.session_version += 1
    user.save(update_fields=("password", "session_version", "updated_at"))
    MobileSession.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )
    PasswordResetToken.objects.filter(
        user=user,
        consumed_at__isnull=True,
    ).update(consumed_at=timezone.now())
    return user


@transaction.atomic
def issue_mobile_session(
    *,
    identity: AuthenticatedIdentity,
    device_name: str = "",
) -> IssuedMobileSession:
    secret = secrets.token_urlsafe(40)
    prefix = secrets.token_hex(6)
    raw_token = f"tenda_{prefix}_{secret}"
    expires_at = timezone.now() + timedelta(
        seconds=int(getattr(settings, "AUTH_MOBILE_TOKEN_TTL_SECONDS", 2592000))
    )
    mobile_session = MobileSession.objects.create(
        user=identity.user,
        token_prefix=prefix,
        token_digest=_token_digest(raw_token),
        active_organisation=identity.context.organisation,
        active_inventory=identity.context.inventory,
        device_name=device_name.strip()[:120],
        expires_at=expires_at,
    )
    return IssuedMobileSession(raw_token=raw_token, session=mobile_session)


def mobile_session_from_token(raw_token: str) -> MobileSession | None:
    parts = raw_token.split("_", maxsplit=2)
    if len(parts) != 3 or parts[0] != "tenda":
        return None
    session = (
        MobileSession.objects.select_related(
            "user",
            "active_organisation",
            "active_inventory",
        )
        .filter(
            token_prefix=parts[1],
            token_digest=_token_digest(raw_token),
        )
        .first()
    )
    if session is None or not session.is_active:
        return None
    return session


@transaction.atomic
def revoke_mobile_session(session: MobileSession) -> None:
    if session.revoked_at is None:
        session.revoked_at = timezone.now()
        session.save(update_fields=("revoked_at",))


@transaction.atomic
def revoke_mobile_session_by_id(*, user: User, public_id: uuid.UUID) -> MobileSession:
    mobile_session = mobile_session_for_user(user, public_id)
    mobile_session = MobileSession.objects.select_for_update().get(pk=mobile_session.pk)
    revoke_mobile_session(mobile_session)
    return mobile_session


@transaction.atomic
def revoke_all_sessions(user: User) -> None:
    user = User.objects.select_for_update().get(pk=user.pk)
    user.session_version += 1
    user.save(update_fields=("session_version", "updated_at"))
    MobileSession.objects.filter(user=user, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )


@transaction.atomic
def update_profile(
    *,
    user: User,
    full_name: str,
    phone: str,
    photo_asset_id: uuid.UUID | None = None,
) -> Profile:
    profile, _created = Profile.objects.select_for_update().get_or_create(user=user)
    profile.full_name = full_name.strip()
    profile.phone = phone.strip()
    if photo_asset_id is not None:
        context = resolve_tenant_context(user)
        ready_asset(
            context=context,
            public_id=photo_asset_id,
            purpose=MediaAsset.Purpose.PROFILE_PHOTO,
            created_by=user,
        )
        profile.photo_asset_id = photo_asset_id
    profile.full_clean()
    update_fields = ["full_name", "phone", "updated_at"]
    if photo_asset_id is not None:
        update_fields.append("photo_asset_id")
    profile.save(update_fields=tuple(update_fields))
    return profile


@transaction.atomic
def begin_oidc(
    *,
    provider_name: str,
    client: str,
    callback_url: str,
    return_to: str,
) -> OIDCStart:
    provider = get_oidc_provider(provider_name)
    if client not in {OIDCLoginState.Client.WEB, OIDCLoginState.Client.MOBILE}:
        raise DomainError("INVALID_CLIENT", "Cliente de autenticación no válido.")
    raw_state, state_digest = _new_token()
    OIDCLoginState.objects.create(
        state_digest=state_digest,
        provider=provider_name,
        client=client,
        return_to=return_to[:500],
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    return OIDCStart(
        authorization_url=provider.authorization_url(
            state=raw_state,
            callback_url=callback_url,
        )
    )


def _user_for_oidc_identity(
    *,
    provider_name: str,
    identity: OIDCIdentity,
) -> tuple[User, bool]:
    social_identity = (
        SocialIdentity.objects.select_for_update()
        .select_related("user")
        .filter(provider=provider_name, subject=identity.subject)
        .first()
    )
    if social_identity is not None:
        social_identity.last_login_at = timezone.now()
        social_identity.save(update_fields=("last_login_at",))
        return social_identity.user, False

    email = canonical_email(identity.email)
    user = User.objects.select_for_update().filter(email=email).first()
    created = user is None
    if user is None:
        user = User.objects.create_user(
            email=email,
            password=None,
            email_verified_at=timezone.now() if identity.email_verified else None,
        )
        user.profile.full_name = identity.full_name
        user.profile.save(update_fields=("full_name", "updated_at"))
        create_organisation_for_owner(
            owner=user,
            name=identity.full_name or email.split("@", maxsplit=1)[0] or "Tienda",
        )
    elif identity.email_verified and not user.is_email_verified:
        user.email_verified_at = timezone.now()
        user.save(update_fields=("email_verified_at", "updated_at"))

    SocialIdentity.objects.create(
        user=user,
        provider=provider_name,
        subject=identity.subject,
        last_login_at=timezone.now(),
    )
    return user, created


def is_safe_mobile_oidc_return_to(return_to: str) -> bool:
    parsed = urlparse(return_to)
    if parsed.scheme == "tenda":
        return True
    if parsed.scheme == "exp":
        return True
    return parsed.scheme in {"http", "https"} and parsed.hostname in {
        "localhost",
        "127.0.0.1",
    }


def mobile_oidc_app_redirect(
    *,
    return_to: str,
    raw_token: str,
    expires_at: datetime,
) -> str | None:
    if not is_safe_mobile_oidc_return_to(return_to):
        return None
    fragment = urlencode(
        {
            "accessToken": raw_token,
            "tokenType": "Bearer",
            "expiresAt": expires_at.isoformat(),
        }
    )
    return f"{return_to}#{fragment}"


@transaction.atomic
def complete_oidc(
    *,
    provider_name: str,
    raw_state: str,
    code: str,
) -> OIDCCompletion:
    state = (
        OIDCLoginState.objects.select_for_update()
        .filter(state_digest=_token_digest(raw_state), provider=provider_name)
        .first()
    )
    if state is None or state.consumed_at is not None or state.expires_at <= timezone.now():
        raise DomainError(
            "OIDC_INVALID_STATE",
            "No fue posible completar el acceso con el proveedor.",
            status=400,
        )
    state.consumed_at = timezone.now()
    state.save(update_fields=("consumed_at",))
    callback_url = (
        str(settings.GOOGLE_OIDC_CALLBACK_URL)
        if provider_name == "google"
        else str(settings.LINKEDIN_OIDC_CALLBACK_URL)
    )
    identity = get_oidc_provider(provider_name).exchange(
        code=code,
        callback_url=callback_url,
    )
    if not identity.email_verified:
        raise DomainError(
            "OIDC_EMAIL_UNVERIFIED",
            "El proveedor no confirmó el correo.",
            status=403,
        )
    user, created = _user_for_oidc_identity(
        provider_name=provider_name,
        identity=identity,
    )
    return OIDCCompletion(
        identity=AuthenticatedIdentity(
            user=user,
            context=resolve_tenant_context(user),
            created=created,
        ),
        client=state.client,
        return_to=state.return_to,
    )


def oidc_state_client(*, raw_state: str, provider_name: str) -> str | None:
    state = OIDCLoginState.objects.filter(
        state_digest=_token_digest(raw_state),
        provider=provider_name,
    ).first()
    return state.client if state is not None else None


def _rate_key(*, action: str, identity: str, ip_address: str) -> str:
    payload = f"{action}|{identity.strip().lower()}|{ip_address}".encode()
    return hmac.new(
        settings.SECRET_KEY.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()


@transaction.atomic
def enforce_auth_rate_limit(
    *,
    action: str,
    identity: str,
    ip_address: str,
) -> None:
    limits = getattr(settings, "AUTH_RATE_LIMITS", {})
    limit, window_seconds, block_seconds = limits.get(action, (10, 300, 300))
    now = timezone.now()
    key_digest = _rate_key(
        action=action,
        identity=identity,
        ip_address=ip_address,
    )
    bucket, _created = AuthRateLimitBucket.objects.select_for_update().get_or_create(
        action=action,
        key_digest=key_digest,
        defaults={"window_started_at": now},
    )
    if bucket.blocked_until is not None and bucket.blocked_until > now:
        retry_after = max(1, int((bucket.blocked_until - now).total_seconds()))
        raise DomainError(
            "AUTH_RATE_LIMITED",
            "Espera un momento antes de volver a intentarlo.",
            field_errors={"retryAfter": [str(retry_after)]},
            status=429,
        )
    if (now - bucket.window_started_at).total_seconds() >= window_seconds:
        bucket.window_started_at = now
        bucket.attempts = 0
        bucket.blocked_until = None
    bucket.attempts += 1
    if bucket.attempts > limit:
        bucket.blocked_until = now + timedelta(seconds=block_seconds)
        bucket.save()
        raise DomainError(
            "AUTH_RATE_LIMITED",
            "Espera un momento antes de volver a intentarlo.",
            field_errors={"retryAfter": [str(block_seconds)]},
            status=429,
        )
    bucket.save()


def clear_auth_rate_limit(*, action: str, identity: str, ip_address: str) -> None:
    AuthRateLimitBucket.objects.filter(
        action=action,
        key_digest=_rate_key(
            action=action,
            identity=identity,
            ip_address=ip_address,
        ),
    ).delete()


def membership_summary(membership: Membership) -> dict[str, object]:
    return {
        "id": str(membership.public_id),
        "role": membership.role,
        "roleLabel": role_label(membership.role),
        "permissions": {
            "viewFinancials": membership.can_view_financials,
            "manageMembers": membership.can_manage_members,
            "manageSensitiveConfiguration": (membership.can_manage_sensitive_configuration),
            "manageInventorySchema": membership.can_manage_inventory_schema,
        },
    }


def session_public_id(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError) as exc:
        raise DomainError("VALIDATION_ERROR", "Identificador de sesión no válido.") from exc
