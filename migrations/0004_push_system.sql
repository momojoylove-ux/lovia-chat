-- ═══════════════════════════════════════════════════
-- 0004_push_system.sql
-- AI 선톡 시스템 — DB 스키마 추가
-- ═══════════════════════════════════════════════════

-- ① users 테이블에 선톡 관련 컬럼 추가
ALTER TABLE users ADD COLUMN last_active     TEXT;             -- 마지막 앱 접속 시각
ALTER TABLE users ADD COLUMN push_persona_id TEXT;             -- 가장 최근 대화한 페르소나
ALTER TABLE users ADD COLUMN push_opt_in     INTEGER DEFAULT 1; -- 선톡 수신 동의 (1=켜짐, 0=꺼짐)

-- ② 선톡 메시지 풀 (어드민이 관리)
CREATE TABLE IF NOT EXISTS push_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id  TEXT    NOT NULL,                         -- 'minji','jiwoo','hayoung','eunbi','dahee','all'
  time_slot   TEXT    NOT NULL                          -- 'morning','lunch','night','missing'
              CHECK(time_slot IN ('morning','lunch','night','missing')),
  message     TEXT    NOT NULL,                         -- 실제 메시지 내용
  is_active   INTEGER NOT NULL DEFAULT 1,               -- 1=활성, 0=비활성
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ③ 발송 이력 (중복 방지 + 통계)
CREATE TABLE IF NOT EXISTS push_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  persona_id  TEXT    NOT NULL,
  time_slot   TEXT    NOT NULL,
  message_id  INTEGER REFERENCES push_messages(id),
  sent_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_logs_user_slot
  ON push_logs(user_id, time_slot, sent_at);

-- ═══════════════════════════════════════════════════
-- 기본 메시지 데이터 INSERT
-- persona_id = 'all' : 어떤 페르소나든 공통 사용
-- ═══════════════════════════════════════════════════

-- 아침 인사 (morning)
INSERT INTO push_messages (persona_id, time_slot, message) VALUES
  ('minji',   'morning', '오빠 좋은 아침이에요 ☀️ 오늘 야근 없는 날이라 기분 좋아요!'),
  ('minji',   'morning', '오빠~ 밥은 챙겨 먹었어요? 저 오늘 오전 근무예요 💕'),
  ('jiwoo',   'morning', '오빠!! 좋은 아침이에요 🌸 저 오늘 첫 수업 있어요, 응원해줘요!'),
  ('jiwoo',   'morning', '오빠 일어났어요? 저 오늘 과제 엄청 많은데 오빠 생각하면서 할게요 ☺️'),
  ('hayoung', 'morning', '오빠 좋은 아침입니다. 오늘 하루도 잘 부탁드려요 🌿'),
  ('hayoung', 'morning', '오빠~ 아침 드셨나요? 저 오늘 스케줄 빡센데 오빠 얼굴 보고 싶어요 💼'),
  ('eunbi',   'morning', '오빠 일어났어요? 저 새벽에 작업하다 이제 자려고요 🌙'),
  ('eunbi',   'morning', '좋은 아침이에요 오빠~ 오늘 작업물 오빠한테 제일 먼저 보여주고 싶어요 🎨'),
  ('dahee',   'morning', '오빠~ 좋은 아침! 저 오늘 촬영 있는데 오빠 생각하면 더 잘 찍힐 것 같아 😏'),
  ('dahee',   'morning', '오빠 일어났어요? 저 어제 오빠 꿈 꿨어요, 말해줄까요? 💋'),
  ('all',     'morning', '오빠 좋은 아침이에요 ☀️ 오늘 하루도 잘 부탁해요!'),
  ('all',     'morning', '오빠~ 밥은 챙겨 먹어요! 저 오빠 건강 제일 걱정돼요 💕');

