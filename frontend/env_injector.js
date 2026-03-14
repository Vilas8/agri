/**
 * AgriPredict – Runtime Environment Injector
 *
 * For LOCAL DEVELOPMENT (plain HTML, no build tool):
 *   Fill in your real values below. This file is gitignored by convention —
 *   copy env_injector.js.example to env_injector.js and add to .gitignore.
 *
 * For PRODUCTION / Vercel / Netlify:
 *   Do NOT ship this file. Instead, use a build-time injection:
 *     Vercel  → set env vars in project settings; Vite exposes as import.meta.env
 *     Netlify → Environment settings → the build will replace placeholders
 *
 * The rest of the app reads from window.__AGRI_ENV__ — never hardcode keys anywhere else.
 */

(function () {
  // ── EDIT THESE FOR LOCAL DEV ────────────────────────────────────────────
  window.__AGRI_ENV__ = {
    // Supabase (copy from your project Settings → API)
    SUPABASE_URL:  "",   // e.g. "https://xyzabc.supabase.co"
    SUPABASE_ANON: "",   // anon/public key (safe to expose in browser)

    // Flask backend (running locally)
    BACKEND_URL: "http://localhost:5000"
  };
  // ────────────────────────────────────────────────────────────────────────

  // Validate at startup and warn clearly in console
  const env = window.__AGRI_ENV__;
  const missing = [];
  if (!env.SUPABASE_URL)  missing.push("SUPABASE_URL");
  if (!env.SUPABASE_ANON) missing.push("SUPABASE_ANON");

  if (missing.length) {
    console.warn(
      `%c[AgriPredict] env_injector.js: missing values for: ${missing.join(", ")}.\n` +
      "Auth will fall back to the local Flask backend only.",
      "color: #f59e0b; font-weight: bold;"
    );
  } else {
    console.log("%c[AgriPredict] Supabase env loaded ✓", "color: #10b981; font-weight: bold;");
  }
})();
