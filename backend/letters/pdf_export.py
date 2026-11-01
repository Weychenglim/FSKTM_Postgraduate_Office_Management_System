"""The PDF copy of an issued letter, laid out like the printed one.

A PDF rather than a Word file, so a letter cannot simply be edited: the file is
locked against changes (opening, printing and copying text stay allowed), and
its reference number lets anyone check it with the PG Office.

The letterhead text mirrors ``LETTERHEAD`` in frontend/src/utils/letterDocument.ts;
a frontend test fails if the two drift apart. The body uses the same light
markup as the template editor: ``**bold**``, ``*italic*``, ``__underline__``,
blank lines between paragraphs, ``- `` bullet lines and ``| Label | value |``
detail rows. A letter with Malay wording gets a second page in Malay.
"""
import io
import re
import secrets
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.pdfencrypt import StandardEncryption
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .confirmation import malay_date

LOGO = Path(__file__).resolve().parent / "assets" / "um-logo.png"

FACULTY = "Faculty of Computer Science & Information Technology"
ADDRESS_LINES = (
    "Academic Affairs Office, Level 4",
    "50603 Kuala Lumpur, Malaysia",
    "+603-7967 6300  |  pg.fsktm@um.edu.my",
)
MALAY_FACULTY = "Fakulti Sains Komputer & Teknologi Maklumat"
MALAY_ADDRESS_LINES = (
    "Pejabat Hal Ehwal Akademik, Aras 4",
    "50603 Kuala Lumpur, Malaysia",
    "+603-7967 6300  |  pg.fsktm@um.edu.my",
)
DISCLAIMER = (
    "This letter is issued upon the student's request for official purposes only. "
    "Any alteration to this document shall render it invalid."
)
APPOINTMENT_DISCLAIMER = (
    "This letter is issued by the postgraduate office for official purposes only. "
    "Any alteration to this document shall render it invalid."
)
MALAY_DISCLAIMER = (
    "Surat ini dikeluarkan atas permintaan pelajar untuk urusan rasmi sahaja. "
    "Sebarang pindaan pada dokumen ini menjadikannya tidak sah."
)
MALAY_APPOINTMENT_DISCLAIMER = (
    "Surat ini dikeluarkan oleh pejabat pascasiswazah untuk urusan rasmi sahaja. "
    "Sebarang pindaan pada dokumen ini menjadikannya tidak sah."
)
SIGNATORY_NAME = "Dean of Postgraduate Studies"
SIGNATORY_OFFICE = "FSKTM Office Executive Secretariat"
MALAY_SIGNATORY_NAME = "Dekan Pengajian Pascasiswazah"
MALAY_SIGNATORY_OFFICE = "Sekretariat Eksekutif Pejabat FSKTM"

INK = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
ACCENT = colors.HexColor("#4F46E5")
RULE = colors.HexColor("#0C1424")
MARGIN_X = 16 * mm
MARGIN_Y = 18 * mm

INLINE_RE = re.compile(r"\*\*([^*]+?)\*\*|__([^_]+?)__|\*([^*\n]+?)\*")
BULLET_RE = re.compile(r"^\s*-\s+")
ROW_RE = re.compile(r"^\s*\|(.*)\|\s*$")

ENGLISH = {"reference": "Our Ref", "date": "Date", "stamp": "Computer-generated. Verify with the PG Office."}
MALAY = {"reference": "Rujukan Kami", "date": "Tarikh", "stamp": "Dijana oleh komputer. Sahkan dengan Pejabat PG."}

BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=11, leading=15.5, textColor=INK, spaceAfter=9)
FACULTY_STYLE = ParagraphStyle("faculty", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=MUTED, spaceBefore=4)
ADDRESS_STYLE = ParagraphStyle("address", fontName="Helvetica", fontSize=7.5, leading=10, textColor=MUTED, alignment=TA_RIGHT)
META_STYLE = ParagraphStyle("meta", fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED)
META_RIGHT = ParagraphStyle("meta-right", parent=META_STYLE, alignment=TA_RIGHT)
DISCLAIMER_STYLE = ParagraphStyle("disclaimer", fontName="Helvetica", fontSize=8.5, leading=11.5, textColor=MUTED, spaceBefore=6)
SIGNATURE_STYLE = ParagraphStyle("signature", fontName="Helvetica", fontSize=10, leading=13, textColor=MUTED)
NAME_STYLE = ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=10.5, leading=14, textColor=INK)
OFFICE_STYLE = ParagraphStyle("office", fontName="Helvetica-Bold", fontSize=7, leading=10, textColor=MUTED, spaceAfter=6)
STAMP_STYLE = ParagraphStyle("stamp", fontName="Helvetica-Bold", fontSize=7.5, leading=10, textColor=ACCENT)
CELL_STYLE = ParagraphStyle("cell", parent=BODY, spaceAfter=0)


def _marked(text):
    """The template's light markup as ReportLab paragraph markup, text escaped."""
    parts, position = [], 0
    for match in INLINE_RE.finditer(text):
        parts.append(escape(text[position:match.start()]))
        strong, underlined, emphasis = match.groups()
        if strong is not None:
            parts.append(f"<b>{_marked(strong)}</b>")
        elif underlined is not None:
            parts.append(f"<u>{_marked(underlined)}</u>")
        else:
            parts.append(f"<i>{_marked(emphasis)}</i>")
        position = match.end()
    parts.append(escape(text[position:]))
    return "".join(parts)


