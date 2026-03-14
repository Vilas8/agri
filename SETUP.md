# AgriPredict – Local Setup Guide

This guide walks you through running AgriPredict on your machine, including connecting the frontend and backend to Supabase.

---

## 1. Supabase Project Setup

1. Go to [supabase.com](https://supabase.com) → **New Project**.
2. Once created, open **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY` (safe for browser)
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (server only, never expose)
3. In the SQL Editor run:

```sql
-- Supabase Auth is already enabled.
-- Create the profiles table for app-specific user data:
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text NOT NULL,
  phone      text,
  email      text NOT NULL,
  role       text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);

-- Row Level Security (RLS) — users can only read/write their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can upsert from backend (bypasses RLS automatically)
```

---

## 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt   # includes supabase, flask, python-dotenv

# Copy and fill in your values:
cp .env.example .env
```

Edit `backend/.env`:
```
FLASK_ENV=development
SECRET_KEY=<random 32-char string>
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
ADMIN_EMAIL=admin@agripredict.com
ADMIN_PASSWORD=Admin@2026
ADMIN_SECRET=AGRI2026
CORS_ORIGIN=http://localhost:5500
```

In `backend/app.py`, add the sync-profile blueprint (if not already):
```python
from sync_profile_route import sync_bp
app.register_blueprint(sync_bp)
```

Start the backend:
```bash
python app.py
# Runs on http://localhost:5000
```

---

## 3. Frontend Setup

Edit **`frontend/env_injector.js`** and fill in:
```js
window.__AGRI_ENV__ = {
  SUPABASE_URL:  "https://your-project-ref.supabase.co",
  SUPABASE_ANON: "your-anon-key",      // safe to expose
  BACKEND_URL:   "http://localhost:5000"
};
```

Open with Live Server (VS Code) or any static server:
```bash
# Option A: VS Code Live Server (right-click index.html → Open with Live Server)
# Option B:
npx serve frontend
# Runs on http://localhost:5500 or :3000
```

---

## 4. Auth Flow

```
User fills Register form
  → auth_supabase.js validates email + password (client)
  → supabase.auth.signUp()  ← creates account in Supabase Auth
  → POST /api/auth/sync-profile  ← Flask writes username/phone to `profiles` table
  → Redirect to login page

User fills Login form
  → auth_supabase.js validates email (client)
  → supabase.auth.signInWithPassword()  ← returns session JWT
  → _afterLogin() → navigate to user dashboard

Backend-only fallback (if SUPABASE_URL not set in env_injector.js):
  → POST /api/auth/register  (Flask handles everything)
  → POST /api/auth/login
```

---

## 5. Hero Slider

The home page auto-rotates 4 slides every 4 seconds.
Slides are defined in `frontend/hero_slider.js` — edit `HERO_SLIDES[]` to change content.

---

## 6. File Load Order (index.html)

```
env_injector.js      ← sets window.__AGRI_ENV__ FIRST
supabase CDN         ← makes window.supabase available
supabase_client.js   ← creates the Supabase client
script.js            ← main app logic
dataset_integration.js
ui_additions.js      ← password strength + email hint + notification scroll fix
hero_slider.js       ← builds #home-hero-slider
auth_supabase.js     ← overrides handleLogin / handleRegister  ← LAST
```
