import { describe, expect, it } from 'vitest';
import { bokunUtcDate, signBokunRestRequest } from '../src/worker/services/bokun-rest';

describe('Bókun REST authentication', () => {
  it('formats UTC date as required by Bókun', () => {
    expect(bokunUtcDate(new Date('2026-09-24T13:14:15.999Z'))).toBe('2026-09-24 13:14:15');
  });

  it('matches Bókun documentation HMAC-SHA1 example', async () => {
    const signature = await signBokunRestRequest(
      '23e2c7da7f7048e5b46f96bc91324800',
      '2013-11-09 14:33:46',
      'de235a6a15c340b6b1e1cb5f3687d04a',
      'POST',
      '/activity.json/search?lang=EN&currency=ISK',
    );
    expect(signature).toBe('XrOiTYa9Y34zscnLCsAEh8ieoyo=');
  });
});
