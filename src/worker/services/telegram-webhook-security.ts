import type { Env } from '../db/repository';
import { HttpError } from './booking';

export function assertTelegramWebhookAuthorized(request: Request, env: Env) {
  if (!env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new HttpError(503, 'Telegram bot token ещё не настроен', 'TELEGRAM_NOT_CONFIGURED');
  }
  const expected = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) {
    throw new HttpError(503, 'Telegram webhook secret ещё не настроен', 'TELEGRAM_WEBHOOK_SECRET_NOT_CONFIGURED');
  }
  const supplied = request.headers.get('X-Telegram-Bot-Api-Secret-Token')?.trim() ?? '';
  if (!supplied || supplied !== expected) {
    throw new HttpError(401, 'Неверный Telegram webhook secret', 'TELEGRAM_WEBHOOK_UNAUTHORIZED');
  }
}
