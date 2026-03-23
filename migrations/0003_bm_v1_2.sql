-- BM v1.2 마이그레이션: gram_unlocks, relationship_levels, voice_messages 테이블 추가

-- ⑤ 그램 잠금 해제 내역 (유저 × 포스트)
CREATE TABLE IF NOT EXISTS gram_unlocks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    TEXT    NOT NULL,              -- 'gm3', 'gj3' 등 GRAM_POSTS id
  cost       INTEGER NOT NULL DEFAULT 15,  -- 차감 크레딧 (GRAM_UNLOCK_COST)
  unlocked_at TEXT   NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_gram_unlocks_user ON gram_unlocks(user_id);

-- ⑥ 관계 레벨 (유저 × 페르소나)
--   level: 1=짝사랑 2=썸 3=연인 4=진지한연인 5=운명
--   chat_count: 누적 채팅 횟수
CREATE TABLE IF NOT EXISTS relationship_levels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id TEXT    NOT NULL,
  chat_count INTEGER NOT NULL DEFAULT 0,
  level      INTEGER NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 5),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, persona_id)
);
CREATE INDEX IF NOT EXISTS idx_rel_levels_user ON relationship_levels(user_id, persona_id);

-- ⑦ 음성 메시지 내역 (5C/회)
CREATE TABLE IF NOT EXISTS voice_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id  TEXT    NOT NULL,
  text        TEXT    NOT NULL,   -- TTS 변환된 텍스트
  cost        INTEGER NOT NULL DEFAULT 5,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_voice_messages_user ON voice_messages(user_id);

-- ⑧ 인라인 특별 사진 내역 (10C/장)
CREATE TABLE IF NOT EXISTS special_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id  TEXT    NOT NULL,
  image_url   TEXT    NOT NULL,
  cost        INTEGER NOT NULL DEFAULT 10,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_special_photos_user ON special_photos(user_id);

-- users 테이블 기본 크레딧 업데이트 (기존 데이터는 유지)
-- 신규 가입자는 200C로 시작
UPDATE users SET credits = 200 WHERE credits = 150 AND created_at > datetime('now', '-1 day');
