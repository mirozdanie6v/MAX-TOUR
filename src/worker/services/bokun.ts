import type { Env } from '../db/repository';
import { HttpError } from './booking';

const STATE_TTL_SECONDS = 15 * 60;
const REQUEST_MAX_AGE_SECONDS = 5 * 60;

const DEFAULT_SCOPES = [
  'PRODUCTS_READ',
  'BOOKINGS_READ',
  'BOOKINGS_WRITE',
  'CHECKOUTS_READ',
  'CHECKOUTS_WRITE',
  'CUSTOMERS_READ',
  'CUSTOMERS_WRITE',
  'CUSTOMERS_CONTACT_READ',
  'LEGACY_API',
].join(',');

type BokunInstallationRow = {
  vendor_id: string;
  domain: string;
  scopes: string;
  access_token_ciphertext: string;
  installed_at: string;
  updated_at: string;
  product_id: string;
  product_code: string;
};

function required(value: string | undefined, name: string) {
  const normalized = value?.trim();
  if (!normalized) throw new HttpError(503, `Bókun integration is not configured: ${name}`, 'BOKUN_NOT_CONFIGURED');
  return normalized;
}

function rawQueryPairs(url: URL) {
  const raw = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  if (!raw) return [] as Array<{ key: string; raw: string }>;
  return raw
    .split('&')
    .filter(Boolean)
    .map(part => {
      const index = part.indexOf('=');
      const rawKey = index >= 0 ? part.slice(0, index) : part;
      let key = rawKey;
      try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')); } catch { /* keep raw key */ }
      return { key, raw: part };
    });
}

export function canonicalBokunQuery(url: URL) {
  return rawQueryPairs(url)
    .filter(item => item.key !== 'hmac')
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(item => item.raw)
    .join('&');
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export async function verifyBokunHmac(url: URL, secret: string) {
  const provided = url.searchParams.get('hmac')?.trim() ?? '';
  const signature = hexToBytes(provided);
  if (!signature) return false;
  const key = await importHmacKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(canonicalBokunQuery(url)),
  );
}

function assertFreshTimestamp(url: URL) {
  const timestamp = Number(url.searchParams.get('timestamp'));
  if (!Number.isFinite(timestamp)) throw new HttpError(400, 'Missing Bókun timestamp', 'BOKUN_TIMESTAMP_REQUIRED');
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > REQUEST_MAX_AGE_SECONDS) throw new HttpError(401, 'Expired Bókun authorization request', 'BOKUN_REQUEST_EXPIRED');
}

function safeDomain(input: string) {
  const domain = input.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(domain)) {
    throw new HttpError(400, 'Invalid Bókun vendor domain', 'BOKUN_DOMAIN_INVALID');
  }
  return domain;
}

function scopes(env: Env) {
  return env.BOKUN_SCOPES?.trim() || DEFAULT_SCOPES;
}

