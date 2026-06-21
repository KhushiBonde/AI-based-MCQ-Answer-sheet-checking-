"""
omr_engine.py
=============
Adapter layer between the FastAPI backend and the existing Python OMR engine in src/.

This module provides a single function `run_omr_check()` that:
  1. Accepts an in-memory image (bytes) and an answer key dict
  2. Decodes + processes it through the existing engine pipeline
  3. Returns a structured result dict with all data needed by the API

The original src/ files are imported directly — no copying or modification needed.
"""

from __future__ import annotations
import sys
import os
import io
import time
import base64
import logging
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ── Ensure src/ is on the path ────────────────────────────────────────────────
_SRC_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "src")
)
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

try:
    from scanner  import scan_and_warp
    from detector import detect_bubbles, find_answered_bubbles
    from checker  import check_answers, generate_report
    from utils    import draw_results
    OMR_AVAILABLE = True
except ImportError as e:
    logger.warning(f"OMR engine not importable: {e}. Check endpoint will return mock data.")
    OMR_AVAILABLE = False


# ── Label helpers ─────────────────────────────────────────────────────────────

CHOICE_LABELS = ["A", "B", "C", "D", "E"]


def _label_to_idx(label) -> int:
    """Convert 'A'/'B'/... or int 0/1/... to 0-based index."""
    if isinstance(label, str):
        return CHOICE_LABELS.index(label.upper())
    return int(label)


def _idx_to_label(idx) -> Optional[str]:
    if idx is None:
        return None
    return CHOICE_LABELS[int(idx)]


# ── Main entry point ──────────────────────────────────────────────────────────

def run_omr_check(
    image_bytes: bytes,
    answers: list,           # list of int (0-based) -- the correct answer per question
    choices_per_question: int = 4,
    question_count: int = 20,
    sections: list = None,   # list of dict: [{"name": "Section A", "start_q": 1, "end_q": 10}, ...]
) -> dict:
    """
    Process a single answer sheet image against an answer key.

    Args:
        image_bytes          : Raw bytes of the uploaded image (JPG/PNG/BMP etc.)
        answers              : List[int] — correct answer index per question (0=A, 1=B…)
        choices_per_question : Number of choices per question (2-5)
        question_count       : Total questions

    Returns dict:
        {
            "correct":        int,
            "wrong":          int,
            "unattempted":    int,
            "total":          int,
            "percentage":     float,
            "grade":          str,
            "confidence":     int,          # 0-100
            "per_question":   list[dict],   # [{q, student_answer, correct_answer, correct}, ...]
            "sections":       list[dict],   # always [] for now (Phase 4 can add sections)
            "annotated_b64":  str,          # base64-encoded annotated JPEG
            "processing_ms":  int,
        }
    """
    t0 = time.time()

    if not OMR_AVAILABLE:
        return _mock_result(answers, choices_per_question, question_count, t0)

    try:
        return _real_omr_pipeline(image_bytes, answers, choices_per_question, question_count, sections, t0)
    except Exception as exc:
        logger.exception(f"OMR pipeline error: {exc}")
        # Fall back to mock so the API doesn't crash — confidence will be 0
        result = _mock_result(answers, choices_per_question, question_count, t0)
        result["confidence"] = 0
        result["error"] = str(exc)
        return result


