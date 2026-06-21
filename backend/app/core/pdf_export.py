"""
pdf_export.py
=============
Generate a styled PDF result report using ReportLab.
Falls back gracefully if ReportLab is not installed.

Usage:
    from app.core.pdf_export import generate_result_pdf
    pdf_bytes = generate_result_pdf(result_row)
    # pdf_bytes is bytes — serve as application/pdf
"""
from __future__ import annotations
import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable,
    )
    from reportlab.pdfgen import canvas as rl_canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("ReportLab not installed — PDF export will be unavailable.")


CHOICE_LABELS = ["A", "B", "C", "D", "E"]
BRAND_HEX     = "#059669"
BRAND_R, BRAND_G, BRAND_B = 5, 150, 105

# Grade colour map  (grade → hex)
GRADE_COLORS = {
    "A+": "#065F46", "A": "#047857",
    "B":  "#1E40AF",
    "C":  "#92400E",
    "D":  "#D97706",
    "F":  "#991B1B",
}


def generate_result_pdf(result: dict) -> bytes:
    """
    Generate a PDF result sheet for a graded answer key.

    Args:
        result: dict from the check_results table row (with per_question list)

    Returns:
        bytes — PDF content
    """
    if not REPORTLAB_AVAILABLE:
        raise RuntimeError(
            "PDF export requires the 'reportlab' package. "
            "Run: pip install reportlab"
        )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=18*mm,  bottomMargin=18*mm,
        title=f"Markix Result — {result.get('key_name', '')}",
    )

    styles  = getSampleStyleSheet()
    story   = []
    W, H    = A4

    # ── Header ────────────────────────────────────────────────────────────────
    brand_color = colors.HexColor(BRAND_HEX)

    story.append(Paragraph(
        "<b>Markix</b>",
        ParagraphStyle("header", fontSize=18, textColor=brand_color, spaceAfter=2, fontName="Helvetica-Bold"),
    ))
    story.append(Paragraph(
        f"Result Report — {result.get('key_name', 'Answer Key')}",
        ParagraphStyle("sub", fontSize=10, textColor=colors.HexColor("#6B7280"), spaceAfter=6),
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=brand_color, spaceAfter=14))

    # ── Score summary ─────────────────────────────────────────────────────────
    correct     = result.get("correct", 0)
    total       = result.get("total", 0)
    wrong       = result.get("wrong", 0)
    unattempted = result.get("unattempted", 0)
    percentage  = result.get("percentage", 0)
    grade       = result.get("grade", "F")
    confidence  = result.get("confidence", 0)
    created_at  = result.get("created_at", "")
    if isinstance(created_at, str):
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            created_at = dt.strftime("%d %b %Y, %H:%M UTC")
        except Exception:
            pass

    grade_color = colors.HexColor(GRADE_COLORS.get(grade, "#DC2626"))

    summary_data = []
    if result.get("student_name"):
        summary_data.append(["Student", result.get("student_name")])
    
    summary_data.extend([
        ["Score",           f"{correct} / {total}"],
        ["Percentage",      f"{percentage:.1f}%"],
        ["Grade",           grade],
        ["Correct",         str(correct)],
        ["Wrong",           str(wrong)],
        ["Unattempted",     str(unattempted)],
        ["Confidence",      f"{confidence}%"],
        ["Check date",      str(created_at)],
    ])
    summary_table = Table(summary_data, colWidths=[50*mm, 80*mm])
    summary_table.setStyle(TableStyle([
        ("FONTNAME",  (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",  (0,0), (-1,-1), 10),
        ("FONTNAME",  (0,0), (0,-1), "Helvetica-Bold"),
        ("TEXTCOLOR", (0,0), (0,-1), colors.HexColor("#374151")),
        ("TEXTCOLOR", (1,0), (1,-1), colors.HexColor("#111827")),
        ("TEXTCOLOR", (1,2), (1,2), grade_color),           # grade is bold color
        ("FONTNAME",  (1,2), (1,2), "Helvetica-Bold"),
        ("FONTSIZE",  (1,2), (1,2), 13),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("LINEBELOW",  (0,-1), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING",  (0,0), (-1,-1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB"), spaceAfter=14))

    # ── Per-question breakdown ─────────────────────────────────────────────────
    story.append(Paragraph(
        "Question Breakdown",
        ParagraphStyle("section", fontSize=12, fontName="Helvetica-Bold",
                       textColor=colors.HexColor("#111827"), spaceAfter=8),
    ))

    per_question = result.get("per_question") or []
    if per_question:
        # Build rows of 10
        ROW_SIZE   = 10
        rows_count = (len(per_question) + ROW_SIZE - 1) // ROW_SIZE
        col_widths = [16*mm] * ROW_SIZE

        header_row = [f"Q{i+1}" for i in range(ROW_SIZE)]
        table_data = []

        for row_i in range(rows_count):
            chunk    = per_question[row_i * ROW_SIZE : (row_i + 1) * ROW_SIZE]
            # Pad to ROW_SIZE
            while len(chunk) < ROW_SIZE:
                chunk.append(None)

            q_nums = []
            ans    = []
            status_styles = []
            for j, q in enumerate(chunk):
                if q is None:
                    q_nums.append("")
                    ans.append("")
                else:
                    sa = q.get("student_answer")
                    q_nums.append(f"Q{row_i*ROW_SIZE + j + 1}")
                    if sa is None:
                        ans.append("—")
                    else:
                        ans.append(CHOICE_LABELS[sa] if 0 <= sa < len(CHOICE_LABELS) else str(sa))

                    status_styles.append((j, q.get("correct", False)))

            table_data.append(q_nums)
            table_data.append(ans)

        tbl = Table(table_data, colWidths=col_widths, repeatRows=0)

        style_cmds = [
            ("FONTNAME",    (0,0), (-1,-1), "Helvetica"),
            ("FONTSIZE",    (0,0), (-1,-1), 9),
            ("ALIGN",       (0,0), (-1,-1), "CENTER"),
            ("GRID",        (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
            ("TOPPADDING",  (0,0), (-1,-1), 4),
            ("BOTTOMPADDING",(0,0),(-1,-1), 4),
            # Q-number rows slightly muted
            ("TEXTCOLOR",   (0,0), (-1, -1-rows_count), colors.HexColor("#9CA3AF")),
            ("FONTSIZE",    (0,0), (-1, rows_count-1), 8),
        ]

        # Colour answer cells by correctness
        for row_i in range(rows_count):
            chunk = per_question[row_i * ROW_SIZE : (row_i + 1) * ROW_SIZE]
            ans_row = row_i * 2 + 1       # every second row is the answer row
            for j, q in enumerate(chunk):
                if q is None:
                    continue
                if q.get("correct"):
                    style_cmds.append(("BACKGROUND", (j, ans_row), (j, ans_row), colors.HexColor("#D1FAE5")))
                    style_cmds.append(("TEXTCOLOR",  (j, ans_row), (j, ans_row), colors.HexColor("#065F46")))
                elif q.get("student_answer") is None:
                    style_cmds.append(("BACKGROUND", (j, ans_row), (j, ans_row), colors.HexColor("#F3F4F6")))
                    style_cmds.append(("TEXTCOLOR",  (j, ans_row), (j, ans_row), colors.HexColor("#9CA3AF")))
                else:
                    style_cmds.append(("BACKGROUND", (j, ans_row), (j, ans_row), colors.HexColor("#FEE2E2")))
                    style_cmds.append(("TEXTCOLOR",  (j, ans_row), (j, ans_row), colors.HexColor("#991B1B")))

        tbl.setStyle(TableStyle(style_cmds))
        story.append(tbl)

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#E5E7EB")))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Generated by Markix · markix.app",
        ParagraphStyle("footer", fontSize=8, textColor=colors.HexColor("#9CA3AF"), alignment=1),
    ))

    doc.build(story)
    return buf.getvalue()
