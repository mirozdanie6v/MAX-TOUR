import baseWorker from './worker.js';

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
  return new Response(response.body, { status:response.status, statusText:response.statusText, headers });
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/travelers' && request.method === 'PUT') {
      try {
        const session = await ensureSession(request, env);
        const payload = await request.json().catch(() => ({}));
        const travelers = await replaceTravelers(env, session.id, payload.travelers || []);
        return withSession(json({ ok:true, travelers }), session);
      } catch (error) {
        console.error(error);
        return json({ ok:false, error:'internal_error', message:String(error?.message || error) }, { status:500 });
      }
    }
    return baseWorker.fetch(request, env);
  },
};
