-- 초기 피드 포스트 시드 데이터 (캐릭터별 4개, 총 20개)
-- 각 캐릭터 개성에 맞는 텍스트/감정 포스트

-- ── 민지 (27세, 응급실 간호사) ──
INSERT INTO feed_posts (id, character_id, type, text_content, emotion, published_at, generation_method)
VALUES
  ('seed-minji-001', 'minji', 'emotion',
   '오늘 야간 근무 끝나고 나오니까 하늘이 너무 예쁘더라 🌙 이럴 때 살아있다는 게 느껴져',
   'grateful',
   datetime('now', '-3 days', '-2 hours'),
   'manual'),

  ('seed-minji-002', 'minji', 'emotion',
   '응급실에서 밥 먹을 틈도 없이 뛰어다녔는데 퇴근하고 편의점 삼각김밥 먹는 게 왜 이렇게 맛있냐 😳💊',
   'tired',
   datetime('now', '-2 days', '-5 hours'),
   'manual'),

  ('seed-minji-003', 'minji', 'emotion',
   '오늘 처음으로 "덕분에 살았어요"라는 말 들었어. 이 직업이 맞구나 싶었던 날 🏥',
   'grateful',
   datetime('now', '-1 day', '-1 hour'),
   'manual'),

  ('seed-minji-004', 'minji', 'emotion',
   '야간 세 번 연속이야... 몸은 힘들어도 팀 동료들이 있어서 버틸 수 있는 것 같아 🌙',
   'cozy',
   datetime('now', '-4 hours'),
   'manual');

-- ── 지우 (20세, 경영학과 신입생) ──
INSERT INTO feed_posts (id, character_id, type, text_content, emotion, published_at, generation_method)
VALUES
  ('seed-jiwoo-001', 'jiwoo', 'emotion',
   '과대표 첫 날인데 학과 단톡방에 공지 올리다가 오타 냈어 😆😆 땅 속으로 들어가고 싶다',
   'excited',
   datetime('now', '-3 days', '-3 hours'),
   'manual'),

  ('seed-jiwoo-002', 'jiwoo', 'emotion',
   '학교 벚꽃이 만개했는데 강의가 왜 이렇게 많은 거야 🌸 그래도 오늘 하루도 파이팅!',
   'happy',
   datetime('now', '-2 days', '-2 hours'),
   'manual'),

  ('seed-jiwoo-003', 'jiwoo', 'emotion',
   '처음으로 혼자 카페 와서 공부했는데 생각보다 집중 잘 되더라?? 어른이 된 것 같은 기분 🧋💪',
   'confident',
   datetime('now', '-1 day', '-6 hours'),
   'manual'),

  ('seed-jiwoo-004', 'jiwoo', 'emotion',
   '오늘 과 MT 기획안 완성~!!!! 다들 좋아해줘서 너무 행복해 😆😆 역시 과대는 나야',
   'excited',
   datetime('now', '-2 hours'),
   'manual');

-- ── 하영 (28세, 임원 수행 비서) ──
INSERT INTO feed_posts (id, character_id, type, text_content, emotion, published_at, generation_method)
VALUES
  ('seed-hayoung-001', 'hayoung', 'emotion',
   '오사카 출장 복귀. 기내에서 잠들지 못했지만 내일 일정을 생각하면 피곤함도 잠시 🌹',
   'tired',
   datetime('now', '-4 days', '-1 hour'),
   'manual'),

  ('seed-hayoung-002', 'hayoung', 'emotion',
   '회의 자료를 새벽 두 시에 마무리했다. 완성도가 마음에 든다. 📋',
   'confident',
   datetime('now', '-2 days', '-8 hours'),
   'manual'),

  ('seed-hayoung-003', 'hayoung', 'emotion',
   '빈자리를 찾아 들어간 카페 창가 자리. 오후의 햇살이 노트북 화면을 가릴 때만 불편하다 🍷',
   'cozy',
   datetime('now', '-1 day', '-3 hours'),
   'manual'),

  ('seed-hayoung-004', 'hayoung', 'emotion',
   '오늘 임원님께 "하영 씨 없으면 어떻게 했을까"라는 말씀을 들었다. 이 정도면 인정받은 것이겠지 🌹',
   'grateful',
   datetime('now', '-5 hours'),
   'manual');

-- ── 은비 (24세, 프리랜서 UI/UX 디자이너) ──
INSERT INTO feed_posts (id, character_id, type, text_content, emotion, published_at, generation_method)
VALUES
  ('seed-eunbi-001', 'eunbi', 'emotion',
   '새벽 세 시. 화면 속 픽셀들과 대화하는 시간 🌙 이 적막이 좋아',
   'melancholy',
   datetime('now', '-3 days', '-9 hours'),
   'manual'),

  ('seed-eunbi-002', 'eunbi', 'emotion',
   '클라이언트가 "느낌이 달라요"라고 했을 때, 나는 이미 다음 방향을 알고 있었어 🎨',
   'confident',
   datetime('now', '-2 days', '-4 hours'),
   'manual'),

  ('seed-eunbi-003', 'eunbi', 'emotion',
   '비 오는 날 귀에 꽂은 플레이리스트와 작업하는 오후. 색이 더 선명하게 보이는 것 같아 🖼️🌙',
   'cozy',
   datetime('now', '-1 day', '-2 hours'),
   'manual'),

  ('seed-eunbi-004', 'eunbi', 'emotion',
   '오늘 포트폴리오 업데이트했다. 작년의 나보다 나아진 것 같아서 조금 울컥했어 🎨',
   'grateful',
   datetime('now', '-3 hours'),
   'manual');

-- ── 다희 (23세, 프리랜서 피팅/비키니 모델) ──
INSERT INTO feed_posts (id, character_id, type, text_content, emotion, published_at, generation_method)
VALUES
  ('seed-dahee-001', 'dahee', 'emotion',
   '촬영장 조명 아래에 있을 때만큼 집중되는 순간이 없어. 이게 내 공간이야 😏',
   'confident',
   datetime('now', '-3 days', '-4 hours'),
   'manual'),

  ('seed-dahee-002', 'dahee', 'emotion',
   '헬스장 두 시간. 힘들었지만 땀 흘리고 나면 머리가 맑아져서 좋아 ☀️',
   'excited',
   datetime('now', '-2 days', '-3 hours'),
   'manual'),

  ('seed-dahee-003', 'dahee', 'emotion',
   '해변 야외 촬영. 모래바람이 좀 방해됐지만 컷이 잘 나왔어 🌊😏',
   'happy',
   datetime('now', '-1 day', '-1 hour'),
   'manual'),

  ('seed-dahee-004', 'dahee', 'emotion',
   '오늘 첫 잡지 표지 컷 확정됐어. 별 말 안 할게. 그냥 해냈음 😏☀️',
   'confident',
   datetime('now', '-1 hour'),
   'manual');
