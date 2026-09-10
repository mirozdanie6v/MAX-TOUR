(() => {
  'use strict';

  const originalRenderHome = typeof renderHome === 'function' ? renderHome : null;

  const svg = {
    palm: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21V9.8m0 0C10.6 6.4 8 4.5 4.5 4.2c1.4 2.9 3.6 4.6 7.5 5.6Zm0 0c1.2-3.7 3.8-5.7 7.5-5.6-1.5 3-3.8 4.8-7.5 5.6Zm0 0C9.6 7.8 7 8 5 9.8c2.7.8 5 .7 7-.1Zm0 0c2.4-2 5-1.8 7 .1-2.8.8-5.1.7-7-.1Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 21h10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    mountain: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3.5 19 6.1-10.5 3.2 5.1 2.3-3.7L20.5 19h-17Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m7.9 11.4 1.8 1.1 1.5-1.4m2.3 3 1.7 1 1.4-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    island: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 18.2c3.2-1.2 6.2-1.2 9.2 0 2.4.9 4.7.9 6.8 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 16.2c.3-4.7 2.1-8.1 5.4-10.3-3.1-.2-5.5.7-7.3 2.9m2 7.4c-1.3-3.8-3.7-6.2-7.2-7.2 3.4-.8 6.1.1 8 2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="3.8" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.1M12 19.4v2.1M2.5 12h2.1M19.4 12h2.1M5.3 5.3l1.5 1.5m10.4 10.4 1.5 1.5m0-13.4-1.5 1.5M6.8 17.2l-1.5 1.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    plane: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m21 4-8.1 8.1m0 0-5.3 5.3m5.3-5.3 5.3 1.2m-5.3-1.2-1.2-5.3M7.6 17.4l-3.2 2.1.8-3.9-2.7-2 4.2-.4L15.8 4c1.2-1.2 3.2-1.3 4.5-.1 1.2 1.3 1.1 3.3-.1 4.5l-9.1 9.1-.4 4.1-2-2.7-3.9.8 2.8-2.3Z" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.2c.7 3 2.4 4.8 5.4 5.5-3 .7-4.7 2.5-5.4 5.5-.7-3-2.4-4.8-5.4-5.5 3-.7 4.7-2.5 5.4-5.5Z" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/><path d="M18.2 13.5c.4 1.7 1.4 2.7 3 3.1-1.6.4-2.6 1.4-3 3.1-.4-1.7-1.4-2.7-3-3.1 1.6-.4 2.6-1.4 3-3.1ZM5.2 3.7c.3 1.2 1 2 2.2 2.3-1.2.3-1.9 1.1-2.2 2.3C4.9 7.1 4.2 6.3 3 6c1.2-.3 1.9-1.1 2.2-2.3Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };

  const destinations = [
    { label: 'Нячанг', icon: 'palm' },
    { label: 'Дананг', icon: 'mountain' },
    { label: 'Фукуок', icon: 'island' },
    { label: 'Муйне/Фантьет', icon: 'sun' },
  ];

  function enhanceHero() {
    const hero = document.querySelector('#homeScreen .hero');
    if (!hero || hero.dataset.luxHero === '1') return;
    hero.dataset.luxHero = '1';
    hero.className = 'hero hero-lux-v29';
    hero.innerHTML = `
      <div class="hero-lux__inner">
        <div class="hero-lux__destinations" aria-label="Направления">
          ${destinations.map(item => `
            <button class="hero-lux__destination" type="button" onclick="quick('city','${item.label.replace(/'/g, "\\'")}')">
              <span class="hero-lux__destination-icon">${svg[item.icon]}</span>
              <span>${item.label}</span>
            </button>`).join('')}
        </div>

        <div class="hero-lux__content">
          <div class="hero-lux__eyebrow">VIETNAM <i>•</i> TOURS <i>•</i> FAST TRACK</div>
          <h1><span>Ваш лучший отдых</span><strong>во Вьетнаме</strong></h1>
          <p>Более 150 экскурсий по всему Вьетнаму, Fast Track в аэропортах, трансферы, индивидуальные программы и авторские путешествия по Юго-Восточной Азии.</p>
        </div>

        <div class="hero-lux__actions">
          <button class="hero-lux__cta hero-lux__cta--primary" type="button" onclick="showScreen('catalog')">
            <span class="hero-lux__cta-icon">${svg.plane}</span>
            <span>Выбрать тур</span>
            <span class="hero-lux__chevron">${svg.chevron}</span>
          </button>
          <button class="hero-lux__cta hero-lux__cta--glass" type="button" onclick="showScreen('ai')">
            <span class="hero-lux__cta-icon">${svg.sparkles}</span>
            <span>ИИ-Помощник</span>
            <span class="hero-lux__chevron">${svg.chevron}</span>
          </button>
        </div>
      </div>`;
  }

  if (originalRenderHome) {
    renderHome = function renderHomeLuxury() {
      originalRenderHome();
      enhanceHero();
    };
  }

  enhanceHero();
  globalThis.MaxTourHero = { enhanceHero };
})();