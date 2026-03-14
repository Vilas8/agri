# 🗄️ Supabase + Localhost Setup Guide

This guide explains how to connect your **AgriPredict** Flask backend (running on `localhost:5000`) and your frontend (served from `localhost:5000` or opened as a file) to **Supabase** for database access and email authentication — replacing the current SQLite/MySQL setup.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up / log in.
2. Click **New Project** → choose an organisation → enter a project name (e.g. `agripredict`) → set a strong database password → choose a region closest to you (e.g. `Southeast Asia`).
3. Wait for the project to be created (~1–2 min).

---

## 2. Get Your Supabase Credentials

Inside your Supabase dashboard:

- **Settings → API** → copy:
  - `Project URL` → your `SUPABASE_URL`
  - `anon / public` key → your `SUPABASE_ANON_KEY`
  - `service_role` key → your `SUPABASE_SERVICE_KEY` (**keep this secret!**)
- **Settings → Database** → copy the **Connection string (URI)** for direct Postgres access.
  - It looks like: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
  - This is your `DATABASE_URL`.

---

## 3. Create a `.env` File in Project Root

Create a file called `.env` in the root of the project (same level as `backend/`):

```env
# ── Supabase ──────────────────────────────────────────────
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# ── Database (Supabase Postgres) ──────────────────────────
# Use this as the SQLAlchemy DATABASE_URL in config.py
DATABASE_URL=postgresql://postgres:YOUR-DB-PASSWORD@db.YOUR-PROJECT-REF.supabase.co:5432/postgres

# ── App ───────────────────────────────────────────────────
SECRET_KEY=change-me-to-a-long-random-string
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=admin123
ADMIN_SECRET=AGRI2026
JWT_EXPIRATION_HOURS=24
```

> ⚠️ Add `.env` to your `.gitignore` — **never commit credentials to GitHub**.

---

## 4. Install Required Python Packages

```bash
cd backend
pip install python-dotenv psycopg2-binary supabase
```

Or add to `requirements.txt`:
```
python-dotenv
psycopg2-binary
supabase
```

---

## 5. Update `config/config.py` to Read `.env`

Open `config/config.py` and add at the top:

```python
import os
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
```

Then update the `SQLALCHEMY_DATABASE_URI` line:

```python
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///agripredict.db'
```

This makes your Flask app connect to **Supabase Postgres** automatically when the `.env` is present, and falls back to local SQLite if not.

---

## 6. Enable Email Auth in Supabase (for Magic Link / Email Verification)

In your Supabase dashboard:

1. Go to **Authentication → Providers → Email**.
2. Make sure **"Enable Email Provider"** is ON.
3. For local development, turn **OFF** "Confirm email" (so you can test without real emails).
4. Optionally set **SMTP settings** (under Authentication → SMTP Settings) to use Gmail/SendGrid for real email delivery.

### SMTP with Gmail (recommended for localhost testing):
```
Host: smtp.gmail.com
Port: 587
Username: your-gmail@gmail.com
Password: your-app-password (16-char Google App Password)
Sender name: AgriPredict
Sender email: your-gmail@gmail.com
```

> Generate a Google App Password at: https://myaccount.google.com/apppasswords

---

## 7. Use Supabase Auth in the Flask Backend (Optional)

If you want to fully delegate auth to Supabase (instead of your own User table), you can call the Supabase Python client in `app.py`:

```python
from supabase import create_client
import os

supabase_client = create_client(
    os.environ.get('SUPABASE_URL'),
    os.environ.get('SUPABASE_SERVICE_KEY')
)

# Register user via Supabase Auth
def register_with_supabase(email, password):
    response = supabase_client.auth.sign_up({
        'email': email,
        'password': password
    })
    return response

# Login user via Supabase Auth
def login_with_supabase(email, password):
    response = supabase_client.auth.sign_in_with_password({
        'email': email,
        'password': password
    })
    return response
```

---

## 8. Run Locally

```bash
# Terminal 1 — Backend
cd backend
python app.py
# Flask runs on http://localhost:5000

# Terminal 2 — Frontend (optional, or just open index.html directly)
# The frontend already points to http://localhost:5000 in script.js (API_CONFIG.backendUrl)
```

Your app will now:
- ✅ Store users, prices, activities, remarks in **Supabase Postgres**
- ✅ Use Supabase Email Auth for registration verification
- ✅ Work entirely from localhost

---

## 9. CORS Note

Since you're running frontend and backend both locally, the current CORS config in `app.py` already allows `*`:

```python
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)
```

No changes needed for localhost development.

---

## Quick Reference

| What | Where |
|---|---|
| Supabase Dashboard | https://app.supabase.com |
| Your project URL | Settings → API → Project URL |
| Anon Key | Settings → API → anon/public |
| Service Key | Settings → API → service_role |
| Database URL | Settings → Database → Connection string |
| Email Auth | Authentication → Providers → Email |
| SMTP Settings | Authentication → SMTP Settings |
