from __future__ import annotations

import json

import pytest
from django.test import Client

from apps.configuration.models import TermsAndConditions, sanitize_terms_html

pytestmark = pytest.mark.django_db(transaction=True)


def test_sanitize_terms_html_strips_scripts() -> None:
    dirty = '<p>Hola</p><script>alert(1)</script><a href="javascript:x">x</a>'
    cleaned = sanitize_terms_html(dirty)
    assert "<script" not in cleaned.lower()
    assert "javascript:" not in cleaned.lower()
    assert "<p>Hola</p>" in cleaned


def test_terms_singleton_and_public_graphql() -> None:
    TermsAndConditions.objects.update_or_create(
        pk=1,
        defaults={
            "title": "TyC de prueba",
            "body_html": "<h2>Sección</h2><p>Contenido <strong>HTML</strong>.</p>",
        },
    )
    solo = TermsAndConditions.get_solo()
    assert solo is not None
    assert solo.title == "TyC de prueba"

    client = Client()
    response = client.post(
        "/graphql/",
        data=json.dumps(
            {
                "query": """
                  query {
                    termsAndConditions {
                      title
                      bodyHtml
                      updatedAt
                    }
                  }
                """
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 200
    payload = response.json()
    assert "errors" not in payload
    terms = payload["data"]["termsAndConditions"]
    assert terms["title"] == "TyC de prueba"
    assert "<strong>HTML</strong>" in terms["bodyHtml"]
