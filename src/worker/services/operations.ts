import type { Env } from '../db/repository';
import { getMergedTours, listOrders } from '../db/repository';
import { getAnalytics } from './analytics';
import { HttpError } from './booking';

export interface ManagerOps {
  assignedManager: string;
  pickupNote: string;
  internalNote: string;
  lastContactAt: string | null;
  updatedAt: string | null;
}

function text(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

export async function getManagerOps(env: Env, sessionId: string, displayId: string): Promise<ManagerOps> {
  const order = await env.DB.prepare('SELECT id FROM orders WHERE session_id=? AND display_id=?').bind(sessionId, displayId).first<{id:string}>();
  if (!order) throw new HttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
  const row = await env.DB.prepare('SELECT assigned_manager,pickup_note,internal_note,last_contact_at,updated_at FROM demo_order_operations WHERE session_id=? AND order_id=?').bind(sessionId, order.id).first<any>();
  return {
    assignedManager: row?.assigned_manager ?? '',
    pickupNote: row?.pickup_note ?? '',
    internalNote: row?.internal_note ?? '',
    lastContactAt: row?.last_contact_at ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function patchManagerOps(env: Env, sessionId: string, displayId: string, input: any): Promise<ManagerOps> {
  const order = await env.DB.prepare('SELECT id FROM orders WHERE session_id=? AND display_id=?').bind(sessionId, displayId).first<{id:string}>();
  if (!order) throw new HttpError(404, 'Заказ не найден', 'ORDER_NOT_FOUND');
  const assignedManager = text(input?.assignedManager, 80);
  const pickupNote = text(input?.pickupNote, 180);
  const internalNote = text(input?.internalNote, 1200);
  const contacted = input?.markContacted === true;
  await env.DB.prepare(`INSERT INTO demo_order_operations(session_id,order_id,assigned_manager,pickup_note,internal_note,last_contact_at,updated_at)
    VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(session_id,order_id) DO UPDATE SET
      assigned_manager=excluded.assigned_manager,
      pickup_note=excluded.pickup_note,
      internal_note=excluded.internal_note,
      last_contact_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE demo_order_operations.last_contact_at END,
      updated_at=CURRENT_TIMESTAMP`).bind(
        sessionId, order.id, assignedManager, pickupNote, internalNote, contacted ? new Date().toISOString() : null, contacted ? 1 : 0
      ).run();
  return getManagerOps(env, sessionId, displayId);
}

export async function getOwnerOverview(env: Env, sessionId: string) {
  const orders = await listOrders(env.DB, sessionId);
  const analytics = await getAnalytics(env, sessionId, new URLSearchParams());
  const tours = await getMergedTours(env.DB, sessionId);
  const settingsRow = await env.DB.prepare('SELECT manager_sla_minutes,manager_notifications,owner_digest,sales_focus,updated_at FROM demo_owner_settings WHERE session_id=?').bind(sessionId).first<any>();
  if (!settingsRow) {
    await env.DB.prepare('INSERT OR IGNORE INTO demo_owner_settings(session_id) VALUES (?)').bind(sessionId).run();
  }
  const settings = settingsRow ?? await env.DB.prepare('SELECT manager_sla_minutes,manager_notifications,owner_digest,sales_focus,updated_at FROM demo_owner_settings WHERE session_id=?').bind(sessionId).first<any>();
  const byStatus = ['Новый','Оплачено','Подтверждено'].map(status => ({ status, count: orders.filter(o => o.status === status).length }));
  const grossMinor = orders.reduce((sum, order) => sum + order.totalMinor, 0);
  const paidMinor = orders.reduce((sum, order) => sum + order.paidMinor, 0);
  return {
    demo: true,
    metrics: {
      orders: orders.length,
      grossMinor,
      paidMinor,
      outstandingMinor: Math.max(0, grossMinor - paidMinor),
      conversion: analytics.metrics.conversion,
      averageOrderMinor: analytics.metrics.averageOrderMinor,
      tours: tours.length,
      publishedTours: tours.filter(t => t.published).length,
    },
    statuses: byStatus,
    sources: analytics.sources,
    funnel: analytics.funnel,
    recentOrders: orders.slice(0, 6),
    settings: {
      managerSlaMinutes: Number(settings?.manager_sla_minutes ?? 15),
      managerNotifications: Boolean(settings?.manager_notifications ?? 1),
      ownerDigest: String(settings?.owner_digest ?? 'Ежедневно'),
      salesFocus: String(settings?.sales_focus ?? 'Премиум экскурсии'),
      updatedAt: settings?.updated_at ?? null,
    },
    workflow: [
      { role: 'Турист', action: 'Выбирает тур, дату, участников и создаёт заказ' },
      { role: 'Менеджер', action: 'Получает заказ, связывается с клиентом, уточняет детали и подтверждает' },
      { role: 'Администратор', action: 'Поддерживает каталог, цены, расписание, акции и направления' },
      { role: 'Владелец', action: 'Контролирует показатели, очередь заказов и правила работы команды' },
    ],
  };
}

export async function patchOwnerSettings(env: Env, sessionId: string, input: any) {
  const managerSlaMinutes = Math.min(120, Math.max(5, Number(input?.managerSlaMinutes ?? 15)));
  const managerNotifications = input?.managerNotifications === false ? 0 : 1;
  const allowedDigest = ['Отключено','Ежедневно','Еженедельно'];
  const ownerDigest = allowedDigest.includes(String(input?.ownerDigest)) ? String(input.ownerDigest) : 'Ежедневно';
  const salesFocus = text(input?.salesFocus, 120) || 'Премиум экскурсии';
  await env.DB.prepare(`INSERT INTO demo_owner_settings(session_id,manager_sla_minutes,manager_notifications,owner_digest,sales_focus,updated_at)
    VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(session_id) DO UPDATE SET
      manager_sla_minutes=excluded.manager_sla_minutes,
      manager_notifications=excluded.manager_notifications,
      owner_digest=excluded.owner_digest,
      sales_focus=excluded.sales_focus,
      updated_at=CURRENT_TIMESTAMP`).bind(sessionId,managerSlaMinutes,managerNotifications,ownerDigest,salesFocus).run();
  return getOwnerOverview(env, sessionId);
}
