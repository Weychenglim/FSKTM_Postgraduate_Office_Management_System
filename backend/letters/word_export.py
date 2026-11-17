"""The Word copy of an issued letter, for the office.

It carries the same letterhead, reference, wording and closing as the PDF in
``pdf_export``. The PDF stays the copy students receive, because it is locked
against editing; a Word file can be changed, so only office staff download it.
"""
import io
import re

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Mm, Pt, RGBColor

from .confirmation import malay_date
from .pdf_export import (
    ADDRESS_LINES,
    APPOINTMENT_DISCLAIMER,
    BULLET_RE,
    DISCLAIMER,
    ENGLISH,
    FACULTY,
    INLINE_RE,
    LOGO,
    MALAY,
    MALAY_ADDRESS_LINES,
    MALAY_APPOINTMENT_DISCLAIMER,
    MALAY_DISCLAIMER,
    MALAY_FACULTY,
    MALAY_SIGNATORY_NAME,
    MALAY_SIGNATORY_OFFICE,
    ROW_RE,
    SIGNATORY_NAME,
    SIGNATORY_OFFICE,
)

WORD_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

FONT = "Arial"
INK = RGBColor(0x1E, 0x29, 0x3B)
MUTED = RGBColor(0x64, 0x74, 0x8B)
ACCENT = RGBColor(0x4F, 0x46, 0xE5)
PAGE_WIDTH = Mm(210 - 2 * 16)


def _paragraph(holder, *, size=11, color=INK, align=None, before=0, after=0):
    paragraph = holder.add_paragraph()
    layout = paragraph.paragraph_format
    layout.space_before = Pt(before)
    layout.space_after = Pt(after)
    if align is not None:
        paragraph.alignment = align
    paragraph.style.font.name = FONT
    paragraph._size, paragraph._color = Pt(size), color
    return paragraph


def _run(paragraph, text, *, bold=False, italic=False, underline=False, color=None):
    run = paragraph.add_run(text)
    run.font.name = FONT
    run.font.size = paragraph._size
    run.font.color.rgb = color or paragraph._color
    run.bold = bold or None
    run.italic = italic or None
    run.underline = underline or None
    return run


def _marked(paragraph, text, **look):
    """Write the template's light markup as bold, underlined and italic runs."""
    position = 0
    for match in INLINE_RE.finditer(text):
        if match.start() > position:
            _run(paragraph, text[position:match.start()], **look)
        strong, underlined, emphasis = match.groups()
        if strong is not None:
            _marked(paragraph, strong, **{**look, "bold": True})
        elif underlined is not None:
            _marked(paragraph, underlined, **{**look, "underline": True})
        else:
            _marked(paragraph, emphasis, **{**look, "italic": True})
        position = match.end()
    if position < len(text):
        _run(paragraph, text[position:], **look)


def _first_paragraph(cell, **look):
    """A table cell starts with one empty paragraph; use it instead of adding a second."""
    cell._element.remove(cell.paragraphs[0]._element)
    return _paragraph(cell, **look)


def _plain_table(document, widths):
    table = document.add_table(rows=1, cols=len(widths))
    table.autofit = False
    for cell, width in zip(table.rows[0].cells, widths):
        cell.width = width
    return table


def _rule(paragraph):
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    for name, value in (("val", "single"), ("sz", "12"), ("space", "1"), ("color", "0C1424")):
        bottom.set(qn(f"w:{name}"), value)
    borders.append(bottom)
    paragraph._p.get_or_add_pPr().append(borders)


def _letterhead(document, words):
    malay = words is MALAY
    left, right = _plain_table(document, [PAGE_WIDTH * 0.55, PAGE_WIDTH * 0.45]).rows[0].cells
    brand = _first_paragraph(left, size=7, color=MUTED)
    if LOGO.exists():
        brand.add_run().add_picture(str(LOGO), height=Mm(12))
        brand = _paragraph(left, size=7, color=MUTED, before=4)
    _run(brand, (MALAY_FACULTY if malay else FACULTY).upper(), bold=True)
    address = _first_paragraph(right, size=7.5, color=MUTED, align=WD_ALIGN_PARAGRAPH.RIGHT)
    lines = MALAY_ADDRESS_LINES if malay else ADDRESS_LINES
    for index, line in enumerate(lines):
        run = _run(address, line)
        if index < len(lines) - 1:
            run.add_break()
    _rule(_paragraph(document, size=2, after=12))


