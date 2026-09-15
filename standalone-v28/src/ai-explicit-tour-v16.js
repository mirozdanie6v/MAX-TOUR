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
