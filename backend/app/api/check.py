"""
check.py
========
POST /api/check — upload a sheet image + key_id, grade it, store result.

Flow:
    1. Validate auth + inputs
    2. Fetch answer key from DB
    3. Run OMR engine (scan → detect → check)
    4. Store original + annotated images in Supabase Storage
    5. Persist result row in check_results table
    6. Increment usage counter
    7. Return full result JSON (same shape as GET /api/results/{id})
"""

from __future__ import annotations
import io
import base64
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.core.deps import require_auth, UserContext
from app.core.supabase_client import get_supabase_admin
from app.core.omr_engine import run_omr_check, CHOICE_LABELS
from app.core.config import settings
import sys
import os
from datetime import datetime, timezone

_SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))
if _SRC_DIR not in sys.path:
    sys.path.insert(0, _SRC_DIR)

try:
    from checker import check_answers, generate_report
except ImportError:
    pass

logger  = logging.getLogger(__name__)
router  = APIRouter()

KEYS_TABLE    = "answer_keys"
RESULTS_TABLE = "check_results"
USAGE_TABLE   = "usage_counters"
STORAGE_BUCKET = "omr-sheets"

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/bmp",
                 "image/heic", "image/heif", "image/webp"}


def _admin():
    return get_supabase_admin()


# ── Usage helpers ─────────────────────────────────────────────────────────────

def _get_usage(user_id: str) -> int:
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    res = (
        _admin()
        .table(USAGE_TABLE)
        .select("check_count")
        .eq("user_id", user_id)
        .eq("month", month)
        .execute()
    )
    return res.data[0]["check_count"] if res.data else 0


def _increment_usage(user_id: str):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    existing = (
        _admin()
        .table(USAGE_TABLE)
        .select("id, check_count")
        .eq("user_id", user_id)
        .eq("month", month)
        .execute()
    )
    if existing.data:
        new_count = existing.data[0]["check_count"] + 1
        _admin().table(USAGE_TABLE).update({"check_count": new_count}).eq("id", existing.data[0]["id"]).execute()
    else:
        _admin().table(USAGE_TABLE).insert({"user_id": user_id, "month": month, "check_count": 1}).execute()


# ── Storage helper ────────────────────────────────────────────────────────────

def _upload_image(path: str, data: bytes, mime: str = "image/jpeg") -> str | None:
    """Upload bytes to Supabase Storage. Returns public URL or None on failure."""
    try:
        _admin().storage.from_(STORAGE_BUCKET).upload(
            path=path,
            file=data,
            file_options={"content-type": mime, "upsert": "true"},
        )
        res = _admin().storage.from_(STORAGE_BUCKET).create_signed_url(path, 60 * 60 * 24 * 365)  # 1 year
        return res.get("signedURL") or res.get("signedUrl")
    except Exception as e:
        logger.warning(f"Storage upload failed for {path}: {e}")
        return None


# ── Main check endpoint ───────────────────────────────────────────────────────

