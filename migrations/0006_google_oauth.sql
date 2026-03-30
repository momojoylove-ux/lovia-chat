-- Google OAuth 지원을 위한 users 테이블 확장
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;

-- Google OAuth로 가입한 유저 빠른 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
