import type { AnalyticsResponse, AvailabilityDate, BookingDraft, Destination, OrderSummary, Quote, Tour } from '../../shared/types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type','application/json');
  const response = await fetch(url,{...init,headers,credentials:'same-origin'});
  const data:any = await response.json().catch(()=>({}));
  if(!response.ok) throw new ApiError(data?.error?.message ?? 'Ошибка API',response.status,data?.error?.code);
  return data as T;
}

export const api = {
  session:()=>request<{ok:boolean}>('/api/session'),
  health:()=>request<any>('/api/health'),
  reset:()=>request<{ok:boolean}>('/api/demo/reset',{method:'POST',body:'{}'}),
  destinations:()=>request<{items:Destination[]}>('/api/destinations'),
  tours:(admin=false)=>request<{items:Tour[]}>(`/api/tours${admin?'?admin=1':''}`),
  tour:(id:string)=>request<{item:Tour}>(`/api/tours/${encodeURIComponent(id)}`),
  availability:(id:string)=>request<{items:AvailabilityDate[]}>(`/api/tours/${encodeURIComponent(id)}/availability`),
  quote:(draft:BookingDraft)=>request<{quote:Quote}>('/api/booking/quote',{method:'POST',body:JSON.stringify(draft)}),
  createOrder:(draft:BookingDraft,key:string)=>request<{order:OrderSummary}>('/api/orders',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(draft)}),
  pay:(orderId:string,key:string)=>request<{order:OrderSummary}>('/api/payments/demo',{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify({orderId})}),
  trips:()=>request<{items:OrderSummary[]}>('/api/my-trips'),
  order:(id:string)=>request<{order:OrderSummary}>(`/api/orders/${encodeURIComponent(id)}`),
  managerOrders:()=>request<{items:OrderSummary[]}>('/api/manager/orders'),
  managerOrder:(id:string)=>request<{order:OrderSummary}>(`/api/manager/orders/${encodeURIComponent(id)}`),
  managerStatus:(id:string,status:OrderSummary['status'])=>request<{order:OrderSummary}>(`/api/manager/orders/${encodeURIComponent(id)}/status`,{method:'PATCH',body:JSON.stringify({status})}),
  managerOps:(id:string)=>request<{ops:{assignedManager:string;pickupNote:string;internalNote:string;lastContactAt:string|null;updatedAt:string|null}}>(`/api/manager/orders/${encodeURIComponent(id)}/ops`),
  patchManagerOps:(id:string,data:any)=>request<{ops:any}>(`/api/manager/orders/${encodeURIComponent(id)}/ops`,{method:'PATCH',body:JSON.stringify(data)}),
  adminTours:()=>request<{items:Tour[]}>('/api/admin/tours'),
  patchTour:(id:string,patch:any)=>request<{item:Tour}>(`/api/admin/tours/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)}),
  addTour:(data:any)=>request<{item:Tour}>('/api/admin/tours',{method:'POST',body:JSON.stringify(data)}),
  schedule:(id:string,data:any)=>request(`/api/admin/tours/${encodeURIComponent(id)}/schedule`,{method:'POST',body:JSON.stringify(data)}),
  promo:(id:string,data:any)=>request(`/api/admin/tours/${encodeURIComponent(id)}/promo`,{method:'POST',body:JSON.stringify(data)}),
  directions:()=>request<{items:Destination[]}>('/api/admin/directions'),
  addDirection:(name:string)=>request('/api/admin/directions',{method:'POST',body:JSON.stringify({name})}),
  analytics:(params:URLSearchParams)=>request<AnalyticsResponse>(`/api/admin/analytics?${params.toString()}`),
  ownerOverview:()=>request<any>('/api/owner/overview'),
  ownerSettings:(data:any)=>request<any>('/api/owner/settings',{method:'PATCH',body:JSON.stringify(data)}),
  ownerAudit:(params=new URLSearchParams())=>request<any>(`/api/owner/audit?${params.toString()}`),
  telegramStatus:()=>request<any>('/api/integrations/telegram/status'),
  telegramWebhookInfo:()=>request<any>('/api/integrations/telegram/webhook'),
  configureTelegramWebhook:()=>request<any>('/api/integrations/telegram/webhook',{method:'POST',body:'{}'}),
  flushTelegram:()=>request<any>('/api/integrations/telegram/flush',{method:'POST',body:'{}'}),
  tildaStatus:()=>request<any>('/api/integrations/tilda/status'),
  event:(eventType:string,tourId?:string,source='Telegram')=>request('/api/analytics/event',{method:'POST',body:JSON.stringify({eventType,tourId,source})}).catch(()=>null),
};