function oauthHost(env: Env, domain: string) {
  const suffix = (env.BOKUN_OAUTH_HOST_SUFFIX?.trim() || 'bokun.is').replace(/^\.+/, '');
  return `https://${domain}.${suffix}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

function successHtml() {
  return new Response(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VIIVERSION × Bókun</title></head>
<body style="font-family:system-ui,sans-serif;max-width:680px;margin:64px auto;padding:24px;line-height:1.5">
<h1>Integration authorized</h1>
<p>VIIVERSION has been securely connected to Bókun for the Robinson Beach technical test.</p>
<p>You can close this tab and return to Bókun.</p>
</body></html>`, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

export async function handleBokunInstall(request: Request, env: Env) {
  const clientId = required(env.BOKUN_APP_API_KEY, 'BOKUN_APP_API_KEY');
  const clientSecret = required(env.BOKUN_APP_API_SECRET, 'BOKUN_APP_API_SECRET');
  const redirectUri = required(env.BOKUN_REDIRECT_URI, 'BOKUN_REDIRECT_URI');

  const url = new URL(request.url);
  assertFreshTimestamp(url);
  if (!(await verifyBokunHmac(url, clientSecret))) {
    throw new HttpError(401, 'Invalid Bókun signature', 'BOKUN_HMAC_INVALID');
  }

  const domain = safeDomain(url.searchParams.get('domain') ?? '');
  const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const now = new Date();
  const expires = new Date(now.getTime() + STATE_TTL_SECONDS * 1000);

  await env.DB.prepare(
    `INSERT INTO bokun_oauth_states (state, domain, created_at, expires_at, consumed_at)
     VALUES (?, ?, ?, ?, NULL)`
  ).bind(state, domain, now.toISOString(), expires.toISOString()).run();

  const authorization = new URL(`${oauthHost(env, domain)}/appstore/oauth/authorize`);
  authorization.searchParams.set('client_id', clientId);
  authorization.searchParams.set('scope', scopes(env));
  authorization.searchParams.set('redirect_uri', redirectUri);
  authorization.searchParams.set('state', state);

  return Response.redirect(authorization.toString(), 302);
}

export async function handleBokunCallback(request: Request, env: Env) {
  const clientId = required(env.BOKUN_APP_API_KEY, 'BOKUN_APP_API_KEY');
  const clientSecret = required(env.BOKUN_APP_API_SECRET, 'BOKUN_APP_API_SECRET');
  const tokenEncryptionKey = required(env.BOKUN_TOKEN_ENCRYPTION_KEY, 'BOKUN_TOKEN_ENCRYPTION_KEY');
  required(env.BOKUN_REDIRECT_URI, 'BOKUN_REDIRECT_URI');

  const url = new URL(request.url);
  assertFreshTimestamp(url);
  if (!(await verifyBokunHmac(url, clientSecret))) {
    throw new HttpError(401, 'Invalid Bókun signature', 'BOKUN_HMAC_INVALID');
  }

  const domain = safeDomain(url.searchParams.get('domain') ?? '');
  const state = url.searchParams.get('state')?.trim() ?? '';
  const code = url.searchParams.get('code')?.trim() ?? '';
  if (!state || !code) throw new HttpError(400, 'Missing Bókun OAuth state/code', 'BOKUN_OAUTH_CALLBACK_INVALID');

  const stored = await env.DB.prepare(
    `SELECT state, domain, expires_at, consumed_at
       FROM bokun_oauth_states
      WHERE state=?`
  ).bind(state).first<{ state: string; domain: string; expires_at: string; consumed_at: string | null }>();

  if (!stored || stored.domain !== domain || stored.consumed_at || Date.parse(stored.expires_at) <= Date.now()) {
    throw new HttpError(401, 'Invalid or expired Bókun OAuth state', 'BOKUN_STATE_INVALID');
  }

  const tokenResponse = await fetch(`${oauthHost(env, domain)}/appstore/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    throw new HttpError(502, 'Bókun token exchange failed', 'BOKUN_TOKEN_EXCHANGE_FAILED');
  }

  const tokenPayload = await tokenResponse.json() as { access_token?: string; scope?: string; vendor_id?: string | number };
  const accessToken = tokenPayload.access_token?.trim();
  const vendorId = String(tokenPayload.vendor_id ?? '').trim();
  if (!accessToken || !vendorId) {
    throw new HttpError(502, 'Incomplete Bókun token response', 'BOKUN_TOKEN_RESPONSE_INVALID');
  }

  const expectedVendorId = required(env.BOKUN_EXPECTED_VENDOR_ID, 'BOKUN_EXPECTED_VENDOR_ID');
  if (vendorId !== expectedVendorId) {
    throw new HttpError(403, 'Bókun vendor does not match the approved PoC account', 'BOKUN_VENDOR_MISMATCH');
  }

  const ciphertext = await encryptToken(accessToken, tokenEncryptionKey);
  const installedAt = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO bokun_installations
       (vendor_id, domain, scopes, access_token_ciphertext, installed_at, updated_at, product_id, product_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(vendor_id) DO UPDATE SET
         domain=excluded.domain,
         scopes=excluded.scopes,
         access_token_ciphertext=excluded.access_token_ciphertext,
         updated_at=excluded.updated_at,
         product_id=excluded.product_id,
         product_code=excluded.product_code`
    ).bind(
      vendorId,
      domain,
      tokenPayload.scope ?? scopes(env),
      ciphertext,
      installedAt,
      installedAt,
      env.BOKUN_PRODUCT_ID?.trim() ?? '',
      env.BOKUN_PRODUCT_CODE?.trim() ?? '',
    ),
    env.DB.prepare(
      'UPDATE bokun_oauth_states SET consumed_at=? WHERE state=?'
    ).bind(installedAt, state),
  ]);

  return successHtml();
}

export async function getBokunIntegrationStatus(env: Env) {
  const configured = Boolean(
    env.BOKUN_APP_API_KEY?.trim() &&
    env.BOKUN_APP_API_SECRET?.trim() &&
    env.BOKUN_TOKEN_ENCRYPTION_KEY?.trim() &&
    env.BOKUN_REDIRECT_URI?.trim()
  );

  const expectedVendorId = env.BOKUN_EXPECTED_VENDOR_ID?.trim() ?? '';
  const row = expectedVendorId
    ? await env.DB.prepare(
        `SELECT vendor_id, domain, scopes, access_token_ciphertext, installed_at, updated_at, product_id, product_code
           FROM bokun_installations WHERE vendor_id=?`
      ).bind(expectedVendorId).first<BokunInstallationRow>()
    : null;

  return {
    ok: true,
    integration: 'bokun',
    configured,
    connected: Boolean(row?.access_token_ciphertext),
    vendorId: expectedVendorId || null,
    domain: row?.domain ?? null,
    scopes: row?.scopes ? row.scopes.split(',').map(scope => scope.trim()).filter(Boolean) : scopes(env).split(','),
    product: {
      id: env.BOKUN_PRODUCT_ID?.trim() || row?.product_id || null,
      code: env.BOKUN_PRODUCT_CODE?.trim() || row?.product_code || null,
    },
    installedAt: row?.installed_at ?? null,
    updatedAt: row?.updated_at ?? null,
    redirectUri: env.BOKUN_REDIRECT_URI?.trim() ?? null,
  };
}
