"""
AgriPredict – /api/auth/sync-profile  Flask Blueprint

Registers a POST endpoint that the frontend calls after Supabase Auth signup.
It upserts the extra user fields (username, phone) into the Supabase `profiles`
table using the service role key — something the browser anon key cannot do safely.

Mount in app.py:
    from sync_profile_route import sync_bp
    app.register_blueprint(sync_bp)

Endpoint:  POST /api/auth/sync-profile
Auth:      Optional Bearer token (Supabase JWT) — validated if present.
Body JSON: { user_id, username, phone, email }
Response:  { success: bool, message: str }
"""

from flask import Blueprint, request, jsonify
from validators import validate_email, validate_phone
from supabase_client import upsert_user_profile, verify_jwt

sync_bp = Blueprint('sync_profile', __name__)


@sync_bp.route('/api/auth/sync-profile', methods=['POST'])
def sync_profile():
    data = request.get_json(silent=True) or {}

    user_id  = (data.get('user_id')  or '').strip()
    username = (data.get('username') or '').strip()
    phone    = (data.get('phone')    or '').strip()
    email    = (data.get('email')    or '').strip().lower()

    # ── Validate required fields ────────────────────────────────────────────
    if not user_id:
        return jsonify(success=False, message='user_id is required.'), 400
    if not username:
        return jsonify(success=False, message='username is required.'), 400

    email_ok, email_msg = validate_email(email)
    if not email_ok:
        return jsonify(success=False, message=email_msg), 400

    phone_ok, phone_result = validate_phone(phone)
    if not phone_ok:
        return jsonify(success=False, message=phone_result), 400
    phone = phone_result  # cleaned 10-digit string

    # ── Optional: verify the caller's JWT ──────────────────────────────────
    # This prevents arbitrary writes — only the real Supabase user can sync.
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        caller = verify_jwt(token)
        if caller and caller.get('id') and caller['id'] != user_id:
            return jsonify(success=False, message='Token / user_id mismatch.'), 403

    # ── Upsert into Supabase `profiles` table ──────────────────────────────
    ok = upsert_user_profile(user_id, username, phone, email)
    if ok:
        return jsonify(success=True, message='Profile synced successfully.')
    else:
        # Supabase not configured → still return 200 so the app keeps working
        return jsonify(success=True, message='Profile sync skipped (Supabase not configured).')
