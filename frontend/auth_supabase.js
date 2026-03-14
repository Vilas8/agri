/**
 * AgriPredict – Supabase-First Auth Layer
 *
 * Overrides handleLogin() and handleRegister() (defined in script.js) with
 * versions that:
 *   1. Run full client-side validation (email + password strength)
 *   2. Try Supabase Auth first (signIn / signUp)
 *   3. Fall back to the Flask /api/auth/* endpoints if Supabase is not configured
 *   4. On success, call the Flask /api/auth/sync-profile to persist extra fields
 *      into the Supabase `profiles` table via the service role key
 *
 * Load order in index.html:
 *   script.js → dataset_integration.js → ui_additions.js → auth_supabase.js  ← last
 */

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Grab backend URL from env injector or fall back */
  function backendUrl() {
    return ((window.__AGRI_ENV__ || {}).BACKEND_URL) || 'http://localhost:5000';
  }

  /**
   * Strict email check — mirrors backend validators.py
   * Returns { valid: bool, msg: string }
   */
  function validateEmailClient(email) {
    if (!email || !email.trim()) return { valid: false, msg: 'Email is required.' };
    const e = email.trim().toLowerCase();
    if (e.length > 254) return { valid: false, msg: 'Email is too long.' };
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e))
      return { valid: false, msg: 'Enter a valid email (e.g. name@gmail.com).' };
    const [local, domain] = e.split('@');
    if (local.includes('..') || domain.includes('..'))
      return { valid: false, msg: 'Email must not contain consecutive dots.' };
    if (!domain.includes('.'))
      return { valid: false, msg: 'Email domain must contain at least one dot.' };
    return { valid: true, msg: '' };
  }

  /**
   * Full password strength check — mirrors backend validators.py + ui_additions.js
   * Returns { valid: bool, msg: string }
   */
  function validatePasswordClient(pw) {
    if (!pw) return { valid: false, msg: 'Password is required.' };
    const errors = [];
    if (pw.length < 8)           errors.push('at least 8 characters');
    if (!/[A-Z]/.test(pw))       errors.push('one uppercase letter');
    if (!/[a-z]/.test(pw))       errors.push('one lowercase letter');
    if (!/[0-9]/.test(pw))       errors.push('one digit');
    if (!/[!@#$%^&*()_+\-=\[\]{};\':"|,.<>\/?`~]/.test(pw))
      errors.push('one special character (!@#$...)');
    if (errors.length)
      return { valid: false, msg: 'Password must have: ' + errors.join(', ') + '.' };
    return { valid: true, msg: '' };
  }

  /** Show a visible error inside a form */
  function showFormError(errorElId, msg) {
    const el = document.getElementById(errorElId);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }
  function clearFormError(errorElId) {
    const el = document.getElementById(errorElId);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  }

  /** Disable / enable a submit button with loading text */
  function setLoading(btnId, loading, defaultText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : defaultText;
  }

  // ── POST to Flask backend (fallback / profile sync) ─────────────────────

  async function flaskPost(path, body) {
    const res = await fetch(backendUrl() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  async function flaskPostAuth(path, body, token) {
    const res = await fetch(backendUrl() + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    return res.json();
  }

  // ── Session helpers ───────────────────────────────────────────────────────

  function persistSession(user, isAdmin = false) {
    // Store minimal user info so the existing dashboard code still works
    localStorage.setItem('currentUser', JSON.stringify({
      id:       user.id || user.user_id || null,
      email:    user.email,
      username: user.user_metadata?.username || user.username || user.email.split('@')[0],
      phone:    user.user_metadata?.phone    || user.phone    || '',
      role:     isAdmin ? 'admin' : 'user',
      loginAt:  new Date().toISOString()
    }));
  }

  function loadPersistedSession() {
    try { return JSON.parse(localStorage.getItem('currentUser')); } catch { return null; }
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────

  window.handleRegister = async function (e) {
    e.preventDefault();
    clearFormError('reg-error');

    const name     = (document.getElementById('reg-name')?.value    || '').trim();
    const email    = (document.getElementById('reg-email')?.value   || '').trim();
    const phone    = (document.getElementById('reg-phone')?.value   || '').trim();
    const password = (document.getElementById('reg-password')?.value || '');
    const confirm  = (document.getElementById('reg-confirm')?.value  || '');

    // ── Client-side validation ─────────────────────────────────────────────
    if (!name) return showFormError('reg-error', 'Full name is required.');

    const emailV = validateEmailClient(email);
    if (!emailV.valid) return showFormError('reg-error', emailV.msg);

    if (!phone || !/^[0-9]{10}$/.test(phone.replace(/[\s\-]/g, '')))
      return showFormError('reg-error', 'Enter a valid 10-digit mobile number.');

    const pwV = validatePasswordClient(password);
    if (!pwV.valid) return showFormError('reg-error', pwV.msg);

    if (password !== confirm)
      return showFormError('reg-error', 'Passwords do not match.');

    setLoading('register-btn', true, 'Create Account');

    try {
      // ── Try Supabase Auth ────────────────────────────────────────────────
      if (typeof supabaseSignUp === 'function' && window.SUPABASE_READY) {
        const result = await supabaseSignUp(email, password, name, phone);
        if (result.success) {
          persistSession(result.user);
          // Sync profile to backend (writes to `profiles` table via service role)
          await flaskPostAuth('/api/auth/sync-profile', {
            user_id: result.user.id,
            username: name,
            phone,
            email
          }, result.session?.access_token);
          setLoading('register-btn', false, 'Create Account');
          if (typeof showToast === 'function') showToast('Account created! Please check your email to confirm.', 'success');
          if (typeof showPage  === 'function') showPage('user-login');
          return;
        } else {
          // Supabase returned an error — show it
          setLoading('register-btn', false, 'Create Account');
          return showFormError('reg-error', result.error || 'Registration failed.');
        }
      }

      // ── Fallback: Flask backend ──────────────────────────────────────────
      const data = await flaskPost('/api/auth/register', { name, email, phone, password });
      setLoading('register-btn', false, 'Create Account');
      if (data.success) {
        if (typeof showToast === 'function') showToast('Account created! You can now log in.', 'success');
        if (typeof showPage  === 'function') showPage('user-login');
      } else {
        showFormError('reg-error', data.message || 'Registration failed. Try again.');
      }
    } catch (err) {
      setLoading('register-btn', false, 'Create Account');
      showFormError('reg-error', 'Network error. Is the backend running?');
      console.error('[Auth] Register error:', err);
    }
  };

  // ── LOGIN ─────────────────────────────────────────────────────────────────

  window.handleLogin = async function (e) {
    e.preventDefault();

    // Clear any previous error (login form may not have a visible error div — add one gracefully)
    const loginErrId = 'login-error';
    let errEl = document.getElementById(loginErrId);
    if (!errEl) {
      // Inject error element just before the submit button if not present
      const btn = document.getElementById('login-btn');
      if (btn) {
        errEl = document.createElement('div');
        errEl.id = loginErrId;
        errEl.className = 'hidden mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm';
        btn.parentNode.insertBefore(errEl, btn);
      }
    }
    clearFormError(loginErrId);

    const email    = (document.getElementById('login-email')?.value    || '').trim();
    const password = (document.getElementById('login-password')?.value || '');

    // ── Client-side validation ─────────────────────────────────────────────
    const emailV = validateEmailClient(email);
    if (!emailV.valid) return showFormError(loginErrId, emailV.msg);
    if (!password)     return showFormError(loginErrId, 'Password is required.');

    setLoading('login-btn', true, 'Sign In');

    try {
      // ── Try Supabase Auth ────────────────────────────────────────────────
      if (typeof supabaseSignIn === 'function' && window.SUPABASE_READY) {
        const result = await supabaseSignIn(email, password);
        if (result.success) {
          persistSession(result.user);
          setLoading('login-btn', false, 'Sign In');
          _afterLogin(result.user);
          return;
        } else {
          setLoading('login-btn', false, 'Sign In');
          return showFormError(loginErrId, result.error || 'Login failed.');
        }
      }

      // ── Fallback: Flask backend ──────────────────────────────────────────
      const data = await flaskPost('/api/auth/login', { email, password });
      setLoading('login-btn', false, 'Sign In');
      if (data.success) {
        persistSession(data.user || { email });
        _afterLogin(data.user || { email });
      } else {
        showFormError(loginErrId, data.message || 'Invalid credentials.');
      }
    } catch (err) {
      setLoading('login-btn', false, 'Sign In');
      showFormError(loginErrId, 'Network error. Is the backend running?');
      console.error('[Auth] Login error:', err);
    }
  };

  /** Shared post-login setup: update UI and navigate to dashboard */
  function _afterLogin(user) {
    // Set currentUser in the global scope (script.js references window.currentUser)
    window.currentUser = {
      email:    user.email,
      username: user.user_metadata?.username || user.username || user.email?.split('@')[0] || 'User',
      phone:    user.user_metadata?.phone    || user.phone    || '',
      role:     user.role || 'user'
    };

    // Update header
    const headerUsername = document.getElementById('header-username');
    if (headerUsername) headerUsername.textContent = window.currentUser.username;

    // Update profile section
    const profileName  = document.getElementById('profile-name');
    const profileEmail = document.getElementById('profile-email');
    const profilePhone = document.getElementById('profile-phone');
    if (profileName)  profileName.textContent  = window.currentUser.username;
    if (profileEmail) profileEmail.textContent = window.currentUser.email;
    if (profilePhone) profilePhone.textContent = window.currentUser.phone || 'Not provided';

    // Track search + prediction counts from localStorage
    const activity = JSON.parse(localStorage.getItem(`activity_${window.currentUser.email}`) || '{}');
    const searchEl = document.getElementById('user-searches');
    const predEl   = document.getElementById('user-predictions');
    if (searchEl) searchEl.textContent = activity.searches    || 0;
    if (predEl)   predEl.textContent   = activity.predictions || 0;

    if (typeof showToast === 'function') showToast(`Welcome back, ${window.currentUser.username}! 👋`, 'success');
    if (typeof showPage  === 'function') {
      showPage('user-dashboard');
      if (typeof showUserSection === 'function') showUserSection('dashboard');
    }
  }

  // ── LOGOUT ───────────────────────────────────────────────────────────────

  // Extend existing handleLogout (defined in script.js) to also sign out of Supabase
  const _origLogout = window.handleLogout;
  window.handleLogout = async function () {
    if (typeof supabaseSignOut === 'function') {
      await supabaseSignOut().catch(() => {});
    }
    localStorage.removeItem('currentUser');
    if (typeof _origLogout === 'function') _origLogout();
    else if (typeof showPage === 'function') showPage('home');
  };

  // ── AUTO RESTORE SESSION on page load ────────────────────────────────────
  // If a user was logged in (Supabase session or localStorage), restore their state
  document.addEventListener('DOMContentLoaded', async function () {
    // Check Supabase session first
    if (typeof supabaseGetUser === 'function') {
      const sbUser = await supabaseGetUser().catch(() => null);
      if (sbUser) {
        persistSession(sbUser);
        // Don't auto-navigate — let the loading screen handle it
        window.currentUser = {
          email:    sbUser.email,
          username: sbUser.user_metadata?.username || sbUser.email?.split('@')[0] || 'User',
          phone:    sbUser.user_metadata?.phone    || '',
          role:     'user'
        };
      }
    }

    // Listen to future auth state changes
    if (typeof supabaseOnAuthChange === 'function') {
      supabaseOnAuthChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('currentUser');
          window.currentUser = null;
        }
      });
    }
  });

  console.log('%c[AgriPredict] auth_supabase.js loaded ✓', 'color:#10b981;font-weight:bold;');
})();
