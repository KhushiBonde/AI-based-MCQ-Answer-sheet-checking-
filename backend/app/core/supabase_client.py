"""
supabase_client.py
==================
Singleton Supabase client helpers.
"""
from __future__ import annotations
from supabase import create_client, Client
from app.core.config import settings

_anon_client: Client | None = None
_admin_client: Client | None = None


def get_supabase() -> Client:
    """Return the anon-key client (used for user-scoped operations)."""
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _anon_client


def get_supabase_admin() -> Client:
    """Return the service-role client (bypasses RLS — use carefully)."""
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(settings.supabase_url, settings.supabase_service_key)
    return _admin_client
