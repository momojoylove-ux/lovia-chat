-- ① 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    UNIQUE NOT NULL,
  nickname    TEXT    NOT NULL,
  credits     INTEGER NOT NULL DEFAULT 150,   -- 가입 보너스 포함
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login  TEXT
);

-- ② AI 대화 이력 (페르소나별)
CREATE TABLE IF NOT EXISTS chat_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id  TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK(role IN ('me','ai')),
  content     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ③ 장기 기억 요약 (페르소나 × 유저 조합별)
CREATE TABLE IF NOT EXISTS user_memory (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id  TEXT    NOT NULL,
  memory_text TEXT    NOT NULL,   -- "재현은 개발자, 고양이 좋아함" 형식
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, persona_id)
);

-- ④ 크레딧 내역
CREATE TABLE IF NOT EXISTS credit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL CHECK(type IN ('earn','spend')),
  amount      INTEGER NOT NULL,
  reason      TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_history_user_persona ON chat_history(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_persona  ON user_memory(user_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_credit_logs_user          ON credit_logs(user_id);
