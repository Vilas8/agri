"""
AgriPredict – app_patch.py

Apply this patch to backend/app.py to:
  1. Import and use validators.py in /api/auth/register and /api/auth/login
  2. Register the sync_profile Blueprint (provides /api/auth/sync-profile)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCTIONS (two small edits to app.py):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] Add these imports near the top of app.py (after existing imports):

    from validators import validate_email, validate_password, validate_phone
    from sync_profile_route import sync_bp

[B] Register the Blueprint immediately after `app = Flask(__name__)`
    and the CORS setup (just before `db.init_app(app)`):

    app.register_blueprint(sync_bp)

[C] Replace the body of the /api/auth/register route with the validated version below.
[D] Replace the body of the /api/auth/login route with the validated version below.

The patched route bodies are shown below as reference:
"""

# ──────────────────────────────────────────────────────────────────────
# [C] Validated /api/auth/register  (replace existing function body)
# ──────────────────────────────────────────────────────────────────────
REGISTER_ROUTE = '''
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user with full server-side validation."""
    data = request.get_json() or {}

    name     = (data.get('name') or data.get('username') or '').strip()
    email    = (data.get('email')    or '').strip()
    phone    = (data.get('phone')    or '').strip()
    password =  data.get('password') or ''

    # ── Required field check ───────────────────────────────────────────
    if not name:
        return jsonify(success=False, message='Full name is required.'), 400

    # ── Strict email validation (validators.py) ────────────────────────
    email_ok, email_msg = validate_email(email)
    if not email_ok:
        return jsonify(success=False, message=email_msg), 400

    # ── Phone validation ───────────────────────────────────────────────
    phone_ok, phone_result = validate_phone(phone)
    if not phone_ok:
        return jsonify(success=False, message=phone_result), 400
    phone = phone_result  # cleaned 10-digit string

    # ── Password strength validation (validators.py) ───────────────────
    pw_ok, pw_msg = validate_password(password)
    if not pw_ok:
        return jsonify(success=False, message=pw_msg), 400

    # ── Duplicate email check ──────────────────────────────────────────
    if User.query.filter_by(email=email.lower()).first():
        return jsonify(success=False, message='Email is already registered.'), 400

    new_user = User(
        username=name,
        email=email.lower(),
        phone=phone,
        password=password,
        role='user',
        status='active'
    )
    try:
        db.session.add(new_user)
        db.session.commit()
        log_activity(new_user.id, new_user.username, 'register',
                     f'User {new_user.email} registered')
        return jsonify(
            success=True,
            message='Registration successful! Please log in.',
            user=new_user.to_dict()
        ), 201
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, message=str(e)), 500
'''

# ──────────────────────────────────────────────────────────────────────
# [D] Validated /api/auth/login  (replace existing function body)
# ──────────────────────────────────────────────────────────────────────
LOGIN_ROUTE = '''
@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login with server-side email validation."""
    data = request.get_json() or {}

    email    = (data.get('email')    or '').strip()
    password =  data.get('password') or ''

    # ── Basic validation ───────────────────────────────────────────────
    email_ok, email_msg = validate_email(email)
    if not email_ok:
        return jsonify(success=False, message=email_msg), 400
    if not password:
        return jsonify(success=False, message='Password is required.'), 400

    user = User.query.filter_by(email=email.lower()).first()
    if not user or user.password != password:
        return jsonify(success=False, message='Invalid email or password.'), 401
    if user.status != 'active':
        return jsonify(success=False, message='Account is inactive.'), 403

    token = create_token(user.id, user.email, user.role)
    log_activity(user.id, user.username, 'login', f'User {user.email} logged in')
    return jsonify(
        success=True,
        message='Login successful',
        token=token,
        user=user.to_dict()
    ), 200
'''

if __name__ == '__main__':
    print("This file contains patch instructions for app.py.")
    print("See the docstring at the top for step-by-step instructions.")
    print("\n[C] Patched register route:")
    print(REGISTER_ROUTE)
    print("\n[D] Patched login route:")
    print(LOGIN_ROUTE)
