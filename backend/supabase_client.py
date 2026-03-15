"""
supabase_client.py  –  STUBBED (MySQL-only local setup)

The app now uses MySQL exclusively via SQLAlchemy / Flask-SQLAlchemy.
This module is kept so that any import of it does not crash,
but it exposes no real Supabase functionality.
"""

supabase = None

def get_supabase_client():
    """Returns None — Supabase is disabled in local MySQL mode."""
    return None

def is_supabase_available():
    return False
