import type { Tour } from '../../shared/types';
import { addTourSchema, adminTourPatchSchema, availabilitySchema, promoSchema } from '../../shared/schemas';
import { getMergedTours, getTourByIdOrSlug, getDestinations } from '../db/repository';
import type { Env } from '../db/repository';
import { HttpError } from './booking';

export async function patchTour(env: Env, sessionId: string, tourId: string, input: unknown) {
  const parsed = adminTourPatchSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400,'Некорректные данные тура','VALIDATION_ERROR');
  const current = await getTourByIdOrSlug(env.DB,sessionId,tourId);
  if (!current) throw new HttpError(404,'Экскурсия не найдена','TOUR_NOT_FOUND');
  if (current.dataStatus === 'userCreatedDemo') {
    const next: Tour = {
      ...current,
      ...parsed.data,
      pricingRules: parsed.data.adultMinor != null ? { ...current.pricingRules, adultMinor: parsed.data.adultMinor } : current.pricingRules,
      dataStatus:'userCreatedDemo',
      updatedAt:new Date().toISOString()
    };
    await env.DB.prepare('UPDATE demo_user_created_tours SET tour_json=?, updated_at=CURRENT_TIMESTAMP WHERE session_id=? AND id=?').bind(JSON.stringify(next),sessionId,current.id).run();
    return next;
  }
  const existing = await env.DB.prepare('SELECT override_json FROM demo_tour_overrides WHERE session_id=? AND tour_id=?').bind(sessionId,current.id).first<{override_json:string}>();
  const oldOverride = existing ? JSON.parse(existing.override_json) : {};
  const patch:any = { ...oldOverride, ...parsed.data };
  if (parsed.data.adultMinor != null) {
    patch.pricingRules = { ...current.pricingRules, ...(oldOverride.pricingRules ?? {}), adultMinor: parsed.data.adultMinor };
    delete patch.adultMinor;
  }
  patch.updatedAt = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO demo_tour_overrides(session_id,tour_id,override_json) VALUES (?,?,?)
    ON CONFLICT(session_id,tour_id) DO UPDATE SET override_json=excluded.override_json,updated_at=CURRENT_TIMESTAMP`).bind(sessionId,current.id,JSON.stringify(patch)).run();
  return getTourByIdOrSlug(env.DB,sessionId,current.id);
}

export async function addTour(env: Env, sessionId: string, input: unknown) {
  const parsed=addTourSchema.safeParse(input);
  if(!parsed.success) throw new HttpError(400,'Некорректные данные новой экскурсии','VALIDATION_ERROR');
  const directions = await getDestinations(env.DB, sessionId);
  if (!directions.some(direction => direction.name.toLowerCase() === parsed.data.direction.toLowerCase())) {
    throw new HttpError(400,'Сначала добавьте направление или выберите существующее','DIRECTION_NOT_FOUND');
  }
  const id=`demo-tour-${crypto.randomUUID()}`;
  const slug=`demo-${Date.now()}-${crypto.randomUUID().slice(0,8)}`;
  const d=parsed.data;
  const tour:Tour={id,slug,title:d.title,direction:d.direction,category:'DEMO',published:d.published,sourceUrl:'DEMO USER INPUT',priceMode:d.priceMode,pricingRules:{adultMinor:d.adultMinor,childRules:[]},requiredFields:['fullName'],scheduleMode:d.scheduleMode,description:d.description,program:[],included:[],extraCosts:[],whatToTake:[],images:d.images,badges:[],dataStatus:'userCreatedDemo',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  await env.DB.prepare('INSERT INTO demo_user_created_tours(id,session_id,tour_json) VALUES (?,?,?)').bind(id,sessionId,JSON.stringify(tour)).run();
  return tour;
}

export async function setAvailability(env: Env, sessionId:string, tourId:string, input:unknown){
  const tour=await getTourByIdOrSlug(env.DB,sessionId,tourId); if(!tour) throw new HttpError(404,'Экскурсия не найдена','TOUR_NOT_FOUND');
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400,'Некорректная demo-дата или статус','VALIDATION_ERROR');
  const labels = {available:'доступно',low:'мало мест',request:'по запросу'} as const;
  const { date, status } = parsed.data;
  await env.DB.prepare(`INSERT INTO demo_availability(session_id,tour_id,date,status,label) VALUES (?,?,?,?,?) ON CONFLICT(session_id,tour_id,date) DO UPDATE SET status=excluded.status,label=excluded.label,updated_at=CURRENT_TIMESTAMP`).bind(sessionId,tour.id,date,status,labels[status]).run();
  return {date,status,label:labels[status],dataStatus:'demoAvailability'};
}

function inferPromoDiscount(value: string, explicitType: 'none'|'percent_bps'|'fixed_minor', explicitValue: number) {
  if (explicitType !== 'none') return { discountType: explicitType, discountValue: explicitValue };
  const percent = value.match(/^\s*-?\s*(\d+(?:[.,]\d+)?)\s*%\s*$/);
  if (percent) {
    const pct = Number(percent[1]!.replace(',','.'));
    if (Number.isFinite(pct) && pct >= 0 && pct <= 100) {
      return { discountType: 'percent_bps' as const, discountValue: Math.round(pct * 100) };
    }
  }
  return { discountType: 'none' as const, discountValue: 0 };
}

export async function setPromo(env:Env,sessionId:string,tourId:string,input:unknown){
  const tour=await getTourByIdOrSlug(env.DB,sessionId,tourId); if(!tour) throw new HttpError(404,'Экскурсия не найдена','TOUR_NOT_FOUND');
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400,'Некорректные параметры DEMO-акции','VALIDATION_ERROR');
  const { enabled, label, value } = parsed.data;
  const discount = inferPromoDiscount(value, parsed.data.discountType, parsed.data.discountValue);
  await env.DB.prepare(`INSERT INTO demo_promotions(session_id,tour_id,enabled,label,value,discount_type,discount_value) VALUES (?,?,?,?,?,?,?) ON CONFLICT(session_id,tour_id) DO UPDATE SET enabled=excluded.enabled,label=excluded.label,value=excluded.value,discount_type=excluded.discount_type,discount_value=excluded.discount_value,updated_at=CURRENT_TIMESTAMP`).bind(sessionId,tour.id,enabled?1:0,label,value,discount.discountType,discount.discountValue).run();
  return {enabled,label,value,...discount,dataStatus:'demoPromo'};
}

export async function addDirection(env:Env,sessionId:string,input:any){
  const name=String(input?.name??'').trim(); if(name.length<2) throw new HttpError(400,'Введите название направления','VALIDATION_ERROR');
  const current=await getDestinations(env.DB,sessionId); if(current.some(d=>d.name.toLowerCase()===name.toLowerCase())) throw new HttpError(409,'Такое направление уже есть','ALREADY_EXISTS');
  const id=`demo-dir-${crypto.randomUUID()}`;
  await env.DB.prepare('INSERT INTO demo_directions(id,session_id,name) VALUES (?,?,?)').bind(id,sessionId,name).run();
  return {id,name,dataStatus:'userCreatedDemo'};
}

export async function adminTours(env:Env,sessionId:string){ return getMergedTours(env.DB,sessionId); }
