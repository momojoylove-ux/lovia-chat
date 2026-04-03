-- Story Episodes v2.0: 멀티 에피소드 스토리 지원
-- 신규 캐릭터 10종 스토리 에피소드 진행 상태 추적

CREATE TABLE IF NOT EXISTS story_episode_progress (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id   TEXT    NOT NULL,
  episode_num  INTEGER NOT NULL DEFAULT 1,  -- 현재 완료된 최고 에피소드 번호
  unlocked_eps TEXT    NOT NULL DEFAULT '[]', -- JSON 배열: 잠금 해제된 에피소드 번호 목록
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_story_ep_progress ON story_episode_progress(user_id, persona_id);
