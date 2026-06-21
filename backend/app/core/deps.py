"""
deps.py
=======
FastAPI dependency injection helpers.

Usage:
    @router.get("/...")
    async def endpoint(user: UserContext = Depends(require_auth)):
        user.id  # Supabase user UUID
        user.email
"""
from __future__ import annotations
from fastapi import Depends, HTTPException, Header
from typing import Optional
from dataclasses import dataclass
from app.core.supabase_client import get_supabase_admin


@dataclass
class UserContext:
    id: str
    email: str


async def require_auth(authorization: Optional[str] = Header(None)) -> UserContext:
    """
    Validate the Supabase JWT from the Authorization: Bearer <token> header.
    Returns a UserContext with user.id and user.email.
    Raises HTTP 401 if missing or invalid.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Expected: Bearer <token>",
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        admin = get_supabase_admin()
        res = admin.auth.get_user(token)
        if res is None or res.user is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        return UserContext(id=res.user.id, email=res.user.email)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")
