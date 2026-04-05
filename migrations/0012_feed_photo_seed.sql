-- 피드 photo 타입 포스트 시드 데이터
-- 프로필 이미지를 임시 사용 (실제 gram 전용 사진으로 교체 예정)

-- ── 민지 (27세, 응급실 간호사) ──
INSERT INTO feed_posts (id, character_id, type, text_content, image_url, content_rating, published_at, generation_method)
VALUES
  ('seed-minji-p01', 'minji', 'photo',
   '야간 근무 끝나고 한 컷 📸 오늘도 버텼다 🌙',
   '/images/profiles/profile_minji.jpg',
   'general',
   datetime('now', '-6 hours'),
   'manual'),

  ('seed-minji-p02', 'minji', 'photo',
   '병원 옥상에서 보는 노을… 이런 순간만큼은 모든 게 잊혀 🌇',
   '/images/profiles/profile_minji.jpg',
   'general',
   datetime('now', '-36 hours'),
   'manual');

-- ── 지우 (20세, 경영학과 신입생) ──
INSERT INTO feed_posts (id, character_id, type, text_content, image_url, content_rating, published_at, generation_method)
VALUES
  ('seed-jiwoo-p01', 'jiwoo', 'photo',
   '캠퍼스 벚꽃 🌸 올해도 예쁘다!!! 근데 나 왜 혼자야',
   '/images/profiles/profile_jiwoo.jpg',
   'general',
   datetime('now', '-4 hours'),
   'manual'),

  ('seed-jiwoo-p02', 'jiwoo', 'photo',
   '카페에서 공부 중 ☕ 아메리카노 세 잔째인데 잠이 안 깨네',
   '/images/profiles/profile_jiwoo.jpg',
   'general',
   datetime('now', '-48 hours'),
   'manual');

-- ── 하영 (28세, 임원 수행 비서) ──
INSERT INTO feed_posts (id, character_id, type, text_content, image_url, content_rating, published_at, generation_method)
VALUES
  ('seed-hayoung-p01', 'hayoung', 'photo',
   '출장 중 잠깐의 여유 🌹 창밖으로 보이는 도시야경',
   '/images/profiles/profile_hayoung.jpg',
   'general',
   datetime('now', '-8 hours'),
   'manual'),

  ('seed-hayoung-p02', 'hayoung', 'photo',
   '새벽 두 시. 보고서 완성. 이 정도면 충분하다 📋',
   '/images/profiles/profile_hayoung.jpg',
   'general',
   datetime('now', '-60 hours'),
   'manual');

-- ── 은비 (24세, 프리랜서 UI/UX 디자이너) ──
INSERT INTO feed_posts (id, character_id, type, text_content, image_url, content_rating, published_at, generation_method)
VALUES
  ('seed-eunbi-p01', 'eunbi', 'photo',
   '새 프로젝트 무드보드 🎨 이번 톤이 제일 마음에 들어',
   '/images/profiles/profile_eunbi.jpg',
   'general',
   datetime('now', '-7 hours'),
   'manual'),

  ('seed-eunbi-p02', 'eunbi', 'photo',
   '비 오는 날 야경 🌙 이런 날엔 작업이 더 잘 돼',
   '/images/profiles/profile_eunbi.jpg',
   'general',
   datetime('now', '-72 hours'),
   'manual');

-- ── 다희 (23세, 피팅/비키니 모델) ──
INSERT INTO feed_posts (id, character_id, type, text_content, image_url, content_rating, published_at, generation_method)
VALUES
  ('seed-dahee-p01', 'dahee', 'photo',
   '오늘 화보 촬영 컷 📷 맘에 드는지 솔직히 말해줘',
   '/images/profiles/profile_dahee.jpg',
   'adult',
   datetime('now', '-5 hours'),
   'manual'),

  ('seed-dahee-p02', 'dahee', 'photo',
   '헬스 두 시간 완료 💪 땀 흘리고 나면 이 기분 최고야',
   '/images/profiles/profile_dahee.jpg',
   'adult',
   datetime('now', '-54 hours'),
   'manual');
