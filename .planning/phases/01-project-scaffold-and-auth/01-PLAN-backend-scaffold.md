---
plan: "01-backend-scaffold"
phase: 1
wave: 1
requirements_addressed: ["AUTH-01", "AUTH-02", "AUTH-03", "AUTH-04"]
files_modified:
  - backend/app/main.py
  - backend/app/api/auth.py
  - backend/app/core/config.py
  - backend/app/core/supabase_client.py
  - backend/.env.example
  - backend/requirements.txt
  - backend/Dockerfile
autonomous: true
---

# Plan 01: FastAPI Backend Scaffold

## Objective
Create a production-ready FastAPI backend that wraps the existing OMR Python engine and provides auth endpoints via Supabase.

## Wave
Wave 1 — no dependencies

## Tasks

<task id="T1">
<title>Create backend directory structure and requirements</title>
<read_first>
- requirements.txt (existing OMR engine deps)
- src/main.py (existing engine entry point)
</read_first>
<action>
Create `backend/` directory with this structure:
```
backend/
  app/
    __init__.py
    main.py          ← FastAPI app factory
    api/
      __init__.py
      auth.py        ← /api/auth/* routes
      check.py       ← /api/check route (Phase 3)
      keys.py        ← /api/keys/* routes (Phase 2)
    core/
      __init__.py
      config.py      ← Settings from env
      supabase_client.py ← Supabase client singleton
    models/
      __init__.py
  requirements.txt   ← All deps
  .env.example
  Dockerfile
```

Create `backend/requirements.txt` with:
```
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.9
python-dotenv==1.0.0
supabase==2.3.4
opencv-python==4.8.1.78
numpy==1.24.3
imutils==0.5.4
Pillow==10.0.1
pytesseract==0.3.10
reportlab==4.0.9
```
</action>
<acceptance_criteria>
- backend/app/main.py exists
- backend/requirements.txt contains "fastapi==0.109.0"
- backend/requirements.txt contains "supabase==2.3.4"
- backend/requirements.txt contains "opencv-python"
</acceptance_criteria>
</task>

<task id="T2">
<title>Create core config and Supabase client</title>
<read_first>
- backend/requirements.txt
</read_first>
<action>
Create `backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    cors_origins: str = "http://localhost:5173"
    max_upload_mb: int = 20

    class Config:
        env_file = ".env"

settings = Settings()
```

Create `backend/app/core/supabase_client.py`:
```python
from supabase import create_client, Client
from app.core.config import settings

_client: Client | None = None

def get_supabase() -> Client:
    global _client
    if _client is None:
        _client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _client

def get_supabase_admin() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)
```

Create `backend/.env.example`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
CORS_ORIGINS=http://localhost:5173
MAX_UPLOAD_MB=20
```
</action>
<acceptance_criteria>
- backend/app/core/config.py contains "class Settings(BaseSettings)"
- backend/app/core/supabase_client.py contains "def get_supabase"
- backend/.env.example contains "SUPABASE_URL="
</acceptance_criteria>
</task>

<task id="T3">
<title>Create FastAPI main app with CORS and health endpoint</title>
<read_first>
- backend/app/core/config.py
</read_first>
<action>
Create `backend/app/main.py`:
```python
import sys
import os

# Add src/ to path so existing OMR engine can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, keys, check

app = FastAPI(
    title="AntiGravity OMR Check API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)

CORS_ORIGINS = [o.strip() for o in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(keys.router, prefix="/api/keys", tags=["keys"])
app.include_router(check.router, prefix="/api", tags=["check"])

@app.get("/health")
async def health():
    return {"status": "ok", "service": "antigravity-omr-api"}
```
</action>
<acceptance_criteria>
- backend/app/main.py contains "def health()"
- backend/app/main.py contains "CORSMiddleware"
- backend/app/main.py contains 'return {"status": "ok"'
</acceptance_criteria>
</task>

<task id="T4">
<title>Create auth API routes (Supabase passthrough)</title>
<read_first>
- backend/app/main.py
- backend/app/core/supabase_client.py
</read_first>
<action>
Create `backend/app/api/__init__.py` (empty).
Create `backend/app/api/auth.py`:
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.core.supabase_client import get_supabase

router = APIRouter()

class SignUpRequest(BaseModel):
    email: EmailStr
    password: str

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class ResetRequest(BaseModel):
    email: EmailStr

@router.post("/signup")
async def signup(body: SignUpRequest):
    try:
        sb = get_supabase()
        res = sb.auth.sign_up({"email": body.email, "password": body.password})
        if res.user is None:
            raise HTTPException(400, "Sign up failed — check email/password")
        return {"message": "Check your email to confirm registration", "user_id": res.user.id}
    except Exception as e:
        raise HTTPException(400, str(e))

@router.post("/signin")
async def signin(body: SignInRequest):
    try:
        sb = get_supabase()
        res = sb.auth.sign_in_with_password({"email": body.email, "password": body.password})
        if res.session is None:
            raise HTTPException(401, "Invalid credentials")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user": {"id": res.user.id, "email": res.user.email}
        }
    except Exception as e:
        raise HTTPException(401, str(e))

@router.post("/signout")
async def signout():
    # Stateless — client should discard tokens
    return {"message": "Signed out"}

@router.post("/reset-password")
async def reset_password(body: ResetRequest):
    try:
        sb = get_supabase()
        sb.auth.reset_password_email(body.email)
        return {"message": "Password reset email sent"}
    except Exception as e:
        raise HTTPException(400, str(e))
```

Create stub `backend/app/api/keys.py`:
```python
from fastapi import APIRouter
router = APIRouter()
# Implemented in Phase 2
```

Create stub `backend/app/api/check.py`:
```python
from fastapi import APIRouter
router = APIRouter()
# Implemented in Phase 3
```
</action>
<acceptance_criteria>
- backend/app/api/auth.py contains "async def signup"
- backend/app/api/auth.py contains "async def signin"
- backend/app/api/auth.py contains "async def signout"
- backend/app/api/auth.py contains "async def reset_password"
- backend/app/api/keys.py exists
- backend/app/api/check.py exists
</acceptance_criteria>
</task>

<task id="T5">
<title>Create Dockerfile for backend</title>
<read_first>
- backend/requirements.txt
- backend/app/main.py
</read_first>
<action>
Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install OpenCV system deps
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1-mesa-glx \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app
COPY . .

# Copy existing OMR engine
COPY ../src ./src

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `backend/app/__init__.py`, `backend/app/core/__init__.py`, `backend/app/models/__init__.py` (all empty).
</action>
<acceptance_criteria>
- backend/Dockerfile contains "FROM python:3.11-slim"
- backend/Dockerfile contains "uvicorn"
- backend/app/__init__.py exists
</acceptance_criteria>
</task>

## Verification criteria
- `backend/app/main.py` exists with FastAPI app, health endpoint, CORS, and all 3 routers included
- `backend/app/api/auth.py` has all 4 auth endpoints
- `backend/.env.example` documents all required env vars
- `backend/requirements.txt` includes fastapi, supabase, opencv-python

## must_haves
- Health endpoint returns `{"status":"ok"}` 
- Auth endpoints exist (signup/signin/signout/reset)
- CORS allows frontend origin
- Existing src/ OMR engine is importable from backend context
