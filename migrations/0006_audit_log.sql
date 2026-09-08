PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  actor_id TEXT NOT NULL DEFAULT 'demo',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES demo_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_log_session_created
  ON audit_log(session_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(session_id, entity_type, entity_id, created_at DESC);