@router.post("/check")
async def check_sheet(
    image:  UploadFile = File(..., description="Answer sheet image (JPG/PNG/HEIC)"),
    key_id: str        = Form(..., description="UUID of the answer key to grade against"),
    student_name: Optional[str] = Form(None, description="Optional name of the student"),
    student_id:   Optional[str] = Form(None, description="Optional UUID of the student in roster"),
    class_id:     Optional[str] = Form(None, description="Optional UUID of the class"),
    user:   UserContext = Depends(require_auth),
):
    """
    Grade an uploaded MCQ answer sheet against a saved answer key.

    Returns the full result object including per-question breakdown,
    grade, confidence score, and URLs for original/annotated images.
    """

    # ── 1. Check usage limit ──────────────────────────────────────────────────
    used = _get_usage(user.id)
    if used >= 500:
        raise HTTPException(
            status_code=429,
            detail="Monthly limit reached (500 sheets). Upgrade your plan to continue."
        )

    # ── 2. Validate image ─────────────────────────────────────────────────────
    content_type = (image.content_type or "").lower()
    # Accept even if content_type is generic
    ext = (image.filename or "").rsplit(".", 1)[-1].lower()
    if content_type not in ALLOWED_TYPES and ext not in {"jpg", "jpeg", "png", "bmp", "heic", "heif", "webp"}:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type or ext}")

    max_bytes = settings.max_upload_mb * 1024 * 1024
    image_bytes = await image.read()
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large ({len(image_bytes)//1024}KB). Max is {settings.max_upload_mb}MB."
        )
    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Image too small — minimum 1 KB.")

    # ── 3. Fetch answer key ───────────────────────────────────────────────────
    key_res = (
        _admin()
        .table(KEYS_TABLE)
        .select("*")
        .eq("id", key_id)
        .single()
        .execute()
    )
    if not key_res.data:
        raise HTTPException(status_code=404, detail="Answer key not found.")
    if key_res.data["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="You don't own this answer key.")

    key = key_res.data

    # ── 4. Run OMR engine ─────────────────────────────────────────────────────
    logger.info(f"Starting OMR check: user={user.id} key={key_id} size={len(image_bytes)}B")

    try:
        omr_result = run_omr_check(
            image_bytes=image_bytes,
            answers=key["answers"],
            choices_per_question=key["choices_per_question"],
            question_count=key["question_count"],
            sections=key.get("sections", []),
        )
    except Exception as exc:
        logger.exception(f"OMR engine failure: {exc}")
        raise HTTPException(
            status_code=422,
            detail=f"Could not process image: {exc}. Try a clearer photo with better lighting."
        )

    # ── 5. Upload images to Supabase Storage ──────────────────────────────────
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    original_url  = None
    annotated_url = None

    # Upload original image
    orig_path = f"{user.id}/{ts}_original.jpg"
    original_url = _upload_image(orig_path, image_bytes, "image/jpeg")

    # Upload annotated image (decoded from base64)
    if omr_result.get("annotated_b64"):
        ann_bytes = base64.b64decode(omr_result["annotated_b64"])
        ann_path  = f"{user.id}/{ts}_annotated.jpg"
        annotated_url = _upload_image(ann_path, ann_bytes, "image/jpeg")

    # ── 6. Persist result to DB ───────────────────────────────────────────────
    result_row = {
        "user_id":             user.id,
        "key_id":              key_id,
        "key_name":            key["name"],
        "student_name":        student_name,
        "student_id":          student_id,
        "class_id":            class_id,
        "total":               omr_result["total"],
        "correct":             omr_result["correct"],
        "wrong":               omr_result["wrong"],
        "unattempted":         omr_result["unattempted"],
        "percentage":          omr_result["percentage"],
        "grade":               omr_result["grade"],
        "confidence":          omr_result["confidence"],
        "per_question":        omr_result["per_question"],
        "sections":            omr_result["sections"],
        "original_image_url":  original_url,
        "annotated_image_url": annotated_url,
    }

    insert_res = _admin().table(RESULTS_TABLE).insert(result_row).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save result.")

    saved = insert_res.data[0]

    # ── 7. Increment usage ────────────────────────────────────────────────────
    try:
        _increment_usage(user.id)
    except Exception as e:
        logger.warning(f"Usage increment failed: {e}")

    # ── 8. Return full result ─────────────────────────────────────────────────
    logger.info(
        f"OMR check complete: result={saved['id']} "
        f"score={omr_result['correct']}/{omr_result['total']} "
        f"grade={omr_result['grade']} "
        f"time={omr_result['processing_ms']}ms"
    )

    return {
        "id":                  saved["id"],
        "created_at":          saved["created_at"],
        "key_id":              key_id,
        "key_name":            key["name"],
        "student_name":        student_name,
        "student_id":          student_id,
        "class_id":            class_id,
        "total":               omr_result["total"],
        "correct":             omr_result["correct"],
        "wrong":               omr_result["wrong"],
        "unattempted":         omr_result["unattempted"],
        "percentage":          omr_result["percentage"],
        "grade":               omr_result["grade"],
        "confidence":          omr_result["confidence"],
        "per_question":        omr_result["per_question"],
        "sections":            omr_result["sections"],
        "original_image_url":  original_url,
        "annotated_image_url": annotated_url,
        "processing_ms":       omr_result["processing_ms"],
    }


class DigitalStudentResult(BaseModel):
    student_id: str
    answers: List[Optional[str]]

class DigitalBatchRequest(BaseModel):
    key_id: str
    students: List[DigitalStudentResult]

@router.post("/batch/digital")
async def check_batch_digital(
    body: DigitalBatchRequest,
    user:   UserContext = Depends(require_auth),
):
    """
    Grades an array of students digitally without using Image/Computer Vision.
    Format is a list of {"student_id": "...", "answers": ["A", "B", None...]}
    """
    # ── 1. Check usage limit
    used = _get_usage(user.id)
    if used >= 500:
        raise HTTPException(
            status_code=429,
            detail="Monthly limit reached (500 sheets)."
        )

    # ── 2. Fetch answer key
    key_res = _admin().table(KEYS_TABLE).select("*").eq("id", body.key_id).single().execute()
    if not key_res.data:
        raise HTTPException(status_code=404, detail="Answer key not found.")
    if key_res.data["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="You don't own this answer key.")

    key = key_res.data
    q_count = key["question_count"]
    db_answers = key["answers"]  # list of ints (0-based)

    results = []
    
    import time
    t0 = time.time()
    
    for s in body.students:
        # Build student answer payload
        student_ans_list = []
        for q_idx in range(q_count):
            if q_idx < len(s.answers) and s.answers[q_idx]:
                 val = str(s.answers[q_idx]).upper()
                 if val in CHOICE_LABELS:
                     student_ans_list.append(CHOICE_LABELS.index(val))
                 else:
                     student_ans_list.append(None)
            else:
                 student_ans_list.append(None)
            
        check_results = check_answers(student_ans_list, db_answers)
        report = generate_report(check_results, q_count)
        
        per_question = []
        for d in report["details"]:
            q_idx = d["question"] - 1
            sa = student_ans_list[q_idx] if q_idx < len(student_ans_list) else None
            ca = db_answers[q_idx] if q_idx < len(db_answers) else None
            per_question.append({
                "q": d["question"],
                "student_answer": sa,
                "correct_answer": ca,
                "correct": d["status"] == "correct",
            })
        
        results.append({
            "student_id": s.student_id,
            "total": q_count,
            "correct": report["correct"],
            "wrong": report["wrong"],
            "unattempted": report["unattempted"],
            "percentage": round(report["percentage"], 2),
            "grade": report["grade"],
            "per_question": per_question,
            "sections": {}
        })
        
    processing_ms = int((time.time() - t0) * 1000)
    
    # Do we write to DB? To avoid cluttering the visual UI without photos, 
    # we just return the raw batch evaluation to let the user download the CSV.
    # Note: Usage gets bumped by length (capped by max) But let's just count as 1 or N?
    # Because of the 500 cap, grading 100 rows is equivalent to 100 CV parses? Yes. But they don't upload photos.
    # We will increment usage by len(students)
    try:
        current_used = _get_usage(user.id)
        if current_used + len(body.students) <= 500:
            month = datetime.now(timezone.utc).strftime("%Y-%m")
            existing = _admin().table(USAGE_TABLE).select("id, check_count").eq("user_id", user.id).eq("month", month).execute()
            if existing.data:
                new_count = existing.data[0]["check_count"] + len(body.students)
                _admin().table(USAGE_TABLE).update({"check_count": new_count}).eq("id", existing.data[0]["id"]).execute()
        
    except Exception as e:
        logger.warning(f"Usage bulk increment failed: {e}")

    # Calculate overall batch stats
    ok = len([r for r in results if r["percentage"] >= 0])
    pass_cnt = len([r for r in results if r["grade"] not in ("F", "Fail", "D-")])
    avg_pct = sum(r["percentage"] for r in results) / ok if ok else 0

    return {
        "batch_id": f"digital_{int(time.time())}",
        "total_sheets": len(results),
        "ok": ok,
        "errors": 0,
        "avg_percentage": round(avg_pct, 1),
        "pass_rate": round((pass_cnt / ok) * 100, 1) if ok else 0,
        "processing_ms": processing_ms,
        "results": results
    }
