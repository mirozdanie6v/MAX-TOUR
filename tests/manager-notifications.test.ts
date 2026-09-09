import { describe, expect, it, vi } from 'vitest';
import { shouldNotifyManager } from '../src/worker/services/orders';

function envWithSetting(value: number | null) {
  const first = vi.fn().mockResolvedValue(value === null ? null : { manager_notifications: value });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { env: { DB: { prepare } } as any, prepare, bind, first };
}

describe('Owner manager-notification rule', () => {
  it('defaults to enabled when no owner settings row exists', async () => {
    const e = envWithSetting(null);
    await expect(shouldNotifyManager(e.env, 'session')).resolves.toBe(true);
  });

  it('respects disabled manager notifications', async () => {
    const e = envWithSetting(0);
    await expect(shouldNotifyManager(e.env, 'session')).resolves.toBe(false);
  });

  it('respects enabled manager notifications', async () => {
    const e = envWithSetting(1);
    await expect(shouldNotifyManager(e.env, 'session')).resolves.toBe(true);
  });
});
