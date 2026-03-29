-- Onboarding v1.0: 온보딩 완료 상태 추가
-- 유저 테이블에 onboarding_completed 컬럼 추가

ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON users(onboarding_completed);
