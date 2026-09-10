const encoder = new TextEncoder();

const json = (data, init = {}) => new Response(JSON.stringify(data), {
  ...init,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(init.headers || {}) },
});

const bad = (error, status = 400) => json({ ok: false, error }, { status });
const nowIso = () => new Date().toISOString();
const addHours = hours => new Date(Date.now() + hours * 3600000).toISOString();

function parseCookie(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return i < 0 ? [part, ''] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
  }));
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  if (!/^[a-f0-9]+$/i.test(clean) || clean.length % 2) return new Uint8Array();
  return new Uint8Array(clean.match(/../g).map(v => Number.parseInt(v, 16)));
}

function randomHex(size = 32) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(size)));
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
}

async function passwordHash(password, saltHex, iterations = 210000) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations,
  }, key, 256);
  return bytesToHex(bits);
}

function timingSafeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) mismatch |= (left[i % (left.length || 1)] || 0) ^ (right[i % (right.length || 1)] || 0);
  return mismatch === 0;
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

const permissions = {
  manager: new Set(['read', 'booking.write', 'customer.write', 'message.write']),
  admin: new Set(['read', 'booking.write', 'customer.write', 'message.write', 'tour.write', 'notification.write', 'broadcast.write', 'departure.write']),
  owner: new Set(['read', 'booking.write', 'customer.write', 'message.write', 'tour.write', 'notification.write', 'broadcast.write', 'departure.write', 'user.write']),
};

function can(role, permission) {
  return permissions[role]?.has(permission) || false;
}

