import { handleAdminApi } from './admin-api.js';

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers || {}) },
});

function parseCookie(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return i < 0 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
  }));
}

async function ensureSession(request, env) {
  const cookies = parseCookie(request.headers.get('cookie') || '');
  const existing = /^[a-f0-9-]{20,64}$/i.test(cookies.mt_v28_sid || '') ? cookies.mt_v28_sid : null;
  const id = existing || crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO sessions(id) VALUES(?) ON CONFLICT(id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP`).bind(id).run();
  return { id, fresh: !existing };
}

function withSession(response, session) {
  if (!session?.fresh) return response;
  const headers = new Headers(response.headers);
  headers.append('set-cookie', `mt_v28_sid=${encodeURIComponent(session.id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function secureAdminAsset(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'same-origin');
  headers.set('content-security-policy', "default-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}

const travelerKey = t => `${String(t.fullName || '').trim().toLowerCase()}|${String(t.birthDate || '').trim()}`;

function normalizeTravelers(travelers) {
  const clean = [];
  const seen = new Set();
  for (const item of Array.isArray(travelers) ? travelers : []) {
    const fullName = String(item?.fullName || '').trim();
    const birthDate = String(item?.birthDate || '').trim();
    if (!fullName || !birthDate) continue;
    const key = `${fullName.toLowerCase()}|${birthDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({
      role: String(item?.role || 'adult'),
      label: String(item?.label || 'Попутчик'),
      fullName,
      birthDate,
      primary: !!item?.primary,
    });
  }
  let primaryIndex = clean.findIndex(t => t.primary && t.role === 'adult');
  if (primaryIndex < 0) primaryIndex = clean.findIndex(t => t.role === 'adult');
  if (primaryIndex < 0 && clean.length) primaryIndex = 0;
  clean.forEach((t, index) => {
    t.primary = index === primaryIndex;
    if (t.primary) t.label = 'Основной путешественник';
    else if (t.role === 'adult') t.label = 'Попутчик · взрослый';
    else if (t.role === 'child') t.label = 'Попутчик · ребёнок';
    else t.label = 'Попутчик · малыш';
  });
  return clean;
}

async function replaceFavorites(env, sid, ids) {
  const normalized = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  const statements = [env.DB.prepare('DELETE FROM favorites WHERE session_id=?').bind(sid)];
  for (const id of normalized) statements.push(env.DB.prepare('INSERT INTO favorites(session_id,tour_id) VALUES(?,?)').bind(sid, id));
  await env.DB.batch(statements);
  return normalized;
}

async function upsertTravelers(env, sid, travelers) {
  const normalized = normalizeTravelers(travelers);
  if (normalized.some(t => t.primary)) {
    await env.DB.prepare('UPDATE travelers SET primary_flag=0, updated_at=CURRENT_TIMESTAMP WHERE session_id=?').bind(sid).run();
  }
  for (const t of normalized) {
    const key = travelerKey(t);
    await env.DB.prepare(`INSERT INTO travelers(session_id,traveler_key,role,label,full_name,birth_date,primary_flag)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,traveler_key) DO UPDATE SET
      role=excluded.role,label=excluded.label,full_name=excluded.full_name,birth_date=excluded.birth_date,
      primary_flag=excluded.primary_flag,updated_at=CURRENT_TIMESTAMP`)
      .bind(sid, key, t.role, t.label, t.fullName, t.birthDate, t.primary ? 1 : 0).run();
  }
  return normalized;
}

async function replaceTravelers(env, sid, travelers) {
  const normalized = normalizeTravelers(travelers);
  const statements = [env.DB.prepare('DELETE FROM travelers WHERE session_id=?').bind(sid)];
  for (const t of normalized) {
    statements.push(env.DB.prepare(`INSERT INTO travelers(session_id,traveler_key,role,label,full_name,birth_date,primary_flag)
      VALUES(?,?,?,?,?,?,?)`).bind(sid, travelerKey(t), t.role, t.label, t.fullName, t.birthDate, t.primary ? 1 : 0));
  }
  await env.DB.batch(statements);
  return normalized;
}

async function saveBooking(env, sid, trip) {
  if (!trip?.id || !trip?.tourId || !trip?.title || !trip?.date) throw new Error('Invalid booking payload');
  await upsertTravelers(env, sid, trip.travelers || []);
  await env.DB.prepare(`INSERT INTO bookings(id,session_id,tour_id,title,trip_date,trip_time,status,paid,rest,total,booking_type,receipt,paid_at,people,image,rules,payload_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
      tour_id=excluded.tour_id,title=excluded.title,trip_date=excluded.trip_date,trip_time=excluded.trip_time,
      status=excluded.status,paid=excluded.paid,rest=excluded.rest,total=excluded.total,booking_type=excluded.booking_type,
      receipt=excluded.receipt,paid_at=excluded.paid_at,people=excluded.people,image=excluded.image,rules=excluded.rules,
      payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`)
    .bind(String(trip.id), sid, String(trip.tourId), String(trip.title), String(trip.date), String(trip.time || ''), String(trip.status || ''), String(trip.paid || '$0'), String(trip.rest || '$0'), String(trip.total || '$0'), String(trip.type || ''), String(trip.receipt || ''), String(trip.paidAt || ''), String(trip.people || ''), String(trip.image || ''), String(trip.rules || ''), JSON.stringify(trip)).run();
}

async function bootstrap(env, sid) {
  const [favs, travelers, bookings, customTours] = await Promise.all([
    env.DB.prepare('SELECT tour_id FROM favorites WHERE session_id=? ORDER BY created_at').bind(sid).all(),
    env.DB.prepare('SELECT role,label,full_name,birth_date,primary_flag FROM travelers WHERE session_id=? ORDER BY primary_flag DESC, created_at').bind(sid).all(),
    env.DB.prepare('SELECT payload_json FROM bookings WHERE session_id=? ORDER BY created_at DESC').bind(sid).all(),
    env.DB.prepare('SELECT payload_json FROM admin_tours ORDER BY created_at DESC').all(),
  ]);
  return {
    favorites: favs.results.map(r => r.tour_id),
    travelers: travelers.results.map(r => ({ role:r.role, label:r.label, fullName:r.full_name, birthDate:r.birth_date, primary:!!r.primary_flag })),
    bookings: bookings.results.map(r => JSON.parse(r.payload_json)),
    customTours: customTours.results.map(r => JSON.parse(r.payload_json)),
    hasData: favs.results.length > 0 || travelers.results.length > 0 || bookings.results.length > 0,
  };
}

async function api(request, env, url) {
  if (url.pathname === '/api/health') return json({ ok:true, app:'max-tour-v28-standalone', database:'D1', env:env.APP_ENV || 'demo' });
  const adminResponse = await handleAdminApi(request, env, url);
  if (adminResponse) return adminResponse;
  const session = await ensureSession(request, env);
  let response;

  if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
    response = json({ ok:true, ...(await bootstrap(env, session.id)) });
  } else if (url.pathname === '/api/bootstrap' && request.method === 'POST') {
    const payload = await bodyJson(request) || {};
    const current = await bootstrap(env, session.id);
    if (!current.hasData) {
      await replaceFavorites(env, session.id, payload.favorites || []);
      await upsertTravelers(env, session.id, payload.travelers || []);
      for (const trip of Array.isArray(payload.bookings) ? payload.bookings : []) await saveBooking(env, session.id, trip);
    }
    response = json({ ok:true, ...(await bootstrap(env, session.id)) });
  } else if (url.pathname === '/api/favorites' && request.method === 'PUT') {
    const payload = await bodyJson(request) || {};
    response = json({ ok:true, favorites:await replaceFavorites(env, session.id, payload.favorites) });
  } else if (url.pathname === '/api/travelers' && request.method === 'PUT') {
    const payload = await bodyJson(request) || {};
    response = json({ ok:true, travelers:await replaceTravelers(env, session.id, payload.travelers || []) });
  } else if (url.pathname === '/api/bookings' && request.method === 'POST') {
    const payload = await bodyJson(request);
    await saveBooking(env, session.id, payload);
    response = json({ ok:true });
  } else if (url.pathname.startsWith('/api/bookings/') && request.method === 'PATCH') {
    const id = decodeURIComponent(url.pathname.slice('/api/bookings/'.length));
    const payload = await bodyJson(request) || {};
    const row = await env.DB.prepare('SELECT payload_json FROM bookings WHERE id=? AND session_id=?').bind(id, session.id).first();
    if (!row) response = json({ ok:false, error:'booking_not_found' }, { status:404 });
    else {
      const trip = { ...JSON.parse(row.payload_json), ...payload };
      await env.DB.prepare(`UPDATE bookings SET trip_date=?,trip_time=?,status=?,paid=?,rest=?,total=?,payload_json=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND session_id=?`)
        .bind(String(trip.date || ''), String(trip.time || ''), String(trip.status || ''), String(trip.paid || '$0'), String(trip.rest || '$0'), String(trip.total || '$0'), JSON.stringify(trip), id, session.id).run();
      response = json({ ok:true, booking:trip });
    }
  } else {
    response = json({ ok:false, error:'not_found' }, { status:404 });
  }
  return withSession(response, session);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/api/')) return await api(request, env, url);
      if (url.pathname === '/admin') return Response.redirect(new URL('/admin/', url), 308);
      const asset = await env.ASSETS.fetch(request);
      return url.pathname.startsWith('/admin/') ? secureAdminAsset(asset) : asset;
    } catch (error) {
      console.error(error);
      return json({ ok:false, error:'internal_error' }, { status:500 });
    }
  },
};
