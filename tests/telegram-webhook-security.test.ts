import { describe, expect, it } from 'vitest';
import { assertTelegramWebhookAuthorized } from '../src/worker/services/telegram-webhook-security';
import { HttpError } from '../src/worker/services/booking';

function expectHttpError(fn: () => void, status: number, code: string) {
  try {
    fn();
    throw new Error('Expected HttpError');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).code).toBe(code);
  }
}

describe('Telegram webhook authorization', () => {
  it('fails closed when bot token is not configured', () => {
    const request = new Request('https://max-tour.viiversion.com/api/telegram/webhook', { method: 'POST' });
    expectHttpError(() => assertTelegramWebhookAuthorized(request, {} as any), 503, 'TELEGRAM_NOT_CONFIGURED');
  });

  it('fails closed when webhook secret is not configured', () => {
    const request = new Request('https://max-tour.viiversion.com/api/telegram/webhook', { method: 'POST' });
    expectHttpError(
      () => assertTelegramWebhookAuthorized(request, { TELEGRAM_BOT_TOKEN: 'test-token' } as any),
      503,
      'TELEGRAM_WEBHOOK_SECRET_NOT_CONFIGURED',
    );
  });

  it('rejects an incorrect secret token header', () => {
    const request = new Request('https://max-tour.viiversion.com/api/telegram/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' },
    });
    expectHttpError(
      () => assertTelegramWebhookAuthorized(request, { TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_WEBHOOK_SECRET: 'correct' } as any),
      401,
      'TELEGRAM_WEBHOOK_UNAUTHORIZED',
    );
  });

  it('accepts the exact configured secret', () => {
    const request = new Request('https://max-tour.viiversion.com/api/telegram/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'correct' },
    });
    expect(() => assertTelegramWebhookAuthorized(request, {
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'correct',
    } as any)).not.toThrow();
  });
});
