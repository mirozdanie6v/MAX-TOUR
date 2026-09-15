(() => {
  'use strict';

  const AI_STATE_KEY = 'max-tour-ai-consultant-v5';

  const lower = value => String(value || '')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tours = () => {
    try { return Array.isArray(TOURS) ? TOURS : []; }
    catch (_) { return []; }
  };

  function readState() {
    try { return JSON.parse(sessionStorage.getItem(AI_STATE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function saveState(state) {
    try { sessionStorage.setItem(AI_STATE_KEY, JSON.stringify(state)); }
    catch (_) {}
  }

  function aliases(tour) {
    const result = new Set([lower(tour?.title)]);
    const id = String(tour?.id || '');
    if (id === 'hon-tam-island') {
      result.add('хон там');
      result.add('остров хон там');
    }
    if (id === 'orchid-monkey-islands') {
      result.add('остров орхидей');
      result.add('остров обезьян');
      result.add('орхидей и обезьян');
    }
    if (id === 'dalat-premium') result.add('далат премиум');
    if (id === 'dalat-vip') result.add('далат вип');
    return [...result].filter(text => text.length >= 5);
  }

  function mentionedTour(text) {
    const q = lower(text);
    if (!q) return null;
    const ranked = tours()
      .map(tour => ({ tour, matches:aliases(tour).filter(alias => q.includes(alias)) }))
      .filter(row => row.matches.length)
      .sort((a, b) => Math.max(...b.matches.map(x => x.length)) - Math.max(...a.matches.map(x => x.length)));
    return ranked[0]?.tour || null;
  }

  function explicitTourFromState(state = readState()) {
    const messages = Array.isArray(state?.messages) ? state.messages : [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role !== 'user') continue;
      const tour = mentionedTour(messages[i]?.text);
      if (tour) return tour;
    }
    return null;
  }

  function persistTour(tour) {
    if (!tour?.id) return false;
    const state = readState();
    if (String(state.selectedTourId || '') === String(tour.id)) return false;
    state.selectedTourId = String(tour.id);
    saveState(state);
    return true;
  }

  function syncFromState() {
    const tour = explicitTourFromState();
    return tour ? persistTour(tour) : false;
  }

  function syncFromInput(target) {
    if (!(target instanceof HTMLTextAreaElement) && !(target instanceof HTMLInputElement)) return false;
    if (target.name !== 'message' && !target.closest?.('[data-ai-form="chat"]')) return false;
    const tour = mentionedTour(target.value);
    return tour ? persistTour(tour) : false;
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      syncFromState();
    });
  }

  document.addEventListener('input', event => { syncFromInput(event.target); }, true);
  document.addEventListener('submit', schedule, false);
  document.addEventListener('click', schedule, false);
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();

  globalThis.MaxTourAiExplicitTourV16 = {
    mentionedTour,
    explicitTourFromState,
    syncFromState,
  };
})();

(() => {
  'use strict';

  const locationTest = globalThis.MaxTourAI?._locationTest;
  if (!locationTest?.inspectInput || !locationTest?.placeFrom || !locationTest?.placesFrom) return;

  const CASE_FIXES = [
    [/\bханоя\b/giu, 'Ханой'],
    [/\bханою\b/giu, 'Ханой'],
    [/\bнячанга\b/giu, 'Нячанг'],
    [/\bдананга\b/giu, 'Дананг'],
    [/\bфукуока\b/giu, 'Фукуок'],
    [/\bдалата\b/giu, 'Далат'],
    [/\bхойана\b/giu, 'Хойан'],
    [/\bхалонга\b/giu, 'Халонг'],
    [/\bнинь\s*биня\b/giu, 'Ниньбинь'],
    [/\bфу[йи]ена\b/giu, 'Фуйен'],
    [/\bфан\s*тьета\b/giu, 'Фантьет'],
  ];

  function normalizeRussianCases(value) {
    return CASE_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value || ''));
  }

  function placeFromFragment(fragment) {
    const normalized = normalizeRussianCases(fragment);
    return locationTest.placeFrom(normalized) || locationTest.placesFrom(normalized)?.[0] || '';
  }

  function correctionTarget(value) {
    const normalized = normalizeRussianCases(value).trim();
    if (!normalized) return '';

    const contrast = normalized.match(/(?:^|[\s,;])не\s+[^,;.!?]{0,40}?[,;]?\s+а\s+(.+)$/iu);
    if (contrast) {
      const target = placeFromFragment(contrast[1]);
      if (target) return target;
    }

    const explicitOrigin = normalized.match(/(?:^|[\s,;])(?:выезд|старт|отправление)\s+(?:будет\s+)?из\s+(.+)$/iu)
      || normalized.match(/(?:^|[\s,;])из\s+(.+)$/iu);
    if (explicitOrigin) {
      const target = placeFromFragment(explicitOrigin[1]);
      if (target) return target;
    }

    const located = normalized.match(/(?:^|[\s,;])(?:я|мы|сейчас|нахожусь|находимся|живу|живём|живем)\b[^.!?]{0,24}?(?:в|на)\s+(.+)$/iu);
    if (located) {
      const target = placeFromFragment(located[1]);
      if (target) return target;
    }

    if (/^(?:нет|неверно|ошибка|поправка|точнее|всё-таки|все-таки)\b/iu.test(normalized)
      || /(?:имею|имел|имела|имели)\s+в\s+виду/iu.test(normalized)) {
      const places = locationTest.placesFrom(normalized);
      if (places.length) return places[places.length - 1];
    }

    return '';
  }

  function applyCorrection(value) {
    const target = correctionTarget(value);
    if (!target) return '';
    locationTest.inspectInput(`выезд из ${target}`);
    return target;
  }

  function submittedText(event) {
    return event.target?.querySelector?.('textarea[name="message"]')?.value?.trim() || '';
  }

  document.addEventListener('submit', event => {
    const value = submittedText(event);
    if (value) applyCorrection(value);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const value = event.target?.closest?.('textarea[name="message"]')?.value?.trim();
    if (value) applyCorrection(value);
  }, true);

  globalThis.MaxTourAiLocationCorrectionV17 = {
    normalizeRussianCases,
    correctionTarget,
    applyCorrection,
  };
})();
