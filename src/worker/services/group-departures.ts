import type { Env } from '../db/repository';
import { getTourByIdOrSlug } from '../db/repository';
import type { GroupDepartureSummary, GroupMemberInput } from '../../shared/types';
import { createGroupDepartureSchema, groupDepartureAdminSchema, joinGroupDepartureSchema } from '../../shared/schemas';
import { HttpError } from './booking';
import { recordAudit } from './internal-workflows';
import { queueNotification } from './notifications';

function contactOf(member: GroupMemberInput) {
  return [member.phone, member.telegram].filter(Boolean).join(' · ');
}

function mapDeparture(row: any): GroupDepartureSummary {
  return {
    id: String(row.id),
    tourId: String(row.tour_id),
    tourTitle: String(row.tour_title),
    departureDate: String(row.departure_date),
    status: row.status,
    targetPeople: row.target_people == null ? null : Number(row.target_people),
    minPeople: row.min_people == null ? null : Number(row.min_people),
    seats: Number(row.seats ?? 0),
    members: Number(row.members ?? 0),
    cancellationReason: String(row.cancellation_reason ?? ''),
    dataStatus: 'demoInput',
    createdAt: String(row.created_at ?? ''),
  };
}

async function fetchDeparture(env: Env, sessionId: string, id: string) {
  const row = await env.DB.prepare(`SELECT d.*,
    COALESCE(SUM(CASE WHEN m.status<>'cancelled' THEN m.seats ELSE 0 END),0) AS seats,
    COUNT(CASE WHEN m.status<>'cancelled' THEN 1 END) AS members
    FROM demo_group_departures d
    LEFT JOIN demo_group_members m ON m.departure_id=d.id AND m.session_id=d.session_id
    WHERE d.session_id=? AND d.id=?
    GROUP BY d.id`).bind(sessionId,id).first<any>();
  if (!row) throw new HttpError(404,'Групповой выезд не найден','GROUP_DEPARTURE_NOT_FOUND');
  return mapDeparture(row);
}

export async function listGroupDepartures(env: Env, sessionId: string, tourId?: string) {
  const where = tourId ? 'WHERE d.session_id=? AND d.tour_id=?' : 'WHERE d.session_id=?';
  const stmt = env.DB.prepare(`SELECT d.*,
    COALESCE(SUM(CASE WHEN m.status<>'cancelled' THEN m.seats ELSE 0 END),0) AS seats,
    COUNT(CASE WHEN m.status<>'cancelled' THEN 1 END) AS members
    FROM demo_group_departures d
    LEFT JOIN demo_group_members m ON m.departure_id=d.id AND m.session_id=d.session_id
    ${where}
    GROUP BY d.id
    ORDER BY d.departure_date, d.created_at`);
  const rows = tourId ? await stmt.bind(sessionId,tourId).all<any>() : await stmt.bind(sessionId).all<any>();
  return (rows.results ?? []).map(mapDeparture);
}

async function addMember(env: Env, sessionId: string, departureId: string, member: GroupMemberInput) {
  const seats = member.adults + member.children.length;
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO demo_group_members(id,departure_id,session_id,customer_name,contact,telegram_username,adults,children_json,seats,status)
    VALUES (?,?,?,?,?,?,?,?,?,'waiting')`).bind(
      id,departureId,sessionId,member.customerName,contactOf(member),member.telegram ?? '',member.adults,JSON.stringify(member.children),seats
    ).run();
  return { id, seats };
}

export async function createGroupDeparture(env: Env, sessionId: string, input: unknown, actorId='demo') {
  const parsed = createGroupDepartureSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400,'Проверьте данные группового выезда','VALIDATION_ERROR');
  const tour = await getTourByIdOrSlug(env.DB, sessionId, parsed.data.tourId);
  if (!tour || !tour.published) throw new HttpError(404,'Экскурсия не найдена','TOUR_NOT_FOUND');
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO demo_group_departures(id,session_id,tour_id,tour_title,departure_date,status,target_people,min_people,created_by,data_status)
    VALUES (?,?,?,?,?,'gathering',?,NULL,'tourist','demoInput')`).bind(
      id,sessionId,tour.id,tour.title,parsed.data.departureDate,parsed.data.targetPeople ?? null
    ).run();
  await addMember(env,sessionId,id,parsed.data.member as GroupMemberInput);
  const departure = await fetchDeparture(env,sessionId,id);
  await recordAudit(env,sessionId,'tourist','Создание группового выезда','group_departure',id,{},departure,actorId);
  try {
    await queueNotification(env,sessionId,'manager','group_departure_created',id,{tourTitle:tour.title,departureDate:departure.departureDate,seats:departure.seats});
  } catch {}
  return departure;
}

export async function joinGroupDeparture(env: Env, sessionId: string, id: string, input: unknown, actorId='demo') {
  const parsed = joinGroupDepartureSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400,'Проверьте данные участника','VALIDATION_ERROR');
  const current = await fetchDeparture(env,sessionId,id);
  if (current.status !== 'gathering') throw new HttpError(409,'К этому выезду сейчас нельзя присоединиться','GROUP_NOT_GATHERING');
  await addMember(env,sessionId,id,parsed.data.member as GroupMemberInput);
  const after = await fetchDeparture(env,sessionId,id);
  await recordAudit(env,sessionId,'tourist','Присоединение к групповому выезду','group_departure',id,current,after,actorId);
  try {
    await queueNotification(env,sessionId,'manager','group_departure_joined',id,{tourTitle:after.tourTitle,departureDate:after.departureDate,seats:after.seats});
  } catch {}
  return after;
}

export async function adminPatchGroupDeparture(env: Env, sessionId: string, id: string, input: unknown, actorId='demo') {
  const parsed = groupDepartureAdminSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400,'Некорректный статус группового выезда','VALIDATION_ERROR');
  const before = await fetchDeparture(env,sessionId,id);
  await env.DB.prepare(`UPDATE demo_group_departures SET status=?,cancellation_reason=?,updated_at=CURRENT_TIMESTAMP WHERE session_id=? AND id=?`)
    .bind(parsed.data.status,parsed.data.cancellationReason ?? '',sessionId,id).run();
  const after = await fetchDeparture(env,sessionId,id);
  await recordAudit(env,sessionId,'admin','Изменение группового выезда','group_departure',id,before,after,actorId);
  if (after.status === 'cancelled') {
    try {
      await queueNotification(env,sessionId,'manager','group_departure_cancelled',id,{tourTitle:after.tourTitle,departureDate:after.departureDate,reason:after.cancellationReason});
    } catch {}
  }
  return after;
}
