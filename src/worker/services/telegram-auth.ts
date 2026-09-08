import type { Env } from '../db/repository';
import { HttpError } from './booking';

export type StaffRole = 'manager' | 'admin' | 'owner';

export interface TelegramIdentity {
  telegramUserId: string;
  firstName: string;
  lastName: string;
  username: string;
  authDate: number;
  role: StaffRole | null;
  staffDisplayName: string;
}

const MAX_AUTH_AGE_SECONDS = 60 * 60;
const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2,'0')).join('');
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length || a.length % 2 !== 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(key: BufferSource, data: string) {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

export async function validateTelegramInitData(initData: string, botToken: string, nowSeconds = Math.floor(Date.now()/1000)) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash')?.toLowerCase() ?? '';
  if (!/^[0-9a-f]{64}$/.test(receivedHash)) throw new HttpError(401,'Telegram initData не содержит корректную подпись','TELEGRAM_INITDATA_INVALID');

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!Number.isInteger(authDate) || authDate <= 0) throw new HttpError(401,'Telegram auth_date отсутствует','TELEGRAM_INITDATA_INVALID');
  if (authDate > nowSeconds + 60 || nowSeconds - authDate > MAX_AUTH_AGE_SECONDS) throw new HttpError(401,'Telegram initData устарел','TELEGRAM_INITDATA_EXPIRED');

  const checkString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([key,value]) => `${key}=${value}`)
    .join('\n');

  // Telegram Mini Apps: secret_key = HMAC_SHA256(bot_token, key="WebAppData")
  // then hash = HMAC_SHA256(data_check_string, key=secret_key).
  const secretKey = await hmac(encoder.encode('WebAppData'), botToken);
  const calculatedHash = hex(await hmac(secretKey, checkString));
  if (!timingSafeEqualHex(calculatedHash, receivedHash)) throw new HttpError(401,'Подпись Telegram initData не прошла проверку','TELEGRAM_INITDATA_INVALID');

  let user: any = null;
  try { user = JSON.parse(params.get('user') ?? 'null'); } catch { /* handled below */ }
  const telegramUserId = String(user?.id ?? '');
  if (!/^\d+$/.test(telegramUserId)) throw new HttpError(401,'Telegram user отсутствует','TELEGRAM_USER_INVALID');
  return {
    telegramUserId,
    firstName: String(user?.first_name ?? '').slice(0,100),
    lastName: String(user?.last_name ?? '').slice(0,100),
    username: String(user?.username ?? '').slice(0,100),
    authDate,
  };
}

export async function authenticateTelegramStaff(env: Env, initData: string): Promise<TelegramIdentity> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new HttpError(503,'Telegram Bot Token ещё не настроен','TELEGRAM_NOT_CONFIGURED');
  const identity = await validateTelegramInitData(initData, token);
  const staff = await env.DB.prepare('SELECT role,display_name,active FROM staff_accounts WHERE telegram_user_id=?').bind(identity.telegramUserId).first<{role:StaffRole;display_name:string;active:number}>();
  return {
    ...identity,
    role: staff && Number(staff.active) === 1 ? staff.role : null,
    staffDisplayName: staff?.display_name ?? '',
  };
}

const roleAccess: Record<StaffRole, StaffRole[]> = {
  manager: ['manager','admin','owner'],
  admin: ['admin','owner'],
  owner: ['owner'],
};

export function telegramInitDataFromRequest(request: Request) {
  return request.headers.get('X-Telegram-Init-Data')?.trim() ?? '';
}

export async function requireStaffRole(env: Env, request: Request, requiredRole: StaffRole) {
  if ((env.AUTH_MODE ?? 'demo') !== 'telegram') return { mode:'demo' as const, role:requiredRole, telegramUserId:'demo', staffDisplayName:'DEMO' };
  const initData = telegramInitDataFromRequest(request);
  if (!initData) throw new HttpError(401,'Откройте служебный интерфейс через Telegram','TELEGRAM_AUTH_REQUIRED');
  const identity = await authenticateTelegramStaff(env, initData);
  if (!identity.role || !roleAccess[requiredRole].includes(identity.role)) throw new HttpError(403,'Недостаточно прав для этого раздела','FORBIDDEN');
  return { mode:'telegram' as const, ...identity };
}

export async function getAuthReadiness(env: Env) {
  const counts = await env.DB.prepare(`SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN active=1 THEN 1 ELSE 0 END) AS active
    FROM staff_accounts`).first<{total:number;active:number}>();
  return {
    authMode: env.AUTH_MODE ?? 'demo',
    botTokenConfigured: Boolean(env.TELEGRAM_BOT_TOKEN?.trim()),
    initDataValidationPrepared: true,
    staffAccounts: Number(counts?.total ?? 0),
    activeStaffAccounts: Number(counts?.active ?? 0),
    enforcementReady: Boolean(env.TELEGRAM_BOT_TOKEN?.trim()) && Number(counts?.active ?? 0) > 0,
  };
}
