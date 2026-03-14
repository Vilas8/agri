// ============================================
// PASSWORD STRENGTH METER
// ============================================
function updatePasswordStrength(value) {
  const bar = document.getElementById('pw-strength-bar');
  const label = document.getElementById('pw-strength-label');
  const reqLen = document.getElementById('req-len');
  const reqUpper = document.getElementById('req-upper');
  const reqLower = document.getElementById('req-lower');
  const reqDigit = document.getElementById('req-digit');
  const reqSym = document.getElementById('req-sym');

  if (!bar || !label) return;

  const hasLen    = value.length >= 8;
  const hasUpper  = /[A-Z]/.test(value);
  const hasLower  = /[a-z]/.test(value);
  const hasDigit  = /[0-9]/.test(value);
  const hasSym    = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(value);

  // Update requirement chips
  function setReq(el, met) {
    if (!el) return;
    el.classList.toggle('met', met);
    el.classList.toggle('unmet', !met);
    el.textContent = (met ? '✓ ' : '✗ ') + el.textContent.replace(/^[✓✗] /, '');
  }
  setReq(reqLen,   hasLen);
  setReq(reqUpper, hasUpper);
  setReq(reqLower, hasLower);
  setReq(reqDigit, hasDigit);
  setReq(reqSym,   hasSym);

  const score = [hasLen, hasUpper, hasLower, hasDigit, hasSym].filter(Boolean).length;

  const levels = [
    { pct: '0%',   color: '#e5e7eb', text: '',         textColor: '' },
    { pct: '20%',  color: '#ef4444', text: 'Very Weak', textColor: '#ef4444' },
    { pct: '40%',  color: '#f97316', text: 'Weak',      textColor: '#f97316' },
    { pct: '60%',  color: '#eab308', text: 'Fair',      textColor: '#eab308' },
    { pct: '80%',  color: '#3b82f6', text: 'Strong',    textColor: '#3b82f6' },
    { pct: '100%', color: '#10b981', text: 'Very Strong', textColor: '#10b981' }
  ];

  const lvl = levels[score];
  bar.style.width = lvl.pct;
  bar.style.background = lvl.color;
  label.textContent = lvl.text;
  label.style.color = lvl.textColor;
}

// ============================================
// EMAIL LIVE VALIDATION (register form)
// ============================================
function validateRegEmail() {
  const input = document.getElementById('reg-email');
  const hint  = document.getElementById('reg-email-hint');
  if (!input || !hint) return;

  const val = input.value.trim();
  const validPattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  if (val === '') {
    hint.textContent = '';
    hint.className = 'text-xs mt-1 hidden';
    input.style.borderColor = '';
    return;
  }

  if (!validPattern.test(val)) {
    hint.textContent = '⚠ Please enter a valid email (e.g. yourname@gmail.com)';
    hint.className = 'text-xs mt-1 text-red-500';
    input.style.borderColor = '#ef4444';
  } else {
    hint.textContent = '✓ Looks good!';
    hint.className = 'text-xs mt-1 text-emerald-600';
    input.style.borderColor = '#10b981';
  }
}

// ============================================
// FIX: updateNotifications – use correct element id
// The HTML uses #home-notification-scroll (not #home-notification-marquee)
// This override patches the function after script.js loads.
// ============================================
(function patchUpdateNotifications() {
  const _orig = window.updateNotifications;
  window.updateNotifications = function () {
    const scroll = document.getElementById('home-notification-scroll');
    const dateEl = document.getElementById('notification-date');

    const now = new Date();
    const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const hrs    = now.getHours();
    const mins   = now.getMinutes().toString().padStart(2, '0');
    const ampm   = hrs >= 12 ? 'PM' : 'AM';
    const dHrs   = hrs % 12 || 12;

    if (dateEl) {
      dateEl.textContent =
        `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} • ${dHrs}:${mins} ${ampm}`;
    }

    if (!scroll) return;

    const commodities = ['Maize', 'Paddy', 'Wheat', 'Sugarcane'];
    const icons       = ['📈', '⚡', '🎯', '📊'];
    const alerts      = ['Surge Alert', 'Stable Market', 'Demand Update', 'Market Update'];
    const messages    = [
      'Prices up in Kolar market',
      'Consistent prices across districts',
      'Demand increasing this week',
      'Steady demand in all markets'
    ];

    // Build double-length list so CSS infinite scroll looks seamless
    let html = '';
    const timeStr = `${dHrs}:${mins} ${ampm}`;

    [0, 1].forEach(() => {
      commodities.forEach((commodity, i) => {
        const base = (typeof basePrices !== 'undefined' && basePrices[commodity]) || 2000;
        const variation = Math.floor((now.getTime() / 100000) % 100) - 50;
        const price = Math.round(base + variation);
        const pct   = ((variation / base) * 100).toFixed(1);
        const pos   = variation >= 0;

        html += `
          <div class="p-3 bg-white bg-opacity-10 rounded-xl border border-white border-opacity-20">
            <div class="flex items-start gap-2">
              <span class="text-xl">${icons[i]}</span>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1">
                  <p class="text-white font-semibold text-xs truncate">${commodity} ${alerts[i]}</p>
                  <span class="text-emerald-300 text-xs shrink-0">${timeStr}</span>
                </div>
                <p class="text-emerald-100 text-xs">${messages[i]}</p>
                <p class="text-emerald-200 text-xs mt-1">
                  ₹${price.toLocaleString()}/quintal
                  <span class="${pos ? 'text-green-300' : 'text-red-300'}">(${pos ? '+' : ''}${pct}%)</span>
                </p>
              </div>
            </div>
          </div>`;
      });
    });

    scroll.innerHTML = html;
  };
})();
