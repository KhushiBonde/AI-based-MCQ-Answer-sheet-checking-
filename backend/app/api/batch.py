"""
batch.py
========
Batch upload: process multiple answer sheet images in one request.

POST /api/batch
    - Accepts up to 50 images as multipart/form-data
    - key_id (same key for all sheets)
    - Processes each image sequentially (threaded pool for I/O)
    - Returns summary + per-file results
    - Provides downloadable CSV

GET /api/batch/{batch_id}/csv
    - Download results as CSV

Architecture note:
    For MVP, processing is synchronous in-request (fast enough for < 20 sheets).
    Phase 7 can upgrade to a Celery/Redis queue for 50+ sheets.
"""
from __future__ import annotations
import csv
import io
import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.deps import require_auth, UserContext
from app.core.supabase_client import get_supabase_admin
from app.core.omr_engine import run_omr_check

logger = logging.getLogger(__name__)
router = APIRouter()

KEYS_TABLE    = "answer_keys"
RESULTS_TABLE = "check_results"
USAGE_TABLE   = "usage_counters"
MAX_BATCH     = 50
GRADE_ORDER   = ["A+","A","B","C","D","F"]

CHOICE_LABELS = ["A","B","C","D","E"]


def _admin():
    return get_supabase_admin()


def _get_used(user_id: str) -> int:
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    res = _admin().table(USAGE_TABLE).select("check_count").eq("user_id", user_id).eq("month", month).execute()
    return res.data[0]["check_count"] if res.data else 0


def _increment_usage(user_id: str, count: int):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    existing = _admin().table(USAGE_TABLE).select("id,check_count").eq("user_id", user_id).eq("month", month).execute()
    if existing.data:
        new_count = existing.data[0]["check_count"] + count
        _admin().table(USAGE_TABLE).update({"check_count": new_count}).eq("id", existing.data[0]["id"]).execute()
    else:
        _admin().table(USAGE_TABLE).insert({"user_id": user_id, "month": month, "check_count": count}).execute()


def _process_one(idx: int, filename: str, img_bytes: bytes, key: dict) -> dict:
    """Process one image; returns result dict with filename and status."""
    try:
        result = run_omr_check(
            image_bytes=img_bytes,
            answers=key["answers"],
            choices_per_question=key["choices_per_question"],
            question_count=key["question_count"],
        )
        return {
            "idx":      idx,
            "filename": filename,
            "status":   "ok",
            **result,
        }
    except Exception as exc:
        return {
            "idx":      idx,
            "filename": filename,
            "status":   "error",
            "error":    str(exc),
            "correct":  0,
            "total":    key["question_count"],
            "percentage": 0.0,
            "grade":    "F",
            "confidence": 0,
        }


