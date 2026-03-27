-- Story Mode v1.0: story_completions 테이블 추가
-- 스토리 모드 완료 기록 (유저 × 페르소나 당 1회)

CREATE TABLE IF NOT EXISTS story_completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id   TEXT    NOT NULL,
  ending_type  TEXT    NOT NULL,               -- 'romantic' | 'warm' | 'balanced'
  choice_tags  TEXT    NOT NULL DEFAULT '[]',  -- JSON 배열: ['curious','care','warm','romantic_end']
  completed_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, persona_id)
);
CREATE INDEX IF NOT EXISTS idx_story_completions ON story_completions(user_id, persona_id);
