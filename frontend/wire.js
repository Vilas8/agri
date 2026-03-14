/**
 * AgriPredict – wire.js
 *
 * Self-contained bootstrap that:
 *   1. Loads Supabase JS SDK (CDN) if not already present
 *   2. Loads env_injector.js → supabase_client.js → auth_supabase.js → hero_slider.js
 *      in the correct order (each waits for the previous to finish)
 *   3. Injects <div id="home-hero-slider"> at the top of the home page section
 *      if it isn't already present
 *
 * Add ONE line to index.html just before </body>:
 *   <script src="wire.js"></script>
 *
 * Everything else is handled here — no other changes to index.html are needed.
 */

(function () {
  'use strict';

  // ── 1. Sequential script loader ──────────────────────────────────────────
  function loadScript(src, onload) {
    // Skip if already loaded (by src attribute)
    if (document.querySelector(`script[src="${src}"]`)) {
      if (onload) onload();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = onload || null;
    s.onerror = () => console.error(`[wire.js] Failed to load: ${src}`);
    document.body.appendChild(s);
  }

  // ── 2. Chain: Supabase SDK → env_injector → supabase_client → auth_supabase → hero_slider
  function bootChain() {
    // Step 1 – Supabase CDN SDK (needed by supabase_client.js)
    const SUPA_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    const sdkAlreadyLoaded = !!(window.supabase && window.supabase.createClient);

    function step2() {
      loadScript('env_injector.js', step3);
    }
    function step3() {
      loadScript('supabase_client.js', step4);
    }
    function step4() {
      loadScript('auth_supabase.js', step5);
    }
    function step5() {
      loadScript('hero_slider.js', injectSlider);
    }

    if (sdkAlreadyLoaded) {
      step2();
    } else {
      loadScript(SUPA_CDN, step2);
    }
  }

  // ── 3. Inject the hero slider mount point ────────────────────────────────
  function injectSlider() {
    if (document.getElementById('home-hero-slider')) return; // already present

    // Find the home page section — try common IDs/classes used in AgriPredict
    const homeSection =
      document.getElementById('page-home') ||
      document.getElementById('home-page') ||
      document.querySelector('[data-page="home"]') ||
      document.querySelector('.page-home') ||
      // Fallback: the first <section> or <div> that contains "home" in its id
      Array.from(document.querySelectorAll('section, div[id]'))
        .find(el => /home/i.test(el.id));

    const slider = document.createElement('div');
    slider.id = 'home-hero-slider';
    slider.style.cssText = 'margin: 1.5rem 0; width: 100%;';

    if (homeSection) {
      // Insert at the very top of the home section, before any existing content
      homeSection.insertBefore(slider, homeSection.firstChild);
    } else {
      // Last resort — prepend to <main> or <body>
      const main = document.querySelector('main') || document.body;
      main.prepend(slider);
    }

    // Kick off the slider build (hero_slider.js might have already run DOMContentLoaded)
    if (typeof buildSlider === 'function') {
      buildSlider();
    }

    console.log('%c[wire.js] Hero slider injected ✓', 'color:#10b981;font-weight:bold;');
  }

  // ── 4. Entry point ────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootChain);
  } else {
    bootChain();
  }

  console.log('%c[wire.js] Bootstrap starting…', 'color:#6366f1;font-weight:bold;');
})();