def _letterhead(width, words=ENGLISH):
    malay = words is MALAY
    brand = []
    if LOGO.exists():
        logo_width, logo_height = ImageReader(str(LOGO)).getSize()
        logo = Image(str(LOGO), width=12 * mm * logo_width / logo_height, height=12 * mm)
        logo.hAlign = "LEFT"
        brand.append(logo)
    brand.append(Paragraph(escape((MALAY_FACULTY if malay else FACULTY).upper()), FACULTY_STYLE))
    lines = MALAY_ADDRESS_LINES if malay else ADDRESS_LINES
    address = Paragraph("<br/>".join(escape(line) for line in lines), ADDRESS_STYLE)
    table = Table([[brand, address]], colWidths=[width * 0.55, width * 0.45])
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LINEBELOW", (0, 0), (-1, 0), 1.5, RULE),
            ]
        )
    )
    return [table, Spacer(1, 14)]


def _meta_line(letter, width, words=ENGLISH):
    reference = Paragraph(f"{words['reference']}: <font color='#1E293B'><b>{escape(letter.reference_number)}</b></font>", META_STYLE)
    issued = malay_date(letter.issued_on) if words is MALAY else letter.issued_on.strftime("%d %B %Y")
    date = Paragraph(f"{words['date']}: <font color='#1E293B'><b>{issued}</b></font>", META_RIGHT)
    table = Table([[reference, date]], colWidths=[width * 0.6, width * 0.4])
    table.setStyle(TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return [table, Spacer(1, 14)]


def _rows(lines, width):
    rows = []
    for line in lines:
        label, *values = [cell.strip() for cell in ROW_RE.match(line).group(1).split("|")]
        rows.append([Paragraph(_marked(label), CELL_STYLE), Paragraph(":", CELL_STYLE), Paragraph(_marked(" ".join(values)), CELL_STYLE)])
    table = Table(rows, colWidths=[width * 0.36, 10, width * 0.64 - 10], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
            ]
        )
    )
    return [table, Spacer(1, 9)]


def _body(content, width):
    flowables = []
    for block in re.split(r"\n{2,}", content.replace("\r\n", "\n").strip()):
        lines = block.split("\n")
        filled = [line for line in lines if line.strip()]
        if not filled:
            continue
        if all(BULLET_RE.match(line) for line in filled):
            items = [ListItem(Paragraph(_marked(BULLET_RE.sub("", line)), BODY)) for line in filled]
            flowables.append(ListFlowable(items, bulletType="bullet", start="•", leftIndent=14, bulletFontSize=9))
            continue
        if all(ROW_RE.match(line) for line in filled):
            flowables += _rows(filled, width)
            continue
        flowables.append(Paragraph("<br/>".join(_marked(line) for line in lines), BODY))
    return flowables


def _closing(letter, words=ENGLISH):
    if words is MALAY:
        disclaimer = MALAY_APPOINTMENT_DISCLAIMER if letter.is_automatic else MALAY_DISCLAIMER
    else:
        disclaimer = APPOINTMENT_DISCLAIMER if letter.is_automatic else DISCLAIMER
    if words is MALAY:
        name = letter.signatory_name_ms or letter.signatory_name or MALAY_SIGNATORY_NAME
        office = letter.signatory_title_ms or letter.signatory_title or MALAY_SIGNATORY_OFFICE
    else:
        name = letter.signatory_name or SIGNATORY_NAME
        office = letter.signatory_title or SIGNATORY_OFFICE
    return [
        Paragraph(escape(disclaimer), DISCLAIMER_STYLE),
        KeepTogether(
            [
                Spacer(1, 30),
                Paragraph("_" * 28, SIGNATURE_STYLE),
                Paragraph(escape(name), NAME_STYLE),
                Paragraph(escape(office.upper()), OFFICE_STYLE),
                Paragraph(words["stamp"], STAMP_STYLE),
            ]
        ),
    ]


def build_letter_pdf(letter):
    """Return the PDF bytes for ``letter``, locked against editing."""
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_Y,
        bottomMargin=MARGIN_Y,
        title=f"{letter.template_name} {letter.reference_number}",
        author="FSKTM Postgraduate Office",
        creator="FSKTM Postgraduate Office System",
        # No password to open it; a random owner password nobody keeps, so the
        # edit lock cannot be lifted from inside a PDF reader.
        encrypt=StandardEncryption(
            "",
            ownerPassword=secrets.token_urlsafe(24),
            canPrint=1,
            canModify=0,
            canCopy=1,
            canAnnotate=0,
            strength=128,
        ),
    )
    # The page frame pads its content by 6 points a side; the tables match it.
    width = document.width - 12
    story = [*_letterhead(width), *_meta_line(letter, width), *_body(letter.content, width), *_closing(letter)]
    if (letter.content_ms or "").strip():
        story += [
            PageBreak(),
            *_letterhead(width, MALAY),
            *_meta_line(letter, width, MALAY),
            *_body(letter.content_ms, width),
            *_closing(letter, MALAY),
        ]
    document.build(story)
    return buffer.getvalue()
