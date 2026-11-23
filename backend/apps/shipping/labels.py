"""Square 100 mm packing sticker printed at actual size on A4.

The page stays A4 so a normal printer does not enlarge a custom page. The
sticker itself is 100 × 100 mm, the usual small-parcel square: recipient first,
then origin and references, with a cut guide so it can be taped to a box.
"""

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
PRINT_INSTRUCTION = (
    "Recorta por la línea punteada. Imprime al 100 %, sin ajustar a la página, "
    "y pégala en el paquete."
)
DELIVERY_MODE_LABELS = dict(Order.DeliveryMode.choices)
LABEL_PAGE_SIZE = A4
LABEL_STICKER_SIZE = 100 * mm


def _text(value: object) -> str:
    return " ".join(str(value or "").split())


def _fit(text: str, font: str, size: float, max_width: float) -> str:
    clean = _text(text) or "-"
    if stringWidth(clean, font, size) <= max_width:
        return clean
    ellipsis = "..."
    kept = clean
    while kept and stringWidth(f"{kept}{ellipsis}", font, size) > max_width:
        kept = kept[:-1].rstrip()
    return f"{kept}{ellipsis}" if kept else ellipsis


def _wrap_lines(
    text: str,
    font: str,
    size: float,
    max_width: float,
    max_lines: int,
) -> list[str]:
    words = _text(text).split()
    if not words:
        return ["-"]
    lines: list[str] = []
    index = 0
    while index < len(words) and len(lines) < max_lines:
        line = words[index]
        index += 1
        while index < len(words):
            trial = f"{line} {words[index]}"
            if stringWidth(trial, font, size) > max_width:
                break
            line = trial
            index += 1
        if len(lines) == max_lines - 1 and index < len(words):
            line = _fit(f"{line} {words[index]}", font, size, max_width)
        elif stringWidth(line, font, size) > max_width:
            line = _fit(line, font, size, max_width)
        lines.append(line)
    return lines


def _draw_block(
    pdf: canvas.Canvas,
    *,
    text: str,
    x: float,
    y: float,
    font: str,
    size: float,
    max_width: float,
    leading: float,
    max_lines: int,
    floor: float,
) -> float:
    pdf.setFont(font, size)
    for line in _wrap_lines(text, font, size, max_width, max_lines):
        if y < floor:
            return y
        pdf.drawString(x, y, line)
        y -= leading
    return y


def _draw_meta(
    pdf: canvas.Canvas,
    *,
    label: str,
    value: str,
    x: float,
    y: float,
    max_width: float,
    floor: float,
) -> float:
    if y < floor or not _text(value):
        return y
    prefix = f"{label}  "
    pdf.setFont("Helvetica", 8)
    pdf.drawString(x, y, prefix)
    offset = stringWidth(prefix, "Helvetica", 8)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(x + offset, y, _fit(value, "Helvetica-Bold", 8, max_width - offset))
    return y - 10.5


def _crop_marks(pdf: canvas.Canvas, x: float, y: float, size: float) -> None:
    mark = 2.4 * mm
    gap = 1.1 * mm
    pdf.setStrokeColorRGB(0, 0, 0)
    pdf.setLineWidth(0.4)
    pdf.setDash()
    corners = (
        (x, y + size, -1, 1),
        (x + size, y + size, 1, 1),
        (x, y, -1, -1),
        (x + size, y, 1, -1),
    )
    for cx, cy, dx, dy in corners:
        pdf.line(cx + dx * gap, cy, cx + dx * (gap + mark), cy)
        pdf.line(cx, cy + dy * gap, cx, cy + dy * (gap + mark))


