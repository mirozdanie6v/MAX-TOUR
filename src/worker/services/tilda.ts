import type { Env } from '../db/repository';
import { HttpError } from './booking';

type TildaPayload = Record<string, string | string[]>;

export const MAX_TILDA_PAYLOAD_BYTES = 256 * 1024;
const MAX_FIELD_NAME = 120;
const MAX_GENERIC_VALUE = 4000;

function boundedText(value: unknown, max = MAX_GENERIC_VALUE) {
  return String(value ?? '').trim().slice(0, max);
}

function appendValue(target: TildaPayload, key: string, value: string) {
  const existing = target[key];
  if (existing === undefined) {
    target[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    target[key] = [existing, value];
  }
}

function firstValue(payload: TildaPayload, names: string[]) {
  const wanted = new Set(names.map(name => name.toLowerCase()));
  for (const [key, raw] of Object.entries(payload)) {
    if (!wanted.has(key.toLowerCase())) continue;
    return Array.isArray(raw) ? raw[0] ?? '' : raw;
  }
  return '';
}

async function stablePayloadId(payload: TildaPayload) {
  const canonical = JSON.stringify(
    Object.entries(payload)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value]),
  );
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function authorizeTildaWebhook(request: Request, env: Env) {
  const expected = env.TILDA_WEBHOOK_SECRET?.trim();
  if (!expected) {
    throw new HttpError(503, 'Tilda webhook secret ещё не настроен', 'TILDA_NOT_CONFIGURED');
  }
  const url = new URL(request.url);
  const supplied = url.searchParams.get('key')?.trim() ?? '';
  if (!supplied || supplied !== expected) {
    throw new HttpError(401, 'Неверный Tilda webhook secret', 'TILDA_WEBHOOK_UNAUTHORIZED');
  }
}

async function boundedFormData(request: Request) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_TILDA_PAYLOAD_BYTES) {
    throw new HttpError(413, 'Tilda webhook payload слишком большой', 'TILDA_PAYLOAD_TOO_LARGE');
  }
  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_TILDA_PAYLOAD_BYTES) {
    throw new HttpError(413, 'Tilda webhook payload слишком большой', 'TILDA_PAYLOAD_TOO_LARGE');
  }
  const copy = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: raw,
  });
  return copy.formData();
}

export async function receiveTildaWebhook(request: Request, env: Env) {
  authorizeTildaWebhook(request, env);

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/x-www-form-urlencoded') && !contentType.includes('multipart/form-data')) {
    throw new HttpError(415, 'Tilda webhook ожидает form POST', 'TILDA_UNSUPPORTED_MEDIA_TYPE');
  }

  const form = await boundedFormData(request);
  const payload: TildaPayload = {};
  for (const [rawKey, raw] of form.entries()) {
    const key = boundedText(rawKey, MAX_FIELD_NAME);
    if (!key) continue;
    const value = typeof raw === 'string'
      ? boundedText(raw)
      : boundedText(`[file:${boundedText(raw.name, 180)}:${Math.max(0, raw.size)}]`);
    appendValue(payload, key, value);
  }

  const tranidFromTilda = boundedText(firstValue(payload, ['tranid']), 200);
  const formid = boundedText(firstValue(payload, ['formid']), 200) || null;
  const syntheticKey = await stablePayloadId(payload);
  const tranid = tranidFromTilda || `synthetic:${formid ?? 'unknown'}:${syntheticKey}`;
  const referer = boundedText(request.headers.get('referer') || firstValue(payload, ['referer', 'url']), 1000) || null;
  const name = boundedText(firstValue(payload, ['name', 'fullname', 'full_name']), 200) || null;
  const phone = boundedText(firstValue(payload, ['phone', 'tel', 'telephone']), 80) || null;
  const email = boundedText(firstValue(payload, ['email', 'mail']), 320) || null;
  const comments = boundedText(firstValue(payload, ['comments', 'comment', 'message']), 4000) || null;
  const id = crypto.randomUUID();

  await env.DB.prepare(`INSERT INTO tilda_webhook_inbox
    (id,tranid,formid,referer,name,phone,email,comments,payload_json,status)
    VALUES (?,?,?,?,?,?,?,?,?,'received')
    ON CONFLICT(tranid) DO UPDATE SET
      formid=excluded.formid,
      referer=excluded.referer,
      name=COALESCE(excluded.name,tilda_webhook_inbox.name),
      phone=COALESCE(excluded.phone,tilda_webhook_inbox.phone),
      email=COALESCE(excluded.email,tilda_webhook_inbox.email),
      comments=COALESCE(excluded.comments,tilda_webhook_inbox.comments),
      payload_json=excluded.payload_json,
      updated_at=CURRENT_TIMESTAMP`)
    .bind(id,tranid,formid,referer,name,phone,email,comments,JSON.stringify(payload))
    .run();

  return { accepted: true, tranid, formid, duplicateSafe: true };
}

export async function getTildaIntegrationStatus(env: Env) {
  const result = await env.DB.prepare(`SELECT status,COUNT(*) AS count
    FROM tilda_webhook_inbox GROUP BY status`).all<{status:string;count:number}>();
  const counts: Record<string, number> = {};
  for (const row of result.results ?? []) counts[row.status] = Number(row.count ?? 0);

  return {
    configured: Boolean(env.TILDA_WEBHOOK_SECRET?.trim()),
    endpoint: 'https://max-tour.viiversion.com/api/tilda/webhook?key=<TILDA_WEBHOOK_SECRET>',
    inbox: {
      received: counts.received ?? 0,
      mapped: counts.mapped ?? 0,
      ignored: counts.ignored ?? 0,
      failed: counts.failed ?? 0,
    },
    payloadLimitBytes: MAX_TILDA_PAYLOAD_BYTES,
    mappingReady: false,
    note: 'Webhook transport is ready and bounded. Exact Tilda form-to-order mapping remains disabled until MAX TOUR confirms form fields/hidden tour identifiers.',
  };
}
