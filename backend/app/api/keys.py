"""
keys.py
=======
Answer key CRUD endpoints.
All routes are protected — require a valid Supabase JWT.

Routes:
    GET    /api/keys          → list all keys for the authenticated user
    POST   /api/keys          → create a new key
    POST   /api/keys/scan     → scan an image to extract answers (OMR)
    GET    /api/keys/{id}     → get a single key
    PUT    /api/keys/{id}     → update a key
    DELETE /api/keys/{id}     → delete a key
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from typing import List
from app.core.deps import require_auth, UserContext
from app.core.supabase_client import get_supabase_admin
from app.models.answer_key import AnswerKeyCreate, AnswerKeyUpdate, AnswerKeyResponse
import secrets
import string

logger = logging.getLogger(__name__)

router = APIRouter()

TABLE = "answer_keys"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/bmp",
                       "image/heic", "image/heif", "image/webp"}
CHOICE_LABELS = ["A", "B", "C", "D", "E"]


# ────────────────────────── helpers ──────────────────────────────────────────

def _admin():
    return get_supabase_admin()


def _owned(key_row: dict, user_id: str):
    """Raise 403 if key belongs to another user."""
    if key_row.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="You don't own this answer key.")


# ────────────────────────── routes ───────────────────────────────────────────

@router.get("", response_model=List[AnswerKeyResponse])
async def list_keys(user: UserContext = Depends(require_auth)):
    """Return all answer keys owned by the current user, newest first."""
    res = (
        _admin()
        .table(TABLE)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.post("", response_model=AnswerKeyResponse, status_code=201)
async def create_key(body: AnswerKeyCreate, user: UserContext = Depends(require_auth)):
    """Create a new answer key for the current user."""
    payload = {
        "user_id": user.id,
        "name": body.name,
        "question_count": body.question_count,
        "choices_per_question": body.choices_per_question,
        "answers": body.answers,
    }
    res = _admin().table(TABLE).insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create answer key.")
    return res.data[0]


@router.post("/scan")
async def scan_answer_key_image(
    image:  UploadFile = File(..., description="Photo of a filled-in answer key bubble sheet"),
    num_questions: int = Query(20, ge=1, le=100, description="Number of questions on the sheet"),
    choices: int       = Query(4, ge=2, le=5, description="Number of choices per question (A-D=4, A-E=5)"),
    user:   UserContext = Depends(require_auth),
):
    """
    Scan an uploaded bubble sheet image and extract the marked answers.

    Uses the OMR engine pipeline:
      1. Perspective correction (scan_and_warp)
      2. Bubble detection (detect_bubbles)
      3. Filled-pixel analysis to identify marked answers (find_answered_bubbles)

    Returns a list of detected answers as letter labels (A/B/C/D/E or null for unattempted).
    The teacher can review and save these as a new answer key.
    """
    import sys, os
    _SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))
    if _SRC_DIR not in sys.path:
        sys.path.insert(0, _SRC_DIR)

    try:
        from scanner  import scan_and_warp
        from detector import detect_bubbles, find_answered_bubbles
    except ImportError as e:
        raise HTTPException(status_code=501, detail=f"OMR engine not available: {e}")

    import cv2
    import numpy as np

    # ── Validate image ────────────────────────────────────────────────────────
    content_type = (image.content_type or "").lower()
    ext = (image.filename or "").rsplit(".", 1)[-1].lower()
    if content_type not in ALLOWED_IMAGE_TYPES and ext not in {"jpg", "jpeg", "png", "bmp", "heic", "heif", "webp"}:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type or ext}")

    image_bytes = await image.read()
    if len(image_bytes) < 1024:
        raise HTTPException(status_code=400, detail="Image too small — minimum 1 KB.")
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large — max 20 MB.")

    # ── Decode image ──────────────────────────────────────────────────────────
    np_arr = np.frombuffer(image_bytes, np.uint8)
    img    = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image — unsupported format or corrupted file.")

    # ── Run OMR pipeline ──────────────────────────────────────────────────────
    # 1. Perspective correction
    warped = scan_and_warp(img)
    perspective_ok = warped is not None
    if warped is None:
        logger.warning("Sheet boundary not found — using full image for scan.")
        warped = img.copy()

    # 2. Detect bubbles
    try:
        bubbles = detect_bubbles(warped, num_questions, choices)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Could not detect bubbles: {e}. Ensure good lighting and the sheet fills most of the frame."
        )

    if bubbles is None:
        raise HTTPException(
            status_code=422,
            detail="Could not detect answer bubbles. Try a clearer photo with better lighting."
        )

    # 3. Find which bubbles are filled
    student_answers = find_answered_bubbles(warped, bubbles, num_questions, choices)

    # ── Convert to labels ─────────────────────────────────────────────────────
    detected_answers = []
    for ans in student_answers:
        if ans is not None and 0 <= ans < len(CHOICE_LABELS):
            detected_answers.append(CHOICE_LABELS[ans])
        else:
            detected_answers.append(None)

    # ── Stats ─────────────────────────────────────────────────────────────────
    filled_count   = sum(1 for a in detected_answers if a is not None)
    empty_count    = num_questions - filled_count
    confidence     = 90 if perspective_ok else 70
    if empty_count > num_questions * 0.3:
        confidence = max(30, confidence - 25)  # lower confidence if many undetected

    logger.info(
        f"Key scan: user={user.id} questions={num_questions} detected={filled_count} "
        f"empty={empty_count} confidence={confidence}"
    )

    return {
        "answers":        detected_answers,         # ["A", "B", null, "D", ...]
        "answers_idx":    student_answers,           # [0, 1, None, 3, ...]
        "num_questions":  num_questions,
        "choices":        choices,
        "detected":       filled_count,
        "undetected":     empty_count,
        "confidence":     confidence,
        "perspective_ok": perspective_ok,
    }


@router.get("/{key_id}", response_model=AnswerKeyResponse)
async def get_key(key_id: str, user: UserContext = Depends(require_auth)):
    """Return a single answer key by ID."""
    res = _admin().table(TABLE).select("*").eq("id", key_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Answer key not found.")
    _owned(res.data, user.id)
    return res.data


@router.put("/{key_id}", response_model=AnswerKeyResponse)
async def update_key(key_id: str, body: AnswerKeyUpdate, user: UserContext = Depends(require_auth)):
    """Update an existing answer key."""
    # Verify ownership first
    existing = _admin().table(TABLE).select("user_id, question_count, choices_per_question").eq("id", key_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Answer key not found.")
    _owned(existing.data, user.id)

    patch = body.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update.")

    # Validate answers length if being updated
    q_count  = patch.get("question_count", existing.data["question_count"])
    choices  = patch.get("choices_per_question", existing.data["choices_per_question"])
    if "answers" in patch:
        if len(patch["answers"]) != q_count:
            raise HTTPException(status_code=400, detail=f"answers must have {q_count} items.")
        for i, a in enumerate(patch["answers"]):
            if a < 0 or a >= choices:
                raise HTTPException(status_code=400, detail=f"Q{i+1}: answer index {a} out of range.")

    res = _admin().table(TABLE).update(patch).eq("id", key_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Update failed.")
    return res.data[0]


@router.delete("/{key_id}", status_code=204)
async def delete_key(key_id: str, user: UserContext = Depends(require_auth)):
    """Delete an answer key. Returns 204 No Content on success."""
    existing = _admin().table(TABLE).select("user_id").eq("id", key_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Answer key not found.")
    _owned(existing.data, user.id)
    _admin().table(TABLE).delete().eq("id", key_id).execute()
    return None


@router.get("/{key_id}/share")
async def get_share_code(key_id: str, user: UserContext = Depends(require_auth)):
    """Generate or retrieve a unique 6-character share code for this key."""
    # Verify owner
    res = _admin().table(TABLE).select("user_id, share_code").eq("id", key_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Key not found")
    _owned(res.data, user.id)

    if res.data.get("share_code"):
        return {"share_code": res.data["share_code"]}

    # Generate unique 6-char alpha-numeric code
    chars = string.ascii_uppercase + string.digits
    for _ in range(10):  # Try 10 times to avoid collision
        code = "".join(secrets.choice(chars) for _ in range(6))
        upd = _admin().table(TABLE).update({"share_code": code}).eq("id", key_id).execute()
        if upd.data:
            return {"share_code": code}

    raise HTTPException(status_code=500, detail="Failed to generate unique share code")


@router.post("/import", response_model=AnswerKeyResponse)
async def import_key(code: str = Query(...), user: UserContext = Depends(require_auth)):
    """Import an answer key shared by another teacher."""
    # Find key by share code
    res = _admin().table(TABLE).select("*").eq("share_code", code.upper()).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invalid share code or key not found")

    source_key = res.data

    # Create a copy for the current user
    payload = {
        "user_id": user.id,
        "name": f"{source_key['name']} (Imported)",
        "question_count": source_key["question_count"],
        "choices_per_question": source_key["choices_per_question"],
        "answers": source_key["answers"],
    }
    insert_res = _admin().table(TABLE).insert(payload).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to import key")

    return insert_res.data[0]