function sessionCookie(token, maxAge = 28800) {
  return `mt_admin_session=${encodeURIComponent(token)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function getAuth(request, env) {
  const token = parseCookie(request.headers.get('cookie') || '').mt_admin_session;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(`SELECT s.token_hash,s.csrf_token,s.expires_at,u.id,u.email,u.display_name,u.role,u.active
    FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP AND u.active=1`).bind(tokenHash).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE admin_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?').bind(tokenHash).run();
  return { tokenHash, csrf: row.csrf_token, user: { id: row.id, email: row.email, displayName: row.display_name, role: row.role } };
}

async function requireAuth(request, env, permission = 'read') {
  const auth = await getAuth(request, env);
  if (!auth) return { response: bad('unauthorized', 401) };
  if (!can(auth.user.role, permission)) return { response: bad('forbidden', 403) };
  if (!['GET', 'HEAD'].includes(request.method) && !timingSafeEqual(request.headers.get('x-csrf-token') || '', auth.csrf)) {
    return { response: bad('csrf_invalid', 403) };
  }
  return { auth };
}

async function audit(env, userId, action, entityType, entityId, payload = {}) {
  await env.DB.prepare(`INSERT INTO admin_audit_log(user_id,action,entity_type,entity_id,payload_json)
    VALUES(?,?,?,?,?)`).bind(userId, action, entityType, String(entityId), JSON.stringify(payload)).run();
}

function numberFromMoney(value, rate = 100) {
  const raw = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const amount = Number.parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0;
  return raw.includes('$') ? Math.round(amount * rate) : Math.round(amount);
}

function bookingMoneyFromRubles(value, existing, rate = 100) {
  if (value == null || value === '') return String(existing ?? '');
  const rubles = Math.max(0, Number(value) || 0);
  if (String(existing || '').includes('$')) {
    const dollars = rubles / rate;
    return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
  }
  if (String(existing || '').includes('₽')) return `${Math.round(rubles)} ₽`;
  return String(Math.round(rubles));
}

function peopleCount(value, travelers = []) {
  if (Array.isArray(travelers) && travelers.length) return travelers.length;
  const numbers = String(value || '').match(/\d+/g)?.map(Number) || [];
  return numbers.reduce((sum, n) => sum + n, 0);
}

function safePayload(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function displayDate(iso) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? new Date(`${iso}T00:00:00Z`) : null;
  return date && !Number.isNaN(date.valueOf())
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date)
    : String(iso || '—');
}

function initials(name) {
  return String(name || 'Клиент').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
}

function paymentStatus(paid, total, status) {
  if (/отмен|возврат/i.test(status)) return 'Возврат';
  if (total > 0 && paid >= total) return 'Оплачено 100%';
  if (paid > 0) return 'Депозит';
  return 'Ждёт оплаты';
}

async function getCatalog(env) {
  let canonical = [];
  try {
    const response = await env.ASSETS.fetch(new Request('https://assets.local/catalog.v28.json'));
    if (response.ok) canonical = await response.json();
  } catch {}
  const custom = await env.DB.prepare('SELECT payload_json FROM admin_tours ORDER BY updated_at DESC').all();
  const map = new Map((Array.isArray(canonical) ? canonical : []).map(t => [String(t.id), t]));
  for (const row of custom.results || []) {
    const tour = safePayload(row.payload_json);
    if (tour.id) map.set(String(tour.id), { ...(map.get(String(tour.id)) || {}), ...tour });
  }
  return [...map.values()];
}

async function buildBootstrap(env) {
  const rate = Number(env.ADMIN_USD_RUB_RATE || 100) || 100;
  const [bookingsResult, travelersResult, profilesResult, rulesResult, messagesResult, broadcastsResult, catalog] = await Promise.all([
    env.DB.prepare('SELECT * FROM bookings ORDER BY trip_date,created_at DESC').all(),
    env.DB.prepare('SELECT session_id,role,label,full_name,birth_date,primary_flag FROM travelers ORDER BY session_id,primary_flag DESC,created_at').all(),
    env.DB.prepare('SELECT * FROM admin_customer_profiles').all(),
    env.DB.prepare('SELECT * FROM admin_notification_rules ORDER BY rowid').all(),
    env.DB.prepare('SELECT id,booking_id,customer_session_id,channel,subject,body,status,created_at FROM admin_messages ORDER BY created_at DESC LIMIT 50').all(),
    env.DB.prepare('SELECT id,segment,body,status,recipient_count,created_at FROM admin_broadcasts ORDER BY created_at DESC LIMIT 50').all(),
    getCatalog(env),
  ]);

  const travelerMap = new Map();
  for (const row of travelersResult.results || []) {
    if (!travelerMap.has(row.session_id)) travelerMap.set(row.session_id, []);
    travelerMap.get(row.session_id).push({ name: row.full_name, birthDate: row.birth_date, label: row.label, role: row.role, primary: !!row.primary_flag });
  }
  const profileMap = new Map((profilesResult.results || []).map(row => [row.session_id, row]));
  const sessionOrders = new Map();
  const orders = (bookingsResult.results || []).map(row => {
    const payload = safePayload(row.payload_json);
    const travelers = travelerMap.get(row.session_id) || [];
    const primary = travelers.find(t => t.primary) || travelers[0];
    const profile = profileMap.get(row.session_id) || {};
    const total = numberFromMoney(row.total, rate);
    const paid = numberFromMoney(row.paid, rate);
    const rest = Math.max(0, numberFromMoney(row.rest, rate));
    const order = {
      id: row.id, sessionId: row.session_id, customer: primary?.name || 'Клиент без ФИО',
      username: profile.username || '', phone: profile.phone || '', source: profile.source || 'Mini App',
      tourId: row.tour_id, tour: row.title, iso: row.trip_date, date: displayDate(row.trip_date), time: row.trip_time || '',
      city: payload.city || payload.destination || '', type: row.booking_type || '', people: row.people || '',
      peopleCount: peopleCount(row.people, payload.travelers), paid, total, guideDue: rest,
      paymentStatus: paymentStatus(paid, total, row.status), method: payload.paymentMethod || payload.method || 'Не указан',
      orderStatus: row.status || 'Новый', action: /жд|нуж|нов/i.test(row.status || '') || paid < total,
      travelers: travelers.map(t => [t.name, t.birthDate, t.label]), updatedAt: row.updated_at,
    };
    if (!sessionOrders.has(row.session_id)) sessionOrders.set(row.session_id, []);
    sessionOrders.get(row.session_id).push(order);
    return order;
  });

  const sessions = new Set([...travelerMap.keys(), ...profileMap.keys(), ...sessionOrders.keys()]);
  const customers = [...sessions].map(sessionId => {
    const travelers = travelerMap.get(sessionId) || [];
    const primary = travelers.find(t => t.primary) || travelers[0];
    const profile = profileMap.get(sessionId) || {};
    const customerOrders = sessionOrders.get(sessionId) || [];
    const active = customerOrders.find(o => !/отмен|заверш/i.test(o.orderStatus));
    const lifetime = customerOrders.reduce((sum, o) => sum + o.paid, 0);
    const status = profile.status || active?.paymentStatus || 'Без активной поездки';
    return {
      id: sessionId, name: primary?.name || 'Клиент без ФИО', initials: initials(primary?.name),
      username: profile.username || '', phone: profile.phone || '', source: profile.source || 'Mini App',
      segment: profile.segment || (active ? 'Есть активная поездка' : 'Без активной поездки'),
      activeTrip: active ? `${active.tour} · ${active.date}` : 'Нет активной поездки', status,
      travelers: travelers.length, trips: customerOrders.length, lifetime, notes: profile.notes || '',
    };
  });

  const departureMap = new Map();
  for (const order of orders) {
    const key = `${order.tourId}|${order.iso}|${order.time}|${order.type}`;
    if (!departureMap.has(key)) departureMap.set(key, {
      id: `dep-${await sha256Hex(key).then(x => x.slice(0, 12))}`, tour: order.tour, date: order.date, iso: order.iso,
      time: order.time || 'Время не указано', city: order.city, type: /индив/i.test(order.type) ? 'individual' : 'group',
      manager: 'Не назначен', status: order.orderStatus, action: false, capacity: 0, booked: 0, min: 0, waitlist: 0,
      transport: 'Не назначен', payments: { fullOrders: 0, fullTravelers: 0, depositOrders: 0, depositTravelers: 0, pendingOrders: 0, pendingTravelers: 0, online: 0, guideDue: 0, refund: 0 },
      notes: '', orders: [],
    });
    const dep = departureMap.get(key);
    dep.orders.push(order.id);
    dep.booked += order.peopleCount;
    dep.payments.online += order.paid;
    dep.payments.guideDue += order.guideDue;
    if (order.paymentStatus.includes('100')) { dep.payments.fullOrders += 1; dep.payments.fullTravelers += order.peopleCount; }
    else if (order.paymentStatus.includes('Депозит')) { dep.payments.depositOrders += 1; dep.payments.depositTravelers += order.peopleCount; }
    else { dep.payments.pendingOrders += 1; dep.payments.pendingTravelers += order.peopleCount; dep.action = true; }
  }
  for (const dep of departureMap.values()) {
    const tour = catalog.find(t => String(t.id) === String(orders.find(o => dep.orders.includes(o.id))?.tourId));
    dep.capacity = Number(tour?.capacity || tour?.maxPeople || dep.booked || 1);
    dep.min = Number(tour?.minPeople || 1);
  }

  const received = orders.reduce((sum, o) => sum + o.paid, 0);
  const guideDue = orders.reduce((sum, o) => sum + o.guideDue, 0);
  const sources = Object.entries(orders.reduce((acc, o) => { acc[o.source] = (acc[o.source] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const popular = Object.entries(orders.reduce((acc, o) => { acc[o.tour] = (acc[o.tour] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  return {
    orders, customers, departures: [...departureMap.values()], catalog,
    notificationRules: (rulesResult.results || []).map(r => ({ key: r.rule_key, title: r.title, description: r.description, enabled: !!r.enabled, requiresConfirmation: !!r.requires_confirmation })),
    messages: messagesResult.results || [], broadcasts: broadcastsResult.results || [],
    analytics: { received, guideDue, orderCount: orders.length, customerCount: customers.length, sources, popular },
  };
}

async function authStatus(request, env) {
  const count = await env.DB.prepare('SELECT COUNT(*) count FROM admin_users').first();
  const auth = await getAuth(request, env);
  return json({ ok: true, setupRequired: Number(count?.count || 0) === 0, authenticated: !!auth, user: auth?.user || null, csrfToken: auth?.csrf || null });
}

async function setup(request, env) {
  const count = await env.DB.prepare('SELECT COUNT(*) count FROM admin_users').first();
  if (Number(count?.count || 0) > 0) return bad('setup_closed', 409);
  if (!env.ADMIN_SETUP_TOKEN) return bad('setup_not_configured', 503);
  const body = await readBody(request) || {};
  if (!timingSafeEqual(body.setupToken || '', env.ADMIN_SETUP_TOKEN)) return bad('setup_token_invalid', 403);
  const email = normalizeEmail(body.email);
  const displayName = String(body.displayName || '').trim();
  const password = String(body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || !displayName || password.length < 12) return bad('invalid_setup_data');
  const id = crypto.randomUUID();
  const salt = randomHex(16);
  const iterations = 210000;
  const hash = await passwordHash(password, salt, iterations);
  const created = await env.DB.prepare(`INSERT INTO admin_users(id,email,display_name,password_salt,password_hash,password_iterations,role)
    SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM admin_users)`).bind(id, email, displayName, salt, hash, iterations, 'admin').run();
  if (!created.meta?.changes) return bad('setup_closed', 409);
  await audit(env, id, 'setup', 'admin_user', id, { email, role: 'admin' });
  return json({ ok: true });
}

async function login(request, env) {
  const body = await readBody(request) || {};
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const ipHash = await sha256Hex(request.headers.get('cf-connecting-ip') || 'unknown');
  const attempts = await env.DB.prepare(`SELECT COUNT(*) count FROM admin_login_attempts
    WHERE email=? AND ip_hash=? AND succeeded=0 AND created_at>datetime('now','-15 minutes')`).bind(email, ipHash).first();
  if (Number(attempts?.count || 0) >= 5) return bad('login_rate_limited', 429);
  const user = await env.DB.prepare('SELECT * FROM admin_users WHERE email=? COLLATE NOCASE AND active=1').bind(email).first();
  const computed = user ? await passwordHash(password, user.password_salt, Number(user.password_iterations)) : await passwordHash(password, randomHex(16), 10000);
  const success = !!user && timingSafeEqual(computed, user.password_hash);
  await env.DB.prepare('INSERT INTO admin_login_attempts(email,ip_hash,succeeded) VALUES(?,?,?)').bind(email, ipHash, success ? 1 : 0).run();
  if (!success) return bad('credentials_invalid', 401);
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const csrf = randomHex(24);
  await env.DB.prepare(`INSERT INTO admin_sessions(token_hash,user_id,csrf_token,expires_at) VALUES(?,?,?,?)`).bind(tokenHash, user.id, csrf, addHours(8)).run();
  await audit(env, user.id, 'login', 'admin_user', user.id);
  return json({ ok: true, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role }, csrfToken: csrf }, { headers: { 'set-cookie': sessionCookie(token) } });
}

async function logout(request, env) {
  const checked = await requireAuth(request, env);
  if (checked.response) return checked.response;
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(checked.auth.tokenHash).run();
  return json({ ok: true }, { headers: { 'set-cookie': sessionCookie('', 0) } });
}

async function patchBooking(request, env, id) {
  const checked = await requireAuth(request, env, 'booking.write');
  if (checked.response) return checked.response;
  const body = await readBody(request) || {};
  const row = await env.DB.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();
  if (!row) return bad('booking_not_found', 404);
  const existing = safePayload(row.payload_json);
  const rate = Number(env.ADMIN_USD_RUB_RATE || 100) || 100;
  const allowed = {
    status: body.status ?? row.status, date: body.date ?? row.trip_date, time: body.time ?? row.trip_time,
    paid: bookingMoneyFromRubles(body.paid, row.paid, rate), rest: bookingMoneyFromRubles(body.rest, row.rest, rate),
    total: bookingMoneyFromRubles(body.total, row.total, rate), paymentMethod: body.paymentMethod ?? existing.paymentMethod,
    adminNote: body.adminNote ?? existing.adminNote,
  };
  const payload = { ...existing, ...allowed };
  await env.DB.prepare(`UPDATE bookings SET trip_date=?,trip_time=?,status=?,paid=?,rest=?,total=?,payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .bind(String(allowed.date), String(allowed.time || ''), String(allowed.status), String(allowed.paid), String(allowed.rest), String(allowed.total), JSON.stringify(payload), id).run();
  await audit(env, checked.auth.user.id, 'update', 'booking', id, allowed);
  return json({ ok: true });
}

