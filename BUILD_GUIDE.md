# Lovia 앱 프로덕션 빌드 가이드

## 구조

Lovia iOS/Android 앱은 `https://lovia.pages.dev` 를 WKWebView/WebView로 로드하는 네이티브 래퍼입니다.
인앱결제(IAP)는 각 플랫폼 네이티브 SDK를 사용합니다.

---

## iOS 빌드

### 사전 준비

1. **Apple Developer 계정** (유료, $99/년)
2. **Xcode 15+** 설치
3. **App Store Connect**에 앱 등록
   - Bundle ID: `kr.lovia.app`
   - 앱 이름: `Lovia`
4. **인앱결제 상품 등록** (App Store Connect > 앱 > 인앱 구입)
   - `kr.lovia.credits.1200` — 200 크레딧 (₩1,200)
   - `kr.lovia.credits.5500` — 550 크레딧 + 보너스 50 (₩5,500)
   - `kr.lovia.credits.11000` — 1,200 크레딧 + 보너스 200 (₩11,000)
   - `kr.lovia.credits.33000` — 3,500 크레딧 + 보너스 500 (₩33,000)
   - `kr.lovia.credits.55000` — 6,500 크레딧 + 보너스 1,500 (₩55,000)

### 앱 아이콘 교체

`ios/Lovia/Lovia/Assets.xcassets/AppIcon.appiconset/` 에 1024×1024 PNG 파일 추가 후
`Contents.json` 의 `filename` 필드 업데이트.

### 빌드 방법

1. Xcode에서 `ios/Lovia/Lovia.xcodeproj` 열기
2. 타겟 선택 → Signing & Capabilities → Team 설정
3. Product → Archive (릴리즈 빌드 생성)
4. Organizer → Distribute App → App Store Connect 업로드

### TestFlight 배포

Archive 후 App Store Connect에서 TestFlight 빌드 활성화 → 내부 테스터 초대

---

## Android 빌드

### 사전 준비

1. **Google Play Console 계정** (일회성 $25)
2. **Android Studio** 또는 JDK 17+ + Gradle 설치
3. **키스토어 생성** (최초 1회)

### 키스토어 생성

```bash
cd android
./create-keystore.sh
```

생성 후 `keystore.properties.example` 복사:

```bash
cp keystore.properties.example keystore.properties
# keystore.properties 편집하여 실제 비밀번호 입력
```

> ⚠️ `lovia-release.jks` 와 `keystore.properties` 는 절대 git에 커밋하지 마세요.
> `.gitignore`에 이미 추가되어 있습니다.

### 인앱결제 상품 등록 (Google Play Console)

앱 등록 후 수익 창출 > 인앱 상품:

| 상품 ID | 가격 | 크레딧 |
|---------|------|--------|
| `kr.lovia.credits.1200` | ₩1,200 | 200 |
| `kr.lovia.credits.5500` | ₩5,500 | 550 (+50) |
| `kr.lovia.credits.11000` | ₩11,000 | 1,200 (+200) |
| `kr.lovia.credits.33000` | ₩33,000 | 3,500 (+500) |
| `kr.lovia.credits.55000` | ₩55,000 | 6,500 (+1,500) |

### 앱 아이콘 교체

`android/app/src/main/res/drawable/ic_launcher_foreground.xml` 을 실제 앱 아이콘 SVG로 교체.

### AAB 빌드

```bash
cd android
./gradlew bundleRelease
# 결과물: app/build/outputs/bundle/release/app-release.aab
```

### Google Play 업로드

1. Google Play Console → 앱 만들기
2. 프로덕션 → 새 버전 만들기 → AAB 파일 업로드
3. 출시 노트 작성 후 검토 제출

---

## 백엔드 IAP 검증 API

iOS 구매는 `/api/payments/iap/apple` (POST)
Android 구매는 `/api/payments/iap/google` (POST)

→ 현재 미구현 상태. 결제 통합([LOV-9](https://github.com/momojoylove-ux/lovia-chat)) 완료 후 연동 필요.

---

## 콘텐츠 등급

- iOS: App Store Connect → 앱 정보 → 콘텐츠 등급 설문 (성인용 콘텐츠로 설정)
- Android: Google Play Console → 앱 콘텐츠 → 등급 → 설문 작성
