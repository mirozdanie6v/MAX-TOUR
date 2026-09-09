import { describe, expect, it, vi } from 'vitest';
import { cleanupExpiredDemoSessions } from '../src/worker/services/maintenance';

describe('demo session maintenance', () => {
  it('deletes expired sessions and reports the count', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const prepare = vi.fn((sql: string) => {
      if (sql.startsWith('SELECT COUNT(*)')) return { first: vi.fn().mockResolvedValue({ n: 3 }) };
      if (sql.startsWith('DELETE FROM demo_sessions')) return { run };
      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const result = await cleanupExpiredDemoSessions({ DB: { prepare } } as any);
    expect(result.expiredSessionsDeleted).toBe(3);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('skips DELETE when there are no expired sessions', async () => {
    const prepare = vi.fn((sql: string) => {
      if (sql.startsWith('SELECT COUNT(*)')) return { first: vi.fn().mockResolvedValue({ n: 0 }) };
      throw new Error(`DELETE must not run when count is zero: ${sql}`);
    });
    const result = await cleanupExpiredDemoSessions({ DB: { prepare } } as any);
    expect(result.expiredSessionsDeleted).toBe(0);
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});
