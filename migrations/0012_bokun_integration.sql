CREATE TABLE IF NOT EXISTS bokun_oauth_states (
  state TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bokun_oauth_states_expiry
  ON bokun_oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS bokun_installations (
  vendor_id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  scopes TEXT NOT NULL,
  access_token_ciphertext TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  product_code TEXT NOT NULL DEFAULT ''
);
