"""
results.py
==========
Read-only endpoints for check results (write happens in check.py during processing).

Routes:
    GET  /api/results           → list results for current user (newest first, paginated)
    GET  /api/results/{id}      → get single result
    GET  /api/results/{id}/pdf  → download PDF (Phase 4 — stub for now)
    GET  /api/usage             → get current month's usage count
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import Response, StreamingResponse
from typing import List, Optional
from datetime import datetime, timezone
from app.core.deps import require_auth, UserContext
from app.core.supabase_client import get_supabase_admin
from app.core.pdf_export import generate_result_pdf

router = APIRouter()

RESULTS_TABLE = "check_results"
USAGE_TABLE   = "usage_counters"
LIMIT_PER_MONTH = 500


def _admin():
    return get_supabase_admin()


# ── Results list ──────────────────────────────────────────────────────────────

@router.get("/results")
async def list_results(
    user: UserContext = Depends(require_auth),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    key_id: Optional[str] = Query(None, description="Filter by answer key"),
):
    """Return paginated check results for the current user."""
    try:
        q = (
            _admin()
            .table(RESULTS_TABLE)
            .select("id, created_at, key_id, key_name, student_name, correct, total, percentage, grade, confidence")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if key_id:
            q = q.eq("key_id", key_id)
        res = q.execute()
    except Exception as e:
        # Fallback to select * if specific columns (like student_name) fail
        q = (
            _admin()
            .table(RESULTS_TABLE)
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
        )
        if key_id:
            q = q.eq("key_id", key_id)
        res = q.execute()
    return res.data or []


@router.get("/results/{result_id}")
async def get_result(result_id: str, user: UserContext = Depends(require_auth)):
    """Return a single full result (includes per_question and sections)."""
    res = (
        _admin()
        .table(RESULTS_TABLE)
        .select("*")
        .eq("id", result_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Result not found.")
    if res.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="You don't own this result.")
    return res.data


@router.get("/results/{result_id}/pdf")
async def get_result_pdf(result_id: str, user: UserContext = Depends(require_auth)):
    """Generate and return a styled PDF for a result."""
    res = (
        _admin()
        .table(RESULTS_TABLE)
        .select("*")
        .eq("id", result_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Result not found.")
    if res.data.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="You don't own this result.")

    try:
        pdf_bytes = generate_result_pdf(res.data)
    except RuntimeError as exc:
        raise HTTPException(status_code=501, detail=str(exc))

    key_name = (res.data.get("key_name") or "result").replace(" ", "_")[:30]
    filename = f"Markix_Result_{key_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Usage ─────────────────────────────────────────────────────────────────────

@router.get("/usage")
async def get_usage(user: UserContext = Depends(require_auth)):
    """Return this month's usage count and the plan limit."""
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    res = (
        _admin()
        .table(USAGE_TABLE)
        .select("check_count")
        .eq("user_id", user.id)
        .eq("month", month)
        .execute()
    )
    used = (res.data[0]["check_count"] if res.data else 0)
    return {
        "used":  used,
        "limit": LIMIT_PER_MONTH,
        "month": month,
        "remaining": max(0, LIMIT_PER_MONTH - used),
        "percentage": round((used / LIMIT_PER_MONTH) * 100, 1),
    }
