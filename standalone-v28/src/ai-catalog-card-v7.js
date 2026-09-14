(() => {
  'use strict';

  const AI_STATE_KEY = 'max-tour-ai-consultant-v5';
  const BOOKING_INTENT_KEY = 'max-tour-ai-booking-intent-v1';
  const UPGRADED_CLASS = 'ai-catalog-card-v7';
  const PENDING_ATTR = 'data-ai-catalog-upgrade';
  const MAX_RENDERER_SOURCE = 18000;
  let rendererCache = null;
  let catalogRenderAttempted = false;

  const text = value => String(value ?? '').trim();

  function tours() {
    try { return Array.isArray(TOURS) ? TOURS : []; }
    catch (_) { return []; }
  }

  function tourIdFromCard(card) {
    if (!card) return '';
    const direct = text(card.dataset?.tourId);
    if (direct) return direct;
    const handler = text(card.getAttribute?.('onclick'));
    const match = handler.match(/openTour\(\s*(['"])(.*?)\1\s*\)/);
    return match?.[2] || '';
  }

  function tourById(tourId) {
    return tours().find(item => String(item?.id) === String(tourId)) || null;
  }

  function existingCatalogCard(tourId, aiRoot) {
    const cards = [...document.querySelectorAll('.tour-card')];
    return cards.find(card => {
      if (aiRoot?.contains(card)) return false;
      if (card.classList.contains(UPGRADED_CLASS)) return false;
      return tourIdFromCard(card) === String(tourId);
    }) || null;
  }

  function ensureCatalogDom() {
    if (catalogRenderAttempted) return;
    catalogRenderAttempted = true;
    try {
      if (typeof renderCatalog === 'function') renderCatalog();
      else if (typeof globalThis.renderCatalog === 'function') globalThis.renderCatalog();
    } catch (_) {}
  }

  function nodeFromRendererResult(result, tourId) {
    if (!result) return null;
    let scope = null;
    if (typeof result === 'string') {
      const template = document.createElement('template');
      template.innerHTML = result.trim();
      scope = template.content;
    } else if (result?.nodeType) {
      scope = result;
    }
    if (!scope?.querySelectorAll) return null;
    const cards = scope.matches?.('.tour-card') ? [scope] : [...scope.querySelectorAll('.tour-card')];
    return cards.find(card => tourIdFromCard(card) === String(tourId)) || cards[0] || null;
  }

  function discoverPureCatalogRenderers() {
    if (rendererCache) return rendererCache;
    const preferred = ['tourCard', 'tourCardHtml', 'renderTourCard', 'createTourCard', 'catalogCard', 'renderCatalogCard', 'createCatalogCard'];
    const seen = new Set();
    const found = [];

    const consider = (name, fn) => {
      if (typeof fn !== 'function' || seen.has(fn)) return;
      let source = '';
      try { source = Function.prototype.toString.call(fn); } catch (_) { return; }
      if (source.length > MAX_RENDERER_SOURCE) return;
      if (!/tour-card/.test(source) || !/openTour/.test(source) || !/\breturn\b/.test(source)) return;
      if (/\.innerHTML\s*=|appendChild\(|replaceChildren\(|showScreen\(|window\.location|location\.assign/.test(source)) return;
      seen.add(fn);
      found.push({ name, fn });
    };

    preferred.forEach(name => {
      try { consider(name, globalThis[name]); } catch (_) {}
    });
    for (const name of Object.getOwnPropertyNames(globalThis)) {
      if (found.length >= 10) break;
      try { consider(name, globalThis[name]); } catch (_) {}
    }

    rendererCache = found;
    return rendererCache;
  }

  function renderWithOriginalCatalogRenderer(tourId) {
    const tour = tourById(tourId);
    if (!tour) return null;
    for (const { fn } of discoverPureCatalogRenderers()) {
      try {
        const result = fn.length >= 2 ? fn(tour, 0) : fn(tour);
        const card = nodeFromRendererResult(result, tourId);
        if (card) return card;
      } catch (_) {}
    }
    return null;
  }

  function cloneAsAiCatalogCard(source, tourId, wasHidden = false) {
    if (!source) return null;
    const clone = source.cloneNode(true);
    clone.classList.add(UPGRADED_CLASS);
    clone.classList.remove('ai-recommendation', 'ai-sales-card');
    clone.dataset.tourId = String(tourId);
    clone.dataset.aiCatalogSource = 'catalog';
    clone.removeAttribute(PENDING_ATTR);
    clone.hidden = Boolean(wasHidden);
    clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    return clone;
  }

  function catalogSourceFor(tourId, aiRoot) {
    let source = existingCatalogCard(tourId, aiRoot);
    if (source) return source;
    ensureCatalogDom();
    source = existingCatalogCard(tourId, aiRoot);
    if (source) return source;
    return renderWithOriginalCatalogRenderer(tourId);
  }

  function createCatalogCard(tourId, aiRoot, options = {}) {
    const source = catalogSourceFor(tourId, aiRoot);
    if (!source) return null;
    const card = cloneAsAiCatalogCard(source, tourId, Boolean(options.hidden));
    if (!card) return null;
    card.dataset.aiCatalogInjected = options.injected ? '1' : '0';
    return card;
  }

  function upgradeOne(oldCard, aiRoot) {
    if (!oldCard || oldCard.classList.contains(UPGRADED_CLASS)) return false;
    const tourId = tourIdFromCard(oldCard);
    if (!tourId) return false;
    const replacement = createCatalogCard(tourId, aiRoot, { hidden:oldCard.hidden });
    if (!replacement) {
      oldCard.setAttribute(PENDING_ATTR, 'pending');
      return false;
    }
    oldCard.replaceWith(replacement);
    return true;
  }

  function upgradeRecommendations(aiRoot) {
    if (!aiRoot) return 0;
    let changed = 0;
    aiRoot.querySelectorAll('.ai-recommendation.ai-sales-card[data-tour-id]').forEach(card => {
      if (upgradeOne(card, aiRoot)) changed += 1;
    });
    return changed;
  }

  function readAiState() {
    try { return JSON.parse(sessionStorage.getItem(AI_STATE_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function rememberBookingIntent(tourId) {
    const saved = readAiState();
    const slots = saved?.slots || {};
    const tour = tourById(tourId);
    if (!tour) return;

    const explicitDate = /^\d{4}-\d{2}-\d{2}$/.test(String(slots.date || '')) ? String(slots.date) : '';
    const format = slots.tripType === 'individual'
      ? 'individual'
      : slots.tripType === 'group'
        ? 'group'
        : tour.group
          ? 'group'
          : 'individual';

    const intent = {
      tourId:String(tour.id),
      title:String(tour.title || ''),
      format,
      date:explicitDate,
      adults:Math.max(1, Number(slots.adults) || 0),
      children:Array.isArray(slots.children) ? slots.children.slice(0, 12) : [],
      infants:Math.max(0, Number(slots.infants) || 0),
      createdAt:new Date().toISOString(),
      source:'AI-консультант',
    };

    try {
      sessionStorage.setItem(BOOKING_INTENT_KEY, JSON.stringify(intent));
      if (saved && typeof saved === 'object') {
        saved.selectedTourId = String(tour.id);
        sessionStorage.setItem(AI_STATE_KEY, JSON.stringify(saved));
      }
    } catch (_) {}
  }

  function bindBookingContext(aiRoot) {
    if (!aiRoot || aiRoot.dataset.aiCatalogV7Bound === '1') return;
    aiRoot.dataset.aiCatalogV7Bound = '1';
    aiRoot.addEventListener('click', event => {
      const card = event.target?.closest?.(`.${UPGRADED_CLASS}[data-tour-id]`);
      if (!card || event.target?.closest?.('.like')) return;
      rememberBookingIntent(card.dataset.tourId || tourIdFromCard(card));
    }, true);
  }

  function observe(aiRoot) {
    if (!aiRoot || aiRoot.dataset.aiCatalogV7Observed === '1') return;
    aiRoot.dataset.aiCatalogV7Observed = '1';
    let scheduled = false;
    let retries = 0;

    const run = () => {
      scheduled = false;
      const changed = upgradeRecommendations(aiRoot);
      const pending = aiRoot.querySelectorAll(`.ai-recommendation.ai-sales-card[data-tour-id][${PENDING_ATTR}="pending"]`).length;
      if (pending && retries < 8) {
        retries += 1;
        setTimeout(schedule, 120);
      } else if (changed) {
        retries = 0;
      }
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(run);
    };

    const observer = new MutationObserver(mutations => {
      if (!mutations.some(item => item.addedNodes?.length || item.removedNodes?.length)) return;
      schedule();
    });
    observer.observe(aiRoot, { childList:true, subtree:true });
    schedule();
  }

  const previous = globalThis.MaxTourAI;
  if (previous?.mount) {
    globalThis.MaxTourAI = {
      ...previous,
      mount(root) {
        previous.mount(root);
        bindBookingContext(root);
        observe(root);
        upgradeRecommendations(root);
      },
      _catalogCardV7Test:{ tourIdFromCard, rememberBookingIntent, upgradeRecommendations, createCatalogCard },
    };
  }

  const api = {
    upgradeRecommendations,
    createCatalogCard,
    rememberBookingIntent,
    tourById,
    _test:{ tourIdFromCard, discoverPureCatalogRenderers, catalogSourceFor, cloneAsAiCatalogCard },
  };
  globalThis.MaxTourCatalogCardV7 = api;
  globalThis.MaxTourCatalogCardV8 = api;
})();
