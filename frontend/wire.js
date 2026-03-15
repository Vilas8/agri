/**
 * AgriPredict – wire.js  (MySQL-only local build)
 *
 * Supabase SDK is NOT loaded.
 * We only chain: env_injector.js → hero_slider.js
 * auth_supabase.js falls back to Flask automatically (SUPABASE_READY=false).
 */

(function () {
  'use strict';

  function loadScript(src, onload) {
    if (document.querySelector(`script[src="${src}"]`)) {
      if (onload) onload();
      return;
    }
    const s = document.createElement('script');
    s.src    = src;
    s.async  = false;
    s.onload = onload || null;
    s.onerror = () => console.error(`[wire.js] Failed to load: ${src}`);
    document.body.appendChild(s);
  }

  function bootChain() {
    // No Supabase CDN — go straight to env_injector then hero_slider
    loadScript('env_injector.js', function () {
      loadScript('hero_slider.js', injectSlider);
    });
  }

  function injectSlider() {
    if (document.getElementById('home-hero-slider')) return;

    const homeSection =
      document.getElementById('page-home') ||
      document.getElementById('home-page') ||
      document.querySelector('[data-page="home"]') ||
      document.querySelector('.page-home') ||
      Array.from(document.querySelectorAll('section, div[id]'))
        .find(el => /home/i.test(el.id));

    const slider = document.createElement('div');
    slider.id = 'home-hero-slider';
    slider.style.cssText = 'margin: 1.5rem 0; width: 100%;';

    if (homeSection) {
      homeSection.insertBefore(slider, homeSection.firstChild);
    } else {
      const main = document.querySelector('main') || document.body;
      main.prepend(slider);
    }

    if (typeof buildSlider === 'function') buildSlider();
    console.log('%c[wire.js] Hero slider injected ✓', 'color:#10b981;font-weight:bold;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootChain);
  } else {
    bootChain();
  }

  console.log('%c[wire.js] Bootstrap starting (MySQL mode)…', 'color:#6366f1;font-weight:bold;');
})();