def _meta_line(document, letter, words):
    left, right = _plain_table(document, [PAGE_WIDTH * 0.6, PAGE_WIDTH * 0.4]).rows[0].cells
    reference = _first_paragraph(left, size=9, color=MUTED)
    _run(reference, f"{words['reference']}: ")
    _run(reference, letter.reference_number, bold=True, color=INK)
    issued = malay_date(letter.issued_on) if words is MALAY else letter.issued_on.strftime("%d %B %Y")
    date = _first_paragraph(right, size=9, color=MUTED, align=WD_ALIGN_PARAGRAPH.RIGHT)
    _run(date, f"{words['date']}: ")
    _run(date, issued, bold=True, color=INK)
    _paragraph(document, size=6, after=6)


def _rows(document, lines):
    table = document.add_table(rows=0, cols=3)
    table.autofit = False
    widths = [PAGE_WIDTH * 0.36, Mm(4), PAGE_WIDTH * 0.64 - Mm(4)]
    for line in lines:
        label, *values = [cell.strip() for cell in ROW_RE.match(line).group(1).split("|")]
        cells = table.add_row().cells
        for cell, width, text in zip(cells, widths, (label, ":", " ".join(values))):
            cell.width = width
            _marked(_first_paragraph(cell, after=1), text)
    _paragraph(document, size=4, after=4)


def _body(document, content):
    for block in re.split(r"\n{2,}", content.replace("\r\n", "\n").strip()):
        lines = block.split("\n")
        filled = [line for line in lines if line.strip()]
        if not filled:
            continue
        if all(BULLET_RE.match(line) for line in filled):
            for line in filled:
                item = _paragraph(document, after=3)
                item.style = document.styles["List Bullet"]
                _marked(item, BULLET_RE.sub("", line))
            continue
        if all(ROW_RE.match(line) for line in filled):
            _rows(document, filled)
            continue
        paragraph = _paragraph(document, after=9)
        for index, line in enumerate(lines):
            _marked(paragraph, line)
            if index < len(lines) - 1:
                paragraph.add_run().add_break()


def _closing(document, letter, words):
    if words is MALAY:
        disclaimer = MALAY_APPOINTMENT_DISCLAIMER if letter.is_automatic else MALAY_DISCLAIMER
        name = letter.signatory_name_ms or letter.signatory_name or MALAY_SIGNATORY_NAME
        office = letter.signatory_title_ms or letter.signatory_title or MALAY_SIGNATORY_OFFICE
    else:
        disclaimer = APPOINTMENT_DISCLAIMER if letter.is_automatic else DISCLAIMER
        name = letter.signatory_name or SIGNATORY_NAME
        office = letter.signatory_title or SIGNATORY_OFFICE
    _run(_paragraph(document, size=8.5, color=MUTED, before=6), disclaimer)
    line = _paragraph(document, size=10, color=MUTED, before=30)
    line.paragraph_format.keep_with_next = True
    _run(line, "_" * 28)
    signer = _paragraph(document, size=10.5)
    signer.paragraph_format.keep_with_next = True
    _run(signer, name, bold=True)
    title = _paragraph(document, size=7, color=MUTED, after=6)
    title.paragraph_format.keep_with_next = True
    _run(title, office.upper(), bold=True)
    _run(_paragraph(document, size=7.5, color=ACCENT), words["stamp"], bold=True)


def _page(document, letter, content, words):
    _letterhead(document, words)
    _meta_line(document, letter, words)
    _body(document, content)
    _closing(document, letter, words)


def build_letter_docx(letter):
    """Return the Word file bytes for ``letter``."""
    document = Document()
    section = document.sections[0]
    section.page_width, section.page_height = Mm(210), Mm(297)
    section.left_margin = section.right_margin = Mm(16)
    section.top_margin = section.bottom_margin = Mm(18)
    document.core_properties.title = f"{letter.template_name} {letter.reference_number}"
    document.core_properties.author = "FSKTM Postgraduate Office"
    body = document.element.body
    for paragraph in list(document.paragraphs):
        body.remove(paragraph._element)
    _page(document, letter, letter.content, ENGLISH)
    if (letter.content_ms or "").strip():
        document.add_page_break()
        _page(document, letter, letter.content_ms, MALAY)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()
