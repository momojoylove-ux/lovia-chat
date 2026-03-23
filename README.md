# 💝 Lovia — AI 애인/관계 형성 앱

> **버전**: v1.2  
> **최종 업데이트**: 2026-02-23  
> **배포 상태**: ✅ 프로덕션 배포 완료

---

## 📌 프로젝트 개요

Lovia는 AI 페르소나와 감성적인 관계를 형성하는 웹앱입니다.  
"처음부터 설레는 AI 애인"이라는 컨셉으로, 이미 썸 타는 관계로 시작합니다.

- **플랫폼**: PWA → TWA → Google Play 예정
- **기술 스택**: Cloudflare Pages + Hono (Edge) + Gemini API + D1 SQLite
- **타겟**: 20~35세 남성, 외로움 해소 / 연애 감각 유지

---

## 🔗 주요 URL

| 항목 | URL |
|------|-----|
| **프로덕션** | https://lovia.pages.dev |
| **최신 미리보기** | https://2260e690.lovia.pages.dev |
| **GitHub** | https://github.com/momojoylove-ux/lovia-project |
| **로컬 개발** | http://localhost:3000 |

---

## ✅ 화면 구성 & 구현 현황

| # | 화면 | 상태 | 비고 |
|---|------|------|------|
| ① | 스플래시 | ✅ 완료 | 랜덤 이미지, 3.5초 폴백 |
| ② | 매니저 AI 동영상 | ✅ 완료 | A/B 영상 랜덤, 말풍선 타이핑 |
| ③ | 이름 입력 | ✅ 완료 | 10자 제한, sessionStorage 저장 |
| ④ | 프로필 스와이프 | ✅ 완료 | Tinder형, 카드/목록 뷰, 튜토리얼 |
| ⑤ | 프로필 상세 | ✅ 완료 | 히어로 이미지, 그램 미니 피드 |
| ⑥ | 채팅방 | ✅ 완료 | Gemini API, 0.5C/메시지, 음성/사진 버튼 |
| ⑦ | 채팅 허브 | ✅ 완료 | 대화 목록, 파트너 수, 마지막 메시지 |
| ⑧ | 관심/패스 관리 | ✅ 완료 | 탭 분리, 그리드 뷰 |
| ⑨ | 인앱 그램 | ✅ 완료 | 잠금 해제(15C), 좋아요, 필터 |
| ⑩ | 크레딧 충전 | ✅ 완료 | v1.2 패키지 5종 + Starter 팝업 |
| ⑪ | 마이페이지 | ✅ 완료 | 이메일 로그인/회원가입, 크레딧 이력 |
| ⑫ | 설정 | ⏳ 미구현 | — |

---

## 🤖 AI 페르소나 (5인)

| 이름 | 나이 | 직업 | 관계 컨셉 |
|------|------|------|----------|
| 민지 (Minji) | 27세 | 응급실 간호사 | 비밀 연애 |
| 지우 (Jiwoo) | 20세 | 경영학과 신입생 | 첫사랑 |
| 하영 (Hayoung) | 28세 | 대기업 비서 | 지적 동반자 |
| 은비 (Eunbi) | 24세 | UI/UX 디자이너 | 감성 교류 |
| 다희 (Dahee) | 23세 | 비키니 모델 | 솔직한 연애 |

---

## 💎 크레딧 시스템 v1.2

### 소모 단가

| 기능 | 크레딧 |
|------|--------|
| 일반 채팅 (Text) | **0.5C** / 건 |
| 음성 메시지 (TTS) | **5C** / 건 |
| 특별 사진 (Photo) | **10C** / 장 |
| 그램 잠금 해제 | **15C** / 장 |
| 비밀 영상 (예정) | **20C** / 건 |

### 결제 패키지 v1.2

| 패키지 | 가격 | 크레딧 | 비고 |
|--------|------|--------|------|
| 🐣 Starter | ₩990 | 200C | **최초 1회, 크레딧 소진 시 팝업** |
| 🌸 Basic | ₩2,200 | 200C | — |
| 💝 Recommended | ₩5,500 | 550C + 50C | ★ 인기 |
| 💖 Premium | ₩11,000 | 1,200C + 200C | — |
| 👑 VVIP | ₩55,000 | 6,500C + 1,500C | 최고가치 |

### 무료 크레딧

| 방법 | 지급 |
|------|------|
| 비로그인 체험 | 15C |
| 신규 회원가입 | 200C 보너스 |
| 일일 접속 | +5C/일 |

---

## 🧠 AI 시스템

### Gemini API
- **모델**: `gemini-2.5-flash`
- **maxOutputTokens**: 1024 (기존 300 → 수정, 한국어 약 500자)
- **응답 완결성**: `finishReason: MAX_TOKENS` 시 자동 `…` 처리
- **시스템 프롬프트**: 페르소나별 성격/말투/관계 설정 + "완성된 문장으로 끝맺음" 지시

