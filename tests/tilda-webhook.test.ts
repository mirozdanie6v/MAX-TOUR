import { describe, expect, it, vi } from 'vitest';
import { MAX_TILDA_PAYLOAD_BYTES, receiveTildaWebhook } from '../src/worker/services/tilda';
import { HttpError } from '../src/worker/services/booking';

function env(secret?: string) {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return {
    value: { DB: { prepare }, TILDA_WEBHOOK_SECRET: secret } as any,
    prepare,
    bind,
    run,
  };
}

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
    throw new Error('Expected HttpError');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).code).toBe(code);
  }
}

describe('Tilda webhook boundary', () => {
  it('requires server-side webhook secret configuration', async () => {
    const e = env();
    const request = new Request('https://max-tour.viiversion.com/api/tilda/webhook?key=test', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Test',
    });
    await expectHttpError(receiveTildaWebhook(request, e.value), 503, 'TILDA_NOT_CONFIGURED');
  });

  it('rejects an incorrect webhook secret', async () => {
    const e = env('correct');
    const request = new Request('https://max-tour.viiversion.com/api/tilda/webhook?key=wrong', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=Test',
    });
    await expectHttpError(receiveTildaWebhook(request, e.value), 401, 'TILDA_WEBHOOK_UNAUTHORIZED');
  });

  it('rejects unsupported media types before parsing', async () => {
    const e = env('correct');
    const request = new Request('https://max-tour.viiversion.com/api/tilda/webhook?key=correct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    await expectHttpError(receiveTildaWebhook(request, e.value), 415, 'TILDA_UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects payloads over the declared size limit', async () => {
    const e = env('correct');
    const request = new Request('https://max-tour.viiversion.com/api/tilda/webhook?key=correct', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': String(MAX_TILDA_PAYLOAD_BYTES + 1),
      },
      body: 'name=Test',
    });
    await expectHttpError(receiveTildaWebhook(request, e.value), 413, 'TILDA_PAYLOAD_TOO_LARGE');
  });

  it('rejects payloads over the actual byte limit when content-length is absent', async () => {
    const e = env('correct');
    const request = new Request('https://max-tour.viiversion.com/api/tilda/webhook?key=correct', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `comments=${'x'.repeat(MAX_TILDA_PAYLOAD_BYTES + 32)}`,
    });
    await expectHttpError(receiveTildaWebhook(request, e.value), 413, 'TILDA_PAYLOAD_TOO_LARGE');
  });

  it('accepts a bounded form and stores normalized values', async () => {
    const e = env('correct');
    const form = new URLSearchParams({
      tranid: 'lead-42',
      formid: 'booking-form',
      name: `  ${'N'.repeat(260)}  `,
      phone: '+84 123 456 789',
      email: 'guest@example.com',
      comments: 'Нужна экскурсия в Далат',
    });
    const request = new Request('https://max-tour.viiversion.com/api/tilda/webhook?key=correct', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const result = await receiveTildaWebhook(request, e.value);
    expect(result).toMatchObject({ accepted: true, tranid: 'lead-42', formid: 'booking-form', duplicateSafe: true });
    expect(e.prepare).toHaveBeenCalledTimes(1);
    expect(e.bind).toHaveBeenCalledTimes(1);
    const args = e.bind.mock.calls[0];
    expect(args[1]).toBe('lead-42');
    expect(String(args[4]).length).toBe(200);
    expect(args[5]).toBe('+84 123 456 789');
    expect(args[6]).toBe('guest@example.com');
    expect(e.run).toHaveBeenCalledTimes(1);
  });
});
