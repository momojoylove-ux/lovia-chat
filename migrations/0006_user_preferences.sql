-- User Preferences v1.0: 추천 스킵 설정 추가
-- 유저 테이블에 skip_recommend 컬럼 추가

ALTER TABLE users ADD COLUMN skip_recommend INTEGER NOT NULL DEFAULT 0;
