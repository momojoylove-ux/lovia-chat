-- Ad Views v1.0: 리워드 광고 시청 기록
-- 일일 한도(5회) 추적 및 S2S Callback idempotency 처리

CREATE TABLE IF NOT EXISTS ad_views (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT    NOT NULL,
  transaction_id TEXT   NOT NULL UNIQUE,  -- AppLovin S2S event_id (idempotency key)
  ad_unit_id    TEXT    NOT NULL,
  credits       INTEGER NOT NULL DEFAULT 15,
  viewed_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  kst_date      TEXT    NOT NULL           -- KST 기준 날짜 (YYYY-MM-DD), 일일 한도 집계용
);

CREATE INDEX IF NOT EXISTS idx_ad_views_user_date ON ad_views(user_id, kst_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_views_tx  ON ad_views(transaction_id);
