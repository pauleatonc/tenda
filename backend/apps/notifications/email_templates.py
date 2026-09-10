"""Plain email copy that lives in the app. Brevo only delivers it."""

from __future__ import annotations

from dataclasses import dataclass
from html import escape
from typing import Any


@dataclass(frozen=True, slots=True)
class RenderedEmail:
    subject: str
    text: str
    html: str


def _shell(*, title: str, body_html: str, body_text: str) -> tuple[str, str]:
    html = f"""<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f7f5ef;font-family:Arial,sans-serif;color:#17201d">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dedbd1;border-radius:16px">
            <tr>
              <td style="padding:28px 28px 8px;font-size:22px;font-weight:700;letter-spacing:-0.4px">tenda</td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px;font-size:18px;font-weight:700">{escape(title)}</td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;font-size:15px;line-height:1.55;color:#5e6763">
                {body_html}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
    text = f"Tenda\n\n{title}\n\n{body_text}\n"
    return text, html


def _button(url: str, label: str) -> str:
    safe = escape(url, quote=True)
    return (
        f'<p style="margin:24px 0 8px">'
        f'<a href="{safe}" style="background:#175c4d;color:#ffffff;text-decoration:none;'
        f'padding:12px 18px;border-radius:10px;display:inline-block;font-weight:700">'
        f"{escape(label)}</a></p>"
        f'<p style="font-size:13px;word-break:break-all">{safe}</p>'
    )


def render_email(template: str, parameters: dict[str, Any]) -> RenderedEmail:
    action_url = str(parameters.get("actionUrl") or parameters.get("orderUrl") or "")
    expires_at = str(parameters.get("expiresAt") or "")
    order_number = str(parameters.get("orderNumber") or "")

    if template == "verify_email":
        title = "Verifica tu correo"
        text_body = (
            "Confirma tu correo para activar tu cuenta en Tenda.\n"
            f"{action_url}\n"
        )
        if expires_at:
            text_body += f"El enlace vence el {expires_at}.\n"
        html_body = (
            "<p>Confirma tu correo para activar tu cuenta en Tenda.</p>"
            + _button(action_url, "Verificar correo")
        )
        if expires_at:
            html_body += f"<p>El enlace vence el {escape(expires_at)}.</p>"
        text, html = _shell(title=title, body_html=html_body, body_text=text_body)
        return RenderedEmail(subject="Verifica tu correo en Tenda", text=text, html=html)

    if template == "reset_password":
        title = "Restablece tu contraseña"
        text_body = (
            "Recibimos un pedido para cambiar tu contraseña.\n"
            f"{action_url}\n"
        )
        if expires_at:
            text_body += f"El enlace vence el {expires_at}.\n"
        html_body = (
            "<p>Recibimos un pedido para cambiar tu contraseña.</p>"
            + _button(action_url, "Elegir una nueva contraseña")
        )
        if expires_at:
            html_body += f"<p>El enlace vence el {escape(expires_at)}.</p>"
        text, html = _shell(title=title, body_html=html_body, body_text=text_body)
        return RenderedEmail(subject="Restablece tu contraseña de Tenda", text=text, html=html)

    if template == "product_offer_link":
        product_name = str(parameters.get("productName") or "un producto")
        total = str(parameters.get("total") or "")
        title = (
            f"Pedido {order_number}: completa el pago"
            if order_number
            else "Completa el pago de tu pedido"
        )
        text_body = (
            f"Hay un pedido pendiente de pago"
            f"{f' ({order_number})' if order_number else ''}.\n"
            f"{product_name}\n"
        )
        if total:
            text_body += f"Total: {total}\n"
        text_body += f"{action_url}\n"
        if expires_at:
            text_body += f"El enlace vence el {expires_at}.\n"
        html_body = (
            f"<p>Hay un pedido pendiente de pago"
            f"{f' ({escape(order_number)})' if order_number else ''}.</p>"
            f"<p><strong>{escape(product_name)}</strong></p>"
        )
        if total:
            html_body += f"<p>Total: {escape(total)}</p>"
        html_body += _button(action_url, "Abrir pedido y subir comprobante")
        if expires_at:
            html_body += f"<p>El enlace vence el {escape(expires_at)}.</p>"
        text, html = _shell(title=title, body_html=html_body, body_text=text_body)
        return RenderedEmail(
            subject=f"Tenda · {title}",
            text=text,
            html=html,
        )

    title = {
        "order_paid": "Tu pedido quedó pagado",
        "order_link": "Tu enlace de pedido",
        "order_expired": "Tu pedido venció",
        "order_cancelled": "Tu pedido fue cancelado",
        "order_refunded": "Tu pedido fue reembolsado",
        "payment_proof_received": "Recibimos tu comprobante",
        "payment_proof_rejected": "No pudimos validar el comprobante",
        "ticket.opened": "Abrimos un ticket de ayuda",
        "ticket.buyer_reply": "Hay una respuesta en tu ticket",
        "ticket.seller_reply": "Hay una respuesta en tu ticket",
        "ticket.resolved": "Tu ticket quedó resuelto",
        "ticket.reminder": "Recordatorio de tu envío",
        "ticket.autoclose": "Cerramos tu ticket",
        "shipment.delivery_check_seller": "Confirma si el comprador recibió el envío",
    }.get(template, "Novedad de Tenda")
    details = []
    if order_number:
        details.append(f"Pedido {order_number}")
    if action_url:
        details.append(action_url)
    text_body = "\n".join(details) or "Tienes una actualización en Tenda."
    html_body = "".join(f"<p>{escape(item)}</p>" for item in details) or (
        "<p>Tienes una actualización en Tenda.</p>"
    )
    if action_url:
        html_body += _button(action_url, "Abrir en Tenda")
    text, html = _shell(title=title, body_html=html_body, body_text=text_body)
    return RenderedEmail(subject=f"Tenda · {title}", text=text, html=html)