def render_internal_label_pdf(shipment: Shipment) -> bytes:
    """Render one 100 mm square sticker on an A4 sheet, to cut and stick on a box."""

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LABEL_PAGE_SIZE, pageCompression=0)
    _width, height = LABEL_PAGE_SIZE
    box_x = 14 * mm
    box_top = height - 14 * mm
    box_bottom = box_top - LABEL_STICKER_SIZE
    box_right = box_x + LABEL_STICKER_SIZE
    pad = 4 * mm
    left = box_x + pad
    right = box_right - pad
    max_width = right - left
    footer_y = box_bottom + 3.2 * mm
    floor = footer_y + 8

    organisation = shipment.organisation
    order = shipment.order
    address = _text(shipment.address_line)
    commune = _text(shipment.commune)
    region = _text(shipment.region)

    _crop_marks(pdf, box_x, box_bottom, LABEL_STICKER_SIZE)
    pdf.setDash(1.5, 1.5)
    pdf.setStrokeColorRGB(0.15, 0.15, 0.15)
    pdf.setLineWidth(0.7)
    pdf.rect(box_x, box_bottom, LABEL_STICKER_SIZE, LABEL_STICKER_SIZE, stroke=1, fill=0)
    pdf.setDash()

    y = box_top - pad - 8
    pdf.setFillColorRGB(0, 0, 0)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(left, y, "TENDA")
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(right, y, _fit(shipment.number, "Helvetica-Bold", 11, max_width * 0.62))
    y -= 11
    y = _draw_block(
        pdf,
        text=INTERNAL_LABEL_TITLE,
        x=left,
        y=y,
        font="Helvetica",
        size=7,
        max_width=max_width,
        leading=9,
        max_lines=1,
        floor=floor,
    )
    y -= 1
    pdf.setStrokeColorRGB(0, 0, 0)
    pdf.setLineWidth(0.8)
    pdf.line(left, y, right, y)
    y -= 11
    pdf.setFont("Helvetica", 7)
    pdf.drawString(left, y, "PARA")
    y -= 15
    y = _draw_block(
        pdf,
        text=shipment.recipient_name,
        x=left,
        y=y,
        font="Helvetica-Bold",
        size=13,
        max_width=max_width,
        leading=15,
        max_lines=2,
        floor=floor,
    )
    if address:
        y = _draw_block(
            pdf,
            text=address,
            x=left,
            y=y,
            font="Helvetica",
            size=9,
            max_width=max_width,
            leading=11,
            max_lines=2,
            floor=floor,
        )
    if commune:
        y = _draw_block(
            pdf,
            text=commune,
            x=left,
            y=y,
            font="Helvetica-Bold",
            size=11,
            max_width=max_width,
            leading=13,
            max_lines=1,
            floor=floor,
        )
    if region:
        y = _draw_block(
            pdf,
            text=region,
            x=left,
            y=y,
            font="Helvetica",
            size=8,
            max_width=max_width,
            leading=10,
            max_lines=1,
            floor=floor,
        )
    y -= 2
    if y > floor:
        pdf.setLineWidth(0.4)
        pdf.line(left, y, right, y)
        y -= 12

    y = _draw_meta(
        pdf,
        label="De",
        value=_text(organisation.name),
        x=left,
        y=y,
        max_width=max_width,
        floor=floor,
    )
    y = _draw_meta(
        pdf,
        label="Pedido",
        value=_text(order.number),
        x=left,
        y=y,
        max_width=max_width,
        floor=floor,
    )
    y = _draw_meta(
        pdf,
        label="Entrega",
        value=DELIVERY_MODE_LABELS.get(shipment.delivery_mode, shipment.delivery_mode),
        x=left,
        y=y,
        max_width=max_width,
        floor=floor,
    )
    y = _draw_meta(
        pdf,
        label="Transportista",
        value=_text(shipment.carrier),
        x=left,
        y=y,
        max_width=max_width,
        floor=floor,
    )
    y = _draw_meta(
        pdf,
        label="Tracking",
        value=_text(shipment.tracking_code),
        x=left,
        y=y,
        max_width=max_width,
        floor=floor,
    )

    items = list(order.items.all())
    if items and y >= floor + 20:
        y = _draw_block(
            pdf,
            text="Contenido",
            x=left,
            y=y,
            font="Helvetica",
            size=7,
            max_width=max_width,
            leading=9,
            max_lines=1,
            floor=floor,
        )
        shown = items[:4]
        for item in shown:
            if y < floor:
                break
            y = _draw_block(
                pdf,
                text=f"{item.quantity} x {item.product_name}",
                x=left,
                y=y,
                font="Helvetica-Bold",
                size=8,
                max_width=max_width,
                leading=10,
                max_lines=1,
                floor=floor,
            )
        hidden = len(items) - len(shown)
        if hidden and y >= floor:
            y = _draw_block(
                pdf,
                text=f"y {hidden} más",
                x=left,
                y=y,
                font="Helvetica",
                size=8,
                max_width=max_width,
                leading=10,
                max_lines=1,
                floor=floor,
            )

    notes = _text(shipment.delivery_notes)
    if notes and y >= floor:
        y = _draw_block(
            pdf,
            text=f"Nota: {notes}",
            x=left,
            y=y,
            font="Helvetica",
            size=7,
            max_width=max_width,
            leading=9,
            max_lines=2,
            floor=floor,
        )

    disclaimer_y = y if y > footer_y else footer_y
    pdf.setFont("Helvetica", 6.5)
    pdf.drawString(
        left,
        disclaimer_y,
        _fit(INTERNAL_LABEL_DISCLAIMER, "Helvetica", 6.5, max_width),
    )

    _draw_block(
        pdf,
        text=PRINT_INSTRUCTION,
        x=box_x,
        y=box_bottom - 22,
        font="Helvetica",
        size=8,
        max_width=LABEL_STICKER_SIZE,
        leading=11,
        max_lines=3,
        floor=12 * mm,
    )
    pdf.save()
    return buffer.getvalue()
