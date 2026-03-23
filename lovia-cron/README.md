# lovia-cron — AI 선톡 Cron Worker

## 개요
Lovia AI 선톡 기능을 위한 Cloudflare Workers Cron 트리거입니다.
메인 앱(`lovia` Pages)과 동일한 D1 데이터베이스를 공유합니다.

## 크론 스케줄 (KST 기준)
| 시간대 | UTC | KST | 용도 |
|--------|-----|-----|------|
| morning | 00:00 | 09:00 | 아침 선톡 |
| lunch | 03:00 | 12:00 | 점심 선톡 |
| night | 13:00 | 22:00 | 밤 선톡 |
| missing | 21:00 | 06:00 | 24h 미접속 리마인더 |

## 배포 전 필수 조건

### 1. Cloudflare Workers.dev 서브도메인 활성화
> **⚠️ 최초 1회 필요**
> https://dash.cloudflare.com → Workers & Pages → 처음 방문하면 자동 서브도메인 생성

### 2. 배포 명령
```bash
cd lovia-cron
npx wrangler@4 deploy --config wrangler.toml
```

### 3. Secrets 등록 (메인 앱과 동일한 값 사용)
```bash
# Firebase 서비스 계정 JSON
npx wrangler@4 secret put FIREBASE_SERVICE_ACCOUNT --name lovia-cron

# Firebase 프로젝트 ID (예: lovia-23d7a)
npx wrangler@4 secret put FIREBASE_PROJECT_ID --name lovia-cron
```

## 발송 로직
1. Cron 트리거 → 현재 UTC 시간으로 `time_slot` 결정
2. `push_opt_in = 1` + `push_tokens` 등록된 유저 조회
3. `missing` 슬롯: 24시간 이상 미접속 유저 대상
4. 일반 슬롯: 오늘 같은 슬롯 발송 이력 없는 유저 대상
5. `push_messages` 테이블에서 해당 페르소나·슬롯 메시지 랜덤 선택
6. FCM 발송 → `push_logs` 기록

## 메시지 풀 관리
```sql
-- 메시지 추가
INSERT INTO push_messages (persona_id, time_slot, message) 
VALUES ('minji', 'morning', '오빠 좋은 아침이에요! ☀️');

-- 비활성화
UPDATE push_messages SET is_active = 0 WHERE id = ?;
```

또는 메인 앱 API 사용:
- `GET /api/push/messages?persona_id=minji&time_slot=morning`
- `POST /api/push/messages` `{ persona_id, time_slot, message }`
- `PATCH /api/push/messages/:id` `{ is_active: false }`
- `DELETE /api/push/messages/:id`
