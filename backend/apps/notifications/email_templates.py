"""Plain email copy that lives in the app. Brevo only delivers it."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from html import escape
from typing import Any
from zoneinfo import ZoneInfo

SANTIAGO = ZoneInfo("America/Santiago")


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


def _format_clp(value: Any) -> str:
    try:
        amount = int(str(value))
    except (TypeError, ValueError):
        return str(value or "")
    grouped = f"{amount:,}".replace(",", ".")
    return f"${grouped}"


def _order_items(parameters: Mapping[str, Any]) -> list[dict[str, str]]:
    raw = parameters.get("items")
    if not isinstance(raw, list):
        return []
    rows: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        name = str(item.get("productName") or "").strip()
        if not name:
            continue
        quantity = item.get("quantity") or 1
        unit = item.get("unitSalePrice") or ""
        line_total = item.get("lineTotal") or ""
        rows.append(
            {
                "productName": name,
                "quantity": str(quantity),
                "unitSalePrice": _format_clp(unit) if unit != "" else "",
                "lineTotal": _format_clp(line_total) if line_total != "" else "",
            }
        )
    return rows


def _format_datetime(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text
    return parsed.astimezone(SANTIAGO).strftime("%d-%m-%Y %H:%M")


def _order_items_block(items: list[dict[str, str]]) -> tuple[list[str], str]:
    if not items:
        return [], ""
    text_lines = ["Detalle:"]
    html_rows: list[str] = []
    for item in items:
        quantity = f" × {item['quantity']}" if item["quantity"] else ""
        amount = item["lineTotal"] or item["unitSalePrice"]
        text_lines.append(f"- {item['productName']}{quantity}" + (f" · {amount}" if amount else ""))
        html_rows.append(
            "<tr>"
            f'<td style="padding:8px 0;border-bottom:1px solid #eee">'
            f"{escape(item['productName'])}{escape(quantity)}</td>"
            f'<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">'
            f"{escape(amount)}</td>"
            "</tr>"
        )
    html = (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:16px 0 8px">' + "".join(html_rows) + "</table>"
    )
    return text_lines, html


def _append_order_detail(
    *,
    text_lines: list[str],
    html_body: str,
    parameters: Mapping[str, Any],
) -> tuple[list[str], str]:
    """Line items + total, without product photos."""
    item_lines, items_html = _order_items_block(_order_items(parameters))
    next_lines = [*text_lines, *item_lines]
    next_html = html_body + items_html
    raw_total = parameters.get("total")
    if raw_total not in (None, ""):
        formatted_total = _format_clp(raw_total)
        next_lines.append(f"Total: {formatted_total}")
        next_html += f"<p><strong>Total: {escape(formatted_total)}</strong></p>"
    return next_lines, next_html


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
        text_body = f"Confirma tu correo para activar tu cuenta en Tenda.\n{action_url}\n"
        if expires_at:
            text_body += f"El enlace vence el {expires_at}.\n"
        html_body = "<p>Confirma tu correo para activar tu cuenta en Tenda.</p>" + _button(
            action_url, "Verificar correo"
        )
        if expires_at:
            html_body += f"<p>El enlace vence el {escape(expires_at)}.</p>"
        text, html = _shell(title=title, body_html=html_body, body_text=text_body)
        return RenderedEmail(subject="Verifica tu correo en Tenda", text=text, html=html)

    if template == "reset_password":
        title = "Restablece tu contraseña"
        text_body = f"Recibimos un pedido para cambiar tu contraseña.\n{action_url}\n"
        if expires_at:
            text_body += f"El enlace vence el {expires_at}.\n"
        html_body = "<p>Recibimos un pedido para cambiar tu contraseña.</p>" + _button(
            action_url, "Elegir una nueva contraseña"
        )
        if expires_at:
            html_body += f"<p>El enlace vence el {escape(expires_at)}.</p>"
        text, html = _shell(title=title, body_html=html_body, body_text=text_body)
        return RenderedEmail(subject="Restablece tu contraseña de Tenda", text=text, html=html)

    if template == "product_offer_link":
        title = (
            f"Pedido {order_number}: completa el pago"
            if order_number
            else "Completa el pago de tu pedido"
        )
        heading = (
            f"Hay un pedido pendiente de pago ({order_number})."
            if order_number
            else "Hay un pedido pendiente de pago."
        )
        text_lines = [heading]
        html_body = f"<p>{escape(heading)}</p>"
        text_lines, html_body = _append_order_detail(
            text_lines=text_lines,
            html_body=html_body,
            parameters=parameters,
        )
        if not _order_items(parameters):
            product_name = str(parameters.get("productName") or "").strip()
            if product_name:
                text_lines.append(product_name)
                html_body += f"<p><strong>{escape(product_name)}</strong></p>"
        text_lines.append(action_url)
        html_body += _button(action_url, "Abrir pedido y subir comprobante")
        if expires_at:
            text_lines.append(f"El enlace vence el {expires_at}.")
            html_body += f"<p>El enlace vence el {escape(expires_at)}.</p>"
        text, html = _shell(
            title=title,
            body_html=html_body,
            body_text="\n".join(text_lines),
        )
        return RenderedEmail(
            subject=f"Tenda · {title}",
            text=text,
            html=html,
        )

    if template == "order_expired":
        title = "Tu pedido venció"
        heading = (
            f"El pedido {order_number} venció y ya no está reservado."
            if order_number
            else "Tu pedido venció y ya no está reservado."
        )
        text_lines = [heading]
        html_body = f"<p>{escape(heading)}</p>"
        text_lines, html_body = _append_order_detail(
            text_lines=text_lines,
            html_body=html_body,
            parameters=parameters,
        )
        if action_url:
            text_lines.append(action_url)
            html_body += _button(action_url, "Abrir en Tenda")
        text, html = _shell(
            title=title,
            body_html=html_body,
            body_text="\n".join(text_lines),
        )
        return RenderedEmail(subject=f"Tenda · {title}", text=text, html=html)

    if template in {"shipment.dispatched", "shipment.delivered"}:
        dispatched = template == "shipment.dispatched"
        title = "Tu pedido va en camino" if dispatched else "Tu pedido fue entregado"
        carrier = str(parameters.get("carrier") or "")
        tracking_code = str(parameters.get("trackingCode") or "")
        registered_at = _format_datetime(parameters.get("registeredAt"))
        note = str(parameters.get("note") or "")
        recipient_name = str(parameters.get("recipientName") or "")
        address = ", ".join(
            part
            for part in (
                str(parameters.get("addressLine") or ""),
                str(parameters.get("commune") or ""),
                str(parameters.get("region") or ""),
            )
            if part
        )
        if dispatched:
            heading = (
                f"Tu pedido {order_number} fue entregado al transportista."
                if order_number
                else "Tu pedido fue entregado al transportista."
            )
        else:
            heading = (
                f"Tu pedido {order_number} fue entregado."
                if order_number
                else "Tu pedido fue entregado."
            )
        text_lines = [heading]
        html_body = f"<p>{escape(heading)}</p>"
        facts: list[tuple[str, str]] = []
        if dispatched and carrier:
            facts.append(("Transportista", carrier))
        if dispatched and tracking_code:
            facts.append(("Código de seguimiento", tracking_code))
        if registered_at:
            facts.append(("Fecha", registered_at))
        if dispatched and recipient_name:
            facts.append(("Destinatario", recipient_name))
        if dispatched and address:
            facts.append(("Dirección", address))
        for label, value in facts:
            text_lines.append(f"{label}: {value}")
            html_body += f"<p><strong>{escape(label)}:</strong> {escape(value)}</p>"
        if action_url:
            text_lines.append(action_url)
            html_body += _button(action_url, "Seguir envío")
        if note:
            text_lines.append(f"Nota del vendedor: {note}")
            html_body += f"<p>Nota del vendedor: {escape(note)}</p>"
        text_lines, html_body = _append_order_detail(
            text_lines=text_lines,
            html_body=html_body,
            parameters=parameters,
        )
        text, html = _shell(
            title=title,
            body_html=html_body,
            body_text="\n".join(text_lines),
        )
        return RenderedEmail(subject=f"Tenda · {title}", text=text, html=html)

    title = {
        "order_paid": "Tu pedido quedó pagado",
        "order_link": "Tu enlace de pedido",
        "order_cancelled": "Tu pedido fue cancelado",
        "order_refunded": "Tu pedido fue reembolsado",
        "payment_proof_received": "Recibimos tu comprobante",
        "payment_proof_rejected": "No pudimos validar el comprobante",
    }.get(template, "Novedad de Tenda")
    text_lines: list[str] = []
    html_body = ""
    if order_number:
        text_lines.append(f"Pedido {order_number}")
        html_body += f"<p>Pedido {escape(order_number)}</p>"
    reason = str(parameters.get("reason") or "").strip()
    if reason:
        text_lines.append(f"Motivo: {reason}")
        html_body += f"<p>Motivo: {escape(reason)}</p>"
    refund_amount = parameters.get("amount")
    if template == "order_refunded" and refund_amount not in (None, ""):
        formatted_refund = _format_clp(refund_amount)
        text_lines.append(f"Monto reembolsado: {formatted_refund}")
        html_body += f"<p>Monto reembolsado: {escape(formatted_refund)}</p>"
    if not text_lines:
        text_lines.append("Tienes una actualización en Tenda.")
        html_body = "<p>Tienes una actualización en Tenda.</p>"
    text_lines, html_body = _append_order_detail(
        text_lines=text_lines,
        html_body=html_body,
        parameters=parameters,
    )
    if action_url:
        text_lines.append(action_url)
        html_body += _button(action_url, "Abrir en Tenda")
    text, html = _shell(
        title=title,
        body_html=html_body,
        body_text="\n".join(text_lines),
    )
    return RenderedEmail(subject=f"Tenda · {title}", text=text, html=html)
