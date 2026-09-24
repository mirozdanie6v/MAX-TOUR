import type { Env } from '../db/repository';
import { HttpError } from './booking';

const DEFAULT_BASE_URL = 'https://api.bokun.io';

function required(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new HttpError(503, `Bókun REST is not configured: ${name}`, 'BOKUN_REST_NOT_CONFIGURED');
  return normalized;
}

export function bokunUtcDate(date = new Date()) {
  const iso = date.toISOString();
  return iso.slice(0, 10) + ' ' + iso.slice(11, 19);
}

function toBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function signBokunRestRequest(
  secret: string,
  date: string,
  accessKey: string,
  method: string,
  pathWithQuery: string,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const base = date + accessKey + method.toUpperCase() + pathWithQuery;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  return toBase64(signature);
}

function apiBase(env: Env) {
  const configured = env.BOKUN_REST_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const parsed = new URL(configured);
  if (parsed.protocol !== 'https:') throw new HttpError(500, 'Bókun REST base URL must use HTTPS', 'BOKUN_REST_BASE_URL_INVALID');
  return parsed.origin;
}

async function bokunRestFetch(env: Env, pathWithQuery: string, init: RequestInit = {}) {
  const accessKey = required(env.BOKUN_REST_ACCESS_KEY, 'BOKUN_REST_ACCESS_KEY');
  const secretKey = required(env.BOKUN_REST_SECRET_KEY, 'BOKUN_REST_SECRET_KEY');
  const method = (init.method ?? 'GET').toUpperCase();
  const date = bokunUtcDate();
  const signature = await signBokunRestRequest(secretKey, date, accessKey, method, pathWithQuery);

  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('X-Bokun-Date', date);
  headers.set('X-Bokun-AccessKey', accessKey);
  headers.set('X-Bokun-Signature', signature);
  if (method !== 'GET' && method !== 'HEAD' && init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json;charset=UTF-8');
  }

  const response = await fetch(apiBase(env) + pathWithQuery, {
    ...init,
    method,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text.slice(0, 500) }; }

  if (!response.ok) {
    console.error('Bókun REST error', response.status, pathWithQuery);
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(502, 'Bókun rejected the integration credentials', 'BOKUN_REST_AUTH_FAILED');
    }
    if (response.status === 429) {
      throw new HttpError(503, 'Bókun rate limit reached; retry later', 'BOKUN_RATE_LIMITED');
    }
    throw new HttpError(502, 'Bókun API request failed', 'BOKUN_REST_REQUEST_FAILED');
  }

  return payload;
}

function productId(env: Env) {
  const id = required(env.BOKUN_PRODUCT_ID, 'BOKUN_PRODUCT_ID');
  if (!/^\d+$/.test(id)) throw new HttpError(500, 'Invalid Bókun product ID configuration', 'BOKUN_PRODUCT_ID_INVALID');
  return id;
}

function summarizeProduct(raw: any) {
  return {
    id: raw?.id ?? null,
    title: raw?.title ?? raw?.name ?? null,
    bookingType: raw?.bookingType ?? null,
    capacityType: raw?.capacityType ?? null,
    vendor: raw?.vendor ? {
      id: raw.vendor.id ?? null,
      title: raw.vendor.title ?? raw.vendor.name ?? null,
    } : null,
    rates: Array.isArray(raw?.rates) ? raw.rates.map((rate: any) => ({
      id: rate?.id ?? null,
      title: rate?.title ?? rate?.name ?? null,
      pricedPerPerson: rate?.pricedPerPerson ?? null,
      minPerBooking: rate?.minPerBooking ?? null,
      maxPerBooking: rate?.maxPerBooking ?? null,
    })) : [],
    pricingCategories: Array.isArray(raw?.pricingCategories) ? raw.pricingCategories.map((category: any) => ({
      id: category?.id ?? null,
      title: category?.title ?? category?.name ?? null,
      ticketCategory: category?.ticketCategory ?? null,
    })) : [],
    pickupService: raw?.pickupService ?? null,
    dropoffService: raw?.dropoffService ?? null,
  };
}

export async function getBokunProduct(env: Env) {
  const id = productId(env);
  const raw = await bokunRestFetch(env, `/activity.json/${encodeURIComponent(id)}`);
  return {
    ok: true,
    source: 'bokun-live',
    productCode: env.BOKUN_PRODUCT_CODE?.trim() ?? null,
    product: summarizeProduct(raw),
  };
}

function validDate(input: string | null, name: string) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(Date.parse(input + 'T00:00:00Z'))) {
    throw new HttpError(400, `Invalid ${name}; expected YYYY-MM-DD`, 'BOKUN_DATE_INVALID');
  }
  return input;
}

export async function getBokunAvailabilities(env: Env, url: URL) {
  const id = productId(env);
  const start = validDate(url.searchParams.get('start'), 'start');
  const end = validDate(url.searchParams.get('end'), 'end');
  const startMs = Date.parse(start + 'T00:00:00Z');
  const endMs = Date.parse(end + 'T00:00:00Z');
  if (endMs < startMs || endMs - startMs > 31 * 86400000) {
    throw new HttpError(400, 'Availability range must be 0-31 days', 'BOKUN_DATE_RANGE_INVALID');
  }

  const currencyRaw = (url.searchParams.get('currency') ?? '').trim().toUpperCase();
  if (currencyRaw && !/^[A-Z]{3}$/.test(currencyRaw)) {
    throw new HttpError(400, 'Invalid currency; expected ISO 4217 code', 'BOKUN_CURRENCY_INVALID');
  }

  const query = new URLSearchParams({ start, end });
  if (currencyRaw) query.set('currency', currencyRaw);
  const path = `/activity.json/${encodeURIComponent(id)}/availabilities?${query.toString()}`;
  const raw = await bokunRestFetch(env, path);
  const items = Array.isArray(raw) ? raw : [];

  return {
    ok: true,
    source: 'bokun-live',
    productId: id,
    productCode: env.BOKUN_PRODUCT_CODE?.trim() ?? null,
    start,
    end,
    currency: currencyRaw || null,
    items: items.map((item: any) => ({
      id: item?.id ?? null,
      date: item?.date ?? null,
      localizedDate: item?.localizedDate ?? null,
      startTime: item?.startTime ?? null,
      startTimeId: item?.startTimeId ?? null,
      availabilityCount: item?.availabilityCount ?? null,
      unlimitedAvailability: item?.unlimitedAvailability ?? null,
      minParticipants: item?.minParticipants ?? null,
      pricesByRate: item?.pricesByRate ?? [],
    })),
  };
}

export function getBokunRestReadiness(env: Env) {
  return {
    configured: Boolean(env.BOKUN_REST_ACCESS_KEY?.trim() && env.BOKUN_REST_SECRET_KEY?.trim()),
    baseUrl: env.BOKUN_REST_BASE_URL?.trim() || DEFAULT_BASE_URL,
  };
}
