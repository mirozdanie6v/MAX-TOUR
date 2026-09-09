import { describe, expect, it } from 'vitest';
import { assertTrustedMutationRequest } from '../src/worker/services/request-security';
import { HttpError } from '../src/worker/services/booking';

const appOrigin = 'https://max-tour.viiversion.com';

function expectBlocked(request: Request, path: string) {
  try {
    assertTrustedMutationRequest(request, appOrigin, path);
    throw new Error('Expected mutation request to be blocked');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe('CROSS_SITE_MUTATION_BLOCKED');
  }
}

describe('browser mutation origin guard', () => {
  it('allows safe read methods regardless of Origin', () => {
    const request = new Request(`${appOrigin}/api/tours`, {
      method: 'GET',
      headers: { origin: 'https://example.org', 'sec-fetch-site': 'cross-site' },
    });
    expect(() => assertTrustedMutationRequest(request, appOrigin, '/api/tours')).not.toThrow();
  });

  it('allows same-origin browser mutations', () => {
    const request = new Request(`${appOrigin}/api/orders`, {
      method: 'POST',
      headers: { origin: appOrigin, 'sec-fetch-site': 'same-origin' },
      body: '{}',
    });
    expect(() => assertTrustedMutationRequest(request, appOrigin, '/api/orders')).not.toThrow();
  });

  it('allows server-to-server mutations when browser origin headers are absent', () => {
    const request = new Request(`${appOrigin}/api/orders`, { method: 'POST', body: '{}' });
    expect(() => assertTrustedMutationRequest(request, appOrigin, '/api/orders')).not.toThrow();
  });

  it('blocks an explicit foreign Origin', () => {
    const request = new Request(`${appOrigin}/api/orders`, {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: '{}',
    });
    expectBlocked(request, '/api/orders');
  });

  it('blocks Sec-Fetch-Site cross-site even without Origin', () => {
    const request = new Request(`${appOrigin}/api/admin/tours`, {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
      body: '{}',
    });
    expectBlocked(request, '/api/admin/tours');
  });

  it('exempts Telegram and Tilda webhook endpoints', () => {
    for (const path of ['/api/telegram/webhook', '/api/tilda/webhook']) {
      const request = new Request(`${appOrigin}${path}`, {
        method: 'POST',
        headers: { origin: 'https://external-provider.example', 'sec-fetch-site': 'cross-site' },
        body: '{}',
      });
      expect(() => assertTrustedMutationRequest(request, appOrigin, path)).not.toThrow();
    }
  });
});
