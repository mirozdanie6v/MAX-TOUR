import type { Env } from '../db/repository';

export type PolicyOperation = 'cancel' | 'reschedule' | 'no_show';

export interface PolicyDecision {
  ruleCode: 'FREE_CANCEL_GT_48H' | 'CANCEL_RETAIN_30' | 'DAY_OF_OR_NO_SHOW_RETAIN_100' | 'FREE_RESCHEDULE_BEFORE_17' | 'LATE_RESCHEDULE_RETAIN_30';
  retentionPercent: 0 | 30 | 100;
  label: string;
}

function vnParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return { year:get('year'), month:get('month'), day:get('day'), hour:get('hour'), minute:get('minute') };
}

function ymd(v:{year:number;month:number;day:number}) { return `${v.year}-${String(v.month).padStart(2,'0')}-${String(v.day).padStart(2,'0')}`; }
function dateOrdinal(value:string) { const [y,m,d]=value.split('-').map(Number); return Date.UTC(y!,m!-1,d!)/86_400_000; }

export function evaluateMaxTourPolicy(selectedDate: string, operation: PolicyOperation, now = new Date()): PolicyDecision {
  if (operation === 'no_show') return { ruleCode:'DAY_OF_OR_NO_SHOW_RETAIN_100', retentionPercent:100, label:'Неявка — удержание 100% стоимости' };
  const current = vnParts(now);
  const today = ymd(current);
  const todayOrd = dateOrdinal(today);
  const departureOrd = dateOrdinal(selectedDate);
  const dayDiff = departureOrd - todayOrd;

  if (operation === 'reschedule') {
    if (dayDiff > 1 || (dayDiff === 1 && (current.hour < 17))) {
      return { ruleCode:'FREE_RESCHEDULE_BEFORE_17', retentionPercent:0, label:'Перенос бесплатный до 17:00 за день до экскурсии' };
    }
    return { ruleCode:'LATE_RESCHEDULE_RETAIN_30', retentionPercent:30, label:'После 17:00 за день до экскурсии удерживается 30% стоимости' };
  }

  if (dayDiff <= 0) return { ruleCode:'DAY_OF_OR_NO_SHOW_RETAIN_100', retentionPercent:100, label:'В день выезда удерживается 100% стоимости' };

  // MAX TOUR publishes free cancellation more than 48 hours before departure. Because tours have
  // different pickup times, use the conservative local-day boundary when an exact departure time is absent:
  // 3+ calendar days ahead is unambiguously >48h; 1–2 days is manager-reviewed at 30% retention.
  if (dayDiff >= 3) return { ruleCode:'FREE_CANCEL_GT_48H', retentionPercent:0, label:'Отмена более чем за 48 часов — без удержания' };
  return { ruleCode:'CANCEL_RETAIN_30', retentionPercent:30, label:'Отмена в период до дня выезда — удержание 30% стоимости' };
}

export function refundAmountMinor(totalMinor:number, paidMinor:number, retentionPercent:number) {
  const retainedMinor = Math.round(Math.max(0,totalMinor) * Math.max(0,Math.min(100,retentionPercent)) / 100);
  return Math.max(0, Math.max(0,paidMinor) - retainedMinor);
}

export async function upsertRefundCase(env: Env, sessionId:string, order:{id:string;selected_date:string;total_minor:number;paid_minor:number}, operation:'cancel'|'no_show', reason:string) {
  const decision = evaluateMaxTourPolicy(order.selected_date, operation);
  const requestedRefundMinor = refundAmountMinor(Number(order.total_minor ?? 0), Number(order.paid_minor ?? 0), decision.retentionPercent);
  const existing = await env.DB.prepare(`SELECT id,status FROM demo_refund_cases WHERE session_id=? AND order_id=? AND status NOT IN ('completed','cancelled') ORDER BY created_at DESC LIMIT 1`).bind(sessionId,order.id).first<any>();
  const id = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await env.DB.prepare(`UPDATE demo_refund_cases SET reason=?,rule_code=?,retention_percent=?,requested_refund_minor=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND session_id=?`)
      .bind(reason || decision.label,decision.ruleCode,decision.retentionPercent,requestedRefundMinor,decision.label,id,sessionId).run();
  } else {
    await env.DB.prepare(`INSERT INTO demo_refund_cases(id,session_id,order_id,reason,rule_code,retention_percent,requested_refund_minor,status,note) VALUES (?,?,?,?,?,?,?,'manager_review',?)`)
      .bind(id,sessionId,order.id,reason || decision.label,decision.ruleCode,decision.retentionPercent,requestedRefundMinor,decision.label).run();
  }
  return { id, ...decision, requestedRefundMinor, paidMinor:Number(order.paid_minor ?? 0), totalMinor:Number(order.total_minor ?? 0), status:'manager_review' };
}

export async function listRefundCases(env: Env, sessionId:string) {
  const rows=await env.DB.prepare(`SELECT r.id,r.order_id,r.group_departure_id,r.reason,r.rule_code,r.retention_percent,r.requested_refund_minor,r.provider_refund_id,r.status,r.note,r.created_at,r.updated_at,o.display_id,o.tour_title,o.selected_date,o.paid_minor,o.total_minor
    FROM demo_refund_cases r LEFT JOIN orders o ON o.id=r.order_id
    WHERE r.session_id=? ORDER BY r.created_at DESC`).bind(sessionId).all<any>();
  return rows.results ?? [];
}
