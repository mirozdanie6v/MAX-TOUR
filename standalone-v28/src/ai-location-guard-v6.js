(() => {
  'use strict';

  const KEY = 'max-tour-ai-location-v6';
  const PLACES = [
    ['Нячанг', /нячанг|на-?чанг|nha\s*trang/i],
    ['Ханой', /ханой|ханое|hanoi/i],
    ['Ниньбинь', /нинь\s*бинь?|ниньбинь?|ninh\s*binh/i],
    ['Халонг', /ха\s*лонг|халонг|ha\s*long/i],
    ['Далат', /далат|da\s*lat/i],
    ['Дананг', /дананг|да-?нанг|da\s*nang/i],
    ['Хойан', /хой\s*ан|хойан|hoi\s*an/i],
    ['Фукуок', /фу\s*куок|фукуок|phu\s*quoc/i],
    ['Муйне/Фантьет', /муй\s*не|муйне|фантьет|фан\s*тьет|mui\s*ne|phan\s*thiet/i],
    ['Фуйен', /фу[йи]ен|фуйен|туй\s*хоа|phu\s*yen|tuy\s*hoa/i],
  ];
  const ROUTES = {
    'Нячанг': new Set(['Нячанг','Далат','Фуйен','Муйне/Фантьет']),
    'Ханой': new Set(['Ханой','Ниньбинь','Халонг']),
    'Дананг': new Set(['Дананг','Хойан']),
    'Фукуок': new Set(['Фукуок']),
    'Далат': new Set(['Далат']),
    'Муйне/Фантьет': new Set(['Муйне/Фантьет']),
    'Фуйен': new Set(['Фуйен']),
    'Хойан': new Set(['Хойан','Дананг']),
    'Халонг': new Set(['Халонг','Ханой']),
    'Ниньбинь': new Set(['Ниньбинь','Ханой']),
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const lower = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g,'е');
  const placeFrom = value => PLACES.find(([,pattern]) => pattern.test(String(value || '')))?.[0] || '';
  const allowed = (origin,destination) => !origin || !destination ? true : (ROUTES[origin]?.has(destination) ?? origin === destination);

  let state = { origin:'', requestedDestination:'', locationJustSet:false, lastInput:'' };
  try { state = { ...state, ...(JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}) }; } catch (_) {}
  let processing = false;
  let postprocessQueued = false;

  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function reset() { state = { origin:'', requestedDestination:'', locationJustSet:false, lastInput:'' }; try { sessionStorage.removeItem(KEY); } catch (_) {} }

  function isOriginPhrase(text, place) {
    const q = lower(text), token = lower(place).split('/')[0];
    return (/(?:^|\s)(?:я|мы|сейчас|нахожусь|находимся|живу|живем)[^.!?]{0,18}(?:в|на)\s+/i.test(q) && q.includes(token)) || (/(?:^|\s)(?:из|выезд\s+из|старт\s+из)\s+/i.test(q) && q.includes(token));
  }
  function isDestinationPhrase(text) { return /хочу|поех|съезд|экскурс|тур\b|покаж|скин|пришл|подбер|вариант/i.test(String(text || '')); }

  function inspectInput(text) {
    const q = String(text || '').trim(); if (!q) return;
    state.lastInput = q;
    const found = PLACES.filter(([,pattern]) => pattern.test(q)).map(([name]) => name);
    let origin = found.find(place => isOriginPhrase(q,place));
    if (!origin && found.length === 1 && !state.origin && !isDestinationPhrase(q)) origin = found[0];
    if (origin) {
      state.origin = origin;
      state.locationJustSet = !isDestinationPhrase(q);
      if (state.requestedDestination === origin) state.requestedDestination = '';
    } else {
      state.locationJustSet = false;
    }
    if (isDestinationPhrase(q)) {
      const destination = found.find(place => place !== state.origin) || found[0] || '';
      if (destination) state.requestedDestination = destination;
    } else if (state.origin && found.length === 1 && found[0] !== state.origin) {
      state.requestedDestination = found[0];
    }
    save();
  }

  function tourPlace(card) {
    const id = card?.dataset?.tourId;
    try {
      const tour = Array.isArray(TOURS) ? TOURS.find(item => String(item.id) === String(id)) : null;
      if (tour) return placeFrom(`${tour.city || ''} ${tour.region || ''} ${tour.title || ''}`);
    } catch (_) {}
    return placeFrom(card?.textContent || '');
  }

  function filterCards(root) {
    if (!state.origin) return 0;
    let visible = 0;
    root.querySelectorAll('.ai-sales-card[data-tour-id]').forEach(card => {
      const destination = tourPlace(card);
      const routeOk = destination && allowed(state.origin,destination);
      const destinationOk = !state.requestedDestination || destination === state.requestedDestination;
      card.hidden = !(routeOk && destinationOk);
      if (!card.hidden) visible += 1;
    });
    root.querySelectorAll('.ai-sales-results').forEach(group => {
      const cards = [...group.querySelectorAll('.ai-sales-card[data-tour-id]')];
      if (cards.length) group.hidden = cards.every(card => card.hidden);
      const label = group.querySelector('.ai-chat-results-label');
      const desired = `Подходящие экскурсии из ${state.origin}`;
      if (label && !group.hidden && label.textContent !== desired) label.textContent = desired;
    });
    return visible;
  }

  function routeReply() {
    const destination = state.requestedDestination;
    if (!state.origin || !destination) return '';
    if (!allowed(state.origin,destination)) return `Из ${state.origin} направление ${destination} не относится к доступным маршрутам в этом демо. Укажите другую точку выезда или другое направление.`;
    return `Да, ${destination} можно подобрать с выездом из ${state.origin}. Если готовой карточки с подтверждённой ценой сейчас нет, я не буду выдумывать цену — уточним дату и состав группы и оформим маршрут по запросу.`;
  }

  function locationReply() {
    if (state.origin === 'Ханой') return 'Хорошо, выезд из Ханоя. Могу подобрать Ниньбинь, Халонг, варианты по Ханою или другой маршрут.';
    if (state.origin === 'Нячанг') return 'Хорошо, выезд из Нячанга. Могу подобрать острова, Нячанг, Далат, Фуйен и другие доступные маршруты.';
    if (state.origin === 'Дананг') return 'Хорошо, выезд из Дананга. Могу подобрать Дананг, Хойан и другие доступные варианты.';
    return `Хорошо, точка выезда — ${state.origin}. Куда хотите поехать?`;
  }

  function lastBotText(root) {
    const nodes = [...root.querySelectorAll('.ai-msg.bot .ai-msg-text')];
    return nodes[nodes.length - 1] || null;
  }

  function replaceUnsafeReply(root, visibleCards) {
    const bot = lastBotText(root); if (!bot) return;
    const text = String(bot.textContent || '');
    if (/подбираю/i.test(text)) return;
    if (state.locationJustSet) {
      const next = locationReply(); if (text !== next) bot.textContent = next; return;
    }
    if (state.requestedDestination) {
      const mentioned = PLACES.map(([name,pattern]) => pattern.test(text) ? name : '').filter(Boolean);
      const bad = mentioned.find(place => place !== state.origin && place !== state.requestedDestination && !allowed(state.origin,place));
      const refusal = /не могу|невозможно|нет такой|не представлен|не доступ/i.test(text);
      if (bad || refusal || visibleCards === 0) {
        const next = routeReply(); if (next && text !== next) bot.textContent = next;
      }
    } else if (state.origin) {
      const mentioned = PLACES.map(([name,pattern]) => pattern.test(text) ? name : '').filter(Boolean);
      const bad = mentioned.find(place => place !== state.origin && !allowed(state.origin,place));
      if (bad) bot.textContent = locationReply();
    }
  }

  function locationOptions() {
    return [['Нячанг','Я в Нячанге'],['Ханой','Я в Ханое'],['Дананг','Я в Дананге'],['Фукуок','Я на Фукуоке']];
  }
  function routeOptions() {
    if (state.origin === 'Ханой') return [['Ниньбинь','Ниньбинь'],['Халонг','Халонг'],['Ханой','Хочу обзор Ханоя']];
    if (state.origin === 'Нячанг') return [['Острова','Хочу море и острова'],['Далат','Хочу экскурсию в Далат'],['Нячанг','Хочу обзор Нячанга']];
    if (state.origin === 'Дананг') return [['Хойан','Хочу экскурсию в Хойан'],['Дананг','Хочу обзор Дананга'],['Природа','Хочу природу и красивые виды']];
    return [];
  }

  function replaceQuickReplies(root) {
    let box = root.querySelector('.ai-quick-replies');
    const options = !state.origin ? locationOptions() : state.locationJustSet ? routeOptions() : [];
    if (!options.length) return;
    if (!box) {
      const below = root.querySelector('.ai-chat-below'); if (!below) return;
      box = document.createElement('div'); box.className = 'ai-quick-replies'; below.prepend(box);
    }
    const desired = options.map(([label,value]) => `<button type="button" data-location-v6-value="${esc(value)}">${esc(label)}</button>`).join('');
    if (box.dataset.locationV6Html === desired) return;
    box.dataset.locationV6Html = desired;
    box.innerHTML = desired;
  }

  function renderRequestCard(root, visibleCards) {
    const existing = root.querySelector('.ai-location-request-v6');
    const shouldRender = state.origin && state.requestedDestination && visibleCards === 0 && allowed(state.origin,state.requestedDestination);
    if (!shouldRender) {
      if (existing) existing.remove();
      return;
    }
    const routeKey = `${state.origin}>${state.requestedDestination}`;
    if (existing?.dataset.routeKey === routeKey) return;
    if (existing) existing.remove();
    const below = root.querySelector('.ai-chat-below'); if (!below) return;
    const wrap = document.createElement('div');
    wrap.className = 'ai-chat-results ai-sales-results ai-location-request-v6';
    wrap.dataset.routeKey = routeKey;
    wrap.innerHTML = `<div class="ai-msg-author">AI-консультант</div><div class="ai-chat-results-label">Маршрут по запросу</div><div class="ai-recommendations"><article class="ai-recommendation ai-sales-card"><div class="ai-tour-card-copy"><span class="ai-tour-meta">${esc(state.origin)} → ${esc(state.requestedDestination)}</span><h4>${esc(state.requestedDestination)} из ${esc(state.origin)}</h4><p>Маршрут можно подобрать. Дата, наличие и цена подтверждаются после уточнения параметров.</p><span class="ai-price">Цена после подтверждения</span></div></article></div>`;
    below.append(wrap);
  }

  function firstQuestion(root) {
    if (state.origin) return;
    const userMessages = root.querySelectorAll('.ai-msg.user').length;
    const bot = lastBotText(root);
    const desired = 'Где вы сейчас или откуда планируете выезд?';
    if (!userMessages && bot && bot.textContent !== desired) bot.textContent = desired;
  }

  function postprocess(root) {
    if (!root || processing) return;
    processing = true;
    try {
      firstQuestion(root);
      const visible = filterCards(root);
      replaceUnsafeReply(root,visible);
      replaceQuickReplies(root);
      renderRequestCard(root,visible);
    } finally { processing = false; }
  }

  function schedulePostprocess(root) {
    if (postprocessQueued) return;
    postprocessQueued = true;
    const run = () => {
      postprocessQueued = false;
      postprocess(root);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    else setTimeout(run, 0);
  }

  const previous = globalThis.MaxTourAI;
  if (!previous?.mount) return;
  globalThis.MaxTourAI = {
    ...previous,
    mount(root) {
      previous.mount(root);
      const oldSubmit = root.onsubmit;
      const oldKeydown = root.onkeydown;
      const oldClick = root.onclick;
      root.onsubmit = event => {
        const value = event.target?.querySelector?.('textarea[name="message"]')?.value?.trim();
        if (value) inspectInput(value);
        const result = oldSubmit?.call(root,event);
        schedulePostprocess(root);
        return result;
      };
      root.onkeydown = event => {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          const value = event.target?.closest?.('textarea[name="message"]')?.value?.trim();
          if (value) inspectInput(value);
        }
        const result = oldKeydown?.call(root,event);
        schedulePostprocess(root);
        return result;
      };
      root.onclick = event => {
        const locationButton = event.target.closest?.('[data-location-v6-value]');
        if (locationButton) {
          event.preventDefault(); event.stopPropagation();
          const value = locationButton.dataset.locationV6Value || '';
          const form = root.querySelector('[data-ai-form="chat"]');
          const textarea = form?.querySelector('textarea[name="message"]');
          if (textarea && form) { textarea.value = value; inspectInput(value); form.requestSubmit(); }
          return;
        }
        const clear = event.target.closest?.('[data-ai-action="clear"]');
        if (clear) reset();
        const result = oldClick?.call(root,event);
        schedulePostprocess(root);
        return result;
      };
      const observer = new MutationObserver(() => schedulePostprocess(root));
      observer.observe(root,{childList:true,subtree:true});
      postprocess(root);
    },
    _locationTest:{ placeFrom,allowed,inspectInput },
  };
})();
