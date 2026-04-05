-- 성인인증 관련 컬럼 추가 (LOV-56, LOV-57)
ALTER TABLE users ADD COLUMN adult_verified        INTEGER NOT NULL DEFAULT 0;       -- BOOLEAN
ALTER TABLE users ADD COLUMN adult_verified_at     TEXT    NULL;                     -- TIMESTAMP
ALTER TABLE users ADD COLUMN adult_verified_method TEXT    NULL;                     -- 'nice_pass' 등
ALTER TABLE users ADD COLUMN adult_block           INTEGER NOT NULL DEFAULT 0;       -- 미성년자 확인 시 1

-- 나이스인증 세션 임시 저장 테이블 (callback 시 token_val 조회용)
CREATE TABLE IF NOT EXISTS nice_sessions (
  token_version_id TEXT PRIMARY KEY,
  token_val        TEXT NOT NULL,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 피드 포스트 콘텐츠 등급 컬럼 추가 (LOV-57)
-- 참고: 캐릭터(personas) 등급은 앱 코드 CHARACTER_CONFIGS에서 content_rating 필드로 관리
ALTER TABLE feed_posts ADD COLUMN content_rating  TEXT NOT NULL DEFAULT 'general';  -- 'general' | 'adult'
