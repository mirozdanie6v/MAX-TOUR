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
    [/ханоя/giu, 'Ханой'],
    [/ханою/giu, 'Ханой'],
    [/нячанга/giu, 'Нячанг'],
    [/дананга/giu, 'Дананг'],
    [/фукуока/giu, 'Фукуок'],
    [/далата/giu, 'Далат'],
    [/хойана/giu, 'Хойан'],
    [/халонга/giu, 'Халонг'],
    [/нинь\s*биня/giu, 'Ниньбинь'],
    [/фу[йи]ена/giu, 'Фуйен'],
    [/фан\s*тьета/giu, 'Фантьет'],
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

    const located = normalized.match(/(?:^|[\s,;])(?:я|мы|сейчас|нахожусь|находимся|живу|живём|живем)(?:\s+|$)[^.!?]{0,24}?(?:в|на)\s+(.+)$/iu);
    if (located) {
      const target = placeFromFragment(located[1]);
      if (target) return target;
    }

    if (/^(?:нет|неверно|ошибка|поправка|точнее|всё-таки|все-таки)(?:[\s,;:.-]|$)/iu.test(normalized)
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

(() => {
  'use strict';

  const QUESTION_SETS = [
    {
      id:'preferences',
      match:text => /что\s+вам[^?]{0,80}(?:интересн|больше)|что\s+интересн|природ[^?]{0,50}мор[^?]{0,50}(?:истор|город|культур)|мор[^?]{0,50}природ[^?]{0,50}(?:истор|город|культур)/iu.test(text),
      options:[
        ['Природа','Хочу природу и красивые виды'],
        ['Море','Хочу море и острова'],
        ['История и культура','Хочу историю, культуру и достопримечательности'],
      ],
    },
    {
      id:'budget',
      match:text => /подешевле|без\s+переплат|программа\s+интереснее|чуть\s+дороже|цена\s+важнее/iu.test(text) && /\?/u.test(text),
      options:[
        ['Подешевле','Подешевле'],
        ['Интереснее программа','Хочу более интересную и насыщенную программу'],
      ],
    },
    {
      id:'party',
      match:text => /сколько\s+(?:вас|человек)|кто\s+едет|вы\s+вдво[её]м|каким\s+составом|состав\s+группы/iu.test(text),
      options:[
        ['2 взрослых','Нас 2 взрослых'],
        ['С ребёнком','2 взрослых и ребёнок 7 лет'],
      ],
    },
    {
      id:'date',
      match:text => /(?:на\s+какой\s+день|когда\s+(?:хотите|планируете)|какая\s+дата|по\s+дате|день\s+поездки)/iu.test(text),
      options:[
        ['Сегодня','Сегодня'],
        ['Завтра','Завтра'],
        ['Дата гибкая','Дата гибкая'],
      ],
    },
    {
      id:'format',
      match:text => /группов[^?]{0,45}индивиду|индивидуальн[^?]{0,45}групп|какой\s+формат/iu.test(text),
      options:[
        ['Групповой','Хочу групповой формат'],
        ['Индивидуальный','Хочу индивидуальную экскурсию'],
        ['Сравнить','Сравните оба формата'],
      ],
    },
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalize = value => String(value || '').replace(/\s+/g,' ').trim();

  function lastBotQuestion(root) {
    const nodes = [...root.querySelectorAll('.ai-msg.bot .ai-msg-text')];
    return normalize(nodes.at(-1)?.textContent || '');
  }

  function setForQuestion(text) {
    return QUESTION_SETS.find(set => set.match(text)) || null;
  }

  function expectedHtml(set) {
    return set.options.map(([label,value]) => `<button type="button" data-ai-action="quick" data-value="${esc(value)}">${esc(label)}</button>`).join('');
  }

  function syncQuickReplies(root) {
    if (!root) return;
    const question = lastBotQuestion(root);
    const set = setForQuestion(question);
    let box = root.querySelector('.ai-quick-replies');

    if (!set) {
      if (box && /\?\s*$/u.test(question)) box.remove();
      return;
    }

    if (!box) {
      const below = root.querySelector('.ai-chat-below');
      if (!below) return;
      box = document.createElement('div');
      box.className = 'ai-quick-replies';
      below.prepend(box);
    }

    const signature = `${set.id}:${question}`;
    if (box.dataset.aiQuickV18 === signature) return;
    box.dataset.aiQuickV18 = signature;
    box.innerHTML = expectedHtml(set);
  }

  let quickQueued = false;
  function syncAll() {
    if (quickQueued) return;
    quickQueued = true;
    requestAnimationFrame(() => {
      quickQueued = false;
      document.querySelectorAll('.ai-consultant-shell').forEach(shell => syncQuickReplies(shell.parentElement));
    });
  }

  document.addEventListener('submit', syncAll, true);
  document.addEventListener('click', syncAll, true);
  new MutationObserver(syncAll).observe(document.documentElement, { childList:true, subtree:true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncAll, { once:true });
  else syncAll();

  globalThis.MaxTourAIQuickRepliesV18 = { setForQuestion, lastBotQuestion, syncQuickReplies };
})();
