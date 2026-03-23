-- ⑤ FCM 푸시 토큰 (디바이스별)
CREATE TABLE IF NOT EXISTS push_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT    NOT NULL,
  platform   TEXT    NOT NULL DEFAULT 'web',   -- 'web' | 'android' | 'ios'
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
