/**
 * supabase_client.js  –  STUBBED (MySQL-only local setup)
 *
 * Supabase is disabled. All auth goes through the Flask backend.
 * Setting window.SUPABASE_READY = false makes auth_supabase.js fall
 * through to the Flask /api/auth/* endpoints automatically.
 */

window.SUPABASE_READY = false;

// Stub functions so auth_supabase.js type-checks don't throw
window.supabaseSignUp       = null;
window.supabaseSignIn       = null;
window.supabaseSignOut      = null;
window.supabaseGetUser      = null;
window.supabaseOnAuthChange = null;

console.log('%c[AgriPredict] supabase_client.js: Supabase DISABLED — using Flask/MySQL backend', 'color:#f59e0b;font-weight:bold;');
