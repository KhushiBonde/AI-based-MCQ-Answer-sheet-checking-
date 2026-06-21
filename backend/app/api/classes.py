from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from app.core.supabase_client import get_supabase
from app.api.auth import require_auth, UserContext

router = APIRouter()

class ClassCreate(BaseModel):
    name: str

class ClassUpdate(BaseModel):
    name: str

@router.get("/", response_model=List[dict])
async def list_classes(user: UserContext = Depends(require_auth)):
    sb = get_supabase()
    res = sb.from_("classes").select("*").eq("teacher_id", user.id).order("name").execute()
    return res.data

@router.post("/", response_model=dict)
async def create_class(body: ClassCreate, user: UserContext = Depends(require_auth)):
    sb = get_supabase()
    data = {
        "name": body.name,
        "teacher_id": user.id
    }
    res = sb.from_("classes").insert(data).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create class.")
    return res.data[0]

@router.delete("/{class_id}")
async def delete_class(class_id: str, user: UserContext = Depends(require_auth)):
    sb = get_supabase()
    res = sb.from_("classes").delete().eq("id", class_id).eq("teacher_id", user.id).execute()
    return {"status": "deleted"}