@router.post("/batch")
async def batch_check(
    images: List[UploadFile] = File(..., description="Up to 50 answer sheet images"),
    key_id: str              = Form(...),
    user:   UserContext      = Depends(require_auth),
):
    """
    Batch-process multiple answer sheet images against one answer key.
    Returns an aggregated summary + per-file results.
    """

    # ── Validate count ────────────────────────────────────────────────────────
    if len(images) == 0:
        raise HTTPException(status_code=400, detail="No images uploaded.")
    if len(images) > MAX_BATCH:
        raise HTTPException(status_code=400, detail=f"Max {MAX_BATCH} images per batch. You sent {len(images)}.")

    # ── Check usage headroom ──────────────────────────────────────────────────
    used = _get_used(user.id)
    if used + len(images) > 500:
        remaining = max(0, 500 - used)
        raise HTTPException(
            status_code=429,
            detail=f"Batch would exceed monthly limit. You have {remaining} checks remaining."
        )

    # ── Fetch key ─────────────────────────────────────────────────────────────
    key_res = _admin().table(KEYS_TABLE).select("*").eq("id", key_id).single().execute()
    if not key_res.data:
        raise HTTPException(status_code=404, detail="Answer key not found.")
    if key_res.data["user_id"] != user.id:
        raise HTTPException(status_code=403, detail="You don't own this answer key.")
    key = key_res.data

    # ── Read all image bytes ──────────────────────────────────────────────────
    items = []
    for i, f in enumerate(images):
        data = await f.read()
        items.append((i, f.filename or f"sheet_{i+1}.jpg", data))

    # ── Process in thread pool ────────────────────────────────────────────────
    t0      = time.time()
    results = [None] * len(items)

    with ThreadPoolExecutor(max_workers=min(4, len(items))) as pool:
        futures = {
            pool.submit(_process_one, idx, fname, data, key): idx
            for idx, fname, data in items
        }
        for future in as_completed(futures):
            res = future.result()
            results[res["idx"]] = res

    # ── Persist results to DB ─────────────────────────────────────────────────
    ok_results = [r for r in results if r["status"] == "ok"]
    rows_to_insert = [
        {
            "user_id":     user.id,
            "key_id":      key_id,
            "key_name":    key["name"],
            "total":       r["total"],
            "correct":     r["correct"],
            "wrong":       r.get("wrong", r["total"] - r["correct"]),
            "unattempted": r.get("unattempted", 0),
            "percentage":  r["percentage"],
            "grade":       r["grade"],
            "confidence":  r.get("confidence", 0),
            "per_question": r.get("per_question", []),
            "sections":    r.get("sections", []),
        }
        for r in ok_results
    ]
    if rows_to_insert:
        _admin().table(RESULTS_TABLE).insert(rows_to_insert).execute()

    # ── Increment usage ───────────────────────────────────────────────────────
    if ok_results:
        try:
            _increment_usage(user.id, len(ok_results))
        except Exception as e:
            logger.warning(f"Batch usage increment failed: {e}")

    # ── Aggregate summary ─────────────────────────────────────────────────────
    total_sheets  = len(results)
    ok_count      = len(ok_results)
    error_count   = total_sheets - ok_count
    avg_pct       = round(sum(r["percentage"] for r in ok_results) / ok_count, 1) if ok_count else 0
    avg_grade     = _avg_grade(ok_results)
    pass_count    = sum(1 for r in ok_results if r["percentage"] >= 50)
    processing_ms = int((time.time() - t0) * 1000)

    # Attach a batch_id for CSV download
    batch_id = str(uuid.uuid4())

    return {
        "batch_id":      batch_id,
        "total_sheets":  total_sheets,
        "ok":            ok_count,
        "errors":        error_count,
        "avg_percentage": avg_pct,
        "avg_grade":     avg_grade,
        "pass_rate":     round(pass_count / ok_count * 100, 1) if ok_count else 0,
        "processing_ms": processing_ms,
        "results": [
            {
                "idx":        r["idx"],
                "filename":   r["filename"],
                "status":     r["status"],
                "correct":    r.get("correct"),
                "total":      r.get("total"),
                "percentage": r.get("percentage"),
                "grade":      r.get("grade"),
                "confidence": r.get("confidence"),
                "error":      r.get("error"),
            }
            for r in results
        ],
    }


def _avg_grade(results):
    if not results:
        return "F"
    avg_pct = sum(r["percentage"] for r in results) / len(results)
    if avg_pct >= 90: return "A+"
    if avg_pct >= 80: return "A"
    if avg_pct >= 70: return "B"
    if avg_pct >= 60: return "C"
    if avg_pct >= 50: return "D"
    return "F"


@router.post("/batch/csv")
async def batch_csv(
    results_payload: dict,
    user: UserContext = Depends(require_auth),
):
    """
    Generate and return a CSV file for a batch result payload.
    POST body: { "results": [...], "key_name": "...", "batch_id": "..." }
    """
    results    = results_payload.get("results", [])
    key_name   = results_payload.get("key_name", "Answer Key")
    batch_id   = results_payload.get("batch_id", "batch")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["#", "Filename", "Status", "Correct", "Total", "Percentage", "Grade", "Confidence", "Error"])
    for i, r in enumerate(results, 1):
        writer.writerow([
            i, r.get("filename",""), r.get("status",""),
            r.get("correct",""), r.get("total",""),
            r.get("percentage",""), r.get("grade",""),
            r.get("confidence",""), r.get("error",""),
        ])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="batch_{batch_id[:8]}.csv"'},
    )
