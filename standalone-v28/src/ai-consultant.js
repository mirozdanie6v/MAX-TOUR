(() => {
  'use strict';

  const STORAGE_KEY = 'max-tour-ai-consultant-v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const lower = value => String(value || '').toLocaleLowerCase('ru-RU');
  const clean = (value, max = 500) => String(value ?? '').trim().slice(0, max);
  const tours = () => {
    try { return Array.isArray(TOURS) ? TOURS : []; } catch (_) { return []; }
  };

  const freshSlots = () => ({
    tripType: '', destination: '', date: '', dateFlexible: false, adults: 0,
    children: [], infants: 0, hotel: '', transfer: '', budget: '', preferences: [],
    question: '', contact: { name: '', phone: '', telegram: '' }, source: 'Telegram Mini App',
  });

  const freshState = () => ({
    slots: freshSlots(), messages: [{ role:'bot', text:'Я помогу собрать сложную поездку: учту взрослых, детей и возраст, формат, даты, программу, трансфер и бюджет. В конце передам менеджеру уже структурированную заявку — без повторного опроса.' }],
    recommendations: [], handoff: null,
  });

  let state = freshState();
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (stored?.slots && Array.isArray(stored.messages)) state = {
      ...freshState(), ...stored, slots: { ...freshSlots(), ...stored.slots, contact: { ...freshSlots().contact, ...(stored.slots.contact || {}) } },
    };
  } catch (_) {}

  function persist() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, messages: state.messages.slice(-36) })); } catch (_) {}
  }

  function addMessage(role, text) {
    const message = clean(text, 1600);
    if (!message) return;
    const last = state.messages[state.messages.length - 1];
    if (last?.role === role && last.text === message) return;
    state.messages.push({ role, text: message });
    state.messages = state.messages.slice(-36);
  }

  function firstMoney(value) {
    const match = String(value || '').match(/\$\s*([\d,.]+)/);
    return match ? Number(match[1].replace(/,/g, '')) || 0 : 0;
  }

  function formatPeople() {
    const s = state.slots;
    const total = Number(s.adults || 0) + s.children.length + Number(s.infants || 0);
    const parts = [];
    if (s.adults) parts.push(`${s.adults} взр.`);
    if (s.children.length) parts.push(`${s.children.length} дет. (${s.children.join(', ')} лет)`);
    if (s.infants) parts.push(`${s.infants} мал.`);
    return total ? `${total} · ${parts.join(' + ')}` : 'состав группы не указан';
  }

  function destinationAlias(value) {
    const q = lower(value);
    if (/нячанг|на-?чанг/.test(q)) return 'Нячанг';
    if (/дананг|да-?нанг/.test(q)) return 'Дананг';
    if (/фукуок|фу-?куок/.test(q)) return 'Фукуок';
    if (/ханой/.test(q)) return 'Ханой';
    if (/муйн|фантьет/.test(q)) return 'Муйне/Фантьет';
    if (/далат/.test(q)) return 'Далат';
    return '';
  }

  function normalizeDate(day, month, year) {
    const now = new Date();
    let y = Number(year || now.getFullYear());
    if (y < 100) y += 2000;
    const d = new Date(Date.UTC(y, Number(month) - 1, Number(day)));
    if (Number.isNaN(d.valueOf()) || d.getUTCDate() !== Number(day) || d.getUTCMonth() !== Number(month) - 1) return '';
    if (d < new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) && !year) d.setUTCFullYear(y + 1);
    return d.toISOString().slice(0, 10);
  }

  function dateLabel(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
    return new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  }

  function parseDate(text) {
    const q = lower(text);
    const numeric = q.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
    if (numeric) return { value: normalizeDate(numeric[1], numeric[2], numeric[3]), flexible: false };
    if (/завтра/.test(q)) { const d = new Date(); d.setDate(d.getDate() + 1); return { value:d.toISOString().slice(0,10), flexible:false }; }
    if (/выходн/.test(q)) return { value:'Ближайшие выходные', flexible:true };
    if (/через\s+недел|на\s+недел|в\s+течени/.test(q)) return { value:'В течение ближайшей недели', flexible:true };
    if (/гибк|неважно|пока не выбрал|дат[ау].*нет/.test(q)) return { value:'Дата гибкая', flexible:true };
    const month = q.match(/\b(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-яё]*/);
    return month ? { value:`${month[0]} — даты уточним`, flexible:true } : null;
  }

  function parseMessage(text) {
    const q = lower(text);
    const s = state.slots;
    const destination = destinationAlias(q);
    if (destination) s.destination = destination;
    if (!destination && /не реш.*(куда|город|направ)|не определ.*(куда|город|направ)|любой город|без разниц|куда угодно/.test(q)) s.destination = 'Любое направление';
    if (/индив|личн|под вас|под нас|сво[йя]|частн|без группы/.test(q)) s.tripType = 'individual';
    if (/групп|готовый выезд|сборн|тургрупп/.test(q)) s.tripType = 'group';
    if (/сравн.*оба|оба формат|пока не решил формат/.test(q)) s.tripType = 'compare';

    const adults = q.match(/(\d+)\s*(?:взросл|совершеннолет|родител)/);
    if (adults) s.adults = Math.min(30, Number(adults[1]));
    const infantMatch = q.match(/(\d+)\s*(?:малыш|младен|груднич|ребёнок до 3|ребенок до 3)/);
    if (infantMatch) s.infants = Math.min(12, Number(infantMatch[1]));
    else if (/малыш|младен|груднич|до\s*3\s*лет/.test(q)) s.infants = Math.max(1, s.infants || 0);
    if (/дет|ребён|ребен/.test(q)) {
      const ages = [...q.matchAll(/\b(\d{1,2})\s*(?:лет|года|год)\b/g)].map(match => Number(match[1])).filter(age => age >= 3 && age <= 17);
      const childCount = q.match(/(\d+)\s*(?:дет|ребён|ребен)/);
      if (ages.length) s.children = [...new Set(ages)].slice(0, 12);
      else if (childCount) s.children = Array.from({ length:Math.min(12, Number(childCount[1])) }, () => 8);
      else if (!s.children.length) s.children = [8];
    }
    if (!s.adults) {
      const total = q.match(/(?:нас|едем|поедем|будет)\s*(\d+)\s*(?:чел|человек|турист|гост)/);
      if (total) s.adults = Math.max(1, Number(total[1]) - s.children.length - s.infants);
    }
    if (s.adults > 30) s.adults = 30;

    const parsedDate = parseDate(q);
    if (parsedDate) { s.date = parsedDate.value; s.dateFlexible = parsedDate.flexible; }
    if (/море|пляж|остров|сноркл|купани/.test(q)) s.preferences = [...new Set([...s.preferences, 'море'])];
    if (/природ|горы|горы|водопад|фото|красив/.test(q)) s.preferences = [...new Set([...s.preferences, 'природа'])];
    if (/город|культур|храм|музе|истори/.test(q)) s.preferences = [...new Set([...s.preferences, 'город и культура'])];
    if (/лёгк|легк|не тяж|без долг|спокойн/.test(q)) s.preferences = [...new Set([...s.preferences, 'лёгкая программа'])];
    if (/премиум|vip|вип|комфорт/.test(q)) s.preferences = [...new Set([...s.preferences, 'комфорт / премиум'])];
    if (/трансфер/.test(q)) s.transfer = /без\s+трансфер|трансфер не нужен|сами добер/.test(q) ? 'не нужен' : 'нужен';
    if (/отел/.test(q)) s.hotel = /без\s+отел|отель не нужен/.test(q) ? 'не нужен' : 'нужен / уточнить';
    const budget = q.match(/(?:бюджет|до|примерно)\s*(?:на группу\s*)?(?:\$|usd|доллар(?:ов|а)?|руб(?:лей|ля)?\.?\s*)?\s*([\d\s.,]+)\s*(?:тыс|к|млн)?/);
    if (budget) s.budget = clean(`${budget[1].replace(/\s/g, '')}${/млн/.test(q) ? ' млн' : /тыс|\bk\b/.test(q) ? ' тыс.' : ''}`);
    const phone = text.match(/(?:\+?\d[\d\s()\-]{8,}\d)/);
    if (phone) s.contact.phone = clean(phone[0]);
    const telegram = text.match(/@[a-zA-Z0-9_]{4,32}/);
    if (telegram) s.contact.telegram = clean(telegram[0]);
    const named = text.match(/(?:меня зовут|имя)\s+([А-ЯЁA-Z][а-яёa-z-]{2,}(?:\s+[А-ЯЁA-Z][а-яёa-z-]{2,})?)/i);
    if (named) s.contact.name = clean(named[1], 160);
    s.question = clean(text, 1200);
  }

  function stage() {
    const s = state.slots;
    if (!s.destination) return 'destination';
    if (!s.tripType) return 'tripType';
    if (!s.adults && !s.children.length && !s.infants) return 'party';
    if (!s.date) return 'date';
    if (!s.preferences.length) return 'preferences';
    if (!s.contact.name && !s.contact.phone && !s.contact.telegram) return 'contact';
    return 'done';
  }

  function promptFor(current = stage()) {
    return ({
      destination: 'Куда хотите поездку? Можно назвать город или ответить «не решил(а)». В каталоге есть Нячанг, Дананг, Фукуок, Ханой и Муйне.',
      tripType: 'Какой формат рассматриваете: индивидуальная программа под вашу группу или готовый групповой выезд? Если сомневаетесь, я сравню оба.',
      party: 'Сколько едет взрослых? Напишите состав одним сообщением — например: «2 взрослых, дети 7 и 10 лет, малыш 1 год».',
      date: 'На какие даты планируете? Подойдёт точная дата, «ближайшие выходные» или диапазон — гибкие даты расширят выбор.',
      preferences: 'Что важно в поездке? Выберите или напишите несколько вариантов: море, природа, город, лёгкая программа, комфорт.',
      contact: 'Основные параметры собраны. Я покажу подходящие варианты и попрошу один контакт, чтобы менеджер получил готовую заявку, а не начинал опрос заново.',
      done: 'Заявка заполнена. Проверьте краткий бриф справа и нажмите «Передать менеджеру», если хотите продолжить подбор в чате.',
    })[current];
  }

  function quickReplies(current = stage()) {
    if (current === 'destination') return [['Нячанг','Нячанг'],['Дананг','Дананг'],['Фукуок','Фукуок'],['Ханой','Ханой'],['Муйне','Муйне/Фантьет']];
    if (current === 'tripType') return [['Индивидуально','индивидуальная поездка'],['Групповой выезд','групповой выезд'],['Сравнить оба','пока не решил формат']];
    if (current === 'party') return [['2 взрослых','2 взрослых'],['2 взрослых + ребёнок 7 лет','2 взрослых, ребёнок 7 лет']];
    if (current === 'date') return [['Ближайшие выходные','ближайшие выходные'],['В течение недели','в течение ближайшей недели'],['Дата гибкая','дата гибкая']];
    if (current === 'preferences') return [['Море и острова','море, острова'],['Природа и фото','природа, горы, фото'],['Легко и комфортно','лёгкая программа, комфорт']];
    return [];
  }

  function matchTours() {
    const s = state.slots;
    const q = lower(`${s.destination} ${s.preferences.join(' ')}`);
    const format = s.tripType === 'group' ? 'group' : 'individual';
    const people = { adults:Math.max(1, s.adults || 1), children:s.children.length, infants:s.infants };
    return tours().map(tour => {
      const hay = lower(`${tour.title} ${tour.city} ${tour.region} ${tour.category} ${(tour.tags || []).join(' ')} ${tour.searchText || ''}`);
      let score = Number(tour.popular) ? 1 : 0;
      if (s.destination && hay.includes(lower(s.destination).split('/')[0])) score += 7;
      if (s.destination === 'Далат' && /далат/.test(hay)) score += 8;
      if (s.tripType === 'group' && tour.group?.from && tour.group.from !== '—') score += 3;
      if (s.tripType === 'individual' && tour.individual?.from) score += 3;
      if (s.children.length && tour.childrenOk) score += 4;
      if (!s.children.length && /дети|семья/.test(hay) && score > 0) score += 1;
      for (const pref of s.preferences) {
        if (pref === 'море' && /море|остров|пляж|сноркл/.test(hay)) score += 4;
        if (pref === 'природа' && /природ|горы|фото|дюны|водопад/.test(hay)) score += 4;
        if (pref.includes('город') && /город|культур|мост|храм/.test(hay)) score += 3;
        if (pref.includes('лёг') && /легк|обзорн|трансфер/.test(hay)) score += 3;
        if (pref.includes('премиум') && /премиум|vip|вип|комфорт/.test(hay)) score += 3;
      }
      const base = format === 'group' ? firstMoney(tour.group?.adult || tour.group?.from) : firstMoney(tour.individual?.from);
      const total = globalThis.MaxTourBookingPricing?.calculateTotal?.(tour, people, format) || 0;
      const fallback = format === 'group' ? base * (people.adults + people.children) : base;
      const estimateUsd = total || fallback;
      return { tour, score, estimateUsd, note: s.children.length && tour.childrenOk ? 'подходит для семьи' : tour.category || 'по каталогу' };
    }).sort((a,b) => b.score - a.score || Number(b.tour.popular) - Number(a.tour.popular)).slice(0, 3);
  }

  function updateRecommendations() {
    state.recommendations = matchTours();
  }

  function answerQuestion(text) {
    const q = lower(text);
    if (/отмен|перенос|возврат/.test(q)) return 'Правила зависят от момента действия: раньше чем за 48 часов отмена бесплатна; ближе к выезду может быть удержание. Перенос также пересчитывается по текущей дате — менеджер увидит запрос и предложит доступные варианты.';
    if (/оплат|депозит|предоплат|30\s*%|сто процент/.test(q)) return 'Можно зафиксировать поездку депозитом или полной оплатой. В рабочей CRM система сама покажет оплачено, остаток и статус заказа; сейчас я сначала соберу точный состав и программу.';
    if (/трансфер|аэропорт|встреч/.test(q)) return 'Трансфер можно добавить к брифу: укажите отель и аэропорт/точку встречи. Я передам это менеджеру отдельным полем, чтобы не потерять деталь в переписке.';
    if (/ребён|ребен|дет|малыш|коляск/.test(q)) return 'Да, сложный состав — как раз то, что я фиксирую: число взрослых, возраст каждого ребёнка и малышей. После этого менеджер сможет проверить ограничения маршрута, питание, кресло и комфорт темпа.';
    if (/что входит|включен|программ|маршрут/.test(q)) return 'В карточке выбранной экскурсии можно открыть программу и включённые услуги. Я сначала подберу подходящие варианты, а в брифе сохраню ваш вопрос, чтобы менеджер ответил по конкретному маршруту.';
    return '';
  }

  function summaryRows() {
    const s = state.slots;
    const rows = [];
    if (s.destination) rows.push(['Направление', s.destination]);
    if (s.tripType) rows.push(['Формат', s.tripType === 'group' ? 'Готовый групповой выезд' : s.tripType === 'compare' ? 'Сравнить групповой и индивидуальный' : 'Индивидуальная программа']);
    if (s.adults || s.children.length || s.infants) rows.push(['Состав группы', formatPeople()]);
    if (s.date) rows.push(['Дата', s.dateFlexible ? s.date : dateLabel(s.date)]);
    if (s.preferences.length) rows.push(['Пожелания', s.preferences.join(', ')]);
    if (s.hotel) rows.push(['Отель', s.hotel]);
    if (s.transfer) rows.push(['Трансфер', s.transfer]);
    if (s.budget) rows.push(['Бюджет', s.budget]);
    if (s.contact.name || s.contact.phone || s.contact.telegram) rows.push(['Контакт', [s.contact.name, s.contact.phone, s.contact.telegram].filter(Boolean).join(' · ')]);
    return rows;
  }

  function renderRecommendations() {
    if (!state.recommendations.length) return '';
    const format = state.slots.tripType === 'group' ? 'групповой' : state.slots.tripType === 'compare' ? 'оба формата' : 'индивидуальный';
    return `<div class="ai-recommendations"><div class="hint" style="font-size:10.5px;font-weight:850">Предварительный подбор · ${format} формат</div>${state.recommendations.map(item => {
      const price = item.estimateUsd ? `примерно $${item.estimateUsd.toLocaleString('ru-RU')} за группу` : 'цену подтвердит менеджер';
      return `<article class="ai-recommendation"><div><h4>${esc(item.tour.title)}</h4><p>${esc(item.tour.city || '')} · ${esc(item.note)}</p><span class="ai-price">${esc(price)}</span></div><button type="button" class="secondary" data-ai-action="open-tour" data-id="${esc(item.tour.id)}">Открыть</button></article>`;
    }).join('')}</div>`;
  }

  function renderContactForm() {
    const s = state.slots;
    if (!['contact','done'].includes(stage()) || state.handoff) return '';
    return `<form class="ai-contact-form" data-ai-form="contact"><h4>Передать менеджеру готовую заявку</h4><p>Достаточно одного способа связи. Дополнительные поля помогают сразу посчитать сложный заказ.</p><div class="ai-contact-grid"><label>Имя<input name="name" value="${esc(s.contact.name)}" placeholder="Как к вам обращаться"></label><label>Телефон<input name="phone" value="${esc(s.contact.phone)}" placeholder="+7 ..."></label><label>Telegram<input name="telegram" value="${esc(s.contact.telegram)}" placeholder="@username"></label><label>Бюджет / комментарий<input name="budget" value="${esc(s.budget)}" placeholder="Например, до $600"></label><label class="wide">Отель и трансфер<input name="hotelTransfer" value="${esc([s.hotel && `отель: ${s.hotel}`, s.transfer && `трансфер: ${s.transfer}`].filter(Boolean).join('; '))}" placeholder="Отель, нужен ли трансфер"></label></div><div class="ai-contact-actions"><button class="primary" type="submit">Передать менеджеру</button><button class="secondary" type="button" data-ai-action="skip-contact">Только открыть варианты</button></div><div class="form-error" role="alert"></div></form>`;
  }

  function renderBrief() {
    const rows = summaryRows();
    return `<aside class="ai-consultant-brief"><h3 class="ai-brief-title">Бриф поездки</h3><p class="ai-brief-caption">То, что менеджер увидит в CRM после передачи заявки.</p><div class="ai-brief-list">${rows.length ? rows.map(row => `<div class="ai-brief-row"><span>${esc(row[0])}</span><b>${esc(row[1])}</b></div>`).join('') : '<div class="ai-brief-empty">Пока пусто. Начните с города, формата и состава группы.</div>'}</div>${state.handoff ? `<div class="ai-handoff"><b>Заявка передана менеджеру</b>№ ${esc(state.handoff.id)} · статус «Новая». В рабочей версии CRM сюда добавится реальный канал связи и история диалога.</div>` : ''}${state.handoff ? '<button type="button" class="secondary ai-reset" data-ai-action="reset">Новая консультация</button>' : ''}</aside>`;
  }

  function render(root) {
    const current = stage();
    const progress = Math.round((['destination','tripType','party','date','preferences','contact'].filter(key => {
      if (key === 'destination') return state.slots.destination;
      if (key === 'tripType') return state.slots.tripType;
      if (key === 'party') return state.slots.adults || state.slots.children.length || state.slots.infants;
      if (key === 'date') return state.slots.date;
      if (key === 'preferences') return state.slots.preferences.length;
      return state.slots.contact.name || state.slots.contact.phone || state.slots.contact.telegram;
    }).length / 6) * 100);
    const quick = quickReplies(current);
    root.innerHTML = `<div class="section-title"><h2>AI-консультант</h2><span class="hint">сложные поездки · ${progress}% брифа</span></div><div class="ai-consultant-shell"><section class="ai-consultant-main"><div class="ai-consultant-intro"><div><h3>Подберём поездку под вашу группу</h3><p>Один вопрос за раз — затем готовая заявка для менеджера с составом, возрастом детей и ориентиром по цене.</p></div><span class="ai-consultant-badge">AI · demo</span></div><div class="ai-progress" aria-label="Заполнение брифа"><span style="width:${progress}%"></span></div><div class="ai-messages" aria-live="polite">${state.messages.map(message => `<div class="ai-msg ${message.role === 'user' ? 'user' : 'bot'}">${esc(message.text)}</div>`).join('')}</div>${renderRecommendations()}${renderContactForm()}<div class="ai-quick-replies">${quick.map(item => `<button type="button" data-ai-action="quick" data-value="${esc(item[1])}">${esc(item[0])}</button>`).join('')}</div><form class="ai-consultant-input" data-ai-form="chat"><textarea name="message" rows="1" placeholder="Например: 2 взрослых, дети 7 и 10 лет, море в июле..." aria-label="Сообщение AI-консультанту"></textarea><button class="primary" type="submit" aria-label="Отправить">→</button></form></section>${renderBrief()}</div>`;
    const messages = root.querySelector('.ai-messages');
    if (messages) messages.scrollTop = messages.scrollHeight;
    persist();
  }

  function handleChat(form, root) {
    const text = String(new FormData(form).get('message') || '').trim();
    if (!text) return;
    addMessage('user', text);
    parseMessage(text);
    updateRecommendations();
    const current = stage();
    const answer = answerQuestion(text);
    const next = current === 'contact'
      ? `Отлично, я собрал параметры. ${state.recommendations.length ? 'Ниже — подходящие варианты с ориентиром по стоимости.' : ''} Оставьте имя и Telegram или телефон — менеджер получит этот бриф целиком.`
      : promptFor(current);
    addMessage('bot', answer ? `${answer}\n\n${next}` : next);
    render(root);
  }

  async function handleContact(form, root) {
    const data = Object.fromEntries(new FormData(form));
    state.slots.contact = { name:clean(data.name,160), phone:clean(data.phone,80), telegram:clean(data.telegram,120) };
    state.slots.budget = clean(data.budget,120) || state.slots.budget;
    const extra = clean(data.hotelTransfer,250);
    if (extra) {
      state.slots.hotel = /отел/i.test(extra) ? extra : state.slots.hotel;
      state.slots.transfer = /трансфер/i.test(extra) ? extra : (state.slots.transfer || extra);
    }
    if (!state.slots.contact.name && !state.slots.contact.phone && !state.slots.contact.telegram) {
      form.querySelector('.form-error').textContent = 'Укажите имя, телефон или Telegram — иначе менеджер не сможет связаться.';
      return;
    }
    const summary = summaryRows().map(row => `${row[0]}: ${row[1]}`).join('\n');
    const payload = { ...state.slots, recommendations:state.recommendations.map(item => ({ tourId:item.tour.id, title:item.tour.title, estimateUsd:item.estimateUsd })) };
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch('/api/consultations', { method:'POST', credentials:'same-origin', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ intent:'complex_tour', handoff:true, summary, payload }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'consultation_failed');
      state.handoff = result.consultation || { id:'AI-demo' };
      addMessage('bot', `Готово — заявка ${state.handoff.id} передана менеджеру вместе с составом группы, пожеланиями и предварительным подбором. Повторно объяснять всё не понадобится.`);
      render(root);
    } catch (error) {
      form.querySelector('.form-error').textContent = 'Не удалось сохранить заявку. Проверьте соединение и повторите отправку.';
      button.disabled = false;
    }
  }

  function handle(root, event) {
    const action = event.target.closest('[data-ai-action]')?.dataset.aiAction;
    if (action === 'quick') {
      const value = event.target.closest('[data-ai-action]').dataset.value || '';
      if (!value) return;
      addMessage('user', value);
      parseMessage(value);
      updateRecommendations();
      addMessage('bot', stage() === 'contact' ? 'Основные параметры собраны. Проверьте варианты и оставьте контакт для менеджера.' : promptFor(stage()));
      render(root);
    }
    if (action === 'open-tour') {
      const id = event.target.closest('[data-ai-action]').dataset.id;
      try { if (typeof openTour === 'function') openTour(id); } catch (_) {}
    }
    if (action === 'skip-contact') {
      addMessage('user', 'Пока только посмотрю варианты');
      addMessage('bot', 'Конечно. Выберите экскурсию ниже — состав группы и предварительный расчёт уже сохранены в этом диалоге. Для передачи менеджеру контакт можно добавить позже.');
      render(root);
    }
    if (action === 'reset') {
      state = freshState();
      render(root);
    }
  }

  function mount(root) {
    if (!root) return;
    render(root);
    root.onclick = event => handle(root, event);
    root.onsubmit = event => {
      const form = event.target.closest('[data-ai-form]');
      if (!form) return;
      event.preventDefault();
      if (form.dataset.aiForm === 'chat') handleChat(form, root);
      if (form.dataset.aiForm === 'contact') handleContact(form, root);
    };
  }

  globalThis.MaxTourAI = { mount };
})();
