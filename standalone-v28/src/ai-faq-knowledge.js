const clip = (value, max = 600) => String(value ?? '').trim().slice(0, max);
const list = (value, maxItems = 10, maxLen = 220) => (Array.isArray(value) ? value : [])
  .slice(0, maxItems).map(item => clip(item, maxLen)).filter(Boolean);
const norm = value => clip(value, 2400).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')
  .replace(/[«»“”"'`]/g, '').replace(/\s+/g, ' ').trim();

export const MAX_TOUR_GLOBAL_FACTS = {
  payment: 'Для предварительного бронирования используется депозит 30% или полная оплата. Доступны наличные, карта и перевод в рублях, тенге, долларах и других валютах; конкретный вариант оплаты выбирается при оформлении.',
  cancellation: 'Отмена более чем за 48 часов до выезда — бесплатно; до 17:00 за день до выезда удерживается 30%; позже применяется удержание 100%.',
  reschedule: 'Перенос экскурсии бесплатный до 17:00 за день до выезда; после этого может удерживаться 30% стоимости.',
  forceMajeure: 'При форс-мажоре, включая опасные погодные условия и природные события, тур может быть изменён или отменён; в таком случае возможен перенос или возврат средств.',
  amianaTransfer: 'Для Amiana действует доплата за трансфер: $20 за машину для 1–6 человек или $30 для 7–14 человек.',
};

export function compactTourForAi(tour = {}) {
  const group = tour.group && typeof tour.group === 'object' ? tour.group : null;
  const individual = tour.individual && typeof tour.individual === 'object' ? tour.individual : null;
  return {
    id: clip(tour.id, 120),
    title: clip(tour.title, 180),
    city: clip(tour.city, 100),
    region: clip(tour.region, 100),
    category: clip(tour.category, 100),
    duration: clip(tour.duration, 80),
    time: clip(tour.time, 120),
    activity: clip(tour.activity, 80),
    tags: list(tour.tags, 8, 40),
    audience: list(tour.audience, 8, 50),
    childrenOk: Boolean(tour.childrenOk),
    included: list(tour.included, 12, 180),
    take: list(tour.take, 12, 180),
    route: (Array.isArray(tour.route) ? tour.route : []).slice(0, 10).map(item => Array.isArray(item)
      ? [clip(item[0], 120), clip(item[1], 260)]
      : clip(item, 300)),
    group: group ? {
      from: clip(group.from, 80),
      adult: clip(group.adult || group.from, 80),
      child: clip(group.child, 80),
      infant: clip(group.infant, 120),
      deposit: clip(group.deposit, 80),
      notes: list(group.notes, 10, 220),
      departures: (Array.isArray(group.departures) ? group.departures : []).slice(0, 10).map(item => ({
        date: clip(item?.date, 50),
        time: clip(item?.time, 30),
        taken: Math.max(0, Number(item?.taken) || 0),
        capacity: Math.max(0, Number(item?.capacity) || 0),
        status: clip(item?.status, 80),
      })),
    } : null,
    individual: individual ? {
      from: clip(individual.from, 80),
      deposit: clip(individual.deposit, 80),
      tiers: list(individual.tiers, 10, 160),
      notes: list(individual.notes, 10, 220),
    } : null,
  };
}

function titleTokens(title) {
  return norm(title).split(/[^a-zа-я0-9]+/i).filter(token => token.length >= 4);
}

export function findTourForQuestion(message, catalog = [], options = {}) {
  const context = options.context && typeof options.context === 'object' ? options.context : {};
  const directId = clip(context.tourId || context.selectedTourId, 120);
  if (directId) {
    const byId = catalog.find(item => String(item?.id) === directId);
    if (byId) return byId;
  }

  const history = (Array.isArray(options.history) ? options.history : []).slice(-6)
    .map(item => clip(item?.text || item?.content, 500)).join(' ');
  const current = norm(message);
  const combined = norm(`${history} ${message}`);
  let best = null;
  let bestScore = 0;

  for (const tour of catalog) {
    const title = norm(tour?.title);
    if (!title) continue;
    let score = 0;
    if (current.includes(title)) score += 120;
    const tokens = titleTokens(tour.title);
    const currentHits = tokens.filter(token => current.includes(token)).length;
    const combinedHits = tokens.filter(token => combined.includes(token)).length;
    score += currentHits * 25 + Math.max(0, combinedHits - currentHits) * 5;
    if (/далат/.test(current) && /далат/.test(title)) score += 12;
    if (/премиум/.test(current) && /премиум/.test(title)) score += 35;
    if (/вип|vip/.test(current) && /вип|vip/.test(title)) score += 35;
    if (score > bestScore) { best = tour; bestScore = score; }
  }
  return bestScore >= 25 ? best : null;
}

function noteMatching(items, regex) {
  return (Array.isArray(items) ? items : []).find(item => regex.test(String(item || ''))) || '';
}

function joinNatural(items, max = 6) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean).slice(0, max);
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(', ')} и ${values.at(-1)}`;
}

export function deterministicFaqReply(message, catalog = [], options = {}) {
  const q = norm(message);
  if (!q) return null;
  const tour = findTourForQuestion(message, catalog, options);
  const tourName = tour?.title ? `«${tour.title}»` : 'этой экскурсии';

  if (/amiana|амиан/.test(q) && /(трансфер|забер|отел|доплат|встреч)/.test(q)) {
    return { intent:'transfer_hotel', tourId:tour?.id || '', reply:`Да, из Amiana забираем с доплатой. ${MAX_TOUR_GLOBAL_FACTS.amianaTransfer} Если напишете состав группы, сразу скажу точную доплату.` };
  }

  if (tour && /(во сколько|время выезд|когда выезд|вернем|вернём|возвращ|финиш|начина)/.test(q) && tour.time) {
    return { intent:'schedule', tourId:tour.id, reply:`По ${tourName}: ${tour.time}. Если хотите, дальше проверю ближайшую доступную дату для вашего состава.` };
  }

  if (tour && /(что входит|входит в стоимость|что включ|включено|включены)/.test(q)) {
    const included = joinNatural(tour.included, 7);
    if (included) return { intent:'included', tourId:tour.id, reply:`В стоимость ${tourName} входят: ${included}. Могу также подсказать, что взять с собой и какие есть доплаты.` };
  }

  if (tour && /(ребен|ребён|детск|малыш|до\s*100\s*см|110\s*см|120\s*см|рост)/.test(q)) {
    const parts = [];
    if (tour.group?.child) parts.push(`детский тариф — ${tour.group.child}`);
    if (tour.group?.infant) parts.push(tour.group.infant);
    if (parts.length) return { intent:'child_price', tourId:tour.id, reply:`Для ${tourName}: ${parts.join('; ')}. Если укажете рост/возраст каждого ребёнка, я посчитаю состав без лишних уточнений.` };
  }

  if (tour && /(русск|язык.*гид|гид.*язык|какой гид|сколько человек|размер групп|человек.*групп)/.test(q)) {
    const guide = noteMatching(tour.included, /русск|гид/i) || noteMatching(tour.group?.notes, /русск|гид/i);
    const groupSize = noteMatching(tour.group?.notes, /групп.*\d|\d+.*человек/i);
    const details = [guide, groupSize].filter(Boolean);
    if (details.length) return { intent:'guide_group', tourId:tour.id, reply:`По ${tourName}: ${details.join('; ')}. Если важна небольшая группа, могу сравнить с индивидуальным форматом.` };
  }

  if (/(оплат|депозит|предоплат|карто|налич|перевод|валют)/.test(q)) {
    const deposit = tour?.group?.deposit || tour?.individual?.deposit || '30% или 100%';
    return { intent:'payment', tourId:tour?.id || '', reply:`Можно внести депозит ${deposit} либо полную оплату. Доступны наличные, карта и перевод в рублях, тенге, долларах и других валютах; конкретный способ выбирается при оформлении.` };
  }

  if (/перенос/.test(q)) {
    return { intent:'reschedule', tourId:tour?.id || '', reply:`${MAX_TOUR_GLOBAL_FACTS.reschedule} Если напишете дату и время выезда, я применю правило к вашей поездке.` };
  }

  if (/отмен|возврат/.test(q) && !/(погод|шторм|дожд|форс)/.test(q)) {
    return { intent:'cancellation', tourId:tour?.id || '', reply:`${MAX_TOUR_GLOBAL_FACTS.cancellation} Если речь о конкретной поездке, назовите дату/время — скажу, какое правило действует сейчас.` };
  }

  if (/(погод|дожд|шторм|тайфун|форс.?мажор|опасн.*погод)/.test(q)) {
    return { intent:'weather_force_majeure', tourId:tour?.id || '', reply:`${MAX_TOUR_GLOBAL_FACTS.forceMajeure} Обычный дождь сам по себе не означает автоматическую отмену — решение зависит от безопасности маршрута.` };
  }

  if (tour && /(что взять|взять с собой|одежд|обув|дождевик|кофт)/.test(q)) {
    const take = joinNatural(tour.take, 7);
    if (take) return { intent:'what_to_take', tourId:tour.id, reply:`На ${tourName} рекомендуем: ${take}.` };
  }

  if (/(вегетари|аллерг|морепродукт|без глютен|питани)/.test(q)) {
    return { intent:'dietary', tourId:tour?.id || '', reply:'В опубликованной карточке специальное питание и меню при аллергиях не гарантированы. Укажите пожелание при оформлении; при сильной аллергии обязательно перечислите продукты, которые нужно исключить, чтобы это подтвердили до поездки.' };
  }

  if (tour && /(пожил|72\s*год|70\s*лет|маме|папе|тяжело|нагрузк|ходить)/.test(q)) {
    const time = tour.time ? `День длительный: ${tour.time}. ` : '';
    const activity = tour.activity ? `Уровень активности — ${tour.activity}. ` : '';
    const individual = tour.individual ? 'Если важен более спокойный темп, индивидуальный формат позволяет сделать маршрут комфортнее.' : 'Если есть ограничения по ходьбе, лучше заранее уточнить конкретные точки маршрута.';
    return { intent:'senior_load', tourId:tour.id, reply:`${time}${activity}${individual}`.trim() };
  }

  if (tour && /коляск/.test(q)) {
    return { intent:'stroller', tourId:tour.id, reply:`Для ${tourName} в карточке нет подтверждения полной доступности с коляской, поэтому обещать её нельзя. Укажите коляску при оформлении; если отсутствие ступеней принципиально, это нужно подтвердить до оплаты.` };
  }

  if (tour && /(индив|своей компанией|частн)/.test(q) && /(сколько|стоим|цен|маршрут|измен|помен)/.test(q)) {
    const tiers = joinNatural(tour.individual?.tiers, 8);
    const notes = joinNatural(tour.individual?.notes, 4);
    if (tiers || notes) return { intent:'individual', tourId:tour.id, reply:`Индивидуально ${tourName}: ${tiers || `от ${tour.individual?.from || 'цена уточняется'}`}.${notes ? ` ${notes}.` : ''}` };
  }

  return null;
}