async function patchCustomer(request, env, sessionId) {
  const checked = await requireAuth(request, env, 'customer.write');
  if (checked.response) return checked.response;
  const body = await readBody(request) || {};
  const clean = key => String(body[key] || '').trim().slice(0, key === 'notes' ? 4000 : 250);
  await env.DB.prepare(`INSERT INTO admin_customer_profiles(session_id,phone,username,source,segment,status,notes,updated_by)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET phone=excluded.phone,username=excluded.username,
    source=excluded.source,segment=excluded.segment,status=excluded.status,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
    .bind(sessionId, clean('phone'), clean('username'), clean('source') || 'Mini App', clean('segment'), clean('status'), clean('notes'), checked.auth.user.id).run();
  await audit(env, checked.auth.user.id, 'update', 'customer', sessionId, { phone: clean('phone'), segment: clean('segment'), status: clean('status') });
  return json({ ok: true });
}

async function putTour(request, env, id) {
  const checked = await requireAuth(request, env, 'tour.write');
  if (checked.response) return checked.response;
  const body = await readBody(request) || {};
  const safeId = String(id || body.id || '').replace(/[^a-z0-9_-]/gi, '-').toLowerCase().slice(0, 100);
  if (!safeId || !String(body.title || '').trim()) return bad('tour_invalid');
  const tour = { ...body, id: safeId, title: String(body.title).trim().slice(0, 250) };
  await env.DB.prepare(`INSERT INTO admin_tours(id,payload_json) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`).bind(safeId, JSON.stringify(tour)).run();
  await audit(env, checked.auth.user.id, 'update', 'tour', safeId, { title: tour.title });
  return json({ ok: true, tour });
}

async function createMessage(request, env) {
  const checked = await requireAuth(request, env, 'message.write');
  if (checked.response) return checked.response;
  const body = await readBody(request) || {};
  const text = String(body.body || '').trim();
  if (!text || text.length > 4000) return bad('message_invalid');
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO admin_messages(id,booking_id,customer_session_id,channel,subject,body,status,created_by)
    VALUES(?,?,?,?,?,?,?,?)`).bind(id, body.bookingId || null, body.customerSessionId || null, String(body.channel || 'telegram'), String(body.subject || '').slice(0, 250), text, 'queued', checked.auth.user.id).run();
  await audit(env, checked.auth.user.id, 'create', 'message', id, { bookingId: body.bookingId || null });
  return json({ ok: true, id, status: 'queued' }, { status: 201 });
}