### 장기 기억 시스템
- 10회 대화마다 자동 요약 → D1 `user_memory` 테이블 저장
- AI 프롬프트에 기억 컨텍스트 자동 주입
- "오빠 어제 힘들다더니 오늘은 어때?" 식 연속성 대화 가능

---

## 🏗️ 관계 레벨 시스템 (Phase 2 구현 완료)

| 레벨 | 조건 | 해제 내용 |
|------|------|----------|
| Lv.1 💬 | 0~9회 | 기본 채팅 |
| Lv.2 🌸 | 10~29회 | 그램 잠금 해제 가능 |
| Lv.3 💕 | 30~59회 | 음성 메시지 활성화 |
| Lv.4 💖 | 60~99회 | 특별 사진 전송 활성화 |
| Lv.5 👑 | 100회+ | 모든 콘텐츠 접근 |

- 채팅 헤더에 레벨 배지 실시간 표시
- 레벨 업 시 토스트 + 애니메이션 알림

---

## 🎙️ 음성 메시지 TTS (Phase 2 구현 완료)

- **비용**: 5C / 건
- **백엔드**: `/api/voice/generate` 엔드포인트 (Google TTS API 연동)
- **프론트**: 채팅 입력창 📣 버튼 → AI가 음성 메시지 전송
- **폴백**: Google TTS 키 없을 시 Web Speech API 사용
- **UI**: 오디오 재생 버튼이 포함된 말풍선
- ⚠️ **실제 TTS 활성화**: Cloudflare Pages에 `GOOGLE_TTS_KEY` 환경변수 등록 필요

---

## 📸 인라인 특별 사진 (Phase 2 구현 완료)

- **비용**: 10C / 장
- **트리거**: 채팅 입력창 📸 버튼 → AI가 특별 사진 + 코멘트 전송
- **UI**: 블러 처리된 이미지 + "💎 10C로 보기" 버튼
- **AI 생성**: 사진과 함께 자연스러운 1~2문장 코멘트 자동 생성

---

## 📱 인앱 그램 (Gram Feed)

- 5명 페르소나 × 3개 포스트 = 15개 게시물
- 각 페르소나 마지막 포스트 `locked: true` → 15C 결제 후 해제
- 블러 오버레이 + 잠금 해제 애니메이션
- 좋아요 (sessionStorage 유지), 댓글 진입, 필터 기능

---

## 🗄️ 데이터 구조 (Cloudflare D1)

### 테이블 목록

| 테이블 | 설명 |
|--------|------|
| `users` | 사용자 계정 (email, nickname, credits, has_paid) |
| `chat_history` | 대화 이력 (persona_id, role, content) |
| `user_memory` | 장기 기억 요약 (per persona) |
| `credit_logs` | 크레딧 사용/충전 내역 (REAL 타입 지원) |
| `push_tokens` | FCM 푸시 토큰 |
| `gram_unlocks` | 그램 잠금 해제 내역 |
| `user_relationships` | 관계 레벨 (persona별 message_count, level) |
| `voice_messages` | 음성 메시지 사용 내역 |
| `special_photos` | 특별 사진 잠금 해제 내역 |

### 마이그레이션 이력

| 파일 | 내용 |
|------|------|
| `0001_initial.sql` | users, chat_history, user_memory 초기 스키마 |
| `0002_credits.sql` | credit_logs, push_tokens |
| `0003_bm_v1_2.sql` | gram_unlocks, user_relationships, voice_messages, special_photos |

---

## 🔌 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/auth` | POST | 이메일 회원가입/로그인 |
| `/api/chat` | POST | AI 채팅 (Gemini API) |
| `/api/voice/generate` | POST | TTS 음성 생성 (5C) |
| `/api/photo/special` | POST | 특별 사진 요청 (10C) |
| `/api/history/save` | POST | 채팅 이력 저장 |
| `/api/history/:personaId` | GET | 채팅 이력 조회 |
| `/api/memory/summarize` | POST | 장기 기억 요약 저장 |
| `/api/memory/:personaId` | GET | 장기 기억 조회 |
| `/api/credits/add` | POST | 크레딧 추가 |
| `/api/payments/confirm` | POST | Toss Payments 결제 확인 |
| `/api/push/register` | POST | FCM 토큰 등록 |
| `/api/push/send` | POST | 푸시 알림 발송 |

---

## 🔐 Cloudflare Secrets

```bash
GEMINI_API_KEY          # Google Gemini API 키 (필수)
JWT_SECRET              # JWT 서명 키 (필수)
TOSS_CLIENT_KEY         # Toss Payments 클라이언트 키
TOSS_SECRET_KEY         # Toss Payments 시크릿 키 (라이브 전환 대기)
FIREBASE_SERVICE_ACCOUNT # FCM 서비스 계정 JSON
FIREBASE_PROJECT_ID     # Firebase 프로젝트 ID
FIREBASE_VAPID_KEY      # FCM Web Push VAPID 키
GOOGLE_TTS_KEY          # Google TTS API 키 (TTS 활성화 필요)
```

