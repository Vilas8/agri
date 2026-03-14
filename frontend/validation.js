/**
 * AgriPredict – Shared Client-side Validation
 * Centralises all input validation so forms + inline hints share one source of truth.
 * Mirrors the server-side validators in backend/validators.py.
 */

// ── Email ──────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates an email string.
 * @returns {{ valid: boolean, message: string }}
 */
function validateEmail(email) {
  const v = (email || '').trim();
  if (!v)             return { valid: false, message: 'Email is required.' };
  if (v.length > 254) return { valid: false, message: 'Email is too long.' };
  if (!EMAIL_REGEX.test(v)) return { valid: false, message: 'Invalid email format (e.g. user@example.com).' };
  const [local, domain] = v.split('@');
  if (local.includes('..') || domain.includes('..'))
    return { valid: false, message: 'Email must not contain consecutive dots.' };
  if (!domain.includes('.'))
    return { valid: false, message: 'Email domain must contain at least one dot.' };
  return { valid: true, message: '' };
}

// ── Password ───────────────────────────────────────────────────────────────
const PW_RULES = [
  { id: 'req-len',   label: '8+ characters',          test: p => p.length >= 8 },
  { id: 'req-upper', label: 'Uppercase letter',        test: p => /[A-Z]/.test(p) },
  { id: 'req-lower', label: 'Lowercase letter',        test: p => /[a-z]/.test(p) },
  { id: 'req-digit', label: 'Number (0-9)',             test: p => /[0-9]/.test(p) },
  { id: 'req-sym',   label: 'Symbol (!@#$...)',         test: p => /[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?`~]/.test(p) },
];

const PW_STRENGTH_LEVELS = [
  { pct: '0%',   color: '#e5e7eb', label: '',             textColor: '' },
  { pct: '20%',  color: '#ef4444', label: 'Very Weak',    textColor: '#ef4444' },
  { pct: '40%',  color: '#f97316', label: 'Weak',         textColor: '#f97316' },
  { pct: '60%',  color: '#eab308', label: 'Fair',         textColor: '#eab308' },
  { pct: '80%',  color: '#3b82f6', label: 'Strong',       textColor: '#3b82f6' },
  { pct: '100%', color: '#10b981', label: 'Very Strong',  textColor: '#10b981' },
];

/**
 * Validates password strength.
 * @returns {{ valid: boolean, score: number, message: string, rules: Array }}
 */
function validatePassword(password) {
  const p = password || '';
  const results = PW_RULES.map(r => ({ ...r, passed: r.test(p) }));
  const score   = results.filter(r => r.passed).length;
  const failed  = results.filter(r => !r.passed).map(r => r.label);
  return {
    valid:   score === PW_RULES.length,
    score,
    message: failed.length ? `Password needs: ${failed.join(', ')}.` : '',
    rules:   results
  };
}

/**
 * Updates the password strength bar UI.
 * Expects elements: #pw-strength-bar, #pw-strength-label, #req-len, #req-upper,
 * #req-lower, #req-digit, #req-sym.
 * @param {string} value - current password input value
 */
function updatePasswordStrength(value) {
  const bar   = document.getElementById('pw-strength-bar');
  const label = document.getElementById('pw-strength-label');
  if (!bar || !label) return;

  const { score, rules } = validatePassword(value);
  const lvl = PW_STRENGTH_LEVELS[score];

  bar.style.width      = lvl.pct;
  bar.style.background = lvl.color;
  label.textContent    = lvl.label;
  label.style.color    = lvl.textColor;

  rules.forEach(r => {
    const el = document.getElementById(r.id);
    if (!el) return;
    el.classList.toggle('met',   r.passed);
    el.classList.toggle('unmet', !r.passed);
    const icon = r.passed ? '✓' : '✗';
    el.textContent = `${icon} ${r.label}`;
  });
}

/**
 * Live-validates the register email field and shows inline feedback.
 * Reads from #reg-email, writes to #reg-email-hint.
 */
function validateRegEmail() {
  const input = document.getElementById('reg-email');
  const hint  = document.getElementById('reg-email-hint');
  if (!input || !hint) return;

  const val = input.value.trim();
  if (!val) {
    hint.textContent = '';
    hint.className   = 'text-xs mt-1 hidden';
    input.style.borderColor = '';
    return;
  }

  const { valid, message } = validateEmail(val);
  if (!valid) {
    hint.textContent        = `⚠ ${message}`;
    hint.className          = 'text-xs mt-1 text-red-500';
    input.style.borderColor = '#ef4444';
  } else {
    hint.textContent        = '✓ Looks good!';
    hint.className          = 'text-xs mt-1 text-emerald-600';
    input.style.borderColor = '#10b981';
  }
}

/**
 * Validates the full register form before submission.
 * Shows field-level error messages.
 * @returns {boolean} true if all fields are valid
 */
function validateRegisterForm() {
  const name     = (document.getElementById('reg-name')?.value     || '').trim();
  const email    = (document.getElementById('reg-email')?.value    || '').trim();
  const phone    = (document.getElementById('reg-phone')?.value    || '').trim();
  const password = (document.getElementById('reg-password')?.value || '');
  const confirm  = (document.getElementById('reg-confirm')?.value  || '');
  const errEl    =  document.getElementById('reg-error');

  const showErr = msg => {
    if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
    return false;
  };

  if (!name) return showErr('Full name is required.');

  const emailRes = validateEmail(email);
  if (!emailRes.valid) return showErr(emailRes.message);

  const phoneClean = phone.replace(/[\s\-]/g, '');
  if (!phoneClean || !/^\d{10}$/.test(phoneClean))
    return showErr('Phone number must be exactly 10 digits.');

  const pwRes = validatePassword(password);
  if (!pwRes.valid) return showErr(pwRes.message);

  if (password !== confirm) return showErr('Passwords do not match.');

  if (errEl) errEl.classList.add('hidden');
  return true;
}

// ── Login form ─────────────────────────────────────────────────────────────
/**
 * Validates login form.
 * @returns {boolean}
 */
function validateLoginForm() {
  const email    = (document.getElementById('login-email')?.value    || '').trim();
  const password = (document.getElementById('login-password')?.value || '');

  const emailRes = validateEmail(email);
  if (!emailRes.valid) { showToast(emailRes.message, 'error'); return false; }
  if (!password)       { showToast('Password is required.', 'error'); return false; }
  return true;
}
