import logging
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from typing import List, Optional
from app.core.supabase_client import get_supabase
from app.api.auth import require_auth, UserContext

router = APIRouter()

class StudentCreate(BaseModel):
    name: str
    roll_number: Optional[str] = None
    class_id: Optional[str] = None

@router.get("/", response_model=List[dict])
async def list_students(class_id: Optional[str] = None, user: UserContext = Depends(require_auth)):
    sb = get_supabase()
    try:
        # Try to fetch with class names (requires foreign key relationship to be cached)
        query = sb.from_("students").select("*, classes(name)").eq("teacher_id", user.id)
        if class_id:
            query = query.eq("class_id", class_id)
        res = query.order("name").execute()
        return res.data
    except Exception as e:
        logger.warning(f"Student join query failed, falling back to simple select: {e}")
        # Fallback to simple select if join fails
        query = sb.from_("students").select("*").eq("teacher_id", user.id)
        if class_id:
            query = query.eq("class_id", class_id)
        res = query.order("name").execute()
        return res.data

@router.post("/", response_model=dict)
async def create_student(body: StudentCreate, user: UserContext = Depends(require_auth)):
    sb = get_supabase()
    data = {
        "name": body.name,
        "roll_number": body.roll_number,
        "class_id": body.class_id,
        "teacher_id": user.id
    }
    res = sb.from_("students").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create student.")
    return res.data[0]

@router.delete("/{student_id}")
async def delete_student(student_id: str, user: UserContext = Depends(require_auth)):
    sb = get_supabase()
    res = sb.from_("students").delete().eq("id", student_id).eq("teacher_id", user.id).execute()
    return {"status": "deleted"}
