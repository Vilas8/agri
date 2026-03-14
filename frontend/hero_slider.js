/**
 * AgriPredict – Auto-scroll Hero Slider
 *
 * Injects a full-width hero banner slider into #home-hero-slider.
 * Slides auto-advance every 4 s with a smooth CSS fade+slide transition.
 * Users can also click the dot indicators to jump to any slide.
 *
 * Usage: add <div id="home-hero-slider"></div> anywhere in the home page,
 * then include this script. It initialises automatically on DOMContentLoaded.
 */

const HERO_SLIDES = [
  {
    icon: "🌾",
    headline: "AI-Powered Price Predictions",
    sub: "Know tomorrow's market price today — powered by Random Forest ML with 94.2% accuracy.",
    bg: "linear-gradient(135deg,#064e3b 0%,#065f46 60%,#047857 100%)",
    badge: "Machine Learning",
    badgeColor: "#6ee7b7"
  },
  {
    icon: "📈",
    headline: "Real-Time Market Prices",
    sub: "Live prices from 30+ APMC markets across Kolar, Chikkabalpura & Bangalore Rural.",
    bg: "linear-gradient(135deg,#1e3a5f 0%,#1e40af 60%,#2563eb 100%)",
    badge: "Live Data",
    badgeColor: "#93c5fd"
  },
  {
    icon: "🌽",
    headline: "4 Key Commodities Tracked",
    sub: "Maize · Paddy · Wheat · Sugarcane — updated daily from verified historical datasets.",
    bg: "linear-gradient(135deg,#78350f 0%,#b45309 60%,#d97706 100%)",
    badge: "Multi-Commodity",
    badgeColor: "#fde68a"
  },
  {
    icon: "🛡️",
    headline: "Secure Farmer Accounts",
    sub: "End-to-end encrypted login powered by Supabase Auth — your data stays yours.",
    bg: "linear-gradient(135deg,#3b0764 0%,#6d28d9 60%,#8b5cf6 100%)",
    badge: "Supabase Auth",
    badgeColor: "#c4b5fd"
  }
];

let _sliderIndex = 0;
let _sliderTimer = null;

function buildSlider() {
  const container = document.getElementById("home-hero-slider");
  if (!container) return;

  // Build HTML
  container.innerHTML = `
    <div class="hs-track" id="hs-track">
      ${HERO_SLIDES.map((s, i) => `
        <div class="hs-slide ${i === 0 ? 'hs-active' : ''}" data-idx="${i}"
             style="background:${s.bg}">
          <span class="hs-badge" style="color:${s.badgeColor};border-color:${s.badgeColor}">${s.badge}</span>
          <div class="hs-icon">${s.icon}</div>
          <h2 class="hs-headline">${s.headline}</h2>
          <p class="hs-sub">${s.sub}</p>
        </div>
      `).join('')}
    </div>
    <div class="hs-dots" id="hs-dots">
      ${HERO_SLIDES.map((_, i) => `
        <button class="hs-dot ${i === 0 ? 'hs-dot-active' : ''}" data-dot="${i}"
                aria-label="Slide ${i + 1}"></button>
      `).join('')}
    </div>
    <button class="hs-arrow hs-prev" id="hs-prev" aria-label="Previous slide">&#8592;</button>
    <button class="hs-arrow hs-next" id="hs-next" aria-label="Next slide">&#8594;</button>
  `;

  // Inject styles (once)
  if (!document.getElementById('hs-styles')) {
    const style = document.createElement('style');
    style.id = 'hs-styles';
    style.textContent = `
      #home-hero-slider {
        position: relative;
        width: 100%;
        overflow: hidden;
        border-radius: 1.5rem;
        min-height: 220px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.25);
      }
      .hs-track { position: relative; width: 100%; }
      .hs-slide {
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2.5rem 2rem;
        min-height: 220px;
        opacity: 0;
        transform: translateX(40px);
        transition: opacity .45s ease, transform .45s ease;
      }
      .hs-slide.hs-active {
        display: flex;
        opacity: 1;
        transform: translateX(0);
      }
      .hs-slide.hs-exit {
        display: flex;
        opacity: 0;
        transform: translateX(-40px);
        pointer-events: none;
      }
      .hs-badge {
        display: inline-block;
        border: 1.5px solid;
        border-radius: 999px;
        font-size: .7rem;
        font-weight: 700;
        letter-spacing: .08em;
        padding: .2rem .75rem;
        margin-bottom: .75rem;
        text-transform: uppercase;
        opacity: .9;
      }
      .hs-icon { font-size: 3rem; margin-bottom: .5rem; }
      .hs-headline {
        color: #fff;
        font-size: clamp(1.1rem,3vw,1.6rem);
        font-weight: 800;
        margin: 0 0 .5rem;
        line-height: 1.25;
      }
      .hs-sub {
        color: rgba(255,255,255,.85);
        font-size: .88rem;
        max-width: 380px;
        margin: 0 auto;
        line-height: 1.5;
      }
      .hs-dots {
        position: absolute;
        bottom: .75rem;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: .4rem;
        z-index: 10;
      }
      .hs-dot {
        width: .55rem; height: .55rem;
        border-radius: 50%;
        background: rgba(255,255,255,.4);
        border: none;
        cursor: pointer;
        transition: background .3s, transform .3s;
        padding: 0;
      }
      .hs-dot-active {
        background: #fff;
        transform: scale(1.35);
      }
      .hs-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(255,255,255,.15);
        border: none;
        color: #fff;
        font-size: 1.1rem;
        width: 2rem; height: 2rem;
        border-radius: 50%;
        cursor: pointer;
        transition: background .2s;
        z-index: 10;
        display: flex; align-items: center; justify-content: center;
      }
      .hs-arrow:hover { background: rgba(255,255,255,.3); }
      .hs-prev { left: .6rem; }
      .hs-next { right: .6rem; }
    `;
    document.head.appendChild(style);
  }

  // Dot click handlers
  container.querySelectorAll('.hs-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      goToSlide(parseInt(btn.dataset.dot));
      resetTimer();
    });
  });

  document.getElementById('hs-prev').addEventListener('click', () => {
    goToSlide((_sliderIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
    resetTimer();
  });
  document.getElementById('hs-next').addEventListener('click', () => {
    goToSlide((_sliderIndex + 1) % HERO_SLIDES.length);
    resetTimer();
  });

  startTimer();
}

function goToSlide(nextIdx) {
  const slides = document.querySelectorAll('.hs-slide');
  const dots   = document.querySelectorAll('.hs-dot');
  if (!slides.length) return;

  // Exit current
  slides[_sliderIndex].classList.remove('hs-active');
  slides[_sliderIndex].classList.add('hs-exit');
  dots[_sliderIndex].classList.remove('hs-dot-active');

  setTimeout(() => {
    slides[_sliderIndex].classList.remove('hs-exit');
    _sliderIndex = nextIdx;
    slides[_sliderIndex].classList.add('hs-active');
    dots[_sliderIndex].classList.add('hs-dot-active');
  }, 50); // tiny delay so exit animation fires before display:none
}

function startTimer() {
  _sliderTimer = setInterval(() => {
    goToSlide((_sliderIndex + 1) % HERO_SLIDES.length);
  }, 4000);
}

function resetTimer() {
  clearInterval(_sliderTimer);
  startTimer();
}

// Auto-init
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildSlider);
} else {
  buildSlider();
}
