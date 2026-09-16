const clean = (value, max = 1200) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const norm = value => clean(value, 2400).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

const CITY_PATTERNS = [
  ['Нячанг', /(?:нячанг|на-?чанг|nha\s*trang)/iu],
  ['Ханой', /(?:ханой|ханое|hanoi)/iu],
  ['Дананг', /(?:дананг|да-?нанг|da\s*nang)/iu],
  ['Фукуок', /(?:фу\s*куок|фукуок|phu\s*quoc)/iu],
  ['Далат', /(?:далат|da\s*lat)/iu],
  ['Хойан', /(?:хой\s*ан|хойан|hoi\s*an)/iu],
  ['Муйне/Фантьет', /(?:муй\s*не|муйне|фан\s*тьет|фантьет|mui\s*ne|phan\s*thiet)/iu],
];

function cityFrom(value) {
  const text = clean(value, 1200);
  return CITY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || '';
}

export function isCityOverviewIntent(message) {
  const q = norm(message);
  if (!q) return false;
  return /обзорн|обзор\s+(?:города|нячанг|ханоя|дананг|фукуок)|(?:экскурс|тур)[^.!?]{0,35}(?:по\s+городу|городск)|городск[^.!?]{0,35}(?:экскурс|тур)|достопримечательност|посмотр(?:еть|им)[^.!?]{0,25}город/.test(q);
}

function tourText(tour) {
  return norm(`${tour?.id || ''} ${tour?.title || ''} ${tour?.city || ''} ${tour?.region || ''} ${tour?.category || ''} ${(tour?.tags || []).join(' ')} ${(tour?.audience || []).join(' ')} ${tour?.searchText || ''} ${(tour?.route || []).flat().join(' ')}`);
}

function overviewScore(tour, city, candidateIds = []) {
  const hay = tourText(tour);
  let score = 0;
  const cityToken = norm(city).split('/')[0];
  if (cityToken) {
    if (norm(tour?.city) === norm(city) || norm(tour?.region) === norm(city)) score += 90;
    else if (hay.includes(cityToken)) score += 45;
    else score -= 80;
  }
  if (candidateIds.includes(String(tour?.id))) score += 16;
  if (/обзор|город|city|достопримеч|храм|пагод|собор|рынок/.test(hay)) score += 45;
  if (/днев|day/.test(hay)) score += 14;
  if (/вечер|ноч|night/.test(hay)) score += 4;
  if (/остров|сноркл|дайв|пляж|катамаран/.test(hay) && !/город|обзор/.test(hay)) score -= 35;
  if (/трансфер|fast\s*track|аэропорт/.test(hay)) score -= 50;
  if (Number(tour?.popular)) score += 2;
  return score;
}

export function chooseCityOverviewTour(catalog, city, candidateIds = []) {
  if (!Array.isArray(catalog) || !catalog.length) return null;
  const ids = (Array.isArray(candidateIds) ? candidateIds : []).map(String);
  const ranked = catalog
    .map(tour => ({ tour, score:overviewScore(tour, city, ids) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.score > 20 ? ranked[0].tour : null;
}

async function loadCatalog(request, env) {
  if (!env?.ASSETS) return [];
  try {
    const response = await env.ASSETS.fetch(new Request(new URL('/catalog.v28.json', request.url)));
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function totalPeople(memory = {}) {
  return Math.max(0, Number(memory.adults) || 0) + (Array.isArray(memory.children) ? memory.children.length : 0) + Math.max(0, Number(memory.infants) || 0);
}

function replyFor(tour, memory = {}, city = '') {
  const title = clean(tour?.title, 180) || 'обзорная экскурсия';
  const place = city || clean(tour?.city || tour?.region, 80) || 'городу';
  const intro = `Подходит «${title}» — обзорная программа по ${place}.`;
  if (!totalPeople(memory)) return `${intro} Сколько человек едет?`;
  if (!memory.date) return `${intro} На какую дату планируете поездку?`;
  if (!memory.format && tour?.group && tour?.individual) return `${intro} Хотите групповой или индивидуальный формат?`;
  return `${intro} Можно открыть карточку ниже и перейти к бронированию.`;
}

function quickReplies(memory = {}, tour = null) {
  if (!totalPeople(memory)) return ['2 взрослых', '2 взрослых и ребёнок'];
  if (!memory.date) return ['Сегодня', 'Завтра', 'Дата гибкая'];
  if (!memory.format && tour?.group && tour?.individual) return ['Групповой', 'Индивидуальный'];
  return [];
}

export async function polishCityOverviewResponse(request, env, url, response) {
  if (url.pathname !== '/api/ai/chat' || request.method !== 'POST') return response;
  const body = await request.clone().json().catch(() => ({}));
  if (!isCityOverviewIntent(body?.message)) return response;

  const contentType = response?.headers?.get?.('content-type') || '';
  if (!response?.ok || !contentType.includes('application/json')) return response;
  const payload = await response.clone().json().catch(() => null);
  if (!payload?.ok || payload?.source !== 'ai-orchestrator-v23') return response;

  const memory = payload.memory && typeof payload.memory === 'object' ? payload.memory : {};
  const city = clean(memory.origin, 100) || cityFrom(memory.destination) || cityFrom(body?.context?.destination) || cityFrom(body?.message);
  const catalog = await loadCatalog(request, env);
  const tour = chooseCityOverviewTour(catalog, city, payload.tourIds || []);
  if (!tour?.id) return response;

  const tourId = String(tour.id);
  const tourIds = [tourId, ...(Array.isArray(payload.tourIds) ? payload.tourIds.map(String) : []).filter(id => id !== tourId)].slice(0, 3);
  const nextPayload = {
    ...payload,
    reply: replyFor(tour, memory, city),
    tourId,
    tourIds,
    nextStep: !totalPeople(memory) ? 'ask_party' : !memory.date ? 'ask_date' : (!memory.format && tour.group && tour.individual ? 'ask_format' : 'ready_to_book'),
    quickReplies: quickReplies(memory, tour),
    source: 'ai-orchestrator-v23+city-overview-v27',
  };

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(nextPayload), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const _test = { cityFrom, overviewScore, replyFor, totalPeople };
