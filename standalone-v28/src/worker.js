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

async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}
const travelerKey = t => `${String(t.fullName || '').trim().toLowerCase()}|${String(t.birthDate || '').trim()}`;

async function replaceFavorites(env, sid, ids) {
  const normalized = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean))];
  const statements = [env.DB.prepare('DELETE FROM favorites WHERE session_id=?').bind(sid)];
  for (const id of normalized) statements.push(env.DB.prepare('INSERT INTO favorites(session_id,tour_id) VALUES(?,?)').bind(sid, id));
  await env.DB.batch(statements);
  return normalized;
}

async function upsertTravelers(env, sid, travelers) {
  for (const t of Array.isArray(travelers) ? travelers : []) {
    if (!String(t.fullName || '').trim() || !String(t.birthDate || '').trim()) continue;
    const key = travelerKey(t);
    await env.DB.prepare(`INSERT INTO travelers(session_id,traveler_key,role,label,full_name,birth_date,primary_flag)
      VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,traveler_key) DO UPDATE SET
      role=excluded.role,label=excluded.label,full_name=excluded.full_name,birth_date=excluded.birth_date,
      primary_flag=CASE WHEN travelers.primary_flag=1 THEN 1 ELSE excluded.primary_flag END,updated_at=CURRENT_TIMESTAMP`)
      .bind(sid, key, String(t.role || 'adult'), String(t.label || 'Попутчик'), String(t.fullName).trim(), String(t.birthDate), t.primary ? 1 : 0).run();
  }
}

async function saveBooking(env, sid, trip) {
  if (!trip?.id || !trip?.tourId || !trip?.title || !trip?.date) throw new Error('Invalid booking payload');
  await upsertTravelers(env, sid, trip.travelers || []);
  await env.DB.prepare(`INSERT INTO bookings(id,session_id,tour_id,title,trip_date,trip_time,status,paid,rest,total,booking_type,receipt,paid_at,people,image,rules,payload_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,status=excluded.status,updated_at=CURRENT_TIMESTAMP`)
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
      await env.DB.prepare('UPDATE bookings SET status=?, payload_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND session_id=?')
        .bind(String(trip.status || ''), JSON.stringify(trip), id, session.id).run();
      response = json({ ok:true, booking:trip });
    }
  } else if (url.pathname === '/api/admin/tours' && request.method === 'POST') {
    const payload = await bodyJson(request) || {};
    const id = String(payload.id || `custom-${Date.now()}`).replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const tour = { ...payload, id };
    if (!String(tour.title || '').trim()) return withSession(json({ ok:false, error:'title_required' }, { status:400 }), session);
    await env.DB.prepare(`INSERT INTO admin_tours(id,payload_json) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`).bind(id, JSON.stringify(tour)).run();
    response = json({ ok:true, tour });
  } else if (url.pathname === '/api/admin/events' && request.method === 'POST') {
    const payload = await bodyJson(request) || {};
    await env.DB.prepare('INSERT INTO admin_events(session_id,event_type,payload_json) VALUES(?,?,?)').bind(session.id, String(payload.type || 'event'), JSON.stringify(payload)).run();
    response = json({ ok:true });
  } else if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
    const counts = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM bookings) bookings,
      (SELECT COUNT(*) FROM travelers) travelers,
      (SELECT COUNT(*) FROM admin_events) events,
      (SELECT COUNT(*) FROM admin_tours) custom_tours`).first();
    response = json({ ok:true, ...counts });
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
      return await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ ok:false, error:'internal_error', message:String(error?.message || error) }, { status:500 });
    }
  },
};
