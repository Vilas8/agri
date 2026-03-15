"""
sync_profile_route.py  –  STUBBED (MySQL-only local setup)

Originally synced user profiles to a Supabase `profiles` table via the
service-role key.  In local MySQL mode that table does not exist, so this
route simply returns success so the frontend keeps working without errors.
"""
from flask import Blueprint, request, jsonify

sync_bp = Blueprint('sync_profile', __name__)

@sync_bp.route('/api/auth/sync-profile', methods=['POST'])
def sync_profile():
    """
    No-op endpoint.  The frontend (auth_supabase.js) calls this after a
    Supabase sign-up to persist extra fields.  Since Supabase is disabled
    we just acknowledge the call and do nothing.
    """
    return jsonify({'success': True, 'message': 'Profile sync skipped (MySQL mode)'}), 200
