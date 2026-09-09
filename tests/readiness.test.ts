import { describe, expect, it, vi } from 'vitest';
import { getProductionReadiness } from '../src/worker/services/readiness';

const tables = [
  'app_settings','destinations','tours','demo_sessions','orders','payments','analytics_events',
  'notification_outbox','tilda_webhook_inbox','demo_audit_log','demo_order_workflows',
  'demo_customer_records','staff_accounts','demo_owner_settings',
];

function makeDb(staff = { total: 0, active: 0, owners: 0 }) {
  return {
    prepare: vi.fn((sql: string) => {
      if (sql.includes('FROM staff_accounts') && sql.includes('COUNT(*) AS total')) {
        return { first: vi.fn().mockResolvedValue(staff) };
      }
      if (sql.includes('FROM notification_outbox')) {
        return { bind: vi.fn().mockReturnValue({ all: vi.fn().mockResolvedValue({ results: [] }) }) };
      }
      if (sql.includes('FROM tilda_webhook_inbox')) {
        return { all: vi.fn().mockResolvedValue({ results: [] }) };
      }
      if (sql.includes('sqlite_master')) {
        return { all: vi.fn().mockResolvedValue({ results: tables.map(name => ({ name })) }) };
      }
      throw new Error(`Unexpected SQL in readiness test: ${sql}`);
    }),
  };
}

describe('production readiness diagnostics', () => {
  it('reports internal implementation complete while listing external blockers', async () => {
    const env: any = {
      DB: makeDb(),
      AUTH_MODE: 'demo',
      TELEGRAM_MINIAPP_URL: 'https://max-tour.viiversion.com',
    };

    const result = await getProductionReadiness(env, 'demo-session');
    expect(result.preExternalImplementationComplete).toBe(true);
    expect(result.database.missingTables).toEqual([]);
    expect(result.externalBlockerCount).toBeGreaterThanOrEqual(8);
    expect(result.externalBlockers.map(item => item.key)).toEqual(expect.arrayContaining([
      'telegram_bot_token','auth_mode','tilda_secret','tilda_mapping','payment_provider','live_inventory','production_media',
    ]));
    expect(result.boundaries.payments.demoFlowReady).toBe(true);
    expect(result.boundaries.inventory.adminAvailabilityReady).toBe(true);
  });

  it('removes configured Telegram/Tilda transport blockers but keeps business-source blockers', async () => {
    const env: any = {
      DB: makeDb({ total: 1, active: 1, owners: 1 }),
      AUTH_MODE: 'telegram',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      TELEGRAM_MANAGER_CHAT_ID: '100',
      TELEGRAM_OWNER_CHAT_ID: '200',
      TELEGRAM_MINIAPP_URL: 'https://max-tour.viiversion.com',
      TILDA_WEBHOOK_SECRET: 'tilda-secret',
    };

    const result = await getProductionReadiness(env, 'demo-session');
    const keys = result.externalBlockers.map(item => item.key);
    expect(keys).not.toContain('telegram_bot_token');
    expect(keys).not.toContain('telegram_webhook_secret');
    expect(keys).not.toContain('telegram_manager_chat');
    expect(keys).not.toContain('telegram_owner_chat');
    expect(keys).not.toContain('auth_mode');
    expect(keys).not.toContain('tilda_secret');
    expect(keys).toEqual(expect.arrayContaining(['tilda_mapping','payment_provider','live_inventory','production_media']));
  });
});
