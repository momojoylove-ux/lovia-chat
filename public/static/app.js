
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

    // ── Google OAuth 콜백 조기 감지 (스플래시 스킵용) ──
    const _oauthCallbackParams = new URLSearchParams(window.location.search);
    const _googleOAuthToken = _oauthCallbackParams.get('google_token');
    const _googleOAuthIsNew = _oauthCallbackParams.get('is_new') === '1';
    if (_googleOAuthToken) {
      localStorage.setItem('lovia_auth_token', _googleOAuthToken);
      try {
        const _payload = JSON.parse(atob(_googleOAuthToken.split('.')[1]));
        if (_payload.nickname) sessionStorage.setItem('lovia_nickname', _payload.nickname);
        if (_payload.email)    sessionStorage.setItem('lovia_email',    _payload.email);
      } catch(e) { /* ignore */ }
      const _cleanUrl = new URL(window.location.href);
      _cleanUrl.searchParams.delete('google_token');
      _cleanUrl.searchParams.delete('is_new');
      window.history.replaceState({}, '', _cleanUrl.toString());
    }

    // 2.5초 후 무조건 동영상으로 전환 (단 한 번만 실행)
    let splashDone = false;
    async function goToVideo() {
      if (splashDone) return;
      splashDone = true;

      // ── Google OAuth 콜백 처리 (스플래시 스킵) ──
      if (_googleOAuthToken) {
        const splash = document.getElementById('splash');
        if (splash) splash.style.display = 'none';
        const token = localStorage.getItem('lovia_auth_token');
        try {
          const meRes = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
          if (meRes.ok) {
            const meData = await meRes.json();
            const user = meData.user;
            sessionStorage.setItem('lovia_username', user.nickname);
            sessionStorage.setItem('userName', user.nickname);
            if (user.credits !== undefined) sessionStorage.setItem('lovia_credits', String(user.credits));
          }
        } catch(e) { /* ignore */ }
        if (_googleOAuthIsNew) {
          // 신규 유저: 온보딩 완료 여부 확인
          let onboardingDone = false;
          try {
            const obRes = await fetch('/api/onboarding/status', { headers: { 'Authorization': `Bearer ${token}` } });
            if (obRes.ok) {
              const obData = await obRes.json();
              onboardingDone = obData.completed;
            }
          } catch(e) { /* ignore */ }
          if (onboardingDone) {
            initSwipeAndGo();
          } else {
            showIntroVideo();
          }
        } else {
          // 기존 유저 → 캐릭터 선택(스와이프)
          initSwipeAndGo();
        }
        setTimeout(tryRequestPushAfterLogin, 3000);
        return;
      }

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
            // ✅ 유효한 토큰 → 온보딩 스킵, 스와이프로 바로 이동
            const user = data.user;
            sessionStorage.setItem('lovia_username', user.nickname);
            sessionStorage.setItem('userName', user.nickname);
            // 크레딧 복원 (DB 값 우선)
            if (user.credits !== undefined) {
              sessionStorage.setItem('lovia_credits', String(user.credits));
            }
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
    }

    setTimeout(goToVideo, _googleOAuthToken ? 0 : 2500);
    // 혹시 첫 타이머가 막혀도 5초 후 강제 실행
    setTimeout(goToVideo, _googleOAuthToken ? 0 : 5000);

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
    const PERSONAS = [
      {
        id: 'minji',
        name: '민지',
        age: 27,
        job: '종합병원 응급실 간호사',
        tags: ['#다정한', '#츤데레', '#책임감강한', '#밤샘전문'],
        quote: '환자들 앞에서는 엄격하지만, 오빠 앞에선 그냥 민지 할래요.',
        img: '/images/profiles/profile_minji.jpg'
      },
      {
        id: 'jiwoo',
        name: '지우',
        age: 20,
        job: '경영학과 신입생 (과대표)',
        tags: ['#풋풋한', '#호기심많은', '#열정적인', '#첫사랑상'],
        quote: '캠퍼스 메이트보다는, 오빠의 원픽 메이트가 되고 싶어요!',
        img: '/images/profiles/profile_jiwoo.jpg'
      },
      {
        id: 'hayoung',
        name: '하영',
        age: 28,
        job: '대기업 임원 수행 비서',
        tags: ['#지적인', '#철두철미한', '#은근허당', '#고양이상'],
        quote: '회장님 스케줄보다 오빠랑 보낼 저녁 시간이 더 중요해요.',
        img: '/images/profiles/profile_hayoung.jpg'
      },
      {
        id: 'eunbi',
        name: '은비',
        age: 24,
        job: '프리랜서 UI/UX 디자이너',
        tags: ['#감성적인', '#섬세한', '#집순이', '#야행성'],
        quote: '내 세상의 모든 픽셀을 오빠라는 색으로 채우는 중이에요.',
        img: '/images/profiles/profile_eunbi.jpg'
      },
      {
        id: 'dahee',
        name: '다희',
        age: 23,
        job: '프리랜서 피팅/비키니 모델',
        tags: ['#섹시한', '#솔직한', '#외로움타는', '#반전매력'],
        quote: '사진 속 가짜 미소 말고, 오빠 앞에서만 짓는 진짜 웃음 찾아줄래요?',
        img: '/images/profiles/profile_dahee.jpg'
      }
    ];

    // 튜토리얼 전용 페르소나 (스와이프 목록에는 노출 안 됨)
    const SUAH_PERSONA = {
      id: 'suah',
      name: '수아',
      age: 25,
      job: '헬스 트레이너 (신입)',
      tags: ['#열정적인', '#서툴지만', '#귀여운'],
      quote: '잘... 잘 부탁드려요!',
      img: '/images/profiles/profile_suah.jpg',
      tutorial: true
    };

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
      buildCardStack();
      buildListView();
      buildCounter();

      // 허브 버튼: 채팅 이력이 있을 때만 표시
      updateHubBtn();
      // 픽 버튼: 관심/패스 이력이 있을 때만 표시
      updatePickBtn();

      // 튜토리얼: 첫 방문 시에만 표시 (sessionStorage로 상태 관리)
      const tutorialSeen = sessionStorage.getItem('lovia_tutorial_seen');
      if (!tutorialSeen) {
        setTimeout(() => showTutorial(), 400); // 화면 전환 후 살짝 딜레이
      }
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
          + '<img class="pick-card-img" src="' + p.img + '" alt="' + p.name + '" />'
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
      for (let i = PERSONAS.length - 1; i >= 0; i--) {
        stack.appendChild(createCard(PERSONAS[i], i));
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
        <img class="card-img" src="${persona.img}" alt="${persona.name}" draggable="false" />
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
      const swipedPersona = PERSONAS[currentCardIdx];
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
        // 전체 소진 → 루프 재시작
        setTimeout(() => {
          // 소진 알림 잠깐 보여주기
          const stack = document.getElementById('card-stack');
          stack.innerHTML = '<div style="color:#aaa;font-size:14px;text-align:center;padding:40px 20px;">모든 파트너를 확인했어요!<br>처음부터 다시 볼게요 💕<\/div>';
          setTimeout(() => buildCardStack(), 1500);
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
      counterEl.innerHTML = PERSONAS.map((_, i) =>
        `<div class="counter-dot ${i === 0 ? 'active' : ''}" id="dot-${i}"></div>`
      ).join('');
    }

    function updateCounterDots() {
      PERSONAS.forEach((_, i) => {
        const dot = document.getElementById(`dot-${i}`);
        if (dot) dot.className = `counter-dot ${i === currentCardIdx ? 'active' : ''}`;
      });
    }

    function buildListView() {
      const listEl = document.getElementById('list-items');
      listEl.innerHTML = PERSONAS.map(p => `
        <div class="list-item" onclick="startChat('${p.id}')">
          <img class="list-thumb" src="${p.img}" alt="${p.name}" />
          <div class="list-info">
            <div class="list-name-row">
              <span class="list-name">${p.name}</span>
              <span class="list-age">${p.age}세</span>
            </div>
            <div class="list-job">${p.job}</div>
            <div class="list-tags">
              ${p.tags.map(t => `<span class="list-tag">${t}</span>`).join('')}
            </div>
            <div class="list-quote">${p.quote}</div>
          </div>
          <button class="list-chat-btn" onclick="event.stopPropagation(); startChat('${p.id}')">💬</button>
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
      // 크레딧 부족 시 1.5초 후 Starter 충동구매 팝업
      setTimeout(() => showStarterImpulsePopup(), 1500);
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
    };

    // 페르소나별 인앱그램 더미 이모지 피드
    const GRAM_EMOJIS = {
      minji:   ['🏥','🌙','☕','💊','🌷','🐱'],
      jiwoo:   ['📚','🎓','🧋','🌸','🎵','🛍️'],
      hayoung: ['🍷','💼','🌃','📋','🌹','✈️'],
      eunbi:   ['🎨','💻','🌙','📷','🍵','🎞️'],
      dahee:   ['👙','🌊','📸','💄','🌴','🏋️'],
    };

    let currentDetailPersona = null;

    function openProfileDetail(personaId) {
      const persona = PERSONAS.find(p => p.id === personaId);
      if (!persona) return;
      currentDetailPersona = persona;

      // 히어로 이미지
      document.getElementById('pd-hero-img').src = persona.img;
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

    // 스토리 진행 여부 확인 (같은 페르소나 첫 대화 + 미완료)
    function shouldStartStory(personaId) {
      if (personaId !== 'minji') return false;
      // localStorage: 재방문 시에도 완료 상태 유지
      if (localStorage.getItem('story_done_' + personaId)) return false;
      if (sessionStorage.getItem('story_done_' + personaId)) return false;
      return true;
    }

    // 스토리 모드 시작
    function startStoryMode(persona) {
      storyMode = true;
      storyCurrentNode = 'start';
      storyChoiceTags = [];

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

    // 스토리 노드 렌더링
    function _showStoryNode(nodeId, prevTag) {
      storyCurrentNode = nodeId;
      const node = MINJI_STORY[nodeId];
      if (!node) return;

      // 메시지 목록 결정 (분기형 vs 단일형)
      const msgs = Array.isArray(node.messages)
        ? node.messages
        : (node.messages[prevTag] || node.messages[Object.keys(node.messages)[0]]);

      // AI 메시지 순차 출력
      let cumDelay = 400;
      msgs.forEach((m, i) => {
        const d = (i === 0 ? cumDelay : (m.delay || 1200));
        cumDelay += d;
        setTimeout(() => {
          showTypingIndicator();
          setTimeout(() => {
            removeTypingIndicator();
            addStoryAIMessage(m.text);
            // 마지막 메시지 뒤 선택지 표시
            if (i === msgs.length - 1) {
              setTimeout(() => _renderChoices(node, nodeId), 400);
            }
          }, 900);
        }, cumDelay - 900);
      });
    }

    // 스토리 전용 AI 메시지 (D1 저장 안함, 크레딧 차감 안함)
    function addStoryAIMessage(text) {
      const msgBox = document.getElementById('chat-messages');
      const time   = getNowTime();
      const row    = document.createElement('div');
      row.className = 'msg-row from-ai';
      row.style.opacity   = '0';
      row.style.transform = 'translateY(8px)';
      row.innerHTML = `
        <img class="msg-avatar" src="${currentChatPersona?.img || ''}" alt="" />
        <div class="msg-bubble">${escapeHtml(text)}</div>
        <span class="msg-time">${time}</span>
      `;
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
        btn.textContent = '민지와 대화 시작하기 💬';
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

    // 스토리 종료 → 자유 채팅 전환
    function _endStoryMode() {
      storyMode = false;

      // 엔딩 타입 결정 (마지막 선택 태그 기준)
      const lastTag    = storyChoiceTags[storyChoiceTags.length - 1] || 'warm_end';
      const endingType = lastTag.includes('romantic') ? 'romantic' : 'warm';
      const endingKey  = lastTag; // 'romantic_end' | 'warm_end'

      // localStorage + sessionStorage 양쪽에 완료 표시 (재방문 대비)
      const personaId = currentChatPersona?.id;
      if (personaId) {
        localStorage.setItem('story_done_' + personaId, '1');
        sessionStorage.setItem('story_done_' + personaId, '1');
      }

      // 서버에 완료 보고 (관계 보너스 + 기억 시드)
      const memorySeed = MINJI_STORY.ending.memorySeeds[endingKey] || '';
      fetch('/api/story/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
        },
        body: JSON.stringify({
          personaId,
          endingType,
          choiceTags: storyChoiceTags,
          memorySeed
        })
      }).then(r => {
        if (r.ok) {
          // 관계 레벨 UI 업데이트 (Lv2)
          updateChatHeaderLevel(personaId);
        }
      }).catch(() => {});

      // UI: 입력바 복원
      _setStoryInputMode(false);

      // 자유 채팅 안내 메시지
      setTimeout(() => {
        addStoryAIMessage('이제 자유롭게 얘기해요 💕');
      }, 400);
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
        <img class="msg-avatar" src="${SUAH_PERSONA.img}" alt="" onerror="this.style.opacity='0'" />
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
      const safeText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      row.innerHTML = `
        <img class="msg-avatar" src="${SUAH_PERSONA.img}" alt="" onerror="this.style.opacity='0'" />
        <div class="msg-col">
          <div class="msg-bubble voice-msg-bubble">
            <span class="voice-icon">🎙️</span>
            <span class="voice-msg-text">${escapeHtml(text)}</span>
            <button class="voice-replay-btn" onclick="webSpeechFallback('${safeText}')">▶ 재생</button>
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
      if (autoPlay) {
        setTimeout(() => webSpeechFallback(text), 400);
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
      setTimeout(() => _showTutorialNode(choice.next, choice.tag), 300);
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
        setTimeout(() => {
          showTypingIndicator();
          setTimeout(() => {
            removeTypingIndicator();
            _addTutorialVoiceMessage(voiceText, node.voice.autoPlay);
            setTimeout(() => _renderTutorialEnding(node), 1600);
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

      // 메시지 순차 출력
      let cumDelay = 400;
      msgs.forEach((m, i) => {
        const d = i === 0 ? cumDelay : (m.delay || 1200);
        cumDelay += d;
        setTimeout(() => {
          showTypingIndicator();
          setTimeout(() => {
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
          _addTutorialPhotoMessage(node.photo.type);

          if (node.afterPhoto && node.afterPhoto.length > 0) {
            // 사진 이후 반응 메시지들
            let aCum = 400;
            node.afterPhoto.forEach((m, i) => {
              const d = i === 0 ? aCum : (m.delay || 1200);
              aCum += d;
              const afText = m.text.replace(/\{userName\}/g, userName);
              setTimeout(() => {
                showTypingIndicator();
                setTimeout(() => {
                  removeTypingIndicator();
                  addStoryAIMessage(afText);
                  if (i === node.afterPhoto.length - 1) {
                    setTimeout(() => _renderTutorialChoices(node), 400);
                  }
                }, 900);
              }, aCum - 900);
            });
          } else {
            setTimeout(() => _renderTutorialChoices(node), 500);
          }
        }, afterMsgsDelay);
      } else {
        // 사진 없으면 바로 선택지
        setTimeout(() => _renderTutorialChoices(node), afterMsgsDelay);
      }
    }

    // 수아와 튜토리얼 채팅 시작
    function startTutorialWithSuah() {
      currentChatPersona = SUAH_PERSONA;
      tutorialMode = true;
      tutorialCurrentNode = 'start';

      // 헤더 설정
      document.getElementById('chat-avatar').src = SUAH_PERSONA.img;
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

      // 첫 노드 시작
      setTimeout(() => _showTutorialNode('start', null), 500);
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
            row.innerHTML = `<img class="msg-avatar" src="${persona.img}" alt="" /><div class="msg-bubble">${escapeHtml(entry.text)}</div><span class="msg-time">${entry.time}</span>`;
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

      // 스토리/튜토리얼 모드 상태 초기화
      storyMode = false;
      storyChoiceTags = [];
      storyCurrentNode = null;
      tutorialMode = false;
      tutorialCurrentNode = null;
      _setStoryInputMode(false);
      _hideTutorialSkipBtn();

      // 헤더 설정
      document.getElementById('chat-avatar').src = persona.img;
      document.getElementById('chat-name').textContent = persona.name;

      // 관계 레벨 배지 복원 및 초기화
      const levelBadge = document.getElementById('chat-level-badge');
      if (levelBadge) levelBadge.style.display = '';
      updateChatHeaderLevel(persona.id);

      const msgBox = document.getElementById('chat-messages');
      msgBox.innerHTML = '';

      // 로그인 유저: D1에서 히스토리 로드 시도 → 없으면 sessionStorage → 없으면 첫 인사/스토리
      loadAndRenderHistoryFromD1(persona, msgBox).then(loadedFromD1 => {
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
              row.innerHTML = `<img class="msg-avatar" src="${persona.img}" alt="" /><div class="msg-bubble">${escapeHtml(entry.text)}</div><span class="msg-time">${entry.time}</span>`;
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
            setTimeout(() => startStoryMode(persona), 500);
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

    // ─── 음성 메시지 요청 (5C) ───
    async function requestVoiceMessage() {
      if (!currentChatPersona) return;
      if (!spendCredit(VOICE_COST)) return;
      addCreditHistory('spend', currentChatPersona.name + ' 음성 메시지', VOICE_COST);

      // AI에게 "음성 메시지 보내줘" 메시지를 보내고 응답을 TTS로 변환
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
        // AI 메시지 버블 추가 (음성 재생 버튼 포함)
        addAIMessageWithVoice(aiText, currentChatPersona);
        chatHistory.push({ role: 'ai', text: aiText });
        saveChatHistory(currentChatPersona.id, chatHistory);
        scrollToBottom();

        // TTS 재생 시도
        playTTS(aiText, currentChatPersona.id);
      } catch(e) {
        removeTypingIndicator();
        addAIMessage('음성 메시지를 준비하는 중에 오류가 생겼어요... 😢');
      }
    }

    // TTS 재생 함수 (서버 TTS 또는 Web Speech API fallback)
    async function playTTS(text, personaId) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getAuthToken() ? { 'Authorization': `Bearer ${getAuthToken()}` } : {})
          },
          body: JSON.stringify({ text, personaId })
        });
        const data = await res.json();

        if (data.audioContent) {
          // 서버 TTS MP3 재생
          const audio = new Audio('data:audio/mpeg;base64,' + data.audioContent);
          audio.play().catch(() => webSpeechFallback(text));
        } else {
          // Web Speech API fallback
          webSpeechFallback(text);
        }
      } catch(e) {
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
      const avatarSrc = persona ? persona.img : '';
      row.innerHTML = `
        <img class="msg-avatar" src="${avatarSrc}" onerror="this.style.display='none'" />
        <div class="msg-col">
          <div class="msg-bubble ai voice-msg-bubble">
            <span class="voice-icon">🎙️</span>
            <span class="voice-msg-text">${escapeHtml(text)}</span>
            <button class="voice-replay-btn" onclick="webSpeechFallback('${text.replace(/'/g, "\\'")}')">▶ 재생</button>
          </div>
          <div class="msg-time">${getNowTime()}</div>
        </div>
      `;
      msgBox.appendChild(row);
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
        const imgSrc = randomPost ? randomPost.img : persona.img;

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
        <img class="msg-avatar" src="${persona.img}" onerror="this.style.display='none'" />
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
        <img class="msg-avatar" src="${currentChatPersona?.img || ''}" alt="" />
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
        <img class="msg-avatar" src="${currentChatPersona?.img || ''}" alt="" />
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
            <img class="hub-discover-avatar" src="${persona.img}" alt="${persona.name}" />
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
              <img class="hub-chat-avatar" src="${persona.img}" alt="${persona.name}" />
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
        .concat(PERSONAS.map(p => ({ id:p.id, name:p.name, img:p.img })));

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
        const imgSrc = post.img || persona.img;
        const isLiked = !!gramLikes[post.id];
        const likeCount = post.likes + (isLiked ? 1 : 0);

        return `
          <div class="gram-post" style="animation-delay:${idx * 0.06}s" data-post-id="${post.id}">
            <!-- 헤더: 아바타 + 이름 + 시간 -->
            <div class="gram-post-header">
              <img class="gram-post-avatar" src="${persona.img}" alt="${persona.name}" />
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
            <img class="mypage-reset-avatar" src="${p.img}" alt="${p.name}" />
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
      starter: { name: 'Starter',    icon: '💌', credits: 200,  bonus: 0,    price: '₩990',    priceNum: 990,   chatCount: 400,   badge: '' },
      basic:   { name: 'Basic',      icon: '🌸', credits: 200,  bonus: 0,    price: '₩2,200',  priceNum: 2200,  chatCount: 400,   badge: '' },
      recom:   { name: 'Recommended',icon: '💝', credits: 550,  bonus: 50,   price: '₩5,500',  priceNum: 5500,  chatCount: 1200,  badge: '추천' },
      premium: { name: 'Premium',    icon: '💖', credits: 1200, bonus: 200,  price: '₩11,000', priceNum: 11000, chatCount: 2800,  badge: '인기' },
      vvip:    { name: 'VVIP',       icon: '👑', credits: 6500, bonus: 1500, price: '₩55,000', priceNum: 55000, chatCount: 16000, badge: 'BEST' },
    };
    let _selectedPkg = null;

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
        // 토큰이 있으면 서버에서 유저 정보 갱신 (비동기, 조용히)
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            if (data.user) {
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
    window.loginWithGoogle   = loginWithGoogle;
  