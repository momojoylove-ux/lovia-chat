-- Feed v1.0: 인스타그램형 피드 시스템
-- FeedPost 테이블: 캐릭터가 올리는 피드 게시물

CREATE TABLE IF NOT EXISTS feed_posts (
  id            TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  character_id  TEXT    NOT NULL,
  type          TEXT    NOT NULL CHECK(type IN ('photo', 'text', 'emotion', 'story_tease')),
  -- content JSON 필드들
  text_content  TEXT,                     -- 캡션 또는 텍스트 본문
  image_url     TEXT,                     -- 사진 URL (photo 타입)
  emotion       TEXT,                     -- 감정 태그 (emotion 타입)
  story_ref     TEXT,                     -- 연결 스토리 ID (story_tease 타입)
  -- 메타
  published_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT,                     -- NULL = 만료 없음
  -- 반응 카운터
  heart_count   INTEGER NOT NULL DEFAULT 0,
  dm_start_count INTEGER NOT NULL DEFAULT 0,
  -- AI 생성 메타
  generation_method TEXT NOT NULL DEFAULT 'ai_auto' CHECK(generation_method IN ('ai_auto', 'manual')),
  generation_prompt  TEXT,               -- AI 생성 시 사용된 프롬프트 (내부용)
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_character ON feed_posts(character_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_published ON feed_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_expires   ON feed_posts(expires_at) WHERE expires_at IS NOT NULL;

-- 피드 반응 테이블: 유저별 하트 중복 방지
CREATE TABLE IF NOT EXISTS feed_reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    TEXT    NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL DEFAULT 'heart' CHECK(type IN ('heart')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_feed_reactions_post ON feed_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_user ON feed_reactions(user_id);

-- chat_sessions: 피드 DM 시작 컨텍스트 저장용 (기존 chat_history에 sourceContext 추가)
-- 신규 테이블로 DM 세션 관리
CREATE TABLE IF NOT EXISTS chat_sessions (
  id             TEXT    PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id   TEXT    NOT NULL,
  source_context TEXT    NOT NULL DEFAULT 'direct' CHECK(source_context IN ('direct', 'feed', 'story', 'onboarding')),
  feed_post_id   TEXT    REFERENCES feed_posts(id) ON DELETE SET NULL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, character_id);
