"""A4 internal packing label. Not a carrier thermal template."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from apps.sales.models import Order
from apps.shipping.models import Shipment

INTERNAL_LABEL_TITLE = "Etiqueta interna Tenda"
INTERNAL_LABEL_DISCLAIMER = "Este documento no es una etiqueta de transportista."
DELIVERY_MODE_LABELS = dict(Order.DeliveryMode.choices)
LABEL_PAGE_SIZE = A4


def _text(value: object) -> str:
    return " ".join(str(value or "").split())


def _draw_wrapped(
    pdf: canvas.Canvas,
    *,
    text: str,
    x: float,
    y: float,
    font: str,
    size: float,
    max_width: float,
    leading: float,
) -> float:
    pdf.setFont(font, size)
    words = _text(text).split() or ["-"]
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if stringWidth(trial, font, size) <= max_width:
            line = trial
            continue
        if line:
            pdf.drawString(x, y, line)
            y -= leading
        line = word
    pdf.drawString(x, y, line)
    return y - leading


def _pair(
    pdf: canvas.Canvas,
    *,
    label: str,
    value: str,
    x: float,
    y: float,
    max_width: float,
) -> float:
    y = _draw_wrapped(
        pdf,
        text=label,
        x=x,
        y=y,
        font="Helvetica",
        size=9,
        max_width=max_width,
        leading=12,
    )
    return _draw_wrapped(
        pdf,
        text=value or "-",
        x=x,
        y=y,
        font="Helvetica-Bold",
        size=11,
        max_width=max_width,
        leading=16,
    )


def render_internal_label_pdf(shipment: Shipment) -> bytes:
    """Render a generic A4 PDF. Physical thermal size is out of scope for T3.3."""

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LABEL_PAGE_SIZE, pageCompression=0)
    width, height = LABEL_PAGE_SIZE
    left = 18 * mm
    max_width = width - (36 * mm)
    y = height - 18 * mm
    organisation = shipment.organisation
    order = shipment.order
    destination = ", ".join(
        part
        for part in (
            _text(shipment.address_line),
            _text(shipment.commune),
            _text(shipment.region),
        )
        if part
    )
    y = _draw_wrapped(
        pdf,
        text=INTERNAL_LABEL_TITLE,
        x=left,
        y=y,
        font="Helvetica-Bold",
        size=20,
        max_width=max_width,
        leading=24,
    )
    y = _draw_wrapped(
        pdf,
        text=INTERNAL_LABEL_DISCLAIMER,
        x=left,
        y=y,
        font="Helvetica",
        size=10,
        max_width=max_width,
        leading=16,
    )
    y -= 6
    pdf.setStrokeColorRGB(0.15, 0.22, 0.2)
    pdf.setLineWidth(0.6)
    pdf.line(left, y, left + max_width, y)
    y -= 18
    y = _pair(
        pdf,
        label="Remitente",
        value=_text(organisation.name),
        x=left,
        y=y,
        max_width=max_width,
    )
    y = _pair(pdf, label="Pedido", value=_text(order.number), x=left, y=y, max_width=max_width)
    y = _pair(pdf, label="Envío", value=_text(shipment.number), x=left, y=y, max_width=max_width)
    y = _pair(
        pdf,
        label="Destinatario",
        value=_text(shipment.recipient_name),
        x=left,
        y=y,
        max_width=max_width,
    )
    y = _pair(
        pdf,
        label="Dirección",
        value=destination,
        x=left,
        y=y,
        max_width=max_width,
    )
    y = _pair(
        pdf,
        label="Modalidad",
        value=DELIVERY_MODE_LABELS.get(shipment.delivery_mode, shipment.delivery_mode),
        x=left,
        y=y,
        max_width=max_width,
    )
    y = _pair(
        pdf,
        label="Transportista",
        value=_text(shipment.carrier),
        x=left,
        y=y,
        max_width=max_width,
    )
    y = _pair(
        pdf,
        label="Tracking manual",
        value=_text(shipment.tracking_code),
        x=left,
        y=y,
        max_width=max_width,
    )
    items = list(order.items.all())
    if items:
        y -= 4
        y = _draw_wrapped(
            pdf,
            text="Contenido",
            x=left,
            y=y,
            font="Helvetica",
            size=9,
            max_width=max_width,
            leading=12,
        )
        for item in items:
            y = _draw_wrapped(
                pdf,
                text=f"{item.product_name} x {item.quantity}",
                x=left,
                y=y,
                font="Helvetica-Bold",
                size=11,
                max_width=max_width,
                leading=16,
            )
            if y < 28 * mm:
                pdf.showPage()
                y = height - 18 * mm
    if _text(shipment.delivery_notes):
        y = _pair(
            pdf,
            label="Notas de entrega",
            value=_text(shipment.delivery_notes),
            x=left,
            y=y,
            max_width=max_width,
        )
    y = min(y, 24 * mm)
    _draw_wrapped(
        pdf,
        text="Documento interno de Tenda. No usar como etiqueta de un transportista.",
        x=left,
        y=y,
        font="Helvetica",
        size=8,
        max_width=max_width,
        leading=11,
    )
    pdf.save()
    return buffer.getvalue()
