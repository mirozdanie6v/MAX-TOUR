import type { Env } from '../db/repository';
import { getAuthReadiness } from './telegram-auth';
import { getIntegrationStatus } from './notifications';
import { getTildaIntegrationStatus } from './tilda';

const REQUIRED_TABLES = [
  'app_settings',
  'destinations',
  'tours',
  'demo_sessions',
  'orders',
  'payments',
  'analytics_events',
  'notification_outbox',
  'tilda_webhook_inbox',
  'demo_audit_log',
  'demo_order_workflows',
  'demo_customer_records',
  'staff_accounts',
  'demo_owner_settings',
];

export async function getProductionReadiness(env: Env, sessionId: string) {
  const [auth, telegram, tilda, tableRows] = await Promise.all([
    getAuthReadiness(env),
    getIntegrationStatus(env, sessionId),
    getTildaIntegrationStatus(env),
    env.DB.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all<{name:string}>(),
  ]);

  const existingTables = new Set((tableRows.results ?? []).map(row => String(row.name)));
  const missingTables = REQUIRED_TABLES.filter(name => !existingTables.has(name));

  const blockers: Array<{ key: string; area: string; required: string }> = [];
  if (!auth.botTokenConfigured) blockers.push({ key:'telegram_bot_token', area:'Telegram', required:'TELEGRAM_BOT_TOKEN' });
  if (!telegram.telegram.webhookSecretConfigured) blockers.push({ key:'telegram_webhook_secret', area:'Telegram', required:'TELEGRAM_WEBHOOK_SECRET' });
  if (!telegram.telegram.managerChatConfigured) blockers.push({ key:'telegram_manager_chat', area:'Telegram', required:'TELEGRAM_MANAGER_CHAT_ID' });
  if (!telegram.telegram.ownerChatConfigured) blockers.push({ key:'telegram_owner_chat', area:'Telegram', required:'TELEGRAM_OWNER_CHAT_ID' });
  if (!auth.bootstrapOwnerConfigured && auth.activeOwners < 1) blockers.push({ key:'telegram_owner_identity', area:'Access', required:'Bootstrap Owner Telegram user ID or an existing active Owner' });
  if (auth.authMode !== 'telegram') blockers.push({ key:'auth_mode', area:'Access', required:'AUTH_MODE=telegram after Telegram identity configuration' });
  if (!tilda.configured) blockers.push({ key:'tilda_secret', area:'Tilda', required:'TILDA_WEBHOOK_SECRET' });
  if (!tilda.mappingReady) blockers.push({ key:'tilda_mapping', area:'Tilda', required:'Confirmed real form fields and hidden tour identifiers' });
  blockers.push({ key:'payment_provider', area:'Payments', required:'Selected payment provider, credentials, verified callbacks/webhooks and fee rules' });
  blockers.push({ key:'live_inventory', area:'Inventory', required:'Authoritative MAX TOUR schedule/capacity source and seat-locking rules' });
  blockers.push({ key:'production_media', area:'Media', required:'Approved/licensed production image set and storage decision (R2 when required)' });

  return {
    generatedAt: new Date().toISOString(),
    phase: 'pre_external_configuration',
    preExternalImplementationComplete: missingTables.length === 0,
    database: {
      healthy: missingTables.length === 0,
      requiredTables: REQUIRED_TABLES.length,
      missingTables,
    },
    access: auth,
    telegram,
    tilda,
    boundaries: {
      payments: { demoFlowReady: true, productionProviderConfigured: false },
      inventory: { adminAvailabilityReady: true, liveSourceConfigured: false },
      media: { galleryReady: true, productionStorageConfigured: false },
    },
    externalBlockers: blockers,
    externalBlockerCount: blockers.length,
  };
}
