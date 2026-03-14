"""
Supabase client initializer for AgriPredict backend.
Used for:
  - Verifying Supabase Auth JWTs (signup/login done client-side)
  - Upserting user profile data into `profiles` table after auth
  - Admin operations using the service role key

Install: pip install supabase
"""
import os
from supabase import create_client, Client

SUPABASE_URL: str              = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase_client: Client | None = None


def get_supabase_admin() -> Client | None:
    """
    Returns a Supabase client authenticated with the service role key.
    Used for server-side admin operations (e.g. upsert profile data).
    Returns None if env vars are not set (graceful degradation).
    """
    global _supabase_client
    if _supabase_client:
        return _supabase_client
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Skipping Supabase client.")
        return None
    try:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        return _supabase_client
    except Exception as e:
        print(f"[Supabase] Failed to create client: {e}")
        return None


def upsert_user_profile(user_id: str, username: str, phone: str, email: str) -> bool:
    """
    Upsert a user profile row in the `profiles` table.
    Schema expected:
      profiles(
        id        uuid references auth.users on delete cascade,
        username  text,
        phone     text,
        email     text,
        role      text default 'user',
        created_at timestamptz default now()
      )
    """
    client = get_supabase_admin()
    if not client:
        return False
    try:
        client.table("profiles").upsert({
            "id":       user_id,
            "username": username,
            "phone":    phone,
            "email":    email,
            "role":     "user",
        }).execute()
        return True
    except Exception as e:
        print(f"[Supabase] upsert_user_profile error: {e}")
        return False


def get_user_profile(user_id: str) -> dict | None:
    """Fetch a user's profile from the `profiles` table by auth UUID."""
    client = get_supabase_admin()
    if not client:
        return None
    try:
        resp = client.table("profiles").select("*").eq("id", user_id).single().execute()
        return resp.data
    except Exception as e:
        print(f"[Supabase] get_user_profile error: {e}")
        return None


def verify_jwt(access_token: str) -> dict | None:
    """
    Verify a Supabase-issued JWT and return the decoded user payload.
    Used in protected Flask endpoints to authenticate requests.
    Returns None on failure.
    """
    client = get_supabase_admin()
    if not client:
        return None
    try:
        # supabase-py v2: auth.get_user() validates the JWT server-side
        resp = client.auth.get_user(access_token)
        return resp.user.__dict__ if resp.user else None
    except Exception as e:
        print(f"[Supabase] verify_jwt error: {e}")
        return None
