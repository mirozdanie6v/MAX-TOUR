import type { Env } from './repository';

const COOKIE = 'max_tour_demo_session';

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionCookie(id: string, secure = true): string {
  return `${COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=604800`;
}

async function seedDemoSession(env: Env, sessionId: string) {
  const availability = [
    ['dalat-premium','2026-09-10','available','доступно'],['dalat-premium','2026-09-12','low','мало мест'],['dalat-premium','2026-09-15','request','по запросу'],['dalat-premium','2026-09-18','available','доступно'],
    ['phuyen','2026-09-11','available','доступно'],['dalat-vip','2026-09-13','available','доступно'],['dalat-glass','2026-09-14','low','мало мест'],['nha-day','2026-09-10','available','доступно'],['nha-evening','2026-09-10','request','по запросу'],['dalat-2d','2026-09-16','request','по запросу']
  ];
  const stmts = availability.map(v => env.DB.prepare('INSERT OR REPLACE INTO demo_availability(session_id,tour_id,date,status,label) VALUES (?,?,?,?,?)').bind(sessionId,...v));
  await env.DB.batch(stmts);

  const samples = [
    { display:'MT-DEMO-1039', tour:'nha-day', title:'Дневная обзорная экскурсия по Нячангу', date:'2026-09-10', total:7000, paid:2100, source:'Telegram', status:'Новый' },
    { display:'MT-DEMO-1040', tour:'phuyen', title:'Экскурсия в провинцию Фуйен', date:'2026-09-11', total:8000, paid:8000, source:'Сайт', status:'Подтверждено' },
    { display:'MT-DEMO-1041', tour:'dalat-vip', title:'Экскурсия в Далат «ВИП»', date:'2026-09-13', total:11000, paid:3300, source:'Реклама', status:'Оплачено' }
  ];
  for (const s of samples) {
    const internal = crypto.randomUUID();
    await env.DB.prepare(`INSERT INTO orders(id,display_id,session_id,idempotency_key,tour_id,tour_title,selected_date,participants_summary,pricing_snapshot_json,hotel,transfer_minor,total_minor,paid_minor,remaining_minor,payment_choice,payment_method,payment_state,status,source,customer,contact,participant_data_json,data_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      internal,s.display,sessionId,`seed-${s.display}`,s.tour,s.title,s.date,'2 взрослых','{}','Nha Trang center',0,s.total,s.paid,s.total-s.paid,'deposit','card',s.paid===s.total?'Оплачено — DEMO':'Предоплата — DEMO',s.status,s.source,'DEMO Клиент','demo','[]','demoInput'
    ).run();
  }
  const events: Array<[string,string,string|null,string|null,number|null]> = [
    ['view_tour','Telegram','dalat-premium',null,null],['view_tour','Telegram','dalat-premium',null,null],['start_booking','Telegram','dalat-premium',null,null],
    ['view_tour','Сайт','phuyen',null,null],['view_tour','Сайт','phuyen',null,null],['start_booking','Сайт','phuyen',null,null],
    ['order_created','Telegram','nha-day','MT-DEMO-1039',7000],['demo_payment_completed','Telegram','nha-day','MT-DEMO-1039',2100],
    ['order_created','Сайт','phuyen','MT-DEMO-1040',8000],['demo_payment_completed','Сайт','phuyen','MT-DEMO-1040',8000],
    ['order_created','Реклама','dalat-vip','MT-DEMO-1041',11000],['demo_payment_completed','Реклама','dalat-vip','MT-DEMO-1041',3300]
  ];
  await env.DB.batch(events.map(e => env.DB.prepare('INSERT INTO analytics_events(session_id,event_type,source,tour_id,order_id,amount_minor,metadata_json,demo) VALUES (?,?,?,?,?,?,?,1)').bind(sessionId,...e,'{"seed":"DEMO ANALYTICS"}')));
}

export async function ensureSession(request: Request, env: Env): Promise<{ id: string; setCookie?: string }> {
  const candidate = getCookie(request, COOKIE);
  if (candidate) {
    const exists = await env.DB.prepare('SELECT id FROM demo_sessions WHERE id=?').bind(candidate).first<{id:string}>();
    if (exists) {
      await env.DB.prepare('UPDATE demo_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?').bind(candidate).run();
      return { id: candidate };
    }
  }
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO demo_sessions(id) VALUES (?)').bind(id).run();
  await seedDemoSession(env, id);
  return { id, setCookie: sessionCookie(id, new URL(request.url).protocol === 'https:') };
}

export async function resetSession(env: Env, sessionId: string) {
  const tables = ['demo_tour_overrides','demo_user_created_tours','demo_availability','demo_promotions','demo_directions','manager_status_history','payments','order_participants','orders','analytics_events'];
  for (const table of tables) {
    // table names are fixed constants, never user-controlled.
    await env.DB.prepare(`DELETE FROM ${table} WHERE ${table === 'order_participants' ? 'order_id IN (SELECT id FROM orders WHERE session_id=?)' : 'session_id=?'}`).bind(sessionId).run();
  }
  await seedDemoSession(env, sessionId);
}