async function patchRule(request, env, key) {
  const checked = await requireAuth(request, env, 'notification.write');
  if (checked.response) return checked.response;
  const body = await readBody(request) || {};
  const result = await env.DB.prepare('UPDATE admin_notification_rules SET enabled=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE rule_key=?')
    .bind(body.enabled ? 1 : 0, checked.auth.user.id, key).run();
  if (!result.meta?.changes) return bad('rule_not_found', 404);
  await audit(env, checked.auth.user.id, 'update', 'notification_rule', key, { enabled: !!body.enabled });
  return json({ ok: true });
}

async function createBroadcast(request, env) {
  const checked = await requireAuth(request, env, 'broadcast.write');
  if (checked.response) return checked.response;
  const body = await readBody(request) || {};
  const text = String(body.body || '').trim();
  const segment = String(body.segment || 'all').trim().slice(0, 100);
  if (!text || text.length > 4000) return bad('broadcast_invalid');
  const recipients = Number((await env.DB.prepare('SELECT COUNT(DISTINCT session_id) count FROM bookings').first())?.count || 0);
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO admin_broadcasts(id,segment,body,status,recipient_count,created_by) VALUES(?,?,?,?,?,?)`)
    .bind(id, segment, text, 'queued', recipients, checked.auth.user.id).run();
  await audit(env, checked.auth.user.id, 'create', 'broadcast', id, { segment, recipients });
  return json({ ok: true, id, status: 'queued', recipientCount: recipients }, { status: 201 });
}

export async function handleAdminApi(request, env, url = new URL(request.url)) {
  if (!url.pathname.startsWith('/api/admin/')) return null;
  const path = url.pathname;
  if (path === '/api/admin/auth/session' && request.method === 'GET') return authStatus(request, env);
  if (path === '/api/admin/auth/setup' && request.method === 'POST') return setup(request, env);
  if (path === '/api/admin/auth/login' && request.method === 'POST') return login(request, env);
  if (path === '/api/admin/auth/logout' && request.method === 'POST') return logout(request, env);

  if (path === '/api/admin/bootstrap' && request.method === 'GET') {
    const checked = await requireAuth(request, env);
    if (checked.response) return checked.response;
    return json({ ok: true, user: checked.auth.user, csrfToken: checked.auth.csrf, ...(await buildBootstrap(env)) });
  }
  const booking = path.match(/^\/api\/admin\/bookings\/([^/]+)$/);
  if (booking && request.method === 'PATCH') return patchBooking(request, env, decodeURIComponent(booking[1]));
  const customer = path.match(/^\/api\/admin\/customers\/([^/]+)$/);
  if (customer && request.method === 'PATCH') return patchCustomer(request, env, decodeURIComponent(customer[1]));
  const tour = path.match(/^\/api\/admin\/tours\/([^/]+)$/);
  if (tour && request.method === 'PUT') return putTour(request, env, decodeURIComponent(tour[1]));
  const rule = path.match(/^\/api\/admin\/notification-rules\/([^/]+)$/);
  if (rule && request.method === 'PATCH') return patchRule(request, env, decodeURIComponent(rule[1]));
  if (path === '/api/admin/messages' && request.method === 'POST') return createMessage(request, env);
  if (path === '/api/admin/broadcasts' && request.method === 'POST') return createBroadcast(request, env);
  return bad('not_found', 404);
}

export const _test = { passwordHash, timingSafeEqual, can, numberFromMoney, bookingMoneyFromRubles, paymentStatus, peopleCount };
