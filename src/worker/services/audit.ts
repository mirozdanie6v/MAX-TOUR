import type { Env } from '../db/repository';

export type AuditRole = 'manager' | 'admin' | 'owner';

export interface AuditEntry {
  id: number;
  actorRole: AuditRole;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function encode(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function decode(value: unknown) {
  if (typeof value !== 'string' || value === '') return null;
  try { return JSON.parse(value); } catch { return null; }
}

export async function recordAudit(
  env: Env,
  sessionId: string,
  actorRole: AuditRole,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  metadata: Record<string, unknown> = {},
  actorId = 'demo',
) {
  await env.DB.prepare(`INSERT INTO audit_log(
    session_id,actor_role,actor_id,action,entity_type,entity_id,before_json,after_json,metadata_json
  ) VALUES (?,?,?,?,?,?,?,?,?)`).bind(
    sessionId,
    actorRole,
    actorId.slice(0, 120),
    action.slice(0, 120),
    entityType.slice(0, 80),
    entityId.slice(0, 180),
    encode(before),
    encode(after),
    JSON.stringify(metadata),
  ).run();
}

export async function listAudit(env: Env, sessionId: string, params: URLSearchParams): Promise<{items: AuditEntry[]}> {
  const limit = Math.max(1, Math.min(100, Number(params.get('limit') ?? 30) || 30));
  const role = params.get('role');
  const entityType = params.get('entityType');
  const clauses = ['session_id=?'];
  const bindings: unknown[] = [sessionId];
  if (role && ['manager','admin','owner'].includes(role)) {
    clauses.push('actor_role=?');
    bindings.push(role);
  }
  if (entityType) {
    clauses.push('entity_type=?');
    bindings.push(entityType.slice(0,80));
  }
  bindings.push(limit);
  const result = await env.DB.prepare(`SELECT id,actor_role,actor_id,action,entity_type,entity_id,before_json,after_json,metadata_json,created_at
    FROM audit_log WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...bindings).all<any>();
  return {
    items: (result.results ?? []).map(row => ({
      id: Number(row.id),
      actorRole: row.actor_role,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      before: decode(row.before_json),
      after: decode(row.after_json),
      metadata: decode(row.metadata_json) ?? {},
      createdAt: row.created_at,
    })),
  };
}
