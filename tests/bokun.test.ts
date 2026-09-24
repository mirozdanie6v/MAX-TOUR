import { describe, expect, it } from 'vitest';
import { canonicalBokunQuery, verifyBokunHmac } from '../src/worker/services/bokun';

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

describe('Bókun OAuth request verification', () => {
  it('canonicalizes query parameters alphabetically and excludes hmac', () => {
    const url = new URL('https://example.test/install?timestamp=10&domain=robinson&hmac=deadbeef&code=abc');
    expect(canonicalBokunQuery(url)).toBe('code=abc&domain=robinson&timestamp=10');
  });

  it('verifies a valid HMAC-SHA256 signature', async () => {
    const secret = 'unit-test-secret';
    const unsigned = new URL('https://example.test/install?timestamp=10&domain=robinson&code=abc');
    const hmac = await sign(secret, canonicalBokunQuery(unsigned));
    const signed = new URL(unsigned.toString() + '&hmac=' + hmac);
    await expect(verifyBokunHmac(signed, secret)).resolves.toBe(true);
  });

  it('rejects a modified request', async () => {
    const secret = 'unit-test-secret';
    const unsigned = new URL('https://example.test/install?timestamp=10&domain=robinson&code=abc');
    const hmac = await sign(secret, canonicalBokunQuery(unsigned));
    const tampered = new URL('https://example.test/install?timestamp=11&domain=robinson&code=abc&hmac=' + hmac);
    await expect(verifyBokunHmac(tampered, secret)).resolves.toBe(false);
  });
});
