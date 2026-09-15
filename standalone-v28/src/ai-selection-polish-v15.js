(() => {
  'use strict';

  const LOCATION_KEY = 'max-tour-ai-location-v6';
  const CARD_SELECTOR = '.ai-sales-results .ai-recommendations > .tour-card[data-tour-id]';
  const ALL_CARD_SELECTOR = '.tour-card,.wide-card';
  const FROM_LABELS = {
    'Нячанг':'Нячанга',
    'Ханой':'Ханоя',
    'Дананг':'Дананга',
    'Фукуок':'Фукуока',
    'Далат':'Далата',
    'Фуйен':'Фуйена',
    'Хойан':'Хойана',
    'Халонг':'Халонга',
    'Ниньбинь':'Ниньбиня',
    'Муйне/Фантьет':'Муйне/Фантьета',
  };

  const lower = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const tours = () => {
    try { return Array.isArray(TOURS) ? TOURS : []; }
    catch (_) { return []; }
  };

  function locationState() {
    try { return JSON.parse(sessionStorage.getItem(LOCATION_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function lastUserText(root = document) {
    const nodes = [...root.querySelectorAll('.ai-msg.user .ai-msg-text')];
    return String(nodes[nodes.length - 1]?.textContent || '');
  }

  function hasIslandIntent(root = document) {
    const q = lower(lastUserText(root));
    return /остров|сноркл|катамаран|лодк/.test(q);
  }

  function tourById(id) {
    return tours().find(tour => String(tour?.id) === String(id)) || null;
  }

  function tourText(tour) {
    return lower(`${tour?.title || ''} ${tour?.region || ''} ${tour?.category || ''} ${(tour?.tags || []).join(' ')} ${tour?.searchText || ''}`);
  }

  function islandScore(tour) {
    const hay = tourText(tour);
    let score = 0;
    if (/остров/.test(hay)) score += 100;
    if (/сноркл/.test(hay)) score += 35;
    if (/катамаран|лодк/.test(hay)) score += 20;
    if (/пляж|купани/.test(hay)) score += 12;
    if (/море|морск/.test(hay)) score += 5;
    if (Number(tour?.popular)) score += 1;
    return score;
  }

  function reorderIslandRecommendations(root = document) {
    const origin = locationState()?.origin || '';
    if (origin !== 'Нячанг' || !hasIslandIntent(root)) return 0;

    let changed = 0;
    root.querySelectorAll('.ai-sales-results .ai-recommendations').forEach(list => {
      const cards = [...list.querySelectorAll(':scope > .tour-card[data-tour-id]')];
      if (cards.length < 2) return;
      const ranked = cards
        .map((card, index) => ({ card, index, score:islandScore(tourById(card.dataset.tourId)) }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
      const before = cards.map(card => card.dataset.tourId).join('|');
      const after = ranked.map(row => row.card.dataset.tourId).join('|');
      if (before === after) return;
      ranked.forEach(row => list.append(row.card));
      changed += 1;
    });
    return changed;
  }

  function cardTourId(card) {
    if (card?.dataset?.tourId) return card.dataset.tourId;
    const onclick = String(card?.getAttribute?.('onclick') || '');
    return onclick.match(/openTour\(['"]([^'"]+)['"]\)/)?.[1] || '';
  }

  function validPrice(value) {
    const text = String(value || '').trim();
    return Boolean(text && text !== '—' && text !== '-');
  }

  function patchCardFormat(card) {
    const tour = tourById(cardTourId(card));
    if (!tour) return false;

    const groupOk = validPrice(tour.group?.from || tour.group?.adult);
    const individualOk = validPrice(tour.individual?.from);
    const fallbackFormat = groupOk && individualOk ? 'индивидуальный / групповой' : individualOk ? 'индивидуальный' : 'групповой';
    const format = String(tour.formatsLabel || fallbackFormat).trim();
    const meta = card.querySelector('.meta');
    if (meta) {
      const desired = `${tour.city || ''} · ${format} · ${tour.duration || ''}`;
      if (meta.textContent !== desired) meta.textContent = desired;
    }

    const priceBoxes = [...card.querySelectorAll('.price-row > div')];
    if (priceBoxes[0]) priceBoxes[0].hidden = !groupOk;
    if (priceBoxes[1]) priceBoxes[1].hidden = !individualOk;
    return true;
  }

  function patchCardFormats(root = document) {
    let count = 0;
    root.querySelectorAll(ALL_CARD_SELECTOR).forEach(card => {
      if (patchCardFormat(card)) count += 1;
    });
    return count;
  }

  function patchResultLabels(root = document) {
    const origin = locationState()?.origin || '';
    if (!origin) return 0;
    const from = FROM_LABELS[origin] || origin;
    let changed = 0;
    root.querySelectorAll('.ai-sales-results .ai-chat-results-label').forEach(label => {
      const desired = `Подходящие экскурсии из ${from}`;
      if (label.textContent !== desired) {
        label.textContent = desired;
        changed += 1;
      }
    });
    return changed;
  }

  let queued = false;
  function run() {
    queued = false;
    patchCardFormats(document);
    reorderIslandRecommendations(document);
    patchResultLabels(document);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();

  document.addEventListener('click', schedule, true);
  document.addEventListener('submit', schedule, true);
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });

  globalThis.MaxTourAiSelectionV15 = {
    run,
    islandScore,
    reorderIslandRecommendations,
    patchCardFormats,
    patchResultLabels,
  };
})();