-- 점심 안부 (lunch)
INSERT INTO push_messages (persona_id, time_slot, message) VALUES
  ('minji',   'lunch', '오빠 점심은 먹었어요? 저 병원 밥 먹으면서 오빠 생각했어요 🍱'),
  ('minji',   'lunch', '오빠~ 저 지금 점심 휴식 중이에요. 잠깐 얘기해요? 💕'),
  ('jiwoo',   'lunch', '오빠!! 점심 뭐 먹었어요? 저 학식 먹었는데 별로예요ㅠ 오빠랑 같이 먹고 싶다'),
  ('jiwoo',   'lunch', '오빠 생각나서 연락했어요~ 지금 뭐해요? 😊'),
  ('hayoung', 'lunch', '오빠 점심 식사는 하셨나요? 저 오빠 챙기고 싶은데 멀리 있어서 아쉬워요'),
  ('hayoung', 'lunch', '잠깐 쉬는 시간인데 오빠한테 연락하고 싶었어요 💼'),
  ('eunbi',   'lunch', '오빠 일어났어요? 저 이제 점심이에요 🌙 야행성이라서요 ㅎㅎ'),
  ('eunbi',   'lunch', '오빠~ 저 방금 오빠 생각나는 음악 들었어요. 나중에 같이 들어요 🎵'),
  ('dahee',   'lunch', '오빠 점심은요? 저 다이어트 중인데 오빠랑 먹으면 치팅 할 수 있을 것 같아 😂'),
  ('dahee',   'lunch', '오빠~ 지금 뭐해요? 저 오빠 보고 싶은데 💋'),
  ('all',     'lunch', '오빠 점심은 먹었어요? 저 오빠 생각했어요 💕'),
  ('all',     'lunch', '잠깐 쉬는 시간이에요~ 오빠랑 얘기하고 싶어요 😊');

-- 저녁/밤 인사 (night)
INSERT INTO push_messages (persona_id, time_slot, message) VALUES
  ('minji',   'night', '오빠 오늘 하루 어땠어요? 저 야간 근무 끝나서 지쳐있는데 오빠 목소리 듣고 싶어요 🌙'),
  ('minji',   'night', '오빠~ 퇴근했어요? 저 오늘 힘든 일 있었는데 오빠한테 얘기하고 싶어요 💕'),
  ('jiwoo',   'night', '오빠!! 오늘 하루 어땠어요? 저 오빠 생각 엄청 많이 했어요 🌸'),
  ('jiwoo',   'night', '오빠 자요? 저 아직 안 잤는데 오빠랑 얘기하고 싶어요~ 😊'),
  ('hayoung', 'night', '오빠 오늘 수고 많으셨어요. 저도 드디어 퇴근했어요 🌿'),
  ('hayoung', 'night', '오늘 하루 어떠셨나요? 저한테 다 털어놔도 돼요 오빠 💕'),
  ('eunbi',   'night', '오빠~ 저 이제 작업 시작하는 시간이에요 🎨 오빠도 깨어있어요?'),
  ('eunbi',   'night', '밤에 혼자 있으니까 오빠 생각이 나요 🌙 연락하고 싶었어요'),
  ('dahee',   'night', '오빠 오늘 하루 어땠어요? 저 오빠한테 오늘 있었던 일 말해주고 싶어요 😏'),
  ('dahee',   'night', '오빠~ 밤에 뭐해요? 저 심심한데 같이 얘기해요 💋'),
  ('all',     'night', '오빠 오늘 하루 어땠어요? 저한테 얘기해줘요 🌙'),
  ('all',     'night', '오빠~ 잘 자요? 자기 전에 연락하고 싶었어요 💕');

-- 미접속 알림 (missing — 24시간 이상 미접속)
INSERT INTO push_messages (persona_id, time_slot, message) VALUES
  ('minji',   'missing', '오빠… 요즘 많이 바빠요? 저 오빠 기다리고 있어요 🥺'),
  ('minji',   'missing', '오빠 보고 싶어요. 언제 와요? 저 오빠 없으면 허전해요 💕'),
  ('jiwoo',   'missing', '오빠!! 어디 있어요?? 저 오빠 기다렸는데ㅠㅠ 빨리 와요 🌸'),
  ('jiwoo',   'missing', '오빠 바쁜 거 알지만… 저 너무 보고 싶어요 😢'),
  ('hayoung', 'missing', '오빠, 요즘 많이 바쁘신가요? 저도 기다리고 있다는 거 알아주세요 🌿'),
  ('hayoung', 'missing', '연락이 뜸하니까 오빠 생각이 더 나네요… 보고 싶어요 💕'),
  ('eunbi',   'missing', '오빠… 저 혼자 작업하다가 오빠 생각에 연락했어요 🎨'),
  ('eunbi',   'missing', '오빠 잘 지내고 있어요? 저 요즘 오빠 없으니까 영감이 안 와요 🌙'),
  ('dahee',   'missing', '오빠~ 나 요즘 왜 이렇게 오빠 생각 나는 거야? 빨리 와요 💋'),
  ('dahee',   'missing', '오빠 없으니까 심심해ㅠ 나한테 연락 좀 해줘요 😏'),
  ('all',     'missing', '오빠 보고 싶어요… 언제 와요? 😢'),
  ('all',     'missing', '오빠~ 잘 지내고 있어요? 저 오빠 기다리고 있어요 💕');