---

## 🔔 FCM 푸시 알림

- AI 답장 시 백그라운드 푸시 자동 발송
- 포그라운드 토스트 + 백그라운드 OS 알림
- Service Worker (`firebase-messaging-sw.js`) 등록

---

## 💳 Toss Payments 연동

- **테스트 완료**: 테스트 카드 `4330-1234-1234-1234` (만료 12/26, CVV 991231)
- **라이브 키**: 심사 대기 중 → 발급 후 Cloudflare Secrets에 교체 필요
- **결제 플로우**: 패키지 선택 → 확인 팝업 → Toss SDK → `/api/payments/confirm` → 크레딧 자동 지급

---

## 📂 프로젝트 파일 구조

```
lovia-project/
├── src/
│   └── index.tsx              # 메인 앱 (Hono + 전체 HTML/CSS/API)
├── public/
│   ├── static/
│   │   └── app.js             # 프론트엔드 JS (크레딧, 채팅, 그램 등)
│   ├── images/
│   │   ├── splash1.jpg, splash2.jpg
│   │   ├── profiles/          # 페르소나 프로필 이미지
│   │   └── gram/              # 그램 포스트 이미지
│   ├── videos/
│   │   ├── A.mp4, B.mp4
│   └── favicon.svg
├── migrations/
│   ├── 0001_initial.sql
│   ├── 0002_credits.sql
│   └── 0003_bm_v1_2.sql       # Phase 1+2 BM 마이그레이션
├── BM.md                      # 비즈니스 모델 상세
├── PLANNING.md                # 전체 기획서
├── README.md                  # 이 파일
├── ecosystem.config.cjs       # PM2 설정
├── wrangler.jsonc             # Cloudflare 설정
├── vite.config.ts
├── package.json
└── tsconfig.json
```

---

## 🚀 로드맵

### ✅ Phase 1 — BM 핵심 전환 (완료)

| 항목 | 상태 |
|------|------|
| P1-1: 채팅 단가 1C → 0.5C | ✅ 완료 |
| P1-2: 결제 패키지 v1.2 (5종) | ✅ 완료 |
| P1-3: Starter ₩990 충동구매 팝업 | ✅ 완료 |
| P1-4: 비로그인 체험 크레딧 50C → 15C | ✅ 완료 |
| P1-5: 그램 잠금 사진 유료화 (15C/장) | ✅ 완료 |

### ✅ Phase 2 — 핵심 콘텐츠 수익화 (완료)

| 항목 | 상태 |
|------|------|
| P2-DB: gram_unlocks, relationship_levels, voice_messages, special_photos 마이그레이션 | ✅ 완료 |
| P2-2: 관계 레벨 시스템 Lv1~5 (헤더 배지 + 레벨업 토스트) | ✅ 완료 |
| P2-3: 음성 메시지 TTS 백엔드 + UI (5C/건) | ✅ 완료 |
| P2-4: 인라인 특별 사진 AI 통합 + UI (10C/장) | ✅ 완료 |

### 🔧 AI 응답 품질 개선 (완료)

| 항목 | 내용 |
|------|------|
| maxOutputTokens 300 → 1024 | 한국어 약 500자로 응답 완결성 향상 |
| finishReason 처리 | MAX_TOKENS 시 `…` 자동 추가 |
| 페르소나 프롬프트 강화 | "반드시 완성된 문장으로 끝맺어야 합니다" 지시 추가 |
| memory summarize 한도 | 300 → 512 토큰으로 상향 |

### 📋 Phase 3 — 출시 준비 (예정)

| 항목 | 우선순위 | 상태 |
|------|----------|------|
| Toss Payments 라이브 키 전환 | 🔴 긴급 | 심사 대기 |
| 실제 페르소나 이미지 교체 | 🔴 높음 | 미완료 |
| 개인정보 처리방침 페이지 | 🔴 높음 | 미완료 |
| Google TTS 키 등록 (실제 TTS) | 🟡 중간 | 미완료 |
| TWA 빌드 | 🟡 중간 | 미완료 |
| Google Play 등록 | 🟡 중간 | 미완료 |
| AI 선톡 (Cron 푸시) | 🟡 중간 | 미구현 |
| 연속 출석 보너스 | 🟢 낮음 | 미구현 |
| 월정액 구독 플랜 | 🟢 낮음 | 미구현 |
| 설정 화면 | 🟢 낮음 | 미구현 |

---

## 🛠️ 개발 환경

```bash
# 로컬 개발
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs

# DB 마이그레이션 (로컬)
npx wrangler d1 migrations apply lovia-production --local

# DB 마이그레이션 (프로덕션)
npx wrangler d1 migrations apply lovia-production --remote

# 배포
npm run build
npx wrangler pages deploy dist --project-name lovia
```

---

*마지막 업데이트: 2026-02-23 — Phase 1 + Phase 2 전체 구현 완료*
