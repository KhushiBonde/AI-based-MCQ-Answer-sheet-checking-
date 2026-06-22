"""
main.py
=======
FastAPI application factory for Markix API.
"""
import sys
import os

# Add the existing OMR engine (src/) to the Python path
# so it can be imported from anywhere in this backend
_SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "src")
if os.path.isdir(_SRC_DIR):
    sys.path.insert(0, os.path.abspath(_SRC_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, keys, check, results, batch, generator, classes, students

# ── App setup ────────────────────────────────────────────────────────────────

IS_VERCEL = os.environ.get("VERCEL") == "1"
API_PREFIX = "" if IS_VERCEL else "/api"

app = FastAPI(
    title="Markix API",
    description="AI-powered MCQ answer sheet grading — backend service",
    version="1.0.0",
    docs_url=f"{API_PREFIX}/docs" if API_PREFIX else "/docs",
    redoc_url=f"{API_PREFIX}/redoc" if API_PREFIX else "/redoc",
    openapi_url=f"{API_PREFIX}/openapi.json" if API_PREFIX else "/openapi.json",
)

# ── CORS ─────────────────────────────────────────────────────────────────────

import logging
logger = logging.getLogger("uvicorn")

# Parse origins from settings and add common dev defaults
ALLOWED_ORIGINS = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
if "http://localhost:5173" not in ALLOWED_ORIGINS: ALLOWED_ORIGINS.append("http://localhost:5173")
if "http://127.0.0.1:5173" not in ALLOWED_ORIGINS: ALLOWED_ORIGINS.append("http://127.0.0.1:5173")

logger.info(f"CORS: ALLOWED_ORIGINS = {ALLOWED_ORIGINS}")

from fastapi import Request
from fastapi.responses import JSONResponse

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"GLOBAL ERROR: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        }
    )

# ── Routes ───────────────────────────────────────────────────────────────────

app.include_router(auth.router,  prefix=f"{API_PREFIX}/auth",  tags=["Authentication"])
app.include_router(keys.router,  prefix=f"{API_PREFIX}/keys",  tags=["Answer Keys"])
app.include_router(check.router,   prefix=f"{API_PREFIX}",       tags=["OMR Check"])
app.include_router(results.router, prefix=f"{API_PREFIX}",       tags=["Results"])
app.include_router(batch.router,   prefix=f"{API_PREFIX}",       tags=["Batch"])
app.include_router(generator.router, prefix=f"{API_PREFIX}",     tags=["Generator"])
app.include_router(classes.router,   prefix=f"{API_PREFIX}/classes", tags=["Classes"])
app.include_router(students.router,  prefix=f"{API_PREFIX}/students", tags=["Students"])


# ── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    """Liveness probe — returns 200 with status OK."""
    return {"status": "ok", "service": "markix-omr-api", "version": "1.0.0"}


# ── Dev entrypoint ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