def _real_omr_pipeline(image_bytes, answers, choices_per_question, question_count, sections, t0):
    # 1. Decode bytes → OpenCV image
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image  = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image — unsupported format or corrupted file.")

    # 2. Perspective correction
    warped = scan_and_warp(image)
    if warped is None:
        logger.warning("Sheet boundary not found — using full image.")
        warped = image.copy()
        perspective_ok = False
    else:
        perspective_ok = True

    # 3. Detect bubbles
    bubbles = detect_bubbles(warped, question_count, choices_per_question)
    if bubbles is None:
        raise ValueError(
            "Could not detect answer bubbles. Ensure good lighting, "
            "the sheet fills most of the frame, and is not blurry."
        )

    # 4. Find marked answers
    student_answers = find_answered_bubbles(warped, bubbles, question_count, choices_per_question)

    # 5. Check against key
    correct_answers = answers  # already 0-based ints
    check_results   = check_answers(student_answers, correct_answers)
    report          = generate_report(check_results, question_count)

    # 6. Draw annotated image
    annotated = draw_results(warped, bubbles, student_answers, correct_answers,
                             question_count, choices_per_question)

    # 7. Encode annotated image as base64 JPEG
    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
    annotated_b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

    # 8. Build per_question list in frontend-friendly format
    per_question = []
    for d in report["details"]:
        q_idx = d["question"] - 1
        sa    = student_answers[q_idx]
        ca    = correct_answers[q_idx] if q_idx < len(correct_answers) else None
        per_question.append({
            "q":              d["question"],
            "student_answer": sa,             # int or None
            "correct_answer": ca,             # int
            "correct":        d["status"] == "correct",
        })

    # 9. Confidence score: combination of perspective quality + detection coverage
    answered_count  = sum(1 for a in student_answers if a is not None)
    bubble_coverage = answered_count + (question_count - answered_count)
    base_confidence = 95 if perspective_ok else 75
    # Penalise for many unattempted (may indicate detection miss)
    unattempt_ratio  = report["unattempted"] / question_count if question_count else 0
    confidence       = max(10, int(base_confidence - unattempt_ratio * 20))

    processing_ms = int((time.time() - t0) * 1000)

    # 10. Calculate sections if provided
    section_results = []
    if sections:
        for sec in sections:
            s_idx = sec["start_q"] - 1
            e_idx = sec["end_q"] - 1
            sec_q = per_question[s_idx : e_idx + 1]
            correct_in_sec = sum(1 for q in sec_q if q["correct"])
            total_in_sec   = len(sec_q)
            section_results.append({
                "name": sec["name"],
                "correct": correct_in_sec,
                "total": total_in_sec,
                "percentage": round((correct_in_sec / total_in_sec * 100), 2) if total_in_sec > 0 else 0
            })

    return {
        "correct":       report["correct"],
        "wrong":         report["wrong"],
        "unattempted":   report["unattempted"],
        "total":         question_count,
        "percentage":    round(report["percentage"], 2),
        "grade":         report["grade"],
        "confidence":    confidence,
        "per_question":  per_question,
        "sections":      section_results,
        "annotated_b64": annotated_b64,
        "processing_ms": processing_ms,
    }


def _mock_result(answers, choices_per_question, question_count, t0):
    """
    Return a plausible mock result when the engine is unavailable.
    Used in dev when OpenCV is not installed.
    """
    import random
    rng = random.Random(42)
    student_answers = [rng.randint(0, choices_per_question - 1) for _ in range(question_count)]
    correct         = sum(1 for s, c in zip(student_answers, answers) if s == c)
    wrong           = question_count - correct
    pct             = correct / question_count * 100 if question_count else 0

    if pct >= 90: grade = "A+"
    elif pct >= 80: grade = "A"
    elif pct >= 70: grade = "B"
    elif pct >= 60: grade = "C"
    elif pct >= 50: grade = "D"
    else: grade = "F"

    per_question = [
        {
            "q":              i + 1,
            "student_answer": student_answers[i],
            "correct_answer": answers[i],
            "correct":        student_answers[i] == answers[i],
        }
        for i in range(question_count)
    ]

    return {
        "correct":       correct,
        "wrong":         wrong,
        "unattempted":   0,
        "total":         question_count,
        "percentage":    round(pct, 2),
        "grade":         grade,
        "confidence":    55,
        "per_question":  per_question,
        "sections":      [],
        "annotated_b64": "",
        "processing_ms": int((time.time() - t0) * 1000),
        "_mock":         True,
    }
