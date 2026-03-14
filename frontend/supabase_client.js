/**
 * AgriPredict – Supabase client (frontend)
 *
 * Uses the Supabase JS SDK loaded via CDN (see wire.js / index.html).
 * Reads credentials from window.__AGRI_ENV__ which is injected at runtime
 * by env_injector.js (local dev) or your build tool (Vercel/Netlify).
 *
 * For production: set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your .env
 * and inject them via your build tool or a server-side template.
 */

// ── Resolve credentials ────────────────────────────────────────────────────
// Priority: window.__AGRI_ENV__ (injected at build/server) → fallback constants
const _env = window.__AGRI_ENV__ || {};

const SUPABASE_URL  = _env.SUPABASE_URL  || '';
const SUPABASE_ANON = _env.SUPABASE_ANON || '';

// Warn in development if not configured
if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn(
    '[AgriPredict] Supabase env vars not set. Auth will fall back to local backend.\n' +
    'Set window.__AGRI_ENV__.SUPABASE_URL and window.__AGRI_ENV__.SUPABASE_ANON in env_injector.js.'
  );
}

// Create Supabase client only if SDK + credentials are available
const supabase = (window.supabase && SUPABASE_URL && SUPABASE_ANON)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

// ── IMPORTANT: expose SUPABASE_READY on window so auth_supabase.js can detect it ──
window.SUPABASE_READY = !!supabase;

// ── Auth helpers ───────────────────────────────────────────────────────────

/**
 * Sign up a new user via Supabase Auth.
 * After signup, calls /api/auth/sync-profile to persist extra fields
 * (username, phone) into the profiles table via the Flask backend.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} username
 * @param {string} phone
 * @returns {Promise<{success, user, session, error}>}
 */
async function supabaseSignUp(email, password, username, phone) {
  if (!window.SUPABASE_READY) return { success: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, phone }   // stored in auth.users metadata
      }
    });
    if (error) return { success: false, error: error.message };

    // Sync extra profile data to Flask backend → Supabase `profiles` table
    if (data.user) {
      await _syncProfile(data.user.id, username, phone, email, data.session?.access_token);
    }

    return { success: true, user: data.user, session: data.session };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Sign in an existing user via Supabase Auth.
 * @returns {Promise<{success, user, session, error}>}
 */
async function supabaseSignIn(email, password) {
  if (!window.SUPABASE_READY) return { success: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user, session: data.session };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Sign out the current user.
 */
async function supabaseSignOut() {
  if (!window.SUPABASE_READY) return;
  await supabase.auth.signOut();
}

/**
 * Get the current authenticated user (from Supabase session).
 * Returns null if not logged in or Supabase not configured.
 */
async function supabaseGetUser() {
  if (!window.SUPABASE_READY) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

/**
 * Listen to auth state changes (login / logout).
 * @param {function} callback - receives (event, session)
 */
function supabaseOnAuthChange(callback) {
  if (!window.SUPABASE_READY) return;
  supabase.auth.onAuthStateChange(callback);
}

// ── Internal: sync profile to backend ─────────────────────────────────────
async function _syncProfile(userId, username, phone, email, accessToken) {
  const backendUrl = (window.__AGRI_ENV__ || {}).BACKEND_URL || 'http://localhost:5000';
  try {
    await fetch(`${backendUrl}/api/auth/sync-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ user_id: userId, username, phone, email })
    });
  } catch (e) {
    console.warn('[AgriPredict] Profile sync to backend failed:', e.message);
  }
}

console.log(
  `%c[AgriPredict] supabase_client.js loaded — SUPABASE_READY: ${window.SUPABASE_READY}`,
  `color:${window.SUPABASE_READY ? '#10b981' : '#f59e0b'};font-weight:bold;`
);
