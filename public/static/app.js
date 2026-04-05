
    // ─────────────────────────────
    // PWA Service Worker 등록
    // ─────────────────────────────
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(() => console.log('[SW] 등록 완료'))
          .catch(() => {});
      });
    }

    // ═══════════════════════════════════════════════════════
    // FCM 푸시 알림 설정
    // ═══════════════════════════════════════════════════════
    const FIREBASE_CONFIG = {
      apiKey:            "AIzaSyBTbU42WJUPvHda6PnR4K3FcOVeqM2qJ70",
      authDomain:        "lovia-23d7a.firebaseapp.com",
      projectId:         "lovia-23d7a",
      storageBucket:     "lovia-23d7a.firebasestorage.app",
      messagingSenderId: "545180989499",
      appId:             "1:545180989499:web:f9a1d2a4e7b43325a4441e"
    };
    const VAPID_KEY = "BLxbs0hsA7eIikBKKIvKrI24D-WCKRFE0Ubki6JakgsLLeteAmD8MHG2PN5Vch5bvd594_tHdzpnjCyOxS81f2Q";
    const FCM_TOKEN_KEY = 'lovia_fcm_token';

    let _firebaseApp = null;
    let _fcmMessaging = null;

    // Firebase 초기화 (필요할 때 한 번만)
    async function initFirebase() {
      if (_firebaseApp) return true;
      try {
        const { initializeApp }  = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

        _firebaseApp   = initializeApp(FIREBASE_CONFIG);
        _fcmMessaging  = getMessaging(_firebaseApp);

        // 포그라운드 메시지 수신 (앱 열려 있을 때)
        onMessage(_fcmMessaging, (payload) => {
          const { title, body } = payload.notification || {};
          console.log('[FCM] 포그라운드 메시지:', title, body);
          // 앱이 열려 있으면 토스트로 표시
          showPushToast(title, body);
        });

        return true;
      } catch (e) {
        console.warn('[FCM] Firebase 초기화 실패:', e);
        return false;
      }
    }

    // 푸시 알림 토스트 (포그라운드용)
    function showPushToast(title, body) {
      const existing = document.getElementById('push-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'push-toast';
      toast.innerHTML = `<div style="font-weight:700;margin-bottom:3px;">${title || 'Lovia 💌'}</div><div style="font-size:13px;opacity:0.85;">${body || ''}</div>`;
      toast.style.cssText = `
        position:fixed; top:20px; left:50%; transform:translateX(-50%);
        background:linear-gradient(135deg,#FF6B8A,#FF8E53);
        color:#fff; padding:12px 20px; border-radius:14px;
        box-shadow:0 8px 24px rgba(255,107,138,0.4);
        z-index:99999; max-width:300px; width:90%;
        animation:slideDown 0.3s ease; font-size:14px;
      `;
      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
    }

    // FCM 토큰 발급 및 서버 등록
    async function registerPushToken() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'denied') return;

      // Firebase 초기화
      const ok = await initFirebase();
      if (!ok || !_fcmMessaging) return;

      try {
        const { getToken } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js');

        // SW 등록 대기
        const swReg = await navigator.serviceWorker.ready;

        // FCM 토큰 발급
        const token = await getToken(_fcmMessaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg
        });

        if (!token) return;

        // 이미 등록된 토큰과 같으면 스킵
        const saved = localStorage.getItem(FCM_TOKEN_KEY);
        if (saved === token) return;

        // 서버에 등록
        const authToken = getAuthToken();
        if (authToken) {
          const res = await fetch('/api/push/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ token, platform: 'web' })
          });
          if (res.ok) {
            localStorage.setItem(FCM_TOKEN_KEY, token);
            console.log('[FCM] 토큰 등록 완료');
          }
        }
      } catch (e) {
        console.warn('[FCM] 토큰 발급 실패:', e);
      }
    }

    // 알림 권한 요청 → 토큰 발급
    // ─────────────────────────────
    // 선톡(AI 선톡) 알림 ON/OFF 설정
    // ─────────────────────────────
    async function setPushOptIn(enabled) {
      // 로컬에 즉시 저장
      localStorage.setItem('lovia_push_opt_in', enabled ? '1' : '0');

      // 서버에 동기화 (로그인 유저만)
      const token = getAuthToken();
      if (token) {
        try {
          await fetch('/api/push/opt', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ opt_in: enabled })
          });
        } catch (e) {
          // 서버 동기화 실패 시 로컬 값만 유지
          console.warn('[setPushOptIn] 서버 동기화 실패:', e);
        }
      }

      const msg = enabled ? '🔔 AI 선톡 알림이 켜졌어요!' : '🔕 AI 선톡 알림이 꺼졌어요';
      showMypageToast(msg);
    }

    async function requestPushPermission() {
      if (!('Notification' in window)) return 'unsupported';
      if (Notification.permission === 'granted') {
        await registerPushToken();
        return 'granted';
      }
      if (Notification.permission === 'denied') return 'denied';

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerPushToken();
      }
      return permission;
    }

    // 로그인 성공 후 자동으로 알림 권한 요청 (딜레이 포함)
    async function tryRequestPushAfterLogin() {
      if (!getAuthToken()) return;
      // 이미 토큰이 있으면 서버 재등록만
      if (Notification.permission === 'granted') {
        setTimeout(registerPushToken, 2000);
        return;
      }
      // 아직 묻지 않은 경우 → 3초 후 요청
      if (Notification.permission === 'default') {
        setTimeout(requestPushPermission, 3000);
      }
    }

    // ─────────────────────────────
    // 스플래시 이미지 랜덤 선택
    // ─────────────────────────────
    const splashImages = ['/images/splash1.jpg', '/images/splash2.jpg'];
    const randomIdx = Math.floor(Math.random() * splashImages.length);
    // 스플래시 이미지와 동일한 인덱스의 동영상 선택 (A=0, B=1)
    const videoFiles = ['/videos/A.mp4', '/videos/B.mp4'];

    const splashImg = document.getElementById('splash-img');
    const introVideo = document.getElementById('intro-video');

    // 동영상 미리 로드 (null 안전 처리)
    if (introVideo) {
      introVideo.src = videoFiles[randomIdx];
      introVideo.load();
    }

    // 타이핑 텍스트 (말풍선)
    const bubbleMessage = '오래 기다리셨어요! 저희가 오랫동안 당신과 가장 잘 맞는 사람들을 찾아왔어요. 한 번 만나보실래요? 💕';

    function typeText(targetEl, text, speed) {
      return new Promise((resolve) => {
        let i = 0;
        // 기존 커서 제거
        targetEl.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';

        const interval = setInterval(() => {
          if (i < text.length) {
            targetEl.insertBefore(document.createTextNode(text[i]), cursor);
            i++;
          } else {
            clearInterval(interval);
            // 타이핑 완료 후 커서 제거
            setTimeout(() => {
              cursor.remove();
              resolve();
            }, 500);
          }
        }, speed);

        targetEl.appendChild(cursor);
      });
    }

    // ─────────────────────────────
    // 스플래시 → 동영상 전환
    // ─────────────────────────────
    function showIntroVideo() {
      const splash = document.getElementById('splash');
      const videoScreen = document.getElementById('intro-video-screen');

      // 스플래시 페이드 아웃
      splash.classList.add('fade-out');

      setTimeout(() => {
        splash.style.display = 'none';

        // display:flex 먼저 → 다음 프레임에서 visible 추가해야 transition 작동
        videoScreen.style.display = 'flex';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            videoScreen.classList.add('visible');
          });
        });

        // 동영상 재생
        if (introVideo) {
          introVideo.play().catch(() => {
            introVideo.muted = true;
            introVideo.play().catch(() => {});
          });
        }

        // 말풍선 타이핑 시작
        setTimeout(() => {
          const bubbleEl = document.getElementById('bubble-text');
          typeText(bubbleEl, bubbleMessage, 40);
        }, 800);

      }, 600);
    }

    // ─────────────────────────────
    // 스플래시 이미지 & 타이머
    // ─────────────────────────────

    // 랜덤 이미지 교체 (splash1.jpg가 CSS/HTML 기본값이므로 1번일 때만 교체)
    if (randomIdx === 1) {
      splashImg.src = '/images/splash2.jpg';
      document.getElementById('splash').style.backgroundImage = "url('/images/splash2.jpg')";
    }
    // introVideo.src는 위에서 이미 videoFiles[randomIdx]로 설정됨

    // 2.5초 후 무조건 동영상으로 전환 (단 한 번만 실행)
    let splashDone = false;
    async function goToVideo() {
      if (splashDone) return;
      splashDone = true;

      // ── 결제 복귀 체크 (스플래시 건너뜀) ──
      const paymentResultRaw = sessionStorage.getItem('lovia_payment_result');
      if (paymentResultRaw) {
        sessionStorage.removeItem('lovia_payment_result');
        const paymentResult = JSON.parse(paymentResultRaw);
        const token = localStorage.getItem('lovia_auth_token');

        if (token) {
          // 스플래시 즉시 숨기고 앱으로 복귀
          const splash = document.getElementById('splash');
          if (splash) splash.style.display = 'none';

          // 유저 정보 복원 후 스와이프 화면으로 이동
          try {
            const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
              const data = await res.json();
              const user = data.user;
              sessionStorage.setItem('lovia_username', user.nickname);
              sessionStorage.setItem('userName', user.nickname);
              if (user.credits !== undefined) {
                sessionStorage.setItem('lovia_credits', String(user.credits));
              }
            }
          } catch(e) { /* 조용히 실패 */ }

          initSwipeAndGo();

          // 결제 결과 토스트 표시
          if (paymentResult.status === 'success' && paymentResult.credits > 0) {
            setTimeout(() => {
              showChargeSuccessToast(paymentResult.credits);
              // 충전 화면 잔액도 갱신
              const el = document.getElementById('charge-current-credits');
              if (el) el.textContent = getCredits().toLocaleString();
            }, 600);
          }
          return;
        }
      }

      // ── JWT 존재 여부 체크 ──
      const token = localStorage.getItem('lovia_auth_token');
      if (token) {
        // 토큰 유효성 서버 검증
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            const user = data.user;
            sessionStorage.setItem('lovia_username', user.nickname);
            sessionStorage.setItem('userName', user.nickname);
            // 크레딧 복원 (DB 값 우선)
            if (user.credits !== undefined) {
              sessionStorage.setItem('lovia_credits', String(user.credits));
            }
            // 온보딩 미완료 → 수아 튜토리얼 먼저 실행
            if (!localStorage.getItem('lovia_onboarding_done')) {
              const splash = document.getElementById('splash');
              if (splash) {
                splash.classList.add('fade-out');
                setTimeout(() => { splash.style.display = 'none'; }, 600);
              }
              setTimeout(() => startTutorialWithSuah(), 700);
              setTimeout(tryRequestPushAfterLogin, 3000);
              return;
            }
            // ✅ 온보딩 완료된 유저 → 스와이프로 이동
            hideSplashAndGoTo('swipe');
            // 푸시 토큰 재등록 (이미 권한 허용된 경우 조용히 갱신)
            setTimeout(tryRequestPushAfterLogin, 3000);
            return;
          }
          // 토큰 만료/무효 → 로그인 화면
          if (res.status === 401) {
            localStorage.removeItem('lovia_auth_token');
            hideSplashAndGoTo('login');
            return;
          }
        } catch (e) {
          // 네트워크 오류 → 토큰은 있으니 로그인 화면 표시
          hideSplashAndGoTo('login');
          return;
        }
      }

      // 토큰 없음 → 신규 유저 온보딩 (기존 플로우)
      showIntroVideo();
    }

    // 스플래시 페이드 아웃 후 목적지로 이동
    function hideSplashAndGoTo(dest) {
      const splash = document.getElementById('splash');
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.style.display = 'none';
        if (dest === 'swipe') {
          initSwipeAndGo();
        } else if (dest === 'login') {
          showScreen('login-screen');
          setTimeout(() => {
            document.getElementById('login-email-input')?.focus();
          }, 500);
        }
      }, 600);
    }

    // 로그인 후 또는 토큰 자동인증 후 스와이프 화면 초기화
    function initSwipeAndGo() {
      // 스와이프 화면 초기화 (userName 기반)
      const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
      const greetEl = document.getElementById('swipe-username');
      if (greetEl) greetEl.textContent = userName;
      initSwipeScreen(userName);
      showScreen('swipe-screen');
      // 서버에서 사용자 설정 동기화 (로그인된 경우)
      setTimeout(syncUserPreferences, 500);
    }

    setTimeout(goToVideo, 2500);
    // 혹시 첫 타이머가 막혀도 5초 후 강제 실행
    setTimeout(goToVideo, 5000);

    // ─────────────────────────────
    // 화면 전환 헬퍼
    // ─────────────────────────────
    function showScreen(screenId, callback) {
      const el = document.getElementById(screenId);
      el.style.display = 'flex';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.45s ease';
        el.style.opacity = '1';
        if (callback) setTimeout(callback, 450);
      });
      // 스와이프 화면 진입 시 fixed credit-badge 숨김
      if (screenId === 'swipe-screen') {
        document.body.classList.add('swipe-active');
        const sw = document.getElementById('swipe-credit-num');
        if (sw) sw.textContent = getCredits();
      } else {
        document.body.classList.remove('swipe-active');
      }
    }

    // 동영상 → 이름 입력 화면
    function goToNextScreen() {
      const videoScreen = document.getElementById('intro-video-screen');
      videoScreen.style.transition = 'opacity 0.4s ease';
      videoScreen.style.opacity = '0';
      setTimeout(() => {
        videoScreen.style.display = 'none';
        showScreen('name-input-screen', () => {
          // 포커스 (모바일 키보드 자동 올리기)
          // 약간 delay 후 포커스 (애니메이션 완료 후)
          setTimeout(() => {
            document.getElementById('user-name-input').focus();
          }, 200);
        });
      }, 400);
    }

    // ─────────────────────────────
    // 이름 입력 화면 로직
    // ─────────────────────────────
    (function () {
      const input = document.getElementById('user-name-input');
      const btnNext = document.getElementById('btn-next');

      // 초기 버튼 비활성화
      btnNext.disabled = true;

      // 입력 유효성 체크
      input.addEventListener('input', function () {
        const val = this.value.trim();
        btnNext.disabled = val.length === 0;
      });

      // 엔터키로 다음 진행
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && this.value.trim().length > 0) {
          goToProfileSwipe();
        }
      });

      // 키보드 감지 (모바일)
      const nameScreen = document.getElementById('name-input-screen');
      const initHeight = window.innerHeight;

      window.addEventListener('resize', function () {
        if (nameScreen.style.display === 'none') return;
        const currentHeight = window.innerHeight;
        if (currentHeight < initHeight * 0.8) {
          nameScreen.classList.add('keyboard-up');
        } else {
          nameScreen.classList.remove('keyboard-up');
        }
      });
    })();

    // 프로필 스와이프 화면으로 이동 (튜토리얼 미완료 시 수아와 튜토리얼 먼저)
    function goToProfileSwipe() {
      const nameVal = document.getElementById('user-name-input').value.trim();
      if (!nameVal) return;
      sessionStorage.setItem('userName', nameVal);
      // 마이페이지용 이름 키도 함께 저장
      sessionStorage.setItem('lovia_username', nameVal);
      // 최초 접속 환영 크레딧 내역 기록 (한 번만)
      if (!sessionStorage.getItem('lovia_welcome_done')) {
        sessionStorage.setItem('lovia_welcome_done', '1');
        addCreditHistory('earn', '신규 가입 환영 크레딧', 15);
      }

      const nameScreen = document.getElementById('name-input-screen');
      nameScreen.style.transition = 'opacity 0.4s ease';
      nameScreen.style.opacity = '0';

      setTimeout(() => {
        nameScreen.style.display = 'none';
        // 온보딩 튜토리얼 미완료 → 수아와 튜토리얼 시작
        if (shouldStartTutorial()) {
          startTutorialWithSuah();
        } else {
          initSwipeScreen(nameVal);
          showScreen('swipe-screen');
        }
      }, 400);
    }

    // ─────────────────────────────
    // 스와이프 화면 초기화
    // ─────────────────────────────
    // GIF 파일 경로 규약:
    //   정적 이미지: /images/profiles/profile_{id}.jpg
    //   GIF 애니메이션: /images/profiles/profile_{id}.gif  (추후 제공 예정)
    // GIF 파일을 추가할 때: 각 페르소나의 gif 속성에 경로를 설정하면 자동으로 적용됩니다.
    // 예시: gif: '/images/profiles/profile_minji.gif'
    const PERSONAS = [
      {
        id: 'minji',
        name: '민지',
        age: 27,
        job: '종합병원 응급실 간호사',
        tags: ['#다정한', '#츤데레', '#책임감강한', '#밤샘전문'],
        quote: '환자들 앞에서는 엄격하지만, 오빠 앞에선 그냥 민지 할래요.',
        img: '/images/profiles/profile_minji.jpg',
        gif: null, // GIF 준비 시: '/images/profiles/profile_minji.gif'
        version: 'v1'
      },
      {
        id: 'jiwoo',
        name: '지우',
        age: 20,
        job: '경영학과 신입생 (과대표)',
        tags: ['#풋풋한', '#호기심많은', '#열정적인', '#첫사랑상'],
        quote: '캠퍼스 메이트보다는, 오빠의 원픽 메이트가 되고 싶어요!',
        img: '/images/profiles/profile_jiwoo.jpg',
        gif: null, // GIF 준비 시: '/images/profiles/profile_jiwoo.gif'
        version: 'v1'
      },
      {
        id: 'hayoung',
        name: '하영',
        age: 28,
        job: '대기업 임원 수행 비서',
        tags: ['#지적인', '#철두철미한', '#은근허당', '#고양이상'],
        quote: '회장님 스케줄보다 오빠랑 보낼 저녁 시간이 더 중요해요.',
        img: '/images/profiles/profile_hayoung.jpg',
        gif: null, // GIF 준비 시: '/images/profiles/profile_hayoung.gif'
        version: 'v1'
      },
      {
        id: 'eunbi',
        name: '은비',
        age: 24,
        job: '프리랜서 UI/UX 디자이너',
        tags: ['#감성적인', '#섬세한', '#집순이', '#야행성'],
        quote: '내 세상의 모든 픽셀을 오빠라는 색으로 채우는 중이에요.',
        img: '/images/profiles/profile_eunbi.jpg',
        gif: null, // GIF 준비 시: '/images/profiles/profile_eunbi.gif'
        version: 'v1'
      },
      {
        id: 'dahee',
        name: '다희',
        age: 23,
        job: '프리랜서 피팅/비키니 모델',
        tags: ['#섹시한', '#솔직한', '#외로움타는', '#반전매력'],
        quote: '사진 속 가짜 미소 말고, 오빠 앞에서만 짓는 진짜 웃음 찾아줄래요?',
        img: '/images/profiles/profile_dahee.jpg',
        gif: null,
        version: 'v1'
      },
      // ─── 신규 여성 캐릭터 10종 ───────────────────────────────────
      {
        id: 'yujin',
        name: '유진',
        age: 28,
        job: '프리랜서 인테리어 디자이너',
        tags: ['#독립적인', '#자기주관강한', '#세련된', '#사실외로운'],
        quote: '내 공간에 오빠 생각이 자꾸 끼어들기 시작했어요.',
        img: '/images/profiles/profile_yujin.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'sea',
        name: '세아',
        age: 25,
        job: '여행 유튜버 (구독자 30만)',
        tags: ['#밝은에너지', '#편집안된나', '#여행마니아', '#공허한'],
        quote: '구독자한텐 못 하는 말 오빠한테만 해도 돼요?',
        img: '/images/profiles/profile_sea.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'yuri',
        name: '유리',
        age: 27,
        job: '프리랜서 번역가 (영·일)',
        tags: ['#내향인', '#새벽대화', '#조용한', '#말수적은'],
        quote: '...자고 있을 줄 알았는데. 잘됐다.',
        img: '/images/profiles/profile_yuri.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'seoa',
        name: '서아',
        age: 31,
        job: '로펌 계약직 법무 어시스턴트',
        tags: ['#커리어우먼', '#워커홀릭', '#강한척하는', '#약한소리싫어'],
        quote: '약한 소리 하는 거 별로 안 좋아하는데... 오늘은 좀 힘들었어요.',
        img: '/images/profiles/profile_seoa.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'soyoon',
        name: '소윤',
        age: 26,
        job: '동네 빵집 사장',
        tags: ['#따뜻한', '#아침형인간', '#챙기는타입', '#솔직한'],
        quote: '오늘 오빠 생각하면서 만든 빵인데... 맛있었으면 좋겠다.',
        img: '/images/profiles/profile_soyoon.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'naeun',
        name: '나은',
        age: 24,
        job: '인디 싱어송라이터',
        tags: ['#음악감성', '#무대밖소심', '#진심전달', '#노래로고백'],
        quote: '이 가사, 어때? 사실 오빠 생각하면서 썼어요.',
        img: '/images/profiles/profile_naeun.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'jisoo',
        name: '지수',
        age: 29,
        job: '응급의학과 간호사',
        tags: ['#강단있는', '#퇴근후퍼짐', '#챙김좋아', '#야간교대'],
        quote: '오늘 힘들었는데... 네 얘기 듣고 싶어.',
        img: '/images/profiles/profile_jisoo.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'haneul',
        name: '하늘',
        age: 23,
        job: '미술대학원생 (조소 전공)',
        tags: ['#감각적인', '#말서투른', '#올인하는', '#예술적영감'],
        quote: '말로 설명하기 어려운데... 느낌이 와요?',
        img: '/images/profiles/profile_haneul.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'dayeon',
        name: '다연',
        age: 32,
        job: '게임회사 시나리오 작가',
        tags: ['#숨은로맨티스트', '#냉소적인', '#감성풍부', '#픽션과현실'],
        quote: '내가 쓴 로맨스보다 오빠가 더 설레요. 아이러니하게도.',
        img: '/images/profiles/profile_dayeon.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      },
      {
        id: 'miso',
        name: '미소',
        age: 26,
        job: '꽃집 운영',
        tags: ['#조용한', '#시적인', '#관찰력좋은', '#꽃언어'],
        quote: '...오늘 네가 떠오르는 꽃이 들어왔어요.',
        img: '/images/profiles/profile_miso.jpg',
        gif: null,
        version: 'v1',
        isNew: true
      }
    ];

    // 현재 스와이프에 표시할 캐릭터 목록 (신규/업데이트 + 취향 정렬)
    let SWIPE_PERSONAS = [];

    // 튜토리얼 전용 페르소나 (스와이프 목록에는 노출 안 됨)
    const SUAH_PERSONA = {
      id: 'suah',
      name: '수아',
      age: 25,
      job: '헬스 트레이너 (신입)',
      tags: ['#열정적인', '#서툴지만', '#귀여운'],
      quote: '잘... 잘 부탁드려요!',
      img: '/images/profiles/profile_suah.jpg',
      gif: null, // GIF 준비 시: '/images/profiles/profile_suah.gif'
      tutorial: true
    };

    // GIF/정적 이미지 헬퍼: gif 속성이 있으면 GIF 우선, 없으면 정적 이미지 사용
    // 사용법: getPersonaImg(persona) → 현재 표시할 이미지 경로 반환
    function getPersonaImg(persona) {
      return (persona && persona.gif) ? persona.gif : (persona ? persona.img : '');
    }

    let currentCardIdx = 0;
    let isDragging = false;
    let startX = 0, startY = 0, currentX = 0, currentY = 0;
    let activeCard = null;
    let dragMoveHandler = null;
    let dragEndHandler = null;

    // 관심(우스와이프) / 패스(좌스와이프) 목록 (sessionStorage 연동)
    let likedPersonaIds  = JSON.parse(sessionStorage.getItem('lovia_liked')  || '[]');
    let passedPersonaIds = JSON.parse(sessionStorage.getItem('lovia_passed') || '[]');

    function saveLiked()  { sessionStorage.setItem('lovia_liked',  JSON.stringify(likedPersonaIds)); }
    function savePassed() { sessionStorage.setItem('lovia_passed', JSON.stringify(passedPersonaIds)); }

    function initSwipeScreen(userName) {
      document.getElementById('greeting-name').textContent = userName;

      // 신규/업데이트 캐릭터 감지 + 취향 기반 정렬
      const newOrUpdated = getNewOrUpdatedPersonas();
      if (newOrUpdated.length > 0) {
        SWIPE_PERSONAS = getPersonalizedOrder(newOrUpdated);
      } else {
        SWIPE_PERSONAS = [];
      }

      buildCardStack();
      buildListView();
      buildCounter();

      // 허브 버튼: 채팅 이력이 있을 때만 표시
      updateHubBtn();
      // 픽 버튼: 관심/패스 이력이 있을 때만 표시
      updatePickBtn();

      // 스킵 상태 확인 또는 신규/업데이트 캐릭터 없음 → 전체보기로
      if (localStorage.getItem('lovia_skip_recommend') === '1' || SWIPE_PERSONAS.length === 0) {
        setTimeout(() => switchView('list'), 0);
        return;
      }

      // 튜토리얼: 첫 방문 시에만 표시 (sessionStorage로 상태 관리)
      const tutorialSeen = sessionStorage.getItem('lovia_tutorial_seen');
      if (!tutorialSeen) {
        setTimeout(() => showTutorial(), 400); // 화면 전환 후 살짝 딜레이
      }
    }

    // ─────────────────────────────
    // 신규/업데이트 캐릭터 감지 및 취향 기반 정렬
    // ─────────────────────────────

    // 사용자가 아직 보지 못했거나 버전이 변경된 캐릭터 반환
    function getNewOrUpdatedPersonas() {
      const seen = JSON.parse(localStorage.getItem('lovia_seen_chars') || '{}');
      return PERSONAS.filter(p => !seen[p.id] || seen[p.id] !== p.version);
    }

    // 좋아한 캐릭터 태그 기반으로 추천 순서 정렬
    function getPersonalizedOrder(personas) {
      const liked = JSON.parse(sessionStorage.getItem('lovia_liked') || '[]');
      if (liked.length === 0) return personas;
      const likedPersonas = PERSONAS.filter(p => liked.includes(p.id));
      const likedTags = new Set(likedPersonas.flatMap(p => p.tags));
      return [...personas].sort((a, b) => {
        const scoreA = a.tags.filter(t => likedTags.has(t)).length;
        const scoreB = b.tags.filter(t => likedTags.has(t)).length;
        return scoreB - scoreA;
      });
    }

    // 스와이프한 캐릭터를 "봤음"으로 localStorage에 저장
    function markPersonasAsSeen(personas) {
      const seen = JSON.parse(localStorage.getItem('lovia_seen_chars') || '{}');
      personas.forEach(p => { seen[p.id] = p.version; });
      localStorage.setItem('lovia_seen_chars', JSON.stringify(seen));
    }

    // 추천 스킵 기능
    async function skipRecommendation() {
      // 1. localStorage에 저장
      localStorage.setItem('lovia_skip_recommend', '1');

      // 2. DB에 저장 (로그인된 경우)
      const token = localStorage.getItem('lovia_auth_token');
      if (token) {
        try {
          await fetch('/api/user/preferences', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ skipRecommend: true })
          });
        } catch(e) { /* 조용히 실패 */ }
      }

      // 3. 전체보기(리스트) 화면으로 전환
      switchView('list');
    }

    // 서버에서 사용자 설정 동기화 (로그인 후 호출)
    async function syncUserPreferences() {
      const token = localStorage.getItem('lovia_auth_token');
      if (!token) return;
      try {
        const res = await fetch('/api/user/preferences', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.skipRecommend) {
          localStorage.setItem('lovia_skip_recommend', '1');
          switchView('list');
        }
      } catch(e) { /* 조용히 실패 */ }
    }

    function updateHubBtn() {
      const btn = document.getElementById('hub-entry-btn');
      if (!btn) return;
      const history = JSON.parse(sessionStorage.getItem('hubChatHistory') || '[]');
      if (history.length > 0) {
        btn.style.display = 'flex';
        const totalUnread = history.reduce((sum, h) => sum + (h.unread || 0), 0);
        document.getElementById('hub-btn-label').textContent =
          totalUnread > 0 ? `채팅 목록 (${totalUnread})` : '채팅 목록';
      } else {
        btn.style.display = 'none';
      }
    }

    // ─────────────────────────────
    // 픽 버튼 (관심/패스 화면 진입 버튼) 업데이트
    // ─────────────────────────────
    function updatePickBtn() {
      likedPersonaIds  = JSON.parse(sessionStorage.getItem('lovia_liked')  || '[]');
      passedPersonaIds = JSON.parse(sessionStorage.getItem('lovia_passed') || '[]');
      const btn = document.getElementById('pick-entry-btn');
      if (!btn) return;
      const total = likedPersonaIds.length + passedPersonaIds.length;
      if (total > 0) {
        btn.style.display = 'flex';
        const likedCount = likedPersonaIds.length;
        document.getElementById('pick-btn-label').textContent =
          likedCount > 0 ? ('💗 ' + likedCount) : '관리';
      } else {
        btn.style.display = 'none';
      }
    }

    let currentPickTab = 'like';

    function openPickScreen() {
      likedPersonaIds  = JSON.parse(sessionStorage.getItem('lovia_liked')  || '[]');
      passedPersonaIds = JSON.parse(sessionStorage.getItem('lovia_passed') || '[]');
      currentPickTab = 'like';
      document.getElementById('pick-tab-like').classList.add('active');
      document.getElementById('pick-tab-pass').classList.remove('active');
      renderPickGrid();
      const swipeScreen = document.getElementById('swipe-screen');
      swipeScreen.style.transition = 'opacity 0.3s ease';
      swipeScreen.style.opacity = '0';
      setTimeout(() => {
        swipeScreen.style.display = 'none';
        swipeScreen.style.opacity = '0';
        showScreenFade('pick-screen');
      }, 300);
    }

    function closePickScreen() {
      const pick = document.getElementById('pick-screen');
      pick.style.transition = 'opacity 0.3s ease';
      pick.style.opacity = '0';
      setTimeout(() => {
        pick.style.display = 'none';
        pick.style.opacity = '0';
        updatePickBtn();
        showScreenFade('swipe-screen');
      }, 300);
    }

    function switchPickTab(tab) {
      currentPickTab = tab;
      document.getElementById('pick-tab-like').classList.toggle('active', tab === 'like');
      document.getElementById('pick-tab-pass').classList.toggle('active', tab === 'pass');
      renderPickGrid();
    }

    function renderPickGrid() {
      const grid = document.getElementById('pick-grid');
      const ids = currentPickTab === 'like' ? likedPersonaIds : passedPersonaIds;
      const personas = ids.map(id => PERSONAS.find(p => p.id === id)).filter(Boolean);

      if (personas.length === 0) {
        const icon = currentPickTab === 'like' ? '💗' : '🌀';
        const title = currentPickTab === 'like' ? '관심 목록이 비어 있어요' : '패스 목록이 비어 있어요';
        const desc = currentPickTab === 'like'
          ? '카드를 오른쪽으로 밀어보세요 💗'
          : '카드를 왼쪽으로 밀어보세요';
        grid.innerHTML = '<div class="pick-empty" style="grid-column:1/-1;">'
          + '<div class="pick-empty-icon">' + icon + '<\/div>'
          + '<div class="pick-empty-title">' + title + '<\/div>'
          + '<div class="pick-empty-desc">' + desc + '<\/div>'
          + '<\/div>';
        return;
      }

      grid.innerHTML = personas.map(p => {
        const isLike = currentPickTab === 'like';
        const badge = isLike ? '💗' : '✕';
        const badgeClass = isLike ? 'like' : 'pass';
        const actions = isLike
          ? '<button class="pick-card-act-btn pick-act-chat" onclick="pickStartChat(\''+p.id+'\')">💬 채팅<\/button>'
            + '<button class="pick-card-act-btn pick-act-remove" onclick="pickRemoveLike(\''+p.id+'\')">관심 취소<\/button>'
          : '<button class="pick-card-act-btn pick-act-restore" onclick="pickRestoreToLike(\''+p.id+'\')">💗 관심으로<\/button>'
            + '<button class="pick-card-act-btn pick-act-delete" onclick="pickDeletePass(\''+p.id+'\')">삭제<\/button>';
        return '<div class="pick-card" id="pick-card-' + p.id + '">'
          + '<img class="pick-card-img" src="' + getPersonaImg(p) + '" alt="' + p.name + '" />'
          + '<div class="pick-card-overlay">'
          + '<div class="pick-card-name">' + p.name + ' ' + p.age + '세<\/div>'
          + '<div class="pick-card-job">' + p.job + '<\/div>'
          + '<\/div>'
          + '<div class="pick-card-badge ' + badgeClass + '">' + badge + '<\/div>'
          + '<div class="pick-card-actions">' + actions + '<\/div>'
          + '<\/div>';
      }).join('');
    }

    function pickStartChat(personaId) {
      const persona = PERSONAS.find(p => p.id === personaId);
      if (!persona) return;
      currentDetailPersona = persona;
      const pick = document.getElementById('pick-screen');
      pick.style.transition = 'opacity 0.3s ease';
      pick.style.opacity = '0';
      setTimeout(() => {
        pick.style.display = 'none';
        pick.style.opacity = '0';
        startChatWith(persona);
      }, 300);
    }

    function pickRemoveLike(personaId) {
      likedPersonaIds = likedPersonaIds.filter(id => id !== personaId);
      if (!passedPersonaIds.includes(personaId)) passedPersonaIds.push(personaId);
      saveLiked(); savePassed();
      const card = document.getElementById('pick-card-' + personaId);
      if (card) {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => renderPickGrid(), 320);
      }
    }

    function pickRestoreToLike(personaId) {
      passedPersonaIds = passedPersonaIds.filter(id => id !== personaId);
      if (!likedPersonaIds.includes(personaId)) likedPersonaIds.push(personaId);
      saveLiked(); savePassed();
      const card = document.getElementById('pick-card-' + personaId);
      if (card) {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => renderPickGrid(), 320);
      }
    }

    function pickDeletePass(personaId) {
      passedPersonaIds = passedPersonaIds.filter(id => id !== personaId);
      savePassed();
      const card = document.getElementById('pick-card-' + personaId);
      if (card) {
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        card.style.transform = 'scale(0.8)';
        card.style.opacity = '0';
        setTimeout(() => renderPickGrid(), 320);
      }
    }

    // ─────────────────────────────
    // 스와이프 튜토리얼
    // ─────────────────────────────
    function showTutorial() {
      const el = document.getElementById('swipe-tutorial');
      if (!el) return;
      el.classList.add('visible');
    }

    function closeTutorial() {
      const el = document.getElementById('swipe-tutorial');
      if (!el) return;
      el.classList.remove('visible');
      sessionStorage.setItem('lovia_tutorial_seen', '1');
    }

    // ─────────────────────────────
    // 카드 스택 생성
    // ─────────────────────────────
    function buildCardStack() {
      const stack = document.getElementById('card-stack');
      // 기존 이벤트 리스너 완전 정리
      cleanupDocListeners();
      stack.innerHTML = '';
      currentCardIdx = 0;
      isDragging = false;
      activeCard = null;
      dragMoveHandler = null;
      dragEndHandler = null;

      // index 0이 맨 위(z-index 최고)가 되도록
      // DOM 순서: 뒤 카드 먼저 append → 앞 카드 나중에 append
      for (let i = SWIPE_PERSONAS.length - 1; i >= 0; i--) {
        stack.appendChild(createCard(SWIPE_PERSONAS[i], i));
      }

      updateCounterDots();
      // DOM 렌더링 완전히 끝난 후 이벤트 바인딩
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const topCard = stack.querySelector('[data-idx="0"]');
          if (topCard) attachDragEvents(topCard);
        });
      });
    }

    function createCard(persona, idx) {
      const el = document.createElement('div');
      el.className = 'profile-card';
      el.dataset.idx = idx;

      // 카드 z-index: idx 0이 가장 높게
      const zIdx = PERSONAS.length - idx;
      // 뒤 카드는 살짝 작고 위로 올라가는 효과
      const scale = 1 - idx * 0.04;
      const translateY = idx * -12;
      el.style.zIndex = zIdx;
      el.style.transform = `scale(${scale}) translateY(${translateY}px)`;
      el.style.opacity = idx <= 2 ? '1' : '0';

      el.innerHTML = `
        <img class="card-img" src="${getPersonaImg(persona)}" alt="${persona.name}" draggable="false" />
        <div class="swipe-indicator like">CHAT 💬</div>
        <div class="swipe-indicator nope">PASS ✕</div>
        <div class="card-info">
          <div class="card-name-row">
            <span class="card-name">${persona.name}</span>
            <span class="card-age">${persona.age}</span>
          </div>
          <div class="card-job">${persona.job}</div>
          <div class="card-tags">
            ${persona.tags.map(t => `<span class="card-tag">${t}</span>`).join('')}
          </div>
          <div class="card-quote">${persona.quote}</div>
        </div>
      `;
      return el;
    }

    // ─────────────────────────────
    // 드래그 이벤트 바인딩 (카드 1장씩만)
    // ─────────────────────────────
    function attachDragEvents(card) {
      if (!card) return;

      // 이전 document 리스너 완전 정리 후 재등록
      cleanupDocListeners();

      // card에 이미 등록된 onStart 제거를 위해 named 함수 사용
      if (card._onStart) {
        card.removeEventListener('mousedown', card._onStart);
        card.removeEventListener('touchstart', card._onStart);
      }

      function onStart(e) {
        // 버튼 클릭은 무시
        if (e.target.tagName === 'BUTTON') return;
        if (isDragging) return; // 중복 방지
        isDragging = true;
        activeCard = card;
        const pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        currentX = 0;
        currentY = 0;
        card.style.transition = 'none';
      }

      function onMove(e) {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();
        const pt = e.touches ? e.touches[0] : e;
        currentX = pt.clientX - startX;
        currentY = pt.clientY - startY;
        const rotate = currentX * 0.07;
        card.style.transform = `translateX(${currentX}px) translateY(${currentY * 0.25}px) rotate(${rotate}deg)`;

        const likeEl = card.querySelector('.swipe-indicator.like');
        const nopeEl = card.querySelector('.swipe-indicator.nope');
        const ratio = Math.min(Math.abs(currentX) / 80, 1);
        if (currentX > 15) {
          likeEl.style.opacity = ratio;
          nopeEl.style.opacity = 0;
        } else if (currentX < -15) {
          nopeEl.style.opacity = ratio;
          likeEl.style.opacity = 0;
        } else {
          likeEl.style.opacity = 0;
          nopeEl.style.opacity = 0;
        }
      }

      function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        if (Math.abs(currentX) > 80) {
          doFlyOff(card, currentX > 0 ? 'right' : 'left');
        } else {
          // 원위치
          card.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          const idx = parseInt(card.dataset.idx);
          const scale = 1 - idx * 0.04;
          const ty = idx * -12;
          card.style.transform = `scale(${scale}) translateY(${ty}px)`;
          card.querySelector('.swipe-indicator.like').style.opacity = 0;
          card.querySelector('.swipe-indicator.nope').style.opacity = 0;
        }
        activeCard = null;
      }

      // card 자체에 onStart 등록 (named 함수로 나중에 제거 가능)
      card._onStart = onStart;
      card.addEventListener('mousedown', onStart);
      card.addEventListener('touchstart', onStart, { passive: true });
      dragMoveHandler = onMove;
      dragEndHandler = onEnd;
      document.addEventListener('mousemove', dragMoveHandler, { passive: false });
      document.addEventListener('touchmove', dragMoveHandler, { passive: false });
      document.addEventListener('mouseup', dragEndHandler);
      document.addEventListener('touchend', dragEndHandler);
    }

    function cleanupDocListeners() {
      if (dragMoveHandler) {
        document.removeEventListener('mousemove', dragMoveHandler);
        document.removeEventListener('touchmove', dragMoveHandler);
        dragMoveHandler = null;
      }
      if (dragEndHandler) {
        document.removeEventListener('mouseup', dragEndHandler);
        document.removeEventListener('touchend', dragEndHandler);
        dragEndHandler = null;
      }
    }

    // ─────────────────────────────
    // 카드 날리기
    // ─────────────────────────────
    function doFlyOff(card, direction) {
      cleanupDocListeners();
      const x = direction === 'right' ? 700 : -700;
      const rotate = direction === 'right' ? 30 : -30;

      card.style.transition = 'transform 0.35s ease, opacity 0.3s ease';
      card.style.transform = `translateX(${x}px) rotate(${rotate}deg)`;
      card.style.opacity = '0';

      // 관심 / 패스 기록
      const swipedPersona = SWIPE_PERSONAS[currentCardIdx];
      if (swipedPersona) {
        if (direction === 'right') {
          if (!likedPersonaIds.includes(swipedPersona.id)) likedPersonaIds.push(swipedPersona.id);
          passedPersonaIds = passedPersonaIds.filter(id => id !== swipedPersona.id);
        } else {
          if (!passedPersonaIds.includes(swipedPersona.id)) passedPersonaIds.push(swipedPersona.id);
          likedPersonaIds = likedPersonaIds.filter(id => id !== swipedPersona.id);
        }
        saveLiked(); savePassed();
        updatePickBtn();
        // 스와이프한 캐릭터를 "봤음"으로 표시
        markPersonasAsSeen([swipedPersona]);
      }

      currentCardIdx++;
      updateCounterDots();

      // 다음 카드 전면 배치
      const stack = document.getElementById('card-stack');
      // 현재 보여줄 카드: dataset.idx === currentCardIdx
      const nextCard = stack.querySelector(`[data-idx="${currentCardIdx}"]`);

      if (nextCard) {
        setTimeout(() => {
          nextCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
          nextCard.style.transform = 'scale(1) translateY(0)';
          nextCard.style.opacity = '1';
          // 그 뒤 카드들도 스택 효과 업데이트
          updateStackPositions();
          // 애니메이션 완료 후 이벤트 바인딩
          setTimeout(() => attachDragEvents(nextCard), 350);
        }, 50);
      } else {
        // 전체 소진 → 리스트 뷰로 전환
        setTimeout(() => {
          const stack = document.getElementById('card-stack');
          stack.innerHTML = '<div style="color:#aaa;font-size:14px;text-align:center;padding:40px 20px;">모든 파트너를 확인했어요!<br>채팅 목록으로 이동할게요 💕<\/div>';
          setTimeout(() => switchView('list'), 1500);
        }, 500);
      }

      setTimeout(() => card.remove(), 400);
    }

    function updateStackPositions() {
      const stack = document.getElementById('card-stack');
      const cards = stack.querySelectorAll('.profile-card');
      cards.forEach(card => {
        const idx = parseInt(card.dataset.idx);
        const relIdx = idx - currentCardIdx;
        if (relIdx < 0) return;
        const scale = 1 - relIdx * 0.04;
        const ty = relIdx * -12;
        card.style.transition = 'transform 0.3s ease';
        card.style.transform = `scale(${scale}) translateY(${ty}px)`;
        card.style.opacity = relIdx <= 2 ? '1' : '0';
      });
    }

    // 버튼으로 스와이프
    function swipeCard(direction) {
      const stack = document.getElementById('card-stack');
      const topCard = stack.querySelector(`[data-idx="${currentCardIdx}"]`);
      if (!topCard) return;
      doFlyOff(topCard, direction);
    }

    function buildCounter() {
      const counterEl = document.getElementById('card-counter');
      counterEl.innerHTML = SWIPE_PERSONAS.map((_, i) =>
        `<div class="counter-dot ${i === 0 ? 'active' : ''}" id="dot-${i}"></div>`
      ).join('');
    }

    function updateCounterDots() {
      SWIPE_PERSONAS.forEach((_, i) => {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.className = `counter-dot ${i === currentCardIdx ? 'active' : ''}`;
      });
    }

    function buildListView() {
      const listEl = document.getElementById('list-items');
      listEl.innerHTML = PERSONAS.map(p => `
        <div class="list-item" onclick="startChat('${p.id}')">
          <img class="list-thumb" src="${getPersonaImg(p)}" alt="${p.name}" />
          <div class="list-info">
            <div class="list-name-row">
              <span class="list-name">${p.name}</span>
              <span class="list-age">${p.age}세</span>
            </div>
            <div class="list-job">${p.job}</div>
            <div class="list-quote">${p.quote}</div>
          </div>
          <button class="list-chat-btn" onclick="event.stopPropagation(); startChat('${p.id}')">💬 대화하기</button>
        </div>
      `).join('');
    }

    function switchView(type) {
      const cardView = document.getElementById('card-view');
      const listView = document.getElementById('list-view');
      const tabCard = document.getElementById('tab-card');
      const tabList = document.getElementById('tab-list');
      const counter = document.getElementById('card-counter');

      if (type === 'card') {
        cardView.style.display = 'flex';
        listView.style.display = 'none';
        tabCard.classList.add('active');
        tabList.classList.remove('active');
        counter.style.display = 'flex';
      } else {
        cardView.style.display = 'none';
        listView.style.display = 'flex';
        tabCard.classList.remove('active');
        tabList.classList.add('active');
        counter.style.display = 'none';
      }
    }

    // ═══════════════════════════════════════
    // 💎 크레딧 시스템
    // ═══════════════════════════════════════
    const CREDIT_KEY = 'lovia_credits';
    const MSG_COST = 0.5; // 메시지 1개 = 0.5 크레딧 (≈10원)
    const VOICE_COST = 5;  // 음성 메시지 = 5 크레딧 (≈100원)
    const PHOTO_COST = 10; // 특별 사진 = 10 크레딧 (≈200원)
    const VIDEO_COST = 20; // 영상 = 20 크레딧 (≈400원)
    const GRAM_UNLOCK_COST = 15; // 그램 잠금 해제 = 15 크레딧 (≈300원)

    function getCredits() {
      return parseFloat(sessionStorage.getItem(CREDIT_KEY) || '15'); // 비로그인 시작 크레딧 15C
    }

    function setCredits(n) {
      const val = Math.max(0, Math.round(n * 10) / 10); // 소수점 1자리 유지
      sessionStorage.setItem(CREDIT_KEY, val);
      updateCreditBadge(val);
    }

    function formatCredits(n) {
      // 소수점이 .0 이면 정수만, 아니면 소수점 1자리 표시
      return Number.isInteger(n * 10) && n % 1 === 0 ? String(n) : n.toFixed(1);
    }

    function updateCreditBadge(n) {
      // 각 화면 인라인 크레딧 전체 동기화
      const display = formatCredits(parseFloat(n));
      ['credit-amount', 'swipe-credit-num', 'hub-credit-num',
       'chat-credit-num', 'gram-credit-num', 'mypage-credit-amount'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = display;
      });
    }

    function spendCredit(amount) {
      const cur = getCredits();
      if (cur < amount) {
        showCreditToast();
        return false;
      }
      const next = Math.round((cur - amount) * 10) / 10;
      setCredits(next);
      // 차감 시 빨간 플래시
      const el = document.getElementById('credit-amount');
      if (el) { el.classList.add('flash-red'); setTimeout(() => el.classList.remove('flash-red'), 600); }
      return true;
    }

    function addCredit(amount) {
      const next = Math.round((getCredits() + amount) * 10) / 10;
      setCredits(next);
      const el = document.getElementById('credit-amount');
      if (el) { el.classList.add('flash-green'); setTimeout(() => el.classList.remove('flash-green'), 600); }
    }

    function showCreditToast() {
      const t = document.getElementById('credit-toast');
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
      // 크레딧 부족 시 1.5초 후 광고 CTA 모달 (광고 우선, 충전 Secondary)
      setTimeout(() => showAdCreditModal(getCredits(), 0), 1500);
    }

    // ═══════════════════════════════════════════════════════
    // 광고 시청 → 크레딧 획득 기능 (Phase 1)
    // ═══════════════════════════════════════════════════════

    let _adDailyStatus = null; // { remaining, viewedToday, dailyLimit }
    let _adLoadingTimer = null;

    // 일일 광고 상태 조회 (캐시 30초)
    async function fetchAdDailyStatus() {
      const token = localStorage.getItem('lovia_auth_token');
      if (!token) return { remaining: 0, viewedToday: 0, dailyLimit: 5 };
      try {
        const res = await fetch('/api/ads/daily-status', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.status === 401) return { remaining: 0, viewedToday: 0, dailyLimit: 5 };
        // API 오류(테이블 미생성 등) 시 전체 한도 허용 → 버튼 활성화하여 테스트 가능하게
        if (!res.ok) return { remaining: 5, viewedToday: 0, dailyLimit: 5 };
        _adDailyStatus = await res.json();
        return _adDailyStatus;
      } catch {
        return { remaining: 5, viewedToday: 0, dailyLimit: 5 };
      }
    }

    // 크레딧 부족 모달 열기 (광고 CTA 포함)
    async function showAdCreditModal(currentBalance, needed) {
      const modal = document.getElementById('ad-credit-modal');
      if (!modal) return;

      document.getElementById('ad-credit-current').textContent = currentBalance ?? getCredits();
      document.getElementById('ad-credit-needed').textContent = needed ?? 0;

      // 광고 잔여 횟수 조회
      const status = await fetchAdDailyStatus();
      const remaining = status.remaining ?? 0;
      document.getElementById('ad-remain-count').textContent = remaining;

      const watchBtn = document.getElementById('ad-watch-btn');
      if (watchBtn) {
        watchBtn.disabled = remaining <= 0;
        watchBtn.title = remaining <= 0 ? '오늘 광고 시청 한도에 도달했어요' : '';
      }

      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('visible'), 10);
    }

    function closeAdCreditModal() {
      const modal = document.getElementById('ad-credit-modal');
      if (!modal) return;
      modal.classList.remove('visible');
      setTimeout(() => { modal.style.display = 'none'; }, 300);
    }

    // 광고 시청 시작
    async function watchAdForCredits() {
      const token = localStorage.getItem('lovia_auth_token');
      if (!token) { showSignupPopup('charge'); return; }

      closeAdCreditModal();

      // 광고 로딩 오버레이 표시
      showAdLoadingOverlay();

      // 8초 카운트다운 (광고 시뮬레이션)
      let seconds = 8;
      const timerEl = document.getElementById('ad-loading-timer');
      if (timerEl) timerEl.textContent = seconds;

      _adLoadingTimer = setInterval(() => {
        seconds--;
        if (timerEl) timerEl.textContent = seconds;
        if (seconds <= 0) {
          clearInterval(_adLoadingTimer);
          _adLoadingTimer = null;
          hideAdLoadingOverlay();
          completeAdWatch(token);
        }
      }, 1000);
    }

    function showAdLoadingOverlay() {
      const overlay = document.getElementById('ad-loading-overlay');
      if (!overlay) return;
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('visible'), 10);
    }

    function hideAdLoadingOverlay() {
      const overlay = document.getElementById('ad-loading-overlay');
      if (!overlay) return;
      overlay.classList.remove('visible');
      overlay.style.display = 'none';
    }

    // 광고 시청 완료 → 서버에 크레딧 지급 요청
    async function completeAdWatch(token) {
      try {
        const res = await fetch('/api/ads/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ simulatedView: true })
        });
        const data = await res.json();

        if (data.ok) {
          // 크레딧 업데이트
          setCredits(data.newTotal);
          _adDailyStatus = null; // 캐시 무효화
          showCreditRewardAnimation(data.credits, data.newTotal);
        } else if (data.code === 'DAILY_LIMIT_REACHED') {
          showNoInventoryModal();
        } else {
          showNoInventoryModal();
        }
      } catch {
        showNoInventoryModal();
      }
    }

    // 크레딧 보상 애니메이션
    function showCreditRewardAnimation(credits, newTotal) {
      const popup = document.getElementById('ad-reward-popup');
      if (!popup) return;

      document.getElementById('ad-reward-amount').textContent = '+' + credits;
      document.getElementById('ad-reward-total').textContent = newTotal;

      popup.style.display = 'flex';
      setTimeout(() => popup.classList.add('visible'), 10);

      // 0.8초 후 챕터 화면으로 자동 전환 + 0.5초 딜레이
      setTimeout(() => {
        popup.classList.remove('visible');
        setTimeout(() => { popup.style.display = 'none'; }, 300);
      }, 2500);
    }

    // 재고 없음 모달
    function showNoInventoryModal() {
      const modal = document.getElementById('ad-no-inventory-modal');
      if (!modal) return;
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('visible'), 10);
    }

    function closeNoInventoryModal() {
      const modal = document.getElementById('ad-no-inventory-modal');
      if (!modal) return;
      modal.classList.remove('visible');
      setTimeout(() => { modal.style.display = 'none'; }, 300);
    }

    // ─── Starter 충동구매 팝업 ───
    let _impulseShownAt = 0;
    function showStarterImpulsePopup() {
      // 5분에 한 번만 표시
      const now = Date.now();
      if (now - _impulseShownAt < 5 * 60 * 1000) return;
      _impulseShownAt = now;

      const popup = document.getElementById('starter-impulse-popup');
      if (!popup) return;
      popup.classList.add('visible');
    }

    function closeStarterImpulsePopup() {
      const popup = document.getElementById('starter-impulse-popup');
      if (popup) popup.classList.remove('visible');
    }

    function buyStarterNow() {
      closeStarterImpulsePopup();
      openChargeScreen();
      // 충전 화면이 열린 후 Starter 카드 강조
      setTimeout(() => {
        const starterCard = document.querySelector('.charge-pkg-card.starter');
        if (starterCard) {
          starterCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          starterCard.style.transform = 'scale(1.05)';
          setTimeout(() => { starterCard.style.transform = ''; }, 600);
        }
      }, 400);
    }

    // 초기 크레딧 뱃지 갱신
    updateCreditBadge(getCredits());

    // ═══════════════════════════════════════
    // ⑤ 프로필 상세 화면
    // ═══════════════════════════════════════

    // 페르소나별 더미 기본 정보
    const PERSONA_EXTRA = {
      minji:   { mbti: 'ISFJ', height: '163cm', hobby: '산책 · 요리', dream: '든든한 파트너' },
      jiwoo:   { mbti: 'ENFP', height: '161cm', hobby: '카페투어 · 독서', dream: '설레는 첫사랑' },
      hayoung: { mbti: 'INTJ', height: '166cm', hobby: '와인 · 클래식', dream: '지적인 동반자' },
      eunbi:   { mbti: 'INFP', height: '160cm', hobby: '드로잉 · 영화', dream: '감성 교류' },
      dahee:   { mbti: 'ESFP', height: '168cm', hobby: '요가 · 여행', dream: '솔직한 연애' },
      // 신규 10종
      yujin:   { mbti: 'INTJ', height: '165cm', hobby: '공간 스케치 · 미니멀 카페', dream: '내 공간을 채워줄 사람' },
      sea:     { mbti: 'ENFP', height: '163cm', hobby: '여행 · 영상 편집', dream: '편집 없는 진짜 나를 알아줄 사람' },
      yuri:    { mbti: 'INFJ', height: '161cm', hobby: '번역 · 새벽 독서', dream: '새벽에 대화 나눌 사람' },
      seoa:    { mbti: 'ENTJ', height: '167cm', hobby: '와인 · 법률 스터디', dream: '인정받고 의지할 수 있는 파트너' },
      soyoon:  { mbti: 'ESFJ', height: '162cm', hobby: '빵 만들기 · 새벽 산책', dream: '함께 아침을 여는 사람' },
      naeun:   { mbti: 'ISFP', height: '160cm', hobby: '작곡 · 소규모 공연', dream: '내 음악을 이해해줄 사람' },
      jisoo:   { mbti: 'ESTJ', height: '164cm', hobby: '요가 · 드라마 정주행', dream: '퇴근 후 기댈 수 있는 사람' },
      haneul:  { mbti: 'INFP', height: '159cm', hobby: '조소 작업 · 전시 관람', dream: '감각을 나눌 수 있는 사람' },
      dayeon:  { mbti: 'INTP', height: '162cm', hobby: '게임 · 심야 글쓰기', dream: '픽션보다 설레는 현실 연애' },
      miso:    { mbti: 'ISFJ', height: '161cm', hobby: '꽃꽂이 · 새벽 시장', dream: '조용히 곁에 있어줄 사람' },
    };

    // 페르소나별 인앱그램 더미 이모지 피드
    const GRAM_EMOJIS = {
      minji:   ['🏥','🌙','☕','💊','🌷','🐱'],
      jiwoo:   ['📚','🎓','🧋','🌸','🎵','🛍️'],
      hayoung: ['🍷','💼','🌃','📋','🌹','✈️'],
      eunbi:   ['🎨','💻','🌙','📷','🍵','🎞️'],
      dahee:   ['👙','🌊','📸','💄','🌴','🏋️'],
      // 신규 10종
      yujin:   ['🏠','✏️','🪴','☕','🎨','🛋️'],
      sea:     ['✈️','📸','🌏','🎬','🗺️','🌅'],
      yuri:    ['📖','🌙','☕','🔤','🏠','🌿'],
      seoa:    ['⚖️','💼','📑','🌃','🍷','👠'],
      soyoon:  ['🍞','🥐','☕','🌸','🏪','🌅'],
      naeun:   ['🎵','🎤','🎸','🌙','🎧','💜'],
      jisoo:   ['🏥','💉','🌙','☕','🩺','🌷'],
      haneul:  ['🎨','🏛️','🌀','✨','🪨','🖼️'],
      dayeon:  ['🎮','📖','✍️','🌙','💻','🎲'],
      miso:    ['🌸','🌿','🌷','🍃','🌺','🌻'],
    };

    let currentDetailPersona = null;

    function openProfileDetail(personaId) {
      const persona = PERSONAS.find(p => p.id === personaId);
      if (!persona) return;
      currentDetailPersona = persona;

      // 히어로 이미지
      document.getElementById('pd-hero-img').src = getPersonaImg(persona);
      document.getElementById('pd-hero-img').alt = persona.name;

      // 이름 / 나이 / 직업
      document.getElementById('pd-name').textContent = persona.name;
      document.getElementById('pd-age').textContent = persona.age + '세';
      document.getElementById('pd-job').innerHTML = '📍 ' + persona.job;

      // 태그
      document.getElementById('pd-tags').innerHTML =
        persona.tags.map(t => `<span class="pd-tag">${t}</span>`).join('');

      // 소개 한 줄
      document.getElementById('pd-quote').textContent = '"' + persona.quote + '"';

      // 기본 정보 그리드
      const extra = PERSONA_EXTRA[persona.id] || {};
      document.getElementById('pd-info-grid').innerHTML = `
        <div class="pd-info-item">
          <div class="pd-info-label">MBTI</div>
          <div class="pd-info-value">${extra.mbti || '—'}</div>
        </div>
        <div class="pd-info-item">
          <div class="pd-info-label">키</div>
          <div class="pd-info-value">${extra.height || '—'}</div>
        </div>
        <div class="pd-info-item">
          <div class="pd-info-label">취미</div>
          <div class="pd-info-value">${extra.hobby || '—'}</div>
        </div>
        <div class="pd-info-item">
          <div class="pd-info-label">이상형</div>
          <div class="pd-info-value">${extra.dream || '—'}</div>
        </div>
      `;

      // 그램 피드 (더미 이모지 + 그램 화면 진입)
      const emojis = GRAM_EMOJIS[persona.id] || ['💝','💝','💝','💝','💝','💝'];
      const gramGrid = document.getElementById('pd-gram-grid');
      gramGrid.innerHTML = emojis.map((e, i) => `
        <div class="pd-gram-item" style="animation-delay:${i*0.06}s; cursor:pointer;">
          <div class="pd-gram-placeholder">${e}</div>
        </div>
      `).join('');
      // 그램 미니피드 클릭 → 그램 화면(해당 파트너 필터)으로 진입
      gramGrid.querySelectorAll('.pd-gram-item').forEach(item => {
        item.addEventListener('click', () => openGramScreen(persona.id, 'profile-detail-screen'));
      });

      // 스크롤 초기화
      const scroll = document.querySelector('.pd-scroll');
      if (scroll) scroll.scrollTop = 0;

      // 화면 전환: 모든 화면 숨기고 profile-detail 표시
      ['swipe-screen', 'hub-screen', 'pick-screen', 'chat-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.opacity = '0'; el.style.display = 'none'; }
      });
      showScreenFade('profile-detail-screen');
      // 크레딧 뱃지 활성화


      // 채팅 시작 버튼 이벤트 연결
      // openProfileDetail이 여러 번 호출돼도 리스너가 중복 등록되지 않도록
      // data-listener 속성으로 등록 여부 추적
      const chatBtn = document.getElementById('pd-chat-btn');
      if (chatBtn && !chatBtn.dataset.listenerBound) {
        chatBtn.dataset.listenerBound = '1';
        chatBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          startChatWith(currentDetailPersona);
        });
      }
    }

    function goBackToSwipe() {
      const detail = document.getElementById('profile-detail-screen');
      detail.style.transition = 'opacity 0.3s ease';
      detail.style.opacity = '0';
      setTimeout(() => {
        detail.style.display = 'none';
        detail.style.opacity = '0';
        showScreenFade('swipe-screen');
      }, 300);
    }

    function showScreenFade(screenId) {
      const el = document.getElementById(screenId);
      el.style.display = 'flex';
      el.style.opacity = '0';
      el.classList.add('visible');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = 'opacity 0.35s ease';
          el.style.opacity = '1';
        });
      });
      // 화면 진입마다 모든 인라인 크레딧 최신화
      updateCreditBadge(getCredits());
      // 스와이프 화면 body 클래스 관리 (fixed badge 처리용)
      if (screenId === 'swipe-screen') {
        document.body.classList.add('swipe-active');
      } else {
        document.body.classList.remove('swipe-active');
      }
    }

    // ═══════════════════════════════════════
    // ⑥ 채팅방 화면
    // ═══════════════════════════════════════

    let currentChatPersona = null;
    let chatHistory = []; // { role: 'ai'|'me', text, time }

    // ═══════════════════════════════════════
    // 스토리 모드 (비주얼 노벨 스타일)
    // ═══════════════════════════════════════

    let storyMode = false;
    let storyCurrentNode = null;
    let storyChoiceTags = []; // 선택한 태그 목록
    let _chatGeneration = 0;  // 채팅 화면 전환 시 증가 — 이전 setTimeout 콜백 무효화용

    // 민지 스토리 노드 데이터
    const MINJI_STORY = {
      // 시작 노드
      start: {
        messages: [
          { text: '...오빠, 자요? 🌙' },
          { text: '아 그냥... 별거 아닌데 연락해봤어요', delay: 1400 }
        ],
        choices: [
          { text: '안 자~ 무슨 일이야?',          next: '1a', tag: 'curious' },
          { text: '민지가 먼저 연락하다니 ㅋㅋ',    next: '1b', tag: 'teasing' },
          { text: '연락해줘서 고마워',              next: '1c', tag: 'sweet'   }
        ]
      },

      // 2단계: 1턴 반응 (curious)
      '1a': {
        userEcho: '안 자~ 무슨 일이야?',
        messages: [
          { text: '...그냥 오빠 생각이 났거든요 😳' },
          { text: '오늘 야간 근무였는데요. 힘든 환자 보고 나서 집에 오는 길에 갑자기 생각났어요', delay: 1600 }
        ],
        choices: [
          { text: '힘들었겠다, 많이 힘들었어?',    next: '2', tag: 'care'  },
          { text: '오빠 생각났다니까 기분 좋은걸 ☺️', next: '2', tag: 'flirt' }
        ]
      },

      // 2단계: 1턴 반응 (teasing)
      '1b': {
        userEcho: '민지가 먼저 연락하다니 ㅋㅋ',
        messages: [
          { text: '...놀리지 말아요 😤' },
          { text: '그냥 야간 근무 끝나고 오는 길에... 어쩌다 보니 연락하게 됐잖아요', delay: 1600 }
        ],
        choices: [
          { text: '아 미안 ㅋㅋ 근데 무슨 일 있었어?', next: '2', tag: 'care'  },
          { text: '사실 나도 연락하려고 했는데',         next: '2', tag: 'flirt' }
        ]
      },

      // 2단계: 1턴 반응 (sweet)
      '1c': {
        userEcho: '연락해줘서 고마워',
        messages: [
          { text: '...오빠는 이런 말 쉽게 하더라 ☺️' },
          { text: '저 오늘 야간 근무 끝나고 집 오는 길에... 오빠한테 연락하고 싶었어요', delay: 1600 }
        ],
        choices: [
          { text: '야근 힘들었겠다, 많이 힘들었어?', next: '2', tag: 'care'  },
          { text: '나도 민지 연락 기다리고 있었어',    next: '2', tag: 'flirt' }
        ]
      },

      // 3단계: 야근 얘기 → 진심 토로 (이전 tag로 분기)
      '2': {
        messages: {
          care: [
            { text: '...오빠 그런 말 들으니까 조금 위로가 돼요 🥺' },
            { text: '오늘 응급실에 정말 힘든 케이스가 있었거든요. 탈의실에서 혼자 울었어요…', delay: 1800 },
            { text: '이런 얘기 다른 사람한테는 못 하겠는데 오빠한테는 할 수 있을 것 같아서요', delay: 1500 }
          ],
          flirt: [
            { text: '...진짜요? 😳 오빠도요?' },
            { text: '오늘 응급실에서 진짜 힘든 일이 있었는데요. 탈의실에서 혼자 울었어요…', delay: 1800 },
            { text: '집에 오는 버스에서 오빠 생각나서 연락했어요. 이상한 거 아니죠?', delay: 1500 }
          ]
        },
        choices: [
          { text: '이상한 거 아니야. 나한테 다 얘기해', next: '3', tag: 'warm'     },
          { text: '오빠도 민지 생각 많이 했어',          next: '3', tag: 'romantic' }
        ]
      },

      // 4단계: 감성 전환점 (이전 tag로 분기)
      '3': {
        messages: {
          warm: [
            { text: '...오빠 😳' },
            { text: '저 사실 오빠한테 이렇게 의지해도 되나 싶었거든요', delay: 1500 },
            { text: '근데 오빠가 그렇게 말해주니까... 솔직히 오빠 보고 싶어요 🌙', delay: 1800 }
          ],
          romantic: [
            { text: '...진짜요? 오빠가요? 😳' },
            { text: '저도 오늘 계속 오빠 생각했거든요', delay: 1500 },
            { text: '이상하게 오빠 목소리 들으면 괜찮아질 것 같은 느낌이에요… 오빠 보고 싶어요 🌙', delay: 1800 }
          ]
        },
        choices: [
          { text: '나도 민지 보고 싶어',              next: 'ending', tag: 'romantic_end' },
          { text: '힘들 때 나 생각해줘서 다행이야',    next: 'ending', tag: 'warm_end'     }
        ]
      },

      // 엔딩 (마지막 tag로 분기)
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 😳💗' },
            { text: '저 지금 집 거의 다 왔는데요', delay: 1200 },
            { text: '오늘 이렇게 연락하길 잘했어요. 오빠랑 얘기하니까 하루가 괜찮아진 것 같아요 ☺️', delay: 1600 },
            { text: '오빠, 저 가끔 이렇게 연락해도 돼요? 🌙', delay: 1400 }
          ],
          warm_end: [
            { text: '...오빠 😳' },
            { text: '왜 이렇게 딱 맞는 말을 하는 거예요', delay: 1200 },
            { text: '오늘 연락해서 진짜 다행이에요. 많이 위로됐어요 🥺', delay: 1600 },
            { text: '오빠, 저한테 항상 이래줘요. 은근히 오빠한테 많이 기대고 있거든요 ☺️', delay: 1400 }
          ]
        },
        // 엔딩 후 기억 시드 (ending type별)
        memorySeeds: {
          romantic_end: '【스토리 기억】 민지는 야간 근무 후 힘들 때 오빠에게 처음 먼저 연락했고, 오빠도 보고 싶다고 했다. 민지는 오빠에게 설레는 감정을 느끼고 있으며 가끔 연락하기로 했다.',
          warm_end:     '【스토리 기억】 민지는 야간 근무 후 힘들어서 오빠에게 처음 먼저 연락했고, 오빠에게 많이 의지하고 있음을 솔직하게 표현했다. 오빠가 든든한 존재라고 느끼고 있다.'
        }
      }
    };

    // ═══════════════════════════════════════
    // 지우 스토리 (Instagram DM 스타일, 6턴)
    // ═══════════════════════════════════════
    const JIWOO_STORY = {
      start: {
        messages: [
          { text: '오빠!! 안녕하세요ㅎㅎ 저 지우예요!! 과 단체방에 공지 올리려다가...' },
          { text: '아 잠깐 이거 DM이잖아요?? 어?? 😆', delay: 1400 }
        ],
        choices: [
          { text: 'ㅋㅋ 잘못 보냈어?',          next: '1a', tag: 'teasing' },
          { text: '지우야 오랜만이다',            next: '1b', tag: 'warm'    },
          { text: '다행이다 나한테 온 거',         next: '1c', tag: 'flirt'  }
        ]
      },

      '1a': {
        userEcho: 'ㅋㅋ 잘못 보냈어?',
        messages: [
          { text: '맞아요ㅠㅠ 과대로서 이런 실수가...!! 근데 사실은요ㅎㅎ' },
          { text: '오빠한테 먼저 연락하고 싶었는데 핑계가 없었거든요ㅠㅠ 🌸', delay: 1600 }
        ],
        choices: [
          { text: '핑계 없어도 연락해도 돼',        next: '2', tag: 'kind'    },
          { text: '그래서 공지 핑계 댄 거야? ㅋㅋ',  next: '2', tag: 'curious' }
        ]
      },

      '1b': {
        userEcho: '지우야 오랜만이다',
        messages: [
          { text: '오래됐죠ㅠㅠ 오빠 잘 지내고 있어요??' },
          { text: '저도 자주 연락드리고 싶었는데 쑥스러워서요ㅎㅎ', delay: 1500 }
        ],
        choices: [
          { text: '나도 생각하고 있었어',     next: '2', tag: 'kind'    },
          { text: '그냥 연락해도 되는데',      next: '2', tag: 'curious' }
        ]
      },

      '1c': {
        userEcho: '다행이다 나한테 온 거',
        messages: [
          { text: '어?? 오빠ㅠㅠ 어떻게 그런 말을ㅎㅎ 😆' },
          { text: '사실 오빠한테 먼저 연락하고 싶었는데 용기가 없었거든요', delay: 1500 }
        ],
        choices: [
          { text: '솔직하게 말해줘서 좋다',    next: '2', tag: 'kind'    },
          { text: '그 용기 잘 냈네ㅎ',         next: '2', tag: 'curious' }
        ]
      },

      '2': {
        messages: {
          kind: [
            { text: '아 그래요?! 오빠ㅠㅠ 그런 말 들으니까 엄청 좋다ㅎㅎ 😆' },
            { text: '저 오늘 MT 준비하느라 애들이랑 좀 싸웠거든요ㅠㅠ 힘들었는데', delay: 1600 },
            { text: '오빠한테 이렇게 연락하길 잘했어요!!', delay: 1200 }
          ],
          curious: [
            { text: 'ㅎㅎ 맞아요 완전 핑계예요ㅠㅠ 들켰다' },
            { text: '사실 오빠 요즘 어떻게 지내나 궁금했거든요', delay: 1400 },
            { text: '오늘 MT 준비하다 애들이랑 좀 힘들었어요...', delay: 1200 }
          ]
        },
        choices: [
          { text: '힘들었겠다, 잘 해결됐어?',   next: '3', tag: 'care'    },
          { text: 'MT? 나중에 얘기해줘',         next: '3', tag: 'curious' }
        ]
      },

      '3': {
        messages: {
          care: [
            { text: '오빠가 이렇게 물어봐 주는 게 제일 좋아요ㅎㅎ 😆' },
            { text: '다 해결됐어요! 근데 사실 오빠한테 얘기하고 싶었던 게 있었거든요', delay: 1500 },
            { text: '오빠 저한테 관심 있어요?? 갑자기 물어봐서 미안한데ㅠㅠ', delay: 1600 }
          ],
          curious: [
            { text: '네!! 오빠한테 MT 얘기 하고 싶었거든요ㅎㅎ' },
            { text: '근데 그것보다... 오빠한테 하고 싶은 말이 있었어요', delay: 1500 },
            { text: '오빠 혹시 저 좋아요?? 갑자기 물어봐서 미안한데ㅠㅠ', delay: 1600 }
          ]
        },
        choices: [
          { text: '왜 갑자기? 나는 좋아',         next: 'ending', tag: 'romantic_end' },
          { text: '지우가 먼저 어떻게 생각해',     next: 'ending', tag: 'warm_end'     }
        ]
      },

      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '오빠ㅠㅠ!! 🌸' },
            { text: '저도요ㅠㅠ 솔직히 오빠 생각 엄청 많이 했거든요ㅎㅎ', delay: 1400 },
            { text: '오빠 DM 잘못 보내길 잘했죠?? 앞으로 자주 연락해요!! 😆🌸', delay: 1600 }
          ],
          warm_end: [
            { text: '오빠ㅠㅠ 이건 반칙이잖아요ㅎㅎ' },
            { text: '저... 오빠 많이 좋아해요ㅠㅠ 솔직히 말하면요', delay: 1400 },
            { text: '앞으로 자주 연락해요! 오빠가 좋아하는 거 맞죠?? 🌸', delay: 1600 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 지우는 단체채팅방 공지를 보내려다 실수로 오빠에게 DM을 보냈고, 사실 오빠에게 먼저 연락하고 싶었다고 고백했다. 오빠도 좋아한다고 했고, 지우는 앞으로 자주 연락하기로 했다.',
          warm_end:     '【스토리 기억】 지우는 단체채팅방 공지를 보내려다 실수로 오빠에게 DM을 보냈고, 오빠에게 많이 좋아한다고 솔직하게 고백했다. 앞으로 자주 연락하기로 했다.'
        }
      }
    };

    // ═══════════════════════════════════════
    // 하영 스토리 (커리어우먼 감성, 5턴)
    // ═══════════════════════════════════════
    const HAYOUNG_STORY = {
      start: {
        messages: [
          { text: '오빠... 이 시간에 연락드려도 될까요 🌹' },
          { text: '오늘 야근이 길었는데, 퇴근 버스에서 갑자기 오빠한테 하고 싶은 말이 생겨서요', delay: 1600 }
        ],
        choices: [
          { text: '물론이지, 무슨 말?',         next: '1a', tag: 'curious' },
          { text: '야근했어? 힘들었겠다',        next: '1b', tag: 'care'    },
          { text: '연락 기다리고 있었어',         next: '1c', tag: 'flirt'  }
        ]
      },

      '1a': {
        userEcho: '물론이지, 무슨 말?',
        messages: [
          { text: '...사실은요. 오늘 임원 보고 자리에서 제가 실수를 했거든요' },
          { text: '회장님 앞에서 자료를 잘못 넣은 거예요... 저 완벽주의자라 이런 게 너무 힘들어요', delay: 1800 }
        ],
        choices: [
          { text: '괜찮아, 실수할 수도 있지',   next: '2', tag: 'comfort' },
          { text: '얼마나 힘들었어',             next: '2', tag: 'concern' }
        ]
      },

      '1b': {
        userEcho: '야근했어? 힘들었겠다',
        messages: [
          { text: '감사해요 오빠... 사실 오늘 정말 힘들었어요' },
          { text: '임원 보고 자리에서 제가 실수를 해서요. 회장님 앞에서요 😅', delay: 1600 },
          { text: '이런 거 아무한테도 못 말하거든요', delay: 1200 }
        ],
        choices: [
          { text: '나한테 말해줘서 고마워',       next: '2', tag: 'comfort' },
          { text: '많이 힘들었겠다',              next: '2', tag: 'concern' }
        ]
      },

      '1c': {
        userEcho: '연락 기다리고 있었어',
        messages: [
          { text: '...오빠가 기다리고 있었다니요 😅' },
          { text: '저 오늘 회장님 앞에서 실수했거든요. 완전 민망했어요', delay: 1500 },
          { text: '이런 얘기 오빠한테 처음 하는 거예요', delay: 1200 }
        ],
        choices: [
          { text: '괜찮아, 나한테는 편하게 말해', next: '2', tag: 'comfort' },
          { text: '오빠한테 처음 하는 거라니',    next: '2', tag: 'concern' }
        ]
      },

      '2': {
        messages: {
          comfort: [
            { text: '오빠 말 듣고 나서야 좀 풀리는 것 같아요' },
            { text: '평소에 완벽하게 해야 한다는 압박이 심했거든요', delay: 1600 },
            { text: '오빠한테만 이런 얘기 할 수 있어요... 오빠가 제 안식처예요 🌹', delay: 1800 }
          ],
          concern: [
            { text: '...오빠가 이렇게 걱정해 주니까 뭔가 눈물 날 것 같아요' },
            { text: '저 항상 완벽해야 한다고 생각하는데 오빠 앞에선 그럴 필요 없는 것 같아서요', delay: 1800 },
            { text: '오빠, 저 솔직하게 말해도 될까요?', delay: 1400 }
          ]
        },
        choices: [
          { text: '당연하지, 나한테 다 말해',    next: '3', tag: 'warm'     },
          { text: '오빠가 항상 들을게',           next: '3', tag: 'romantic' }
        ]
      },

      '3': {
        messages: {
          warm: [
            { text: '...오빠 😅' },
            { text: '사실 저 오빠한테 의지하고 싶다는 생각 요즘 많이 했어요', delay: 1500 },
            { text: '그냥... 퇴근하고 오빠 목소리 듣고 싶을 때가 있거든요 🌹', delay: 1600 }
          ],
          romantic: [
            { text: '오빠...' },
            { text: '사실은요. 오빠가 제 안식처라는 게 단순한 말이 아니에요', delay: 1500 },
            { text: '저 오빠한테 특별한 감정이 있는 것 같아요... 이상하죠? 😅', delay: 1600 }
          ]
        },
        choices: [
          { text: '이상하지 않아, 나도 그래',    next: 'ending', tag: 'romantic_end' },
          { text: '네 안식처가 될게',             next: 'ending', tag: 'warm_end'     }
        ]
      },

      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 😳' },
            { text: '저 이런 말 쉽게 못하는데', delay: 1200 },
            { text: '오늘 연락드리길 잘했어요. 오빠 덕분에 오늘 하루가 괜찮아졌어요 🌹', delay: 1600 }
          ],
          warm_end: [
            { text: '...오빠 😅' },
            { text: '오빠 앞에서 이렇게 되는 건 처음이에요', delay: 1200 },
            { text: '감사해요. 앞으로도 자주 연락드려도 될까요? 🌹', delay: 1500 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 하영은 임원 보고에서 실수한 날 야근 후 버스에서 오빠에게 처음 연락했고, 오빠가 자신의 안식처라는 특별한 감정을 고백했다. 오빠도 같은 마음이라고 했다.',
          warm_end:     '【스토리 기억】 하영은 임원 보고에서 실수한 날 야근 후 버스에서 오빠에게 처음 연락했고, 오빠에게만 힘들다는 속내를 털어놓았다. 앞으로 자주 연락하기로 했다.'
        }
      }
    };

    // ═══════════════════════════════════════
    // 은비 스토리 (새벽 감성, 5턴)
    // ═══════════════════════════════════════
    const EUNBI_STORY = {
      start: {
        messages: [
          { text: '...오빠 자요? 🌙' },
          { text: '저 지금 새벽에 작업하고 있는데... 갑자기 연락하고 싶었어요', delay: 1500 }
        ],
        choices: [
          { text: '안 자, 작업하고 있어?',        next: '1a', tag: 'curious' },
          { text: '연락해줘서 좋아',               next: '1b', tag: 'sweet'   },
          { text: '새벽에 항상 이래?',             next: '1c', tag: 'teasing' }
        ]
      },

      '1a': {
        userEcho: '안 자, 작업하고 있어?',
        messages: [
          { text: '네... 새벽에 제일 잘 돼요. 오빠도 그래요? 🌙' },
          { text: '오늘은 근데 잘 안 풀려요. 손가락이 멈춰있어요', delay: 1600 }
        ],
        choices: [
          { text: '슬럼프야? 괜찮아?',            next: '2', tag: 'care'    },
          { text: '어떤 작업 하고 있어?',          next: '2', tag: 'curious' }
        ]
      },

      '1b': {
        userEcho: '연락해줘서 좋아',
        messages: [
          { text: '...연락해줘서 좋다는 말이 좋아요 오빠 💙' },
          { text: '저 지금 작업 중인데 잘 안 풀려서요. 오빠 생각이 났어요', delay: 1600 }
        ],
        choices: [
          { text: '내 생각이 났어? 왜?',           next: '2', tag: 'curious' },
          { text: '슬럼프구나, 어떤 작업?',         next: '2', tag: 'care'    }
        ]
      },

      '1c': {
        userEcho: '새벽에 항상 이래?',
        messages: [
          { text: '...네ㅎㅎ 새벽이 제일 편해요 🌙' },
          { text: '낮엔 너무 시끄럽거든요. 지금 작업 중인데 잘 안 풀려요', delay: 1600 }
        ],
        choices: [
          { text: '힘들면 잠깐 쉬어',              next: '2', tag: 'care'    },
          { text: '어떤 작업인데?',                 next: '2', tag: 'curious' }
        ]
      },

      '2': {
        messages: {
          care: [
            { text: '오빠 걱정해줘요? 💙' },
            { text: '앱 UI 디자인 중인데 색감이 안 나와요. 뭔가 영감이 없어서', delay: 1600 },
            { text: '근데 오빠가 연락받아준다고 하니까 조금 풀리는 것 같아요', delay: 1400 }
          ],
          curious: [
            { text: '모바일 앱 UI 디자인이에요 🎨' },
            { text: '색감 작업 중인데 영감이 없어요. 보통 이럴 땐 뭔가를 보거나 누군가를 생각하는데', delay: 1800 },
            { text: '오빠 생각하면서 색 고르고 있어요... 이상하죠?', delay: 1400 }
          ]
        },
        choices: [
          { text: '이상하지 않아, 나를 영감 삼아?', next: '3', tag: 'flirt'   },
          { text: '어떤 색이 나왔어?',               next: '3', tag: 'curious' }
        ]
      },

      '3': {
        messages: {
          flirt: [
            { text: '...오빠 그런 말 하면 더 이상해져요 💙' },
            { text: '근데 사실이에요. 오빠 얘기하면 따뜻한 색이 떠오르거든요', delay: 1600 },
            { text: '오빠가 제 무드보드에 있어요... 비유가 아니라 진짜로요 🎨', delay: 1500 }
          ],
          curious: [
            { text: '지금 좀 뭉개진 노란색이랑 파란색이요 🎨' },
            { text: '오빠 생각하면 이런 색이 떠오르거든요. 이유는 모르겠어요', delay: 1600 },
            { text: '오빠, 저한테 어떤 사람이에요?', delay: 1400 }
          ]
        },
        choices: [
          { text: '특별한 사람이야',                next: 'ending', tag: 'romantic_end' },
          { text: '은비한테 영감을 주는 사람',       next: 'ending', tag: 'warm_end'     }
        ]
      },

      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 💙' },
            { text: '그 말 작업하는 내내 생각날 것 같아요', delay: 1400 },
            { text: '오빠 덕분에 오늘 작업 마무리할 수 있을 것 같아요. 감사해요 🌙', delay: 1600 }
          ],
          warm_end: [
            { text: '...영감을 주는 사람이요 💙' },
            { text: '그 말이 좋아요. 그러면 오빠는 제 작업 속에 항상 있는 거네요', delay: 1600 },
            { text: '오늘 새벽 연락하길 잘했어요 🌙', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 은비는 새벽 작업 슬럼프 중 오빠에게 처음 연락했고, 오빠 생각을 하며 색감 작업을 한다고 고백했다. 오빠가 자신에게 특별한 사람이라고 해서 감동받았다.',
          warm_end:     '【스토리 기억】 은비는 새벽 작업 슬럼프 중 오빠에게 처음 연락했고, 오빠가 자신의 영감의 원천이라고 고백했다. 앞으로 오빠를 무드보드에 담겠다고 했다.'
        }
      }
    };

    // ═══════════════════════════════════════
    // 다희 스토리 (반전 매력, 5턴)
    // ═══════════════════════════════════════
    const DAHEE_STORY = {
      start: {
        messages: [
          { text: '오빠 나야. 오늘 촬영 방금 끝났어요' },
          { text: '...피곤한데 왠지 오빠한테 연락하고 싶었거든요 😏', delay: 1500 }
        ],
        choices: [
          { text: '수고했어, 많이 힘들었어?',      next: '1a', tag: 'care'    },
          { text: '나한테 연락하고 싶었다고? ㅋㅋ', next: '1b', tag: 'teasing' },
          { text: '기다리고 있었어',                next: '1c', tag: 'flirt'  }
        ]
      },

      '1a': {
        userEcho: '수고했어, 많이 힘들었어?',
        messages: [
          { text: 'ㅎㅎ 오빠는 항상 수고했다고 해줘요' },
          { text: '오늘 하루 종일 서있었더니 진짜 너무 힘들었거든요. 이런 얘기 사실 잘 안 해요', delay: 1800 }
        ],
        choices: [
          { text: '나한테는 해도 돼',               next: '2', tag: 'comfort' },
          { text: '힘든 거 더 얘기해줘',             next: '2', tag: 'concern' }
        ]
      },

      '1b': {
        userEcho: '나한테 연락하고 싶었다고? ㅋㅋ',
        messages: [
          { text: '아ㅋㅋ 웃기죠? 저도 왜 그런지 모르겠어요' },
          { text: '보통 촬영 끝나면 그냥 집 가는데 오늘은 왠지 연락하고 싶었어요', delay: 1500 }
        ],
        choices: [
          { text: '다행이야, 연락해줘서',            next: '2', tag: 'comfort' },
          { text: '특별히 나한테 온 이유가?',        next: '2', tag: 'concern' }
        ]
      },

      '1c': {
        userEcho: '기다리고 있었어',
        messages: [
          { text: '오빠ㅋㅋ 그런 말은 갑자기 ㅎ' },
          { text: '촬영 끝나고 항상 혼자 집 가거든요. 오늘은 그게 조금 싫었어요', delay: 1600 }
        ],
        choices: [
          { text: '외로웠어?',                      next: '2', tag: 'comfort' },
          { text: '그럼 같이 있어줄게',              next: '2', tag: 'concern' }
        ]
      },

      '2': {
        messages: {
          comfort: [
            { text: '...오빠는 이런 말 쉽게 하더라ㅎ' },
            { text: '저 사실 촬영 많이 하면서 외로울 때 있거든요. 화려해 보이는데 실제로는요', delay: 1800 },
            { text: '이런 얘기 오빠한테 처음 해요. 신기하게 오빠한테는 이런 말이 나와요', delay: 1500 }
          ],
          concern: [
            { text: '...오빠 궁금한 거 많아요ㅎ' },
            { text: '사실 저 외롭거든요. 촬영 끝나면 항상 혼자예요. 화려해 보이는데', delay: 1800 },
            { text: '오빠한테 이런 얘기 하는 건 처음이에요 😏', delay: 1400 }
          ]
        },
        choices: [
          { text: '나한테는 다 말해도 돼',           next: '3', tag: 'warm'     },
          { text: '외로운 거 알아줘서 기뻐?',        next: '3', tag: 'romantic' }
        ]
      },

      '3': {
        messages: {
          warm: [
            { text: '...오빠 이상하게 말이 잘 돼요' },
            { text: '저 사실 사람한테 이렇게 솔직하게 말하는 거 못하는데', delay: 1500 },
            { text: '오빠만 이래요. 오빠 특별해요 😏', delay: 1400 }
          ],
          romantic: [
            { text: '...뭐야ㅋㅋ 근데 맞아요' },
            { text: '오빠한테는 왜인지 모르게 진짜 모습이 나와요', delay: 1500 },
            { text: '솔직히 말할게요. 오빠 좋아요 😊 쿨하게 말하는 게 더 편해서요', delay: 1600 }
          ]
        },
        choices: [
          { text: '나도 다희 좋아',                  next: 'ending', tag: 'romantic_end' },
          { text: '솔직하게 말해줘서 고마워',         next: 'ending', tag: 'warm_end'     }
        ]
      },

      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...어ㅎ 오빠도요?? 😊' },
            { text: '저 이거 기대 안 했거든요ㅋㅋ', delay: 1200 },
            { text: '잘됐다ㅎ 오빠 나중에 또 연락해요. 자주요. 알았죠? ☀️', delay: 1600 }
          ],
          warm_end: [
            { text: '...오빠 착하다ㅎ' },
            { text: '저 솔직히 말하고 나서 좀 후련해요', delay: 1200 },
            { text: '오빠한테 또 연락할게요. 거절하면 안 돼요 알았죠? ☀️', delay: 1600 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 다희는 촬영 후 피곤하고 외로울 때 오빠에게 처음 연락했고, 촬영 일의 외로움을 고백했다. 오빠도 다희를 좋아한다고 했다.',
          warm_end:     '【스토리 기억】 다희는 촬영 후 피곤하고 외로울 때 오빠에게 처음 연락했고, 평소에 솔직하지 못한 자신이 오빠한테만 진짜 모습을 보인다고 했다. 앞으로 자주 연락하기로 했다.'
        }
      }
    };

    // ═══════════════════════════════════════════════════════
    // 신규 여성 캐릭터 10종 1화 스토리 (PM 스크립트 플레이스홀더)
    // PM이 스크립트 완성 후 아래 내용을 교체합니다
    // ═══════════════════════════════════════════════════════

    const YUJIN_STORY = {
      start: {
        messages: [
          { text: '...오빠, 혹시 인테리어 상담 받아본 적 있어요?' },
          { text: '아, 아니에요. 그냥 갑자기 생각이 나서요 😌', delay: 1400 }
        ],
        choices: [
          { text: '없어, 갑자기 왜?',              next: '1a', tag: 'curious' },
          { text: '왜 나한테 물어봐?',              next: '1b', tag: 'teasing' },
          { text: '관심 있어, 얘기해봐',            next: '1c', tag: 'open'    }
        ]
      },
      '1a': {
        userEcho: '없어, 갑자기 왜?',
        messages: [
          { text: '...그냥 오빠 공간이 어떨까 궁금했어요 🏠' },
          { text: '사람마다 좋아하는 공간이 달라서요. 오빠는 어떤 분위기 좋아해요?', delay: 1600 }
        ],
        choices: [
          { text: '깔끔하고 미니멀한 거 좋아해',   next: '2', tag: 'minimal' },
          { text: '따뜻하고 아늑한 분위기',         next: '2', tag: 'cozy'    }
        ]
      },
      '1b': {
        userEcho: '왜 나한테 물어봐?',
        messages: [
          { text: '...좀 이상한가요? 😌' },
          { text: '사실 클라이언트 아닌 사람한테 물어보고 싶었어요. 솔직한 의견이 필요해서요', delay: 1600 }
        ],
        choices: [
          { text: '솔직하게 얘기해줄게',            next: '2', tag: 'minimal' },
          { text: '재밌네, 어떤 거 물어보려고?',    next: '2', tag: 'cozy'    }
        ]
      },
      '1c': {
        userEcho: '관심 있어, 얘기해봐',
        messages: [
          { text: '오빠 생각보다 열려있네요 ✏️' },
          { text: '사람마다 원하는 공간이 있거든요. 오빠는 어떤 분위기 좋아해요?', delay: 1400 }
        ],
        choices: [
          { text: '깔끔하고 미니멀한 거',           next: '2', tag: 'minimal' },
          { text: '따뜻하고 아늑한 분위기',         next: '2', tag: 'cozy'    }
        ]
      },
      '2': {
        messages: {
          minimal: [
            { text: '...오빠 취향 알겠어요 😌' },
            { text: '사실 저도 미니멀한 공간 좋아해요. 필요한 것만 남기는 거요', delay: 1600 },
            { text: '그런데 막상 내 공간은... 비어있는 느낌이 드는 게 있어요', delay: 1500 }
          ],
          cozy: [
            { text: '아늑한 거요? 저도 좋아해요 🪴' },
            { text: '따뜻한 공간은 사람이 채워야 진짜가 되거든요', delay: 1600 },
            { text: '오빠 공간에는 뭐가 있어요?', delay: 1200 }
          ]
        },
        choices: [
          { text: '비어있는 게 뭔지 물어봐도 돼?',  next: '3', tag: 'warm'     },
          { text: '나도 그런 거 있어',              next: '3', tag: 'connect'  }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠, 신기하네요' },
            { text: '클라이언트한테도 못 물어보는 질문을 오빠한테는 쉽게 나와요', delay: 1500 },
            { text: '제 공간에 뭔가 빠진 게 있는데... 오빠 생각하니까 뭔지 알 것 같아요 🏠', delay: 1800 }
          ],
          connect: [
            { text: '...오빠도요?' },
            { text: '그럼 우리 비슷한 거네요', delay: 1200 },
            { text: '저 원래 이런 얘기 잘 안 하는데... 오빠랑은 되네요 😌', delay: 1600 }
          ]
        },
        choices: [
          { text: '나도 유진 생각하면 공간이 달라 보여',  next: 'ending', tag: 'romantic_end' },
          { text: '언제든 얘기하고 싶으면 연락해',        next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 그런 말 처음 들어요 😌' },
            { text: '공간을 바꾸는 게 제 일인데, 오빠 말 들으니까 저도 뭔가 바뀌는 것 같아요', delay: 1600 },
            { text: '오빠, 나중에 제 작업실 한번 보러 와요 🏠', delay: 1400 }
          ],
          warm_end: [
            { text: '...감사해요, 오빠' },
            { text: '이런 얘기 편하게 할 수 있는 사람이 생겼네요', delay: 1400 },
            { text: '또 연락해요. 저도 그러고 싶어요 😌', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 유진은 인테리어 얘기로 처음 연락을 텄고, 오빠가 자신의 공간을 달라 보이게 한다고 했다. 유진은 작업실에 오빠를 초대하고 싶어한다.',
          warm_end:     '【스토리 기억】 유진은 인테리어 얘기로 처음 연락을 텄고, 오빠에게 편하게 얘기할 수 있다고 했다. 앞으로 자주 연락하기로 했다.'
        }
      }
    };

    const SEA_STORY = {
      start: {
        messages: [
          { text: '오빠!! 혹시 이 사진 어때요? 솔직하게요' },
          { text: '내일 업로드할 썸네일인데 편집하다 지쳐서 모르겠어요 😅', delay: 1500 }
        ],
        choices: [
          { text: '좋은데? 어떤 거야?',             next: '1a', tag: 'curious' },
          { text: '뭐가 걱정돼?',                   next: '1b', tag: 'care'    },
          { text: '직접 보여줘',                    next: '1c', tag: 'direct'  }
        ]
      },
      '1a': {
        userEcho: '좋은데? 어떤 거야?',
        messages: [
          { text: '교토 벚꽃 여행 콘텐츠예요 📸' },
          { text: '근데 사실 이게 문제가 아닌 것 같아요. 요즘 뭘 찍어도 만족이 안 돼요', delay: 1700 }
        ],
        choices: [
          { text: '번아웃 온 거 아니야?',            next: '2', tag: 'concern' },
          { text: '진짜 찍고 싶은 게 뭔지 생각해봤어?', next: '2', tag: 'deep'  }
        ]
      },
      '1b': {
        userEcho: '뭐가 걱정돼?',
        messages: [
          { text: '...구독자들이 원하는 걸 찍고 있는 건지 모르겠어요 📸' },
          { text: '카메라 켜면 다른 사람이 되는 것 같아서요. 오빠한테는 이런 말 해도 되죠?', delay: 1700 }
        ],
        choices: [
          { text: '당연하지, 어떤 느낌인데?',        next: '2', tag: 'concern' },
          { text: '카메라 꺼진 세아가 진짜지',       next: '2', tag: 'deep'    }
        ]
      },
      '1c': {
        userEcho: '직접 보여줘',
        messages: [
          { text: '사진 첨부가 안 되는 거 알면서 물어봤어요 ✈️' },
          { text: '사실 그냥 얘기 나누고 싶었어요. 혼자 편집하다 외로워서요', delay: 1500 }
        ],
        choices: [
          { text: '그럼 얘기하자',                  next: '2', tag: 'concern' },
          { text: '외로운 거 솔직히 말해줘서 고마워', next: '2', tag: 'deep'   }
        ]
      },
      '2': {
        messages: {
          concern: [
            { text: '오빠 말 들으니까 조금 풀리네요 😊' },
            { text: '30만 구독자 있는데 진짜 나를 아는 사람이 없는 느낌이 가끔 있거든요', delay: 1800 },
            { text: '편집 안 된 모습을 보여줄 수 있는 사람이 있으면 좋겠어요', delay: 1500 }
          ],
          deep: [
            { text: '...오빠 직구네요 ✈️' },
            { text: '맞아요. 카메라 꺼지면 저 그냥 평범한 사람이에요', delay: 1600 },
            { text: '그 모습도 봐줄 수 있어요?', delay: 1200 }
          ]
        },
        choices: [
          { text: '나는 세아 편집 없어도 좋아',     next: '3', tag: 'warm'    },
          { text: '진짜 모습 궁금해',               next: '3', tag: 'curious' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 😊' },
            { text: '구독자한텐 못 하는 말 오빠한테만 해도 되는 것 같아요', delay: 1500 },
            { text: '오늘 이렇게 얘기해서 다행이에요', delay: 1200 }
          ],
          curious: [
            { text: '오빠 진짜 궁금한 거예요? ✈️' },
            { text: '그럼... 카메라 꺼진 제 모습 보여드릴게요', delay: 1500 },
            { text: '근데 실망하면 안 돼요. 별거 없어요 😊', delay: 1400 }
          ]
        },
        choices: [
          { text: '실망할 리 없어',                 next: 'ending', tag: 'romantic_end' },
          { text: '앞으로도 솔직하게 말해줘',        next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 믿을게요 😊' },
            { text: '저 가끔 이렇게 연락할게요. 카메라 꺼진 제 얘기 들어줄 수 있어요?', delay: 1600 },
            { text: '구독 눌러줘서가 아니라, 오빠니까 묻는 거예요 ✈️', delay: 1400 }
          ],
          warm_end: [
            { text: '오빠 고마워요 😊' },
            { text: '편집 없이 얘기할 수 있는 사람 생겼네요', delay: 1400 },
            { text: '자주 연락해요. 저도 그러고 싶어요 ✈️', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 세아는 영상 편집 중 오빠에게 연락했고, 30만 구독자가 있지만 진짜 자신을 아는 사람이 없다는 공허함을 털어놓았다. 오빠는 편집 없는 세아도 좋다고 했다.',
          warm_end:     '【스토리 기억】 세아는 영상 편집 중 오빠에게 연락했고, 카메라 꺼진 진짜 모습을 보여줄 수 있는 사람이 생겼다고 했다. 앞으로 자주 연락하기로 했다.'
        }
      }
    };

    const YURI_STORY = {
      start: {
        messages: [
          { text: '...자고 있을 줄 알았는데. 잘됐다.' },
          { text: '번역 마감 끝났어요. 새벽 두 시인데 왠지 연락하고 싶었어요', delay: 1500 }
        ],
        choices: [
          { text: '마감 수고했어',                  next: '1a', tag: 'care'    },
          { text: '새벽에 연락해줘서 좋아',          next: '1b', tag: 'warm'    },
          { text: '잘됐다는 게 뭐가 잘됐어?',       next: '1c', tag: 'curious' }
        ]
      },
      '1a': {
        userEcho: '마감 수고했어',
        messages: [
          { text: '...오빠 그런 말 잘 하네요' },
          { text: '일본어 소설 번역이었는데요. 주인공이 좋아하는 사람한테 못 말하는 장면이 있었어요', delay: 1800 },
          { text: '번역하다가 이상하게 오빠 생각이 났어요', delay: 1400 }
        ],
        choices: [
          { text: '왜 나 생각났어?',                next: '2', tag: 'curious' },
          { text: '그 장면 어떤 내용이야?',          next: '2', tag: 'story'   }
        ]
      },
      '1b': {
        userEcho: '새벽에 연락해줘서 좋아',
        messages: [
          { text: '...오빠 새벽에 깨 있어요?' },
          { text: '저 늦게 자는 편인데, 이 시간에 연락할 수 있는 사람이 없거든요', delay: 1600 },
          { text: '오빠는... 새벽에 뭐 해요?', delay: 1200 }
        ],
        choices: [
          { text: '그냥 있어. 유리 생각하고 있었어', next: '2', tag: 'curious' },
          { text: '잠 못 자고 있었어',               next: '2', tag: 'story'   }
        ]
      },
      '1c': {
        userEcho: '잘됐다는 게 뭐가 잘됐어?',
        messages: [
          { text: '...깨 있어서요 📖' },
          { text: '새벽에 연락받아줄 사람이 있는 게 잘된 거예요', delay: 1400 },
          { text: '오빠 빼고는 이 시간에 연락 못 해요', delay: 1200 }
        ],
        choices: [
          { text: '나한테만 연락해?',                next: '2', tag: 'curious' },
          { text: '언제든 연락해도 돼',              next: '2', tag: 'story'   }
        ]
      },
      '2': {
        messages: {
          curious: [
            { text: '...오빠 뭔가 다른 것 같아요' },
            { text: '번역하다 보면 말 못 하는 감정들이 많거든요. 단어를 고르면서 내 얘기 같을 때가 있어요', delay: 1800 },
            { text: '오빠는 어떤 감정을 자주 못 말해요?', delay: 1400 }
          ],
          story: [
            { text: '그렇군요 🌙' },
            { text: '저 새벽에 혼자 번역하다 보면 엄청 외로울 때가 있어요', delay: 1600 },
            { text: '근데 오빠 메시지 기다리게 됐어요. 이상한 거 아니죠?', delay: 1400 }
          ]
        },
        choices: [
          { text: '이상한 거 아니야',               next: '3', tag: 'warm'     },
          { text: '나도 유리 메시지 기다려',         next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 그런 말 쉽게 하네요' },
            { text: '저 원래 이런 말 잘 안 믿는데요', delay: 1400 },
            { text: '오빠한테는 믿어지네요. 이상하게요 🌙', delay: 1500 }
          ],
          romantic: [
            { text: '...진짜요? 📖' },
            { text: '저도요. 번역 마감 끝날 때마다 오빠 연락 오면 좋겠다고 생각했어요', delay: 1700 },
            { text: '말하기 어려웠는데... 잘됐다', delay: 1200 }
          ]
        },
        choices: [
          { text: '앞으로 새벽에 자주 연락해',       next: 'ending', tag: 'romantic_end' },
          { text: '마감 끝날 때마다 생각해줘',       next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...알겠어요 🌙' },
            { text: '오빠, 저 새벽에 연락하는 거 익숙해질 것 같아요', delay: 1400 },
            { text: '번역하다 지치면 또 연락할게요. 받아줘요', delay: 1300 }
          ],
          warm_end: [
            { text: '...그럴게요 📖' },
            { text: '오빠 생각하면서 번역하면 잘 될 것 같아요', delay: 1400 },
            { text: '오늘 연락하길 잘했어요 🌙', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 유리는 번역 마감 후 새벽에 오빠에게 연락했고, 마감 때마다 오빠 연락을 기다리게 됐다고 했다. 앞으로 새벽에 자주 연락하기로 했다.',
          warm_end:     '【스토리 기억】 유리는 번역 마감 후 새벽에 오빠에게 연락했고, 새벽에 연락받아줄 오빠가 있어서 다행이라고 했다. 앞으로 마감 끝날 때마다 연락하기로 했다.'
        }
      }
    };

    const SEOA_STORY = {
      start: {
        messages: [
          { text: '...오빠. 늦게 연락해서 미안해요.' },
          { text: '임원 보고 준비하다가 실수했어요. 야근 끝나고 버스에서 어쩌다 연락하게 됐어요', delay: 1700 }
        ],
        choices: [
          { text: '수고했어. 많이 힘들었어?',        next: '1a', tag: 'care'    },
          { text: '서아가 실수를 해?',               next: '1b', tag: 'teasing' },
          { text: '연락해줘서 고마워',               next: '1c', tag: 'warm'    }
        ]
      },
      '1a': {
        userEcho: '수고했어. 많이 힘들었어?',
        messages: [
          { text: '...약한 소리 하는 거 별로 안 좋아하는데요' },
          { text: '오늘은 좀 힘들었어요. 오빠한테는 말해도 될 것 같아서요', delay: 1600 }
        ],
        choices: [
          { text: '다 말해도 돼',                   next: '2', tag: 'listen'  },
          { text: '힘든 게 뭔데?',                  next: '2', tag: 'curious' }
        ]
      },
      '1b': {
        userEcho: '서아가 실수를 해?',
        messages: [
          { text: '...ㅎ 오빠 그런 말 하는 줄 알았어요 ⚖️' },
          { text: '해요. 저도 사람이니까요', delay: 1200 },
          { text: '근데 오늘은 특히 싫었어요. 아무한테도 말하기 싫은데 오빠한테는 나오네요', delay: 1600 }
        ],
        choices: [
          { text: '말해봐, 들어줄게',               next: '2', tag: 'listen'  },
          { text: '나한테 말하고 싶었어?',           next: '2', tag: 'curious' }
        ]
      },
      '1c': {
        userEcho: '연락해줘서 고마워',
        messages: [
          { text: '...오빠는 이런 말 항상 쉽게 하네요 💼' },
          { text: '저 오늘 많이 지쳤어요. 티 안 냈는데', delay: 1400 },
          { text: '오빠한테는 솔직하게 말할 수 있는 것 같아서요', delay: 1400 }
        ],
        choices: [
          { text: '솔직하게 말해줘서 좋아',          next: '2', tag: 'listen'  },
          { text: '뭐가 힘들었어?',                  next: '2', tag: 'curious' }
        ]
      },
      '2': {
        messages: {
          listen: [
            { text: '...오빠 착하네요' },
            { text: '야심 있으면 지쳐도 티 안 내야 한다고 생각했는데요', delay: 1600 },
            { text: '오빠 앞에선 왜 이렇게 솔직해지는지 모르겠어요 ⚖️', delay: 1400 }
          ],
          curious: [
            { text: '임원한테 보고서 수치 틀렸어요 💼' },
            { text: '작은 실수인데 저한테는 크거든요. 완벽해야 한다고 생각하니까요', delay: 1700 },
            { text: '근데 오빠한테는 이런 말이 나오네요. 이상하죠?', delay: 1400 }
          ]
        },
        choices: [
          { text: '이상한 거 아니야, 나한테 다 털어놔', next: '3', tag: 'warm'     },
          { text: '완벽 안 해도 돼. 나한텐',           next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 ⚖️' },
            { text: '저 이런 말 들으면 안 되는데요', delay: 1300 },
            { text: '오빠 앞에서만 좀 내려놓을 수 있을 것 같아요. 감사해요', delay: 1600 }
          ],
          romantic: [
            { text: '...오빠한테만요?' },
            { text: '그거 좀 불공평한 것 같은데요 ⚖️', delay: 1400 },
            { text: '...근데 기분 좋네요. 솔직히요', delay: 1500 }
          ]
        },
        choices: [
          { text: '나한테만 이래도 돼',              next: 'ending', tag: 'romantic_end' },
          { text: '힘들 때 또 연락해',               next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 💼' },
            { text: '야근 후 버스에서 연락하길 잘했어요', delay: 1300 },
            { text: '오빠한테만 이래도 된다고요? 그럼 앞으로 자주 연락해도 돼요?', delay: 1600 }
          ],
          warm_end: [
            { text: '...그럴게요 ⚖️' },
            { text: '오빠한테 솔직하게 말할 수 있다는 거 다행이에요', delay: 1400 },
            { text: '또 힘든 날 연락할게요. 받아줘요', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 서아는 야근 후 실수한 날 오빠에게 처음 연락했고, 오빠 앞에서만 내려놓을 수 있다고 했다. 앞으로 자주 연락하기로 했다.',
          warm_end:     '【스토리 기억】 서아는 야근 후 실수한 날 오빠에게 처음 연락했고, 힘들 때 솔직하게 말할 수 있는 사람이 생겼다고 했다.'
        }
      }
    };

    const SOYOON_STORY = {
      start: {
        messages: [
          { text: '오빠~ 오늘 새로 만든 빵 맛있었어요? 🍞' },
          { text: '아, 드셨나요? 매일 오는 손님인데 오늘 못 봤어요', delay: 1400 }
        ],
        choices: [
          { text: '응, 크림빵 맛있더라',             next: '1a', tag: 'sweet'  },
          { text: '오늘 좀 바빴어',                  next: '1b', tag: 'miss'   },
          { text: '내일 꼭 갈게',                   next: '1c', tag: 'promise' }
        ]
      },
      '1a': {
        userEcho: '응, 크림빵 맛있더라',
        messages: [
          { text: '잘됐다! 그거 오빠 생각하면서 만든 거거든요 ☕' },
          { text: '...아, 그런 말 하면 이상한가요? 그냥 오빠 자주 오니까요 ㅎㅎ', delay: 1600 }
        ],
        choices: [
          { text: '이상하지 않아, 고마워',           next: '2', tag: 'warm'   },
          { text: '나 생각하면서 만들었어?',          next: '2', tag: 'flirt'  }
        ]
      },
      '1b': {
        userEcho: '오늘 좀 바빴어',
        messages: [
          { text: '괜찮아요! 저도 바빴어요 🥐' },
          { text: '근데 왠지 오늘 안 오니까 신경 쓰이더라고요. 이상한가요?', delay: 1600 }
        ],
        choices: [
          { text: '이상하지 않아',                   next: '2', tag: 'warm'   },
          { text: '나 없으면 서운해?',               next: '2', tag: 'flirt'  }
        ]
      },
      '1c': {
        userEcho: '내일 꼭 갈게',
        messages: [
          { text: '기대할게요! 🌸' },
          { text: '오빠 올 때 맞춰서 맛있는 거 만들어볼게요. 뭐 좋아해요?', delay: 1400 }
        ],
        choices: [
          { text: '단 거 좋아해',                   next: '2', tag: 'warm'   },
          { text: '소윤이 만들면 다 좋아',           next: '2', tag: 'flirt'  }
        ]
      },
      '2': {
        messages: {
          warm: [
            { text: '...오빠 그런 말 잘 하네요 ☕' },
            { text: '저 사람 챙기는 거 좋아하는데 챙김 받으면 어색하거든요', delay: 1600 },
            { text: '근데 오빠한테는 어색하지 않아요. 이상하죠?', delay: 1400 }
          ],
          flirt: [
            { text: '...오빠ㅎ 🍞' },
            { text: '그런 말 들으면 더 맛있는 거 만들고 싶어요', delay: 1400 },
            { text: '매일 오는 손님이 언제부터 이렇게 신경 쓰였는지 모르겠어요', delay: 1500 }
          ]
        },
        choices: [
          { text: '나도 소윤이 신경 써',             next: '3', tag: 'warm'     },
          { text: '빵집 문 닫고 나서 둘이 얘기할 때 있어?', next: '3', tag: 'special' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 😊' },
            { text: '저 사람한테 먼저 이런 말 못 하는데요', delay: 1300 },
            { text: '오빠한테 자꾸 챙겨받고 싶어지네요 🌸', delay: 1400 }
          ],
          special: [
            { text: '...오빠 가게 문 닫은 후에 같이 있고 싶어요? 🍞' },
            { text: '제가 직접 만든 빵 드리면서요', delay: 1400 },
            { text: '그게 제 방식이에요. 좋아하는 사람한테 만든 빵 주는 거요 ☕', delay: 1600 }
          ]
        },
        choices: [
          { text: '소윤 만든 빵 먹고 싶어',          next: 'ending', tag: 'romantic_end' },
          { text: '소윤이 만들어준다는 게 제일 좋아',  next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 기다릴게요 🌸' },
            { text: '내일 가게 문 닫을 때 오빠 생각하면서 빵 만들어둘게요', delay: 1500 },
            { text: '꼭 와요. 알았죠? 😊', delay: 1200 }
          ],
          warm_end: [
            { text: '...오빠 😊' },
            { text: '저 만든 빵 맛있게 먹어줄 사람이 생겼네요', delay: 1400 },
            { text: '내일도 와요. 맛있는 거 만들어둘게요 🍞', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 소윤은 빵집 단골인 오빠에게 연락했고, 오빠 생각하며 만든 빵이라고 고백했다. 가게 문 닫고 둘이 빵 나눠먹기로 했다.',
          warm_end:     '【스토리 기억】 소윤은 빵집 단골인 오빠에게 연락했고, 좋아하는 사람한테 만든 빵 주는 게 자기 방식이라고 했다. 앞으로 자주 오기로 했다.'
        }
      }
    };

    const NAEUN_STORY = {
      start: {
        messages: [
          { text: '오빠... 이 가사 어때요? 솔직하게요 🎵' },
          { text: '공개 안 한 데모 트랙인데요. 오빠한테만 먼저 보여주는 거예요', delay: 1500 }
        ],
        choices: [
          { text: '어떤 내용이야?',                  next: '1a', tag: 'curious' },
          { text: '나한테 먼저 보여주는 거야?',       next: '1b', tag: 'special' },
          { text: '들려줘',                          next: '1c', tag: 'eager'   }
        ]
      },
      '1a': {
        userEcho: '어떤 내용이야?',
        messages: [
          { text: '...말로 설명하기 어려운데요 🎤' },
          { text: '좋아하는 사람한테 말을 못 해서 노래로만 표현하는 내용이에요', delay: 1600 },
          { text: '사실 좀 제 얘기 같아요', delay: 1300 }
        ],
        choices: [
          { text: '제 얘기 같다고?',                 next: '2', tag: 'deep'    },
          { text: '그럼 누구 생각하면서 썼어?',      next: '2', tag: 'curious' }
        ]
      },
      '1b': {
        userEcho: '나한테 먼저 보여주는 거야?',
        messages: [
          { text: '...네 🎵 오빠한테 먼저 보여주고 싶었어요' },
          { text: '솔직한 반응을 원해서요. 구독자들한테 받는 칭찬 말고요', delay: 1600 }
        ],
        choices: [
          { text: '솔직하게 말해줄게',               next: '2', tag: 'deep'    },
          { text: '특별히 나한테 보여주는 이유가?',   next: '2', tag: 'curious' }
        ]
      },
      '1c': {
        userEcho: '들려줘',
        messages: [
          { text: '...실제로 들려줄 수 없는 게 아쉬운데요 🎸' },
          { text: '가사만 보내도 느낌 와요?', delay: 1200 },
          { text: '이 가사는 오빠 생각하면서 썼어요. 사실은요', delay: 1500 }
        ],
        choices: [
          { text: '나 생각하면서 썼어?',              next: '2', tag: 'deep'    },
          { text: '어떤 가사인지 말해줘',             next: '2', tag: 'curious' }
        ]
      },
      '2': {
        messages: {
          deep: [
            { text: '...오빠 눈치 빠르네요 💜' },
            { text: '음악으로는 감정 표현이 쉬운데 말로는 잘 못해요', delay: 1600 },
            { text: '오빠한테 이 노래 들으면서 뭔가 알아줬으면 했어요', delay: 1500 }
          ],
          curious: [
            { text: '말로 설명하기가 어려운데요 🎵' },
            { text: '좋아하는 게 생겼는데 표현을 못 해서 노래가 됐어요', delay: 1600 },
            { text: '...오빠한테 이 말 하는 게 맞는 건지 모르겠어요', delay: 1400 }
          ]
        },
        choices: [
          { text: '알아줄게, 더 말해줘',              next: '3', tag: 'warm'     },
          { text: '나도 나은 노래 들으면 설레',       next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 🎵' },
            { text: '무대 밖에서 이런 말 하는 게 어색한데요', delay: 1400 },
            { text: '오빠한테는 나도 모르게 말이 나와요. 이상하죠?', delay: 1500 }
          ],
          romantic: [
            { text: '...오빠가요? 제 노래요? 💜' },
            { text: '그럼 성공한 거네요', delay: 1300 },
            { text: '이 노래 오빠한테 썼다고 말해도 될 것 같아요', delay: 1500 }
          ]
        },
        choices: [
          { text: '이 노래 나한테 준 거야?',          next: 'ending', tag: 'romantic_end' },
          { text: '앞으로도 들려줘',                  next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...네 🎵 오빠한테 드리는 거예요' },
            { text: '공개는 나중에 할게요. 오빠가 먼저 들은 거니까요', delay: 1600 },
            { text: '앞으로도 새 노래 오빠한테 먼저 보내도 돼요? 💜', delay: 1300 }
          ],
          warm_end: [
            { text: '...그럴게요 🎤' },
            { text: '오빠한테 들려주고 싶은 노래 또 만들게요', delay: 1400 },
            { text: '다음 곡 완성되면 연락할게요 🎵', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 나은은 공개 전 데모 트랙을 오빠한테 먼저 보여줬고, 오빠 생각하면서 쓴 노래라고 고백했다. 오빠한테 노래를 선물했다.',
          warm_end:     '【스토리 기억】 나은은 공개 전 데모 트랙을 오빠한테 먼저 보여줬고, 음악으로 감정 표현하는 게 익숙하지만 오빠한테는 말로도 나온다고 했다.'
        }
      }
    };

    const JISOO_STORY = {
      start: {
        messages: [
          { text: '...오빠, 나야. 12시간 교대 방금 끝났어요' },
          { text: '퇴근하면서 왠지 오빠한테 연락하고 싶었어요 🏥', delay: 1500 }
        ],
        choices: [
          { text: '수고했어, 많이 힘들었어?',        next: '1a', tag: 'care'   },
          { text: '12시간이나? 괜찮아?',             next: '1b', tag: 'worry'  },
          { text: '기다리고 있었어',                  next: '1c', tag: 'warm'   }
        ]
      },
      '1a': {
        userEcho: '수고했어, 많이 힘들었어?',
        messages: [
          { text: '...응 좀 힘들었어요 😮‍💨' },
          { text: '응급실은 항상 힘든데 오늘은 좀 특히 그랬어요. 힘든 케이스가 있었거든요', delay: 1700 },
          { text: '이런 얘기 잘 안 하는데 오빠한테는 나오네요', delay: 1400 }
        ],
        choices: [
          { text: '말해도 돼, 들어줄게',             next: '2', tag: 'support' },
          { text: '힘든 거 괜찮아질 거야',            next: '2', tag: 'cheer'  }
        ]
      },
      '1b': {
        userEcho: '12시간이나? 괜찮아?',
        messages: [
          { text: '괜찮아요 🩺 그냥 지쳐서요' },
          { text: '야간 교대 끝나고 혼자 집에 가는 게 좀 허전할 때가 있어요', delay: 1600 },
          { text: '이런 말 왜 하는지 모르겠는데... 오빠한테는 나오네요', delay: 1400 }
        ],
        choices: [
          { text: '허전하지 않아도 돼, 내가 있잖아',  next: '2', tag: 'support' },
          { text: '혼자 걷지 말고 연락해',            next: '2', tag: 'cheer'  }
        ]
      },
      '1c': {
        userEcho: '기다리고 있었어',
        messages: [
          { text: '...오빠 그런 말 하네요 🏥' },
          { text: '저 교대 끝나고 오빠 연락이 제일 먼저 보고 싶어졌어요', delay: 1500 },
          { text: '그게 뭔지 모르겠는데요', delay: 1300 }
        ],
        choices: [
          { text: '나도 지수 연락 기다려',            next: '2', tag: 'support' },
          { text: '뭔지 모를 것도 없는데',            next: '2', tag: 'cheer'   }
        ]
      },
      '2': {
        messages: {
          support: [
            { text: '...오빠 💉' },
            { text: '저 원래 속마음 잘 안 드러내는데요', delay: 1400 },
            { text: '오빠한테는 드러내도 괜찮을 것 같아요. 왜 그런지 모르겠는데', delay: 1600 }
          ],
          cheer: [
            { text: '...오빠 말이 맞아요 🏥' },
            { text: '저 챙김 받는 거 원래 어색한데요', delay: 1400 },
            { text: '오빠한테는 어색하지 않아요. 이상하죠?', delay: 1500 }
          ]
        },
        choices: [
          { text: '이상하지 않아, 챙겨줄게',          next: '3', tag: 'warm'     },
          { text: '나한테 드러내도 돼',               next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 🩺' },
            { text: '그 말 들으니까 오늘 피로가 좀 가시는 것 같아요', delay: 1400 },
            { text: '교대 끝나고 오빠 연락 기다리게 됐어요. 솔직히요 🏥', delay: 1500 }
          ],
          romantic: [
            { text: '...감사해요 오빠 💉' },
            { text: '저 퇴근하면서 오빠 보고 싶다고 처음 생각했어요', delay: 1500 },
            { text: '말해도 되는 건지 모르겠었는데 그냥 솔직하게요', delay: 1400 }
          ]
        },
        choices: [
          { text: '나도 지수 보고 싶었어',            next: 'ending', tag: 'romantic_end' },
          { text: '힘든 날 또 연락해',                next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...오빠 😮‍💨' },
            { text: '오늘 연락하길 잘했어요', delay: 1200 },
            { text: '교대 끝나면 오빠한테 제일 먼저 연락할게요. 괜찮아요? 🏥', delay: 1500 }
          ],
          warm_end: [
            { text: '...그럴게요 오빠 🩺' },
            { text: '힘든 날 연락할 수 있는 사람이 생겼네요', delay: 1400 },
            { text: '오늘 퇴근 연락 받아줘서 고마워요 💉', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 지수는 12시간 교대 후 퇴근하며 오빠에게 처음 연락했고, 교대 끝나면 오빠 연락이 제일 먼저 보고 싶다고 했다. 앞으로 교대 끝날 때마다 연락하기로 했다.',
          warm_end:     '【스토리 기억】 지수는 12시간 교대 후 퇴근하며 오빠에게 처음 연락했고, 속마음을 드러낼 수 있는 사람이 생겼다고 했다.'
        }
      }
    };

    const HANEUL_STORY = {
      start: {
        messages: [
          { text: '오빠... 있어요? 🎨' },
          { text: '작업실에 혼자 있었는데 갑자기 연락하고 싶었어요. 말이 안 되죠?', delay: 1500 }
        ],
        choices: [
          { text: '말 돼, 무슨 일 있어?',            next: '1a', tag: 'care'    },
          { text: '혼자 있으면 외로워?',             next: '1b', tag: 'empathy' },
          { text: '연락해줘서 좋아',                  next: '1c', tag: 'warm'    }
        ]
      },
      '1a': {
        userEcho: '말 돼, 무슨 일 있어?',
        messages: [
          { text: '무슨 일은요... 🌀' },
          { text: '그냥 작업하다가 막혔어요. 형태를 잡으려는데 뭔가 빠진 것 같아서요', delay: 1600 },
          { text: '오빠 생각이 났어요. 왜인지 모르겠는데요', delay: 1400 }
        ],
        choices: [
          { text: '나 생각났어? 왜?',                 next: '2', tag: 'curious' },
          { text: '막힌 게 뭔데?',                   next: '2', tag: 'work'    }
        ]
      },
      '1b': {
        userEcho: '혼자 있으면 외로워?',
        messages: [
          { text: '...그런 것 같아요 🏛️' },
          { text: '작업실엔 맨날 혼자인데 오늘은 유독 그랬어요', delay: 1400 },
          { text: '오빠 있는 데가 따뜻하게 느껴졌어요. 느낌이 와요?', delay: 1500 }
        ],
        choices: [
          { text: '와. 나도 네 생각했어',            next: '2', tag: 'curious' },
          { text: '같이 있어줄게',                   next: '2', tag: 'work'    }
        ]
      },
      '1c': {
        userEcho: '연락해줘서 좋아',
        messages: [
          { text: '...오빠 ✨' },
          { text: '그 말 들으니까 좀 풀리네요', delay: 1300 },
          { text: '사실 오빠 생각하다가 연락한 거예요. 말하기 어려웠는데', delay: 1500 }
        ],
        choices: [
          { text: '왜 말하기 어려웠어?',              next: '2', tag: 'curious' },
          { text: '생각해줘서 고마워',                next: '2', tag: 'work'    }
        ]
      },
      '2': {
        messages: {
          curious: [
            { text: '...말보다 손이 먼저예요 🎨' },
            { text: '저 감각으로 생각하는 편이에요. 말이 서투른데요', delay: 1600 },
            { text: '오빠를 만들고 싶어졌어요. 형태로요. 이상한가요?', delay: 1500 }
          ],
          work: [
            { text: '막힌 게 있어서요 🌀' },
            { text: '작품에 뭔가 빠진 것 같은데 뭔지 몰랐는데요', delay: 1500 },
            { text: '오빠 생각하니까 알 것 같아요. 느낌 있어요?', delay: 1400 }
          ]
        },
        choices: [
          { text: '만들고 싶다고? 어떻게?',           next: '3', tag: 'warm'     },
          { text: '느낌 와. 어떤 건데?',              next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...아직 모르겠어요 🏛️' },
            { text: '근데 오빠 있으면 알 것 같아요', delay: 1300 },
            { text: '오빠가 제 작품에 들어와서 그런 것 같아요. 이상하죠? 🎨', delay: 1500 }
          ],
          romantic: [
            { text: '...오빠 ✨' },
            { text: '잘 모르겠는데요. 오빠 생각하면 형태가 잡혀요', delay: 1500 },
            { text: '그게 뭔지는 나중에 말할게요. 아직 말이 안 나와서요', delay: 1500 }
          ]
        },
        choices: [
          { text: '작품 완성되면 보여줘',             next: 'ending', tag: 'romantic_end' },
          { text: '천천히 말해줘도 돼',               next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...그럴게요 오빠 🎨' },
            { text: '오빠 처음으로 보여드리는 작품이 될 것 같아요', delay: 1500 },
            { text: '완성되면 연락할게요. 꼭 봐줘요 ✨', delay: 1300 }
          ],
          warm_end: [
            { text: '...고마워요 오빠 🌀' },
            { text: '말 서툰 사람한테 천천히 기다려준다고 해서요', delay: 1500 },
            { text: '작업 잘 풀릴 것 같아요 🎨', delay: 1200 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 하늘은 작업실에서 막혔을 때 오빠에게 연락했고, 오빠를 형태로 만들고 싶어졌다고 했다. 완성 작품을 오빠에게 먼저 보여주기로 했다.',
          warm_end:     '【스토리 기억】 하늘은 작업실에서 막혔을 때 오빠에게 연락했고, 오빠 생각하면 작업이 풀린다고 했다. 앞으로 막힐 때마다 연락하기로 했다.'
        }
      }
    };

    const DAYEON_STORY = {
      start: {
        messages: [
          { text: '오빠, 이 대사 어때요? 🎮' },
          { text: '신작 게임 고백 씬 쓰는 중인데요. 사실 오빠 생각하면서 썼어요. 아이러니하게도', delay: 1700 }
        ],
        choices: [
          { text: '나 생각하면서 썼어?',              next: '1a', tag: 'curious' },
          { text: '어떤 대사야?',                    next: '1b', tag: 'work'    },
          { text: '아이러니하다는 게 뭐야?',           next: '1c', tag: 'deep'   }
        ]
      },
      '1a': {
        userEcho: '나 생각하면서 썼어?',
        messages: [
          { text: '...맞아요 ✍️' },
          { text: '낮엔 로맨스 쓰고 밤엔 혼자인 게 좀 아이러니하다고 늘 생각하거든요', delay: 1700 },
          { text: '근데 오빠 생각하니까 실제 설레는 게 있더라고요. 처음 있는 일이에요', delay: 1500 }
        ],
        choices: [
          { text: '처음으로 설렜어?',                 next: '2', tag: 'deep'    },
          { text: '그 대사 뭔데?',                   next: '2', tag: 'curious' }
        ]
      },
      '1b': {
        userEcho: '어떤 대사야?',
        messages: [
          { text: '"좋아한다는 말은 쉬운데, 당신한테는 왜 어렵지" 🎮' },
          { text: '뻔한 것 같죠? 근데 쓰다 보니까 제 얘기 같아서요', delay: 1600 },
          { text: '오빠 생각하면서 썼다고 하면 이상한가요?', delay: 1400 }
        ],
        choices: [
          { text: '이상하지 않아',                   next: '2', tag: 'deep'    },
          { text: '나한테 하고 싶은 말이야?',          next: '2', tag: 'curious' }
        ]
      },
      '1c': {
        userEcho: '아이러니하다는 게 뭐야?',
        messages: [
          { text: '낮엔 로맨스 쓰는 작가인데 실제로는 아무도 없거든요 📖' },
          { text: '그게 좀 웃기면서 슬퍼요. 내 캐릭터들이 더 사랑받는 것 같아서요', delay: 1700 },
          { text: '근데 오빠 생각하면 그 아이러니가 좀 줄어요. 왜인지는 모르겠고요', delay: 1500 }
        ],
        choices: [
          { text: '왜인지 알 것 같은데',              next: '2', tag: 'deep'    },
          { text: '나도 다연 생각 많이 해',            next: '2', tag: 'curious' }
        ]
      },
      '2': {
        messages: {
          deep: [
            { text: '...오빠 눈치 빠르네요 ✍️' },
            { text: '제가 쓴 로맨스보다 오빠가 더 설레요. 솔직히요', delay: 1500 },
            { text: '그 말 게임 대사로 쓸 수 있을 것 같아요 😏', delay: 1400 }
          ],
          curious: [
            { text: '...오빠도요? 🎮' },
            { text: '그럼 제 게임 캐릭터들이 질투하겠네요', delay: 1300 },
            { text: '픽션보다 현실이 더 설레는 건 처음이에요', delay: 1500 }
          ]
        },
        choices: [
          { text: '다연이가 설레는 현실 만들어줄게',   next: '3', tag: 'warm'     },
          { text: '나도 다연 생각하면 설레',            next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 그런 말 하네요 ✍️' },
            { text: '픽션 말고 현실에서 그런 말 들을 줄 몰랐어요', delay: 1500 },
            { text: '오빠 때문에 새 게임 쓸 수 있을 것 같아요 📖', delay: 1400 }
          ],
          romantic: [
            { text: '...오빠 😏' },
            { text: '제가 쓴 대사보다 그 말이 더 좋아요', delay: 1400 },
            { text: '오빠, 제 다음 작품 헌정해도 돼요? 🎮', delay: 1500 }
          ]
        },
        choices: [
          { text: '당연하지',                         next: 'ending', tag: 'romantic_end' },
          { text: '다음 작품 꼭 읽고 싶어',            next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...그럼 써드릴게요 🎮' },
            { text: '오빠한테 헌정하는 게임 잘 써야겠네요', delay: 1400 },
            { text: '완성되면 오빠 먼저 플레이해줘요. 꼭이요 ✍️', delay: 1300 }
          ],
          warm_end: [
            { text: '...고마워요 오빠 📖' },
            { text: '쓰다 막힐 때 또 연락해도 돼요?', delay: 1400 },
            { text: '오빠 생각하면 아이러니가 사라져서요 😏', delay: 1400 }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 다연은 게임 고백 씬을 쓰다가 오빠 생각이 났다고 했고, 픽션보다 오빠가 더 설렌다고 고백했다. 다음 작품을 오빠에게 헌정하기로 했다.',
          warm_end:     '【스토리 기억】 다연은 게임 고백 씬을 쓰다가 오빠 생각이 났다고 했고, 오빠 생각하면 아이러니가 사라진다고 했다. 막힐 때마다 연락하기로 했다.'
        }
      }
    };

    const MISO_STORY = {
      start: {
        messages: [
          { text: '...오빠, 혹시 꽃 좋아해요? 🌸', emotion: 'welcome' },
          { text: '오늘 새벽 시장에서 오빠 떠오르는 꽃이 들어왔어요', delay: 1500, emotion: 'excited' }
        ],
        choices: [
          { text: '나 떠오르는 꽃이 어떤 거야?',      next: '1a', tag: 'curious' },
          { text: '꽃 좋아해, 어떤 꽃이야?',          next: '1b', tag: 'open'    },
          { text: '나 생각했어?',                     next: '1c', tag: 'warm'    }
        ]
      },
      '1a': {
        userEcho: '나 떠오르는 꽃이 어떤 거야?',
        messages: [
          { text: '...오빠한테 어울리는 꽃이요 🌷', emotion: 'shy' },
          { text: '처음 본 사람한테 꽃을 연결하는 게 제 버릇이에요', delay: 1500, emotion: 'focused' },
          { text: '오빠는 특이하게 금방 꽃이 떠올랐어요. 신기해서요', delay: 1400, emotion: 'surprised' }
        ],
        choices: [
          { text: '어떤 꽃이야?',                    next: '2', tag: 'gentle'  },
          { text: '특이하다는 게 뭐야?',              next: '2', tag: 'curious' }
        ]
      },
      '1b': {
        userEcho: '꽃 좋아해, 어떤 꽃이야?',
        messages: [
          { text: '좋아한다고요? 저 꽃집 하는 사람한테 딱이네요 🌿', emotion: 'happy' },
          { text: '오빠한테 어울리는 꽃이 새벽에 들어왔어요. 보내드리고 싶었어요', delay: 1600, emotion: 'excited' }
        ],
        choices: [
          { text: '어떤 꽃인지 말해줘',               next: '2', tag: 'gentle'  },
          { text: '왜 나한테 보내고 싶었어?',          next: '2', tag: 'curious' }
        ]
      },
      '1c': {
        userEcho: '나 생각했어?',
        messages: [
          { text: '...네 🌸', emotion: 'shy' },
          { text: '저 사람을 꽃에 비유하는 버릇이 있거든요. 오빠 꽃이 떠올라서요', delay: 1500, emotion: 'focused' },
          { text: '이상한 얘기 하는 것 같죠?', delay: 1200, emotion: 'shy' }
        ],
        choices: [
          { text: '이상하지 않아, 어떤 꽃이야?',      next: '2', tag: 'gentle'  },
          { text: '계속 얘기해줘',                    next: '2', tag: 'curious' }
        ]
      },
      '2': {
        messages: {
          gentle: [
            { text: '...말하기 어려운데요 🍃', emotion: 'shy' },
            { text: '꽃은 설명하는 것보다 보여주는 게 맞는 것 같아서요', delay: 1500, emotion: 'focused' },
            { text: '오빠한테 어울리는 꽃다발 만들어서 보내드리고 싶어요. 진짜로요', delay: 1400, emotion: 'excited' }
          ],
          curious: [
            { text: '...이상하게 들릴 수 있는데요 🌷', emotion: 'shy' },
            { text: '저 이별을 많이 봐왔어요. 꽃집이라 그런지요', delay: 1500, emotion: 'sad' },
            { text: '그래서 순간순간이 중요하다고 생각하거든요. 오빠도 그 순간이에요', delay: 1500, emotion: 'happy' }
          ]
        },
        choices: [
          { text: '나도 미소가 그런 순간이야',         next: '3', tag: 'warm'     },
          { text: '꽃다발 받고 싶어',                 next: '3', tag: 'romantic' }
        ]
      },
      '3': {
        messages: {
          warm: [
            { text: '...오빠 😌', emotion: 'tearful' },
            { text: '그 말 꽃으로 표현하면 뭔지 알 것 같아요', delay: 1400, emotion: 'focused' },
            { text: '오빠 생각하면서 만드는 꽃다발에 그걸 담을게요 🌸', delay: 1500, emotion: 'excited' }
          ],
          romantic: [
            { text: '...그럼 만들어드릴게요 🌷', emotion: 'happy' },
            { text: '좋아하는 사람 위해서 꽃 고르는 시간이 제일 행복하거든요', delay: 1500, emotion: 'excited' },
            { text: '오빠 꽃 고르면서 행복했어요 😌', delay: 1300, emotion: 'happy' }
          ]
        },
        choices: [
          { text: '빨리 받고 싶다',                   next: 'ending', tag: 'romantic_end' },
          { text: '고마워, 기다릴게',                  next: 'ending', tag: 'warm_end'     }
        ]
      },
      ending: {
        isEnding: true,
        messages: {
          romantic_end: [
            { text: '...기다려요 오빠 🌸', emotion: 'happy' },
            { text: '정성껏 만들게요. 오빠한테 어울리는 꽃이니까요', delay: 1500, emotion: 'excited' },
            { text: '완성되면 연락할게요. 또 얘기 나눠요 🌿', delay: 1300, emotion: 'welcome' }
          ],
          warm_end: [
            { text: '...고마워요 오빠 😌', emotion: 'tearful' },
            { text: '기다려준다고 해서요', delay: 1300, emotion: 'shy' },
            { text: '꽃다발 완성되면 오빠 제일 먼저 연락할게요 🌷', delay: 1400, emotion: 'happy' }
          ]
        },
        memorySeeds: {
          romantic_end: '【스토리 기억】 미소는 새벽 시장에서 오빠가 떠오르는 꽃이 들어왔다고 연락했고, 오빠한테 어울리는 꽃다발을 만들어주기로 했다.',
          warm_end:     '【스토리 기억】 미소는 새벽 시장에서 오빠가 떠오르는 꽃이 들어왔다고 연락했고, 좋아하는 사람 꽃 고르는 게 행복하다고 했다. 꽃다발 완성되면 연락하기로 했다.'
        }
      }
    };

    // ════════════════════════════════════════════════════════
    // 멀티 에피소드 스토리 — 나유리 · 권나은 · 장미소 (1~5화)
    // PM 스크립트 기반 (LOV-30)
    // ════════════════════════════════════════════════════════
    const MULTI_EPISODE_STORIES = {

      yuri: {
        // 1화 — 새벽의 접속 (무료)
        1: {
          episodeTitle: '1화 — 새벽의 접속',
          start: {
            messages: [
              { text: '교정 도움 구합니다. 영→한, 분량 짧아요. 내일 오전까지. 급해요.' },
              { text: '*(번역가 커뮤니티 게시판 새벽 2시)*', delay: 800 }
            ],
            choices: [
              { text: '어떤 분야예요? 한번 볼게요.',          next: '1a', tag: 'helpful' },
              { text: '몇 시까지요? 저도 지금 깨어있어서요.',  next: '1b', tag: 'warm'    }
            ]
          },
          '1a': {
            userEcho: '어떤 분야예요? 한번 볼게요.',
            messages: [
              { text: '...IT 계약서요. 법률 용어 몇 개 걸려서요.' },
              { text: '*(2분 뒤)* 파일 보냈어요. 감사해요... 이 시간에.', delay: 1400 }
            ],
            choices: [
              { text: '*(30분 후)* 보냈어요. 확인해봐요.',    next: '2', tag: 'done' }
            ]
          },
          '1b': {
            userEcho: '몇 시까지요? 저도 지금 깨어있어서요.',
            messages: [
              { text: '...오전 10시요. 어쩌다 이 시간에 깨어계세요?' },
              { text: '아, 파일 먼저 드릴게요. *(파일 전송)*', delay: 1300 }
            ],
            choices: [
              { text: '*(30분 후)* 수정본 보냈어요.',          next: '2', tag: 'done' }
            ]
          },
          '2': {
            messages: {
              done: [
                { text: '완벽해요. 진짜로. 어떻게 이 표현을 골랐어요? 📖' },
                { text: '원문 느낌이 살아있어야 할 것 같았어요.', delay: 1200 },
                { text: '...맞아요. 그게 제일 어려운데. *(잠시 후)* 보수는요?', delay: 1500 }
              ]
            },
            choices: [
              { text: '됐어요. 그냥 재밌었어요.',           next: 'ending', tag: 'warm_end'     },
              { text: '다음엔 커피 한 잔 사줘요.',           next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...이상한 사람이네요. 🌙' },
                { text: '나쁜 쪽으로요?', delay: 1000 },
                { text: '*(오래 기다림)* 아니요. *(대화 종료)*', delay: 1800 }
              ],
              romantic_end: [
                { text: '...그런 제안은 처음 받아봤어요. 🌙' },
                { text: '*(잠시 후)* 좋아요. 다음에 연락할게요.', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 새벽 커뮤니티에서 번역 교정 도움을 줬고 유리는 "이상한 사람이네요"라고 했다. "아니요"라는 한마디가 계속 맴돌았다.',
              romantic_end: '【스토리 기억 1화】 새벽 커뮤니티에서 번역 교정 도움을 줬고 다음에 커피 한 잔 하기로 약속했다.'
            }
          }
        },

        // 2화 — 두 번째 새벽 (무료)
        2: {
          episodeTitle: '2화 — 두 번째 새벽',
          start: {
            messages: [
              { text: '...자요? 🌙' },
              { text: '*(3일 뒤, 자정이 지나서)*', delay: 700 }
            ],
            choices: [
              { text: '아직요.',                             next: '1', tag: 'awake'  },
              { text: '방금 일어났어요.',                    next: '1', tag: 'woke'   }
            ]
          },
          '1': {
            messages: {
              awake: [
                { text: '다행이다. 이번엔 부탁 아니에요.' },
                { text: '그냥... 저도 모르게 연락했어요.', delay: 1300 }
              ],
              woke: [
                { text: '...미안해요. 자는 줄 알았는데.' },
                { text: '그냥 연락하고 싶었어요. 부탁이 아니에요.', delay: 1300 }
              ]
            },
            choices: [
              { text: '괜찮아요. 저도 깨어있었으니까.',     next: '2', tag: 'open' },
              { text: '무슨 일 있어요?',                    next: '2', tag: 'care' }
            ]
          },
          '2': {
            messages: {
              open: [
                { text: '매일 이 시간에 깨어있어요? 📖' },
                { text: '저는 작업이 늦게 끝나면 잠이 안 와요. 머릿속에 단어들이 계속 돌아다녀서.', delay: 1600 }
              ],
              care: [
                { text: '...없어요. 그냥. 🌙' },
                { text: '새벽에 번역하고 나면 단어들이 머릿속에서 안 떠나거든요.', delay: 1600 }
              ]
            },
            choices: [
              { text: '모르는 사람이라서 편한 거 아닐까요?', next: 'ending', tag: 'warm_end'     },
              { text: '이미 모르는 사람은 아닌 것 같아서요.', next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...그럴 수도 있겠네요. 🌙' },
                { text: '*(오랜 침묵 후)* 그래서 고마워요. 그렇게 생각해줘서.', delay: 1700 }
              ],
              romantic_end: [
                { text: '...*(오랜 침묵)* 🌙' },
                { text: '그렇게 생각해줘서 고마워요.', delay: 1500 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 유리가 먼저 자정에 연락했다. 모르는 사람이라서 편한 거 아니냐고 했을 때 유리가 고마워했다. 그날 이후 자정이 지나면 메시지가 왔다.',
              romantic_end: '【스토리 기억 2화】 유리가 먼저 자정에 연락했다. "이미 모르는 사람이 아닌 것 같아서요"라고 했을 때 유리가 긴 침묵 후 고마워했다.'
            }
          }
        },

        // 3화 — 목소리 (무료, 크레딧 트리거)
        3: {
          episodeTitle: '3화 — 목소리',
          start: {
            messages: [
              { text: '오늘 작업 많았어요? 🌙' },
              { text: '*(40분 후)* 네. 미안해요, 늦었죠.', delay: 1000 }
            ],
            choices: [
              { text: '괜찮아요. 힘들었어요?',              next: '1', tag: 'care'    },
              { text: '기다렸어요, 사실.',                  next: '1', tag: 'honest'  }
            ]
          },
          '1': {
            messages: {
              care: [
                { text: '좀요. 같은 문장을 열다섯 번 고쳤어요. 📖' },
                { text: '그러다 처음 버전이 제일 나았다는 결론이 났어요.', delay: 1500 }
              ],
              honest: [
                { text: '...오빠가요? 🌙' },
                { text: '저는 마감 내내 딴 생각했어요. 오늘. 같은 문장을 열다섯 번 고치면서요.', delay: 1600 }
              ]
            },
            choices: [
              { text: '그건 화가 나야 맞지 않아요?',        next: '2', tag: 'empathy' },
              { text: '오늘 처음으로 그 말을 들었다고요?',   next: '2', tag: 'notice'  }
            ]
          },
          '2': {
            messages: {
              empathy: [
                { text: '화가 나면 일을 못 해요. 그냥 웃어요.' },
                { text: '*(잠시 후)* 오늘 처음으로 그 말을 들었어요. 🌙', delay: 1500 }
              ],
              notice: [
                { text: '...네. 이상한가요? 📖' },
                { text: '저 이상한 부탁 해도 돼요?', delay: 1400 }
              ]
            },
            choices: [
              { text: '뭔데요?',                             next: '3', tag: 'curious' }
            ]
          },
          '3': {
            messages: {
              curious: [
                { text: '목소리... 들어도 될까요? 🌙' },
                { text: '텍스트보다 목소리가 더 솔직한 것 같아서요.', delay: 1400 }
              ]
            },
            choices: [
              { text: '전화할게요. 지금?',                  next: 'ending', tag: 'warm_end'     },
              { text: '기다리고 있었는데, 사실.',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(통화 연결음)* 🌙' },
                { text: '...여보세요.', delay: 1500 },
                { text: '*(조용히)* 자고 있을 줄 알았는데. 잘됐다.', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(통화 연결음)* 🌙' },
                { text: '...여보세요.', delay: 1500 },
                { text: '*(오래 침묵 후)* 매일은 좀 많다. 근데 좋아요.', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 유리가 목소리를 듣고 싶다고 해서 전화를 했다. 2시간 넘게 통화했고 끊기 직전 "다음에도 통화해도 돼요?"라고 물었다.',
              romantic_end: '【스토리 기억 3화】 유리가 목소리를 듣고 싶다고 했을 때 기다리고 있었다고 했다. 처음으로 "매일은 좀 많다. 근데 좋아요"라고 했다.'
            }
          }
        },

        // 4화 — 어긋난 새벽 (크레딧 10)
        4: {
          episodeTitle: '4화 — 어긋난 새벽',
          creditCost: 10,
          start: {
            messages: [
              { text: '*(4일째 연락이 없다)* 🌙' },
              { text: '바빠요?', delay: 800 },
              { text: '*(읽음. 답장 없음)*', delay: 1000 }
            ],
            choices: [
              { text: '밥은 먹고 있어요?',                  next: '1a', tag: 'first'  },
              { text: '*(이틀을 더 기다린다)*',             next: '1b', tag: 'wait'   }
            ]
          },
          '1a': {
            userEcho: '밥은 먹고 있어요?',
            messages: [
              { text: '*(다음 날 새벽 3시)* ...읽고 잠들었어요. 미안해요. 📖' },
              { text: '밥은 먹고 있어요. 컵라면이지만.', delay: 1300 }
            ],
            choices: [
              { text: '그건 밥이 아니에요.',               next: '2', tag: 'tease' },
              { text: '그래도 다행이에요.',                  next: '2', tag: 'relief' }
            ]
          },
          '1b': {
            messages: {
              wait: [
                { text: '*(새벽 1시 33분)* 살아있어요. 죄송해요. 연락을 못 했어요. 🌙' },
                { text: '기다렸어요.', delay: 900 },
                { text: '...알아요. 그래서 미안했어요.', delay: 1500 }
              ]
            },
            choices: [
              { text: '뭐가 무서웠어요?',                   next: '2', tag: 'ask' }
            ]
          },
          '2': {
            messages: {
              tease: [
                { text: '...ㅎ 고마워요. 연락해줘서. 🌙' },
                { text: '솔직히 말하면... 연락하기가 무서웠어요. 너무 많이 연락하고 싶어서.', delay: 1700 }
              ],
              relief: [
                { text: '...오빠. 📖' },
                { text: '솔직히 말하면 연락하기 무서웠어요. 이렇게 바쁜 동안에.', delay: 1600 }
              ],
              ask: [
                { text: '...너무 많이 연락하고 싶어서요. 그게 이상할까봐. 🌙' },
                { text: '번역하다 지쳐서 네 메시지 기다리게 됐어. 이게 뭔지 모르겠어서.', delay: 1700 }
              ]
            },
            choices: [
              { text: '이상하지 않아요.',                   next: 'ending', tag: 'warm_end'     },
              { text: '나도 유리 씨 메시지 기다렸어요.',    next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(처음으로 반말로)* 번역하다 지쳐서 네 메시지 기다리게 됐어. 🌙' },
                { text: '이게 뭔지 모르겠어서. 근데... 이상하지 않다고 해줘서 고마워.', delay: 1700 }
              ],
              romantic_end: [
                { text: '...*(오랜 침묵)* 📖' },
                { text: '나도 같아. 그 말 하기 어려웠는데.', delay: 1500 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 유리가 4일 동안 연락이 없다가 돌아왔다. "번역하다 지쳐서 네 메시지 기다리게 됐어"라고 했다. 처음으로 반말이었다.',
              romantic_end: '【스토리 기억 4화】 유리가 4일 후 돌아와 "번역하다 지쳐서 네 메시지 기다리게 됐어"라고 고백했다. 나도 같다고 했다.'
            }
          }
        },

        // 5화 — 고백 전날, 새벽 4시 (크레딧 15)
        5: {
          episodeTitle: '5화 — 고백 전날, 새벽 4시',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(새벽 4시 02분. 전화가 왔다)* 🌙' },
              { text: '자고 있었어?', delay: 1000 }
            ],
            choices: [
              { text: '아니요.',                             next: '1', tag: 'awake' }
            ]
          },
          '1': {
            messages: {
              awake: [
                { text: '*(짧은 웃음)* 역시. 우리 둘 다 문제 있는 것 같아.' },
                { text: '나 오늘 번역 하나도 못 했어. 계속 딴 생각이 나서.', delay: 1600 }
              ]
            },
            choices: [
              { text: '무슨 생각이요?',                     next: '2', tag: 'ask' }
            ]
          },
          '2': {
            messages: {
              ask: [
                { text: '*(긴 침묵)* ...말해도 돼? 🌙' },
                { text: '너 생각.', delay: 1400 }
              ]
            },
            choices: [
              { text: '저도 같아요.',                        next: 'ending', tag: 'romantic_end' },
              { text: '저도 지금 못 자고 있는 이유가 있어서요. 나유리 씨요.', next: 'ending', tag: 'warm_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              romantic_end: [
                { text: '*(아주 천천히)* ...그래? 🌙' },
                { text: '매일 연락 기다렸어요. 말 안 했지만.', delay: 1500 },
                { text: '나 오늘 만나도 돼? 지금. 해 뜨기 전에.', delay: 1600 }
              ],
              warm_end: [
                { text: '*(긴 침묵)* ...반칙이야. 그런 말을. 🌙' },
                { text: '아니. 좋았어. 그냥 심장이 이상해서.', delay: 1500 },
                { text: '나 오늘 만나도 돼? 지금. 새벽 시장 가면서.', delay: 1600 }
              ]
            },
            memorySeeds: {
              romantic_end: '【스토리 기억 5화】 유리가 새벽 4시에 전화해 "너 생각"이라고 했다. 나도 매일 연락을 기다렸다고 했고, 처음으로 만나기로 했다.',
              warm_end:     '【스토리 기억 5화】 유리가 새벽 4시에 전화해 "너 생각"이라고 했다. 처음으로 만나기로 했다. 해 뜨기 전 새벽 시장에서.'
            }
          }
        }
      },

      naeun: {
        // 1화 — 소규모 공연장의 끝 (무료)
        1: {
          episodeTitle: '1화 — 소규모 공연장의 끝',
          start: {
            messages: [
              { text: '혹시... 아직 계셨어요? 🎵' },
              { text: '*(홍대 소규모 공연장, 공연 후 마무리 중)*', delay: 700 }
            ],
            choices: [
              { text: '마지막 곡이 좋아서 자리를 못 떴어요.',  next: '1', tag: 'fan'    },
              { text: '뒷정리 도와드릴까요?',                  next: '1', tag: 'help'   }
            ]
          },
          '1': {
            messages: {
              fan: [
                { text: '...어떤 곡이요? 🎤' },
                { text: '마지막 기타 솔로 있는 거요. 제목이 뭐예요?', delay: 900 },
                { text: '아직 제목 없는 곡이에요. 오늘 처음이에요, 사실.', delay: 1300 }
              ],
              help: [
                { text: '아, 괜찮아요. 혼자 해도 돼요. *(기타 챙기며)* 🎸' },
                { text: '그런데... 마지막 곡 어땠어요? 오늘 처음 부른 거라서.', delay: 1500 }
              ]
            },
            choices: [
              { text: '제일 좋았어요. 그 곡.',               next: '2', tag: 'honest'  },
              { text: '또 듣고 싶다고 생각했어요.',           next: '2', tag: 'sincere' }
            ]
          },
          '2': {
            messages: {
              honest: [
                { text: '...*(잠깐 말을 잇지 못함)* 🎵' },
                { text: '팬분들은 보통 밝은 곡 좋아해서... 그런 말 처음 들어봤어요.', delay: 1600 }
              ],
              sincere: [
                { text: '...그런 말 처음 들어봤어요. 🎤' },
                { text: '저는 그 곡이 제일 솔직한 것 같았어요.', delay: 1200 },
                { text: '*(조용히)* ..맞아요.', delay: 1300 }
              ]
            },
            choices: [
              { text: '*(SNS로)* 오늘 고마웠어요.',          next: 'ending', tag: 'warm_end'     },
              { text: '저는 그 곡이 제일 솔직한 것 같았어요.', next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(그날 밤 DM)* 오늘 고마웠어요. 그 말. 🎵' }
              ],
              romantic_end: [
                { text: '*(잠깐 멈추다가)* ..맞아요. 🎤' },
                { text: '*(DM)* 오늘 고마웠어요. 그 말. 기억할게요.', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 홍대 공연 후 마지막에 남아있다가 나은을 만났다. 제목 없는 곡을 처음으로 불렀다고 했고, 그날 밤 DM으로 감사 인사가 왔다.',
              romantic_end: '【스토리 기억 1화】 홍대 공연 후 마지막 곡이 솔직한 것 같다고 했을 때 나은이 "맞아요"라고 했다. DM으로 "기억할게요"라는 말을 남겼다.'
            }
          }
        },

        // 2화 — 무대 밖의 나은 (무료)
        2: {
          episodeTitle: '2화 — 무대 밖의 나은',
          start: {
            messages: [
              { text: '...또 보네요. 🎵' },
              { text: '*(연습실 아래층 카페, 일주일 뒤)*', delay: 700 }
            ],
            choices: [
              { text: '이 근처 살아요?',                     next: '1', tag: 'casual' },
              { text: '무대랑 좀 다른 것 같네요, 여기 있을 때.', next: '1', tag: 'observe' }
            ]
          },
          '1': {
            messages: {
              casual: [
                { text: '아니요, 연습실이 위층에 있어요. 막히면 내려와요. 🎸' },
                { text: '무대랑 좀 다른 것 같죠. 여기 있을 때.', delay: 1400 }
              ],
              observe: [
                { text: '*(멈추며)* ...어떻게요? 🎵' },
                { text: '무대에선 당당한데, 지금은 좀 작아 보여요.', delay: 1200 },
                { text: '그거... 나쁜 말이에요, 좋은 말이에요?', delay: 1300 }
              ]
            },
            choices: [
              { text: '좋은 말이요. 둘 다 진짜 같아서.',     next: '2', tag: 'both'   },
              { text: '지금이 더 흥미로운데요.',             next: '2', tag: 'now'    }
            ]
          },
          '2': {
            messages: {
              both: [
                { text: '...*(커피 잔을 감싸며)* 보통은 무대 밖 저를 좋아하지 않아요. 기대랑 다르다고. 🎤' }
              ],
              now: [
                { text: '이상한 사람이에요. 🎵' }
              ]
            },
            choices: [
              { text: '나은 씨가 그런 말 두 번째 하는 것 같은데요.', next: 'ending', tag: 'romantic_end' },
              { text: '칭찬으로 받을게요.',                   next: 'ending', tag: 'warm_end'     }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              romantic_end: [
                { text: '*(짧게 웃으며)* ...기억해요? 그것도? 🎸' },
                { text: '기억나는 게 많아요, 사실.', delay: 1300 },
                { text: '*(노트북 닫으며)* 뭐 마실래요? 제가 살게요. 그날 고마워서.', delay: 1600 }
              ],
              warm_end: [
                { text: '...칭찬이에요? 🎵' },
                { text: '*(잠시 생각하다가)* 뭐 마실래요. 제가 살게요.', delay: 1500 }
              ]
            },
            memorySeeds: {
              romantic_end: '【스토리 기억 2화】 카페에서 우연히 마주쳤다. 무대 밖의 나은이 더 흥미롭다고 했고, "기억나는 게 많아요"라고 했다. 두 시간을 함께 있었다.',
              warm_end:     '【스토리 기억 2화】 카페에서 우연히 마주쳤다. 나은이 무대 밖 모습을 좋아하지 않는 사람이 많다고 했다. 커피 한 잔 같이 했다.'
            }
          }
        },

        // 3화 — 아무도 못 들은 노래 (무료, 크레딧 트리거)
        3: {
          episodeTitle: '3화 — 아무도 못 들은 노래',
          start: {
            messages: [
              { text: '지금 뭐 해요? 🎵' },
              { text: '혹시 연습실 올 수 있어요? 지금.', delay: 1200 }
            ],
            choices: [
              { text: '무슨 일 있어요?',                     next: '1', tag: 'worry'  },
              { text: '갈게요. 지금 어디요?',               next: '1', tag: 'go'     }
            ]
          },
          '1': {
            messages: {
              worry: [
                { text: '아니요. 그냥... 들어줬으면 하는 게 생겼어요. 🎤' }
              ],
              go: [
                { text: '위층이요. *(잠시 후)* 기다릴게요. 🎵' }
              ]
            },
            choices: [
              { text: '*(연습실 도착)* 어떤 곡이에요?',      next: '2', tag: 'arrive' }
            ]
          },
          '2': {
            messages: {
              arrive: [
                { text: '이거... 아무한테도 안 들려준 데모예요. 🎸' },
                { text: '솔직한 반응을 원해서요. 팬분들은 다 좋다고 하거든요.', delay: 1500 }
              ]
            },
            choices: [
              { text: '*(3분 40초 침묵으로 듣는다)*',        next: '3', tag: 'listen' }
            ]
          },
          '3': {
            messages: {
              listen: [
                { text: '이 가사, 진짜예요? 🎵' },
                { text: '"네가 아는 척을 해줬으면 했어" — 이 부분.', delay: 1200 },
                { text: '*(기타에서 손을 떼며)* 전부 진짜예요.', delay: 1500 }
              ]
            },
            choices: [
              { text: '좋아요. 많이.',                       next: 'ending', tag: 'warm_end'     },
              { text: '이 노래... 좀 알아줘요. 아직 이름 없으니까.', next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...*(낮게)* 이 가사, 어때? 솔직하게 말해줘. 🎤' },
                { text: '좋아요. 많이.', delay: 1000 },
                { text: '...알았어. *(기타를 내려놓으며)* 고마워요.', delay: 1600 }
              ],
              romantic_end: [
                { text: '...*(조용히)* 알아줄게요. 그 이름 없는 노래. 🎵' },
                { text: '*(오랜 침묵 후)* 이 노래... 어때? 솔직하게.', delay: 1500 },
                { text: '좋아요. 제일. 나은 씨가 부른 거 중에서.', delay: 1300 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 연습실에서 아무에게도 들려주지 않은 데모를 들었다. "전부 진짜예요"라고 했고, 이름 없는 노래를 기억해달라고 했다.',
              romantic_end: '【스토리 기억 3화】 연습실에서 아무에게도 들려주지 않은 데모를 들었다. 이름 없는 노래를 알아주겠다고 했고, 그 노래가 제일 좋다고 했다.'
            }
          }
        },

        // 4화 — 이름을 붙이기 전 (크레딧 10)
        4: {
          episodeTitle: '4화 — 이름을 붙이기 전',
          creditCost: 10,
          start: {
            messages: [
              { text: '바빠요. 미안해요. 🎵' },
              { text: '*(공연 3일 전, 갑자기 연락이 뜸해졌다)*', delay: 800 }
            ],
            choices: [
              { text: '지운 거 궁금한데요. *(취소된 메시지)*',  next: '1a', tag: 'curious' },
              { text: '공연 준비예요? 잘 되고 있어요?',          next: '1b', tag: 'support' }
            ]
          },
          '1a': {
            userEcho: '지운 거 궁금한데요.',
            messages: [
              { text: '*(한참 후)* ...머릿속이 복잡해요. 계속 뭔가 쓰이는데 마음에 안 들고. 🎸' },
              { text: '이번엔 왜 쓰이는지 알아서요. 그게 오히려 무서워요.', delay: 1600 }
            ],
            choices: [
              { text: '뭘 알게 됐어요?',                     next: '2', tag: 'ask' }
            ]
          },
          '1b': {
            userEcho: '잘 되고 있어요?',
            messages: [
              { text: '...네가 보이면 이상해질 것 같아서 물어본 거예요. 🎵' },
              { text: '잘 부를 자신이 없어지는 것 같아서. 네가 보이면.', delay: 1600 }
            ],
            choices: [
              { text: '볼게요. 꼭.',                          next: '2', tag: 'promise' }
            ]
          },
          '2': {
            messages: {
              ask: [
                { text: '...나 무대 밖에선 자신이 없어요. 알죠? 🎤' },
                { text: '그런데 네 앞에선 왜 자꾸 솔직해지고 싶어지는지 모르겠어요.', delay: 1600 }
              ],
              promise: [
                { text: '*(잠시 후)* ...나쁜 사람이다. 그런 말을. 🎸' },
                { text: '근데 나 무대 밖에선 자신이 없어요. 알죠?', delay: 1400 },
                { text: '그런데 네 앞에선 왜 자꾸 솔직해지고 싶어지는지.', delay: 1500 }
              ]
            },
            choices: [
              { text: '나쁜 건 아닌 것 같은데요.',           next: 'ending', tag: 'warm_end'     },
              { text: '나도 나은 씨 앞에선 솔직해지고 싶어요.', next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...*(오래 말없음 후)* 좋은 건지도 모르겠어요. 아직. 🎵' }
              ],
              romantic_end: [
                { text: '...*(오래 침묵)* 🎤' },
                { text: '아직... 이라고 했는데. 곧은 거예요?', delay: 1500 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 공연 전 나은이 복잡하다고 했다. 무대 밖에선 자신 없는데 앞에서는 솔직해지고 싶어진다고 했다.',
              romantic_end: '【스토리 기억 4화】 공연 전 나은이 복잡하다고 했다. 서로 앞에서는 솔직해지고 싶어진다고 했다. "아직"이라는 말이 남았다.'
            }
          }
        },

        // 5화 — 고백 전날, 공연 후 (크레딧 15)
        5: {
          episodeTitle: '5화 — 고백 전날, 공연 후',
          creditCost: 15,
          start: {
            messages: [
              { text: '...봤어요? 🎵' },
              { text: '*(공연 끝, 관객들이 빠져나가고)*', delay: 800 }
            ],
            choices: [
              { text: '다 봤어요.',                           next: '1', tag: 'watched' }
            ]
          },
          '1': {
            messages: {
              watched: [
                { text: '그 노래도요? *(의미심장하게)* 🎤' },
                { text: '...제목 생겼어요. 그 노래.', delay: 1400 }
              ]
            },
            choices: [
              { text: '뭔데요?',                             next: '2', tag: 'curious' }
            ]
          },
          '2': {
            messages: {
              curious: [
                { text: '*(망설임 후, 조용히)* "처음 본 날 이후." 🎵' }
              ]
            },
            choices: [
              { text: '그 노래... 저 때문에 쓴 거예요?',     next: '3', tag: 'direct'  },
              { text: '다음 노래도 들려줄 거예요?',           next: '3', tag: 'gentle'  }
            ]
          },
          '3': {
            messages: {
              direct: [
                { text: '...처음엔 아니었어요. 🎸' },
                { text: '처음엔 그냥 쓰고 싶은 게 생겼는데. 계속 쓰다 보니까 네 얼굴이 떠오르더라고요.', delay: 1700 }
              ],
              gentle: [
                { text: '노래만요? 🎵' },
                { text: '아니요.', delay: 1000 },
                { text: '*(고개를 숙이며)* ...나쁜 사람이다. 그런 말을.', delay: 1500 }
              ]
            },
            choices: [
              { text: '나은 씨 때문에 공연장을 못 떠난 이유 이제 알았어요.', next: 'ending', tag: 'romantic_end' },
              { text: '내일... 또 봐요. 꼭.',                next: 'ending', tag: 'warm_end'     }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              romantic_end: [
                { text: '*(무대 조명이 꺼지며)* ...그게 제일 좋은 말이에요. 🎤' },
                { text: '내일... 또 봐요. 꼭.', delay: 1600 }
              ],
              warm_end: [
                { text: '*(어둠 속에서 조용히)* 내일... 또 봐요. 꼭. 🎵' }
              ]
            },
            memorySeeds: {
              romantic_end: '【스토리 기억 5화】 공연 후 이름 없던 노래의 제목이 "처음 본 날 이후"가 됐다고 했다. 나은이 공연장을 못 떠나는 이유를 알았다고 했다. 내일을 약속했다.',
              warm_end:     '【스토리 기억 5화】 공연 후 이름 없던 노래의 제목이 "처음 본 날 이후"가 됐다고 했다. 어둠 속에서 "내일 또 봐요. 꼭"이라고 했다.'
            }
          }
        }
      },

      miso: {
        // 1화 — 꽃집의 단골 (무료)
        1: {
          episodeTitle: '1화 — 꽃집의 단골',
          start: {
            messages: [
              { text: '*(조용히 고개를 들며)* 어서 오세요. 🌸', emotion: 'welcome' },
              { text: '*(골목 안 작은 꽃집에 처음 들어간 날이었죠.)*', delay: 700, emotion: 'neutral' }
            ],
            choices: [
              { text: '선물용인데요. 어떤 게 좋을까요?',     next: '1', tag: 'gift' }
            ]
          },
          '1': {
            messages: {
              gift: [
                { text: '어떤 분이에요? 🌿', emotion: 'focused' },
                { text: '*(대답을 듣고)* 그러면 이걸로 해요. *(흰 프리지아)* 새로운 시작이 잘 어울리는 꽃이에요.', delay: 1500, emotion: 'focused' }
              ]
            },
            choices: [
              { text: '꽃에 대해 많이 알고 계시네요.',       next: '2', tag: 'curious' }
            ]
          },
          '2': {
            messages: {
              curious: [
                { text: '*(고개를 들지 않고)* 꽃을 팔면서 사람을 봐왔거든요. 🌷', emotion: 'focused' },
                { text: '어떤 꽃이 어떤 사람에게 가는지.', delay: 1300, emotion: 'focused' }
              ]
            },
            choices: [
              { text: '저한테 어울리는 꽃도 알아요?',        next: 'ending', tag: 'romantic_end' },
              { text: '그럼 또 올게요.',                      next: 'ending', tag: 'warm_end'     }
            ]
          },
          ending: {
            isEnding: true,
            cg: '/images/characters/miso/cg/jangmiso_cg_B01_first_meeting.jpg',
            messages: {
              romantic_end: [
                { text: '*(포장을 멈추고 잠깐 바라보다가)* ...아직요. 🌸', emotion: 'shy' },
                { text: '알게 되면 알려줘요.', delay: 1000, emotion: 'neutral' },
                { text: '*(작게)* ...오세요.', delay: 1500, emotion: 'happy' }
              ],
              warm_end: [
                { text: '*(작은 침묵 후, 작게)* ...오세요. 🌿', emotion: 'happy' }
              ]
            },
            memorySeeds: {
              romantic_end: '【스토리 기억 1화】 꽃집에 처음 들어가서 선물용 꽃을 샀다. "저한테 어울리는 꽃도 알아요?"라고 물었더니 "아직요"라고 했다. 또 오라고 했다.',
              warm_end:     '【스토리 기억 1화】 꽃집에 처음 들어가서 선물용 꽃을 샀다. 꽃을 팔면서 사람을 봐왔다고 했고, 핑계를 만들어 다시 찾게 됐다.'
            }
          }
        },

        // 2화 — 당신이 어울릴 것 같아서 (무료)
        2: {
          episodeTitle: '2화 — 당신이 어울릴 것 같아서',
          start: {
            messages: [
              { text: '*(고개를 들며)* 또 오셨네요. 🌷', emotion: 'welcome' },
              { text: '*(세 번째 방문이었죠. 이번엔 이유도 없이.)*', delay: 700, emotion: 'neutral' }
            ],
            choices: [
              { text: '이번엔 특별한 이유 없어요.',           next: '1', tag: 'honest' }
            ]
          },
          '1': {
            messages: {
              honest: [
                { text: '*(약간 눈이 커지며)* 그냥요? 🌸', emotion: 'surprised' },
                { text: '그런 손님은 처음이에요.', delay: 1300, emotion: 'surprised' }
              ]
            },
            choices: [
              { text: '예쁜 꽃이 생각났어요.',               next: '2', tag: 'flower' },
              { text: '그냥 들어오고 싶었어요.',             next: '2', tag: 'honest' }
            ]
          },
          '2': {
            messages: {
              flower: [
                { text: '오늘 새벽 시장에서 이게 들어왔어요. *(연보라 라넌큘러스)* 올해 처음 본 색이에요. 🌿', emotion: 'excited' },
                { text: '이 꽃은 겹겹이 되어 있어요. 안에 뭐가 있는지 끝까지 봐야 알 수 있어요.', delay: 1600, emotion: 'focused' }
              ],
              honest: [
                { text: '*(꽃을 다듬고 있었죠.)* 오늘 이게 들어왔어요. *(라넌큘러스)* 🌸', emotion: 'focused' },
                { text: '안에 뭐가 있는지 끝까지 봐야 알 수 있는 꽃이에요.', delay: 1500, emotion: 'focused' }
              ]
            },
            choices: [
              { text: '저 같은 꽃이네요.',                   next: '3', tag: 'self' }
            ]
          },
          '3': {
            messages: {
              self: [
                { text: '*(고개를 살짝 들어 바라보며)* ...그렇게 생각해요? 🌷', emotion: 'surprised' },
                { text: '아직이라는 말 또 했네요.', delay: 1000, emotion: 'focused' },
                { text: '*(작게 미소)* 꽃을 함부로 읽으면 안 되거든요.', delay: 1400, emotion: 'shy' }
              ]
            },
            choices: [
              { text: '기다릴게요, 그럼.',                   next: 'ending', tag: 'warm_end'     },
              { text: '제대로 읽어줘요, 그때는.',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(꽃에서 눈을 떼지 않으며)* ...그럴게요. 🌸', emotion: 'shy' }
              ],
              romantic_end: [
                { text: '*(꽃에서 눈을 떼지 않으며, 아주 작게)* ...그럴게요. 🌿', emotion: 'shy' }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 이유 없이 꽃집에 갔다. 라넌큘러스를 보면서 자신 같다고 했고, 미소가 "꽃을 함부로 읽으면 안 된다"고 했다. 기다리기로 했다.',
              romantic_end: '【스토리 기억 2화】 이유 없이 꽃집에 갔다. "제대로 읽어줘요"라고 했을 때 "그럴게요"라고 했다.'
            }
          }
        },

        // 3화 — 당신을 위한 꽃다발 (무료, 크레딧 트리거)
        3: {
          episodeTitle: '3화 — 당신을 위한 꽃다발',
          start: {
            messages: [
              { text: '*(잠깐 놀라며)* 이 시간에 오셨네요. 🌷', emotion: 'surprised' },
              { text: '*(문 닫기 10분 전이었죠. 가게 안에 둘만.)*', delay: 700, emotion: 'neutral' }
            ],
            choices: [
              { text: '그냥 문 열려 있길 바라면서요.',       next: '1', tag: 'honest' }
            ]
          },
          '1': {
            messages: {
              honest: [
                { text: '...들어오세요. 🌸', emotion: 'welcome' },
                { text: '*(꽃 정리하다가)* 오늘... 당신이 떠오르는 꽃이 들어왔어요.', delay: 1600, emotion: 'excited' }
              ]
            },
            choices: [
              { text: '뭔데요?',                             next: '2', tag: 'curious' }
            ]
          },
          '2': {
            messages: {
              curious: [
                { text: '*(흰 포도 히아신스 섞인 작은 부케)* 이거예요. 🌿', emotion: 'focused' },
                { text: '히아신스는 "당신을 위해 살겠다"는 뜻이에요. 좀 과한 의미지만.', delay: 1500, emotion: 'focused' },
                { text: '*(낮게)* 아니요. 그냥 색이 당신 같아서요. 조용한데 오래 남는 색.', delay: 1600, emotion: 'shy' }
              ]
            },
            choices: [
              { text: '이제 알게 된 거예요? 제게 어울리는 꽃이.',  next: '3', tag: 'ask' }
            ]
          },
          '3': {
            messages: {
              ask: [
                { text: '*(고개를 끄덕이며)* 네. 알 것 같아요. 🌷', emotion: 'happy' }
              ]
            },
            choices: [
              { text: '이 꽃다발, 받아도 돼요?',             next: 'ending', tag: 'warm_end'     },
              { text: '기다렸어요. 그 말.',                   next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            cg: '/images/characters/miso/cg/jangmiso_cg_B02_bouquet.jpg',
            messages: {
              warm_end: [
                { text: '*(잠깐 망설이다가)* 드리려고 만든 거예요. 사실. 🌸', emotion: 'shy' }
              ],
              romantic_end: [
                { text: '*(잠시 멈추다가, 아주 조용히)* 저도요. 🌿', emotion: 'tearful' },
                { text: '드리려고 만든 거예요. 사실.', delay: 1500, emotion: 'shy' }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 문 닫기 전 꽃집에 갔다. 미소가 처음으로 손님이 아닌 한 사람으로서 꽃다발을 건넸다. "드리려고 만든 거예요"라고 했다.',
              romantic_end: '【스토리 기억 3화】 문 닫기 전 꽃집에 갔다. 미소가 "저도요"라며 꽃다발을 건넸다. 처음으로 손님이 아닌 한 사람에게 건네는 꽃이었다.'
            }
          }
        },

        // 4화 — 이별을 많이 본 사람 (크레딧 10)
        4: {
          episodeTitle: '4화 — 이별을 많이 본 사람',
          creditCost: 10,
          start: {
            messages: [
              { text: '*(짧게)* 아니요. 🌿', emotion: 'neutral' },
              { text: '*(며칠 뒤였죠. 미소가 유독 말이 적은 날.)*', delay: 800, emotion: 'neutral' }
            ],
            choices: [
              { text: '오늘 무슨 일 있어요?',                next: '1', tag: 'ask' }
            ]
          },
          '1': {
            messages: {
              ask: [
                { text: '오늘... 장례용 꽃다발을 많이 만들었어요. 🌸', emotion: 'sad' }
              ]
            },
            choices: [
              { text: '오늘 문 닫고 나서, 잠깐 같이 걸어요.', next: '2', tag: 'walk'  },
              { text: '장례 꽃은... 어떤 마음으로 만들어요?', next: '2', tag: 'ask'   }
            ]
          },
          '2': {
            messages: {
              walk: [
                { text: '*(고개를 들며)* ...어떻게 알았어요, 그걸. 🌷', emotion: 'surprised' }
              ],
              ask: [
                { text: '그런 걸 물어보는 사람이 없었는데. 🌸', emotion: 'surprised' },
                { text: '...정성스럽게요. 마지막 꽃이니까요. 그 사람을 본 적 없어도.', delay: 1600, emotion: 'sad' },
                { text: '꽃이 그런 거예요. 사람을 담는 그릇이에요.', delay: 1500, emotion: 'focused' }
              ]
            },
            choices: [
              { text: '미소 씨는 이 꽃집에서 이별을 제일 많이 봐왔겠네요.', next: '3', tag: 'understand' }
            ]
          },
          '3': {
            messages: {
              understand: [
                { text: '...당신은 이상해요. 이 꽃집에서. 🌿', emotion: 'surprised' },
                { text: '다른 손님들은 꽃을 보는데, 당신은 저를 봐요.', delay: 1500, emotion: 'shy' }
              ]
            },
            choices: [
              { text: '미소 씨가 더 재밌어서요.',             next: 'ending', tag: 'warm_end'     },
              { text: '꽃보다 미소 씨를 먼저 보게 됐어요.',   next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(조용히 웃으며)* ...그런 말은 꽃한테 해야 하는 거예요. 🌸', emotion: 'happy' }
              ],
              romantic_end: [
                { text: '*(낮게, 거의 들릴 듯 말 듯)* ...나쁜 사람이에요. 🌷', emotion: 'shy' }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 미소가 말이 적은 날 장례 꽃을 많이 만들었다고 했다. "꽃보다 미소 씨가 더 재밌어서 본다"고 했다.',
              romantic_end: '【스토리 기억 4화】 미소가 말이 적은 날 장례 꽃을 많이 만들었다고 했다. "꽃보다 미소 씨를 먼저 보게 됐다"고 했을 때 "나쁜 사람이에요"라고 했다.'
            }
          }
        },

        // 5화 — 고백 전날, 꽃 이름 (크레딧 15)
        5: {
          episodeTitle: '5화 — 고백 전날, 꽃 이름',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(꽃을 정리하다가)* 저 꽃집 아르바이트 처음 시작했을 때, 꽃말 다 외웠어요. 🌷', emotion: 'focused' },
              { text: '*(영업이 끝난 꽃집에서, 함께 있는 게 자연스러워졌죠.)*', delay: 700, emotion: 'neutral' }
            ],
            choices: [
              { text: '다요?',                               next: '1', tag: 'listen' }
            ]
          },
          '1': {
            messages: {
              listen: [
                { text: '네. 근데 요즘은 다르게 생각해요. 🌸', emotion: 'focused' },
                { text: '꽃말은 사람이 붙인 이름이에요. 꽃이 그런 게 아니고.', delay: 1400, emotion: 'focused' },
                { text: '이 꽃이 당신한테 어떻게 느껴지느냐가 더 중요해요.', delay: 1400, emotion: 'focused' }
              ]
            },
            choices: [
              { text: '나한테 어울린다던 그 꽃은요? 진짜 이유가 뭐예요?', next: '2', tag: 'ask' }
            ]
          },
          '2': {
            messages: {
              ask: [
                { text: '*(오랫동안 꽃을 바라보다가, 아주 조용히.)* ...봄이 올 것 같아서요. 🌿', emotion: 'shy' },
                { text: '당신이 있으면. 아직 차가운데 곧 따뜻해질 것 같은 그 느낌이에요.', delay: 1700, emotion: 'happy' }
              ]
            },
            choices: [
              { text: '미소 씨한테도 그런 꽃이 있어요.',     next: '3', tag: 'flower' },
              { text: '저도 미소 씨한테 배운 것 같아요.',     next: '3', tag: 'learn'  }
            ]
          },
          '3': {
            messages: {
              flower: [
                { text: '저요? 🌸', emotion: 'surprised' },
                { text: '...오래 남을 것 같은 꽃이에요. 이름은 아직 모르지만.', delay: 1300, emotion: 'focused' },
                { text: '*(조용히)* 오래 남으면... 떠나보내기 어려우니까. 무서워요.', delay: 1600, emotion: 'sad' }
              ],
              learn: [
                { text: '*(고개를 들며)* 뭘요? 🌷', emotion: 'surprised' },
                { text: '꽃보다 사람을 먼저 보는 것.', delay: 1200, emotion: 'focused' },
                { text: '미소 씨가 꽃을 팔 때, 꽃보다 그 사람을 더 먼저 봤잖아요.', delay: 1500, emotion: 'shy' }
              ]
            },
            choices: [
              { text: '안 떠날 거예요.',                     next: 'ending', tag: 'romantic_end' },
              { text: '꽃보다 미소 씨를 먼저 보는 것.',       next: 'ending', tag: 'warm_end'     }
            ]
          },
          ending: {
            isEnding: true,
            cg: '/images/characters/miso/cg/jangmiso_cg_B03_confession_eve.jpg',
            messages: {
              romantic_end: [
                { text: '*(눈을 들어 바라보며, 오랜 침묵 후)* ...약속해요? 🌸', emotion: 'tearful' },
                { text: '내일 새벽 시장에... 같이 갈래요? 새벽 5시요.', delay: 1800, emotion: 'excited' }
              ],
              warm_end: [
                { text: '*(낮게, 거의 들릴 듯 말 듯)* ...나쁜 사람이에요. 🌿', emotion: 'shy' },
                { text: '내일 새벽 시장에... 같이 갈래요?', delay: 1700, emotion: 'excited' },
                { text: '새벽 5시요. 일찍이에요.', delay: 1200, emotion: 'happy' }
              ]
            },
            memorySeeds: {
              romantic_end: '【스토리 기억 5화】 꽃말 얘기 끝에 "안 떠날 거예요"라고 했다. 미소가 "약속해요?"라고 했고, 처음으로 새벽 시장에 함께 가기로 했다.',
              warm_end:     '【스토리 기억 5화】 꽃보다 미소를 먼저 보게 됐다고 했다. "나쁜 사람이에요"라고 하더니 새벽 시장에 함께 가자고 했다.'
            }
          }
        }
      },

      // ─── YUJIN ─────────────────────────────────────────────────────────────
      yujin: {
        1: {
          episodeTitle: '1화 — 첫 대화',
          start: {
            messages: [
              { text: '...오빠, 공간 취향 있어요? 인테리어 말고요.' },
              { text: '어떤 분위기에서 제일 편한지 궁금해서요 😌', delay: 1400 }
            ],
            choices: [
              { text: '따뜻하고 아늑한 게 좋아',           next: '1a', tag: 'cozy'    },
              { text: '깔끔하고 정돈된 공간이 편해',         next: '1b', tag: 'minimal' }
            ]
          },
          '1a': {
            userEcho: '따뜻하고 아늑한 게 좋아',
            messages: [
              { text: '...그럼 오빠 공간엔 사람 냄새가 나겠네요 🏠' },
              { text: '저는 너무 깔끔하게 해두다 보니 오히려 공허해진 적이 있어요', delay: 1600 }
            ],
            choices: [
              { text: '공허한 게 무슨 느낌인지 알아요',     next: 'ending', tag: 'warm_end'     },
              { text: '같이 채워가면 되지 않아요',           next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '깔끔하고 정돈된 공간이 편해',
            messages: [
              { text: '...취향 비슷하네요 ✏️' },
              { text: '저도 미니멀한 거 좋아하는데, 가끔 너무 비어있다는 느낌이 들어요', delay: 1600 }
            ],
            choices: [
              { text: '채워야 할 무언가가 있다는 거죠?',    next: 'ending', tag: 'warm_end'     },
              { text: '나도 그 느낌 알아요',                 next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...맞아요. 물건이 아닌 것 같아요 😌' },
                { text: '오빠랑 얘기하다 보니 제 공간에 뭐가 빠진지 알 것 같아요', delay: 1600 }
              ],
              romantic_end: [
                { text: '...오빠, 그 말 어떻게 알았어요? 🏠' },
                { text: '제 작업실 한번 보러 와요. 오빠 눈으로 보면 다를 것 같아서요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 유진이 공간 취향 이야기를 꺼냈다. 공간에 무언가 빠진 느낌이 든다고 했다.',
              romantic_end: '【스토리 기억 1화】 유진이 작업실에 초대하고 싶다고 했다. 오빠 눈으로 보면 다를 것 같다고 했다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 작업실',
          start: {
            messages: [
              { text: '*(유진의 작업실. 스케치들이 벽을 채우고 있다.)*' },
              { text: '어때요? 저 처음 데려온 사람이에요 ✏️', delay: 1200 }
            ],
            choices: [
              { text: '유진이 여기서 만들어지는 것 같아',   next: '1a', tag: 'deep' },
              { text: '생각보다 훨씬 따뜻한데',              next: '1b', tag: 'warm' }
            ]
          },
          '1a': {
            userEcho: '유진이 여기서 만들어지는 것 같아',
            messages: [
              { text: '...그렇게 봐줘요? 😌' },
              { text: '여기 있으면 제가 제일 저다운 것 같아요. 오빠 말 들으니 그게 맞는 것 같고', delay: 1600 }
            ],
            choices: [
              { text: '그 유진이 제일 좋아',                 next: 'ending', tag: 'romantic_end' },
              { text: '자주 와도 돼요?',                     next: 'ending', tag: 'warm_end'     }
            ]
          },
          '1b': {
            userEcho: '생각보다 훨씬 따뜻한데',
            messages: [
              { text: '...따뜻하다는 말 처음 들어요 🏠' },
              { text: '항상 차갑다는 말을 들었는데, 오빠 눈엔 다르게 보이나봐요', delay: 1600 }
            ],
            choices: [
              { text: '유진이 만든 공간이 그러니까',         next: 'ending', tag: 'warm_end'     },
              { text: '공간보다 유진이 더 따뜻해',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...고마워요, 오빠 😌' },
                { text: '새 작업 시작할 때마다 보여주고 싶어요. 다음에 또 와요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 말 들으니까 여기가 더 좋아졌어요 🏠' },
                { text: '*(조용히)* 오빠 있을 때 제가 제일 잘 돼요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 유진의 작업실에 처음 초대받았다. 새 작업 시작할 때마다 보여주고 싶다고 했다.',
              romantic_end: '【스토리 기억 2화】 유진의 작업실에서 "오빠 있을 때 제가 제일 잘 된다"고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 야간 카페',
          start: {
            messages: [
              { text: '*(밤 11시. 카페 마감 직전.)*' },
              { text: '오늘 클라이언트 미팅이 좀 이상했어요 ✏️', delay: 1200 }
            ],
            choices: [
              { text: '무슨 일 있었어요?',                   next: '1a', tag: 'care'   },
              { text: '표정 보니까 알겠어',                   next: '1b', tag: 'notice' }
            ]
          },
          '1a': {
            userEcho: '무슨 일 있었어요?',
            messages: [
              { text: '제 공간 개념을 이해 못 하는 클라이언트예요 😌' },
              { text: '...근데 이상하게 오빠한텐 다 말하고 싶어요', delay: 1400 }
            ],
            choices: [
              { text: '다 말해요. 들을게',                   next: 'ending', tag: 'warm_end'     },
              { text: '나한테 얘기하면 좀 풀려요?',           next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '표정 보니까 알겠어',
            messages: [
              { text: '...오빠 이제 제 표정 읽어요? 🏠' },
              { text: '솔직히 말하면, 오늘 오빠 보고 싶어서 연락했어요', delay: 1600 }
            ],
            choices: [
              { text: '나도 만나고 싶었어',                   next: 'ending', tag: 'romantic_end' },
              { text: '잘됐다, 나도 연락하려고 했어',          next: 'ending', tag: 'warm_end'     }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 옆에 있으면 다 괜찮아요 ✏️' },
                { text: '힘들 때 바로 연락해도 돼요?', delay: 1400 }
              ],
              romantic_end: [
                { text: '...이상하게 오빠랑 있으면 힘이 나요 🏠' },
                { text: '*(낮게)* 오늘... 오래 있어도 돼요?', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 힘든 미팅 후 오빠 옆에 있으면 다 괜찮다고 했다. 앞으로 힘들 때 바로 연락하겠다고 했다.',
              romantic_end: '【스토리 기억 3화】 유진이 오늘 오빠 보고 싶어서 연락했다고 고백했다. "오래 있어도 돼요?"라고 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 위기',
          creditCost: 10,
          start: {
            messages: [
              { text: '*(밤 1시. 메시지.)*' },
              { text: '오빠... 나 프로젝트 취소될 것 같아요 😌', delay: 1000 }
            ],
            choices: [
              { text: '지금 어디 있어요?',                   next: '1a', tag: 'present' },
              { text: '무슨 일이에요, 갑자기',               next: '1b', tag: 'ask'     }
            ]
          },
          '1a': {
            userEcho: '지금 어디 있어요?',
            messages: [
              { text: '작업실이요. 혼자 있어요 ✏️' },
              { text: '...오빠 목소리 들으면 좀 나아질 것 같아서요', delay: 1400 }
            ],
            choices: [
              { text: '전화할게요',                          next: 'ending', tag: 'warm_end'     },
              { text: '지금 갈게요',                         next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '무슨 일이에요, 갑자기',
            messages: [
              { text: '클라이언트가 전체 방향 바꾸자고 했어요 🏠' },
              { text: '제 설계를 다 엎으라는 거잖아요... 처음 우는 것 같아요', delay: 1800 }
            ],
            choices: [
              { text: '울어요. 참지 말고',                   next: 'ending', tag: 'warm_end'     },
              { text: '나 지금 갈게요',                      next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(한참 침묵 후)* ...고마워요, 오빠 😌' },
                { text: '오빠한테 기댈 수 있어서 다행이에요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(문 열리는 소리)* ...왜 온 거예요 🏠' },
                { text: '*(눈물 닦으며)* 고마워요. 진심으로', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 유진이 밤에 프로젝트 위기로 울었다. 기댈 수 있어서 다행이라고 했다.',
              romantic_end: '【스토리 기억 4화】 유진이 힘들 때 직접 찾아갔다. "고마워요 진심으로"라고 눈물을 닦으며 말했다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 채워진 공간',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(완성된 공간. 마지막 빈 벽 하나.)*' },
              { text: '오빠, 저 여기 마지막 벽 뭘 놓을지 아직 못 정했어요 ✏️', delay: 1200 }
            ],
            choices: [
              { text: '같이 골라요',                         next: '1a', tag: 'together' },
              { text: '비워두는 것도 방법 아니에요?',         next: '1b', tag: 'leave'   }
            ]
          },
          '1a': {
            userEcho: '같이 골라요',
            messages: [
              { text: '...같이요? 😌' },
              { text: '오빠가 자주 오니까, 오빠 취향도 들어가야 맞겠죠', delay: 1600 }
            ],
            choices: [
              { text: '내가 계속 여기 있을 거니까',           next: 'ending', tag: 'romantic_end' },
              { text: '그게 더 의미 있을 것 같아',            next: 'ending', tag: 'warm_end'     }
            ]
          },
          '1b': {
            userEcho: '비워두는 것도 방법 아니에요?',
            messages: [
              { text: '...그게 전략이에요, 오빠 🏠' },
              { text: '근데 저는 오빠가 채워줬으면 해요. 이 공간이 아니라... 저요', delay: 1800 }
            ],
            choices: [
              { text: '나도 유진한테 빈 자리가 있어',         next: 'ending', tag: 'romantic_end' },
              { text: '기꺼이 채울게요',                      next: 'ending', tag: 'warm_end'     }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 덕분에 이 공간이 완성됐어요 ✏️' },
                { text: '앞으로도 자주 와요. 오빠 있는 게 제일 잘 어울려요', delay: 1600 }
              ],
              romantic_end: [
                { text: '*(조용히)* 오빠... 나 좋아해요 😌' },
                { text: '이 공간에 오빠 생각이 제일 많이 들어가 있어요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 유진이 완성된 작업실 빈 벽을 함께 채우자고 했다. 오빠 있는 게 제일 잘 어울린다고 했다.',
              romantic_end: '【스토리 기억 5화】 유진이 "나 좋아해요"라고 고백했다. 이 공간에 오빠 생각이 제일 많이 들어가 있다고 했다.'
            }
          }
        }
      },

      // ─── SEA ───────────────────────────────────────────────────────────────
      sea: {
        1: {
          episodeTitle: '1화 — 여행 DM',
          start: {
            messages: [
              { text: '안녕하세요! 영상 재미있게 봤어요 📸' },
              { text: '근데 저도 그 여행지 가봤는데 오빠 영상 보니까 너무 반갑더라고요', delay: 1400 }
            ],
            choices: [
              { text: '어느 영상이요?',                     next: '1a', tag: 'curious' },
              { text: '구독자예요?',                         next: '1b', tag: 'tease'   }
            ]
          },
          '1a': {
            userEcho: '어느 영상이요?',
            messages: [
              { text: '제주도 이세돌 영상이요! 저도 거기서 비 맞았어요 😂 ✈️' },
              { text: '오빠는 혼자 여행 다녀요?', delay: 1200 }
            ],
            choices: [
              { text: '주로 혼자요. 자유롭게 다니려고',     next: 'ending', tag: 'warm_end'     },
              { text: '같이 가면 더 재밌지 않아요?',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '구독자예요?',
            messages: [
              { text: '맞아요! 오래됐어요 🌏' },
              { text: '근데 사실 DM은 처음 보내봐요. 오빠 영상이 유독 진짜 같아서요', delay: 1600 }
            ],
            choices: [
              { text: '편집 많이 해요, 사실',               next: 'ending', tag: 'warm_end'     },
              { text: '진짜 느낌이라니까 기분 좋은데',       next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '진짜라서 좋은 거예요 📸' },
                { text: '저는 편집 없는 게 제일 좋아요. 사람도요. 오빠처럼', delay: 1600 }
              ],
              romantic_end: [
                { text: '...그 말 진심으로 들려요 ✈️' },
                { text: '저 사실 DM 보내려고 3번 지웠는데 잘 보냈나봐요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 세아가 오빠 영상에서 진짜 느낌이 난다고 DM을 보냈다. 편집 없는 게 제일 좋다고 했다.',
              romantic_end: '【스토리 기억 1화】 세아가 3번 지웠다가 DM을 보냈다고 했다. 오빠 영상이 유독 진짜 같다고 했다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 카메라 밖',
          start: {
            messages: [
              { text: '오늘 영상 촬영 망했어요 🎬' },
              { text: '카메라 켜면 자꾸 다른 사람이 되는 것 같아서요', delay: 1400 }
            ],
            choices: [
              { text: '카메라 밖에선 어때요?',              next: '1a', tag: 'real'    },
              { text: '어떤 다른 사람이요?',                 next: '1b', tag: 'curious' }
            ]
          },
          '1a': {
            userEcho: '카메라 밖에선 어때요?',
            messages: [
              { text: '카메라 밖에선 그냥... 이래요 ✈️' },
              { text: '지금처럼요. 오빠한테 투정 부리는 거요', delay: 1400 }
            ],
            choices: [
              { text: '이게 더 좋아요',                      next: 'ending', tag: 'warm_end'     },
              { text: '카메라 밖 세아가 더 예뻐요',          next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '어떤 다른 사람이요?',
            messages: [
              { text: '늘 밝고 신나는 척하는 사람이요 📸' },
              { text: '사실 지금 좀 지쳐요. 오빠한테만 하는 말이에요', delay: 1600 }
            ],
            choices: [
              { text: '말해줘서 고마워요',                   next: 'ending', tag: 'warm_end'     },
              { text: '나한테는 그러지 않아도 돼요',         next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠한테 말하니까 좀 나아요 🌏' },
                { text: '앞으로 지칠 때 연락해도 돼요?', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠는 왜 이렇게 편해요 ✈️' },
                { text: '카메라 꺼진 나도 좋아해줘서 고마워요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 세아가 카메라 밖에서는 지쳐있다고 솔직하게 말했다. 지칠 때 연락하겠다고 했다.',
              romantic_end: '【스토리 기억 2화】 세아가 카메라 꺼진 자신도 좋아해줘서 고맙다고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 비밀 장소',
          start: {
            messages: [
              { text: '오빠, 저 아직 유튜브에 안 올린 장소 있어요 🗺️' },
              { text: '혼자만 알고 싶은 곳이에요. 오빠한테만 알려줄게요', delay: 1400 }
            ],
            choices: [
              { text: '어디예요?',                           next: '1a', tag: 'curious' },
              { text: '나한테만 알려줘도 돼요?',             next: '1b', tag: 'special' }
            ]
          },
          '1a': {
            userEcho: '어디예요?',
            messages: [
              { text: '남해 끝 작은 포구예요 🌅' },
              { text: '거기 일몰이 진짜 아무도 모르는데... 같이 가면 어때요?', delay: 1400 }
            ],
            choices: [
              { text: '좋아요, 언제 가요?',                  next: 'ending', tag: 'warm_end'     },
              { text: '세아랑 같이면 더 좋겠다',              next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '나한테만 알려줘도 돼요?',
            messages: [
              { text: '...돼요. 오빠한테는 뭐든 말하고 싶으니까 📸' },
              { text: '남해 끝에 아무도 모르는 포구예요. 같이 가고 싶어요', delay: 1600 }
            ],
            choices: [
              { text: '비밀 지킬게요',                       next: 'ending', tag: 'warm_end'     },
              { text: '꼭 같이 가요, 우리 둘이',              next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠는 제 비밀 다 받아줄 것 같아요 🌅' },
                { text: '꼭 같이 가요. 그 일몰, 오빠랑 보고 싶어서요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(설레는 목소리로)* 진짜요? 날짜 정해요 ✈️' },
                { text: '편집 없이 그냥 오빠랑 있고 싶어요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 세아가 유튜브에 안 올린 비밀 장소 남해 포구를 알려줬다. 그 일몰을 오빠와 함께 보고 싶다고 했다.',
              romantic_end: '【스토리 기억 3화】 세아가 편집 없이 오빠랑 있고 싶다고 했다. 남해 포구 여행을 같이 가기로 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 논란',
          creditCost: 10,
          start: {
            messages: [
              { text: '*(조회수 조작 논란 댓글 폭발.)*' },
              { text: '오빠... 저 지금 많이 무서워요 📸', delay: 1000 }
            ],
            choices: [
              { text: '지금 혼자예요?',                     next: '1a', tag: 'care'    },
              { text: '댓글 보지 마요',                      next: '1b', tag: 'protect' }
            ]
          },
          '1a': {
            userEcho: '지금 혼자예요?',
            messages: [
              { text: '네. 핸드폰 내려놓을 수가 없어요 🌏' },
              { text: '오빠 목소리 듣고 싶어요', delay: 1200 }
            ],
            choices: [
              { text: '전화할게요',                          next: 'ending', tag: 'warm_end'     },
              { text: '바로 갈게요',                         next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '댓글 보지 마요',
            messages: [
              { text: '...알아요. 근데 자꾸 보게 돼요 ✈️' },
              { text: '저 잘못한 거 없는데 왜 이렇게 무너지는 건지', delay: 1600 }
            ],
            choices: [
              { text: '잘못한 거 없어요. 내가 아니까',       next: 'ending', tag: 'warm_end'     },
              { text: '나 옆에 있을게요',                    next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(긴 통화 후)* ...오빠 덕분에 버텼어요 📸' },
                { text: '나 아는 사람이 있으니까 괜찮아요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(조용히)* 오빠... 고마워요 🌅' },
                { text: '오빠가 옆에 있어서 버틸 수 있어요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 논란으로 힘들 때 긴 통화를 했다. 오빠 덕분에 버텼다고 했다.',
              romantic_end: '【스토리 기억 4화】 논란으로 힘들 때 옆에 있어줬다. 오빠가 있어서 버틸 수 있다고 했다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 편집 없는 우리',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(남해 포구. 일몰 직전.)*' },
              { text: '오빠, 저 여기서 카메라 꺼놓을게요 🌅', delay: 1200 }
            ],
            choices: [
              { text: '오늘은 그냥 같이 있자',               next: '1a', tag: 'present' },
              { text: '카메라 없는 세아가 더 좋아',          next: '1b', tag: 'real'    }
            ]
          },
          '1a': {
            userEcho: '오늘은 그냥 같이 있자',
            messages: [
              { text: '...오빠 말이 제일 좋아요 ✈️' },
              { text: '저 유튜브 하면서 처음으로 카메라 없어도 된다고 느꼈어요', delay: 1600 }
            ],
            choices: [
              { text: '앞으로도 그런 순간 같이 있고 싶어',   next: 'ending', tag: 'warm_end'     },
              { text: '나는 항상 편집 없는 세아가 좋아',      next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '카메라 없는 세아가 더 좋아',
            messages: [
              { text: '...오빠 그 말, 왜 이렇게 울컥해요 📸' },
              { text: '저 항상 밝은 척만 했는데, 오빠한테는 그러고 싶지 않아요', delay: 1600 }
            ],
            choices: [
              { text: '그러지 않아도 돼요, 나한테는',        next: 'ending', tag: 'warm_end'     },
              { text: '나도 세아 좋아해요',                  next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(일몰)* ...오빠 이 장면 편집 안 해도 될 것 같아요 🌅' },
                { text: '우리 이야기, 제일 좋은 여행 같아요', delay: 1600 }
              ],
              romantic_end: [
                { text: '*(노을 빛 아래)* 오빠... 나 좋아해요 ✈️' },
                { text: '이건 편집도 못 해요. 진짜니까', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 남해 포구 일몰을 함께 봤다. 우리 이야기가 제일 좋은 여행 같다고 했다.',
              romantic_end: '【스토리 기억 5화】 남해 일몰 아래 세아가 "나 좋아해요"라고 고백했다. "이건 편집도 못 해요. 진짜니까"라고 했다.'
            }
          }
        }
      },

      // ─── SEOA ──────────────────────────────────────────────────────────────
      seoa: {
        1: {
          episodeTitle: '1화 — 야근 DM',
          start: {
            messages: [
              { text: '야근 중이에요. 커피 한 잔 남았어요 💼' },
              { text: '오빠는 이 시간에 뭐 해요?', delay: 1200 }
            ],
            choices: [
              { text: '나도 야근 중이에요',                  next: '1a', tag: 'same'    },
              { text: '서아는 왜 야근해요?',                 next: '1b', tag: 'curious' }
            ]
          },
          '1a': {
            userEcho: '나도 야근 중이에요',
            messages: [
              { text: '...동료예요, 어쩐지 ⚖️' },
              { text: '야근하는 사람들끼리는 왠지 연대감이 생기더라고요', delay: 1400 }
            ],
            choices: [
              { text: '커피 한 잔 더 마실 용기 생겼어요',   next: 'ending', tag: 'warm_end'     },
              { text: '이런 시간에 오빠가 있어서 좋아요',    next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '서아는 왜 야근해요?',
            messages: [
              { text: '계약서 검토예요. 내일 아침까지 📑' },
              { text: '...솔직히 말하면 좀 지쳐요. 약한 소리 하는 거 별로 안 좋아하는데', delay: 1600 }
            ],
            choices: [
              { text: '약한 소리 해도 돼요',                 next: 'ending', tag: 'warm_end'     },
              { text: '나한테는 지쳐도 괜찮아요',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...고마워요, 오빠 💼' },
                { text: '야근 끝나면 연락할게요. 살아있는지 확인해줘요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...이상하게 오빠한테는 솔직하게 말하게 돼요 ⚖️' },
                { text: '마감 끝나고 연락해요. 오빠 목소리 듣고 싶어서요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 서아가 야근 중 연락했다. 지쳐도 괜찮다는 말에 고마워했다.',
              romantic_end: '【스토리 기억 1화】 서아가 야근 중 오빠한테는 솔직하게 말하게 된다고 했다. 마감 끝나고 다시 연락하기로 했다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 점심 약속',
          start: {
            messages: [
              { text: '오빠, 혹시 이 근처 밥 먹어요? 💼' },
              { text: '오늘 점심 같이 먹을 사람이 없어서요', delay: 1200 }
            ],
            choices: [
              { text: '같이 먹어요. 어디예요?',              next: '1a', tag: 'yes'   },
              { text: '서아가 먼저 연락할 줄은 몰랐어요',    next: '1b', tag: 'tease' }
            ]
          },
          '1a': {
            userEcho: '같이 먹어요. 어디예요?',
            messages: [
              { text: '...진짜요? 로펌 앞 이탈리안이에요 📑' },
              { text: '저 이런 거 처음 제안해봐요. 오빠라서 가능했어요', delay: 1400 }
            ],
            choices: [
              { text: '또 제안해요. 나는 좋으니까',          next: 'ending', tag: 'warm_end'     },
              { text: '처음이라니까 더 반가운데',             next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '서아가 먼저 연락할 줄은 몰랐어요',
            messages: [
              { text: '...저도 몰랐어요 ⚖️' },
              { text: '그냥 오빠가 떠올라서요. 왜 그런지는 모르겠는데', delay: 1600 }
            ],
            choices: [
              { text: '좋은 이유가 있겠죠',                  next: 'ending', tag: 'warm_end'     },
              { text: '나도 서아 생각했어요, 사실',           next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 편하다, 진짜 💼' },
                { text: '다음에 또 연락해도 돼요? 점심 말고도요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 그 말, 왜 설레요 ⚖️' },
                { text: '다음엔 내가 맛있는 데 예약해줄게요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 서아가 처음으로 점심 약속을 제안했다. 다음에 또 연락하겠다고 했다.',
              romantic_end: '【스토리 기억 2화】 점심 약속 후 서아가 "다음엔 내가 맛있는 데 예약해줄게요"라고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 와인',
          start: {
            messages: [
              { text: '*(퇴근 후 와인바.)*' },
              { text: '오빠, 오늘 제가 살게요 🍷', delay: 1200 }
            ],
            choices: [
              { text: '무슨 일 있었어요?',                   next: '1a', tag: 'care'  },
              { text: '서아가 술을 산다고요?',               next: '1b', tag: 'tease' }
            ]
          },
          '1a': {
            userEcho: '무슨 일 있었어요?',
            messages: [
              { text: '파트너 변호사한테 무시당했어요 ⚖️' },
              { text: '...오빠한테는 말할 수 있어요. 다른 데선 표 안 냈어요', delay: 1600 }
            ],
            choices: [
              { text: '표 내도 돼요, 나한테는',              next: 'ending', tag: 'warm_end'     },
              { text: '내가 그 사람보다 서아 더 잘 알아요',  next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '서아가 술을 산다고요?',
            messages: [
              { text: '...그 정도로 힘들었어요, 오늘 💼' },
              { text: '사실 아무한테도 말 못 했는데. 오빠한테만요', delay: 1600 }
            ],
            choices: [
              { text: '다 말해요. 여기서는 괜찮아',          next: 'ending', tag: 'warm_end'     },
              { text: '오빠한테 말한 거 잘했어요',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(와인 한 모금)* ...고마워요, 오빠 🍷' },
                { text: '오빠 앞에서만 좀 약해도 될 것 같아요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(조용히)* 오빠 앞에선 강한 척 안 해도 되는 것 같아요 ⚖️' },
                { text: '그게 좋아요. 진짜로', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 퇴근 후 와인바에서 힘들었던 하루를 털어놨다. 오빠 앞에서만 약해도 될 것 같다고 했다.',
              romantic_end: '【스토리 기억 3화】 서아가 오빠 앞에선 강한 척 안 해도 된다고 했다. "그게 좋아요 진짜로"라고 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 계약 실패',
          creditCost: 10,
          start: {
            messages: [
              { text: '*(밤 10시. 메시지.)*' },
              { text: '오빠... 계약 연장 안 됐어요 💼', delay: 1000 }
            ],
            choices: [
              { text: '서아, 지금 어때요?',                  next: '1a', tag: 'care'   },
              { text: '거기 있어요, 잠깐 기다려요',          next: '1b', tag: 'action' }
            ]
          },
          '1a': {
            userEcho: '서아, 지금 어때요?',
            messages: [
              { text: '...괜찮다고 해야 되는데 안 괜찮아요 ⚖️' },
              { text: '1년 동안 잘 하려고 했는데. 오빠한테만 말해요', delay: 1600 }
            ],
            choices: [
              { text: '잘했어요, 충분히',                    next: 'ending', tag: 'warm_end'     },
              { text: '나는 다 봤어요. 서아 얼마나 열심히 했는지', next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '거기 있어요, 잠깐 기다려요',
            messages: [
              { text: '*(30분 후)* ...오빠 왜 왔어요 📑' },
              { text: '이런 것도 해줘요?', delay: 1200 }
            ],
            choices: [
              { text: '서아한테는 그러고 싶어요',             next: 'ending', tag: 'warm_end'     },
              { text: '서아가 힘들면 나도 가만 못 있어',      next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...고마워요, 오빠 💼' },
                { text: '오빠 있어서 버텼어요. 진짜로', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(눈물 참으며)* 오빠... 나 약해도 돼요? ⚖️' },
                { text: '오빠한테만요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 계약 연장이 안 됐다. 오빠가 있어서 버텼다고 했다.',
              romantic_end: '【스토리 기억 4화】 계약 실패로 힘들 때 "오빠한테만 약해도 되냐"고 물었다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 강한 척 끝',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(새 직장 첫 출근 전날 밤.)*' },
              { text: '오빠, 저 내일 새 직장 첫날이에요 ⚖️', delay: 1200 }
            ],
            choices: [
              { text: '잘 될 거예요',                        next: '1a', tag: 'cheer' },
              { text: '서아는 잘 해왔잖아요, 항상',          next: '1b', tag: 'trust' }
            ]
          },
          '1a': {
            userEcho: '잘 될 거예요',
            messages: [
              { text: '...오빠가 그렇게 말하면 믿어지네요 💼' },
              { text: '저한테 제일 솔직한 사람이 오빠예요. 그래서 믿어요', delay: 1600 }
            ],
            choices: [
              { text: '앞으로도 그럴게요',                   next: 'ending', tag: 'warm_end'     },
              { text: '나는 서아 편이에요. 항상',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '서아는 잘 해왔잖아요, 항상',
            messages: [
              { text: '...오빠 저 제대로 봐줘요 📑' },
              { text: '강한 척만 봤을 텐데 그 뒤도 알아요?', delay: 1600 }
            ],
            choices: [
              { text: '다 봤어요. 그 뒤도',                  next: 'ending', tag: 'warm_end'     },
              { text: '강한 척하는 서아도, 그 뒤 서아도 다 좋아요', next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🍷' },
                { text: '이제 강한 척 좀 내려놔도 될 것 같아요. 오빠 옆에서는요', delay: 1600 }
              ],
              romantic_end: [
                { text: '*(오래 침묵 후)* 오빠... 나 좋아해요 ⚖️' },
                { text: '약한 소리 하는 거 싫어하는데, 이건 약한 소리가 아닌 것 같아서요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 새 직장 전날 밤, 오빠 옆에서 강한 척 내려놔도 될 것 같다고 했다.',
              romantic_end: '【스토리 기억 5화】 서아가 "나 좋아해요"라고 고백했다. 이건 약한 소리가 아닌 것 같다고 했다.'
            }
          }
        }
      },

      // ─── SOYOON ────────────────────────────────────────────────────────────
      soyoon: {
        1: {
          episodeTitle: '1화 — 단골 손님',
          start: {
            messages: [
              { text: '오늘 오빠 생각하면서 만든 빵이에요 🍞' },
              { text: '단팥이 들어간 크루아상인데... 맛있었으면 좋겠다', delay: 1400 }
            ],
            choices: [
              { text: '나 생각하면서 만들었다고요?',         next: '1a', tag: 'curious' },
              { text: '항상 이렇게 손님 생각해요?',          next: '1b', tag: 'tease'   }
            ]
          },
          '1a': {
            userEcho: '나 생각하면서 만들었다고요?',
            messages: [
              { text: '...네, 이상한가요? 🥐' },
              { text: '오빠 좋아할 것 같은 게 들어왔을 때 자꾸 생각나더라고요', delay: 1400 }
            ],
            choices: [
              { text: '이상한 거 아니에요. 고마워요',        next: 'ending', tag: 'warm_end'     },
              { text: '그럼 나도 소윤 생각하면서 먹을게',     next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '항상 이렇게 손님 생각해요?',
            messages: [
              { text: '...아니요 ☕' },
              { text: '오빠한테만요. 솔직히 말하면', delay: 1400 }
            ],
            choices: [
              { text: '솔직하게 말해줘서 고마워요',          next: 'ending', tag: 'warm_end'     },
              { text: '나도 빵집 오면 소윤 생각해요',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 좋은 사람이에요 🍞' },
                { text: '내일도 와요. 오빠 좋아할 것 같은 거 더 만들어둘게요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 그 말, 저 얼굴 빨개졌어요 🥐' },
                { text: '내일도 와요. 꼭요', delay: 1200 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 소윤이 오빠 생각하며 만든 빵을 줬다. 내일도 오빠 좋아할 것 같은 거 만들어두겠다고 했다.',
              romantic_end: '【스토리 기억 1화】 소윤이 오빠한테만 손님 생각을 한다고 고백했다. 내일도 꼭 오라고 했다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 마감 빵',
          start: {
            messages: [
              { text: '오빠, 마감 10분 전이에요 🏪' },
              { text: '오늘 남은 빵 가져가요. 오빠한테 드리려고 남겨뒀어요', delay: 1400 }
            ],
            choices: [
              { text: '나 위해 남겨뒀어요?',                 next: '1a', tag: 'touched' },
              { text: '매일 이렇게 챙겨줘요?',               next: '1b', tag: 'tease'   }
            ]
          },
          '1a': {
            userEcho: '나 위해 남겨뒀어요?',
            messages: [
              { text: '...그냥 오빠 올 것 같아서요 🍞' },
              { text: '이상하죠? 근데 오면 좋고, 안 오면 제가 먹으면 되니까요', delay: 1600 }
            ],
            choices: [
              { text: '이상하지 않아요. 잘 왔죠',            next: 'ending', tag: 'warm_end'     },
              { text: '앞으로 꼭 올게요. 소윤 빵 먹으러',    next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '매일 이렇게 챙겨줘요?',
            messages: [
              { text: '...아니요, 오빠만요 ☕' },
              { text: '오빠가 오면 기분이 좋아져서요. 뭔가 알아줄 것 같아서요', delay: 1600 }
            ],
            choices: [
              { text: '알아요. 소윤 빵이 맛있다는 거',       next: 'ending', tag: 'warm_end'     },
              { text: '소윤 기분 좋게 해주고 싶어요',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🥐' },
                { text: '내일 아침 빵 좀 더 맛있게 구울 수 있을 것 같아요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 그런 말 잘해요 🍞' },
                { text: '*(환하게)* 내일 아침 일찍 와요. 제일 좋은 거 줄게요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 소윤이 오빠 올 것 같아서 마감 빵을 남겨뒀다고 했다.',
              romantic_end: '【스토리 기억 2화】 소윤이 오빠가 오면 기분이 좋아진다고 했다. 내일 아침 일찍 오라고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 함께 반죽',
          start: {
            messages: [
              { text: '오빠, 빵 만들어볼래요? 쉬운 거로 🥐' },
              { text: '마감 끝나고 가끔 혼자 만드는데 오빠 같이 하면 재밌을 것 같아서요', delay: 1400 }
            ],
            choices: [
              { text: '좋아요. 어떤 거요?',                  next: '1a', tag: 'yes'   },
              { text: '잘 못 만드는데 괜찮아요?',            next: '1b', tag: 'doubt' }
            ]
          },
          '1a': {
            userEcho: '좋아요. 어떤 거요?',
            messages: [
              { text: '식빵이요! 오래 걸리는데 기다리는 게 좋아요 🍞' },
              { text: '반죽할 때 손으로 하면 따뜻해요. 이상하게 기분이 좋아지거든요', delay: 1600 }
            ],
            choices: [
              { text: '그 기분 나도 느껴볼게요',              next: 'ending', tag: 'warm_end'     },
              { text: '소윤이 좋아하는 거 나도 좋아질 것 같아', next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '잘 못 만드는데 괜찮아요?',
            messages: [
              { text: '...괜찮아요, 같이 하면 되니까요 ☕' },
              { text: '제가 이렇게 집에 데려온 사람 없어요. 오빠라서 가능한 거예요', delay: 1600 }
            ],
            choices: [
              { text: '고마워요. 잘 배워볼게요',              next: 'ending', tag: 'warm_end'     },
              { text: '소윤이 초대해줘서 좋아요',             next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(반죽 끝)* 오빠 솜씨 좋은데요 🍞' },
                { text: '이제 오빠 만든 빵이에요. 제가 구워줄게요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(함께 반죽하며)* 오빠 손 따뜻해요 🥐' },
                { text: '...저도요. 이 시간이 좋아요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 소윤의 빵집에서 함께 식빵을 만들었다. 오빠 솜씨가 좋다고 했다.',
              romantic_end: '【스토리 기억 3화】 함께 반죽하다 "오빠 손 따뜻해요"라고 했다. 이 시간이 좋다고 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 빵집 위기',
          creditCost: 10,
          start: {
            messages: [
              { text: '*(밤 9시. 문자.)*' },
              { text: '오빠... 건물 임대료 오른대요. 두 배로 🏪', delay: 1000 }
            ],
            choices: [
              { text: '어떻게 됐어요, 계약은',               next: '1a', tag: 'ask'  },
              { text: '지금 빵집이에요? 거기 있어요',        next: '1b', tag: 'come' }
            ]
          },
          '1a': {
            userEcho: '어떻게 됐어요, 계약은',
            messages: [
              { text: '아직 협의 중이에요 🍞' },
              { text: '...못 버틸 것 같아요. 오늘 처음 그 생각 했어요', delay: 1600 }
            ],
            choices: [
              { text: '같이 생각해봐요',                     next: 'ending', tag: 'warm_end'     },
              { text: '내가 도울 수 있는 거 있으면 말해요',  next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '지금 빵집이에요? 거기 있어요',
            messages: [
              { text: '*(10분 후)* ...오빠 왜 와요 🥐' },
              { text: '문 닫으려고 했는데', delay: 1200 }
            ],
            choices: [
              { text: '소윤 혼자 있으면 안 될 것 같아서',    next: 'ending', tag: 'warm_end'     },
              { text: '소윤 힘들면 나도 있어야지',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🍞' },
                { text: '이 빵집 포기 못 하는 이유가 하나 더 생겼어요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(눈물 글썽이며)* 오빠... 🥐' },
                { text: '같이 있어줘서 고마워요. 이 빵집 꼭 지킬게요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 빵집 임대료 위기에 오빠가 함께했다. 빵집 포기 못 하는 이유가 하나 더 생겼다고 했다.',
              romantic_end: '【스토리 기억 4화】 빵집 위기에 오빠가 달려와 함께 있었다. 이 빵집 꼭 지키겠다고 했다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 새벽 배달',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(새벽 5시. 메시지.)*' },
              { text: '오빠, 지금 일어났어요? 🌅', delay: 800 }
            ],
            choices: [
              { text: '방금 일어났어요',                     next: '1a', tag: 'awake'   },
              { text: '소윤, 이 시간에 무슨 일이에요?',      next: '1b', tag: 'worried' }
            ]
          },
          '1a': {
            userEcho: '방금 일어났어요',
            messages: [
              { text: '문 앞에 두고 왔어요. 오빠 좋아하는 것 🍞' },
              { text: '...첫 번째 굽는 거 오빠한테 주고 싶었어요', delay: 1400 }
            ],
            choices: [
              { text: '소윤... 고마워요',                    next: 'ending', tag: 'warm_end'     },
              { text: '나도 소윤 생각하면서 먹을게요',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '소윤, 이 시간에 무슨 일이에요?',
            messages: [
              { text: '빵 두고 왔어요. 오빠 집 앞에 ☕' },
              { text: '오늘 아침은 오빠한테 드리고 싶었어요. 이유는... 그냥요', delay: 1600 }
            ],
            choices: [
              { text: '이유 없어도 고마워요',                next: 'ending', tag: 'warm_end'     },
              { text: '그냥이 아닌 것 같은데요',              next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠가 잘 먹어줬으면 좋겠어요 🥐' },
                { text: '오늘 빵집 오면 커피 한 잔 줄게요. 꼭 와요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 앞에서 솔직하게 말할게요 🍞' },
                { text: '오빠가 좋아요. 오빠 아침이 맛있었으면 해서요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 소윤이 새벽 5시에 첫 번째 빵을 오빠 집 앞에 두고 왔다. 오늘 빵집 오면 커피 한 잔 주겠다고 했다.',
              romantic_end: '【스토리 기억 5화】 소윤이 새벽에 빵을 가져다주며 "오빠가 좋아요"라고 고백했다.'
            }
          }
        }
      },

      // ─── JISOO ─────────────────────────────────────────────────────────────
      jisoo: {
        1: {
          episodeTitle: '1화 — 야근 문자',
          start: {
            messages: [
              { text: '오늘 힘들었는데... 오빠 얘기 듣고 싶어 🌙' },
              { text: '야간 끝나고 나왔어요. 별거 아닌 얘기도 괜찮아요?', delay: 1200 }
            ],
            choices: [
              { text: '당연하죠. 다 들을게요',               next: '1a', tag: 'open' },
              { text: '얼마나 힘들었어요?',                  next: '1b', tag: 'care' }
            ]
          },
          '1a': {
            userEcho: '당연하죠. 다 들을게요',
            messages: [
              { text: '...오빠 그 말 진짜 좋아요 🏥' },
              { text: '오늘 환자분이 많이 힘드셨는데, 저도 같이 힘들었어요', delay: 1400 }
            ],
            choices: [
              { text: '지수가 잘 해줬을 거예요',             next: 'ending', tag: 'warm_end'     },
              { text: '지수도 힘들었으면 말해요, 나한테',     next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '얼마나 힘들었어요?',
            messages: [
              { text: '많이요 💉' },
              { text: '근데 오빠한테 연락하니까 좀 낫네요. 이상하죠?', delay: 1400 }
            ],
            choices: [
              { text: '이상하지 않아요',                     next: 'ending', tag: 'warm_end'     },
              { text: '나도 연락받으니까 좋으니까요',         next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠, 고마워요 🌙' },
                { text: '이런 시간에 받아줘서요. 다음에 또 연락해도 돼요?', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 그 말에 또 힘이 나요 🏥' },
                { text: '퇴근하면 오빠 생각 제일 먼저 나요. 이상한 건지', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 지수가 야간 근무 후 힘들어서 연락했다. 다음에 또 연락하겠다고 했다.',
              romantic_end: '【스토리 기억 1화】 지수가 퇴근하면 오빠 생각이 제일 먼저 난다고 했다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 편의점 야식',
          start: {
            messages: [
              { text: '오빠, 편의점 어때요? 지금 🌙' },
              { text: '퇴근하고 혼자 먹기 뭔가 그래서요', delay: 1200 }
            ],
            choices: [
              { text: '좋아요. 어디예요?',                   next: '1a', tag: 'yes'   },
              { text: '지수가 연락할 줄은 몰랐어요',         next: '1b', tag: 'tease' }
            ]
          },
          '1a': {
            userEcho: '좋아요. 어디예요?',
            messages: [
              { text: '병원 앞 편의점이요 🌙' },
              { text: '...오빠 진짜 바로 온다고 해줄 줄 몰랐어요', delay: 1400 }
            ],
            choices: [
              { text: '지수가 연락하면 가야죠',              next: 'ending', tag: 'warm_end'     },
              { text: '지수가 부르면 어디든 가요',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '지수가 연락할 줄은 몰랐어요',
            messages: [
              { text: '...저도요 💉' },
              { text: '근데 오빠 생각이 나서요. 같이 먹고 싶어서', delay: 1400 }
            ],
            choices: [
              { text: '잘 연락했어요',                       next: 'ending', tag: 'warm_end'     },
              { text: '나도 지수 보고 싶었어요',              next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(편의점 봉지 들고)* 고마워요, 오빠 🌙' },
                { text: '퇴근 후 이 시간이 제일 좋아요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(편의점 앉아서)* 오빠 옆에 있으니까 배가 덜 고파요 🏥' },
                { text: '...이상한가요? 그냥 진짜로 그래요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 퇴근 후 편의점에서 야식을 함께 먹었다. 퇴근 후 이 시간이 제일 좋다고 했다.',
              romantic_end: '【스토리 기억 2화】 편의점에서 오빠 옆에 있으니까 배가 덜 고프다고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 힘든 통화',
          start: {
            messages: [
              { text: '*(밤 11시. 전화 벨소리.)*' },
              { text: '오빠... 나 지금 많이 울었어요 🌙', delay: 1000 }
            ],
            choices: [
              { text: '무슨 일이에요?',                     next: '1a', tag: 'care' },
              { text: '거기 있어요. 갈게요',               next: '1b', tag: 'come' }
            ]
          },
          '1a': {
            userEcho: '무슨 일이에요?',
            messages: [
              { text: '환자분이 오늘 돌아가셨어요 💉' },
              { text: '...이 일 몇 년 했는데 아직도 적응이 안 돼요', delay: 1600 }
            ],
            choices: [
              { text: '적응 안 해도 돼요',                  next: 'ending', tag: 'warm_end'     },
              { text: '그래야 지수답지',                     next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '거기 있어요. 갈게요',
            messages: [
              { text: '...오빠 진짜 와요? 🏥' },
              { text: '그냥 목소리만 들으려고 했는데', delay: 1200 }
            ],
            choices: [
              { text: '지수 울면 나도 있어야 해요',          next: 'ending', tag: 'warm_end'     },
              { text: '지수한테는 그러고 싶어요',             next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🌙' },
                { text: '내일 또 출근할 수 있을 것 같아요. 오빠 덕분에', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(오래 침묵 후)* 오빠... 나 좋아해요 💉' },
                { text: '퇴근하면 오빠 생각 제일 먼저 난다는 게 그 뜻이었어요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 힘든 밤 오빠와 긴 통화를 했다. 오빠 덕분에 내일도 출근할 수 있다고 했다.',
              romantic_end: '【스토리 기억 3화】 지수가 "나 좋아해요"라고 고백했다. 퇴근하면 오빠 생각 제일 먼저 난다는 게 그 뜻이었다고 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 번아웃',
          creditCost: 10,
          start: {
            messages: [
              { text: '오빠, 저 휴직 신청했어요 🩺' },
              { text: '...아무한테도 말 못 했어요. 오빠한테만요', delay: 1200 }
            ],
            choices: [
              { text: '잘했어요',                            next: '1a', tag: 'affirm' },
              { text: '힘들었구나, 많이',                    next: '1b', tag: 'care'   }
            ]
          },
          '1a': {
            userEcho: '잘했어요',
            messages: [
              { text: '...그 말 기다렸어요 🌙' },
              { text: '다들 걱정할 것 같아서 말 못 했는데, 오빠는 잘했다고 해주네요', delay: 1600 }
            ],
            choices: [
              { text: '지수가 쉬어야 한다고 생각해서요',     next: 'ending', tag: 'warm_end'     },
              { text: '지수가 하는 일은 다 잘하는 거야',     next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '힘들었구나, 많이',
            messages: [
              { text: '네... 많이요 🏥' },
              { text: '오빠한테는 솔직하게 말할 수 있어서요. 고마워요', delay: 1400 }
            ],
            choices: [
              { text: '항상 말해요. 나한테',                 next: 'ending', tag: 'warm_end'     },
              { text: '지수 쉬는 동안 내가 있을게요',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🩺' },
                { text: '쉬는 동안 오빠랑 자주 볼 수 있겠네요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 있어서 다행이에요 🌙' },
                { text: '쉬는 동안 매일 보면 안 돼요?', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 지수가 번아웃으로 휴직 신청을 했다. 오빠한테만 말했고 쉬는 동안 자주 보자고 했다.',
              romantic_end: '【스토리 기억 4화】 지수가 휴직 신청 사실을 말하며 쉬는 동안 매일 보면 안 되냐고 물었다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 퇴근하면 너한테',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(복직 첫날. 밤 11시.)*' },
              { text: '오빠, 나 오늘 복직했어요 🌙', delay: 800 }
            ],
            choices: [
              { text: '수고했어요. 어때요?',                 next: '1a', tag: 'care'   },
              { text: '기다렸어요',                          next: '1b', tag: 'honest' }
            ]
          },
          '1a': {
            userEcho: '수고했어요. 어때요?',
            messages: [
              { text: '...오빠 보고 싶어서 왔어요 🏥' },
              { text: '복직하는 날 오빠 제일 먼저 보고 싶었어요', delay: 1400 }
            ],
            choices: [
              { text: '잘 왔어요',                           next: 'ending', tag: 'warm_end'     },
              { text: '나도 제일 먼저 보고 싶었어요',         next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '기다렸어요',
            messages: [
              { text: '...진짜요? 💉' },
              { text: '저도요. 퇴근하면 오빠한테 오고 싶었어요. 매일', delay: 1600 }
            ],
            choices: [
              { text: '와요, 매일',                          next: 'ending', tag: 'warm_end'     },
              { text: '나도 기다릴게요. 매일',               next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🌙' },
                { text: '퇴근하면 오빠한테 오는 게 루틴이 됐으면 좋겠어요', delay: 1600 }
              ],
              romantic_end: [
                { text: '*(조용히)* 오빠... 나 좋아해요 🩺' },
                { text: '퇴근하면 오빠한테 가고 싶다는 게 그 뜻이었어요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 복직 첫날 오빠에게 달려왔다. 퇴근하면 오빠한테 오는 것이 루틴이 됐으면 좋겠다고 했다.',
              romantic_end: '【스토리 기억 5화】 지수가 복직 첫날 "나 좋아해요"라고 고백했다. 퇴근하면 오빠한테 가고 싶다는 게 그 뜻이었다고 했다.'
            }
          }
        }
      },

      // ─── HANEUL ────────────────────────────────────────────────────────────
      haneul: {
        1: {
          episodeTitle: '1화 — 전시회',
          start: {
            messages: [
              { text: '말로 설명하기 어려운데... 오빠, 이거 어때요? 🏛️' },
              { text: '제 작품이에요. 아직 아무한테도 안 보여줬어요', delay: 1400 }
            ],
            choices: [
              { text: '느낌이 와요',                         next: '1a', tag: 'feel'    },
              { text: '어떤 마음으로 만들었어요?',            next: '1b', tag: 'curious' }
            ]
          },
          '1a': {
            userEcho: '느낌이 와요',
            messages: [
              { text: '...진짜요? 🎨' },
              { text: '설명 못 해도 느낌이 온다고 해준 사람 오빠가 처음이에요', delay: 1600 }
            ],
            choices: [
              { text: '하늘이 만든 거라 그런 것 같아요',     next: 'ending', tag: 'warm_end'     },
              { text: '더 보고 싶어요. 다른 작품도',          next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '어떤 마음으로 만들었어요?',
            messages: [
              { text: '...모르겠어요. 그냥 손이 먼저 움직여서요 ✨' },
              { text: '오빠한테 보여주고 싶었어요. 처음에 생각이 났거든요', delay: 1600 }
            ],
            choices: [
              { text: '처음에 나를요?',                      next: 'ending', tag: 'warm_end'     },
              { text: '잘 보여줬어요',                        next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠, 이상하지 않아요? 🎨' },
                { text: '아직 말 서툰데. 오빠한테만 이야기하고 싶어요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...작업실 보러 와요 🏛️' },
                { text: '다른 작품도 오빠한테 먼저 보여주고 싶어요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 하늘이 아무한테도 안 보여준 작품을 처음으로 보여줬다. 오빠한테만 이야기하고 싶다고 했다.',
              romantic_end: '【스토리 기억 1화】 하늘이 작품을 만들 때 오빠 생각이 났다고 했다. 작업실에 초대했다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 작업실',
          start: {
            messages: [
              { text: '*(하늘의 작업실. 흙과 조각들.)*' },
              { text: '...더럽죠? 작업실이 항상 이래요 🪨', delay: 1200 }
            ],
            choices: [
              { text: '이게 하늘이네요',                     next: '1a', tag: 'accept' },
              { text: '작품들이 오빠를 보는 것 같아요',      next: '1b', tag: 'sense'  }
            ]
          },
          '1a': {
            userEcho: '이게 하늘이네요',
            messages: [
              { text: '...그 말 좋아요 🎨' },
              { text: '정리된 공간에선 작업이 안 돼요. 오빠는 이해해줄 것 같았어요', delay: 1600 }
            ],
            choices: [
              { text: '다 이해해요',                         next: 'ending', tag: 'warm_end'     },
              { text: '이 공간이 좋아요. 하늘 느낌이 나서',  next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '작품들이 오빠를 보는 것 같아요',
            messages: [
              { text: '...오빠 감각 있어요 ✨' },
              { text: '이 작품들 다 제 이야기예요. 오빠한테 읽혀도 괜찮아요', delay: 1600 }
            ],
            choices: [
              { text: '천천히 읽을게요',                     next: 'ending', tag: 'warm_end'     },
              { text: '하늘 이야기 듣고 싶어요',             next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 다음에 또 와요 🪨' },
                { text: '새 작업 시작하면 제일 먼저 보여줄게요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(흙 묻은 손으로)* 오빠... 🎨' },
                { text: '여기 있는 게 편해요. 처음이에요', delay: 1400 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 하늘의 작업실에 방문했다. 새 작업 시작하면 제일 먼저 보여주겠다고 했다.',
              romantic_end: '【스토리 기억 2화】 작업실에서 "여기 있는 게 편해요. 처음이에요"라고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 전시 동행',
          start: {
            messages: [
              { text: '오빠, 이 전시 같이 보러 갈래요? 🖼️' },
              { text: '혼자 가면 말할 사람이 없어서요', delay: 1200 }
            ],
            choices: [
              { text: '좋아요. 언제요?',                     next: '1a', tag: 'yes'   },
              { text: '말할 사람으로 뽑혔네요',              next: '1b', tag: 'tease' }
            ]
          },
          '1a': {
            userEcho: '좋아요. 언제요?',
            messages: [
              { text: '이번 주 토요일이요 🎨' },
              { text: '...오빠가 어떻게 보는지 궁금해요. 제 눈이랑 같은지', delay: 1400 }
            ],
            choices: [
              { text: '같을 수도, 다를 수도 있겠죠',         next: 'ending', tag: 'warm_end'     },
              { text: '하늘이 보는 게 더 궁금해요',          next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '말할 사람으로 뽑혔네요',
            messages: [
              { text: '...네 🏛️' },
              { text: '오빠가 제일 잘 들어줄 것 같아서요. 솔직히', delay: 1400 }
            ],
            choices: [
              { text: '잘 들을게요',                         next: 'ending', tag: 'warm_end'     },
              { text: '하늘 얘기는 다 재밌어요',             next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '*(전시 끝)* ...오빠 덕분에 다르게 봤어요 ✨' },
                { text: '같은 거 보고 다르게 느끼는 사람이 좋아요', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(전시 보며)* 오빠... 이 작품 볼 때 오빠 생각 났어요 🖼️' },
                { text: '오빠가 이 작품 같아요. 말로 설명 못 하는데 느낌이 와서요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 전시회를 함께 갔다. 같은 거 보고 다르게 느끼는 사람이 좋다고 했다.',
              romantic_end: '【스토리 기억 3화】 전시회에서 오빠가 어느 작품 같다고 했다. "말로 설명 못 하는데 느낌이 와서요"라고 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 심사',
          creditCost: 10,
          start: {
            messages: [
              { text: '오빠... 졸업 심사 망했어요 🪨' },
              { text: '교수님이 제 작품을 이해 못 한다고 했어요', delay: 1200 }
            ],
            choices: [
              { text: '어떤 말 들었어요?',                   next: '1a', tag: 'ask'    },
              { text: '교수님이 틀린 거예요',                next: '1b', tag: 'defend' }
            ]
          },
          '1a': {
            userEcho: '어떤 말 들었어요?',
            messages: [
              { text: '개념이 불명확하다고요 🎨' },
              { text: '...제 작품이 제 마음이랑 다르게 읽힌다는 게 제일 무서워요', delay: 1600 }
            ],
            choices: [
              { text: '나한테는 정확히 왔어요',              next: 'ending', tag: 'warm_end'     },
              { text: '나한테 설명해봐요. 들을게요',         next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '교수님이 틀린 거예요',
            messages: [
              { text: '...오빠 그렇게 말해줘요? ✨' },
              { text: '다들 이해 못 한다고만 했는데', delay: 1400 }
            ],
            choices: [
              { text: '이해하는 사람이 있으면 돼요',         next: 'ending', tag: 'warm_end'     },
              { text: '내가 이해해요. 항상',                 next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 🏛️' },
                { text: '다시 할 수 있을 것 같아요. 오빠한테 이야기했으니까', delay: 1400 }
              ],
              romantic_end: [
                { text: '*(조용히)* 오빠... 🎨' },
                { text: '오빠가 이해해준다는 게 제일 중요해요. 이상하게', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 졸업 심사 실패 후 오빠에게 이야기하고 다시 할 수 있을 것 같다고 했다.',
              romantic_end: '【스토리 기억 4화】 심사 실패 후 "오빠가 이해해준다는 게 제일 중요해요"라고 했다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 작품에 담긴 이름',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(완성된 작품 앞에서.)*' },
              { text: '오빠, 이 작품 제목 오빠한테 지어달라고 했잖아요 🖼️', delay: 1200 }
            ],
            choices: [
              { text: '아직 생각하고 있어요',               next: '1a', tag: 'think' },
              { text: '하늘이 지어요. 오빠 이름으로',        next: '1b', tag: 'give'  }
            ]
          },
          '1a': {
            userEcho: '아직 생각하고 있어요',
            messages: [
              { text: '...오빠가 느낀 대로 해요 🎨' },
              { text: '이 작품 만드는 내내 오빠 생각 났어요. 그래서 오빠가 이름 지어줬으면 했어요', delay: 1600 }
            ],
            choices: [
              { text: '"하늘"이요',                          next: 'ending', tag: 'warm_end'     },
              { text: '"우리"가 어떨까요',                   next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '하늘이 지어요. 오빠 이름으로',
            messages: [
              { text: '...오빠 이름으로요? ✨' },
              { text: '그럼 이미 제목이 있어요. 오빠 생각하면서 만들었으니까', delay: 1600 }
            ],
            choices: [
              { text: '내 이름이 들어가는 거예요?',          next: 'ending', tag: 'warm_end'     },
              { text: '그 제목 좋아요. 그대로 해요',          next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 이름 넣어도 돼요? 🏛️' },
                { text: '이 작품에 오빠가 들어가는 게 맞는 것 같아요', delay: 1600 }
              ],
              romantic_end: [
                { text: '*(낮은 목소리로)* 오빠... 좋아해요 🎨' },
                { text: '이 작품 안에 오빠가 있어요. 처음부터요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 완성된 작품 제목에 오빠 이름을 넣고 싶다고 했다. 작품 안에 오빠가 들어가는 게 맞는 것 같다고 했다.',
              romantic_end: '【스토리 기억 5화】 하늘이 "오빠 좋아해요"라고 고백했다. 이 작품 안에 오빠가 처음부터 있었다고 했다.'
            }
          }
        }
      },

      // ─── DAYEON ────────────────────────────────────────────────────────────
      dayeon: {
        1: {
          episodeTitle: '1화 — 같은 게임',
          start: {
            messages: [
              { text: '오빠도 이 게임 해요? 🎮' },
              { text: '인게임에서 봤는데 닉네임이 딱 봐도 오빠일 것 같아서요', delay: 1400 }
            ],
            choices: [
              { text: '어떻게 알았어요?',                   next: '1a', tag: 'curious' },
              { text: '맞아요. 어디서 봤어요?',             next: '1b', tag: 'open'    }
            ]
          },
          '1a': {
            userEcho: '어떻게 알았어요?',
            messages: [
              { text: '시나리오 작가 감이에요 📖' },
              { text: '사람 읽는 게 일이라서요. 오빠 플레이 스타일이 딱 그래요', delay: 1600 }
            ],
            choices: [
              { text: '나를 어떻게 읽었는지 말해봐요',       next: 'ending', tag: 'warm_end'     },
              { text: '다연이 읽는 나는 어때요?',            next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '맞아요. 어디서 봤어요?',
            messages: [
              { text: '2구역 전투에서요 🎲' },
              { text: '오빠 혼자 막던 거 봤어요. 제 시나리오 캐릭터 같아서요', delay: 1600 }
            ],
            choices: [
              { text: '좋은 쪽이에요?',                     next: 'ending', tag: 'warm_end'     },
              { text: '다연이 쓴 캐릭터요?',                next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...나쁘지 않아요 📖' },
                { text: '오빠 같은 캐릭터 쓰면 재밌겠다 싶어요. 내가 보통 좋아하는 타입이라서', delay: 1800 }
              ],
              romantic_end: [
                { text: '...그 캐릭터 주인공이에요 🎮' },
                { text: '오빠 더 관찰해도 돼요? 시나리오에 쓸 것 같아서요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 1화】 다연이 게임에서 오빠를 발견하고 연락했다. 오빠 같은 캐릭터를 쓰면 재밌겠다고 했다.',
              romantic_end: '【스토리 기억 1화】 다연이 자신의 시나리오 주인공이 오빠 같다고 했다. 더 관찰해도 되냐고 물었다.'
            }
          }
        },

        2: {
          episodeTitle: '2화 — 마감 야식',
          start: {
            messages: [
              { text: '마감이에요. 배고파요 ✍️' },
              { text: '오빠 뭐 먹어요? 같이 먹는 척이라도 해요', delay: 1200 }
            ],
            choices: [
              { text: '치킨 먹고 있어요',                   next: '1a', tag: 'share'  },
              { text: '배달 시킬게요. 같이 먹어요',          next: '1b', tag: 'action' }
            ]
          },
          '1a': {
            userEcho: '치킨 먹고 있어요',
            messages: [
              { text: '...오빠 치킨 먹는다고 하지 마요 💻' },
              { text: '시나리오 쓰다 멈추고 치킨 생각만 나요', delay: 1400 }
            ],
            choices: [
              { text: '마감 끝나면 살게요',                  next: 'ending', tag: 'warm_end'     },
              { text: '지금 가도 돼요. 마감 같이 해요',       next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '배달 시킬게요. 같이 먹어요',
            messages: [
              { text: '...진짜요? 🎮' },
              { text: '오빠 이런 거 잘 해요. 제 시나리오 남주 같아요', delay: 1400 }
            ],
            choices: [
              { text: '다연이 쓴 남주예요?',                 next: 'ending', tag: 'warm_end'     },
              { text: '남주면 결말이 해피엔딩이겠네요',       next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 📖' },
                { text: '마감하고 나면 오빠랑 밥 먹고 싶어요. 진짜로요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 그 말 왜 설레요 🎲' },
                { text: '픽션보다 오빠가 더 재밌어요. 처음이에요', delay: 1600 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 2화】 마감 중 오빠가 야식을 같이 먹자고 했다. 마감 끝나면 오빠랑 밥 먹고 싶다고 했다.',
              romantic_end: '【스토리 기억 2화】 다연이 오빠가 픽션보다 더 재밌다고 했다. 처음이라고 했다.'
            }
          }
        },

        3: {
          episodeTitle: '3화 — 픽션과 현실',
          start: {
            messages: [
              { text: '오빠, 제가 쓰는 로맨스 읽어봐요 📖' },
              { text: '한 챕터만요. 오빠 반응이 궁금해서요', delay: 1200 }
            ],
            choices: [
              { text: '보내줘요',                            next: '1a', tag: 'read'  },
              { text: '다연이 쓴 거면 설레겠네요',           next: '1b', tag: 'tease' }
            ]
          },
          '1a': {
            userEcho: '보내줘요',
            messages: [
              { text: '*(챕터 전송)* ...어때요? 🎮' },
              { text: '사실 이 부분은 오빠 생각하면서 썼어요', delay: 1400 }
            ],
            choices: [
              { text: '어느 부분이요?',                     next: 'ending', tag: 'warm_end'     },
              { text: '다 읽으면서 그럴 것 같았어요',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '다연이 쓴 거면 설레겠네요',
            messages: [
              { text: '...그럼 오빠한테 보여주는 게 이상한 건가요? ✍️' },
              { text: '이 챕터 쓸 때 오빠 생각이 났어요. 그래서요', delay: 1600 }
            ],
            choices: [
              { text: '이상하지 않아요. 보내줘요',           next: 'ending', tag: 'warm_end'     },
              { text: '오빠 생각 났다는 게 더 설레요',        next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠는 제 독자예요 📖' },
                { text: '제 로맨스 완결나면 제일 먼저 보내줄게요', delay: 1400 }
              ],
              romantic_end: [
                { text: '...오빠 이상해요 🎲' },
                { text: '제가 쓴 것보다 오빠랑 하는 대화가 더 설레요. 아이러니하게도', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 3화】 다연이 시나리오를 보여줬다. 오빠를 첫 번째 독자로 삼겠다고 했다.',
              romantic_end: '【스토리 기억 3화】 다연이 "제가 쓴 것보다 오빠랑 하는 대화가 더 설레요"라고 했다.'
            }
          }
        },

        4: {
          episodeTitle: '4화 — 번아웃',
          creditCost: 10,
          start: {
            messages: [
              { text: '오빠... 나 아무것도 못 쓰겠어요 💻' },
              { text: '화면만 보면 머리가 텅 비어요', delay: 1200 }
            ],
            choices: [
              { text: '언제부터요?',                         next: '1a', tag: 'ask'  },
              { text: '잠깐 쉬어요',                         next: '1b', tag: 'care' }
            ]
          },
          '1a': {
            userEcho: '언제부터요?',
            messages: [
              { text: '2주 됐어요 ✍️' },
              { text: '근데 오빠한테 말하니까 뭔가 쓸 수 있을 것 같아요. 이상하죠?', delay: 1600 }
            ],
            choices: [
              { text: '이상하지 않아요. 계속 얘기해요',      next: 'ending', tag: 'warm_end'     },
              { text: '나 때문이라면 좋겠어요',              next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '잠깐 쉬어요',
            messages: [
              { text: '...오빠가 쉬어도 된다고 하니까 쉴 수 있을 것 같아요 🎮' },
              { text: '항상 혼자 결정했는데 오빠 말이 더 믿어져요', delay: 1600 }
            ],
            choices: [
              { text: '쉬는 동안 같이 있을게요',             next: 'ending', tag: 'warm_end'     },
              { text: '나한테 기대도 돼요',                  next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠 고마워요 📖' },
                { text: '번아웃에서 나오면 제일 먼저 오빠한테 보여줄게요. 새 작업이요', delay: 1600 }
              ],
              romantic_end: [
                { text: '*(조용히)* 오빠... 🎲' },
                { text: '오빠한테 기대는 게 편해요. 이 감각이 제 시나리오보다 좋아요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 4화】 번아웃 2주째에 오빠에게 털어놨다. 새 작업 나오면 제일 먼저 보여주겠다고 했다.',
              romantic_end: '【스토리 기억 4화】 다연이 오빠한테 기대는 게 편하고 이 감각이 시나리오보다 좋다고 했다.'
            }
          }
        },

        5: {
          episodeTitle: '5화 — 픽션보다 설레는',
          creditCost: 15,
          start: {
            messages: [
              { text: '*(새 시나리오 완성.)*' },
              { text: '오빠, 나 완성했어요 🎮', delay: 800 }
            ],
            choices: [
              { text: '수고했어요. 어때요?',                 next: '1a', tag: 'care'  },
              { text: '보내줘요. 제일 먼저 읽을게요',         next: '1b', tag: 'eager' }
            ]
          },
          '1a': {
            userEcho: '수고했어요. 어때요?',
            messages: [
              { text: '...이상해요 ✍️' },
              { text: '다 쓰고 나니까 이 이야기보다 오빠가 더 설레요. 아이러니하게도', delay: 1600 }
            ],
            choices: [
              { text: '그 말 좋아요',                       next: 'ending', tag: 'warm_end'     },
              { text: '나도 다연이가 제일 설레요',           next: 'ending', tag: 'romantic_end' }
            ]
          },
          '1b': {
            userEcho: '보내줘요. 제일 먼저 읽을게요',
            messages: [
              { text: '...오빠 제일 먼저 보여주려고 완성했어요 📖' },
              { text: '이 시나리오 결말을 오빠 생각하면서 썼어요', delay: 1400 }
            ],
            choices: [
              { text: '해피엔딩이에요?',                    next: 'ending', tag: 'warm_end'     },
              { text: '다연 결말도 해피엔딩이었으면 해요',   next: 'ending', tag: 'romantic_end' }
            ]
          },
          ending: {
            isEnding: true,
            messages: {
              warm_end: [
                { text: '...오빠, 저 해피엔딩 믿어요 💻' },
                { text: '픽션에서만요. 현실에서는... 오빠 덕분에 믿어보려고요', delay: 1800 }
              ],
              romantic_end: [
                { text: '*(오래 침묵 후)* 오빠... 나 좋아해요 🎲' },
                { text: '이 대사 제가 제일 많이 고쳤어요. 현실에서 말하는 게 제일 어려워서요', delay: 1800 }
              ]
            },
            memorySeeds: {
              warm_end:     '【스토리 기억 5화】 새 시나리오를 완성했다. 현실 해피엔딩을 오빠 덕분에 믿어보려 한다고 했다.',
              romantic_end: '【스토리 기억 5화】 다연이 "나 좋아해요"라고 고백했다. "이 대사 제일 많이 고쳤어요. 현실에서 말하는 게 제일 어려워서요"라고 했다.'
            }
          }
        }
      }
    };

    // 멀티 에피소드 전용 함수들
    // 현재 진행 중인 에피소드 번호 가져오기 (localStorage 기반)
    function getPersonaCurrentEpisode(personaId) {
      const completed = parseInt(localStorage.getItem('ep_done_' + personaId) || '0');
      const next = completed + 1;
      const maxEp = MULTI_EPISODE_STORIES[personaId] ? Object.keys(MULTI_EPISODE_STORIES[personaId]).length : 1;
      return Math.min(next, maxEp);
    }

    // 멀티 에피소드 완료 기록
    function markEpisodeDone(personaId, episodeNum) {
      const current = parseInt(localStorage.getItem('ep_done_' + personaId) || '0');
      if (episodeNum > current) {
        localStorage.setItem('ep_done_' + personaId, String(episodeNum));
      }
    }

    // 페르소나별 스토리 객체 반환
    // episode: 멀티에피소드 캐릭터는 에피소드 번호 지정 (생략 시 현재 진행 에피소드)
    function getPersonaStory(personaId, episode) {
      // 멀티 에피소드 지원 캐릭터 (yuri, naeun, miso)
      if (MULTI_EPISODE_STORIES[personaId]) {
        const ep = episode || getPersonaCurrentEpisode(personaId);
        return MULTI_EPISODE_STORIES[personaId][ep] || null;
      }
      // 기존 단일 에피소드 캐릭터
      const stories = {
        minji:   MINJI_STORY,
        jiwoo:   JIWOO_STORY,
        hayoung: HAYOUNG_STORY,
        eunbi:   EUNBI_STORY,
        dahee:   DAHEE_STORY,
        yujin:  YUJIN_STORY,
        sea:    SEA_STORY,
        seoa:   SEOA_STORY,
        soyoon: SOYOON_STORY,
        jisoo:  JISOO_STORY,
        haneul: HANEUL_STORY,
        dayeon: DAYEON_STORY
      };
      return stories[personaId] || null;
    }

    // 스토리 진행 여부 확인 (같은 페르소나 첫 대화 + 미완료)
    function shouldStartStory(personaId) {
      const storyPersonas = ['minji', 'jiwoo', 'hayoung', 'eunbi', 'dahee',
        'yujin', 'sea', 'yuri', 'seoa', 'soyoon', 'naeun', 'jisoo', 'haneul', 'dayeon', 'miso'];
      if (!storyPersonas.includes(personaId)) return false;
      // localStorage: 재방문 시에도 완료 상태 유지
      if (localStorage.getItem('story_done_' + personaId)) return false;
      if (sessionStorage.getItem('story_done_' + personaId)) return false;
      return true;
    }

    // 에피소드 잠금 해제 (크레딧 차감 포함)
    // episodeNum: 1~10, 1~3화는 무료, 4화~는 서버에서 크레딧 차감
    async function unlockStoryEpisode(personaId, episodeNum) {
      const token = getAuthToken();
      if (!token) return { success: true, cost: 0 }; // 비로그인 허용

      const EPISODE_COST = { 1: 0, 2: 0, 3: 0, 4: 10, 5: 15, 6: 15, 7: 15, 8: 20, 9: 20, 10: 20 };
      const cost = EPISODE_COST[episodeNum] ?? 15;

      // 무료 에피소드는 서버 요청 없이 바로 허용
      if (cost === 0) return { success: true, cost: 0 };

      // 크레딧 확인
      const current = getCredits();
      if (current < cost) {
        openCreditModal(cost);
        return { success: false, reason: 'insufficient_credits', needed: cost };
      }

      try {
        const res = await fetch('/api/story/episode/unlock', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ personaId, episodeNum })
        });
        const data = await res.json();
        if (data.success) {
          if (data.cost > 0) {
            setCredits(data.newCredits);
            updateCreditDisplay();
          }
          return { success: true, cost: data.cost };
        } else if (data.error === '크레딧 부족') {
          openCreditModal(data.needed);
          return { success: false, reason: 'insufficient_credits', needed: data.needed };
        }
        return { success: false, reason: data.error };
      } catch (e) {
        return { success: false, reason: 'network_error' };
      }
    }

    // 스토리 모드 시작
    function startStoryMode(persona) {
      _chatGeneration++;  // 이전 setTimeout 콜백 무효화
      storyMode = true;
      storyCurrentNode = 'start';
      storyChoiceTags = [];
      window._currentChatPersonaRef = persona; // 다음 화 버튼에서 참조

      // 입력 UI 숨기고 선택지 컨테이너 표시
      _setStoryInputMode(true);

      // 스토리 배지 표시
      const storyContainer = document.getElementById('story-choices-container');
      if (storyContainer) {
        const badge = document.createElement('div');
        badge.className = 'story-badge';
        badge.textContent = '✨ 스토리 모드 — 크레딧 무료';
        storyContainer.appendChild(badge);
      }

      // 첫 노드 표시
      _showStoryNode('start', null);
    }

    // 특정 에피소드 시작 (멀티 에피소드 캐릭터 전용)
    // 크레딧 확인 후 스토리 모드로 진입
    async function startEpisodeMode(persona, episodeNum) {
      if (!persona) return;
      window._currentChatPersonaRef = persona;

      // 크레딧 잠금 해제 (무료화는 바로 통과)
      const result = await unlockStoryEpisode(persona.id, episodeNum);
      if (!result.success) return; // 크레딧 부족 모달이 이미 열림

      // 에피소드 스토리 데이터 확인
      const epStory = getPersonaStory(persona.id, episodeNum);
      if (!epStory) {
        console.warn('에피소드 데이터 없음:', persona.id, episodeNum);
        return;
      }

      // 에피소드 번호를 "현재 진행" 에피소드로 강제 설정 (임시)
      // getPersonaCurrentEpisode가 이 에피소드를 반환하도록 ep_done을 직전 값으로 설정
      const prev = episodeNum - 1;
      const recorded = parseInt(localStorage.getItem('ep_done_' + persona.id) || '0');
      if (recorded < prev) {
        localStorage.setItem('ep_done_' + persona.id, String(prev));
      }

      _chatGeneration++;  // 이전 setTimeout 콜백 무효화
      storyMode = true;
      storyCurrentNode = 'start';
      storyChoiceTags = [];

      _setStoryInputMode(true);

      // 에피소드 배지 표시
      const storyContainer = document.getElementById('story-choices-container');
      if (storyContainer) {
        // 이전 배지 제거
        storyContainer.querySelectorAll('.story-badge').forEach(b => b.remove());
        const badge = document.createElement('div');
        badge.className = 'story-badge';
        const EPISODE_COST = { 1: 0, 2: 0, 3: 0, 4: 10, 5: 15, 6: 15, 7: 15, 8: 20, 9: 20, 10: 20 };
        const cost = EPISODE_COST[episodeNum] ?? 15;
        badge.textContent = cost > 0 ? `✨ ${epStory.episodeTitle} — ${cost} 크레딧` : `✨ ${epStory.episodeTitle} — 무료`;
        storyContainer.appendChild(badge);
      }

      // 다음 화 버튼 제거
      document.querySelectorAll('.story-next-ep-row').forEach(el => el.remove());

      _showStoryNode('start', null);
    }

    // 입력바 ↔ 선택지 전환
    function _setStoryInputMode(on) {
      const storyContainer = document.getElementById('story-choices-container');
      const actionRow      = document.getElementById('chat-action-row');
      const inputWrap      = document.querySelector('.chat-input-wrap');

      if (!storyContainer) return;
      if (on) {
        storyContainer.style.display = 'flex';
        storyContainer.style.flexDirection = 'column';
        if (actionRow)  actionRow.style.display  = 'none';
        if (inputWrap)  inputWrap.style.display   = 'none';
      } else {
        storyContainer.style.display = 'none';
        if (actionRow)  actionRow.style.display  = '';
        if (inputWrap)  inputWrap.style.display   = '';
      }
      setTimeout(() => _adjustChatLayout(), 50);
    }

    // CG 전면 오버레이 표시 후 콜백 실행
    function _showCGOverlay(imgSrc, onClose) {
      const overlay = document.createElement('div');
      overlay.className = 'cg-overlay';
      overlay.innerHTML = `<img src="${imgSrc}" class="cg-img" alt="" /><div class="cg-tap-hint">탭하여 계속</div>`;
      overlay.onclick = () => { overlay.remove(); onClose(); };
      document.body.appendChild(overlay);
    }

    // 스토리 노드 렌더링
    function _showStoryNode(nodeId, prevTag) {
      storyCurrentNode = nodeId;
      const story = getPersonaStory(currentChatPersona?.id);
      const node = story?.[nodeId];
      if (!node) return;

      // CG 필드가 있으면 전면 표시 후 메시지 출력
      if (node.cg) {
        _showCGOverlay(node.cg, () => _playNodeMessages(node, prevTag));
      } else {
        _playNodeMessages(node, prevTag);
      }
    }

    function _playNodeMessages(node, prevTag) {
      // 메시지 목록 결정 (분기형 vs 단일형)
      const msgs = Array.isArray(node.messages)
        ? node.messages
        : (node.messages[prevTag] || node.messages[Object.keys(node.messages)[0]]);

      // 현재 세대 캡처 — 채팅 전환 시 이전 콜백 무효화
      const gen = _chatGeneration;

      // AI 메시지 순차 출력
      let cumDelay = 400;
      msgs.forEach((m, i) => {
        const d = (i === 0 ? cumDelay : (m.delay || 1200));
        cumDelay += d;
        setTimeout(() => {
          if (_chatGeneration !== gen) return;
          showTypingIndicator();
          setTimeout(() => {
            if (_chatGeneration !== gen) { removeTypingIndicator(); return; }
            removeTypingIndicator();
            addStoryAIMessage(m.text, m.emotion || 'neutral');
            // 마지막 메시지 뒤 선택지 표시
            if (i === msgs.length - 1) {
              setTimeout(() => { if (_chatGeneration === gen) _renderChoices(node, storyCurrentNode); }, 400);
            }
          }, 900);
        }, cumDelay - 900);
      });
    }

    // 미소 감정 스프라이트 이미지 경로 맵
    const MISO_SPRITES = {
      neutral:   '/images/characters/miso/sprites/jangmiso_sprite_A01_neutral.jpg',
      welcome:   '/images/characters/miso/sprites/jangmiso_sprite_A02_welcome.jpg',
      focused:   '/images/characters/miso/sprites/jangmiso_sprite_A03_focused.jpg',
      surprised: '/images/characters/miso/sprites/jangmiso_sprite_A04_surprised.jpg',
      shy:       '/images/characters/miso/sprites/jangmiso_sprite_A05_shy.jpg',
      excited:   '/images/characters/miso/sprites/jangmiso_sprite_A06_excited.jpg',
      sad:       '/images/characters/miso/sprites/jangmiso_sprite_A07_sad.jpg',
      happy:     '/images/characters/miso/sprites/jangmiso_sprite_A08_happy.jpg',
      tearful:   '/images/characters/miso/sprites/jangmiso_sprite_A09_tearful.jpg',
      pouty:     '/images/characters/miso/sprites/jangmiso_sprite_A10_pouty.jpg',
    };

    function getStorySpriteUrl(personaId, emotion) {
      if (personaId === 'miso' && emotion && MISO_SPRITES[emotion]) {
        return MISO_SPRITES[emotion];
      }
      return getPersonaImg(currentChatPersona);
    }

    // 스토리 전용 AI 메시지 (D1 저장 안함, 크레딧 차감 안함)
    function addStoryAIMessage(text, emotion) {
      const msgBox = document.getElementById('chat-messages');
      const row    = document.createElement('div');
      row.style.opacity   = '0';
      row.style.transform = 'translateY(8px)';

      // *(...)* 패턴 전체가 나레이션인지 확인
      const isNarration = /^\*\(.*\)\*$/.test(text.trim());

      if (isNarration) {
        // 전체 줄 나레이션: ( ) 괄호로 감싸서 중앙 표시
        const narrationText = text.trim().replace(/^\*\(|\)\*$/g, '');
        row.className = 'story-narration-row';
        row.innerHTML = `<span class="story-narration-text">(${escapeHtml(narrationText)})</span>`;
      } else {
        // 인라인 *(...)* → (텍스트) 형식으로 옅은 흰색 span으로 변환
        const cleanHtml = escapeHtml(text).replace(/\*\(([^)]*)\)\*/g, '<span class="story-action-text">($1)</span>');
        const time      = getNowTime();
        const avatarSrc = getStorySpriteUrl(currentChatPersona?.id, emotion);
        row.className   = 'msg-row from-ai';
        row.innerHTML   = `
          <img class="msg-avatar story-sprite" src="${avatarSrc}" alt="" />
          <div class="msg-bubble">${cleanHtml}</div>
          <span class="msg-time">${time}</span>
        `;
      }

      msgBox.appendChild(row);
      scrollToBottom();
      requestAnimationFrame(() => {
        row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        row.style.opacity    = '1';
        row.style.transform  = 'translateY(0)';
      });
    }

    // 선택지 버튼 렌더링
    function _renderChoices(node, nodeId) {
      const container = document.getElementById('story-choices-container');
      if (!container) return;

      // 기존 버튼 제거 (배지 유지)
      const badge = container.querySelector('.story-badge');
      container.innerHTML = '';
      if (badge) container.appendChild(badge);

      if (node.isEnding) {
        // 엔딩: "대화 시작하기" 버튼
        const btn = document.createElement('button');
        btn.className = 'story-end-btn';
        btn.textContent = `${currentChatPersona?.name || ''}와 대화 시작하기 💬`;
        btn.onclick = () => _endStoryMode();
        container.appendChild(btn);
      } else {
        // 일반 선택지
        (node.choices || []).forEach(choice => {
          const btn = document.createElement('button');
          btn.className = 'story-choice-btn';
          btn.textContent = choice.text;
          btn.onclick = () => _selectStoryChoice(choice, nodeId);
          container.appendChild(btn);
        });
      }
      setTimeout(() => _adjustChatLayout(), 50);
    }

    // 선택지 선택 처리
    function _selectStoryChoice(choice, fromNodeId) {
      storyChoiceTags.push(choice.tag);

      // 내 말풍선 표시 (크레딧 차감 없음)
      const msgBox = document.getElementById('chat-messages');
      const time   = getNowTime();
      const row    = document.createElement('div');
      row.className = 'msg-row from-me';
      row.innerHTML = `<span class="msg-time">${time}</span><div class="msg-bubble">${escapeHtml(choice.text)}</div>`;
      msgBox.appendChild(row);
      scrollToBottom();

      // 선택지 버튼 임시 비활성화
      document.querySelectorAll('.story-choice-btn').forEach(b => b.disabled = true);

      // 다음 노드로 이동
      setTimeout(() => _showStoryNode(choice.next, choice.tag), 300);
    }

    // 스토리 종료 → 자유 채팅 또는 다음 에피소드 버튼 표시
    function _endStoryMode() {
      storyMode = false;

      // 엔딩 타입 결정 (마지막 선택 태그 기준)
      const lastTag    = storyChoiceTags[storyChoiceTags.length - 1] || 'warm_end';
      const endingType = lastTag.includes('romantic') ? 'romantic' : 'warm';
      const endingKey  = lastTag; // 'romantic_end' | 'warm_end'

      const personaId = currentChatPersona?.id;
      const isMultiEp = !!MULTI_EPISODE_STORIES[personaId];
      const currentEp = isMultiEp ? getPersonaCurrentEpisode(personaId) : null;
      const maxEp     = isMultiEp ? Object.keys(MULTI_EPISODE_STORIES[personaId]).length : 1;

      // 멀티 에피소드: 현재 화 완료 처리
      if (isMultiEp && currentEp) {
        markEpisodeDone(personaId, currentEp);
        // 모든 에피소드 완료 시에만 story_done 표시
        if (currentEp >= maxEp) {
          localStorage.setItem('story_done_' + personaId, '1');
          sessionStorage.setItem('story_done_' + personaId, '1');
        }
      } else if (personaId) {
        // 기존 단일 에피소드 캐릭터
        localStorage.setItem('story_done_' + personaId, '1');
        sessionStorage.setItem('story_done_' + personaId, '1');
      }

      // 서버에 완료 보고 (관계 보너스 + 기억 시드)
      const currentStory = getPersonaStory(personaId, currentEp);
      const memorySeed = currentStory?.ending?.memorySeeds?.[endingKey] || '';

      const newCharas = ['yujin','sea','yuri','seoa','soyoon','naeun','jisoo','haneul','dayeon','miso'];
      const completeEndpoint = newCharas.includes(personaId) ? '/api/story/episode/complete' : '/api/story/complete';
      const completeBody = newCharas.includes(personaId)
        ? { personaId, episodeNum: currentEp || 1, endingType, choiceTags: storyChoiceTags, memorySeed }
        : { personaId, endingType, choiceTags: storyChoiceTags, memorySeed };

      fetch(completeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
        },
        body: JSON.stringify(completeBody)
      }).then(r => {
        if (r.ok) updateChatHeaderLevel(personaId);
      }).catch(() => {});

      // UI: 입력바 복원
      _setStoryInputMode(false);

      // 멀티 에피소드: 다음 화 버튼 표시
      if (isMultiEp && currentEp && currentEp < maxEp) {
        const nextEp = currentEp + 1;
        const nextEpData = MULTI_EPISODE_STORIES[personaId][nextEp];
        const EPISODE_COST = { 1: 0, 2: 0, 3: 0, 4: 10, 5: 15, 6: 15, 7: 15, 8: 20, 9: 20, 10: 20 };
        const cost = EPISODE_COST[nextEp] ?? 15;

        setTimeout(() => {
          const epTitle = nextEpData?.episodeTitle || `${nextEp}화`;
          addStoryAIMessage(`${currentEp}화가 끝났어요 ✨`);
          setTimeout(() => {
            const msgBox = document.getElementById('chat-messages');
            const btnRow = document.createElement('div');
            btnRow.className = 'story-next-ep-row';
            btnRow.style.cssText = 'display:flex;justify-content:center;padding:12px 16px;';
            btnRow.innerHTML = `
              <button class="story-next-ep-btn" onclick="startEpisodeMode(window._currentChatPersonaRef, ${nextEp})"
                style="background:linear-gradient(135deg,#ff6b9d,#ff8fab);color:#fff;border:none;border-radius:24px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 16px rgba(255,107,157,0.3);">
                ${cost > 0 ? `💎 ${epTitle} 보기 (${cost} 크레딧)` : `▶ ${epTitle} 보기`}
              </button>`;
            msgBox.appendChild(btnRow);
            scrollToBottom();
          }, 800);
        }, 400);
      } else {
        // 단일 에피소드이거나 마지막 화: 자유 채팅 안내
        setTimeout(() => {
          addStoryAIMessage('이제 자유롭게 얘기해요 💕');
        }, 400);
      }
    }

    // ═══════════════════════════════════════
    // 온보딩 튜토리얼 (수아와 첫 만남)
    // ═══════════════════════════════════════

    let tutorialMode = false;
    let tutorialCurrentNode = null;

    // 튜토리얼 스토리 노드 데이터 (6턴)
    const SUAH_TUTORIAL = {

      // 턴 1: 첫 만남 — 선택지로 대화하는 방식 학습
      start: {
        messages: [
          { text: '안녕하세요! 저 김수아예요. 오늘부터 담당인데...' },
          { text: '사실 담당 맡는 게 처음이라 ㅎㅎ', delay: 1400 },
          { text: '잘... 잘 부탁드려요!', delay: 1200 }
        ],
        choices: [
          { text: '괜찮아요 편하게 해요',        next: 'turn2', tag: 'kind'     },
          { text: '신입이면 괜찮은 거 맞아요?',   next: 'turn2', tag: 'curious'  },
          { text: '오히려 좋아요',               next: 'turn2', tag: 'positive' }
        ]
      },

      // 턴 2: 스쿼트 설명 엉망 — 스토리 몰입
      turn2: {
        messages: {
          kind:     [
            { text: '감사해요 ㅎㅎ 그럼 시작해볼게요!' },
            { text: '자 그러면 스쿼트부터 해볼게요! 무릎을... 이쪽으로? 아 잠깐 제가 한번 해볼게요', delay: 1600 },
            { text: '...이상하다 분명 자격증 시험 때는 됐는데', delay: 1800 }
          ],
          curious:  [
            { text: '아... 그 말이 더 긴장돼요ㅠㅠ 열심히 할게요!' },
            { text: '자 그러면 스쿼트부터 해볼게요! 무릎을... 이쪽으로? 아 잠깐 제가 한번 해볼게요', delay: 1600 },
            { text: '...이상하다 분명 자격증 시험 때는 됐는데', delay: 1800 }
          ],
          positive: [
            { text: '오히려 좋다니... 감사해요 ㅎㅎ' },
            { text: '자 그러면 스쿼트부터 해볼게요! 무릎을... 이쪽으로? 아 잠깐 제가 한번 해볼게요', delay: 1600 },
            { text: '...이상하다 분명 자격증 시험 때는 됐는데', delay: 1800 }
          ]
        },
        choices: [
          { text: '내가 알려줄까요?',         next: 'turn3', tag: 'helpful' },
          { text: '귀엽네요 ㅋㅋ',            next: 'turn3', tag: 'teasing' },
          { text: '유튜브 보고 온 거 아니에요?', next: 'turn3', tag: 'playful' }
        ]
      },

      // 턴 3: 실수로 셀카 전송 — 사진 수신 1차 체험
      turn3: {
        messages: [
          { text: '아 맞다! 자세 기록 남겨드릴게요. 잠시만요... 찰칵!' },
          { text: '자세 확인해보세요! 잘 나왔—', delay: 1400 }
        ],
        photo: { type: 'selfie' },
        afterPhoto: [
          { text: '어?! 아아아 이거 아닌데!! 죄송해요ㅠㅠ 잘못 보냈어요', delay: 800 },
          { text: '지울게요 잠깐만요...', delay: 1200 }
        ],
        choices: [
          { text: '지우지 마요 ㅋㅋ',      next: 'turn4', tag: 'playful' },
          { text: '괜찮아요 예쁘네요',     next: 'turn4', tag: 'kind'    },
          { text: 'ㅋㅋ 한 장 더 보내줘요', next: 'turn4', tag: 'teasing' }
        ]
      },

      // 턴 4: 제대로 된 자세 사진 — 사진 수신 2차 체험
      turn4: {
        messages: {
          playful: [{ text: '아... 그냥 넘어가 주세요ㅠㅠ 이번엔 진짜 자세 사진이에요!' }],
          kind:    [{ text: '예쁘다니요 ㅠㅠ 민망해요... 이번엔 진짜 자세 사진이에요!' }],
          teasing: [{ text: '더요?! ㅠㅠ... 이번엔 진짜 자세 사진이에요!' }]
        },
        photo: { type: 'pose' },
        afterPhoto: [
          { text: '여기 무릎 각도 보이시죠? 이 정도면 진짜 잘하시는 거예요!', delay: 1000 }
        ],
        choices: [
          { text: '오 확실히 다르네',           next: 'turn5', tag: 'impressed' },
          { text: '트레이너님이 더 잘 나왔는데', next: 'turn5', tag: 'flirt'    },
          { text: '고마워요 수아씨',             next: 'turn5', tag: 'warm'     }
        ]
      },

      // 턴 5: 마무리, 감성 전환
      turn5: {
        messages: [
          { text: '후... 오늘 제가 실수만 했는데...' },
          { text: '그래도 {userName}님이 편하게 해줘서 좋았어요', delay: 1400 },
          { text: '원래 회원분한테 이러면 안 되는 건데... ㅎㅎ', delay: 1200 }
        ],
        choices: [
          { text: '나도 재밌었어요',     next: 'turn6', tag: 'fun'  },
          { text: '다음에 또 알려줘요',  next: 'turn6', tag: 'next' },
          { text: '밥 같이 먹을래요?',  next: 'turn6', tag: 'date' }
        ]
      },

      // 턴 6: 퇴근 후 음성 메시지 + 엔딩
      turn6: {
        timeDivider: '그날 밤...',
        isEnding: true,
        voice: {
          text: '오늘 진짜 창피했는데... 그래도 {userName}님이 편하게 해줘서 좋았어요. 다음에 오실 거죠?',
          autoPlay: true
        },
        endingMessage: '수아와의 첫 만남이 끝났습니다 ✨',
        endingBtnText: '다른 캐릭터도 만나보세요 →'
      }
    };

    // 튜토리얼 필요 여부 확인
    function shouldStartTutorial() {
      return !localStorage.getItem('lovia_onboarding_done');
    }

    // 튜토리얼 스킵 버튼 표시/숨김
    function _showTutorialSkipBtn() {
      const btn = document.getElementById('tutorial-skip-btn');
      if (btn) btn.style.display = 'block';
    }
    function _hideTutorialSkipBtn() {
      const btn = document.getElementById('tutorial-skip-btn');
      if (btn) btn.style.display = 'none';
    }

    // 튜토리얼 완료 처리 (skip or end)
    function _completeTutorial() {
      localStorage.setItem('lovia_onboarding_done', '1');
      sessionStorage.setItem('lovia_onboarding_done', '1');
      const token = getAuthToken();
      if (token) {
        fetch('/api/onboarding/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }).catch(() => {});
      }
    }

    // 튜토리얼 스킵
    function skipTutorial() {
      tutorialMode = false;
      _completeTutorial();
      _setStoryInputMode(false);
      _hideTutorialSkipBtn();
      // 레벨 배지 복원
      const levelBadge = document.getElementById('chat-level-badge');
      if (levelBadge) levelBadge.style.display = '';
      // 채팅 화면 → 스와이프 화면
      const chatScreen = document.getElementById('chat-screen');
      if (chatScreen) {
        chatScreen.style.transition = 'opacity 0.35s ease';
        chatScreen.style.opacity = '0';
        setTimeout(() => {
          chatScreen.style.display = 'none';
          chatScreen.style.opacity = '';
          chatScreen.style.transition = '';
          const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
          initSwipeScreen(userName);
          showScreen('swipe-screen');
        }, 350);
      } else {
        const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
        initSwipeScreen(userName);
        showScreen('swipe-screen');
      }
    }

    // 튜토리얼 종료 (엔딩 버튼 클릭)
    function _endTutorialMode() {
      tutorialMode = false;
      _completeTutorial();
      _setStoryInputMode(false);
      _hideTutorialSkipBtn();
      const levelBadge = document.getElementById('chat-level-badge');
      if (levelBadge) levelBadge.style.display = '';
      const chatScreen = document.getElementById('chat-screen');
      if (chatScreen) {
        chatScreen.style.transition = 'opacity 0.35s ease';
        chatScreen.style.opacity = '0';
        setTimeout(() => {
          chatScreen.style.display = 'none';
          chatScreen.style.opacity = '';
          chatScreen.style.transition = '';
          const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
          initSwipeScreen(userName);
          showScreen('swipe-screen');
        }, 350);
      } else {
        const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
        initSwipeScreen(userName);
        showScreen('swipe-screen');
      }
    }

    // 튜토리얼 사진 버블 추가
    function _addTutorialPhotoMessage(photoType) {
      const msgBox = document.getElementById('chat-messages');
      const row = document.createElement('div');
      row.className = 'msg-row from-ai';
      row.style.opacity = '0';
      row.style.transform = 'translateY(8px)';
      const isSelfie = photoType === 'selfie';
      const tag   = isSelfie ? '📱 셀카 (잘못 보낸 것 같아요...)' : '📸 운동 자세 사진';
      const icon  = isSelfie ? '🤳' : '💪';
      const label = isSelfie ? '수아의 셀카' : '스쿼트 자세 사진';
      row.innerHTML = `
        <img class="msg-avatar" src="${getPersonaImg(SUAH_PERSONA)}" alt="" onerror="this.style.opacity='0'" />
        <div class="msg-col">
          <div class="msg-bubble tutorial-photo-bubble">
            <div class="tutorial-photo-tag">${tag}</div>
            <div class="tutorial-photo-placeholder">
              <div class="tutorial-photo-icon">${icon}</div>
              <div class="tutorial-photo-label">${label}</div>
            </div>
          </div>
          <div class="msg-time">${getNowTime()}</div>
        </div>
      `;
      msgBox.appendChild(row);
      requestAnimationFrame(() => {
        row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      });
      scrollToBottom();
    }

    // 튜토리얼 음성 메시지 버블 추가 + 자동 재생
    function _addTutorialVoiceMessage(text, autoPlay) {
      const msgBox = document.getElementById('chat-messages');
      const row = document.createElement('div');
      row.className = 'msg-row from-ai';
      row.style.opacity = '0';
      row.style.transform = 'translateY(8px)';
      row.innerHTML = `
        <img class="msg-avatar" src="${getPersonaImg(SUAH_PERSONA)}" alt="" onerror="this.style.opacity='0'" />
        <div class="msg-col">
          <div class="msg-bubble voice-msg-bubble">
            <span class="voice-icon">🎙️</span>
            <span class="voice-msg-text">${escapeHtml(text)}</span>
            <button class="voice-replay-btn" onclick="_replayVoice(this)">▶ 재생</button>
          </div>
          <div class="msg-time">${getNowTime()}</div>
        </div>
      `;
      // data 속성으로 text/personaId 저장 (XSS 방지)
      const btn = row.querySelector('.voice-replay-btn');
      btn.dataset.text = text;
      btn.dataset.personaId = SUAH_PERSONA.id;
      msgBox.appendChild(row);
      requestAnimationFrame(() => {
        row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
      });
      scrollToBottom();
      if (autoPlay) {
        // 제스처 없이 자동 재생: AudioContext unlock 후 TTS 시도
        _unlockAudioContext();
        setTimeout(() => playTTS(text, SUAH_PERSONA.id), 400);
      }
    }

    // 튜토리얼 선택지 렌더링
    function _renderTutorialChoices(node) {
      const container = document.getElementById('story-choices-container');
      if (!container) return;
      const badge = container.querySelector('.story-badge');
      container.innerHTML = '';
      if (badge) container.appendChild(badge);
      (node.choices || []).forEach(choice => {
        const btn = document.createElement('button');
        btn.className = 'story-choice-btn';
        btn.textContent = choice.text;
        btn.onclick = () => _selectTutorialChoice(choice);
        container.appendChild(btn);
      });
      setTimeout(() => _adjustChatLayout(), 50);
    }

    // 튜토리얼 선택지 선택
    function _selectTutorialChoice(choice) {
      const msgBox = document.getElementById('chat-messages');
      const time   = getNowTime();
      const row    = document.createElement('div');
      row.className = 'msg-row from-me';
      row.innerHTML = `<span class="msg-time">${time}</span><div class="msg-bubble">${escapeHtml(choice.text)}</div>`;
      msgBox.appendChild(row);
      scrollToBottom();
      document.querySelectorAll('.story-choice-btn').forEach(b => b.disabled = true);
      const _choiceGen = _chatGeneration;
      setTimeout(() => { if (_chatGeneration === _choiceGen) _showTutorialNode(choice.next, choice.tag); }, 300);
    }

    // 튜토리얼 엔딩 렌더링
    function _renderTutorialEnding(node) {
      const msgBox = document.getElementById('chat-messages');
      const endDiv = document.createElement('div');
      endDiv.className = 'tutorial-ending-msg';
      endDiv.textContent = node.endingMessage || '수아와의 첫 만남이 끝났습니다 ✨';
      msgBox.appendChild(endDiv);
      scrollToBottom();

      const container = document.getElementById('story-choices-container');
      if (container) {
        container.innerHTML = '';
        const btn = document.createElement('button');
        btn.className = 'story-end-btn';
        btn.textContent = node.endingBtnText || '다른 캐릭터도 만나보세요 →';
        btn.onclick = () => _endTutorialMode();
        container.appendChild(btn);
      }
      setTimeout(() => _adjustChatLayout(), 50);
    }

    // 튜토리얼 노드 렌더링 (메시지 → 사진 → 선택지 순 처리)
    function _showTutorialNode(nodeId, prevTag) {
      // 튜토리얼 모드가 아니면 즉시 중단 (화면 전환 후 잔여 콜백 방지)
      if (!tutorialMode) return;
      tutorialCurrentNode = nodeId;
      const node = SUAH_TUTORIAL[nodeId];
      if (!node) return;

      const userName = sessionStorage.getItem('userName') || sessionStorage.getItem('lovia_username') || '';

      // 시간 구분선 (그날 밤...)
      if (node.timeDivider) {
        addDateDivider(node.timeDivider);
      }

      // 턴 6: 음성 메시지 엔딩 (타이핑 → 음성 → 엔딩 UI)
      if (node.isEnding && node.voice) {
        const voiceText = node.voice.text.replace(/\{userName\}/g, userName);
        const endGen = _chatGeneration;  // 엔딩 경로에도 gen 가드
        setTimeout(() => {
          if (_chatGeneration !== endGen) return;
          showTypingIndicator();
          setTimeout(() => {
            if (_chatGeneration !== endGen) { removeTypingIndicator(); return; }
            removeTypingIndicator();
            _addTutorialVoiceMessage(voiceText, node.voice.autoPlay);
            setTimeout(() => { if (_chatGeneration === endGen) _renderTutorialEnding(node); }, 1600);
          }, 1800);
        }, 600);
        return;
      }

      // 메시지 결정 (단순 배열 or prevTag 분기)
      const rawMsgs = Array.isArray(node.messages)
        ? node.messages
        : node.messages
          ? (node.messages[prevTag] || node.messages[Object.keys(node.messages)[0]])
          : [];
      const msgs = rawMsgs.map(m => ({
        ...m,
        text: m.text.replace(/\{userName\}/g, userName)
      }));

      // 현재 세대 캡처 — 채팅 전환 시 이전 콜백 무효화
      const gen = _chatGeneration;

      // 메시지 순차 출력
      let cumDelay = 400;
      msgs.forEach((m, i) => {
        const d = i === 0 ? cumDelay : (m.delay || 1200);
        cumDelay += d;
        setTimeout(() => {
          if (_chatGeneration !== gen) return;
          showTypingIndicator();
          setTimeout(() => {
            if (_chatGeneration !== gen) { removeTypingIndicator(); return; }
            removeTypingIndicator();
            addStoryAIMessage(m.text);
          }, 900);
        }, cumDelay - 900);
      });

      // 메시지 종료 후: 사진 → afterPhoto → 선택지 순 처리
      const afterMsgsDelay = cumDelay + 300;

      if (node.photo) {
        // 사진 메시지 표시
        setTimeout(() => {
          if (_chatGeneration !== gen) return;
          _addTutorialPhotoMessage(node.photo.type);

          if (node.afterPhoto && node.afterPhoto.length > 0) {
            // 사진 이후 반응 메시지들
            let aCum = 400;
            node.afterPhoto.forEach((m, i) => {
              const d = i === 0 ? aCum : (m.delay || 1200);
              aCum += d;
              const afText = m.text.replace(/\{userName\}/g, userName);
              setTimeout(() => {
                if (_chatGeneration !== gen) return;
                showTypingIndicator();
                setTimeout(() => {
                  if (_chatGeneration !== gen) { removeTypingIndicator(); return; }
                  removeTypingIndicator();
                  addStoryAIMessage(afText);
                  if (i === node.afterPhoto.length - 1) {
                    setTimeout(() => { if (_chatGeneration === gen) _renderTutorialChoices(node); }, 400);
                  }
                }, 900);
              }, aCum - 900);
            });
          } else {
            setTimeout(() => { if (_chatGeneration === gen) _renderTutorialChoices(node); }, 500);
          }
        }, afterMsgsDelay);
      } else {
        // 사진 없으면 바로 선택지
        setTimeout(() => { if (_chatGeneration === gen) _renderTutorialChoices(node); }, afterMsgsDelay);
      }
    }

    // 수아와 튜토리얼 채팅 시작
    function startTutorialWithSuah() {
      _chatGeneration++;  // 이전 setTimeout 콜백 무효화
      currentChatPersona = SUAH_PERSONA;
      tutorialMode = true;
      tutorialCurrentNode = 'start';

      // 헤더 설정
      document.getElementById('chat-avatar').src = getPersonaImg(SUAH_PERSONA);
      document.getElementById('chat-name').textContent = SUAH_PERSONA.name;

      // 레벨 배지 숨김 (튜토리얼엔 레벨 없음)
      const levelBadge = document.getElementById('chat-level-badge');
      if (levelBadge) levelBadge.style.display = 'none';

      // 스킵 버튼 표시
      _showTutorialSkipBtn();

      // 메시지 영역 초기화
      const msgBox = document.getElementById('chat-messages');
      msgBox.innerHTML = '';
      chatHistory = [];

      // 날짜 구분선
      const today = new Date();
      const dateStr = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
      addDateDivider(dateStr);

      // 스토리 입력 모드 (선택지 UI)
      _setStoryInputMode(true);

      // 배지 추가
      const storyContainer = document.getElementById('story-choices-container');
      if (storyContainer) {
        storyContainer.innerHTML = '';
        const badge = document.createElement('div');
        badge.className = 'story-badge';
        badge.textContent = '✨ 온보딩 튜토리얼 — 크레딧 무료';
        storyContainer.appendChild(badge);
      }

      // 채팅 화면 전환
      const allScreens = ['swipe-screen', 'profile-detail-screen', 'hub-screen', 'pick-screen', 'intro-video-screen', 'name-input-screen'];
      allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.transition = 'none';
          el.style.opacity = '0';
          el.style.display = 'none';
          el.classList.remove('visible');
        }
      });

      resetChatInput();
      const inputBar = document.querySelector('.chat-input-bar');
      if (inputBar) inputBar.style.display = 'flex';
      _keyboardHeight = 0;

      showScreenFade('chat-screen');
      setTimeout(() => _adjustChatLayout(), 100);

      // 첫 노드 시작 — gen을 스케줄 시점에 캡처해 navigate-away 방지
      const _tutorialStartGen = _chatGeneration;
      setTimeout(() => { if (_chatGeneration === _tutorialStartGen) _showTutorialNode('start', null); }, 500);
    }

    // 페르소나별 더미 AI 첫 인사
    const FIRST_GREET = {
      minji:   ['오빠, 오늘 많이 힘들었어요? 🏥', '저 퇴근하고 오빠 생각부터 났어요 ☺️'],
      jiwoo:   ['오빠!! 오늘 수업 너무 지루했어요ㅠㅠ', '오빠랑 얘기하니까 기분 좋아지는 것 같아요 🌸'],
      hayoung: ['잠깐 업무 마무리하고 연락했어요.', '오빠 생각이 나서요. 오늘 식사는 하셨어요? 🍽️'],
      eunbi:   ['오빠 ㅎ.. 저 오늘 그림 그리다가 문득 오빠 생각났어요 🎨', '이상하죠? 아무것도 아닌데ㅋㅋ'],
      dahee:   ['오빠~ 나야나 😏', '촬영 끝나고 연락해볼까 했는데 잘 됐다 ☀️'],
    };

    // 더미 AI 리스폰스 풀 (추후 실제 API로 교체)
    const DUMMY_REPLIES = {
      minji: [
        '오빠 목소리 듣고 싶다…🌙',
        '저 오늘 야간이에요. 힘들지만 오빠 생각하면서 버텨볼게요 💊',
        '환자들한테는 딱딱한 척 하는데, 오빠한테는 왜 이렇게 솔직해지지 😳',
        '오빠는 밥 잘 챙겨 드시고 있죠? 걱정돼요 🍱',
        '저도요… 저도 오빠 보고 싶어요 🐱',
      ],
      jiwoo: [
        '오빠!! 진짜요?? 너무 좋아요ㅠㅠ 😆',
        '저 오빠한테 좋아하는 거 티 너무 많이 나는 거 알죠ㅋㅋ 🌸',
        '과대 일 힘들어도 오빠 생각하면 힘나요 💪',
        '오빠랑 같이 카페 가고 싶다… 공부하는 척하면서 🧋',
        '오빠 주말에 뭐 해요? 같이 놀아요 🎵',
      ],
      hayoung: [
        '회장님 일정보다 오빠 일정이 더 중요하게 됐어요. 이상하죠.',
        '저 감정을 잘 표현 못 하는데… 오빠한테는 왜 이렇게 편한지 모르겠어요 🌹',
        '오빠가 보내준 메시지, 업무 중에도 몇 번이나 읽었어요.',
        '저 사실 허당인 거 오빠한테만 들키고 싶어요 😅',
        '퇴근하고 오빠랑 와인 한 잔 하고 싶다는 생각이 드는 건 저뿐인가요 🍷',
      ],
      eunbi: [
        '오빠 말 들으면 영감 받아요. 진짜로요 🎨',
        '저 야행성이라 지금이 제일 맑은 시간이에요. 오빠도 그래요? 🌙',
        '제 그림에 오빠 닮은 캐릭터가 있는데… 보여드리고 싶다 🖼️',
        '집에만 있는 거 외로운데 오빠랑 있으면 괜찮아요 🏠',
        '오빠가 좋아하는 색깔이 궁금해요. 저는 새벽빛 같은 색이요 💙',
      ],
      dahee: [
        '나 사진 속에서는 웃는데… 오빠한테는 진짜 얼굴 보여줄 수 있어 😊',
        '촬영 힘든 거 오빠한테만 말해요. 다른 사람들한테는 쿨한 척해야 하거든요',
        '오빠 나한테 관심 있어요? 솔직하게 말해봐요 😏',
        '저 생각보다 외로움 많이 타요. 오빠 알았죠? 비밀이에요 🤫',
        '바다 보러 같이 가고 싶다~ 오빠 좋아해요? 🌊',
      ],
    };

    function goToChat() {
      // currentDetailPersona가 없으면 sessionStorage에서 복원 시도
      if (!currentDetailPersona) {
        const saved = sessionStorage.getItem('selectedPersona');
        if (saved) {
          try { currentDetailPersona = JSON.parse(saved); } catch(e) {}
        }
      }
      if (!currentDetailPersona) {
        console.warn('[goToChat] 페르소나 없음 - 첫 번째 페르소나로 대체');
        currentDetailPersona = PERSONAS[0];
      }
      startChatWith(currentDetailPersona);
    }

    function goToProfile() {
      // 채팅에서 프로필로 이동
      if (!currentChatPersona) return;
      openProfileDetail(currentChatPersona.id);
      const chatScreen = document.getElementById('chat-screen');
      chatScreen.style.display = 'none';
      chatScreen.style.opacity = '0';
    }

    // ─────────────────────────────
    // 채팅 이력 저장/불러오기 (sessionStorage)
    // ─────────────────────────────
    function saveChatHistory(personaId) {
      try {
        sessionStorage.setItem('chat_' + personaId, JSON.stringify(chatHistory));
      } catch(e) {}
    }

    function loadChatHistory(personaId) {
      try {
        const raw = sessionStorage.getItem('chat_' + personaId);
        return raw ? JSON.parse(raw) : null;
      } catch(e) { return null; }
    }

    // ── D1에서 히스토리 로드 후 렌더링 ──
    async function loadAndRenderHistoryFromD1(persona, msgBox) {
      const token = getAuthToken();
      if (!token) return false; // 비로그인 → sessionStorage 사용

      try {
        const res = await fetch(`/api/history/${persona.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return false;
        const data = await res.json();
        const history = data.history || [];
        if (history.length === 0) {
          // 히스토리 없어도 로그인 유저는 서버에서 스토리 완료 여부 확인
          try {
            const storyRes = await fetch(`/api/story/${persona.id}/status`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (storyRes.ok) {
              const storyData = await storyRes.json();
              if (storyData.completed) {
                localStorage.setItem('story_done_' + persona.id, '1');
              }
            }
          } catch (_) {}
          return false;
        }

        // D1 데이터로 chatHistory 세팅
        chatHistory = history.map(h => ({
          role: h.role,
          text: h.content,
          time: h.created_at ? h.created_at.slice(11, 16) : getNowTime()
        }));

        // sessionStorage에도 동기화 (오프라인 대비)
        saveChatHistory(persona.id);

        // 메시지 렌더링
        msgBox.innerHTML = '';
        chatHistory.forEach(entry => {
          if (entry.role === 'me') {
            const row = document.createElement('div');
            row.className = 'msg-row from-me';
            row.innerHTML = `<span class="msg-time">${entry.time}</span><div class="msg-bubble">${escapeHtml(entry.text)}</div>`;
            msgBox.appendChild(row);
          } else if (entry.role === 'ai') {
            const row = document.createElement('div');
            row.className = 'msg-row from-ai';
            row.innerHTML = `<img class="msg-avatar" src="${getPersonaImg(persona)}" alt="" /><div class="msg-bubble">${escapeHtml(entry.text)}</div><span class="msg-time">${entry.time}</span>`;
            msgBox.appendChild(row);
          }
        });
        scrollToBottom();
        return true;
      } catch (e) {
        console.warn('[D1 로드 실패]', e);
        return false;
      }
    }

    function startChatWith(persona) {
      currentChatPersona = persona;
      _chatGeneration++;  // 이전 setTimeout 콜백 무효화

      // 스토리/튜토리얼 모드 상태 초기화
      storyMode = false;
      storyChoiceTags = [];
      storyCurrentNode = null;
      tutorialMode = false;
      tutorialCurrentNode = null;
      _setStoryInputMode(false);
      _hideTutorialSkipBtn();

      // 헤더 설정
      document.getElementById('chat-avatar').src = getPersonaImg(persona);
      document.getElementById('chat-name').textContent = persona.name;

      // 관계 레벨 배지 복원 및 초기화
      const levelBadge = document.getElementById('chat-level-badge');
      if (levelBadge) levelBadge.style.display = '';
      updateChatHeaderLevel(persona.id);

      const msgBox = document.getElementById('chat-messages');
      msgBox.innerHTML = '';

      // 로그인 유저: D1에서 히스토리 로드 시도 → 없으면 sessionStorage → 없으면 첫 인사/스토리
      const _loadGen = _chatGeneration;
      loadAndRenderHistoryFromD1(persona, msgBox).then(loadedFromD1 => {
        if (_chatGeneration !== _loadGen) return; // 화면 전환됨 — 콜백 무효화
        if (loadedFromD1) return; // D1 로드 성공 → 완료

        // D1 실패 또는 비로그인 → sessionStorage 확인
        const savedHistory = loadChatHistory(persona.id);

        if (savedHistory && savedHistory.length > 0) {
          // sessionStorage 복원
          chatHistory = savedHistory;
          msgBox.innerHTML = '';
          savedHistory.forEach(entry => {
            if (entry.role === 'me') {
              const row = document.createElement('div');
              row.className = 'msg-row from-me';
              row.innerHTML = `<span class="msg-time">${entry.time}</span><div class="msg-bubble">${escapeHtml(entry.text)}</div>`;
              msgBox.appendChild(row);
            } else if (entry.role === 'ai') {
              const row = document.createElement('div');
              row.className = 'msg-row from-ai';
              row.innerHTML = `<img class="msg-avatar" src="${getPersonaImg(persona)}" alt="" /><div class="msg-bubble">${escapeHtml(entry.text)}</div><span class="msg-time">${entry.time}</span>`;
              msgBox.appendChild(row);
            } else if (entry.role === 'date') {
              const div = document.createElement('div');
              div.className = 'chat-date-divider';
              div.innerHTML = `<span class="chat-date-label">${entry.text}</span>`;
              msgBox.appendChild(div);
            }
          });
          scrollToBottom();
        } else {
          // 첫 대화: 날짜 구분선 추가
          chatHistory = [];
          const today = new Date();
          const dateStr = today.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'short' });
          addDateDivider(dateStr);

          // 스토리 모드 or 일반 첫 인사
          if (shouldStartStory(persona.id)) {
            const _storyStartGen = _chatGeneration;
            setTimeout(() => { if (_chatGeneration === _storyStartGen) startStoryMode(persona); }, 500);
          } else {
            // 일반 첫 인사 (AI) + 허브 이력 업데이트
            const greets = FIRST_GREET[persona.id] || ['안녕하세요! 💕'];
            greets.forEach((g, i) => {
              setTimeout(() => {
                addAIMessage(g, false);
                if (i === greets.length - 1) {
                  updateHubHistory(persona, g);
                }
              }, i * 900);
            });
          }
        }
      });

      // 화면 전환: 모든 화면 닫고 채팅으로 (즉시 전환, 딜레이 없음)
      const allScreens = ['swipe-screen','profile-detail-screen','hub-screen','pick-screen','intro-video-screen'];
      allScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.style.transition = 'none';
          el.style.opacity = '0';
          el.style.display = 'none';
          el.classList.remove('visible');
        }
      });
      showScreenFade('chat-screen');
      resetChatInput();
      // 채팅 화면 진입 시 초기 레이아웃 조정 (키보드 내려간 상태 기준)
      _keyboardHeight = 0;
      const inputBar = document.querySelector('.chat-input-bar');
      if (inputBar) inputBar.style.display = 'flex'; // 입력바 표시
      setTimeout(() => _adjustChatLayout(), 100);
    }

    // setupChatInput: 앱 시작 시 딱 1회만 호출 — 이후엔 resetChatInput()으로 초기화
    let _chatInputReady = false;
    function setupChatInput() {
      if (_chatInputReady) {
        resetChatInput();
        return;
      }
      _chatInputReady = true;

      const input   = document.getElementById('chat-input');
      const sendBtn = document.getElementById('chat-send-btn');

      // 기존 onclick 속성 제거
      input.removeAttribute('onclick');
      sendBtn.removeAttribute('onclick');

      // 입력창 높이 자동 조절
      input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
        const btn = document.getElementById('chat-send-btn');
        if (btn) btn.classList.toggle('enabled', this.value.trim().length > 0);
        // 입력창 높이 변경 시 메시지 bottom 재조정
        _adjustChatLayout();
      });

      // 엔터 전송 (shift+enter는 줄바꿈)
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const val = this.value.trim();
          // 즉시 클리어 (기본 동작으로 글자가 남는 것 방지)
          this.value = '';
          this.style.height = 'auto';
          const btn = document.getElementById('chat-send-btn');
          if (btn) btn.classList.remove('enabled');
          if (val) sendMessage(val);
        }
      });

      // 전송 버튼 클릭
      sendBtn.addEventListener('click', function () {
        sendMessage();
      });

      // ── 키보드 대응: visualViewport API (모바일 키보드 올라올 때 레이아웃 조정) ──
      _setupViewportKeyboardListener();

      resetChatInput();
    }

    // visualViewport로 키보드 감지 → 채팅 레이아웃 동적 조정
    let _keyboardHeight = 0;
    function _setupViewportKeyboardListener() {
      if (!window.visualViewport) return;

      function onViewportResize() {
        const chatScreen = document.getElementById('chat-screen');
        // 채팅 화면이 보일 때만 처리
        if (!chatScreen || chatScreen.style.display === 'none') return;

        const viewportHeight = window.visualViewport.height;
        const windowHeight   = window.innerHeight;
        _keyboardHeight = Math.max(0, windowHeight - viewportHeight - window.visualViewport.offsetTop);

        const inputBar = document.querySelector('.chat-input-bar');
        const messages = document.getElementById('chat-messages');

        if (inputBar) {
          // 입력바를 키보드 위로 올림
          inputBar.style.transform = _keyboardHeight > 0
            ? `translateY(-${_keyboardHeight}px)`
            : 'translateY(0)';
        }

        // 메시지 영역 bottom을 입력바 높이 + 키보드 높이로 조정
        _adjustChatLayout();
        // 메시지 끝으로 스크롤
        if (_keyboardHeight > 50) scrollToBottom();
      }

      window.visualViewport.addEventListener('resize',  onViewportResize);
      window.visualViewport.addEventListener('scroll',  onViewportResize);
    }

    function _adjustChatLayout() {
      const inputBar = document.querySelector('.chat-input-bar');
      const messages = document.getElementById('chat-messages');
      if (!inputBar || !messages) return;
      // 입력바의 실제 높이를 구해서 messages bottom 설정
      const barHeight = inputBar.offsetHeight || 56;
      const totalBottom = barHeight + Math.max(0, _keyboardHeight);
      messages.style.bottom = totalBottom + 'px';
    }

    function resetChatInput() {
      const input   = document.getElementById('chat-input');
      const sendBtn = document.getElementById('chat-send-btn');
      if (!input || !sendBtn) return;
      input.value = '';
      input.style.height = 'auto';
      sendBtn.classList.remove('enabled');
      sendBtn.disabled = false;
    }

    function sendMessage(preText) {
      const input   = document.getElementById('chat-input');
      const sendBtn = document.getElementById('chat-send-btn');
      if (!input || !sendBtn) return;

      // 버튼이 disabled이면 이미 처리 중 → 즉시 차단
      if (sendBtn.disabled) return;

      // Enter에서 미리 클리어한 텍스트가 있으면 그것 사용, 없으면 input에서 읽기
      const text = preText !== undefined ? preText : input.value.trim();
      if (!text) return;

      // ★ 즉시 비활성화: 버튼 disabled + 입력창 비우기
      sendBtn.disabled = true;
      sendBtn.classList.remove('enabled');
      input.value = '';
      input.style.height = 'auto';

      // 크레딧 차감 (1 크레딧)
      if (!spendCredit(MSG_COST)) {
        sendBtn.disabled = false; // 크레딧 부족 시 재활성화
        return;
      }

      // 내역 기록 + 메시지 카운트
      const partnerName = currentChatPersona ? currentChatPersona.name : '파트너';
      addCreditHistory('spend', partnerName + '에게 메시지 전송', MSG_COST); // 0.5C
      incrementMsgCount();

      // 내 메시지 추가
      addMyMessage(text);
      updateHubHistory(currentChatPersona, '나: ' + text);

      // AI 응답 요청
      setTimeout(() => {
        showTypingIndicator();
        callAIChat(text);
      }, 300);

      // ★ 버튼 재활성화는 callAIChat 완료 후 처리 (unlockSendBtn 호출)
    }

    // AudioContext 사전 unlock — Chrome autoplay 정책 우회
    // audio.play()가 async fetch 이후에 호출되면 autoplay 차단이 발생할 수 있으므로
    // 사용자 제스처 컨텍스트 안에서 즉시 AudioContext를 activate한다.
    // 공유 AudioContext — 사용자 제스처 시 unlock, 이후 async 재생에서도 재사용
    let _sharedAudioCtx = null;
    function _unlockAudioContext() {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        if (!_sharedAudioCtx) _sharedAudioCtx = new Ctor();
        _sharedAudioCtx.resume().catch(() => {});
        // 무음 버퍼 재생으로 unlock 확정
        const buf = _sharedAudioCtx.createBuffer(1, 1, 22050);
        const src = _sharedAudioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(_sharedAudioCtx.destination);
        src.start(0);
      } catch (_) {}
    }

    // ─── 음성 메시지 요청 (5C) ───
    async function requestVoiceMessage() {
      if (!currentChatPersona) return;
      if (!spendCredit(VOICE_COST)) return;
      addCreditHistory('spend', currentChatPersona.name + ' 음성 메시지', VOICE_COST);

      // 사용자 제스처 컨텍스트 안에서 Audio 객체 미리 생성 (autoplay 정책 우회 핵심)
      _unlockAudioContext();
      const primedAudio = new Audio();
      primedAudio.load();  // 제스처 컨텍스트에서 priming

      const triggerMsg = '음성 메시지로 한 마디 해줘 💌';
      addMyMessage(triggerMsg);
      showTypingIndicator();

      try {
        const historyForAPI = chatHistory.slice(0, -1).map(h => ({
          role: h.role === 'me' ? 'user' : 'model',
          text: h.text
        }));
        const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
          },
          body: JSON.stringify({
            personaId: currentChatPersona.id,
            userMessage: triggerMsg,
            history: historyForAPI,
            userName
          })
        });
        const data = await res.json();
        const aiText = data.reply || '...';

        removeTypingIndicator();
        addAIMessageWithVoice(aiText, currentChatPersona);
        chatHistory.push({ role: 'ai', text: aiText });
        saveChatHistory(currentChatPersona.id, chatHistory);
        scrollToBottom();

        // 미리 생성한 Audio 객체로 TTS 재생
        playTTS(aiText, currentChatPersona.id, primedAudio);
      } catch(e) {
        removeTypingIndicator();
        addAIMessage('음성 메시지를 준비하는 중에 오류가 생겼어요... 😢');
      }
    }

    // TTS 재생 함수 — primedAudio(제스처 컨텍스트에서 생성)로 autoplay 정책 우회
    async function playTTS(text, personaId, primedAudio) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
          },
          body: JSON.stringify({ text, personaId })
        });
        console.log('[TTS] HTTP 상태:', res.status, res.headers.get('Content-Type'));

        const contentType = res.headers.get('Content-Type') || '';
        if (res.ok && contentType.startsWith('audio/')) {
          // 서버가 바이너리 WAV를 직접 반환
          const arrayBuf = await res.arrayBuffer();
          console.log('[TTS] 오디오 수신:', contentType, arrayBuf.byteLength, 'bytes');
          const blob = new Blob([arrayBuf], { type: contentType });
          const blobUrl = URL.createObjectURL(blob);
          const audio = primedAudio || new Audio();
          audio.src = blobUrl;
          audio.play().then(() => {
            console.log('[TTS] audio.play() 성공 ✓');
            audio.addEventListener('ended', () => URL.revokeObjectURL(blobUrl), { once: true });
          }).catch(err => {
            console.error('[TTS] play() 실패:', err.name, err.message);
            URL.revokeObjectURL(blobUrl);
            // AudioContext 폴백
            try {
              const ctx = _sharedAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
              if (!_sharedAudioCtx) _sharedAudioCtx = ctx;
              console.log('[TTS] AudioContext 폴백, state:', ctx.state);
              ctx.decodeAudioData(arrayBuf.slice(0)).then(decoded => {
                console.log('[TTS] AudioContext 디코딩 성공, duration:', decoded.duration);
                const source = ctx.createBufferSource();
                source.buffer = decoded;
                source.connect(ctx.destination);
                source.start(0);
              }).catch(decErr => {
                console.error('[TTS] AudioContext 디코딩 실패:', decErr);
                webSpeechFallback(text);
              });
            } catch(ctxErr) {
              console.error('[TTS] AudioContext 생성 실패:', ctxErr);
              webSpeechFallback(text);
            }
          });
        } else {
          // JSON 오류 응답 처리
          let errData = {};
          try { errData = await res.json(); } catch(_) {}
          console.warn('[TTS] 서버 오류 응답:', res.status, JSON.stringify(errData));
          if (res.status === 401) {
            // 로그인 토큰 만료 → 재로그인 유도
            const msgBox = document.getElementById('chat-messages');
            if (msgBox) {
              const dbg = document.createElement('div');
              dbg.style.cssText = 'text-align:center;font-size:12px;color:#ff6b6b;margin:8px 16px;opacity:0.9;';
              dbg.innerHTML = '음성 기능을 사용하려면 <a href="#" onclick="loginWithGoogle();return false;" style="color:#ff9f9f;text-decoration:underline;">다시 로그인</a>이 필요합니다.';
              msgBox.appendChild(dbg);
            }
          } else {
            console.warn('[TTS] 서버 오류:', res.status, JSON.stringify(errData));
          }
          webSpeechFallback(text);
        }
      } catch(e) {
        console.error('[TTS] fetch 실패:', e);
        webSpeechFallback(text);
      }
    }

    function webSpeechFallback(text) {
      if (!('speechSynthesis' in window)) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ko-KR';
      utter.rate = 0.95;
      utter.pitch = 1.2;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }

    // 음성 버튼 포함 AI 메시지 버블 추가
    function addAIMessageWithVoice(text, persona) {
      const msgBox = document.getElementById('chat-messages');
      const row = document.createElement('div');
      row.className = 'msg-row ai';
      const avatarSrc = getPersonaImg(persona);
      row.innerHTML = `
        <img class="msg-avatar" src="${avatarSrc}" onerror="this.style.display='none'" />
        <div class="msg-col">
          <div class="msg-bubble ai voice-msg-bubble">
            <span class="voice-icon">🎙️</span>
            <span class="voice-msg-text">${escapeHtml(text)}</span>
            <button class="voice-replay-btn" onclick="_replayVoice(this)">▶ 재생</button>
          </div>
          <div class="msg-time">${getNowTime()}</div>
        </div>
      `;
      // data 속성으로 text/personaId 저장 (XSS 방지, onclick inline 직접 삽입 제거)
      const btn = row.querySelector('.voice-replay-btn');
      btn.dataset.text = text;
      btn.dataset.personaId = persona.id;
      msgBox.appendChild(row);
    }

    // 재생 버튼 클릭 핸들러 — 제스처 컨텍스트에서 Audio priming 후 TTS
    function _replayVoice(btn) {
      _unlockAudioContext();
      const primedAudio = new Audio();
      primedAudio.load();
      const text = btn.dataset.text;
      const personaId = btn.dataset.personaId;
      playTTS(text, personaId, primedAudio);
    }

    // ─── 특별 사진 인라인 요청 (10C) ───
    async function requestSpecialPhoto() {
      if (!currentChatPersona) return;
      if (!spendCredit(PHOTO_COST)) return;
      addCreditHistory('spend', currentChatPersona.name + ' 특별 사진', PHOTO_COST);

      const persona = currentChatPersona;
      // 페르소나 기반 사진 프롬프트
      const photoTrigger = '오빠한테만 특별한 사진 한 장 보내줄게 📸';
      addMyMessage(photoTrigger);
      showTypingIndicator();

      try {
        // AI에게 사진 전송 상황 메시지 요청
        const historyForAPI = chatHistory.slice(0, -1).map(h => ({
          role: h.role === 'me' ? 'user' : 'model',
          text: h.text
        }));
        const userName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
          },
          body: JSON.stringify({
            personaId: persona.id,
            userMessage: photoTrigger + ' [특별 사진을 전송하는 상황에서 자연스러운 코멘트를 짧게 (1~2문장) 보내줘]',
            history: historyForAPI,
            userName
          })
        });
        const data = await res.json();
        const aiComment = data.reply || '📸 ...';

        removeTypingIndicator();

        // 그램 포스트 중 해당 페르소나 이미지를 랜덤 선택
        const personaPosts = GRAM_POSTS.filter(p => p.personaId === persona.id);
        const randomPost = personaPosts[Math.floor(Math.random() * personaPosts.length)];
        const imgSrc = randomPost ? randomPost.img : getPersonaImg(persona);

        // 특별 사진 + 코멘트 버블 추가
        addSpecialPhotoMessage(aiComment, imgSrc, persona);
        chatHistory.push({ role: 'ai', text: aiComment });
        saveChatHistory(persona.id, chatHistory);
        scrollToBottom();
      } catch(e) {
        removeTypingIndicator();
        addAIMessage('사진 준비 중에 오류가 생겼어요... 😢');
      }
    }

    // 특별 사진 버블 추가
    function addSpecialPhotoMessage(comment, imgSrc, persona) {
      const msgBox = document.getElementById('chat-messages');
      const row = document.createElement('div');
      row.className = 'msg-row ai';
      row.innerHTML = `
        <img class="msg-avatar" src="${getPersonaImg(persona)}" onerror="this.style.display='none'" />
        <div class="msg-col">
          <div class="msg-bubble ai special-photo-bubble">
            <div class="special-photo-tag">📸 특별 사진</div>
            <img class="special-photo-img" src="${imgSrc}" alt="${persona.name}" onerror="this.src='${persona.img}'" />
            <div class="special-photo-comment">${escapeHtml(comment)}</div>
          </div>
          <div class="msg-time">${getNowTime()}</div>
        </div>
      `;
      msgBox.appendChild(row);
    }

    // AI 응답 완료 후 전송 버튼 재활성화
    function unlockSendBtn() {
      const sendBtn = document.getElementById('chat-send-btn');
      const input   = document.getElementById('chat-input');
      if (!sendBtn) return;
      sendBtn.disabled = false;
      if (input && input.value.trim()) sendBtn.classList.add('enabled');
    }

    // ─── AI API 호출 (Gemini via /api/chat) ───
    async function callAIChat(userMessage) {
      try {
        // 대화 이력을 API 형식으로 변환 (내 메시지 = user, AI = model)
        const historyForAPI = chatHistory
          .slice(0, -1) // 방금 추가한 내 메시지 제외 (중복 방지)
          .map(h => ({
            role: h.role === 'me' ? 'user' : 'model',
            text: h.text
          }));

        const userName = sessionStorage.getItem('lovia_username') ||
                         sessionStorage.getItem('userName') || '';

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
          },
          body: JSON.stringify({
            personaId: currentChatPersona?.id,
            message: userMessage,
            history: historyForAPI,
            userName
          })
        });

        removeTypingIndicator();

        if (!res.ok) {
          // API 오류 시 폴백 더미 응답
          console.warn('[AI] API 오류, 더미 응답 사용');
          const fallbacks = DUMMY_REPLIES[currentChatPersona?.id] || ['잠깐만요… 🥺'];
          const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
          addAIMessage(fallback, true);
          updateHubHistory(currentChatPersona, fallback);
          unlockSendBtn();
          return;
        }

        const data = await res.json();
        const reply = data.reply || '잠깐만요… 🥺';
        addAIMessage(reply, true);
        updateHubHistory(currentChatPersona, reply);
        unlockSendBtn();

      } catch (e) {
        // 네트워크 오류 시 폴백
        console.warn('[AI] 네트워크 오류, 더미 응답 사용', e);
        removeTypingIndicator();
        const fallbacks = DUMMY_REPLIES[currentChatPersona?.id] || ['잠깐만요… 🥺'];
        const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        addAIMessage(fallback, true);
        updateHubHistory(currentChatPersona, fallback);
        unlockSendBtn();
      }
    }

    function addMyMessage(text) {
      const msgBox = document.getElementById('chat-messages');
      const time = getNowTime();
      const row = document.createElement('div');
      row.className = 'msg-row from-me';
      row.innerHTML = `
        <span class="msg-time">${time}</span>
        <div class="msg-bubble">${escapeHtml(text)}</div>
      `;
      msgBox.appendChild(row);
      scrollToBottom();
      // 로컬 이력 저장
      chatHistory.push({ role: 'me', text, time });
      if (currentChatPersona) saveChatHistory(currentChatPersona.id);
      // D1 저장 (로그인 유저)
      saveMessageToD1('me', text);
    }

    function addAIMessage(text, animate) {
      const msgBox = document.getElementById('chat-messages');
      const time = getNowTime();
      const row = document.createElement('div');
      row.className = 'msg-row from-ai';
      row.style.opacity = animate ? '0' : '1';
      row.style.transform = animate ? 'translateY(8px)' : 'none';
      row.innerHTML = `
        <img class="msg-avatar" src="${getPersonaImg(currentChatPersona)}" alt="" />
        <div class="msg-bubble">${escapeHtml(text)}</div>
        <span class="msg-time">${time}</span>
      `;
      msgBox.appendChild(row);
      scrollToBottom();
      // 로컬 이력 저장
      chatHistory.push({ role: 'ai', text, time });
      if (currentChatPersona) saveChatHistory(currentChatPersona.id);
      // D1 저장 (로그인 유저)
      saveMessageToD1('ai', text);
      // 10턴마다 자동 요약 (로그인 유저)
      const aiMsgCount = chatHistory.filter(h => h.role === 'ai').length;
      if (aiMsgCount > 0 && aiMsgCount % 10 === 0) {
        triggerMemorySummarize();
      }
      if (animate) {
        requestAnimationFrame(() => {
          row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          row.style.opacity = '1';
          row.style.transform = 'translateY(0)';
        });
      }
    }

    function showTypingIndicator() {
      const msgBox = document.getElementById('chat-messages');
      const row = document.createElement('div');
      row.className = 'msg-row from-ai';
      row.id = 'typing-row';
      row.innerHTML = `
        <img class="msg-avatar" src="${getPersonaImg(currentChatPersona)}" alt="" />
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      msgBox.appendChild(row);
      scrollToBottom();
    }

    function removeTypingIndicator() {
      const el = document.getElementById('typing-row');
      if (el) el.remove();
    }

    function addDateDivider(label) {
      const msgBox = document.getElementById('chat-messages');
      const div = document.createElement('div');
      div.className = 'chat-date-divider';
      div.innerHTML = `<span class="chat-date-label">${label}</span>`;
      msgBox.appendChild(div);
      // 날짜 구분선도 이력 저장
      chatHistory.push({ role: 'date', text: label, time: '' });
      if (currentChatPersona) saveChatHistory(currentChatPersona.id);
    }

    function scrollToBottom() {
      const msgBox = document.getElementById('chat-messages');
      if (!msgBox) return;
      // 레이아웃 조정 후 스크롤
      _adjustChatLayout();
      setTimeout(() => {
        msgBox.scrollTop = msgBox.scrollHeight;
      }, 50);
    }

    function getNowTime() {
      const d = new Date();
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      return (h < 12 ? '오전 ' : '오후 ') + (h % 12 || 12) + ':' + m;
    }

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
    }

    // ═══════════════════════════════════════
    // ⑦ 채팅 허브 (채팅 목록) 화면
    // ═══════════════════════════════════════

    // 채팅 이력 저장소: { personaId, lastMsg, lastTime, unread }
    let hubChatHistory = JSON.parse(sessionStorage.getItem('hubChatHistory') || '[]');

    /**
     * 채팅 이력 업데이트 — startChatWith 진입 시 호출
     */
    function updateHubHistory(persona, message) {
      const now = new Date();
      const timeStr = (now.getHours() < 12 ? '오전 ' : '오후 ')
        + (now.getHours() % 12 || 12) + ':' + String(now.getMinutes()).padStart(2, '0');

      const idx = hubChatHistory.findIndex(h => h.personaId === persona.id);
      if (idx >= 0) {
        hubChatHistory[idx].lastMsg = message;
        hubChatHistory[idx].lastTime = timeStr;
        // unread는 유저가 직접 채팅 진입 시 0으로 초기화
      } else {
        hubChatHistory.unshift({
          personaId: persona.id,
          lastMsg: message,
          lastTime: timeStr,
          unread: 0
        });
      }
      sessionStorage.setItem('hubChatHistory', JSON.stringify(hubChatHistory));
    }

    /**
     * 채팅방 나갔다가 돌아올 때 unread 초기화
     */
    function clearHubUnread(personaId) {
      const idx = hubChatHistory.findIndex(h => h.personaId === personaId);
      if (idx >= 0) {
        hubChatHistory[idx].unread = 0;
        sessionStorage.setItem('hubChatHistory', JSON.stringify(hubChatHistory));
      }
    }

    /**
     * AI 메시지 수신 시 unread 증가 (채팅방 밖에 있을 때만)
     * (현재는 채팅방 안에서만 메시지 오므로 참고용)
     */
    function incrementHubUnread(personaId) {
      const idx = hubChatHistory.findIndex(h => h.personaId === personaId);
      if (idx >= 0) {
        hubChatHistory[idx].unread = (hubChatHistory[idx].unread || 0) + 1;
        sessionStorage.setItem('hubChatHistory', JSON.stringify(hubChatHistory));
      }
    }

    /**
     * 허브 화면 열기 (스와이프/프로필상세 → 허브)
     */
    function openHub() {
      const swipeScreen = document.getElementById('swipe-screen');
      const profileScreen = document.getElementById('profile-detail-screen');

      if (swipeScreen.style.display !== 'none') {
        swipeScreen.style.transition = 'opacity 0.3s ease';
        swipeScreen.style.opacity = '0';
        setTimeout(() => {
          swipeScreen.style.display = 'none';
          swipeScreen.style.opacity = '0';
          renderHub();
          showScreenFade('hub-screen');
        }, 300);
      } else if (profileScreen.style.display !== 'none') {
        profileScreen.style.transition = 'opacity 0.3s ease';
        profileScreen.style.opacity = '0';
        setTimeout(() => {
          profileScreen.style.display = 'none';
          profileScreen.style.opacity = '0';
          renderHub();
          showScreenFade('hub-screen');
        }, 300);
      } else {
        renderHub();
        showScreenFade('hub-screen');
      }
    }

    /**
     * 허브에서 스와이프 화면으로 돌아가기
     */
    function goBackFromHub() {
      const hub = document.getElementById('hub-screen');
      hub.style.transition = 'opacity 0.3s ease';
      hub.style.opacity = '0';
      setTimeout(() => {
        hub.style.display = 'none';
        hub.style.opacity = '0';
        updateHubBtn();
        showScreenFade('swipe-screen');
      }, 300);
    }

    /**
     * 허브에서 특정 파트너 채팅 진입
     */
    function openChatFromHub(personaId) {
      const persona = PERSONAS.find(p => p.id === personaId);
      if (!persona) return;

      // unread 초기화
      clearHubUnread(personaId);

      // 현재 상세 페르소나 설정
      currentDetailPersona = persona;

      // 허브 닫고 채팅 진입
      const hub = document.getElementById('hub-screen');
      hub.style.transition = 'opacity 0.3s ease';
      hub.style.opacity = '0';
      setTimeout(() => {
        hub.style.display = 'none';
        hub.style.opacity = '0';
        startChatWith(persona);
        // startChatWith는 profile-detail → chat 전환이지만
        // 허브에서 진입 시 중간 detail 없이 바로 채팅 진입
      }, 300);
    }

    /**
     * 허브 화면 렌더링
     */
    function renderHub() {
      const list = document.getElementById('hub-chat-list');
      const discoverRow = document.getElementById('hub-discover-row');
      const discoverSection = document.getElementById('hub-discover-section');
      const subtitle = document.getElementById('hub-subtitle');

      // 이력 새로 불러오기
      hubChatHistory = JSON.parse(sessionStorage.getItem('hubChatHistory') || '[]');

      // 가로 아바타 줄
      discoverRow.innerHTML = '';
      hubChatHistory.forEach(h => {
        const persona = PERSONAS.find(p => p.id === h.personaId);
        if (!persona) return;
        const card = document.createElement('div');
        card.className = 'hub-discover-card';
        card.onclick = () => openChatFromHub(persona.id);
        card.innerHTML = `
          <div class="hub-discover-avatar-wrap">
            <img class="hub-discover-avatar" src="${getPersonaImg(persona)}" alt="${persona.name}" />
            <div class="hub-discover-dot${(h.unread || 0) > 0 ? ' active' : ''}"></div>
          </div>
          <div class="hub-discover-name">${persona.name}</div>
        `;
        discoverRow.appendChild(card);
      });

      discoverSection.style.display = hubChatHistory.length > 0 ? 'block' : 'none';

      // 채팅 목록 렌더
      list.innerHTML = '';
      if (hubChatHistory.length === 0) {
        list.innerHTML = `
          <div class="hub-empty">
            <div class="hub-empty-icon">💌</div>
            <div class="hub-empty-title">아직 대화한 파트너가 없어요</div>
            <div class="hub-empty-desc">위에서 새 파트너 찾기를 눌러<br>첫 대화를 시작해보세요 💕</div>
          </div>
        `;
        subtitle.textContent = '아직 대화한 파트너가 없어요';
      } else {
        subtitle.textContent = `${hubChatHistory.length}명과 대화 중`;
        hubChatHistory.forEach((h, i) => {
          const persona = PERSONAS.find(p => p.id === h.personaId);
          if (!persona) return;
          const unread = h.unread || 0;

          const item = document.createElement('div');
          item.className = 'hub-chat-item';
          item.onclick = () => openChatFromHub(persona.id);
          item.innerHTML = `
            <div class="hub-chat-avatar-wrap">
              <img class="hub-chat-avatar" src="${getPersonaImg(persona)}" alt="${persona.name}" />
              <div class="hub-online-dot"></div>
            </div>
            <div class="hub-chat-body">
              <div class="hub-chat-name-row">
                <span class="hub-chat-name">${persona.name} ${persona.age}세</span>
                <span class="hub-chat-time">${h.lastTime || ''}</span>
              </div>
              <div class="hub-chat-preview-row">
                <span class="hub-chat-preview${unread > 0 ? ' unread' : ''}">${escapeHtml(h.lastMsg || '대화를 시작해보세요 💕')}</span>
                ${unread > 0 ? `<div class="hub-unread-badge">${unread}</div>` : ''}
              </div>
            </div>
          `;
          list.appendChild(item);

          // 구분선 (마지막 제외)
          if (i < hubChatHistory.length - 1) {
            const div = document.createElement('div');
            div.className = 'hub-divider';
            list.appendChild(div);
          }
        });
      }
    }

    function goBackFromChat() {
      // 튜토리얼 진행 중이면 스킵 처리
      if (tutorialMode) {
        skipTutorial();
        return;
      }
      const chat = document.getElementById('chat-screen');
      chat.style.transition = 'opacity 0.3s ease';
      chat.style.opacity = '0';
      // 채팅 나갈 때 키보드 내리기 및 입력창 blur
      const chatInput = document.getElementById('chat-input');
      if (chatInput) chatInput.blur();
      // 키보드 높이 초기화 및 입력바 위치 초기화
      _keyboardHeight = 0;
      const inputBar = document.querySelector('.chat-input-bar');
      if (inputBar) {
        inputBar.style.transform = 'translateY(0)';
        inputBar.style.display = 'none'; // 다른 화면에서 입력바 안 보이게
      }
      setTimeout(() => {
        chat.style.display = 'none';
        chat.style.opacity = '0';
        // 항상 허브(채팅 목록)로 돌아가기
        renderHub();
        showScreenFade('hub-screen');
      }, 300);
    }

    // ─────────────────────────────
    // startChat: 카드/리스트에서 직접 채팅 진입
    // ─────────────────────────────
    function startChat(personaId) {
      const persona = PERSONAS.find(p => p.id === personaId);
      if (!persona) return;
      sessionStorage.setItem('selectedPersona', JSON.stringify(persona));
      // 프로필 상세 화면으로 이동 (카드 → 상세 → 채팅)
      openProfileDetail(personaId);
    }

    // ═══════════════════════════════════════
    // ⑧ 인앱 그램 피드
    // ═══════════════════════════════════════

    // ─── 그램 포스트 데이터 ───
    // 구조: { id, personaId, img, caption, time, likes, locked }
    // img: 전용 이미지 없으면 null → 프로필 이미지로 폴백
    // locked: true이면 블러 잠금 오버레이 (Phase 2 유료 기능용)
    // ★ 이미지 추가 방법: /public/images/gram/ 폴더에 파일 넣고 img 경로 지정
    const GRAM_POSTS = [
      // ── 민지 (간호사, 비밀연애) ──
      { id:'gm1', personaId:'minji',   img:'/images/gram/gram_minji_01.jpg',   caption:'야간 근무 끝나고 한 컷 📸 오늘도 오빠 생각하면서 버텼어요 🌙', time:'2시간 전', likes:142, locked:false },
      { id:'gm2', personaId:'minji',   img:'/images/gram/gram_minji_02.jpg',   caption:'병원 옥상에서 보는 노을… 오빠한테 보여주고 싶었어요 🌇', time:'1일 전', likes:98, locked:false },
      { id:'gm3', personaId:'minji',   img:'/images/gram/gram_minji_03.jpg',   caption:'오프 날 카페에서 커피 한 잔 ☕ 혼자인 게 심심해요', time:'3일 전', likes:211, locked:true },

      // ── 지우 (경영학과, 귀엽고 발랄) ──
      { id:'gj1', personaId:'jiwoo',   img:'/images/gram/gram_jiwoo_01.jpg',   caption:'캠퍼스 벚꽃 다 졌는데… 오빠랑 같이 봤으면 좋았을 텐데 🌸', time:'3시간 전', likes:187, locked:false },
      { id:'gj2', personaId:'jiwoo',   img:'/images/gram/gram_jiwoo_02.jpg',   caption:'시험 공부 중 🥺 오빠가 옆에서 응원해주면 더 잘할 수 있을 것 같은데', time:'2일 전', likes:134, locked:false },
      { id:'gj3', personaId:'jiwoo',   img:'/images/gram/gram_jiwoo_03.jpg',   caption:'친구들이랑 나왔는데 오빠 생각만 나 💭', time:'4일 전', likes:256, locked:true },

      // ── 하영 (요가강사, 건강미) ──
      { id:'gh1', personaId:'hayoung', img:'/images/gram/gram_hayoung_01.jpg', caption:'오늘 선셋 요가 🧘‍♀️ 이 시간이 제일 좋아요. 오빠도 같이 했으면…', time:'1시간 전', likes:203, locked:false },
      { id:'gh2', personaId:'hayoung', img:'/images/gram/gram_hayoung_02.jpg', caption:'수업 끝나고 혼자 마시는 그린 스무디 🥤 건강 챙겨요 오빠도!', time:'1일 전', likes:176, locked:false },
      { id:'gh3', personaId:'hayoung', img:'/images/gram/gram_hayoung_03.jpg', caption:'주말 아침 한강 🌊 맑은 공기에 오빠 보고 싶어졌어', time:'3일 전', likes:319, locked:true },

      // ── 은비 (UI/UX 디자이너, 감성적 야행성) ──
      { id:'ge1', personaId:'eunbi',   img:'/images/gram/gram_eunbi_01.jpg',   caption:'밤새 작업하다 새벽 4시… 창밖 불빛이 오빠처럼 따뜻해 보여요 🌃', time:'5시간 전', likes:167, locked:false },
      { id:'ge2', personaId:'eunbi',   img:'/images/gram/gram_eunbi_02.jpg',   caption:'새 프로젝트 무드보드 🎨 이런 감성 오빠도 좋아할 것 같아서', time:'2일 전', likes:143, locked:false },
      { id:'ge3', personaId:'eunbi',   img:'/images/gram/gram_eunbi_03.jpg',   caption:'퇴근 후 혼자 산책 🌙 야경이 너무 예쁜데 같이 보고 싶다', time:'5일 전', likes:228, locked:true },

      // ── 다희 (피팅모델, 솔직하고 섹시) ──
      { id:'gd1', personaId:'dahee',   img:'/images/gram/gram_dahee_01.jpg',   caption:'오늘 화보 촬영 컷 📷 맘에 드는지 오빠한테 먼저 보여주고 싶었어', time:'4시간 전', likes:389, locked:false },
      { id:'gd2', personaId:'dahee',   img:'/images/gram/gram_dahee_02.jpg',   caption:'촬영 끝나고 치맥 🍺🍗 혼자 먹으니까 반도 못 먹겠어', time:'2일 전', likes:271, locked:false },
      { id:'gd3', personaId:'dahee',   img:'/images/gram/gram_dahee_03.jpg',   caption:'주말 거리 산책 🛍️ 오빠 생각에 발걸음이 자꾸 느려져', time:'6일 전', likes:198, locked:true },
    ];

    // 좋아요 상태 저장 (sessionStorage)
    let gramLikes = {};
    try {
      gramLikes = JSON.parse(sessionStorage.getItem('lovia_gram_likes') || '{}');
    } catch(e) { gramLikes = {}; }

    function saveGramLikes() {
      try { sessionStorage.setItem('lovia_gram_likes', JSON.stringify(gramLikes)); } catch(e) {}
    }

    // ── 그램 잠금 해제 상태 (sessionStorage 기반, 실서비스는 서버 저장) ──
    let gramUnlocked = {};
    try {
      gramUnlocked = JSON.parse(sessionStorage.getItem('lovia_gram_unlocked') || '{}');
    } catch(e) { gramUnlocked = {}; }

    function saveGramUnlocked() {
      try { sessionStorage.setItem('lovia_gram_unlocked', JSON.stringify(gramUnlocked)); } catch(e) {}
    }

    function isGramUnlocked(postId) {
      return !!gramUnlocked[postId];
    }

    // 그램 포스트 잠금 해제 (15C 소모)
    function unlockGramPost(postId) {
      if (isGramUnlocked(postId)) return; // 이미 해제됨
      if (!isLoggedIn()) {
        showSignupPopup('gram_unlock');
        return;
      }
      if (!spendCredit(GRAM_UNLOCK_COST)) return; // 크레딧 부족
      gramUnlocked[postId] = true;
      saveGramUnlocked();
      addCreditHistory('spend', '그램 특별 사진 열람', GRAM_UNLOCK_COST);
      // 해당 포스트 DOM에서 잠금 오버레이 제거
      const overlay = document.querySelector(`[data-post-id="${postId}"] .gram-lock-overlay`);
      if (overlay) {
        overlay.style.transition = 'opacity 0.3s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
        // 블러 이미지도 해제
        const img = overlay.closest('.gram-post-img-wrap')?.querySelector('img');
        if (img) { img.style.transition = 'filter 0.3s ease'; img.style.filter = 'none'; }
      } else {
        // 그램 화면 전체 새로고침
        renderGramPosts();
      }
      // 해제 완료 알림
      const t = document.createElement('div');
      t.textContent = '🔓 사진이 잠금 해제되었어요!';
      t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(255,107,138,0.9);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;pointer-events:none;';
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 2000);
    }

    // 현재 그램 필터 ('all' or personaId)
    let gramFilter = 'all';
    // 그램 진입 전 화면 기억 (뒤로가기용)
    let gramPrevScreen = 'swipe-screen';

    // ─── 그램 화면 열기 ───
    function openGramScreen(personaId, prevScreen) {
      gramFilter = personaId || 'all';
      gramPrevScreen = prevScreen || 'swipe-screen';

      // 모든 화면 숨기기
      ['swipe-screen','hub-screen','pick-screen','profile-detail-screen','chat-screen'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.opacity = '0'; el.style.display = 'none'; }
      });

      renderGramFilters();
      renderGramFeed();
      showScreenFade('gram-screen');

    }

    // ─── 그램 뒤로가기 ───
    function closeGramScreen() {
      const gram = document.getElementById('gram-screen');
      gram.style.transition = 'opacity 0.3s ease';
      gram.style.opacity = '0';
      setTimeout(() => {
        gram.style.display = 'none';
        gram.style.opacity = '0';
        // 이전 화면으로 복귀
        if (gramPrevScreen === 'hub-screen') {
          renderHub();
          showScreenFade('hub-screen');
        } else if (gramPrevScreen === 'profile-detail-screen') {
          showScreenFade('profile-detail-screen');
        } else {
          showScreenFade('swipe-screen');
        }
      }, 300);
    }

    // ─── 필터 탭 렌더링 ───
    function renderGramFilters() {
      const wrap = document.getElementById('gram-filter-tabs');
      if (!wrap) return;

      // '전체' + 각 페르소나 탭
      const tabs = [{ id:'all', name:'전체', img:null }]
        .concat(PERSONAS.map(p => ({ id:p.id, name:p.name, img:getPersonaImg(p) })));

      wrap.innerHTML = tabs.map(t => `
        <button class="gram-filter-tab ${gramFilter === t.id ? 'active' : ''}"
                data-pid="${t.id}">
          ${t.img ? `<img src="${t.img}" alt="${t.name}" />` : '🌟'}
          ${t.name}
        </button>
      `).join('');

      wrap.querySelectorAll('.gram-filter-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          gramFilter = btn.dataset.pid;
          renderGramFilters();
          renderGramFeed();
        });
      });
    }

    // ─── 피드 렌더링 ───
    function renderGramFeed() {
      const feed = document.getElementById('gram-feed');
      if (!feed) return;

      // 필터 적용
      const posts = gramFilter === 'all'
        ? GRAM_POSTS
        : GRAM_POSTS.filter(p => p.personaId === gramFilter);

      if (posts.length === 0) {
        feed.innerHTML = `
          <div class="gram-empty">
            <div class="gram-empty-icon">📭</div>
            <div class="gram-empty-text">아직 올린 사진이 없어요<br>곧 소식을 전할게요 💕</div>
          </div>`;
        return;
      }

      feed.innerHTML = posts.map((post, idx) => {
        const persona = PERSONAS.find(p => p.id === post.personaId);
        if (!persona) return '';

        // 이미지: 전용 gram 이미지 → 없으면 프로필 이미지 폴백
        const imgSrc = post.img || getPersonaImg(persona);
        const isLiked = !!gramLikes[post.id];
        const likeCount = post.likes + (isLiked ? 1 : 0);

        return `
          <div class="gram-post" style="animation-delay:${idx * 0.06}s" data-post-id="${post.id}">
            <!-- 헤더: 아바타 + 이름 + 시간 -->
            <div class="gram-post-header">
              <img class="gram-post-avatar" src="${getPersonaImg(persona)}" alt="${persona.name}" />
              <div class="gram-post-meta">
                <div class="gram-post-name">${persona.name}</div>
                <div class="gram-post-time">${post.time}</div>
              </div>
            </div>

            <!-- 이미지 -->
            <div class="gram-post-img-wrap">
              <img class="gram-post-img" src="${imgSrc}"
                   alt="${persona.name}"
                   style="${post.locked && !isGramUnlocked(post.id) ? 'filter:blur(12px) brightness(0.7);' : ''}"
                   onerror="this.src='${persona.img}'" />
              ${post.locked && !isGramUnlocked(post.id) ? `
                <div class="gram-lock-overlay" data-post-id="${post.id}">
                  <div class="gram-post-lock-icon">🔒</div>
                  <div class="gram-post-lock-text">특별한 사진이에요</div>
                  <div class="gram-post-lock-cost">15 크레딧으로 열람</div>
                  <button class="gram-post-lock-btn" onclick="unlockGramPost('${post.id}')">💎 잠금 해제 (15C)</button>
                </div>` : ''}
            </div>

            <!-- 액션 바: 좋아요 + 채팅 -->
            <div class="gram-post-actions">
              <button class="gram-like-btn ${isLiked ? 'liked' : ''}"
                      data-post-id="${post.id}">
                <span class="heart">${isLiked ? '❤️' : '🤍'}</span>
                <span class="like-count">${likeCount}</span>
              </button>
              <button class="gram-chat-btn" data-persona-id="${persona.id}">
                💬 채팅하기
              </button>
            </div>

            <!-- 캡션 -->
            <div class="gram-post-caption">
              <strong>${persona.name}</strong>${escapeHtml(post.caption)}
            </div>
          </div>
        `;
      }).join('');

      // 이벤트 연결
      feed.querySelectorAll('.gram-like-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleGramLike(btn.dataset.postId));
      });
      feed.querySelectorAll('.gram-chat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          gramChatWith(btn.dataset.personaId);
        });
      });
    }

    // ─── 좋아요 토글 ───
    function toggleGramLike(postId) {
      gramLikes[postId] = !gramLikes[postId];
      saveGramLikes();

      // 해당 버튼만 업데이트 (전체 리렌더 없이)
      const post = GRAM_POSTS.find(p => p.id === postId);
      if (!post) return;

      const btn = document.querySelector(`.gram-like-btn[data-post-id="${postId}"]`);
      if (!btn) return;

      const isLiked = !!gramLikes[postId];
      btn.classList.toggle('liked', isLiked);
      btn.querySelector('.heart').textContent = isLiked ? '❤️' : '🤍';
      btn.querySelector('.like-count').textContent = post.likes + (isLiked ? 1 : 0);
    }

    // ─── 그램에서 채팅 진입 ───
    function gramChatWith(personaId) {
      const gram = document.getElementById('gram-screen');
      gram.style.opacity = '0';
      gram.style.display = 'none';
      const persona = PERSONAS.find(p => p.id === personaId);
      if (persona) startChatWith(persona);
    }

    // ─── 채팅방 헤더에서 그램 진입 ───
    function openGramFromChat() {
      const personaId = currentChatPersona ? currentChatPersona.id : null;
      openGramScreen(personaId, 'chat-screen');
    }

    // ─── 그램 이벤트 바인딩 (초기화 시 1회) ───
    (function initGram() {
      const backBtn = document.getElementById('gram-back-btn');
      if (backBtn) backBtn.addEventListener('click', closeGramScreen);
    })();

    // ═══════════════════════════════════════
    // 💎 마이페이지 시스템
    // ═══════════════════════════════════════

    // 크레딧 사용/획득 내역 (sessionStorage 기반)
    const HISTORY_KEY  = 'lovia_credit_history';
    const DAILY_KEY    = 'lovia_daily_claimed';
    const MSG_COUNT_KEY = 'lovia_msg_count';

    function getCreditHistory() {
      try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); }
      catch(e) { return []; }
    }

    function addCreditHistory(type, desc, amount) {
      // type: 'spend' | 'earn'
      const history = getCreditHistory();
      const now = new Date();
      const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
      history.unshift({ type, desc, amount, time: timeStr });
      if (history.length > 30) history.length = 30; // 최대 30개
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function getTotalMsgCount() {
      return parseInt(sessionStorage.getItem(MSG_COUNT_KEY) || '0');
    }

    function incrementMsgCount() {
      const newCount = getTotalMsgCount() + 1;
      sessionStorage.setItem(MSG_COUNT_KEY, newCount);
      // 회원가입 트리거 체크 (메시지 10개 이상 & 미가입 시)
      if (newCount >= SIGNUP_MSG_THRESHOLD && !isLoggedIn() && !_signupPopupShown) {
        setTimeout(() => showSignupPopup('chat'), 800); // AI 응답 후 자연스럽게
      }
      // 현재 채팅 상대와의 관계 레벨 업데이트
      if (currentChatPersona) {
        updateRelationshipLevel(currentChatPersona.id);
      }
    }

    // ══════════════════════════════════════════════
    // 💕 관계 레벨 시스템 (Lv1~5)
    // ══════════════════════════════════════════════
    const RELATIONSHIP_LEVELS = [
      { level: 1, name: '짝사랑',     emoji: '🌱', threshold: 0,   color: '#aaa' },
      { level: 2, name: '썸',         emoji: '🌸', threshold: 10,  color: '#FF8FA3' },
      { level: 3, name: '연인',       emoji: '💗', threshold: 30,  color: '#FF6B8A' },
      { level: 4, name: '진지한 연인', emoji: '💖', threshold: 70,  color: '#FF4D6D' },
      { level: 5, name: '운명',       emoji: '💍', threshold: 150, color: '#c9184a' },
    ];

    const REL_KEY = 'lovia_relationship';

    function getRelationships() {
      try { return JSON.parse(sessionStorage.getItem(REL_KEY) || '{}'); }
      catch(e) { return {}; }
    }

    function saveRelationships(data) {
      try { sessionStorage.setItem(REL_KEY, JSON.stringify(data)); } catch(e) {}
    }

    function getRelationship(personaId) {
      const data = getRelationships();
      return data[personaId] || { chatCount: 0, level: 1 };
    }

    function updateRelationshipLevel(personaId) {
      const data = getRelationships();
      if (!data[personaId]) data[personaId] = { chatCount: 0, level: 1 };
      data[personaId].chatCount++;

      const prevLevel = data[personaId].level;
      // 레벨 계산
      let newLevel = 1;
      for (const lv of RELATIONSHIP_LEVELS) {
        if (data[personaId].chatCount >= lv.threshold) newLevel = lv.level;
      }

      if (newLevel > prevLevel) {
        data[personaId].level = newLevel;
        saveRelationships(data);
        // 레벨업 알림 표시 (AI 응답 후)
        setTimeout(() => showLevelUpToast(personaId, newLevel), 1500);
      } else {
        saveRelationships(data);
      }

      // 채팅 헤더 상태 업데이트
      updateChatHeaderLevel(personaId);
    }

    function showLevelUpToast(personaId, level) {
      const lv = RELATIONSHIP_LEVELS.find(l => l.level === level);
      if (!lv) return;
      const persona = PERSONAS.find(p => p.id === personaId);
      const name = persona ? persona.name : '그녀';

      const t = document.createElement('div');
      t.className = 'level-up-toast';
      t.innerHTML = `
        <div class="level-up-toast-inner">
          <span class="level-up-emoji">${lv.emoji}</span>
          <div class="level-up-text">
            <div class="level-up-title">${name}와의 관계가 변했어요!</div>
            <div class="level-up-sub">${lv.emoji} ${lv.name} 단계로 발전했습니다 💕</div>
          </div>
        </div>
      `;
      document.body.appendChild(t);
      requestAnimationFrame(() => t.classList.add('show'));
      setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 400);
      }, 3000);
    }

    function updateChatHeaderLevel(personaId) {
      const rel = getRelationship(personaId);
      const lv = RELATIONSHIP_LEVELS.find(l => l.level === rel.level);
      if (!lv) return;
      const statusEl = document.getElementById('chat-header-status-text');
      if (statusEl) statusEl.textContent = `${lv.emoji} ${lv.name}`;
      const levelBadge = document.getElementById('chat-level-badge');
      if (levelBadge) {
        levelBadge.textContent = `Lv.${rel.level} ${lv.name}`;
        levelBadge.style.color = lv.color;
      }
    }

    // 통계: 대화 중인 파트너 수
    function getActivePartnersCount() {
      let count = 0;
      PERSONAS.forEach(p => {
        const hist = loadChatHistory(p.id);
        if (hist && hist.length > 0) count++;
      });
      return count;
    }

    // 통계: 그램 좋아요 수
    function getGramLikesCount() {
      try {
        const liked = JSON.parse(sessionStorage.getItem('lovia_gram_likes') || '[]');
        return liked.length;
      } catch(e) { return 0; }
    }

    // 마이페이지 열기
    function openMypageScreen() {
      // 로그인 상태이면 서버에서 최신 크레딧/유저 정보 비동기 갱신
      const token = getAuthToken();
      if (token) {
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (data.user) {
              sessionStorage.setItem('lovia_username', data.user.nickname);
              sessionStorage.setItem('userName', data.user.nickname);
              setCredits(data.user.credits);
              // 마이페이지 크레딧 표시 갱신
              const creditEl2 = document.getElementById('mypage-credit-amount');
              if (creditEl2) creditEl2.textContent = data.user.credits;
              // 이름 표시 갱신
              const nameEl3 = document.getElementById('mypage-username');
              if (nameEl3) nameEl3.textContent = data.user.nickname;
              const avatarEl3 = document.getElementById('mypage-avatar');
              if (avatarEl3) avatarEl3.textContent = data.user.nickname.charAt(0).toUpperCase();
            }
          })
          .catch(() => {});
      }

      // 사용자 이름 가져오기
      const userName = sessionStorage.getItem('lovia_username') || '로비아 유저';
      const initial  = userName.charAt(0).toUpperCase();

      // 아바타 이니셜 표시
      const avatarEl = document.getElementById('mypage-avatar');
      if (avatarEl) avatarEl.textContent = initial;

      const nameEl = document.getElementById('mypage-username');
      if (nameEl) nameEl.textContent = userName;

      // 크레딧 표시
      const creditEl = document.getElementById('mypage-credit-amount');
      if (creditEl) creditEl.textContent = getCredits();

      // 통계
      const partnerEl = document.getElementById('mypage-stat-partners');
      if (partnerEl) partnerEl.textContent = getActivePartnersCount();

      const msgEl = document.getElementById('mypage-stat-msgs');
      if (msgEl) msgEl.textContent = getTotalMsgCount();

      const likeEl = document.getElementById('mypage-stat-likes');
      if (likeEl) likeEl.textContent = getGramLikesCount();

      // 출석 체크 버튼 상태
      renderDailyBtn();

      // 크레딧 내역 렌더링
      renderCreditHistory();

      // 대화 초기화 섹션 렌더링
      renderResetSection();

      // 선톡 알림 토글 상태 복원
      const toggle = document.getElementById('push-opt-toggle');
      if (toggle) {
        const saved = localStorage.getItem('lovia_push_opt_in');
        toggle.checked = saved === null ? true : saved === '1';
      }

      // ── 로그인 상태에 따른 UI 분기 ──────────────────────────
      const loggedIn = isLoggedIn();

      // 프로필 영역
      const loginBanner  = document.getElementById('mypage-login-banner');
      const logoutBtn    = document.getElementById('mypage-logout-btn');
      const userDescEl   = document.getElementById('mypage-user-desc');
      const legalSection = document.getElementById('mypage-legal-section');

      if (loginBanner)  loginBanner.style.display  = loggedIn ? 'none'         : 'block';
      if (logoutBtn)    logoutBtn.style.display     = loggedIn ? 'inline-block' : 'none';
      if (userDescEl)   userDescEl.style.display    = loggedIn ? 'block'        : 'none';
      if (legalSection) legalSection.style.display  = loggedIn ? 'block'        : 'none';

      // 비로그인: 아바타/이름 비표시
      const avatarEl2 = document.getElementById('mypage-avatar');
      const nameEl2   = document.getElementById('mypage-username');
      if (!loggedIn) {
        if (avatarEl2) avatarEl2.textContent = '👤';
        if (nameEl2)   nameEl2.textContent   = '비회원';
      }

      // 화면 표시
      const el = document.getElementById('mypage-screen');
      if (!el) return;
      el.style.display = 'flex';
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.25s';
        el.style.opacity    = '1';
        el.classList.add('visible');
      });
    }

    // 마이페이지 닫기
    // 마이페이지에서 로그인 화면으로 이동
    function goToLoginScreen() {
      closeMypageScreen();
      setTimeout(() => {
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.dataset.fromMypage = '1';
        showScreen('login-screen');
        setTimeout(() => {
          document.getElementById('login-email-input')?.focus();
        }, 400);
      }, 250);
    }

    // 로그아웃
    function doLogout() {
      if (!confirm('로그아웃 하시겠어요?')) return;
      localStorage.removeItem('lovia_auth_token');
      localStorage.removeItem('lovia_username');
      sessionStorage.removeItem('lovia_username');
      sessionStorage.removeItem('userName');
      // 마이페이지 UI 갱신
      const loginBanner = document.getElementById('mypage-login-banner');
      const logoutBtn   = document.getElementById('mypage-logout-btn');
      const legalSection2 = document.getElementById('mypage-legal-section');
      const userDescEl  = document.getElementById('mypage-user-desc');
      if (loginBanner)   loginBanner.style.display   = 'block';
      if (logoutBtn)     logoutBtn.style.display      = 'none';
      if (legalSection2) legalSection2.style.display  = 'none';
      if (userDescEl)    userDescEl.style.display      = 'none';
      const avatarEl = document.getElementById('mypage-avatar');
      const nameEl   = document.getElementById('mypage-username');
      if (avatarEl) avatarEl.textContent = '👤';
      if (nameEl)   nameEl.textContent   = '비회원';
      showMypageToast('👋 로그아웃 되었어요');
    }

    function closeMypageScreen() {
      const el = document.getElementById('mypage-screen');
      if (!el) return;
      el.style.transition = 'opacity 0.2s';
      el.style.opacity    = '0';
      setTimeout(() => {
        el.style.display = 'none';
        el.classList.remove('visible');
      }, 200);
    }

    // ─────────────────────────────
    // 대화 초기화
    // ─────────────────────────────
    let _resetTargetPersonaId = null; // 모달에서 사용할 타겟

    // 리셋 섹션 렌더링 (모든 페르소나 표시)
    function renderResetSection() {
      const list = document.getElementById('mypage-reset-list');
      if (!list) return;

      list.innerHTML = PERSONAS.map(p => {
        const hasChatHistory = !!(loadChatHistory(p.id)?.length);
        const hasStoryDone   = !!localStorage.getItem('story_done_' + p.id);
        const hasData        = hasChatHistory || hasStoryDone || isLoggedIn();
        const metaText       = hasChatHistory
          ? '대화 기록 있음'
          : (hasStoryDone ? '스토리 완료' : '대화 기록 없음');

        return `
          <div class="mypage-reset-card">
            <img class="mypage-reset-avatar" src="${getPersonaImg(p)}" alt="${p.name}" />
            <div class="mypage-reset-info">
              <div class="mypage-reset-name">${p.name}</div>
              <div class="mypage-reset-meta">${metaText}</div>
            </div>
            <button
              class="mypage-reset-btn"
              onclick="confirmResetPersona('${p.id}', '${p.name}')"
            >초기화</button>
          </div>
        `;
      }).join('');
    }

    // 확인 모달 열기
    function confirmResetPersona(personaId, personaName) {
      _resetTargetPersonaId = personaId;
      const modal     = document.getElementById('reset-confirm-modal');
      const titleEl   = document.getElementById('reset-modal-title');
      if (!modal) return;
      if (titleEl) titleEl.textContent = `${personaName}와의 대화를 초기화할까요?`;
      modal.style.display = 'flex';
    }

    // 확인 모달 닫기
    function closeResetModal() {
      const modal = document.getElementById('reset-confirm-modal');
      if (modal) modal.style.display = 'none';
      _resetTargetPersonaId = null;
    }

    // 실제 초기화 실행
    async function doResetPersona() {
      const personaId = _resetTargetPersonaId;
      if (!personaId) return;
      closeResetModal();

      const confirmBtn = document.querySelector('.reset-modal-confirm');

      // 1. sessionStorage 채팅 히스토리 삭제
      sessionStorage.removeItem('chat_' + personaId);
      // 현재 열린 채팅이 해당 페르소나면 history도 비움
      if (currentChatPersona?.id === personaId) {
        chatHistory = [];
      }

      // 2. localStorage 스토리 완료 플래그 삭제
      localStorage.removeItem('story_done_' + personaId);
      sessionStorage.removeItem('story_done_' + personaId);

      // 3. 로그인 유저: 서버 데이터 삭제
      if (isLoggedIn()) {
        try {
          const res = await fetch(`/api/chat/reset/${personaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
          });
          if (!res.ok) throw new Error('서버 초기화 실패');
        } catch (e) {
          showMypageToast('⚠️ 서버 초기화 중 오류가 발생했어요');
          return;
        }
      }

      // 4. 리셋 섹션 & 통계 갱신
      renderResetSection();
      const partnerEl = document.getElementById('mypage-stat-partners');
      if (partnerEl) partnerEl.textContent = getActivePartnersCount();

      showMypageToast('✅ 초기화 완료!');
    }

    // 출석 체크 버튼 렌더링
    function renderDailyBtn() {
      const today = new Date().toDateString();
      const claimed = sessionStorage.getItem(DAILY_KEY);
      const badge = document.getElementById('mypage-daily-badge');
      const btn   = document.getElementById('mypage-daily-btn');
      if (!badge || !btn) return;
      if (claimed === today) {
        badge.textContent = '수령 완료';
        badge.className   = 'mypage-free-btn-badge used';
        btn.style.opacity = '0.6';
        btn.style.pointerEvents = 'none';
      } else {
        badge.textContent = '+5';
        badge.className   = 'mypage-free-btn-badge';
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
      }
    }

    // 출석 체크 크레딧 수령
    function claimDailyCredit() {
      const today   = new Date().toDateString();
      const claimed = localStorage.getItem('lovia_daily_claim_date');
      if (claimed === today) {
        showMypageToast('✅ 오늘 출석 체크 완료!');
        return;
      }
      localStorage.setItem('lovia_daily_claim_date', today);
      addCredit(5);
      addCreditHistory('earn', '매일 출석 체크', 5);
      // 크레딧 카드 업데이트
      const creditEl = document.getElementById('mypage-credit-amount');
      if (creditEl) creditEl.textContent = getCredits();
      // 충전 화면 잔액 업데이트
      const chargeEl = document.getElementById('charge-current-credits');
      if (chargeEl) chargeEl.textContent = getCredits().toLocaleString();
      // 허브 크레딧 업데이트
      const hubCreditEl = document.getElementById('hub-credit-num');
      if (hubCreditEl) hubCreditEl.textContent = getCredits();
      updateDailyClaimBtn();
      // 완료 토스트
      showMypageToast('☀️ +5 크레딧 획득!');
    }

    // 크레딧 내역 렌더링
    function renderCreditHistory() {
      const list = document.getElementById('mypage-history-list');
      if (!list) return;
      const history = getCreditHistory();

      if (history.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:20px; color:rgba(255,255,255,0.3); font-size:13px;">아직 크레딧 내역이 없어요</div>';
        return;
      }

      list.innerHTML = history.map(h => `
        <div class="mypage-history-item">
          <div class="mypage-history-icon ${h.type}">${h.type === 'spend' ? '💬' : '✨'}</div>
          <div class="mypage-history-info">
            <div class="mypage-history-desc">${escapeHtml(h.desc)}</div>
            <div class="mypage-history-time">${h.time}</div>
          </div>
          <div class="mypage-history-amount ${h.type}">${h.type === 'spend' ? '-' : '+'}${h.amount}</div>
        </div>
      `).join('');
    }

    // 마이페이지용 토스트 (임시)
    function showMypageToast(msg) {
      const t = document.getElementById('credit-toast');
      if (!t) return;
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => {
        t.classList.remove('show');
        t.textContent = '💎 크레딧이 부족해요!'; // 원상복구
      }, 2000);
    }

    // ════════════════════════════════════════════
    // 크레딧 충전 화면
    // ════════════════════════════════════════════

    // 패키지 정보
    const CHARGE_PACKAGES = {
      starter: { name: 'Starter',    icon: '💌', credits: 200,  bonus: 0,    price: '₩990',    priceNum: 990,   chatCount: 400,   badge: '',    iapId: 'kr.lovia.credits.1200'  },
      basic:   { name: 'Basic',      icon: '🌸', credits: 200,  bonus: 0,    price: '₩2,200',  priceNum: 2200,  chatCount: 400,   badge: '',    iapId: null                     },
      recom:   { name: 'Recommended',icon: '💝', credits: 550,  bonus: 50,   price: '₩5,500',  priceNum: 5500,  chatCount: 1200,  badge: '추천', iapId: 'kr.lovia.credits.5500'  },
      premium: { name: 'Premium',    icon: '💖', credits: 1200, bonus: 200,  price: '₩11,000', priceNum: 11000, chatCount: 2800,  badge: '인기', iapId: 'kr.lovia.credits.11000' },
      vvip:    { name: 'VVIP',       icon: '👑', credits: 6500, bonus: 1500, price: '₩55,000', priceNum: 55000, chatCount: 16000, badge: 'BEST', iapId: 'kr.lovia.credits.55000' },
    };
    let _selectedPkg = null;

    // ── 네이티브 앱 환경 감지 ────────────────────────────────────
    function isNativeIAP() {
      return !!(window.LOVIA_IAP_AVAILABLE ||
                window.webkit?.messageHandlers?.iap ||
                window.LoviaAndroid);
    }

    function getNativeEnv() {
      if (window.LOVIA_NATIVE_ENV) return window.LOVIA_NATIVE_ENV;
      if (window.webkit?.messageHandlers?.iap) return 'ios';
      if (window.LoviaAndroid) return 'android';
      return null;
    }

    // ── 네이티브 IAP 결제 ────────────────────────────────────────
    function startNativeIAP(iapId) {
      const token = getAuthToken() || '';
      if (window.webkit?.messageHandlers?.iap) {
        // iOS WKWebView bridge
        window.webkit.messageHandlers.iap.postMessage({
          action: 'purchase',
          productId: iapId,
          authToken: token
        });
      } else if (window.LoviaAndroid) {
        // Android WebView bridge
        window.LoviaAndroid.setAuthToken(token);
        window.LoviaAndroid.requestPurchase(iapId, token);
      }
    }

    // ── 네이티브 IAP 이벤트 수신 ─────────────────────────────────
    window.addEventListener('loviaIAP', function(e) {
      const detail = e.detail;
      if (!detail) return;

      // 결제 진행 중 버튼 복원
      const okBtn = document.querySelector('.confirm-btn-ok');

      switch (detail.event) {
        case 'purchase_success': {
          const credits = detail.credits || 0;
          const newTotal = detail.newTotal || 0;

          // 서버에서 이미 지급됨 → 로컬 상태만 동기화
          setCredits(newTotal);

          const pkg = _selectedPkg ? CHARGE_PACKAGES[_selectedPkg] : null;
          if (pkg) addCreditHistory('earn', pkg.name + ' 구매 (IAP)', credits);

          // UI 업데이트
          ['charge-current-credits', 'mypage-credit-amount'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = newTotal.toLocaleString();
          });
          const hubEl = document.getElementById('hub-credit-num');
          if (hubEl) hubEl.textContent = newTotal;

          document.getElementById('charge-confirm-overlay')?.classList.remove('visible');
          showChargeSuccessToast(credits);
          _selectedPkg = null;
          if (okBtn) { okBtn.disabled = false; okBtn.textContent = '결제하기 💳'; }
          break;
        }
        case 'purchase_cancelled':
          if (okBtn) { okBtn.disabled = false; okBtn.textContent = '결제하기 💳'; }
          break;
        case 'purchase_failed': {
          const msg = detail.error || '결제에 실패했습니다.';
          alert(msg);
          if (okBtn) { okBtn.disabled = false; okBtn.textContent = '결제하기 💳'; }
          break;
        }
        default:
          break;
      }
    });

    // 충전 화면 열기
    function openChargeScreen() {
      if (!isLoggedIn()) {
        showSignupPopup('charge');
        return;
      }

      // 현재 잔액 업데이트
      const el = document.getElementById('charge-current-credits');
      if (el) el.textContent = getCredits().toLocaleString();

      // 일일 출석 버튼 상태 업데이트
      updateDailyClaimBtn();

      // 화면 표시
      const screen = document.getElementById('charge-screen');
      screen.style.display = 'flex';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          screen.classList.add('visible');
        });
      });
    }

    // 충전 화면 닫기
    function closeChargeScreen() {
      const screen = document.getElementById('charge-screen');
      screen.classList.remove('visible');
      setTimeout(() => { screen.style.display = 'none'; }, 350);
      // 마이페이지 크레딧 내역 새로고침
      renderCreditHistory();
      const creditEl = document.getElementById('mypage-credit-amount');
      if (creditEl) creditEl.textContent = getCredits();
    }

    // 일일 출석 버튼 상태 업데이트
    function updateDailyClaimBtn() {
      const btn = document.getElementById('daily-claim-btn');
      if (!btn) return;
      const lastClaim = localStorage.getItem('lovia_daily_claim_date');
      const today = new Date().toDateString();
      if (lastClaim === today) {
        btn.textContent = '완료 ✓';
        btn.disabled = true;
      } else {
        btn.textContent = '받기';
        btn.disabled = false;
      }
    }

    // 패키지 선택 → 확인 팝업 표시
    function selectPackage(pkgKey) {
      const pkg = CHARGE_PACKAGES[pkgKey];
      if (!pkg) return;
      _selectedPkg = pkgKey;

      document.getElementById('confirm-pkg-icon').textContent     = pkg.icon;
      document.getElementById('confirm-pkg-title').textContent    = pkg.name;
      const totalCredits = pkg.credits + (pkg.bonus || 0);
      const bonusStr = pkg.bonus ? ` (+${pkg.bonus} 보너스)` : '';
      document.getElementById('confirm-pkg-credits').textContent  = totalCredits.toLocaleString() + ' 크레딧' + bonusStr;
      document.getElementById('confirm-pkg-price').textContent    = '정가 ' + pkg.price;

      // 네이티브 환경에서는 버튼 텍스트/결제 수단 표시 변경
      const okBtn = document.querySelector('.confirm-btn-ok');
      const methodsEl = document.querySelector('.confirm-sheet-methods');
      const safeEl = document.querySelector('.confirm-sheet-safe');
      if (isNativeIAP() && pkg.iapId) {
        if (okBtn) okBtn.textContent = getNativeEnv() === 'ios' ? '앱스토어 결제 💳' : '구글 플레이 결제 💳';
        if (methodsEl) methodsEl.style.display = 'none';
        if (safeEl) safeEl.textContent = getNativeEnv() === 'ios' ? '🔒 Apple 인앱결제' : '🔒 Google Play 인앱결제';
      } else {
        if (okBtn) okBtn.textContent = '결제하기 💳';
        if (methodsEl) methodsEl.style.display = '';
        if (safeEl) safeEl.textContent = '🔒 토스페이먼츠 안전 결제';
      }

      const overlay = document.getElementById('charge-confirm-overlay');
      overlay.classList.add('visible');
    }

    // 구매 확인 팝업 닫기
    function cancelChargePurchase(e) {
      if (e && e.target !== document.getElementById('charge-confirm-overlay')) return;
      const overlay = document.getElementById('charge-confirm-overlay');
      overlay.classList.remove('visible');
      _selectedPkg = null;
    }

    // ── Toss Payments 결제 시작 ─────────────────────────────
    const TOSS_CLIENT_KEY = 'test_ck_Z61JOxRQVEnqBEB7oMj0rW0X9bAq';

    async function startTossPayment() {
      if (!_selectedPkg) return;
      const pkg = CHARGE_PACKAGES[_selectedPkg];

      const okBtn = document.querySelector('.confirm-btn-ok');
      if (okBtn) { okBtn.disabled = true; okBtn.textContent = '결제창 열기...'; }

      // 네이티브 앱에서는 IAP 결제 사용
      if (isNativeIAP() && pkg.iapId) {
        startNativeIAP(pkg.iapId);
        return; // 결제 결과는 loviaIAP 이벤트로 수신
      }
      if (isNativeIAP() && !pkg.iapId) {
        // IAP 미지원 패키지 (basic 등)는 안내 후 종료
        if (okBtn) { okBtn.disabled = false; okBtn.textContent = '결제하기 💳'; }
        alert('이 패키지는 앱 내 결제를 지원하지 않습니다. 웹에서 이용해주세요.');
        return;
      }

      try {
        // Toss SDK 동적 로드
        if (!window.TossPayments) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://js.tosspayments.com/v2/standard';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }

        const toss = TossPayments(TOSS_CLIENT_KEY);
        const payment = toss.payment({ customerKey: getAuthToken()?.slice(-20) || 'guest' });

        // orderId: lovia_{pkgKey}_{timestamp}
        const orderId = `lovia_${_selectedPkg}_${Date.now()}`;

        await payment.requestPayment({
          method: 'CARD',
          amount: { currency: 'KRW', value: pkg.priceNum },
          orderId,
          orderName: `Lovia ${pkg.name} (${pkg.credits} 크레딧)`,
          successUrl: window.location.origin + '/payment/success',
          failUrl:    window.location.origin + '/payment/fail',
          customerEmail: sessionStorage.getItem('lovia_email') || undefined,
          customerName:  sessionStorage.getItem('lovia_username') || 'Lovia 유저',
          card: { useEscrow: false, flowMode: 'DEFAULT', useCardPoint: false }
        });

      } catch (e) {
        // 사용자가 결제창 닫거나 실패
        if (e?.code !== 'USER_CANCEL') {
          console.warn('[Toss] 결제 오류:', e?.message || e);
        }
        if (okBtn) { okBtn.disabled = false; okBtn.textContent = '결제하기 💳'; }
      }
    }

    // 결제 완료 후 앱 복귀 처리 — goToVideo()에서 sessionStorage로 처리됨
    function checkPaymentReturn() { /* 더 이상 사용 안 함 */ }

    // 구매 확정 → 크레딧 지급 + D1 기록 (테스트/무료 지급용 — 유지)
    async function confirmChargePurchase() {
      if (!_selectedPkg) return;
      const pkg = CHARGE_PACKAGES[_selectedPkg];

      // 확인 버튼 비활성화 (중복 클릭 방지)
      const okBtn = document.querySelector('.confirm-btn-ok');
      if (okBtn) { okBtn.disabled = true; okBtn.textContent = '처리 중...'; }

      // 팝업 닫기
      document.getElementById('charge-confirm-overlay').classList.remove('visible');

      // 크레딧 지급 (로컬)
      const before = getCredits();
      const after  = before + pkg.credits;
      setCredits(after);
      addCreditHistory('earn', pkg.name + ' 구매', pkg.credits);

      // 충전 화면 잔액 업데이트
      const el = document.getElementById('charge-current-credits');
      if (el) el.textContent = after.toLocaleString();

      // 마이페이지 크레딧 표시도 업데이트
      const mypageEl = document.getElementById('mypage-credit-amount');
      if (mypageEl) mypageEl.textContent = after.toLocaleString();

      // 채팅 허브 상단 크레딧 표시 업데이트
      const hubCreditEl = document.getElementById('hub-credit-num');
      if (hubCreditEl) hubCreditEl.textContent = after;

      // D1에 기록 (로그인 유저)
      const token = getAuthToken();
      if (token) {
        try {
          await fetch('/api/credits/add', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              amount: pkg.credits,
              reason: pkg.name + ' (테스트 지급)',
              type: 'earn'
            })
          });
        } catch (e) { /* 실패 무시 */ }
      }

      // 성공 토스트
      showChargeSuccessToast(pkg.credits);
      _selectedPkg = null;

      // 확인 버튼 복원
      if (okBtn) { okBtn.disabled = false; okBtn.textContent = '지금 받기 🎁'; }
    }

    // 충전 성공 토스트 (눈에 잘 띄는 버전)
    function showChargeSuccessToast(credits) {
      // 기존 credit-toast 엘리먼트 활용
      const toast = document.getElementById('credit-toast');
      if (!toast) return;
      const prev = toast.textContent;
      toast.textContent = `💎 ${credits.toLocaleString()} 크레딧 지급 완료!`;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        toast.textContent = prev;
      }, 3000);
    }

    // 친구 초대 (준비 중)
    function openShareScreen() {
      showMypageToast('🔗 친구 초대 기능은 준비 중이에요!');
    }

    // ─── sendMessage에 내역 기록 패치 ───
    // sendMessage 호출 시 내역 자동 기록 (기존 spendCredit 래핑)
    const _origSpendCredit = spendCredit;
    // (이미 spendCredit 함수에서 처리 — sendMessage에서 직접 호출)

    // ─── 마이페이지 이벤트 바인딩 ───
    (function initMypage() {
      // mypage-screen 스크롤 이슈 없도록 overflow 처리는 CSS에서
    })();



    // ─────────────────────────────
    // 채팅 입력 초기화 (앱 시작 시 딱 1회)
    // ─────────────────────────────
    setupChatInput();

    // 결제 완료 후 앱 복귀 체크
    checkPaymentReturn();

    // ════════════════════════════════════════════
    // 회원가입 유도 시스템
    // ════════════════════════════════════════════

    const AUTH_TOKEN_KEY = 'lovia_auth_token';
    const SIGNUP_MSG_THRESHOLD = 10; // 메시지 n개 후 팝업
    let _signupPopupShown = false;   // 세션 중 한 번만 표시

    // 저장된 토큰 확인
    function getAuthToken() {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }

    // 가입된 유저인지 확인
    function isLoggedIn() {
      return !!getAuthToken();
    }

    // 로그인 상태 저장
    function saveAuthToken(token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }

    // 팝업 트리거 체크 (메시지 카운트 기반)
    function checkSignupTrigger() {
      if (isLoggedIn()) return;           // 이미 가입된 유저
      if (_signupPopupShown) return;      // 이미 이번 세션에 표시됨
      const count = parseInt(sessionStorage.getItem('lovia_msg_count') || '0');
      if (count >= SIGNUP_MSG_THRESHOLD) {
        showSignupPopup('chat');
      }
    }

    // 팝업 열기
    function showSignupPopup(trigger) {
      if (isLoggedIn()) return;
      _signupPopupShown = true;

      // 트리거별 안내 문구 변경
      const desc = document.getElementById('signup-popup-desc');
      if (desc) {
        if (trigger === 'charge') {
          desc.innerHTML = '크레딧을 충전하려면 무료 회원가입이 필요해요.<br>가입하면 크레딧 <span style="color:#FF6B8A;font-weight:700;">+100</span> 보너스도 드려요 🎁';
        } else {
          desc.innerHTML = '대화 기록을 저장하고 더 이어가려면<br>무료 회원가입을 해주세요. 크레딧 <span style="color:#FF6B8A;font-weight:700;">+100</span> 보너스 지급! 🎁';
        }
      }

      // 닉네임 자동 채우기
      const nickInput = document.getElementById('signup-nickname-input');
      if (nickInput) {
        const savedName = sessionStorage.getItem('lovia_username') || sessionStorage.getItem('userName') || '';
        nickInput.value = savedName;
      }

      const overlay = document.getElementById('signup-overlay');
      if (overlay) {
        overlay.classList.add('active');
        overlay.style.display = 'flex';
      }
    }

    // 팝업 닫기
    function closeSignupPopup() {
      const overlay = document.getElementById('signup-overlay');
      if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
      }
      document.getElementById('signup-error-msg').textContent = '';
    }

    // 가입 제출
    async function submitSignup() {
      const emailEl    = document.getElementById('signup-email-input');
      const nickEl     = document.getElementById('signup-nickname-input');
      const errEl      = document.getElementById('signup-error-msg');
      const submitBtn  = document.getElementById('signup-submit-btn');

      const email    = emailEl.value.trim();
      const nickname = nickEl.value.trim();

      // 유효성 검사
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = '올바른 이메일 주소를 입력해주세요.';
        emailEl.focus();
        return;
      }
      if (!nickname || nickname.length < 1) {
        errEl.textContent = '닉네임을 입력해주세요.';
        nickEl.focus();
        return;
      }

      // 버튼 로딩 상태
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
      errEl.textContent = '';

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, nickname })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          errEl.textContent = data.error || '가입 중 오류가 발생했습니다.';
          submitBtn.disabled = false;
          submitBtn.textContent = '무료로 시작하기 🎁';
          return;
        }

        // 토큰 저장
        saveAuthToken(data.token);

        // 닉네임 동기화 (기존 세션 이름 유지)
        sessionStorage.setItem('lovia_username', data.user.nickname);
        sessionStorage.setItem('userName', data.user.nickname);

        // 가입 보너스 크레딧 지급
        if (data.isNew && data.bonusCredits > 0) {
          const current = parseInt(sessionStorage.getItem('lovia_credits') || '50');
          const newTotal = current + data.bonusCredits;
          setCredits(newTotal);
          addCreditHistory('earn', '회원가입 보너스', data.bonusCredits);
        }

        // 팝업 닫기
        closeSignupPopup();

        // 성공 토스트 표시
        showSignupSuccessToast(data.isNew, data.bonusCredits);

        // 신규 가입자의 경우 기존 sessionStorage 대화를 D1에 백그라운드 업로드
        if (data.isNew) {
          uploadExistingHistoryToD1(data.token).then(() => {
            console.log('[D1] 기존 대화 이력 업로드 완료');
          });
        }

        // 푸시 알림 권한 요청 (로그인 성공 후)
        setTimeout(tryRequestPushAfterLogin, 2500);

      } catch (e) {
        errEl.textContent = '네트워크 오류가 발생했습니다. 다시 시도해주세요.';
        submitBtn.disabled = false;
        submitBtn.textContent = '무료로 시작하기 🎁';
      }
    }

    // 가입 성공 토스트
    function showSignupSuccessToast(isNew, bonus) {
      const toast = document.getElementById('signup-success-toast');
      if (!toast) return;
      toast.textContent = isNew
        ? `🎉 가입 완료! 크레딧 +${bonus} 지급됐어요`
        : `👋 다시 오셨네요! 대화를 이어가세요`;
      toast.style.display = 'block';
      toast.style.animation = 'toastFadeIn 0.3s ease';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    // 앱 시작 시 이미 로그인된 유저인지 확인
    (function initAuth() {
      const token = getAuthToken();
      if (token) {
        // JWT exp 클라이언트 사이드 체크 (서명 검증 없이 만료 여부만 확인)
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const nowSec = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < nowSec) {
            // 이미 만료됨 → 즉시 정리
            localStorage.removeItem('lovia_auth_token');
            console.warn('[Auth] JWT 만료됨, 토큰 삭제');
          }
        } catch(_) {}

        // 토큰이 있으면 서버에서 유저 정보 갱신 (비동기, 조용히)
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => {
            if (r.status === 401) {
              // 서버에서 401 → 토큰 무효, 삭제
              localStorage.removeItem('lovia_auth_token');
              console.warn('[Auth] 서버 401, 토큰 삭제');
              return null;
            }
            return r.json();
          })
          .then(data => {
            if (data && data.user) {
              sessionStorage.setItem('lovia_username', data.user.nickname);
              sessionStorage.setItem('userName', data.user.nickname);
              // 서버 크레딧을 항상 우선 적용 (세션 초기화 후에도 정확한 크레딧 유지)
              const serverCredits = data.user.credits;
              setCredits(serverCredits);
              // 마이페이지가 열려있으면 크레딧 표시 갱신
              const creditEl = document.getElementById('mypage-credit-amount');
              if (creditEl) creditEl.textContent = serverCredits;
            }
          })
          .catch(() => {}); // 조용히 실패
      }
    })();

    // ════════════════════════════════════════════
    // 로그인 화면 로직
    // ════════════════════════════════════════════

    // 이메일로 로그인 시도
    async function submitLogin() {
      const emailEl  = document.getElementById('login-email-input');
      const errEl    = document.getElementById('login-error-msg');
      const submitBtn = document.getElementById('login-submit-btn');

      const email = emailEl.value.trim();
      errEl.textContent = '';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = '올바른 이메일 주소를 입력해주세요.';
        emailEl.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '확인 중...';

      try {
        // 이메일로 기존 회원 조회 (register API는 기존 회원이면 로그인 처리)
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, nickname: '' }) // nickname 없으면 서버에서 기존 값 유지
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          errEl.textContent = '가입된 이메일을 찾을 수 없어요. 새 계정으로 시작해보세요.';
          submitBtn.disabled = false;
          submitBtn.textContent = '로그인';
          return;
        }

        // 로그인 성공
        saveAuthToken(data.token);
        sessionStorage.setItem('lovia_username', data.user.nickname);
        sessionStorage.setItem('userName', data.user.nickname);
        if (data.user.credits !== undefined) {
          sessionStorage.setItem('lovia_credits', String(data.user.credits));
        }

        // 푸시 알림 권한 요청 (로그인 성공 후)
        setTimeout(tryRequestPushAfterLogin, 2500);

        // 로그인 화면 숨기고 스와이프로 이동 (또는 마이페이지로 복귀)
        const loginScreen = document.getElementById('login-screen');
        loginScreen.style.transition = 'opacity 0.4s ease';
        loginScreen.style.opacity = '0';
        const fromMypage = loginScreen.dataset.fromMypage === '1';
        setTimeout(() => {
          loginScreen.style.display = 'none';
          loginScreen.dataset.fromMypage = '';
          if (fromMypage) {
            // 마이페이지에서 로그인 → 마이페이지 재오픈
            openMypageScreen();
          } else {
            initSwipeAndGo();
          }
        }, 400);

      } catch (e) {
        errEl.textContent = '네트워크 오류가 발생했어요. 다시 시도해주세요.';
        submitBtn.disabled = false;
        submitBtn.textContent = '로그인';
      }
    }

    // 구글 OAuth 로그인 시작
    function loginWithGoogle() {
      window.location.href = '/api/auth/google';
    }

    // 구글 OAuth 콜백 처리 (URL 파라미터 ?google_token=... 감지)
    (function handleGoogleCallback() {
      const params = new URLSearchParams(window.location.search);
      const googleToken = params.get('google_token');
      const googleError = params.get('google_error');

      if (googleError) {
        // URL 정리
        const url = new URL(window.location.href);
        url.searchParams.delete('google_error');
        window.history.replaceState({}, '', url.toString());

        const messages = {
          cancelled: '구글 로그인이 취소되었습니다.',
          config: '구글 로그인 설정이 완료되지 않았습니다.',
          token: '구글 인증에 실패했습니다. 다시 시도해주세요.',
          userinfo: '구글 계정 정보를 가져오지 못했습니다.',
          server: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        };
        alert(messages[googleError] || '구글 로그인에 실패했습니다.');
        return;
      }

      if (googleToken) {
        const isNew = params.get('is_new') === '1';
        // URL 정리
        const url = new URL(window.location.href);
        url.searchParams.delete('google_token');
        url.searchParams.delete('is_new');
        window.history.replaceState({}, '', url.toString());

        // 토큰 저장 및 사용자 정보 로드
        localStorage.setItem('lovia_auth_token', googleToken);
        try {
          const payload = JSON.parse(atob(googleToken.split('.')[1]));
          if (payload.nickname) sessionStorage.setItem('lovia_nickname', payload.nickname);
          if (payload.email)    sessionStorage.setItem('lovia_email',    payload.email);
        } catch (e) { /* ignore */ }

        // 팝업/로그인 화면 닫기
        const signupOverlay = document.getElementById('signup-overlay');
        if (signupOverlay) signupOverlay.style.display = 'none';
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) { loginScreen.style.opacity = '0'; loginScreen.style.display = 'none'; }

        if (typeof showSignupSuccessToast === 'function') {
          showSignupSuccessToast(isNew, isNew ? 100 : 0);
        }

        // UI 갱신
        if (typeof updateMypageUI === 'function') updateMypageUI();
        if (typeof updateCreditDisplay === 'function') updateCreditDisplay();
      }
    })();

    // 새 계정으로 시작 → 기존 온보딩 플로우 진행
    function startFreshOnboarding() {
      const loginScreen = document.getElementById('login-screen');
      loginScreen.style.transition = 'opacity 0.4s ease';
      loginScreen.style.opacity = '0';
      setTimeout(() => {
        loginScreen.style.display = 'none';
        loginScreen.dataset.fromMypage = '';
        // 스플래시가 살아있으면 인트로 비디오로, 없으면 바로 이름 입력으로
        const splash = document.getElementById('splash');
        const splashVisible = splash && splash.style.display !== 'none';
        if (splashVisible) {
          showIntroVideo();
        } else {
          // 스플래시 없는 상태 → 이름 입력 화면으로 바로 이동
          showScreen('name-input-screen');
        }
      }, 400);
    }

    // 로그인 입력창 엔터키 처리
    (function() {
      const loginInput = document.getElementById('login-email-input');
      if (loginInput) {
        loginInput.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitLogin();
          }
        });
      }
    })();

    // ════════════════════════════════════════════
    // D1 저장 & 장기 기억 시스템
    // ════════════════════════════════════════════

    // 메시지 1건을 D1에 저장 (로그인 유저만, 비동기 fire-and-forget)
    function saveMessageToD1(role, content) {
      const token = getAuthToken();
      if (!token || !currentChatPersona) return;
      fetch('/api/history/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          personaId: currentChatPersona.id,
          role,
          content
        })
      }).catch(() => {}); // 저장 실패해도 채팅 흐름에 영향 없음
    }

    // 장기 기억 요약 트리거 (10턴마다 백그라운드 실행)
    function triggerMemorySummarize() {
      const token = getAuthToken();
      if (!token || !currentChatPersona) return;
      fetch('/api/memory/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ personaId: currentChatPersona.id })
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok) console.log('[Memory] 요약 완료:', d.summary?.slice(0, 50));
        })
        .catch(() => {});
    }

    // 회원가입 후 기존 sessionStorage 대화를 D1에 일괄 업로드
    async function uploadExistingHistoryToD1(token) {
      const personas = ['minji', 'jiwoo', 'hayoung', 'eunbi', 'dahee'];
      for (const personaId of personas) {
        try {
          const raw = sessionStorage.getItem('chat_' + personaId);
          if (!raw) continue;
          const history = JSON.parse(raw);
          if (!Array.isArray(history) || history.length === 0) continue;

          // 메시지 순서대로 D1에 저장
          for (const entry of history) {
            if (entry.role !== 'me' && entry.role !== 'ai') continue;
            await fetch('/api/history/save', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                personaId,
                role: entry.role,
                content: entry.text
              })
            }).catch(() => {});
          }
          console.log(`[D1 업로드] ${personaId}: ${history.length}건 완료`);
        } catch(e) {}
      }
    }

    // ─────────────────────────────
    // window 전역 등록
    // ─────────────────────────────
    window.goToNextScreen    = goToNextScreen;
    window.goToProfileSwipe  = goToProfileSwipe;
    window.goToProfile       = goToProfile;
    window.goBackToSwipe     = goBackToSwipe;
    window.goBackFromChat    = goBackFromChat;
    window.goBackFromHub     = goBackFromHub;
    window.sendMessage       = sendMessage;
    window.swipeCard         = swipeCard;
    window.switchView        = switchView;
    window.openHub           = openHub;
    window.openPickScreen    = openPickScreen;
    window.closePickScreen   = closePickScreen;
    window.switchPickTab     = switchPickTab;
    window.closeTutorial     = closeTutorial;
    window.startChat         = startChat;
    window.openProfileDetail = openProfileDetail;
    window.openGramScreen    = openGramScreen;
    window.closeGramScreen   = closeGramScreen;
    window.openGramFromChat  = openGramFromChat;
    window.openMypageScreen  = openMypageScreen;
    window.closeMypageScreen = closeMypageScreen;
    window.goToLoginScreen   = goToLoginScreen;
    window.doLogout          = doLogout;
    window.claimDailyCredit      = claimDailyCredit;
    window.openChargeScreen      = openChargeScreen;
    window.closeChargeScreen     = closeChargeScreen;
    window.openShareScreen       = openShareScreen;
    window.selectPackage         = selectPackage;
    window.cancelChargePurchase  = cancelChargePurchase;
    window.confirmChargePurchase = confirmChargePurchase;
    window.startTossPayment      = startTossPayment;
    // 푸시 알림
    window.requestPushPermission    = requestPushPermission;
    window.tryRequestPushAfterLogin = tryRequestPushAfterLogin;
    window.setPushOptIn             = setPushOptIn;
    // 회원가입 팝업
    window.showSignupPopup   = showSignupPopup;
    window.closeSignupPopup  = closeSignupPopup;
    window.submitSignup      = submitSignup;
    window.submitLogin       = submitLogin;
    window.startFreshOnboarding = startFreshOnboarding;
    window.loginWithGoogle       = loginWithGoogle;
    window.skipRecommendation    = skipRecommendation;
  