"""
auth.py
=======
Auth endpoints — thin wrappers over Supabase Auth.
Supabase handles all token management; we just forward responses.
"""
from fastapi import APIRouter, HTTPException, Header, Depends, Request
from pydantic import BaseModel, EmailStr
from app.core.supabase_client import get_supabase
from app.core.deps import require_auth, UserContext

router = APIRouter()


# ── Request schemas ──────────────────────────────────────────────────────────

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class ResetRequest(BaseModel):
    email: EmailStr


class RefreshRequest(BaseModel):
    refresh_token: str


class UpdatePasswordRequest(BaseModel):
    new_password: str


class UpdateProfileRequest(BaseModel):
    full_name: str


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/signup")
async def signup(body: SignUpRequest):
    """Create a new user account in Supabase Auth."""
    try:
        sb = get_supabase()
        res = sb.auth.sign_up({"email": body.email, "password": body.password})
        if res.user is None:
            raise HTTPException(status_code=400, detail="Sign up failed — check email/password requirements.")
        
        # If email confirmation is disabled, return session tokens directly
        if res.session:
            return {
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token,
                "expires_in": res.session.expires_in,
                "user": {
                    "id": res.user.id,
                    "email": res.user.email,
                },
            }

        return {
            "message": "Account created! Check your email to verify your address.",
            "user_id": res.user.id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def signin(body: SignInRequest):
    """Sign in with email and password; returns JWT access_token + refresh_token."""
    try:
        sb = get_supabase()
        res = sb.auth.sign_in_with_password({"email": body.email, "password": body.password})
        if res.session is None:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "expires_in": res.session.expires_in,
            "user": {
                "id": res.user.id,
                "email": res.user.email,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/signout")
async def signout():
    """
    Client-side signout: the frontend discards its tokens.
    Server-side we can optionally revoke the refresh token.
    """
    return {"message": "Signed out successfully."}


@router.post("/reset-password")
async def reset_password(body: ResetRequest):
    """Send a password reset email via Supabase Auth."""
    try:
        sb = get_supabase()
        sb.auth.reset_password_email(body.email)
        return {"message": "If that email is registered, a password reset link has been sent."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/refresh")
async def refresh_token(body: RefreshRequest):
    """Exchange a refresh_token for a new access_token."""
    try:
        sb = get_supabase()
        res = sb.auth.refresh_session(body.refresh_token)
        if res.session is None:
            raise HTTPException(status_code=401, detail="Refresh failed — session expired.")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "expires_in": res.session.expires_in,
            "user": {
                "id": res.user.id,
                "email": res.user.email,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/update-password")
async def update_password(
    body: UpdatePasswordRequest,
    user: UserContext = Depends(require_auth)
):
    """Update the current user's password."""
    try:
        sb = get_supabase()
        # Supabase auth expects a dict for user attributes
        sb.auth.update_user({"password": body.new_password})
        return {"message": "Password updated successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/update-profile")
async def update_profile(
    body: UpdateProfileRequest,
    user: UserContext = Depends(require_auth)
):
    """Update user metadata (like display name)."""
    try:
        sb = get_supabase()
        # Update user metadata
        res = sb.auth.update_user({"data": {"full_name": body.full_name}})
        if res.user is None:
            raise HTTPException(status_code=400, detail="Profile update failed.")
        return {
            "message": "Profile updated successfully.",
            "user": {
                "id": res.user.id,
                "email": res.user.email,
                "full_name": res.user.user_metadata.get("full_name")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/resend-verification")
async def resend_verification(body: ResetRequest):
    """Resend the verification email."""
    try:
        sb = get_supabase()
        res = sb.auth.resend({"type": "signup", "email": body.email})
        return {"message": "Verification email resent successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/google")
async def google_signin(request: Request):
    """Get the Google OAuth login URL."""
    try:
        sb = get_supabase()
        # Determine the origin dynamically from request headers
        origin = request.headers.get("origin") or request.headers.get("referer")
        if origin:
            origin = origin.rstrip("/")
            from urllib.parse import urlparse
            parsed = urlparse(origin)
            redirect_to = f"{parsed.scheme}://{parsed.netloc}/auth/callback"
        else:
            redirect_to = "http://localhost:5173/auth/callback"

        res = sb.auth.sign_in_with_oauth({"provider": "google", "options": {"redirectTo": redirect_to}})
        return {"url": res.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
