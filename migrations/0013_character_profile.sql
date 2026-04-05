-- Character Profile v1.0: 팔로우 시스템 + 캐릭터 스탯
-- LOV-78: 캐릭터 프로필 API 3종 구현

-- 캐릭터 스탯 테이블 (팔로워/팔로잉/게시물 수 캐싱)
CREATE TABLE IF NOT EXISTS character_stats (
  character_id     TEXT    PRIMARY KEY,
  follower_count   INTEGER NOT NULL DEFAULT 0,
  following_count  INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 유저-캐릭터 팔로우 관계 테이블
CREATE TABLE IF NOT EXISTS user_character_follows (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT    NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_user      ON user_character_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_character ON user_character_follows(character_id);

-- 캐릭터별 초기 팔로워/팔로잉 수 시딩 (AI 생성 느낌의 랜덤값)
INSERT OR IGNORE INTO character_stats (character_id, follower_count, following_count) VALUES
  ('minji',   8420,  312),
  ('jiwoo',   5230,  481),
  ('hayoung', 12700, 198),
  ('eunbi',   3860,  267),
  ('dahee',   19400, 143),
  ('yujin',   6110,  389),
  ('sea',     4720,  524),
  ('nari',    7380,  305),
  ('rina',    5940,  412),
  ('soyul',   9150,  278),
  ('hyewon',  11200, 156),
  ('sua',     4380,  341),
  ('miso',    6760,  293);
