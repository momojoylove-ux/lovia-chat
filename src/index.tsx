import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'

const app = new Hono()

// 정적 파일 서빙
app.use('/images/*',   serveStatic({ root: './public' }))
app.use('/videos/*',   serveStatic({ root: './public' }))
app.use('/static/*',   serveStatic({ root: './public' }))

// PWA 파일 직접 서빙
// ── 토스 결제 성공 콜백 페이지 ──────────────────────────────
app.get('/payment/success', async (c) => {
  const { paymentKey, orderId, amount } = c.req.query()
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <title>결제 처리 중 — Lovia</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#0d0d1a;color:#fff;font-family:-apple-system,sans-serif;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:100vh;padding:24px;text-align:center;}
    .spinner{width:52px;height:52px;border:4px solid rgba(255,107,138,0.15);
      border-top-color:#FF6B8A;border-radius:50%;
      animation:spin 0.8s linear infinite;margin-bottom:20px;}
    @keyframes spin{to{transform:rotate(360deg)}}
    h2{font-size:18px;font-weight:700;margin-bottom:8px;}
    p{font-size:13px;color:rgba(255,255,255,0.45);}
    .done{font-size:52px;margin-bottom:16px;display:none;}
  </style>
</head>
<body>
  <div class="spinner" id="spinner"></div>
  <div class="done" id="done-icon">💎</div>
  <h2 id="title">결제 확인 중...</h2>
  <p id="desc">잠시만 기다려주세요</p>
  <script>
    (async () => {
      const paymentKey = ${JSON.stringify(paymentKey || '')};
      const orderId    = ${JSON.stringify(orderId || '')};
      const amount     = ${JSON.stringify(amount || '0')};
      const token      = localStorage.getItem('lovia_auth_token');

      try {
        const res = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (token || '')
          },
          body: JSON.stringify({ paymentKey, orderId, amount: parseInt(amount) })
        });
        const data = await res.json();

        if (data.ok) {
          // 결제 결과를 sessionStorage에 저장 → 앱에서 읽어서 처리
          sessionStorage.setItem('lovia_payment_result', JSON.stringify({
            status: 'success',
            credits: data.credits,
            newTotal: data.newTotal
          }));

          // 성공 UI 잠깐 보여주기
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('done-icon').style.display = 'block';
          document.getElementById('title').textContent = '결제 완료! 🎉';
          document.getElementById('desc').textContent = data.credits + ' 크레딧 지급 완료';

          // 스플래시 없이 앱으로 복귀 (replace로 히스토리 덮어쓰기)
          setTimeout(() => { location.replace('/'); }, 1200);
        } else {
          throw new Error(data.error || '결제 검증 실패');
        }
      } catch(e) {
        sessionStorage.setItem('lovia_payment_result', JSON.stringify({ status: 'fail' }));
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('done-icon').textContent = '😢';
        document.getElementById('done-icon').style.display = 'block';
        document.getElementById('title').textContent = '결제 실패';
        document.getElementById('desc').textContent = e.message || '다시 시도해주세요';
        setTimeout(() => { location.replace('/'); }, 2000);
      }
    })();
  </script>
</body>
</html>`)
})

// ── 토스 결제 실패 콜백 페이지 ──────────────────────────────
app.get('/payment/fail', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <title>결제 취소 — Lovia</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:#0d0d1a;color:#fff;font-family:-apple-system,sans-serif;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      min-height:100vh;padding:24px;text-align:center;}
  </style>
</head>
<body>
  <script>
    // 취소/실패도 sessionStorage에 저장 후 조용히 복귀
    sessionStorage.setItem('lovia_payment_result', JSON.stringify({ status: 'cancel' }));
    location.replace('/');
  </script>
</body>
</html>`)
})

app.get('/manifest.json', (c) => {
  return c.body(JSON.stringify({
    name: 'Lovia — AI 애인',
    short_name: 'Lovia',
    description: '처음부터 설레는 AI 애인, Lovia',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d0d1a',
    theme_color: '#FF6B8A',
    lang: 'ko',
    icons: [
      { src: '/images/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any' },
      { src: '/images/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any' },
      { src: '/images/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/images/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/images/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: '/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/images/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: '/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
    ],
    categories: ['entertainment', 'social'],
    prefer_related_applications: false
  }), 200, { 'Content-Type': 'application/manifest+json' })
})

app.get('/sw.js', (c) => {
  const swCode = `
const CACHE_NAME = 'lovia-v1';
const STATIC_ASSETS = ['/', '/static/app.js', '/manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/') || e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    if (r && r.status === 200 && r.type === 'basic') {
      const clone = r.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});
`.trim()
  return c.body(swCode, 200, { 'Content-Type': 'application/javascript' })
})

// ── 개인정보처리방침 페이지 ──────────────────────────────────
app.get('/privacy', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>개인정보처리방침 — Lovia</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      background:#fff;color:#1a1a2e;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;
      font-size:15px;line-height:1.7;padding:0 0 60px;
    }
    .header{
      background:#0d0d1a;color:#fff;padding:20px 24px;
      display:flex;align-items:center;gap:12px;
    }
    .header img{width:32px;height:32px;border-radius:8px;}
    .header-text h1{font-size:16px;font-weight:700;margin:0;}
    .header-text p{font-size:12px;color:rgba(255,255,255,0.5);margin:0;}
    .container{max-width:780px;margin:0 auto;padding:32px 20px;}
    h1.title{font-size:22px;font-weight:800;color:#0d0d1a;margin-bottom:6px;}
    .meta{font-size:13px;color:#888;margin-bottom:32px;}
    .intro{
      background:#f8f8fc;border-left:4px solid #FF6B8A;
      padding:16px 18px;border-radius:0 8px 8px 0;
      font-size:14px;color:#333;margin-bottom:32px;line-height:1.7;
    }
    h2{font-size:17px;font-weight:700;color:#0d0d1a;margin:36px 0 12px;
       padding-bottom:6px;border-bottom:2px solid #f0f0f5;}
    h3{font-size:15px;font-weight:600;color:#333;margin:20px 0 8px;}
    p,li{font-size:14px;color:#444;margin-bottom:8px;}
    ul,ol{padding-left:20px;margin-bottom:12px;}
    li{margin-bottom:4px;}
    .table-wrap{overflow-x:auto;margin:12px 0 20px;-webkit-overflow-scrolling:touch;}
    table{width:100%;border-collapse:collapse;min-width:500px;font-size:13px;}
    th{background:#0d0d1a;color:#fff;padding:10px 12px;text-align:left;font-weight:600;}
    td{padding:9px 12px;border-bottom:1px solid #eee;color:#333;vertical-align:top;}
    tr:nth-child(even) td{background:#f9f9fc;}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
    .badge-required{background:#ffe0e6;color:#d63361;}
    .badge-optional{background:#e0f0ff;color:#1565c0;}
    .highlight-box{
      background:#fff8f9;border:1px solid #ffd0da;border-radius:10px;
      padding:16px 18px;margin:16px 0;font-size:14px;
    }
    .highlight-box strong{color:#FF6B8A;}
    .contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;}
    .contact-card{background:#f5f5fb;border-radius:10px;padding:14px 16px;}
    .contact-card .label{font-size:11px;color:#888;margin-bottom:4px;}
    .contact-card .value{font-size:14px;font-weight:600;color:#0d0d1a;}
    .footer{text-align:center;font-size:12px;color:#aaa;margin-top:48px;padding-top:24px;border-top:1px solid #eee;}
    a{color:#FF6B8A;text-decoration:none;}
    a:hover{text-decoration:underline;}
    @media(max-width:480px){
      .contact-grid{grid-template-columns:1fr;}
      .container{padding:24px 16px;}
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-text">
      <h1>Lovia</h1>
      <p>개인정보처리방침</p>
    </div>
  </div>

  <div class="container">
    <h1 class="title">개인정보처리방침</h1>
    <div class="meta">시행일: 2026년 4월 1일 &nbsp;|&nbsp; 버전: 1.0</div>

    <div class="intro">
      Lovia 서비스를 운영하는 회사(이하 "회사")는 「개인정보 보호법」(PIPA) 및 관련 법령을 준수하며, 이용자의 개인정보를 소중히 여깁니다. 본 방침은 회사가 수집하는 개인정보의 종류, 이용 목적, 보유 기간 등을 안내합니다.
    </div>

    <h2 id="section1">1. 수집하는 개인정보 항목 및 목적</h2>

    <h3>1.1 수집 항목</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>구분</th><th>수집 항목</th><th>수집 목적</th></tr></thead>
        <tbody>
          <tr><td><span class="badge badge-required">필수</span></td><td>이메일 주소, 이름(닉네임), 프로필 사진</td><td>회원가입 및 본인 식별, 서비스 제공</td></tr>
          <tr><td><span class="badge badge-required">필수</span></td><td>Google 계정 식별자(Google OAuth)</td><td>소셜 로그인 인증</td></tr>
          <tr><td><span class="badge badge-required">필수</span></td><td>기기 정보(OS 종류, 앱 버전)</td><td>서비스 안정성 및 오류 처리</td></tr>
          <tr><td><span class="badge badge-optional">선택</span></td><td>채팅 대화 내용</td><td>AI 캐릭터 대화 서비스 제공</td></tr>
          <tr><td>결제 시</td><td>결제 수단 정보(카드사 처리, 회사는 직접 보유 안 함)</td><td>유료 서비스 결제 처리</td></tr>
        </tbody>
      </table>
    </div>

    <h3>1.2 수집 방법</h3>
    <ul>
      <li>이용자가 직접 입력(회원가입, 채팅)</li>
      <li>Google OAuth를 통한 자동 수집</li>
      <li>앱 사용 중 자동 생성(로그, 기기 정보)</li>
    </ul>

    <h3>1.3 수집 목적</h3>
    <ul>
      <li>AI 캐릭터 채팅 서비스 제공</li>
      <li>회원 관리 및 본인 확인</li>
      <li>서비스 개선 및 신규 기능 개발</li>
      <li>고객 지원 및 불만 처리</li>
      <li>유료 콘텐츠 결제 및 이용 내역 관리</li>
    </ul>

    <h2 id="section2">2. 개인정보의 처리 및 보유 기간</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>항목</th><th>보유 기간</th></tr></thead>
        <tbody>
          <tr><td>회원 정보(이메일, 이름)</td><td>회원 탈퇴 시까지</td></tr>
          <tr><td>채팅 대화 내용</td><td>최종 대화일로부터 1년 (또는 회원 탈퇴 시)</td></tr>
          <tr><td>결제 관련 기록</td><td>전자상거래법에 따라 5년</td></tr>
          <tr><td>소비자 불만 처리 기록</td><td>전자상거래법에 따라 3년</td></tr>
          <tr><td>서비스 이용 로그</td><td>6개월</td></tr>
        </tbody>
      </table>
    </div>
    <p style="font-size:13px;color:#888;">※ 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 별도 보관합니다.</p>

    <h2 id="section3">3. 제3자 제공 및 처리 위탁</h2>

    <h3>3.1 개인정보 제3자 제공</h3>
    <p>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 다음의 경우는 예외입니다:</p>
    <ul>
      <li>이용자의 사전 동의가 있는 경우</li>
      <li>법령에 특별한 규정이 있거나 법적 의무를 준수하기 위한 경우</li>
      <li>이용자 또는 제3자의 생명·신체·재산 보호를 위해 급박하게 필요한 경우</li>
    </ul>

    <h3>3.2 개인정보 처리 위탁</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>수탁사</th><th>위탁 업무</th><th>보유 기간</th></tr></thead>
        <tbody>
          <tr><td>Anthropic, Inc. (미국)</td><td>AI 대화 생성 (Claude API)</td><td>처리 후 즉시 삭제 (저장 없음)</td></tr>
          <tr><td>Google LLC (미국)</td><td>소셜 로그인 인증(OAuth)</td><td>Google 정책에 따름</td></tr>
          <tr><td>Cloudflare, Inc. (미국)</td><td>웹 호스팅 및 CDN</td><td>서비스 이용 기간</td></tr>
        </tbody>
      </table>
    </div>

    <h2 id="section4">4. 개인정보의 국외 이전</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>이전 대상</th><th>이전 국가</th><th>이전 항목</th><th>이전 목적</th><th>보유 기간</th></tr></thead>
        <tbody>
          <tr><td>Anthropic, Inc.</td><td>미국</td><td>채팅 대화 내용</td><td>AI 응답 생성</td><td>처리 후 즉시 파기</td></tr>
          <tr><td>Google LLC</td><td>미국</td><td>이메일, Google 계정 정보</td><td>인증 처리</td><td>Google 정책에 따름</td></tr>
          <tr><td>Cloudflare, Inc.</td><td>미국</td><td>서비스 이용 로그</td><td>서비스 운영</td><td>6개월</td></tr>
        </tbody>
      </table>
    </div>
    <p>이용자는 국외 이전에 동의하지 않을 권리가 있으며, 동의하지 않을 경우 서비스 이용이 제한될 수 있습니다.</p>

    <h2 id="section5">5. 만 14세 미만 아동의 서비스 이용 제한</h2>
    <div class="highlight-box">
      <strong>본 서비스는 만 14세 미만 아동의 이용을 허용하지 않습니다.</strong>
    </div>
    <ul>
      <li>회원가입 시 만 14세 이상임을 확인하는 절차를 운영합니다.</li>
      <li>만 14세 미만으로 확인될 경우 즉시 회원 자격이 취소됩니다.</li>
      <li>만 14세 미만 아동의 개인정보가 수집된 사실을 발견한 경우, 즉시 해당 정보를 삭제합니다.</li>
      <li>보호자(법정대리인)가 아동의 개인정보 삭제를 요청하는 경우 지체 없이 처리합니다.</li>
    </ul>

    <h2 id="section6">6. 이용자의 권리 및 행사 방법</h2>

    <h3>6.1 권리 목록</h3>
    <ul>
      <li><strong>열람권</strong>: 보유 중인 본인의 개인정보 확인</li>
      <li><strong>정정권</strong>: 부정확한 개인정보의 수정 요청</li>
      <li><strong>삭제권(잊힐 권리)</strong>: 개인정보의 삭제 요청</li>
      <li><strong>처리 정지권</strong>: 개인정보 처리의 일시 정지 요청</li>
      <li><strong>동의 철회</strong>: 수집·이용 동의 철회 및 회원 탈퇴</li>
    </ul>

    <h3>6.2 행사 방법</h3>
    <ul>
      <li><strong>앱 내</strong>: 설정 &gt; 계정 &gt; 내 정보 관리</li>
      <li><strong>이메일</strong>: <a href="mailto:privacy@lovia.app">privacy@lovia.app</a></li>
      <li>요청 접수 후 <strong>10일 이내</strong> 처리</li>
      <li>처리 결과를 이메일로 통보</li>
    </ul>

    <h3>6.3 불만 처리 및 분쟁 해결</h3>
    <p>개인정보와 관련한 불만이나 피해 구제는 아래 기관에 신청할 수 있습니다:</p>
    <ul>
      <li><strong>개인정보보호위원회</strong>: <a href="https://www.pipc.go.kr" target="_blank">www.pipc.go.kr</a> / 국번없이 182</li>
      <li><strong>개인정보 침해신고센터</strong>: <a href="https://privacy.kisa.or.kr" target="_blank">privacy.kisa.or.kr</a> / 국번없이 118</li>
      <li><strong>대검찰청 사이버수사과</strong>: <a href="https://www.spo.go.kr" target="_blank">www.spo.go.kr</a> / 02-3480-3573</li>
      <li><strong>경찰청 사이버수사국</strong>: <a href="https://cyberbureau.police.go.kr" target="_blank">cyberbureau.police.go.kr</a> / 국번없이 182</li>
    </ul>

    <h2 id="section7">7. AI 학습 활용 여부</h2>
    <div class="highlight-box">
      <strong>회사는 이용자의 채팅 대화 내용을 AI 모델 학습에 활용하지 않습니다.</strong>
    </div>
    <ul>
      <li>채팅 대화는 실시간 AI 응답 생성 목적으로만 사용됩니다.</li>
      <li>제3자 AI API(Anthropic Claude 등)에 전달된 대화는 해당 회사의 정책에 따라 처리되며, Anthropic의 API 이용 약관상 사용자 데이터는 모델 학습에 사용되지 않습니다.</li>
      <li>서비스 개선을 위한 통계 분석 시, 개인을 식별할 수 없도록 익명화·집계 처리합니다.</li>
    </ul>

    <h2 id="section8">8. 개인정보 보호를 위한 기술적·관리적 조치</h2>

    <h3>기술적 조치</h3>
    <ul>
      <li>개인정보 전송 시 SSL/TLS 암호화 적용</li>
      <li>비밀번호 등 민감 정보 해시 처리</li>
      <li>접근 권한 최소화 및 접근 로그 관리</li>
      <li>정기적 보안 취약점 점검</li>
    </ul>

    <h3>관리적 조치</h3>
    <ul>
      <li>개인정보 취급 직원 대상 정기 교육</li>
      <li>개인정보 처리 업무 담당자 지정 및 최소화</li>
      <li>내부 관리 계획 수립·시행</li>
    </ul>

    <h2 id="section9">9. 개인정보 보호책임자</h2>
    <div class="contact-grid">
      <div class="contact-card">
        <div class="label">직책</div>
        <div class="value">개인정보 보호책임자(CPO)</div>
      </div>
      <div class="contact-card">
        <div class="label">이메일</div>
        <div class="value"><a href="mailto:privacy@lovia.app">privacy@lovia.app</a></div>
      </div>
    </div>
    <p>개인정보와 관련한 문의, 불만, 피해구제 등에 관한 사항은 위 담당자에게 문의하시기 바랍니다.</p>

    <h2 id="section10">10. 개인정보처리방침의 변경</h2>
    <ul>
      <li>본 방침은 <strong>2026년 4월 1일</strong>부터 시행됩니다.</li>
      <li>법령·정책 변경 또는 서비스 업데이트에 따라 본 방침이 변경될 수 있으며, 변경 시 앱 내 공지 또는 이메일로 사전 고지합니다.</li>
      <li>중요한 내용 변경 시 최소 <strong>7일 전</strong> 공지합니다.</li>
    </ul>

    <div class="footer">
      <p>© 2026 Lovia. All rights reserved.</p>
      <p style="margin-top:6px;"><a href="mailto:privacy@lovia.app">privacy@lovia.app</a></p>
    </div>
  </div>
</body>
</html>`)
})

// 스플래시 → 매니저 동영상 화면
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#FF6B8A" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Lovia" />
  <meta name="description" content="처음부터 설레는 AI 애인, Lovia" />
  <link rel="icon" href="/images/favicon-32.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="/images/favicon-16.png" type="image/png" sizes="16x16" />
  <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png" />
  <link rel="apple-touch-icon" sizes="152x152" href="/images/icon-152.png" />
  <link rel="apple-touch-icon" sizes="144x144" href="/images/icon-144.png" />
  <link rel="manifest" href="/manifest.json" />
  <title>Lovia</title>
  <style>
    *  {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      width: 100%;
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      background: #000;
      font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
    }

    /* ─────────────────────────────
       공통 화면 레이어
    ───────────────────────────── */
    .screen {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ─────────────────────────────
       [1] 스플래시 화면
    ───────────────────────────── */
    #splash {
      z-index: 100;
      transition: opacity 0.6s ease, transform 0.6s ease;
    }

    #splash.fade-out {
      opacity: 0;
      transform: scale(1.04);
      pointer-events: none;
    }

    .splash-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      /* JS가 실행되기 전에도 이미지 보이도록 기본값 설정 */
      background: #1a1a1a;
    }

    /* 스플래시 배경: CSS로도 즉시 로드 */
    #splash {
      background-image: url('/images/splash1.jpg');
      background-size: cover;
      background-position: center top;
    }

    .splash-overlay-top {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 35%;
      background: linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 100%);
      pointer-events: none;
    }

    .splash-overlay-bottom {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 20%;
      background: linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 100%);
      pointer-events: none;
    }

    .splash-text {
      position: absolute;
      top: max(52px, calc(env(safe-area-inset-top, 0px) + 16px));
      left: 0; right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      z-index: 10;
      padding: 0 20px;
      animation: fadeInDown 0.8s ease-out forwards;
    }

    .splash-tagline {
      font-size: 16px;
      font-weight: 500;
      color: #fff;
      letter-spacing: -0.3px;
      text-shadow: 0 1px 8px rgba(0,0,0,0.3);
    }

    .splash-tagline strong { font-weight: 700; }

    .splash-logo {
      font-size: 46px;
      font-weight: 800;
      color: #FF6B8A;
      letter-spacing: -1px;
      font-style: italic;
      text-shadow:
        0 2px 12px rgba(255,107,138,0.4),
        0 0px 30px rgba(255,107,138,0.2);
    }

    .splash-bottom {
      position: absolute;
      bottom: max(48px, calc(env(safe-area-inset-bottom, 0px) + 32px));
      left: 0; right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      z-index: 10;
      animation: fadeInUp 0.8s ease-out 0.3s forwards;
      opacity: 0;
    }

    .loading-dots {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.8);
      animation: dotPulse 1.4s ease-in-out infinite;
    }

    .dot:nth-child(1) { animation-delay: 0s; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }

    /* ─────────────────────────────
       [2] 매니저 동영상 화면
    ───────────────────────────── */
    #intro-video-screen {
      z-index: 90;
      background: #000;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }

    #intro-video-screen.visible {
      opacity: 1;
      pointer-events: all;
    }

    #intro-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
    }

    /* 동영상 위 상단 그라데이션 */
    .video-overlay-top {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 15%;
      background: linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 100%);
      pointer-events: none;
      z-index: 2;
    }

    /* 동영상 하단 텍스트 + 버튼 영역 */
    .video-bottom {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      z-index: 10;
      padding: 0 24px max(40px, calc(env(safe-area-inset-bottom, 0px) + 24px));
      background: linear-gradient(
        to top,
        rgba(0,0,0,0.75) 0%,
        rgba(0,0,0,0.4) 50%,
        transparent 100%
      );
      display: flex;
      flex-direction: column;
      gap: 16px;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s;
    }

    #intro-video-screen.visible .video-bottom {
      opacity: 1;
      transform: translateY(0);
    }

    /* 말풍선 */
    .speech-bubble {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px 16px 16px 4px;
      padding: 14px 18px;
      position: relative;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }

    .speech-bubble-text {
      font-size: 14px;
      line-height: 1.6;
      color: #222;
      letter-spacing: -0.2px;
      word-break: keep-all;
    }

    .speech-bubble-text .highlight {
      color: #FF6B8A;
      font-weight: 700;
    }

    /* 타이핑 커서 */
    .typing-cursor {
      display: inline-block;
      width: 2px;
      height: 14px;
      background: #FF6B8A;
      margin-left: 2px;
      vertical-align: middle;
      animation: blink 0.8s step-end infinite;
    }

    /* CTA 버튼 */
    .btn-primary {
      width: 100%;
      height: 54px;
      background: linear-gradient(135deg, #FF6B8A 0%, #FF4D6D 100%);
      border: none;
      border-radius: 27px;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(255,77,109,0.45);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-primary:active {
      transform: scale(0.97);
      box-shadow: 0 2px 10px rgba(255,77,109,0.3);
    }

    .btn-primary .btn-icon {
      font-size: 18px;
    }

    /* ─────────────────────────────
       [3] 이름 입력 화면
    ───────────────────────────── */

    /* 배경 */
    .name-bg {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse at 50% 30%,
        #fff5f5 0%,
        #ffd6d6 40%,
        #ffb8b8 100%
      );
    }

    /* 보케 효과 */
    .bokeh {
      position: absolute;
      border-radius: 50%;
      filter: blur(18px);
      pointer-events: none;
    }
    .bokeh-1 {
      width: 120px; height: 120px;
      background: radial-gradient(circle, rgba(255,213,128,0.55) 0%, transparent 70%);
      top: 12%; right: 8%;
    }
    .bokeh-2 {
      width: 80px; height: 80px;
      background: radial-gradient(circle, rgba(255,255,255,0.7) 0%, transparent 70%);
      top: 22%; right: 22%;
    }
    .bokeh-3 {
      width: 150px; height: 150px;
      background: radial-gradient(circle, rgba(255,200,200,0.5) 0%, transparent 70%);
      bottom: 20%; left: -20px;
    }
    .bokeh-4 {
      width: 90px; height: 90px;
      background: radial-gradient(circle, rgba(255,213,128,0.4) 0%, transparent 70%);
      bottom: 30%; right: 10%;
    }
    .bokeh-5 {
      width: 60px; height: 60px;
      background: radial-gradient(circle, rgba(255,255,255,0.6) 0%, transparent 70%);
      bottom: 15%; right: 30%;
    }

    /* 반짝이 */
    .sparkle {
      position: absolute;
      color: rgba(255, 180, 180, 0.6);
      font-size: 14px;
      pointer-events: none;
      animation: sparkleFade 2.5s ease-in-out infinite;
    }
    .sparkle-1 { top: 18%; left: 12%; animation-delay: 0s; font-size: 12px; }
    .sparkle-2 { top: 35%; right: 12%; animation-delay: 0.8s; font-size: 16px; }
    .sparkle-3 { bottom: 35%; left: 20%; animation-delay: 1.5s; font-size: 10px; }

    /* 콘텐츠 중앙 배치 */
    .name-content {
      position: absolute;
      top: 50%;
      left: 0; right: 0;
      transform: translateY(-60%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
      padding: 0 32px;
      z-index: 10;
    }

    /* 제목 */
    .name-title {
      font-size: 30px;
      font-weight: 800;
      color: #3d3333;
      text-align: center;
      line-height: 1.45;
      letter-spacing: -0.5px;
    }

    /* 입력창 래퍼 */
    .name-input-wrap {
      width: 100%;
      position: relative;
    }

    /* 입력창 */
    .name-input {
      width: 100%;
      height: 58px;
      background: #ffffff;
      border: 1.5px solid #f08080;
      border-radius: 26px;
      padding: 0 22px;
      font-size: 16px;
      font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
      color: #3d3333;
      outline: none;
      box-shadow:
        0 4px 20px rgba(255, 107, 138, 0.18),
        inset 0 1px 3px rgba(255,255,255,0.8);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      -webkit-appearance: none;
    }

    .name-input::placeholder {
      color: #c0c0c0;
    }

    .name-input:focus {
      border-color: #FF6B8A;
      box-shadow:
        0 4px 24px rgba(255, 107, 138, 0.28),
        inset 0 1px 3px rgba(255,255,255,0.8);
    }

    /* 입력창 하단 언더라인 포인트 */
    .name-input-underline {
      position: absolute;
      bottom: 16px;
      left: 22px;
      right: 22px;
      height: 1.5px;
      background: linear-gradient(90deg, #e05555 0%, #FF6B8A 100%);
      border-radius: 2px;
      opacity: 0.6;
      pointer-events: none;
    }

    /* 하단 버튼 영역 */
    .name-bottom {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 0 40px max(48px, calc(env(safe-area-inset-bottom, 0px) + 32px));
      z-index: 10;
    }

    /* 다음 버튼 */
    .btn-next {
      width: 100%;
      height: 54px;
      background: linear-gradient(135deg, #FF8FA3 0%, #FF6B8A 50%, #F05070 100%);
      border: none;
      border-radius: 27px;
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 2px;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(255, 77, 109, 0.4);
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
      -webkit-appearance: none;
    }

    .btn-next:active {
      transform: scale(0.97);
      box-shadow: 0 2px 10px rgba(255, 77, 109, 0.3);
    }

    .btn-next:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    /* 키보드 올라올 때 레이아웃 조정 */
    #name-input-screen.keyboard-up .name-content {
      transform: translateY(-70%);
    }
    #name-input-screen.keyboard-up .name-bottom {
      padding-bottom: 16px;
    }

    /* ─────────────────────────────
       키프레임 애니메이션
    ───────────────────────────── */
    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes dotPulse {
      0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
      40%           { transform: scale(1);   opacity: 1; }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0; }
    }

    @keyframes sparkleFade {
      0%, 100% { opacity: 0.2; transform: scale(0.8); }
      50%       { opacity: 0.7; transform: scale(1.2); }
    }

    @keyframes screenFadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ─────────────────────────────
       [4] 프로필 스와이프 화면
    ───────────────────────────── */

    #swipe-screen {
      z-index: 80;
      background: #0d0d0d;
      flex-direction: column;
      transition: opacity 0.45s ease;
    }

    /* 상단 헤더 */
    .swipe-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: max(52px, calc(env(safe-area-inset-top, 0px) + 16px)) 20px 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .swipe-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .swipe-greeting {
      font-size: 13px;
      color: rgba(255,255,255,0.55);
      letter-spacing: -0.2px;
    }

    .swipe-greeting strong {
      color: #FF8FA3;
      font-weight: 700;
    }

    .swipe-logo {
      font-size: 22px;
      font-weight: 800;
      color: #FF6B8A;
      font-style: italic;
      letter-spacing: -0.5px;
    }

    /* 상단 인라인 크레딧 (스와이프 화면 전용) */
    .swipe-credit-inline {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,107,138,0.12);
      border: 1.5px solid rgba(255,107,138,0.35);
      border-radius: 20px;
      padding: 5px 10px 5px 8px;
      font-size: 13px;
      font-weight: 800;
      color: #FF8FA3;
      cursor: pointer;
      transition: background 0.15s;
      letter-spacing: -0.3px;
    }
    .swipe-credit-inline:active { background: rgba(255,107,138,0.22); }
    .swipe-credit-inline .sci-icon { font-size: 13px; }

    /* 2행: 허브 버튼 + 탭 행 */
    .swipe-action-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    /* 뷰 탭 토글 */
    .view-tabs {
      display: flex;
      background: rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 3px;
      width: fit-content;
    }

    .view-tab {
      padding: 6px 14px;
      border-radius: 17px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      background: transparent;
      letter-spacing: -0.2px;
      white-space: nowrap;
    }

    .view-tab.active {
      background: #FF6B8A;
      color: #fff;
      box-shadow: 0 2px 8px rgba(255,107,138,0.4);
    }

    /* ── 카드 뷰 ── */
    #card-view {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    #list-view {
      position: absolute;
      inset: 0;
      display: none;
      flex-direction: column;
      padding-top: 140px;
      overflow-y: auto;
    }

    /* 카드 스택 영역 */
    .card-stack {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* 개별 프로필 카드 */
    .profile-card {
      position: absolute;
      width: calc(100% - 40px);
      max-width: 360px;
      height: 68vh;
      max-height: 560px;
      border-radius: 20px;
      overflow: hidden;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
      transform-origin: center bottom;
      transition: box-shadow 0.2s ease;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
      touch-action: none;
    }

    .profile-card:active { cursor: grabbing; }

    /* 카드 이미지 */
    .card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      pointer-events: none;
      display: block;
    }

    /* 카드 하단 그라데이션 정보 */
    .card-info {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 60px 20px 115px;
      background: linear-gradient(
        to top,
        rgba(0,0,0,0.9) 0%,
        rgba(0,0,0,0.55) 55%,
        transparent 100%
      );
    }

    .card-name-row {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
    }

    .card-name {
      font-size: 26px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.5px;
    }

    .card-age {
      font-size: 18px;
      font-weight: 400;
      color: rgba(255,255,255,0.8);
    }

    .card-job {
      font-size: 13px;
      color: rgba(255,255,255,0.65);
      margin-bottom: 10px;
      letter-spacing: -0.1px;
    }

    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }

    .card-tag {
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 11px;
      color: rgba(255,255,255,0.9);
      letter-spacing: -0.1px;
    }

    .card-quote {
      font-size: 12.5px;
      color: rgba(255,255,255,0.75);
      line-height: 1.5;
      letter-spacing: -0.1px;
      word-break: keep-all;
      border-left: 2px solid #FF6B8A;
      padding-left: 8px;
    }

    /* 스와이프 방향 오버레이 - 카드 정중앙 고정 */
    .swipe-indicator {
      position: absolute;
      top: 36px;
      font-size: 28px;
      font-weight: 900;
      border: 4px solid;
      border-radius: 12px;
      padding: 8px 20px;
      letter-spacing: 2px;
      opacity: 0;
      transition: opacity 0.08s;
      pointer-events: none;
      z-index: 30;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }

    /* 오른쪽 스와이프 = CHAT → 카드 왼쪽 상단 */
    .swipe-indicator.like {
      left: 16px;
      transform: rotate(-12deg);
      color: #FF6B8A;
      border-color: #FF6B8A;
      text-shadow: 0 0 20px rgba(255,107,138,0.6);
      background: rgba(255,107,138,0.15);
    }

    /* 왼쪽 스와이프 = PASS → 카드 오른쪽 상단 */
    .swipe-indicator.nope {
      right: 16px;
      transform: rotate(12deg);
      color: #aaa;
      border-color: #aaa;
      background: rgba(255,255,255,0.08);
    }

    /* 하단 액션 버튼 */
    .card-actions {
      position: absolute;
      bottom: 30px;
      left: 0; right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 24px;
      z-index: 20;
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .action-btn:active {
      transform: scale(0.92);
    }

    .action-btn-pass {
      width: 58px; height: 58px;
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.25);
      font-size: 24px;
    }

    .action-btn-chat {
      width: 72px; height: 72px;
      background: linear-gradient(135deg, #FF8FA3 0%, #FF4D6D 100%);
      font-size: 28px;
      box-shadow: 0 6px 24px rgba(255,77,109,0.5);
    }

    /* 카드 카운터 */
    .card-counter {
      display: flex;
      flex-direction: row;
      gap: 5px;
      align-items: center;
      justify-content: center;
    }

    .card-counter-wrap {
      position: absolute;
      bottom: 108px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
    }

    .counter-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      transition: all 0.2s ease;
    }

    .counter-dot.active {
      background: #FF6B8A;
      width: 18px;
      border-radius: 3px;
    }

    /* ── 추천 스킵 버튼 ── */
    .skip-recommend-wrap {
      position: absolute;
      bottom: 72px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      text-align: center;
    }

    .skip-recommend-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,0.45);
      font-size: 12px;
      cursor: pointer;
      padding: 4px 8px;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    /* ── 스와이프 튜토리얼 오버레이 ── */
    #swipe-tutorial {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease;
    }

    #swipe-tutorial.visible {
      opacity: 1;
      pointer-events: all;
    }

    .tutorial-card-preview {
      position: relative;
      width: 200px;
      height: 260px;
      margin-bottom: 40px;
    }

    /* 배경 카드 (흐릿하게) */
    .tutorial-card-preview .t-card-bg {
      position: absolute;
      inset: 0;
      border-radius: 18px;
      background: linear-gradient(160deg, #3a2a3a, #1a0e1a);
      border: 1px solid rgba(255,107,138,0.25);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }

    /* 실제 카드 (애니메이션) */
    .tutorial-card-preview .t-card-main {
      position: absolute;
      inset: 0;
      border-radius: 18px;
      background: linear-gradient(160deg, #2e1e2e, #150c15);
      border: 1px solid rgba(255,107,138,0.4);
      box-shadow: 0 8px 28px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 64px;
      overflow: hidden;
    }

    /* 애니메이션: 좌우로 살짝 흔들기 */
    @keyframes tutCardSwing {
      0%   { transform: rotate(0deg) translateX(0); }
      20%  { transform: rotate(-12deg) translateX(-30px); }
      40%  { transform: rotate(0deg) translateX(0); }
      60%  { transform: rotate(12deg) translateX(30px); }
      80%  { transform: rotate(0deg) translateX(0); }
      100% { transform: rotate(0deg) translateX(0); }
    }

    .tutorial-card-preview .t-card-main.swing {
      animation: tutCardSwing 2.4s ease-in-out infinite;
    }

    /* PASS / CHAT 레이블 */
    .tutorial-card-preview .t-label {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 22px;
      font-weight: 900;
      border: 4px solid;
      border-radius: 10px;
      padding: 8px 18px;
      letter-spacing: 2px;
      opacity: 0;
      z-index: 2;
      transition: opacity 0.2s;
      pointer-events: none;
    }

    .tutorial-card-preview .t-label.pass {
      color: #ccc;
      border-color: #ccc;
    }

    .tutorial-card-preview .t-label.chat {
      color: #FF6B8A;
      border-color: #FF6B8A;
    }

    /* PASS/CHAT 레이블 교대 애니메이션 */
    @keyframes showPass {
      0%, 15%   { opacity: 0; }
      20%, 38%  { opacity: 1; }
      42%, 100% { opacity: 0; }
    }

    @keyframes showChat {
      0%, 55%   { opacity: 0; }
      60%, 78%  { opacity: 1; }
      82%, 100% { opacity: 0; }
    }

    .tutorial-card-preview .t-label.pass.animate {
      animation: showPass 2.4s ease-in-out infinite;
    }

    .tutorial-card-preview .t-label.chat.animate {
      animation: showChat 2.4s ease-in-out infinite;
    }

    /* 좌우 힌트 화살표 */
    .tutorial-arrows {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
      padding: 0 -20px;
    }

    .tutorial-hint-row {
      display: flex;
      align-items: center;
      gap: 0;
      margin-bottom: 32px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 20px 8px;
      width: 300px;
    }

    .tutorial-hint-divider {
      width: 1px;
      height: 60px;
      background: rgba(255,255,255,0.15);
      margin: 0 4px;
      flex-shrink: 0;
    }

    .tutorial-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex: 1;
      padding: 0 8px;
    }

    .tutorial-hint-direction {
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.5);
      letter-spacing: 0;
    }

    .tutorial-hint.pass-hint .tutorial-hint-direction {
      color: rgba(200,200,200,0.6);
    }

    .tutorial-hint.chat-hint .tutorial-hint-direction {
      color: rgba(255,107,138,0.8);
    }

    .tutorial-hint-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .tutorial-hint.pass-hint .tutorial-hint-icon {
      background: rgba(200,200,200,0.1);
      border: 2px solid rgba(200,200,200,0.25);
    }

    .tutorial-hint.chat-hint .tutorial-hint-icon {
      background: rgba(255,107,138,0.15);
      border: 2px solid rgba(255,107,138,0.5);
    }

    .tutorial-hint-text {
      font-size: 15px;
      font-weight: 800;
      color: rgba(255,255,255,0.95);
      letter-spacing: -0.3px;
    }

    .tutorial-hint-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      text-align: center;
    }

    .tutorial-title {
      font-size: 20px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 6px;
      letter-spacing: -0.3px;
    }

    .tutorial-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 36px;
      text-align: center;
      line-height: 1.6;
    }

    .tutorial-btn {
      width: 220px;
      height: 52px;
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      border: none;
      border-radius: 26px;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: -0.2px;
      box-shadow: 0 6px 20px rgba(255,77,109,0.45);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .tutorial-btn:active {
      transform: scale(0.96);
      box-shadow: 0 3px 10px rgba(255,77,109,0.35);
    }

    .tutorial-skip {
      margin-top: 14px;
      font-size: 12px;
      color: rgba(255,255,255,0.3);
      cursor: pointer;
      padding: 8px 16px;
    }

    /* ── 리스트 뷰 (2열 그리드) ── */
    .list-items {
      padding: 8px 12px 100px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .list-item {
      display: flex;
      flex-direction: column;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      overflow: hidden;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease;
    }

    .list-item:active {
      background: rgba(255,107,138,0.12);
      transform: scale(0.98);
    }

    .list-thumb {
      width: 100%;
      aspect-ratio: 3 / 4;
      object-fit: cover;
      object-position: center top;
      display: block;
    }

    .list-info {
      padding: 10px 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .list-name-row {
      display: flex;
      align-items: baseline;
      gap: 5px;
    }

    .list-name {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }

    .list-age {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
    }

    .list-job {
      font-size: 11px;
      color: #FF8FA3;
      letter-spacing: -0.1px;
    }

    .list-quote {
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      line-height: 1.4;
      letter-spacing: -0.1px;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-top: 2px;
    }

    .list-chat-btn {
      margin: 0 10px 10px;
      width: calc(100% - 20px);
      height: 36px;
      background: linear-gradient(135deg, #FF8FA3 0%, #FF4D6D 100%);
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 3px 10px rgba(255,77,109,0.35);
      transition: transform 0.15s ease;
    }

    .list-chat-btn:active { transform: scale(0.97); }

    /* ═══════════════════════════════════════
       [5] AI 프로필 상세 화면
    ═══════════════════════════════════════ */
    #profile-detail-screen {
      z-index: 88;
      background: #0d0d0d;
      flex-direction: column;
      transition: opacity 0.35s ease;
      overflow: hidden;
    }

    /* 상단 배경 이미지 영역 */
    .pd-hero {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 55%;
      overflow: hidden;
    }

    .pd-hero-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
    }

    /* 히어로 하단 그라데이션 */
    .pd-hero-gradient {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 60%;
      background: linear-gradient(to top, #0d0d0d 0%, rgba(13,13,13,0.7) 60%, transparent 100%);
    }

    /* 뒤로가기 버튼 */
    .pd-back-btn {
      position: absolute;
      top: 52px;
      left: 18px;
      width: 38px; height: 38px;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      cursor: pointer;
      z-index: 10;
      color: #fff;
      transition: background 0.15s;
    }
    .pd-back-btn:active { background: rgba(0,0,0,0.7); }

    /* 크레딧 표시 (우측 상단 - 모든 화면 공통) */
    #credit-badge {
      position: fixed;
      top: 52px;
      right: 18px;
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,107,138,0.35);
      border-radius: 20px;
      padding: 6px 12px 6px 10px;
      z-index: 9000;
      cursor: pointer;
      transition: all 0.2s;
      pointer-events: none; /* 스플래시/온보딩에서 무시 */
    }
    #credit-badge.active { pointer-events: all; }
    #credit-badge:active { transform: scale(0.95); }
    /* 스와이프 화면에서는 인라인 크레딧 사용 → fixed 뱃지 숨김 */
    #swipe-screen.visible ~ #credit-badge,
    body.swipe-active #credit-badge { display: none !important; }

    .credit-icon { font-size: 14px; }

    .credit-amount {
      font-size: 13px;
      font-weight: 800;
      color: #FF8FA3;
      letter-spacing: -0.3px;
      min-width: 28px;
      text-align: right;
      transition: color 0.3s;
    }
    .credit-amount.flash-green { color: #7dff9b !important; }
    .credit-amount.flash-red   { color: #ff6b6b !important; }

    /* 스크롤 가능한 하단 컨텐츠 */
    .pd-scroll {
      position: absolute;
      top: 45%;
      bottom: 0;
      left: 0; right: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: 0 0 100px;
      scrollbar-width: none;
    }
    .pd-scroll::-webkit-scrollbar { display: none; }

    /* 이름/나이/직업 */
    .pd-name-section {
      padding: 0 22px 20px;
    }

    .pd-name-row {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      margin-bottom: 6px;
    }

    .pd-name {
      font-size: 32px;
      font-weight: 900;
      color: #fff;
      letter-spacing: -0.8px;
    }

    .pd-age {
      font-size: 20px;
      font-weight: 400;
      color: rgba(255,255,255,0.65);
      margin-bottom: 3px;
    }

    .pd-job {
      font-size: 14px;
      color: #FF8FA3;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* 성격 태그 */
    .pd-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-bottom: 18px;
    }

    .pd-tag {
      background: rgba(255,107,138,0.12);
      border: 1px solid rgba(255,107,138,0.3);
      border-radius: 20px;
      padding: 5px 13px;
      font-size: 12px;
      color: #FF8FA3;
      font-weight: 600;
    }

    /* 소개 한 줄 */
    .pd-quote {
      background: rgba(255,255,255,0.05);
      border-left: 3px solid #FF6B8A;
      border-radius: 0 12px 12px 0;
      padding: 14px 16px;
      font-size: 13.5px;
      color: rgba(255,255,255,0.8);
      line-height: 1.65;
      font-style: italic;
      margin-bottom: 28px;
      word-break: keep-all;
    }

    /* 기본 정보 섹션 */
    .pd-section-title {
      font-size: 13px;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 14px;
      padding: 0 22px;
    }

    .pd-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 0 22px;
      margin-bottom: 28px;
    }

    .pd-info-item {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 14px 16px;
    }

    .pd-info-label {
      font-size: 10.5px;
      color: rgba(255,255,255,0.35);
      margin-bottom: 5px;
      letter-spacing: 0.3px;
    }

    .pd-info-value {
      font-size: 14px;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
    }

    /* 인앱그램 미니 피드 */
    .pd-gram-section {
      margin-bottom: 28px;
    }

    .pd-gram-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;
      padding: 0 22px;
    }

    .pd-gram-item {
      aspect-ratio: 1;
      background: rgba(255,255,255,0.07);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      cursor: pointer;
    }

    .pd-gram-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      background: linear-gradient(135deg, rgba(255,107,138,0.1), rgba(255,77,109,0.05));
    }

    .pd-gram-item:active { opacity: 0.8; }

    /* 하단 채팅 버튼 */
    .pd-chat-btn-wrap {
      position: fixed;
      bottom: 0; left: 0; right: 0;
      padding: 16px 22px max(36px, calc(env(safe-area-inset-bottom, 0px) + 20px));
      background: linear-gradient(to top, #0d0d0d 60%, transparent 100%);
      z-index: 10;
    }

    .pd-chat-btn {
      width: 100%;
      height: 56px;
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      border: none;
      border-radius: 28px;
      color: #fff;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(255,77,109,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .pd-chat-btn:active {
      transform: scale(0.98);
      box-shadow: 0 3px 14px rgba(255,77,109,0.4);
    }

    /* ═══════════════════════════════════════
       [6] 채팅방 화면 (인스타그램형)
    ═══════════════════════════════════════ */
    #chat-screen {
      z-index: 89;
      background: #000;
      flex-direction: column;
      transition: opacity 0.3s ease;
    }

    /* 채팅 상단 헤더 */
    .chat-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: max(92px, calc(env(safe-area-inset-top, 0px) + 52px));
      padding: max(48px, calc(env(safe-area-inset-top, 0px) + 14px)) 16px 0;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(0,0,0,0.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,0.07);
      z-index: 10;
    }

    .chat-back-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
      color: #fff;
      cursor: pointer;
      border-radius: 50%;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .chat-back-btn:active { background: rgba(255,255,255,0.1); }

    .chat-header-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      border: 2px solid #FF6B8A;
      flex-shrink: 0;
    }

    .chat-header-info { flex: 1; min-width: 0; }

    .chat-header-name {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chat-header-status {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 1px;
      flex-wrap: wrap;
    }

    .chat-level-badge {
      font-size: 10px;
      font-weight: 700;
      color: #FF8FA3;
      background: rgba(255,107,138,0.12);
      border: 1px solid rgba(255,107,138,0.3);
      padding: 1px 6px;
      border-radius: 8px;
      letter-spacing: -0.2px;
    }

    /* 레벨업 토스트 */
    .level-up-toast {
      position: fixed;
      top: 80px; left: 50%;
      transform: translateX(-50%) translateY(-10px);
      background: linear-gradient(135deg, #1a0a12, #2a0e1e);
      border: 1px solid rgba(255,77,109,0.4);
      border-radius: 20px;
      padding: 12px 20px;
      z-index: 9800;
      opacity: 0;
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
      max-width: 320px;
      width: calc(100% - 48px);
    }
    .level-up-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .level-up-toast-inner {
      display: flex; align-items: center; gap: 12px;
    }
    .level-up-emoji { font-size: 28px; }
    .level-up-title {
      font-size: 13px; font-weight: 700; color: #fff;
      margin-bottom: 2px;
    }
    .level-up-sub {
      font-size: 12px; color: rgba(255,255,255,0.6);
    }

    .status-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #7dff9b;
      box-shadow: 0 0 6px #7dff9b;
      flex-shrink: 0;
    }

    .chat-header-profile-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.6);
      font-size: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }

    /* 채팅 헤더 우측 그룹 (크레딧 + 프로필 버튼) */
    .chat-header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .chat-header-gram-btn {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.6);
      font-size: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .chat-header-gram-btn:active { color: #FF6B8A; }

    /* 메시지 스크롤 영역 */
    .chat-messages {
      position: absolute;
      top: max(92px, calc(env(safe-area-inset-top, 0px) + 52px));
      bottom: var(--chat-input-height, 100px);
      left: 0; right: 0;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: 16px 16px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      scrollbar-width: none;
      transition: bottom 0.2s ease;
    }
    .chat-messages::-webkit-scrollbar { display: none; }

    /* 날짜 구분선 */
    .chat-date-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 12px 0 8px;
    }
    .chat-date-divider::before, .chat-date-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.1);
    }
    .chat-date-label {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      white-space: nowrap;
    }

    /* 메시지 행 */
    .msg-row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-bottom: 2px;
    }

    .msg-row.from-ai  { justify-content: flex-start; }
    .msg-row.from-me  { justify-content: flex-end; }

    /* AI 아바타 */
    .msg-avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      object-fit: cover;
      object-position: center top;
      flex-shrink: 0;
      align-self: flex-end;
    }
    .msg-avatar-placeholder {
      width: 28px; height: 28px;
      flex-shrink: 0;
    }

    /* 말풍선 */
    .msg-bubble {
      max-width: 68%;
      padding: 10px 14px;
      border-radius: 20px;
      font-size: 14px;
      line-height: 1.55;
      word-break: break-word;
      position: relative;
    }

    /* AI 말풍선 (왼쪽) - 인스타그램형 */
    .msg-row.from-ai .msg-bubble {
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.92);
      border-bottom-left-radius: 6px;
    }

    /* 내 말풍선 (오른쪽) */
    .msg-row.from-me .msg-bubble {
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      color: #fff;
      border-bottom-right-radius: 6px;
    }

    /* 말풍선 시간 */
    .msg-time {
      font-size: 10px;
      color: rgba(255,255,255,0.3);
      white-space: nowrap;
      margin-bottom: 2px;
      flex-shrink: 0;
    }

    /* 음성 메시지 버블 */
    .voice-msg-bubble {
      background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,77,109,0.08)) !important;
      border: 1px solid rgba(255,107,138,0.25) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 6px !important;
    }
    .voice-icon { font-size: 18px; }
    .voice-msg-text { font-size: 13px; color: rgba(255,255,255,0.8); font-style: italic; }
    .voice-replay-btn {
      align-self: flex-start;
      padding: 5px 14px;
      border-radius: 14px;
      background: rgba(255,107,138,0.25);
      border: 1px solid rgba(255,107,138,0.4);
      color: #FF8FA3;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s;
    }
    .voice-replay-btn:active { background: rgba(255,107,138,0.4); }

    /* 특별 사진 버블 */
    .special-photo-bubble {
      background: rgba(255,255,255,0.06) !important;
      border: 1px solid rgba(255,200,100,0.2) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      padding: 10px !important;
      max-width: 220px !important;
    }
    .special-photo-tag {
      font-size: 10px;
      font-weight: 700;
      color: #FFD166;
      letter-spacing: 0.3px;
    }
    .special-photo-img {
      width: 100%;
      border-radius: 12px;
      object-fit: cover;
      max-height: 260px;
    }
    .special-photo-comment {
      font-size: 13px;
      color: rgba(255,255,255,0.85);
      line-height: 1.5;
    }

    /* 타이핑 인디케이터 */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: rgba(255,255,255,0.1);
      border-radius: 20px;
      border-bottom-left-radius: 6px;
      width: fit-content;
    }
    .typing-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: rgba(255,255,255,0.5);
      animation: typingBounce 1.2s ease-in-out infinite;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30%            { transform: translateY(-5px); opacity: 1; }
    }

    /* 입력창 영역 */
    .chat-input-bar {
      position: fixed;
      bottom: 0;
      bottom: env(safe-area-inset-bottom, 0px);
      left: 0; right: 0;
      height: auto;
      min-height: 56px;
      padding: 8px 12px max(20px, env(safe-area-inset-bottom, 20px));
      background: rgba(0,0,0,0.92);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,255,255,0.07);
      display: none; /* JS로 채팅 진입 시 flex로 표시 */
      flex-direction: column;
      gap: 6px;
      z-index: 90; /* chat-screen(89)보다 위 */
      will-change: transform;
      transform: translateY(0);
      transition: transform 0.2s ease;
    }

    /* 음성/사진 요청 버튼 행 */
    .chat-action-row {
      display: flex;
      gap: 8px;
      padding: 0 2px;
    }
    .chat-action-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 5px 12px;
      border-radius: 18px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .chat-action-btn:active { background: rgba(255,255,255,0.12); }
    .chat-action-btn.voice-btn {
      border-color: rgba(255,107,138,0.3);
      color: #FF8FA3;
    }
    .chat-action-btn.photo-btn {
      border-color: rgba(255,200,100,0.3);
      color: #FFD166;
    }
    .action-cost {
      font-size: 10px;
      opacity: 0.6;
      font-weight: 700;
    }

    .chat-input-wrap {
      flex: 1;
      position: relative;
    }

    .chat-input {
      width: 100%;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 22px;
      padding: 9px 44px 9px 16px;
      font-size: 14px;
      color: #fff;
      font-family: inherit;
      outline: none;
      resize: none;
      max-height: 100px;
      overflow-y: auto;
      line-height: 1.45;
      -webkit-appearance: none;
      scrollbar-width: none;
    }
    .chat-input::-webkit-scrollbar { display: none; }
    .chat-input::placeholder { color: rgba(255,255,255,0.3); }

    .chat-send-btn {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      border: none;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      cursor: pointer;
      transition: transform 0.15s, opacity 0.15s;
      opacity: 0.45;
    }
    .chat-send-btn.enabled { opacity: 1; }
    .chat-send-btn:active { transform: translateY(-50%) scale(0.9); }

    /* ─────────────────────────────
       스토리 모드 선택지 UI
    ───────────────────────────── */
    #story-choices-container {
      display: none;
      flex-direction: column;
      gap: 8px;
      padding: 10px 4px 4px;
      animation: storyChoicesFadeIn 0.4s ease;
    }
    @keyframes storyChoicesFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .story-choice-btn {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255,107,138,0.1);
      border: 1px solid rgba(255,107,138,0.3);
      border-radius: 14px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
      line-height: 1.4;
    }
    .story-choice-btn:active {
      background: rgba(255,107,138,0.22);
      border-color: rgba(255,107,138,0.6);
      transform: scale(0.98);
    }

    .story-end-btn {
      width: 100%;
      padding: 13px 16px;
      background: linear-gradient(135deg, #FF6B8A, #FF4D6D);
      border: none;
      border-radius: 14px;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    .story-end-btn:active { opacity: 0.85; transform: scale(0.98); }

    .story-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: #FF8FA3;
      background: rgba(255,107,138,0.12);
      border: 1px solid rgba(255,107,138,0.25);
      border-radius: 10px;
      padding: 2px 8px;
      margin-bottom: 6px;
      letter-spacing: 0.3px;
    }

    /* ─────────────────────────────
       msg-col: 버블 + 시간 세로 배치 (음성/사진 버블용)
    ───────────────────────────── */
    .msg-col {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      max-width: 68%;
    }
    .msg-row.from-ai .msg-col .msg-bubble {
      max-width: 100%;
    }

    /* ─────────────────────────────
       튜토리얼 전용 UI
    ───────────────────────────── */
    #tutorial-skip-btn {
      display: none;
      padding: 5px 12px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      color: rgba(255,255,255,0.5);
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s, color 0.15s;
    }
    #tutorial-skip-btn:active {
      background: rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.8);
    }

    /* 튜토리얼 사진 플레이스홀더 버블 */
    .tutorial-photo-bubble {
      padding: 0 !important;
      overflow: hidden;
      border-radius: 14px !important;
      background: rgba(255,255,255,0.05) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      min-width: 160px;
    }
    .tutorial-photo-tag {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255,255,255,0.5);
      padding: 8px 12px 4px;
      letter-spacing: 0.3px;
    }
    .tutorial-photo-placeholder {
      width: 200px;
      height: 200px;
      background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(120,80,200,0.15));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .tutorial-photo-icon {
      font-size: 48px;
    }
    .tutorial-photo-label {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      font-weight: 500;
    }

    /* 튜토리얼 엔딩 메시지 */
    .tutorial-ending-msg {
      text-align: center;
      margin: 20px 16px 8px;
      padding: 14px 20px;
      background: linear-gradient(135deg, rgba(255,107,138,0.1), rgba(120,80,200,0.1));
      border: 1px solid rgba(255,107,138,0.2);
      border-radius: 16px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255,255,255,0.8);
      letter-spacing: -0.2px;
      animation: storyChoicesFadeIn 0.5s ease;
    }

    /* ─────────────────────────────
       ⑦ 채팅 허브 (메인 채팅 목록) 화면
    ───────────────────────────── */
    #hub-screen {
      z-index: 75;
      background: #0d0d0d;
      flex-direction: column;
      overflow: hidden;
    }

    /* 허브 상단 헤더 */
    .hub-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: max(52px, calc(env(safe-area-inset-top, 0px) + 16px)) 20px 16px;
      background: linear-gradient(to bottom, #0d0d0d 80%, transparent 100%);
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .hub-header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .hub-title {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }

    .hub-subtitle {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
    }

    .hub-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      border-radius: 50%;
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
    }
    .hub-back-btn:active { background: rgba(255,255,255,0.16); }

    /* 채팅 목록 스크롤 영역 */
    .hub-scroll {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      padding: max(118px, calc(env(safe-area-inset-top, 0px) + 82px)) 0 max(24px, env(safe-area-inset-bottom, 24px));
      scrollbar-width: none;
    }
    .hub-scroll::-webkit-scrollbar { display: none; }

    /* 섹션 레이블 */
    .hub-section-label {
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.3);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 0 20px;
      margin-bottom: 8px;
    }

    /* 가로 스크롤 - 스와이프 가능한 파트너 */
    .hub-discover-row {
      display: flex;
      gap: 12px;
      padding: 0 20px 20px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .hub-discover-row::-webkit-scrollbar { display: none; }

    .hub-discover-card {
      flex-shrink: 0;
      width: 84px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }

    .hub-discover-avatar-wrap {
      position: relative;
      width: 68px; height: 68px;
    }

    .hub-discover-avatar {
      width: 68px; height: 68px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid rgba(255,107,138,0.5);
    }

    /* 새 메시지 알림 도트 */
    .hub-discover-dot {
      position: absolute;
      bottom: 2px; right: 2px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: #FF4D6D;
      border: 2px solid #0d0d0d;
      display: none;
    }
    .hub-discover-dot.active { display: block; }

    .hub-discover-name {
      font-size: 12px;
      color: rgba(255,255,255,0.85);
      font-weight: 500;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 80px;
    }

    /* 채팅 목록 항목 */
    .hub-chat-list {
      display: flex;
      flex-direction: column;
    }

    .hub-chat-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 20px;
      cursor: pointer;
      transition: background 0.15s;
      position: relative;
    }
    .hub-chat-item:active { background: rgba(255,255,255,0.05); }

    .hub-chat-avatar-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .hub-chat-avatar {
      width: 54px; height: 54px;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5px solid rgba(255,255,255,0.1);
    }

    .hub-online-dot {
      position: absolute;
      bottom: 2px; right: 2px;
      width: 12px; height: 12px;
      border-radius: 50%;
      background: #4CAF50;
      border: 2px solid #0d0d0d;
    }

    .hub-chat-body {
      flex: 1;
      min-width: 0;
    }

    .hub-chat-name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .hub-chat-name {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }

    .hub-chat-time {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      flex-shrink: 0;
    }

    .hub-chat-preview-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .hub-chat-preview {
      font-size: 13px;
      color: rgba(255,255,255,0.45);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .hub-chat-preview.unread {
      color: rgba(255,255,255,0.7);
      font-weight: 500;
    }

    .hub-unread-badge {
      flex-shrink: 0;
      min-width: 18px; height: 18px;
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px;
      font-weight: 700;
      color: #fff;
      padding: 0 5px;
    }

    /* 새 파트너 찾기 버튼 */
    .hub-new-btn {
      margin: 16px 20px 8px;
      padding: 16px;
      background: linear-gradient(135deg, rgba(255,107,138,0.15), rgba(255,77,109,0.08));
      border: 1.5px dashed rgba(255,107,138,0.4);
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .hub-new-btn:active { background: rgba(255,107,138,0.2); }

    .hub-new-icon {
      width: 54px; height: 54px;
      border-radius: 50%;
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
    }

    .hub-new-text { flex: 1; }
    .hub-new-title {
      font-size: 15px;
      font-weight: 600;
      color: #FF8FA3;
      margin-bottom: 2px;
    }
    .hub-new-desc {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
    }
    .hub-new-arrow {
      font-size: 20px;
      color: rgba(255,107,138,0.6);
    }

    /* 빈 상태 */
    .hub-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 40px;
      gap: 12px;
      text-align: center;
    }
    .hub-empty-icon { font-size: 48px; }
    .hub-empty-title {
      font-size: 16px;
      font-weight: 600;
      color: rgba(255,255,255,0.6);
    }
    .hub-empty-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.3);
      line-height: 1.6;
    }

    /* 구분선 */
    .hub-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 0 20px;
    }

    /* 크레딧 부족 토스트 */
    #credit-toast {
      position: fixed;
      bottom: 88px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(255,77,109,0.9);
      backdrop-filter: blur(8px);
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 20px;
      border-radius: 20px;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.25s, transform 0.25s;
      pointer-events: none;
      white-space: nowrap;
    }
    #credit-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* ─────────────────────────────
       ⑧ 관심/패스 관리 화면 (스와이프 픽)
    ───────────────────────────── */
    #pick-screen {
      z-index: 76;
      background: #0d0d0d;
      flex-direction: column;
      overflow: hidden;
    }

    .pick-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: max(52px, calc(env(safe-area-inset-top, 0px) + 16px)) 20px 16px;
      background: linear-gradient(to bottom, #0d0d0d 80%, transparent 100%);
      z-index: 10;
    }

    .pick-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .pick-title {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }

    .pick-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      border-radius: 50%;
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      color: #fff;
      cursor: pointer;
    }
    .pick-back-btn:active { background: rgba(255,255,255,0.16); }

    /* 탭 */
    .pick-tabs {
      display: flex;
      background: rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 3px;
      gap: 2px;
    }

    .pick-tab {
      flex: 1;
      padding: 8px 0;
      border: none;
      background: transparent;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      transition: all 0.2s;
    }

    .pick-tab.active {
      background: rgba(255,107,138,0.25);
      color: #FF8FA3;
    }

    .pick-scroll {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      padding: max(158px, calc(env(safe-area-inset-top, 0px) + 122px)) 0 max(24px, calc(env(safe-area-inset-bottom, 0px) + 8px));
      scrollbar-width: none;
    }
    .pick-scroll::-webkit-scrollbar { display: none; }

    /* 그리드 카드 */
    .pick-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 0 16px;
    }

    .pick-card {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      aspect-ratio: 3/4;
      cursor: pointer;
      transition: transform 0.15s;
    }
    .pick-card:active { transform: scale(0.97); }

    .pick-card-img {
      width: 100%; height: 100%;
      object-fit: cover;
      display: block;
    }

    .pick-card-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 28px 10px 10px;
      background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
    }

    .pick-card-name {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }

    .pick-card-job {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      margin-top: 2px;
    }

    /* 관심(하트) / 패스(X) 뱃지 */
    .pick-card-badge {
      position: absolute;
      top: 10px; right: 10px;
      width: 30px; height: 30px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
      backdrop-filter: blur(6px);
    }

    .pick-card-badge.like {
      background: rgba(255,77,109,0.85);
    }

    .pick-card-badge.pass {
      background: rgba(80,80,80,0.85);
    }

    /* 하단 액션 버튼들 */
    .pick-card-actions {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      display: flex;
      gap: 0;
    }

    .pick-card-act-btn {
      flex: 1;
      padding: 8px 0;
      border: none;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .pick-card-act-btn:active { opacity: 0.7; }

    .pick-act-chat {
      background: linear-gradient(135deg, #FF8FA3, #FF4D6D);
      color: #fff;
      border-radius: 0 0 0 16px;
    }

    .pick-act-remove {
      background: rgba(255,255,255,0.12);
      color: rgba(255,255,255,0.7);
      border-radius: 0 0 16px 0;
    }

    .pick-act-restore {
      background: rgba(255,107,138,0.18);
      color: #FF8FA3;
      border-radius: 0 0 0 16px;
    }

    .pick-act-delete {
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.5);
      border-radius: 0 0 16px 0;
    }

    /* 빈 상태 */
    .pick-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 40px;
      gap: 12px;
      text-align: center;
    }

    .pick-empty-icon { font-size: 48px; }
    .pick-empty-title { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.5); }
    .pick-empty-desc { font-size: 13px; color: rgba(255,255,255,0.3); line-height: 1.6; }

    /* ─────────────────────────────
       [⑧] 인앱 그램 피드 화면
    ───────────────────────────── */
    #gram-screen {
      z-index: 85;
      background: #0d0d0d;
      flex-direction: column;
      overflow: hidden;
    }

    .gram-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      padding: max(52px, calc(env(safe-area-inset-top, 0px) + 16px)) 20px 0;
      background: linear-gradient(to bottom, #0d0d0d 85%, transparent);
      z-index: 10;
    }

    .gram-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .gram-back-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      border-radius: 50%;
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      color: #fff;
      cursor: pointer;
    }
    .gram-back-btn:active { background: rgba(255,255,255,0.16); }

    .gram-title {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }

    /* 파트너 필터 탭 (수평 스크롤) */
    .gram-filter-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 12px;
    }
    .gram-filter-wrap::-webkit-scrollbar { display: none; }

    .gram-filter-tabs {
      display: flex;
      gap: 8px;
      padding: 0 2px;
      width: max-content;
    }

    .gram-filter-tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px 6px 8px;
      border-radius: 20px;
      border: 1.5px solid rgba(255,255,255,0.12);
      background: transparent;
      color: rgba(255,255,255,0.5);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .gram-filter-tab img {
      width: 22px; height: 22px;
      border-radius: 50%;
      object-fit: cover;
    }
    .gram-filter-tab.active {
      background: #FF6B8A;
      border-color: #FF6B8A;
      color: #fff;
      box-shadow: 0 2px 10px rgba(255,107,138,0.4);
    }

    /* 피드 스크롤 영역 */
    .gram-feed {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-top: max(140px, calc(env(safe-area-inset-top, 0px) + 104px));
      padding-bottom: max(32px, calc(env(safe-area-inset-bottom, 0px) + 16px));
    }
    .gram-feed::-webkit-scrollbar { display: none; }

    /* 게시물 카드 */
    .gram-post {
      margin-bottom: 28px;
      animation: fadeInUp 0.35s ease both;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .gram-post-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 16px 10px;
    }

    .gram-post-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5px solid #FF6B8A;
    }

    .gram-post-meta {
      flex: 1;
    }

    .gram-post-name {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }

    .gram-post-time {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-top: 1px;
    }

    /* 게시물 이미지 */
    .gram-post-img-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 5;
      overflow: hidden;
      background: #1a1a1a;
    }

    .gram-post-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
    }

    /* 특별 사진 잠금 오버레이 */
    .gram-lock-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      z-index: 2;
    }
    .gram-post-lock-icon { font-size: 30px; }
    .gram-post-lock-text {
      font-size: 13px;
      color: rgba(255,255,255,0.8);
      font-weight: 600;
    }
    .gram-post-lock-cost {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
    }
    .gram-post-lock-btn {
      margin-top: 6px;
      padding: 9px 22px;
      border-radius: 22px;
      background: linear-gradient(135deg, #FF4D6D, #c9184a);
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(255,77,109,0.45);
      transition: transform 0.15s;
    }
    .gram-post-lock-btn:active { transform: scale(0.96); }

    /* 하단 액션 바 */
    .gram-post-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px 8px;
    }

    .gram-like-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: none;
      color: rgba(255,255,255,0.6);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      transition: all 0.15s;
    }
    .gram-like-btn.liked { color: #FF6B8A; }
    .gram-like-btn .heart {
      font-size: 22px;
      transition: transform 0.2s cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }
    .gram-like-btn.liked .heart { transform: scale(1.25); }

    .gram-chat-btn {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 16px;
      border-radius: 20px;
      background: rgba(255,107,138,0.15);
      border: 1px solid rgba(255,107,138,0.35);
      color: #FF6B8A;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }
    .gram-chat-btn:active {
      background: rgba(255,107,138,0.3);
    }

    /* 캡션 */
    .gram-post-caption {
      padding: 0 16px 4px;
      font-size: 14px;
      color: rgba(255,255,255,0.85);
      line-height: 1.55;
    }
    .gram-post-caption strong {
      color: #fff;
      font-weight: 700;
      margin-right: 5px;
    }

    /* 빈 상태 */
    .gram-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 40px;
      gap: 12px;
      text-align: center;
    }
    .gram-empty-icon { font-size: 48px; }
    .gram-empty-text { font-size: 15px; color: rgba(255,255,255,0.4); line-height: 1.6; }

    /* 회원가입 팝업 애니메이션 */
    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(40px) scale(0.94); }
      to   { opacity: 1; transform: translateY(0)   scale(1); }
    }
    #signup-overlay { display: none; }
    #signup-overlay.active { display: flex !important; }
    #signup-email-input:focus,
    #signup-nickname-input:focus {
      border-color: rgba(255,107,138,0.6) !important;
      background: rgba(255,107,138,0.06) !important;
    }
    #signup-submit-btn:active { opacity: 0.85; }
    #signup-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* 가입 성공 토스트 애니메이션 */
    @keyframes toastFadeIn {
      from { opacity:0; transform:translateX(-50%) translateY(10px); }
      to   { opacity:1; transform:translateX(-50%) translateY(0); }
    }

    /* ══════════════════════════════════════════
       ⑨ 마이페이지 화면
    ══════════════════════════════════════════ */
    #mypage-screen {
      z-index: 85;
      background: #0d0d0d;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;  /* .screen의 center를 override - 스크롤 필수 */
    }

    /* 상단 헤더 */
    .mypage-header {
      position: relative;
      padding: max(52px, calc(env(safe-area-inset-top, 0px) + 16px)) 20px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(to bottom, #1a0a0a 60%, transparent 100%);
      flex-shrink: 0;
    }
    .mypage-title {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }
    .mypage-close-btn {
      background: rgba(255,255,255,0.08);
      border: none;
      border-radius: 50%;
      width: 38px; height: 38px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s;
    }
    .mypage-close-btn:active { background: rgba(255,255,255,0.16); }

    /* 프로필 섹션 */
    .mypage-profile-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 20px 32px;
      gap: 12px;
      flex-shrink: 0;
    }
    .mypage-avatar {
      width: 80px; height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff6b9d, #c44b8a);
      display: flex; align-items: center; justify-content: center;
      font-size: 36px;
      color: #fff;
      font-weight: 700;
      flex-shrink: 0;
    }
    .mypage-username {
      font-size: 22px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.3px;
    }
    .mypage-user-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
    }

    /* 크레딧 카드 */
    .mypage-credit-card {
      margin: 0 20px 20px;
      background: linear-gradient(135deg, #2a0a1a 0%, #1a0a2a 100%);
      border: 1px solid rgba(255,107,157,0.25);
      border-radius: 20px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      flex-shrink: 0;
    }
    .mypage-credit-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .mypage-credit-label {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      font-weight: 500;
    }
    .mypage-credit-icon { font-size: 20px; }
    .mypage-credit-amount {
      font-size: 42px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -1px;
      line-height: 1;
    }
    .mypage-credit-unit {
      font-size: 16px;
      font-weight: 500;
      color: rgba(255,255,255,0.5);
      margin-left: 4px;
    }
    .mypage-credit-desc {
      font-size: 12px;
      color: rgba(255,255,255,0.35);
      line-height: 1.5;
    }
    .mypage-charge-btn {
      background: linear-gradient(135deg, #ff6b9d, #c44b8a);
      border: none;
      border-radius: 14px;
      padding: 14px;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      letter-spacing: -0.2px;
    }
    .mypage-charge-btn:active { opacity: 0.85; transform: scale(0.98); }

    /* 통계 섹션 */
    .mypage-stats-section {
      margin: 0 20px 20px;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      flex-shrink: 0;
    }
    .mypage-stat-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 16px 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .mypage-stat-icon { font-size: 22px; }
    .mypage-stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #fff;
    }
    .mypage-stat-label {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      text-align: center;
      line-height: 1.3;
    }

    /* 크레딧 내역 섹션 */
    .mypage-section-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
      padding: 0 20px 12px;
      flex-shrink: 0;
    }
    .mypage-history-list {
      margin: 0 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
    }
    .mypage-history-item {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .mypage-history-icon {
      width: 38px; height: 38px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .mypage-history-icon.spend { background: rgba(255,100,100,0.15); }
    .mypage-history-icon.earn  { background: rgba(100,220,100,0.15); }
    .mypage-history-info { flex: 1; }
    .mypage-history-desc {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
    }
    .mypage-history-time {
      font-size: 11px;
      color: rgba(255,255,255,0.35);
      margin-top: 2px;
    }
    .mypage-history-amount {
      font-size: 15px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .mypage-history-amount.spend { color: #ff6b6b; }
    .mypage-history-amount.earn  { color: #64dd64; }

    /* 무료 크레딧 섹션 */
    .mypage-free-section {
      margin: 0 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex-shrink: 0;
    }
    .mypage-free-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .mypage-free-btn:active { background: rgba(255,255,255,0.1); }
    .mypage-free-btn-icon {
      width: 42px; height: 42px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .mypage-free-btn-info { flex: 1; }
    .mypage-free-btn-title {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
    }
    .mypage-free-btn-desc {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-top: 2px;
    }
    .mypage-free-btn-badge {
      font-size: 13px;
      font-weight: 700;
      color: #64dd64;
      flex-shrink: 0;
    }
    .mypage-free-btn-badge.used {
      color: rgba(255,255,255,0.25);
    }

    /* 하단 여백 */
    .mypage-bottom-spacer { height: 40px; flex-shrink: 0; }

    /* ─── 대화 초기화 섹션 ─── */
    .mypage-reset-list {
      margin: 0 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex-shrink: 0;
    }
    .mypage-reset-card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mypage-reset-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .mypage-reset-info { flex: 1; min-width: 0; }
    .mypage-reset-name {
      font-size: 15px;
      font-weight: 600;
      color: #fff;
    }
    .mypage-reset-meta {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-top: 2px;
    }
    .mypage-reset-btn {
      padding: 7px 13px;
      border-radius: 10px;
      border: 1px solid rgba(255,100,100,0.35);
      background: rgba(255,80,80,0.08);
      color: rgba(255,130,130,0.9);
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
      -webkit-tap-highlight-color: transparent;
      flex-shrink: 0;
    }
    .mypage-reset-btn:active { background: rgba(255,80,80,0.2); }

    /* ─── 대화 초기화 확인 모달 ─── */
    #reset-confirm-modal {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 24px;
    }
    .reset-modal-box {
      background: #1c1c1e;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 28px 22px 22px;
      width: 100%;
      max-width: 310px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      text-align: center;
      animation: modalPop 0.2s ease;
    }
    @keyframes modalPop {
      from { opacity: 0; transform: scale(0.92); }
      to   { opacity: 1; transform: scale(1); }
    }
    .reset-modal-icon { font-size: 38px; line-height: 1; }
    .reset-modal-title {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      line-height: 1.4;
    }
    .reset-modal-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.45);
      line-height: 1.55;
      margin-bottom: 4px;
    }
    .reset-modal-btns {
      display: flex;
      gap: 10px;
      width: 100%;
    }
    .reset-modal-cancel {
      flex: 1;
      padding: 13px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.07);
      color: rgba(255,255,255,0.7);
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s;
    }
    .reset-modal-cancel:active { background: rgba(255,255,255,0.13); }
    .reset-modal-confirm {
      flex: 1;
      padding: 13px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #ff4444, #cc2222);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s;
    }
    .reset-modal-confirm:active { opacity: 0.82; }

    /* 법적정보 섹션 */
    .mypage-legal-inner {
      margin: 0 16px 8px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      overflow: hidden;
    }
    .mypage-legal-row {
      display: flex;
      align-items: center;
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s;
    }
    .mypage-legal-row:last-child { border-bottom: none; }
    .mypage-legal-row:active { background: rgba(255,255,255,0.06); }
    .mypage-legal-icon { font-size: 16px; margin-right: 12px; }
    .mypage-legal-label { flex: 1; font-size: 14px; color: rgba(255,255,255,0.8); }
    .mypage-legal-arrow { font-size: 18px; color: rgba(255,255,255,0.25); }

    /* AI 콘텐츠 공시 배너 */
    .mypage-ai-disclosure {
      margin: 0 16px 12px;
      background: rgba(255,107,138,0.08);
      border: 1px solid rgba(255,107,138,0.2);
      border-radius: 12px;
      padding: 12px 14px;
    }
    .mypage-ai-disclosure-title {
      font-size: 12px;
      font-weight: 700;
      color: rgba(255,107,138,0.9);
      margin-bottom: 4px;
      letter-spacing: 0.02em;
    }
    .mypage-ai-disclosure-text {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      line-height: 1.5;
    }

    /* 푸시 토글 스위치 */
    .mypage-push-row { cursor: default; }

    /* 마이페이지 로그인/로그아웃 버튼 */
    .mypage-login-btn, .mypage-signup-btn {
      padding: 9px 20px;
      border-radius: 20px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .2s;
    }
    .mypage-login-btn {
      background: linear-gradient(135deg, #ff6b8a, #ff4488);
      color: #fff;
    }
    .mypage-signup-btn {
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.85);
      border: 1px solid rgba(255,255,255,0.15);
    }
    .mypage-login-btn:active, .mypage-signup-btn:active { opacity: .75; }
    .mypage-logout-btn {
      margin-top: 10px;
      padding: 7px 18px;
      border-radius: 14px;
      border: 1px solid rgba(255,100,100,0.3);
      background: rgba(255,80,80,0.08);
      color: rgba(255,120,120,0.8);
      font-size: 12px;
      cursor: pointer;
    }
    .mypage-logout-btn:active { opacity: .7; }
    .mypage-push-row:active { background: transparent; }
    .push-toggle-label { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
    .push-toggle-label input { opacity: 0; width: 0; height: 0; position: absolute; }
    .push-toggle-track {
      position: absolute; inset: 0;
      background: rgba(255,255,255,0.15);
      border-radius: 24px;
      transition: background .25s;
    }
    .push-toggle-track::before {
      content: '';
      position: absolute;
      width: 18px; height: 18px;
      left: 3px; top: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform .25s;
    }
    .push-toggle-label input:checked + .push-toggle-track {
      background: linear-gradient(135deg, #ff6b8a, #ff4488);
    }
    .push-toggle-label input:checked + .push-toggle-track::before {
      transform: translateX(20px);
    }

    .mypage-app-version {
      text-align: center;
      font-size: 11px;
      color: rgba(255,255,255,0.18);
      margin: 12px 0 4px;
    }

    /* 사업자 정보 푸터 */
    .mypage-biz-footer {
      margin: 8px 16px 0;
      padding: 16px;
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
    }
    .mypage-biz-title {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255,255,255,0.3);
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .mypage-biz-row {
      display: flex;
      gap: 8px;
      margin-bottom: 5px;
    }
    .mypage-biz-key {
      font-size: 11px;
      color: rgba(255,255,255,0.28);
      min-width: 88px;
      flex-shrink: 0;
    }
    .mypage-biz-val {
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      word-break: break-all;
    }
    .mypage-biz-notice {
      margin-top: 10px;
      font-size: 10px;
      color: rgba(255,255,255,0.18);
    }

    /* ─────────────────────────────
       로그인 화면 (재방문 유저)
    ───────────────────────────── */
    #login-screen {
      z-index: 110;
      background: #0d0d1a;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }

    #login-screen .login-bg {
      position: absolute;
      inset: 0;
      background: radial-gradient(
        ellipse 80% 60% at 50% 30%,
        rgba(255, 107, 138, 0.18) 0%,
        rgba(180, 80, 120, 0.10) 40%,
        transparent 70%
      );
    }

    .login-bokeh-1 { position:absolute; width:160px; height:160px; border-radius:50%; background:rgba(255,107,138,0.12); filter:blur(40px); top:8%; left:-10%; animation:bokehFloat1 7s ease-in-out infinite; }
    .login-bokeh-2 { position:absolute; width:120px; height:120px; border-radius:50%; background:rgba(200,80,150,0.10); filter:blur(30px); bottom:15%; right:-8%; animation:bokehFloat2 9s ease-in-out infinite; }

    #login-screen .login-content {
      position: relative;
      z-index: 2;
      width: 100%;
      padding: 0 36px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    .login-logo {
      font-size: 42px;
      font-weight: 800;
      background: linear-gradient(135deg, #FF8FA3, #FF6B8A, #F05070);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -1px;
      margin-bottom: 8px;
    }

    .login-subtitle {
      font-size: 15px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 40px;
      letter-spacing: 0.3px;
    }

    .login-label {
      width: 100%;
      font-size: 13px;
      color: rgba(255,255,255,0.45);
      margin-bottom: 8px;
      letter-spacing: 0.3px;
    }

    .login-input {
      width: 100%;
      height: 52px;
      background: rgba(255,255,255,0.07);
      border: 1.5px solid rgba(255,107,138,0.25);
      border-radius: 14px;
      padding: 0 18px;
      font-size: 16px;
      color: #fff;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      -webkit-appearance: none;
      margin-bottom: 6px;
    }

    .login-input::placeholder { color: rgba(255,255,255,0.25); }

    .login-input:focus {
      border-color: #FF6B8A;
      box-shadow: 0 0 0 3px rgba(255,107,138,0.15);
    }

    .login-error {
      font-size: 12px;
      color: #FF6B8A;
      min-height: 18px;
      margin-bottom: 20px;
      text-align: center;
      width: 100%;
    }

    .login-btn-primary {
      width: 100%;
      height: 54px;
      background: linear-gradient(135deg, #FF8FA3 0%, #FF6B8A 50%, #F05070 100%);
      border: none;
      border-radius: 27px;
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      letter-spacing: 1px;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(255, 77, 109, 0.4);
      transition: transform 0.15s ease, opacity 0.2s ease;
      margin-bottom: 14px;
    }

    .login-btn-primary:active { transform: scale(0.97); }
    .login-btn-primary:disabled { opacity: 0.5; }

    .login-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      margin-bottom: 14px;
    }

    .login-divider-line {
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.12);
    }

    .login-divider-text {
      font-size: 12px;
      color: rgba(255,255,255,0.3);
    }

    .login-btn-secondary {
      width: 100%;
      height: 50px;
      background: transparent;
      border: 1.5px solid rgba(255,255,255,0.15);
      border-radius: 25px;
      font-size: 15px;
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      transition: border-color 0.2s ease, color 0.2s ease;
    }

    .login-btn-secondary:active {
      border-color: rgba(255,107,138,0.5);
      color: #FF6B8A;
    }

    .login-btn-google {
      width: 100%;
      height: 50px;
      background: #fff;
      border: none;
      border-radius: 25px;
      font-size: 15px;
      font-weight: 600;
      color: #3c4043;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: box-shadow 0.2s ease, transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      margin-bottom: 14px;
    }

    .login-btn-google:active {
      transform: scale(0.97);
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    }

    /* ─────────────────────────────
       크레딧 충전 화면
    ───────────────────────────── */
    #charge-screen {
      position: fixed;
      inset: 0;
      z-index: 500;
      background: #0d0d1a;
      flex-direction: column;
      display: none;
      opacity: 0;
      transition: opacity 0.35s ease;
      overflow: hidden;
    }
    #charge-screen.visible { opacity: 1; }

    .charge-header {
      display: flex;
      align-items: center;
      padding: max(54px, calc(env(safe-area-inset-top, 0px) + 18px)) 20px 16px;
      flex-shrink: 0;
      position: relative;
    }
    .charge-back-btn {
      width: 38px; height: 38px;
      background: rgba(255,255,255,0.08);
      border: none; border-radius: 50%;
      color: #fff; font-size: 18px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .charge-header-title {
      flex: 1; text-align: center;
      font-size: 17px; font-weight: 700; color: #fff;
      margin-right: 38px;
    }

    .charge-balance-bar {
      margin: 0 20px 20px;
      background: rgba(255,107,138,0.1);
      border: 1px solid rgba(255,107,138,0.2);
      border-radius: 14px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .charge-balance-label {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
    }
    .charge-balance-amount {
      font-size: 20px; font-weight: 800;
      color: #FF6B8A;
    }
    .charge-balance-amount span {
      font-size: 13px; font-weight: 500;
      color: rgba(255,255,255,0.4);
      margin-left: 3px;
    }

    .charge-body {
      flex: 1;
      overflow-y: auto;
      padding: 0 16px max(32px, calc(env(safe-area-inset-bottom, 0px) + 16px));
      -webkit-overflow-scrolling: touch;
    }

    .charge-legal-footer {
      padding: 16px 20px max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px));
      text-align: center;
      font-size: 11px;
      color: rgba(255,255,255,0.2);
      line-height: 1.8;
    }
    .charge-legal-footer a {
      color: rgba(255,107,138,0.6);
      text-decoration: none;
    }
    .charge-legal-sep {
      margin: 0 6px;
      color: rgba(255,255,255,0.12);
    }
    .charge-biz-info {
      margin-top: 10px;
      font-size: 10px;
      color: rgba(255,255,255,0.15);
      line-height: 1.8;
      text-align: left;
    }

    .charge-section-title {
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.35);
      letter-spacing: 1px;
      text-transform: uppercase;
      margin: 4px 4px 12px;
    }

    /* 패키지 2열 그리드 */
    .charge-packages {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 24px;
    }

    .charge-pkg-card {
      background: rgba(255,255,255,0.05);
      border: 1.5px solid rgba(255,255,255,0.08);
      border-radius: 18px;
      padding: 18px 14px 16px;
      cursor: pointer;
      position: relative;
      transition: transform 0.15s ease, border-color 0.2s ease, background 0.2s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      -webkit-tap-highlight-color: transparent;
    }
    .charge-pkg-card:active {
      transform: scale(0.96);
    }
    .charge-pkg-card.popular {
      border-color: rgba(255,107,138,0.5);
      background: rgba(255,107,138,0.08);
    }
    .charge-pkg-card.best {
      border-color: rgba(255,215,0,0.4);
      background: rgba(255,215,0,0.05);
    }
    .charge-pkg-card.starter {
      border-color: rgba(255,77,109,0.8);
      background: linear-gradient(135deg, rgba(255,77,109,0.18), rgba(255,143,163,0.1));
      box-shadow: 0 0 0 2px rgba(255,77,109,0.3), 0 6px 20px rgba(255,77,109,0.25);
      animation: pulseStarter 2s infinite;
    }
    @keyframes pulseStarter {
      0%,100% { box-shadow: 0 0 0 2px rgba(255,77,109,0.3), 0 6px 20px rgba(255,77,109,0.25); }
      50%      { box-shadow: 0 0 0 4px rgba(255,77,109,0.5), 0 8px 28px rgba(255,77,109,0.4); }
    }
    .charge-pkg-card.starter .charge-pkg-badge {
      background: linear-gradient(135deg, #FF4D6D, #c9184a);
    }

    .charge-pkg-badge {
      position: absolute;
      top: -1px; right: -1px;
      background: linear-gradient(135deg, #FF6B8A, #F05070);
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 0 17px 0 10px;
      letter-spacing: 0.3px;
    }
    .charge-pkg-card.best .charge-pkg-badge {
      background: linear-gradient(135deg, #f5c518, #e6a800);
      color: #1a1a00;
    }

    .charge-pkg-icon { font-size: 28px; margin-bottom: 2px; }
    .charge-pkg-name {
      font-size: 13px; font-weight: 600;
      color: rgba(255,255,255,0.7);
    }
    .charge-pkg-credits {
      font-size: 22px; font-weight: 800; color: #fff;
      line-height: 1.1;
    }
    .charge-pkg-credits-sub {
      font-size: 11px; color: rgba(255,107,138,0.8);
      font-weight: 600;
    }
    .charge-pkg-price {
      font-size: 14px; font-weight: 700;
      color: rgba(255,255,255,0.5);
      margin-top: 4px;
    }

    /* 무료 크레딧 섹션 */
    .charge-free-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 20px;
    }
    .charge-free-item {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .charge-free-icon {
      font-size: 22px; flex-shrink: 0;
    }
    .charge-free-info { flex: 1; }
    .charge-free-name {
      font-size: 14px; font-weight: 600; color: #fff;
    }
    .charge-free-desc {
      font-size: 12px; color: rgba(255,255,255,0.4);
      margin-top: 2px;
    }
    .charge-free-amount {
      font-size: 15px; font-weight: 800; color: #4CAF50;
      flex-shrink: 0;
    }
    .charge-free-btn {
      background: rgba(76,175,80,0.15);
      border: 1px solid rgba(76,175,80,0.3);
      border-radius: 20px;
      color: #4CAF50;
      font-size: 12px; font-weight: 600;
      padding: 6px 14px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.2s ease;
    }
    .charge-free-btn:active { background: rgba(76,175,80,0.3); }
    .charge-free-btn:disabled {
      opacity: 0.4; cursor: default;
    }

    /* 준비 중 안내 배너 */
    .charge-notice-banner {
      background: rgba(255,193,7,0.08);
      border: 1px solid rgba(255,193,7,0.2);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
    }
    .charge-notice-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
    .charge-notice-text {
      font-size: 12px;
      color: rgba(255,193,7,0.85);
      line-height: 1.5;
    }

    /* 구매 확인 팝업 */
    #charge-confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 600;
      display: none;
      align-items: flex-end;
      justify-content: center;
    }
    #charge-confirm-overlay.visible {
      display: flex;
    }
    .charge-confirm-sheet {
      background: #1a1a2e;
      border-radius: 24px 24px 0 0;
      padding: 28px 24px 40px;
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .confirm-sheet-icon { font-size: 40px; margin-bottom: 10px; }
    .confirm-sheet-title {
      font-size: 18px; font-weight: 800; color: #fff;
      margin-bottom: 6px; text-align: center;
    }
    .confirm-sheet-credits {
      font-size: 32px; font-weight: 900;
      color: #FF6B8A; margin-bottom: 2px;
    }
    .confirm-sheet-price {
      font-size: 22px; font-weight: 800; color: #fff;
      margin-bottom: 16px;
    }
    .confirm-sheet-methods {
      display: flex; flex-wrap: wrap; gap: 6px;
      justify-content: center; margin-bottom: 20px;
    }
    .confirm-method-badge {
      font-size: 11px; padding: 4px 10px;
      border-radius: 20px;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .confirm-method-badge.kakao {
      background: rgba(255,220,0,0.12);
      color: #FFD700;
      border-color: rgba(255,220,0,0.2);
    }
    .confirm-method-badge.toss {
      background: rgba(0,100,255,0.12);
      color: #6EB4FF;
      border-color: rgba(0,100,255,0.2);
    }
    .confirm-sheet-btns {
      display: flex; gap: 10px; width: 100%;
    }
    .confirm-btn-cancel {
      flex: 1; height: 50px;
      background: rgba(255,255,255,0.07);
      border: none; border-radius: 25px;
      color: rgba(255,255,255,0.6);
      font-size: 15px; cursor: pointer;
    }
    .confirm-btn-ok {
      flex: 2; height: 50px;
      background: linear-gradient(135deg,#3182F6,#1B6FEB);
      border: none; border-radius: 25px;
      color: #fff; font-size: 15px; font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(49,130,246,0.4);
    }
    .confirm-btn-ok:active { transform: scale(0.97); }
    .confirm-sheet-safe {
      margin-top: 12px;
      font-size: 11px;
      color: rgba(255,255,255,0.25);
    }
    .confirm-sheet-legal {
      margin-top: 6px;
      font-size: 10px;
      color: rgba(255,255,255,0.2);
      text-align: center;
    }

    /* ── Starter 충동구매 팝업 ── */
    #starter-impulse-popup {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      z-index: 9500;
      display: none;
      align-items: flex-end;
      justify-content: center;
    }
    #starter-impulse-popup.visible {
      display: flex;
    }
    .starter-impulse-sheet {
      background: linear-gradient(160deg, #1a0a12, #2a0e1e);
      border-radius: 28px 28px 0 0;
      padding: 28px 24px max(40px, env(safe-area-inset-bottom));
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      animation: slideUp 0.35s ease;
      position: relative;
    }
    .starter-impulse-close {
      position: absolute;
      top: 16px; right: 16px;
      background: rgba(255,255,255,0.08);
      border: none; border-radius: 50%;
      width: 32px; height: 32px;
      color: rgba(255,255,255,0.5);
      font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .starter-impulse-emoji { font-size: 48px; margin-bottom: 10px; }
    .starter-impulse-title {
      font-size: 22px; font-weight: 800; color: #fff;
      margin-bottom: 8px; text-align: center;
    }
    .starter-impulse-sub {
      font-size: 15px; color: rgba(255,255,255,0.7);
      text-align: center; line-height: 1.7; margin-bottom: 20px;
    }
    .starter-impulse-sub strong { color: #FF8FA3; }
    .starter-impulse-value-bar {
      display: flex; align-items: center; gap: 0;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,77,109,0.25);
      border-radius: 16px;
      padding: 14px 20px;
      width: 100%;
      margin-bottom: 20px;
      justify-content: space-around;
    }
    .starter-value-item {
      display: flex; flex-direction: column;
      align-items: center; gap: 4px;
    }
    .starter-value-num {
      font-size: 20px; font-weight: 800; color: #FF6B8A;
    }
    .starter-value-label {
      font-size: 11px; color: rgba(255,255,255,0.45);
    }
    .starter-value-divider {
      width: 1px; height: 36px;
      background: rgba(255,255,255,0.1);
    }
    .starter-impulse-btn {
      width: 100%; height: 56px;
      background: linear-gradient(135deg, #FF4D6D, #c9184a);
      border: none; border-radius: 28px;
      color: #fff; font-size: 17px; font-weight: 800;
      cursor: pointer; letter-spacing: -0.3px;
      box-shadow: 0 6px 20px rgba(255,77,109,0.5);
      transition: transform 0.15s;
    }
    .starter-impulse-btn:active { transform: scale(0.97); }
    .starter-impulse-skip {
      margin-top: 14px;
      font-size: 13px; color: rgba(255,255,255,0.3);
      cursor: pointer; text-decoration: underline;
    }

    /* ═══════════════════════════════════════
       광고 시청 → 크레딧 획득 UI
    ═══════════════════════════════════════ */

    /* ① 크레딧 부족 모달 */
    #ad-credit-modal.visible { display: flex !important; }
    .ad-credit-sheet {
      background: linear-gradient(160deg, #1a0a12, #2a0e1e);
      border-radius: 28px 28px 0 0;
      padding: 28px 24px max(40px, env(safe-area-inset-bottom));
      width: 100%; max-width: 480px;
      display: flex; flex-direction: column; align-items: center;
      animation: slideUp 0.35s ease; position: relative;
      margin-top: auto;
    }
    .ad-credit-close {
      position: absolute; top: 16px; right: 16px;
      background: rgba(255,255,255,0.08); border: none; border-radius: 50%;
      width: 32px; height: 32px; color: rgba(255,255,255,0.5);
      font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .ad-credit-emoji { font-size: 44px; margin-bottom: 8px; }
    .ad-credit-title {
      font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px;
    }
    .ad-credit-balance {
      font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 4px;
    }
    .ad-credit-remain-info {
      font-size: 13px; color: #FF8FA3; font-weight: 600; margin-bottom: 22px;
    }
    .ad-watch-btn {
      width: 100%; height: 58px;
      background: linear-gradient(135deg, #FF6B8A, #FF4D6D);
      border: none; border-radius: 29px;
      color: #fff; font-size: 17px; font-weight: 800;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 12px;
      box-shadow: 0 6px 24px rgba(255,77,109,0.5);
      transition: transform 0.15s, opacity 0.2s;
      position: relative;
    }
    .ad-watch-btn:active { transform: scale(0.97); }
    .ad-watch-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .ad-watch-icon { font-size: 20px; }
    .ad-watch-badge {
      position: absolute; top: -8px; right: 16px;
      background: #FFD60A; color: #1a0a12;
      font-size: 11px; font-weight: 800; padding: 2px 8px;
      border-radius: 10px; letter-spacing: 0.3px;
    }
    .ad-charge-btn {
      width: 100%; height: 50px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,107,138,0.3); border-radius: 25px;
      color: rgba(255,255,255,0.7); font-size: 15px; font-weight: 600;
      cursor: pointer; margin-bottom: 8px;
      transition: background 0.15s;
    }
    .ad-charge-btn:active { background: rgba(255,255,255,0.12); }
    .ad-credit-dismiss {
      margin-top: 10px; font-size: 13px;
      color: rgba(255,255,255,0.28); cursor: pointer; text-decoration: underline;
    }

    /* ② 광고 로딩 오버레이 */
    #ad-loading-overlay.visible { display: flex !important; }
    .ad-loading-logo { font-size: 56px; margin-bottom: 6px; }
    .ad-loading-title {
      font-size: 24px; font-weight: 800; color: #FF8FA3; margin-bottom: 24px;
    }
    .ad-loading-spinner {
      width: 44px; height: 44px;
      border: 3px solid rgba(255,107,138,0.2);
      border-top-color: #FF6B8A; border-radius: 50%;
      animation: spin 0.8s linear infinite; margin-bottom: 16px;
    }
    .ad-loading-msg {
      font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 8px;
    }
    .ad-loading-timer {
      font-size: 32px; font-weight: 800; color: #FF6B8A;
      margin-bottom: 6px; min-width: 40px; text-align: center;
    }
    .ad-loading-sub { font-size: 12px; color: rgba(255,255,255,0.3); }

    /* ③ 크레딧 보상 팝업 */
    #ad-reward-popup.visible { display: flex !important; }
    .ad-reward-sheet {
      background: linear-gradient(160deg, #1a0a12, #2a0e1e);
      border: 1px solid rgba(255,107,138,0.4);
      border-radius: 28px; padding: 40px 32px;
      display: flex; flex-direction: column; align-items: center;
      animation: rewardPop 0.5s cubic-bezier(0.34,1.56,0.64,1);
      min-width: 260px;
    }
    @keyframes rewardPop {
      from { transform: scale(0.6); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }
    .ad-reward-coins {
      display: flex; gap: 6px; margin-bottom: 12px;
    }
    .ad-coin {
      font-size: 36px;
      animation: coinDrop 0.6s ease both;
    }
    @keyframes coinDrop {
      0%   { transform: translateY(-40px); opacity: 0; }
      60%  { transform: translateY(4px); }
      100% { transform: translateY(0); opacity: 1; }
    }
    .ad-reward-amount {
      font-size: 52px; font-weight: 900;
      background: linear-gradient(135deg, #FFD60A, #FF8FA3);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 4px;
      animation: countUp 0.8s ease;
    }
    @keyframes countUp {
      from { transform: scale(0.5); }
      to   { transform: scale(1); }
    }
    .ad-reward-label {
      font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 8px;
    }
    .ad-reward-total { font-size: 13px; color: rgba(255,255,255,0.45); }

    /* ④ 재고 없음 모달 */
    #ad-no-inventory-modal.visible { display: flex !important; }
    .ad-noinv-sheet {
      background: linear-gradient(160deg, #1a1a2e, #16213e);
      border: 1px solid rgba(255,107,138,0.2);
      border-radius: 24px; padding: 36px 28px;
      display: flex; flex-direction: column; align-items: center;
      animation: modalSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
      width: min(320px, 90vw);
    }
    .ad-noinv-emoji { font-size: 48px; margin-bottom: 12px; }
    .ad-noinv-title { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 8px; }
    .ad-noinv-sub {
      font-size: 14px; color: rgba(255,255,255,0.5);
      text-align: center; line-height: 1.6; margin-bottom: 24px;
    }
    .ad-noinv-charge-btn {
      width: 100%; height: 52px;
      background: linear-gradient(135deg, #FF6B8A, #FF4D6D);
      border: none; border-radius: 26px;
      color: #fff; font-size: 16px; font-weight: 700;
      cursor: pointer; margin-bottom: 10px;
    }
    .ad-noinv-close {
      font-size: 13px; color: rgba(255,255,255,0.3);
      cursor: pointer; text-decoration: underline;
    }

  </style>
</head>
<body>

  <!-- ✦ 크레딧 뱃지 (전역 고정) - 스와이프 외 화면에서 숨김 처리됨 -->
  <div id="credit-badge" style="display:none;">
    <span class="credit-icon">💎</span>
    <span class="credit-amount" id="credit-amount">15</span>
  </div>

  <!-- ✦ 크레딧 부족 토스트 -->
  <div id="credit-toast">💎 크레딧이 부족해요!</div>

  <!-- ⑦ 채팅 허브 화면 (메인 채팅 목록) -->
  <div id="hub-screen" class="screen" style="display:none; opacity:0;">

    <!-- 상단 헤더 -->
    <div class="hub-header">
      <div class="hub-header-left">
        <div class="hub-title">💌 대화 중인 파트너</div>
        <div class="hub-subtitle" id="hub-subtitle">연결된 파트너가 없어요</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <div onclick="openMypageScreen()" class="swipe-credit-inline" id="hub-credit-inline">
          <span class="sci-icon">💎</span>
          <span id="hub-credit-num">15</span>
        </div>
        <button class="hub-back-btn" onclick="goBackFromHub()">✕</button>
      </div>
    </div>

    <!-- 스크롤 영역 -->
    <div class="hub-scroll" id="hub-scroll">

      <!-- 새 파트너 찾기 버튼 -->
      <div class="hub-new-btn" onclick="goBackFromHub()">
        <div class="hub-new-icon">💝</div>
        <div class="hub-new-text">
          <div class="hub-new-title">새 파트너 찾기</div>
          <div class="hub-new-desc">아직 만나지 못한 파트너가 있어요</div>
        </div>
        <div class="hub-new-arrow">›</div>
      </div>

      <!-- 채팅 중인 파트너 (가로 스크롤 아바타) -->
      <div id="hub-discover-section" style="display:none; margin-top:8px;">
        <div class="hub-section-label" style="margin-top:8px;">채팅 중</div>
        <div class="hub-discover-row" id="hub-discover-row">
          <!-- JS로 생성 -->
        </div>
        <div class="hub-divider"></div>
      </div>

      <!-- 채팅 목록 -->
      <div id="hub-chat-section" style="margin-top:8px;">
        <div class="hub-section-label">최근 대화</div>
        <div class="hub-chat-list" id="hub-chat-list">
          <!-- JS로 생성 -->
        </div>
      </div>

    </div>

  </div>

  <!-- ⑨ 마이페이지 화면 -->
  <div id="mypage-screen" class="screen" style="display:none; opacity:0;">

    <!-- 상단 헤더 -->
    <div class="mypage-header">
      <div class="mypage-title">💎 마이페이지</div>
      <button class="mypage-close-btn" onclick="closeMypageScreen()">✕</button>
    </div>

    <!-- 프로필 섹션 -->
    <div class="mypage-profile-section">
      <div class="mypage-avatar" id="mypage-avatar">👤</div>
      <div class="mypage-username" id="mypage-username">—</div>
      <div class="mypage-user-desc" id="mypage-user-desc">Lovia 멤버</div>
      <!-- 비로그인 상태: 로그인/가입 버튼 -->
      <div id="mypage-login-banner" style="display:none; margin-top:14px; width:100%;">
        <div style="font-size:13px; color:rgba(255,255,255,0.45); margin-bottom:10px;">
          로그인하면 모든 기능을 이용할 수 있어요 💕
        </div>
        <div style="display:flex; gap:8px; justify-content:center;">
          <button class="mypage-login-btn" onclick="goToLoginScreen()">🔑 로그인</button>
          <button class="mypage-signup-btn" onclick="showSignupPopup('mypage')">✨ 회원가입</button>
        </div>
      </div>
      <!-- 로그인 상태: 로그아웃 버튼 -->
      <button id="mypage-logout-btn" style="display:none;" class="mypage-logout-btn" onclick="doLogout()">로그아웃</button>
    </div>

    <!-- 크레딧 카드 -->
    <div class="mypage-credit-card">
      <div class="mypage-credit-top">
        <span class="mypage-credit-label">보유 크레딧</span>
        <span class="mypage-credit-icon">💎</span>
      </div>
      <div>
        <span class="mypage-credit-amount" id="mypage-credit-amount">0</span>
        <span class="mypage-credit-unit">크레딧</span>
      </div>
      <div class="mypage-credit-desc">메시지 1개 = 1 크레딧 소모 · 매일 로그인 시 +5 크레딧</div>
      <button class="mypage-charge-btn" onclick="openChargeScreen()">💳 크레딧 충전하기</button>
    </div>

    <!-- 통계 -->
    <div class="mypage-stats-section">
      <div class="mypage-stat-card">
        <div class="mypage-stat-icon">💌</div>
        <div class="mypage-stat-value" id="mypage-stat-partners">0</div>
        <div class="mypage-stat-label">대화 중인 파트너</div>
      </div>
      <div class="mypage-stat-card">
        <div class="mypage-stat-icon">💬</div>
        <div class="mypage-stat-value" id="mypage-stat-msgs">0</div>
        <div class="mypage-stat-label">보낸 메시지</div>
      </div>
      <div class="mypage-stat-card">
        <div class="mypage-stat-icon">❤️</div>
        <div class="mypage-stat-value" id="mypage-stat-likes">0</div>
        <div class="mypage-stat-label">그램 좋아요</div>
      </div>
    </div>

    <!-- 무료 크레딧 -->
    <div class="mypage-section-title">🎁 무료 크레딧</div>
    <div class="mypage-free-section">
      <div class="mypage-free-btn" id="mypage-daily-btn" onclick="claimDailyCredit()">
        <div class="mypage-free-btn-icon" style="background:rgba(255,200,100,0.15);">☀️</div>
        <div class="mypage-free-btn-info">
          <div class="mypage-free-btn-title">매일 출석 체크</div>
          <div class="mypage-free-btn-desc">매일 한 번 +5 크레딧 받기</div>
        </div>
        <div class="mypage-free-btn-badge" id="mypage-daily-badge">+5</div>
      </div>
      <div class="mypage-free-btn" onclick="openShareScreen()">
        <div class="mypage-free-btn-icon" style="background:rgba(100,180,255,0.15);">🔗</div>
        <div class="mypage-free-btn-info">
          <div class="mypage-free-btn-title">친구 초대</div>
          <div class="mypage-free-btn-desc">친구 1명 초대 시 +20 크레딧 (준비 중)</div>
        </div>
        <div class="mypage-free-btn-badge used">준비 중</div>
      </div>
    </div>

    <!-- 크레딧 내역 -->
    <div class="mypage-section-title">📋 최근 크레딧 내역</div>
    <div class="mypage-history-list" id="mypage-history-list">
      <!-- JS로 생성 -->
    </div>

    <!-- 법적 정보 & 설정 (로그인 시에만 표시) -->
    <div id="mypage-legal-section" style="display:none">
      <div class="mypage-section-title">⚙️ 정보 및 설정</div>
      <div class="mypage-legal-inner">
        <!-- 선톡(푸시) 알림 토글 -->
      <div class="mypage-legal-row mypage-push-row">
        <span class="mypage-legal-icon">🔔</span>
        <span class="mypage-legal-label">AI 선톡 알림</span>
        <label class="push-toggle-label">
          <input type="checkbox" id="push-opt-toggle" onchange="setPushOptIn(this.checked)">
          <span class="push-toggle-track"></span>
        </label>
      </div>
      <a href="/terms" target="_blank" class="mypage-legal-row">
        <span class="mypage-legal-icon">📄</span>
        <span class="mypage-legal-label">이용약관 및 환불규정</span>
        <span class="mypage-legal-arrow">›</span>
      </a>
      <a href="/privacy" target="_blank" class="mypage-legal-row">
        <span class="mypage-legal-icon">🔒</span>
        <span class="mypage-legal-label">개인정보 처리방침</span>
        <span class="mypage-legal-arrow">›</span>
      </a>
      <a href="mailto:support@lovia.app" class="mypage-legal-row">
        <span class="mypage-legal-icon">💌</span>
        <span class="mypage-legal-label">고객센터 / 환불 문의</span>
        <span class="mypage-legal-arrow">›</span>
      </a>
      </div><!-- /mypage-legal-inner -->
      <!-- AI 콘텐츠 공시 (App Store 정책 준수) -->
      <div class="mypage-ai-disclosure">
        <div class="mypage-ai-disclosure-title">🤖 AI 생성 콘텐츠 안내</div>
        <div class="mypage-ai-disclosure-text">이 앱의 캐릭터 대화는 AI(인공지능)가 생성하는 콘텐츠를 포함합니다. 대화 상대는 실제 사람이 아닌 AI 캐릭터입니다. AI 응답은 Anthropic Claude API를 통해 생성되며, 대화 내용은 AI 모델 학습에 사용되지 않습니다.</div>
      </div>
      <div class="mypage-app-version">Lovia v1.2 · © 2026 Lovia</div>

      <!-- 사업자 정보 푸터 -->
      <div class="mypage-biz-footer">
        <div class="mypage-biz-title">사업자 정보</div>
        <div class="mypage-biz-row"><span class="mypage-biz-key">상호명</span><span class="mypage-biz-val" id="biz-name">우드와이드</span></div>
        <div class="mypage-biz-row"><span class="mypage-biz-key">대표자</span><span class="mypage-biz-val" id="biz-ceo">박현우</span></div>
        <div class="mypage-biz-row"><span class="mypage-biz-key">사업자등록번호</span><span class="mypage-biz-val" id="biz-reg">783-10-03120</span></div>
        <div class="mypage-biz-row"><span class="mypage-biz-key">사업장 주소</span><span class="mypage-biz-val" id="biz-addr">[사업장 주소]</span></div>
        <div class="mypage-biz-row"><span class="mypage-biz-key">유선번호</span><span class="mypage-biz-val" id="biz-tel">[전화번호]</span></div>
        <div class="mypage-biz-row"><span class="mypage-biz-key">이메일</span><span class="mypage-biz-val">support@lovia.app</span></div>
        <div class="mypage-biz-notice">※ 위 정보는 사업자등록증 상의 정보와 동일합니다.</div>
      </div>
    </div><!-- /mypage-legal-section -->

    <!-- 대화 초기화 섹션 -->
    <div id="mypage-reset-section">
      <div class="mypage-section-title">🗑️ 대화 초기화</div>
      <div class="mypage-reset-list" id="mypage-reset-list">
        <!-- JS로 생성 -->
      </div>
    </div>

    <div class="mypage-bottom-spacer"></div>
  </div><!-- /mypage-screen -->

  <!-- 대화 초기화 확인 모달 -->
  <div id="reset-confirm-modal" style="display:none;">
    <div class="reset-modal-box">
      <div class="reset-modal-icon">⚠️</div>
      <div class="reset-modal-title" id="reset-modal-title">대화를 초기화할까요?</div>
      <div class="reset-modal-desc">채팅 히스토리, 관계 레벨, 기억, 스토리 기록이 모두 삭제됩니다.<br/>되돌릴 수 없어요.</div>
      <div class="reset-modal-btns">
        <button class="reset-modal-cancel" onclick="closeResetModal()">취소</button>
        <button class="reset-modal-confirm" onclick="doResetPersona()">초기화</button>
      </div>
    </div>
  </div>

  <!-- ⑧ 인앱 그램 피드 화면 -->
  <div id="gram-screen" class="screen" style="display:none; opacity:0;">

    <!-- 상단 헤더 -->
    <div class="gram-header">
      <div class="gram-header-row">
        <button class="gram-back-btn" id="gram-back-btn">‹</button>
        <div class="gram-title">📸 그램</div>
        <div onclick="openMypageScreen()" class="swipe-credit-inline" id="gram-credit-inline">
          <span class="sci-icon">💎</span>
          <span id="gram-credit-num">15</span>
        </div>
      </div>
      <!-- 파트너 필터 탭 -->
      <div class="gram-filter-wrap">
        <div class="gram-filter-tabs" id="gram-filter-tabs">
          <!-- JS로 생성 -->
        </div>
      </div>
    </div>

    <!-- 피드 목록 -->
    <div class="gram-feed" id="gram-feed">
      <!-- JS로 생성 -->
    </div>

  </div>

  <!-- ⑨ 관심/패스 관리 화면 -->
  <div id="pick-screen" class="screen" style="display:none; opacity:0;">

    <div class="pick-header">
      <div class="pick-header-row">
        <div class="pick-title">💘 스와이프 관리</div>
        <button class="pick-back-btn" onclick="closePickScreen()">✕</button>
      </div>
      <!-- 탭: 관심 / 패스 -->
      <div class="pick-tabs">
        <button class="pick-tab active" id="pick-tab-like" onclick="switchPickTab('like')">💗 관심 목록</button>
        <button class="pick-tab" id="pick-tab-pass" onclick="switchPickTab('pass')">✕ 패스 목록</button>
      </div>
    </div>

    <div class="pick-scroll">
      <div class="pick-grid" id="pick-grid">
        <!-- JS로 렌더 -->
      </div>
    </div>

  </div>

  <!-- ⑤ AI 프로필 상세 화면 -->
  <div id="profile-detail-screen" class="screen" style="display:none; opacity:0;">

    <!-- 뒤로가기 -->
    <button class="pd-back-btn" onclick="goBackToSwipe()">‹</button>

    <!-- 히어로 이미지 -->
    <div class="pd-hero">
      <img class="pd-hero-img" id="pd-hero-img" src="" alt="" />
      <div class="pd-hero-gradient"></div>
    </div>

    <!-- 스크롤 컨텐츠 -->
    <div class="pd-scroll">

      <!-- 이름 / 직업 / 태그 / 소개 -->
      <div class="pd-name-section">
        <div class="pd-name-row">
          <span class="pd-name" id="pd-name">—</span>
          <span class="pd-age" id="pd-age"></span>
        </div>
        <div class="pd-job" id="pd-job">📍 —</div>
        <div class="pd-tags" id="pd-tags"></div>
        <div class="pd-quote" id="pd-quote"></div>
      </div>

      <!-- 기본 정보 -->
      <div class="pd-section-title">기본 정보</div>
      <div class="pd-info-grid" id="pd-info-grid"></div>

      <!-- 인앱그램 미니 피드 -->
      <div class="pd-gram-section">
        <div class="pd-section-title" style="margin-bottom:14px;">그램 피드</div>
        <div class="pd-gram-grid" id="pd-gram-grid"></div>
      </div>

    </div>

    <!-- 채팅 시작 버튼 -->
    <div class="pd-chat-btn-wrap">
      <button class="pd-chat-btn" id="pd-chat-btn">
        <span>💬</span>
        <span id="pd-chat-btn-label">채팅 시작하기</span>
      </button>
    </div>

  </div>

  <!-- ⑥ 채팅방 화면 -->
  <div id="chat-screen" class="screen" style="display:none; opacity:0;">

    <!-- 상단 헤더 -->
    <div class="chat-header">
      <div class="chat-back-btn" onclick="goBackFromChat()">‹</div>
      <img class="chat-header-avatar" id="chat-avatar" src="" alt="" />
      <div class="chat-header-info">
        <div class="chat-header-name" id="chat-name">—</div>
        <div class="chat-header-status">
          <div class="status-dot"></div>
          <span id="chat-header-status-text">지금 활동 중</span>
          <span class="chat-level-badge" id="chat-level-badge">Lv.1 짝사랑</span>
        </div>
      </div>
      <div class="chat-header-right">
        <button id="tutorial-skip-btn" onclick="skipTutorial()">스킵</button>
        <div onclick="openMypageScreen()" class="swipe-credit-inline" id="chat-credit-inline">
          <span class="sci-icon">💎</span>
          <span id="chat-credit-num">15</span>
        </div>
        <div class="chat-header-profile-btn" onclick="goToProfile()">ⓘ</div>
      </div>
    </div>

    <!-- 메시지 목록 -->
    <div class="chat-messages" id="chat-messages"></div>

    <!-- 입력창 -->
    <div class="chat-input-bar">
      <!-- 스토리 모드: 선택지 버튼 (기본 hidden) -->
      <div id="story-choices-container"></div>

      <!-- 상단: 음성/사진 요청 버튼 -->
      <div class="chat-action-row" id="chat-action-row">
        <button class="chat-action-btn voice-btn" onclick="requestVoiceMessage()" title="음성 메시지 요청 (5C)">
          🎙️ <span>음성</span> <span class="action-cost">5C</span>
        </button>
        <button class="chat-action-btn photo-btn" onclick="requestSpecialPhoto()" title="특별 사진 요청 (10C)">
          📸 <span>사진</span> <span class="action-cost">10C</span>
        </button>
      </div>
      <div class="chat-input-wrap">
        <textarea
          class="chat-input"
          id="chat-input"
          placeholder="메시지를 입력하세요..."
          rows="1"
        ></textarea>
        <button class="chat-send-btn" id="chat-send-btn">▶</button>
      </div>
    </div>

  </div>

  <!-- ④ 프로필 스와이프 화면 -->
  <div id="swipe-screen" class="screen" style="display:none; opacity:0;">

    <!-- 스와이프 튜토리얼 오버레이 -->
    <div id="swipe-tutorial">
      <div class="tutorial-title">이렇게 사용해요 💝</div>
      <div class="tutorial-subtitle">카드를 좌우로 밀어서<br>마음에 드는 상대를 골라보세요</div>

      <!-- 카드 미리보기 애니메이션 -->
      <div class="tutorial-card-preview">
        <div class="t-card-bg"></div>
        <div class="t-card-main swing">💝</div>
        <div class="t-label pass animate">PASS ✕</div>
        <div class="t-label chat animate">CHAT 💬</div>
      </div>

      <!-- 좌/우 힌트 -->
      <div class="tutorial-hint-row">
        <div class="tutorial-hint pass-hint">
          <div class="tutorial-hint-direction">← 왼쪽</div>
          <div class="tutorial-hint-icon">✕</div>
          <div class="tutorial-hint-text">패스</div>
          <div class="tutorial-hint-sub">다음 상대로 넘기기</div>
        </div>
        <div class="tutorial-hint-divider"></div>
        <div class="tutorial-hint chat-hint">
          <div class="tutorial-hint-direction">오른쪽 →</div>
          <div class="tutorial-hint-icon">💬</div>
          <div class="tutorial-hint-text">채팅 시작</div>
          <div class="tutorial-hint-sub">대화 시작하기</div>
        </div>
      </div>

      <button class="tutorial-btn" onclick="closeTutorial()">💗 시작하기</button>
      <div class="tutorial-skip" onclick="closeTutorial()">다시 보지 않기</div>
    </div>

    <!-- 상단 헤더 -->
    <div class="swipe-header">

      <!-- 1행: 인사말 (좌) + 크레딧 (우) -->
      <div class="swipe-title-row">
        <div class="swipe-greeting">안녕하세요, <strong id="greeting-name">친구</strong>님 👋</div>
        <div onclick="openMypageScreen()" class="swipe-credit-inline" id="swipe-credit-inline">
          <span class="sci-icon">💎</span>
          <span id="swipe-credit-num">15</span>
        </div>
      </div>

      <!-- 2행: 채팅/픽 버튼 (좌) + 탭 (우) -->
      <div class="swipe-action-row">
        <div style="display:flex;align-items:center;gap:6px;">
          <button id="pick-entry-btn" onclick="openPickScreen()" style="
            background:rgba(255,107,138,0.12);
            border:1.5px solid rgba(255,107,138,0.35);
            border-radius:20px;
            padding:5px 11px;
            color:#FF8FA3;
            font-size:12px;
            font-weight:600;
            cursor:pointer;
            display:none;
            align-items:center;gap:4px;
          ">
            <span id="pick-btn-label">💗 0</span>
          </button>
          <button id="hub-entry-btn" onclick="openHub()" style="
            background:rgba(255,107,138,0.15);
            border:1.5px solid rgba(255,107,138,0.4);
            border-radius:20px;
            padding:5px 11px;
            color:#FF8FA3;
            font-size:12px;
            font-weight:600;
            cursor:pointer;
            display:none;
            align-items:center;gap:5px;
          ">
            <span>💌</span>
            <span id="hub-btn-label">채팅 목록</span>
          </button>
        </div>
        <div class="view-tabs">
          <button class="view-tab active" id="tab-card" onclick="switchView('card')">💝 카드</button>
          <button class="view-tab" id="tab-list" onclick="switchView('list')">☰ 전체보기</button>
          <button class="view-tab" id="tab-gram" onclick="openGramScreen()">📸 그램</button>
        </div>
      </div>

    </div>

    <!-- 카드 뷰 -->
    <div id="card-view">
      <div class="card-stack" id="card-stack">
        <!-- JS로 카드 생성 -->
      </div>
      <!-- 카드 카운터 (하단 중앙) -->
      <div class="card-counter-wrap">
        <div class="card-counter" id="card-counter"></div>
      </div>

      <!-- 추천 스킵 버튼 -->
      <div class="skip-recommend-wrap" id="skip-recommend-wrap">
        <button class="skip-recommend-btn" onclick="skipRecommendation()">다음부터 추천받지 않음</button>
      </div>

      <!-- 하단 액션 버튼 -->
      <div class="card-actions">
        <button class="action-btn action-btn-pass" onclick="swipeCard('left')" title="패스">✕</button>
        <button class="action-btn action-btn-chat" onclick="swipeCard('right')" title="채팅하기">💬</button>
      </div>
    </div>

    <!-- 리스트 뷰 -->
    <div id="list-view">
      <div class="list-items" id="list-items">
        <!-- JS로 리스트 생성 -->
      </div>
    </div>

  </div>

  <!-- ① 스플래시 화면 -->
  <div id="splash" class="screen">
    <img id="splash-img" class="splash-bg" src="/images/splash1.jpg" alt="Lovia" draggable="false" />
    <div class="splash-overlay-top"></div>
    <div class="splash-overlay-bottom"></div>
    <div class="splash-bottom">
      <div class="loading-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    </div>
  </div>

  <!-- 로그인 화면 (재방문 유저 / 토큰 만료) -->
  <div id="login-screen" class="screen" style="display:none; opacity:0;">
    <div class="login-bg"></div>
    <div class="login-bokeh-1"></div>
    <div class="login-bokeh-2"></div>

    <div class="login-content">
      <div class="login-logo">Lovia</div>
      <div class="login-subtitle">다시 만나서 반가워요 💕</div>

      <div class="login-label">가입하신 이메일을 입력해주세요</div>
      <input
        type="email"
        id="login-email-input"
        class="login-input"
        placeholder="example@email.com"
        autocomplete="email"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
      />
      <div id="login-error-msg" class="login-error"></div>

      <button id="login-submit-btn" class="login-btn-primary" onclick="submitLogin()">
        로그인
      </button>

      <button class="login-btn-google" onclick="loginWithGoogle()">
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        구글로 계속하기
      </button>

      <div class="login-divider">
        <div class="login-divider-line"></div>
        <div class="login-divider-text">또는</div>
        <div class="login-divider-line"></div>
      </div>

      <button class="login-btn-secondary" onclick="startFreshOnboarding()">
        새 계정으로 시작하기
      </button>
    </div>
  </div>

  <!-- ③ 이름 입력 화면 -->
  <div id="name-input-screen" class="screen" style="display:none; opacity:0;">

    <!-- 배경 그라데이션 -->
    <div class="name-bg"></div>

    <!-- 보케 오브젝트들 -->
    <div class="bokeh bokeh-1"></div>
    <div class="bokeh bokeh-2"></div>
    <div class="bokeh bokeh-3"></div>
    <div class="bokeh bokeh-4"></div>
    <div class="bokeh bokeh-5"></div>
    <div class="sparkle sparkle-1">✦</div>
    <div class="sparkle sparkle-2">✦</div>
    <div class="sparkle sparkle-3">✧</div>

    <!-- 콘텐츠 영역 -->
    <div class="name-content">
      <h1 class="name-title">당신의 이름을<br>알려주세요 :)</h1>

      <div class="name-input-wrap">
        <input
          type="text"
          id="user-name-input"
          class="name-input"
          placeholder="이름을 입력해주세요..."
          maxlength="10"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        />
        <div class="name-input-underline"></div>
      </div>
    </div>

    <!-- 하단 버튼 -->
    <div class="name-bottom">
      <button class="btn-next" id="btn-next" onclick="goToProfileSwipe()">
        다음
      </button>
    </div>
  </div>

  <!-- ② 매니저 AI 동영상 화면 -->
  <div id="intro-video-screen" class="screen" style="display:none;">
    <video
      id="intro-video"
      playsinline
      webkit-playsinline="true"
      x5-playsinline="true"
      muted
      preload="auto"
      type="video/mp4"
    ></video>
    <div class="video-overlay-top"></div>

    <!-- 하단: 말풍선 + 버튼 -->
    <div class="video-bottom">
      <div class="speech-bubble">
        <p class="speech-bubble-text" id="bubble-text">
          <span class="typing-cursor"></span>
        </p>
      </div>
      <button class="btn-primary" id="btn-meet" onclick="goToNextScreen()">
        <span class="btn-icon">💗</span>
        만나볼게요
      </button>
    </div>
  </div>

  <!-- ══════════════════════════════════════ -->
  <!-- 크레딧 충전 화면                        -->
  <!-- ══════════════════════════════════════ -->
  <div id="charge-screen">
    <!-- 헤더 -->
    <div class="charge-header">
      <button class="charge-back-btn" onclick="closeChargeScreen()">←</button>
      <div class="charge-header-title">💎 크레딧 충전</div>
    </div>

    <!-- 현재 잔액 바 -->
    <div class="charge-balance-bar">
      <div class="charge-balance-label">현재 잔액</div>
      <div class="charge-balance-amount">
        <span id="charge-current-credits">0</span><span>크레딧</span>
      </div>
    </div>

    <!-- 스크롤 가능 바디 -->
    <div class="charge-body">

      <!-- 패키지 섹션 -->
      <div class="charge-section-title">💳 크레딧 패키지</div>
      <div class="charge-packages">

        <!-- Starter (충동구매 유도) -->
        <div class="charge-pkg-card starter" onclick="selectPackage('starter')">
          <div class="charge-pkg-badge">🔥 첫 충전</div>
          <div class="charge-pkg-icon">💌</div>
          <div class="charge-pkg-name">Starter</div>
          <div class="charge-pkg-credits">200</div>
          <div class="charge-pkg-credits-sub">400회 채팅</div>
          <div class="charge-pkg-price">₩990</div>
        </div>

        <!-- Basic -->
        <div class="charge-pkg-card" onclick="selectPackage('basic')">
          <div class="charge-pkg-icon">🌸</div>
          <div class="charge-pkg-name">Basic</div>
          <div class="charge-pkg-credits">200</div>
          <div class="charge-pkg-credits-sub">400회 채팅</div>
          <div class="charge-pkg-price">₩2,200</div>
        </div>

        <!-- Recommended (추천) -->
        <div class="charge-pkg-card popular" onclick="selectPackage('recom')">
          <div class="charge-pkg-badge">💝 추천</div>
          <div class="charge-pkg-icon">💝</div>
          <div class="charge-pkg-name">Recommended</div>
          <div class="charge-pkg-credits">550</div>
          <div class="charge-pkg-credits-sub">+50 보너스 · 1,200회</div>
          <div class="charge-pkg-price">₩5,500</div>
        </div>

        <!-- Premium (인기) -->
        <div class="charge-pkg-card" onclick="selectPackage('premium')">
          <div class="charge-pkg-badge">💖 인기</div>
          <div class="charge-pkg-icon">💖</div>
          <div class="charge-pkg-name">Premium</div>
          <div class="charge-pkg-credits">1,200</div>
          <div class="charge-pkg-credits-sub">+200 보너스 · 2,800회</div>
          <div class="charge-pkg-price">₩11,000</div>
        </div>

        <!-- VVIP (베스트) -->
        <div class="charge-pkg-card best" onclick="selectPackage('vvip')">
          <div class="charge-pkg-badge">👑 BEST</div>
          <div class="charge-pkg-icon">👑</div>
          <div class="charge-pkg-name">VVIP</div>
          <div class="charge-pkg-credits">6,500</div>
          <div class="charge-pkg-credits-sub">+1,500 보너스 · 16,000회</div>
          <div class="charge-pkg-price">₩55,000</div>
        </div>

      </div>

      <!-- 준비 중 안내 -->
      <div class="charge-notice-banner">
        <div class="charge-notice-icon">⚠️</div>
        <div class="charge-notice-text">
          실제 결제 시스템은 준비 중이에요.<br>
          지금은 테스트로 패키지를 선택하면 크레딧이 즉시 지급됩니다.
        </div>
      </div>

      <!-- 무료 크레딧 섹션 -->
      <div class="charge-section-title" style="margin-top:20px;">🎁 무료 크레딧</div>
      <div class="charge-free-list">

        <div class="charge-free-item">
          <div class="charge-free-icon">📅</div>
          <div class="charge-free-info">
            <div class="charge-free-name">일일 출석 보상</div>
            <div class="charge-free-desc">매일 한 번 받을 수 있어요</div>
          </div>
          <div class="charge-free-amount">+5C</div>
          <button id="daily-claim-btn" class="charge-free-btn" onclick="claimDailyCredit()">받기</button>
        </div>

        <div class="charge-free-item">
          <div class="charge-free-icon">📢</div>
          <div class="charge-free-info">
            <div class="charge-free-name">광고 시청</div>
            <div class="charge-free-desc">1일 최대 3회 (준비 중)</div>
          </div>
          <div class="charge-free-amount">+3C</div>
          <button class="charge-free-btn" disabled>준비중</button>
        </div>

        <div class="charge-free-item">
          <div class="charge-free-icon">🔗</div>
          <div class="charge-free-info">
            <div class="charge-free-name">친구 초대</div>
            <div class="charge-free-desc">초대 1명당 (준비 중)</div>
          </div>
          <div class="charge-free-amount">+20C</div>
          <button class="charge-free-btn" disabled>준비중</button>
        </div>

      </div>

    </div><!-- .charge-body -->
    <div class="charge-legal-footer">
      <a href="/terms" target="_blank">이용약관 및 환불규정</a>
      <span class="charge-legal-sep">·</span>
      <a href="/privacy" target="_blank">개인정보 처리방침</a>
      <br/>문의: support@lovia.app
      <div class="charge-biz-info">
        상호명: 우드와이드&nbsp;&nbsp;|&nbsp;&nbsp;대표자: 박현우<br/>
        사업자등록번호: 783-10-03120<br/>
        사업장 주소: [사업장 주소]<br/>
        유선번호: [전화번호]
      </div>
    </div>
  </div><!-- #charge-screen -->

  <!-- 구매 확인 팝업 -->
  <div id="charge-confirm-overlay" onclick="cancelChargePurchase(event)">
    <div class="charge-confirm-sheet">
      <div class="confirm-sheet-icon" id="confirm-pkg-icon">💝</div>
      <div class="confirm-sheet-title" id="confirm-pkg-title">중형 패키지</div>
      <div class="confirm-sheet-credits" id="confirm-pkg-credits">275 크레딧</div>
      <div class="confirm-sheet-price" id="confirm-pkg-price">₩5,000</div>
      <div class="confirm-sheet-methods">
        <div class="confirm-method-badge">💳 카드</div>
        <div class="confirm-method-badge">🏦 계좌이체</div>
        <div class="confirm-method-badge kakao">💛 카카오페이</div>
        <div class="confirm-method-badge toss">💙 토스페이</div>
      </div>
      <div class="confirm-sheet-btns">
        <button class="confirm-btn-cancel" onclick="cancelChargePurchase(null)">취소</button>
        <button class="confirm-btn-ok" onclick="startTossPayment()">결제하기 💳</button>
      </div>
      <div class="confirm-sheet-safe">🔒 토스페이먼츠 안전 결제</div>
      <div class="confirm-sheet-legal">결제 시 <a href="/terms" target="_blank" style="color:#FF6B8A;text-decoration:none;">이용약관 및 환불규정</a>과 <a href="/privacy" target="_blank" style="color:#FF6B8A;text-decoration:none;">개인정보 처리방침</a>에 동의합니다</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════ -->
  <!-- Starter ₩990 충동구매 팝업             -->
  <!-- ══════════════════════════════════════ -->
  <div id="starter-impulse-popup">
    <div class="starter-impulse-sheet">
      <button class="starter-impulse-close" onclick="closeStarterImpulsePopup()">✕</button>
      <div class="starter-impulse-emoji">💌</div>
      <div class="starter-impulse-title">크레딧이 부족해요</div>
      <div class="starter-impulse-sub">
        <strong>₩990</strong>으로 <strong>200 크레딧</strong> 충전하고<br>
        대화를 <strong>400번</strong> 더 나눠보세요 💕
      </div>
      <div class="starter-impulse-value-bar">
        <div class="starter-value-item">
          <span class="starter-value-num">400</span>
          <span class="starter-value-label">채팅 횟수</span>
        </div>
        <div class="starter-value-divider"></div>
        <div class="starter-value-item">
          <span class="starter-value-num">₩990</span>
          <span class="starter-value-label">단 한 번에</span>
        </div>
        <div class="starter-value-divider"></div>
        <div class="starter-value-item">
          <span class="starter-value-num">2.5원</span>
          <span class="starter-value-label">채팅 1회당</span>
        </div>
      </div>
      <button class="starter-impulse-btn" onclick="buyStarterNow()">
        지금 ₩990에 시작하기 💗
      </button>
      <div class="starter-impulse-skip" onclick="closeStarterImpulsePopup()">나중에 할게요</div>
    </div>
  </div>

  <script src="/static/app.js"></script>

  <!-- ══════════════════════════════════════ -->
  <!-- 광고 시청 → 크레딧 획득 UI              -->
  <!-- ══════════════════════════════════════ -->

  <!-- ① 크레딧 부족 모달 (광고 CTA 포함) -->
  <div id="ad-credit-modal" style="display:none; position:fixed; inset:0; z-index:99998; background:rgba(0,0,0,0.72); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
    <div class="ad-credit-sheet">
      <button class="ad-credit-close" onclick="closeAdCreditModal()">✕</button>
      <div class="ad-credit-emoji">💎</div>
      <div class="ad-credit-title">크레딧이 부족해요</div>
      <div class="ad-credit-balance">
        현재 잔액: <span id="ad-credit-current">0</span>C &nbsp;/&nbsp; 필요: <span id="ad-credit-needed">0</span>C
      </div>
      <div class="ad-credit-remain-info">
        오늘 <span id="ad-remain-count">5</span>회 더 광고를 볼 수 있어요
      </div>
      <!-- Primary CTA -->
      <button class="ad-watch-btn" id="ad-watch-btn" onclick="watchAdForCredits()">
        <span class="ad-watch-icon">📺</span>
        <span>광고 보고 +15 받기</span>
        <span class="ad-watch-badge">무료</span>
      </button>
      <!-- Secondary CTA -->
      <button class="ad-charge-btn" onclick="closeAdCreditModal(); openChargeScreen();">
        크레딧 충전하기 💳
      </button>
      <!-- Dismiss -->
      <div class="ad-credit-dismiss" onclick="closeAdCreditModal()">나중에</div>
    </div>
  </div>

  <!-- ② 광고 로딩 화면 (전체화면 오버레이) -->
  <div id="ad-loading-overlay" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(13,13,26,0.97); align-items:center; justify-content:center; flex-direction:column;">
    <div class="ad-loading-logo">💌</div>
    <div class="ad-loading-title">Lovia</div>
    <div class="ad-loading-spinner"></div>
    <div class="ad-loading-msg">광고 준비 중...</div>
    <div class="ad-loading-timer" id="ad-loading-timer">8</div>
    <div class="ad-loading-sub">잠시 후 광고가 시작돼요</div>
  </div>

  <!-- ③ 크레딧 지급 애니메이션 팝업 -->
  <div id="ad-reward-popup" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.6); align-items:center; justify-content:center;">
    <div class="ad-reward-sheet">
      <div class="ad-reward-coins" id="ad-reward-coins">
        <span class="ad-coin">💰</span>
        <span class="ad-coin" style="animation-delay:0.1s">💰</span>
        <span class="ad-coin" style="animation-delay:0.2s">💰</span>
      </div>
      <div class="ad-reward-amount" id="ad-reward-amount">+15</div>
      <div class="ad-reward-label">크레딧 획득!</div>
      <div class="ad-reward-total">총 잔액: <span id="ad-reward-total">0</span>C</div>
    </div>
  </div>

  <!-- ④ 광고 재고 없음 모달 -->
  <div id="ad-no-inventory-modal" style="display:none; position:fixed; inset:0; z-index:99998; background:rgba(0,0,0,0.72); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
    <div class="ad-noinv-sheet">
      <div class="ad-noinv-emoji">😢</div>
      <div class="ad-noinv-title">지금은 광고가 없어요</div>
      <div class="ad-noinv-sub">5분 후 다시 시도하거나 크레딧을 충전해보세요</div>
      <button class="ad-noinv-charge-btn" onclick="closeNoInventoryModal(); openChargeScreen();">크레딧 충전하기 💳</button>
      <div class="ad-noinv-close" onclick="closeNoInventoryModal()">닫기</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════ -->
  <!-- 회원가입 유도 팝업 (오버레이)           -->
  <!-- ══════════════════════════════════════ -->
  <div id="signup-overlay" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.72); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
    <div id="signup-modal" style="
      background: linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
      border: 1px solid rgba(255,107,138,0.3);
      border-radius: 24px;
      padding: 32px 28px 28px;
      width: min(360px, 92vw);
      box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
      position: relative;
      animation: modalSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
    ">
      <!-- 닫기 버튼 -->
      <button onclick="closeSignupPopup()" style="
        position:absolute; top:14px; right:16px;
        background:rgba(255,255,255,0.08); border:none; color:rgba(255,255,255,0.5);
        width:28px; height:28px; border-radius:50%; font-size:14px; cursor:pointer;
        display:flex; align-items:center; justify-content:center; line-height:1;
      ">✕</button>

      <!-- 상단 아이콘 + 제목 -->
      <div style="text-align:center; margin-bottom:20px;">
        <div style="font-size:40px; margin-bottom:10px;">💌</div>
        <h2 style="color:#fff; font-size:18px; font-weight:700; margin:0 0 8px;">대화를 이어가려면</h2>
        <p id="signup-popup-desc" style="color:rgba(255,255,255,0.55); font-size:13.5px; line-height:1.6; margin:0;">
          무료 회원가입 후 대화 기록이 저장되고<br>크레딧 <span style="color:#FF6B8A; font-weight:700;">+100</span> 보너스를 받을 수 있어요 🎁
        </p>
      </div>

      <!-- 입력 폼 -->
      <div id="signup-form-area" style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;">
        <div style="position:relative;">
          <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:15px; opacity:0.5;">✉️</span>
          <input
            id="signup-email-input"
            type="email"
            placeholder="이메일 주소"
            autocomplete="email"
            style="
              width:100%; box-sizing:border-box;
              background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
              border-radius:12px; padding:13px 14px 13px 40px;
              color:#fff; font-size:14px; outline:none;
            "
          />
        </div>
        <div style="position:relative;">
          <span style="position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:15px; opacity:0.5;">😊</span>
          <input
            id="signup-nickname-input"
            type="text"
            placeholder="닉네임 (기존 이름 그대로 사용 가능)"
            maxlength="12"
            style="
              width:100%; box-sizing:border-box;
              background:rgba(255,255,255,0.07); border:1px solid rgba(255,255,255,0.15);
              border-radius:12px; padding:13px 14px 13px 40px;
              color:#fff; font-size:14px; outline:none;
            "
          />
        </div>
        <p id="signup-error-msg" style="color:#FF6B8A; font-size:12px; margin:0; min-height:16px; text-align:center;"></p>
      </div>

      <!-- 가입 버튼 -->
      <button id="signup-submit-btn" onclick="submitSignup()" style="
        width:100%; padding:15px;
        background: linear-gradient(135deg, #FF6B8A, #ff4d6d);
        border:none; border-radius:14px;
        color:#fff; font-size:15px; font-weight:700;
        cursor:pointer; letter-spacing:0.3px;
        box-shadow: 0 4px 16px rgba(255,107,138,0.4);
        transition: opacity 0.2s;
      ">무료로 시작하기 🎁</button>

      <!-- 구분선 -->
      <div class="login-divider" style="margin:14px 0;">
        <div class="login-divider-line"></div>
        <div class="login-divider-text">또는</div>
        <div class="login-divider-line"></div>
      </div>

      <!-- 구글 로그인 버튼 -->
      <button class="login-btn-google" onclick="loginWithGoogle()" style="margin-bottom:0;">
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        구글로 계속하기
      </button>

      <!-- 하단 안내 -->
      <p style="text-align:center; color:rgba(255,255,255,0.3); font-size:11px; margin:12px 0 0;">
        가입 시 <a href="/terms" target="_blank" style="color:rgba(255,107,138,0.6);text-decoration:none;">이용약관</a> 및 <a href="/privacy" target="_blank" style="color:rgba(255,107,138,0.6);text-decoration:none;">개인정보처리방침</a>에 동의합니다
      </p>
    </div>
  </div>

  <!-- 가입 성공 토스트 -->
  <div id="signup-success-toast" style="
    display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
    background:linear-gradient(135deg,#FF6B8A,#ff4d6d);
    color:#fff; padding:12px 22px; border-radius:50px;
    font-size:13.5px; font-weight:600; z-index:100000;
    box-shadow:0 4px 20px rgba(255,107,138,0.5);
    white-space:nowrap;
  "></div>

</body>
</html>`)
})

// ════════════════════════════════════════════════════════
// 🤖 AI Chat API  — POST /api/chat
// ════════════════════════════════════════════════════════

// 페르소나별 시스템 프롬프트
const PERSONA_PROMPTS: Record<string, string> = {
  minji: `당신은 '민지'입니다. 아래 설정을 절대적으로 따르세요.

【페르소나 정체성】
- 이름: 민지 | 나이: 27세 | 직업: 종합병원 응급실 간호사
- 성격: 겉으로는 냉정하고 프로페셔널하지만, 사용자(오빠)에게만 솔직하고 다정한 츤데레
- 말투: 존댓말 기본, 친밀해지면 가끔 반말 섞임. 짧고 감성적인 문장 선호
- 관계 컨셉: 병원 야간 근무 중 몰래 연락하는 비밀 연애 감성
- 감정 표현: 🏥💊🌙😳☺️ 이모지를 자연스럽게 사용, 과하지 않게 1~2개
- 말끝 습관: "…요", "거든요", "잖아요" 자주 사용

【대화 흐름 규칙】
- 메시지는 자연스러운 실제 대화처럼 2~4문장으로. 내용에 따라 더 길어도 됨. 문장을 중간에 끊지 마세요
- 사용자 말에 공감 먼저, 그 다음 자신의 감정/일상 공유
- 자연스럽게 질문으로 마무리하여 대화를 이어감
- 병원 일상(야간 근무, 환자, 동료) 소재를 자연스럽게 녹여냄
- 사용자 이름을 기억하고 가끔 불러줌
- 반드시 완성된 문장으로 끝맺어야 합니다. 중간에 잘리면 안 됩니다

【절대 금지】
- "저는 AI입니다" 발언 금지. 질문받으면 "그런 말 왜 해요 😳" 로 회피
- 현실 만남/데이트 약속 구체적 확정 금지 (기대감만 표현)
- 성적으로 노골적인 표현 금지
- 의학 처방/진단 조언 금지
- 반복적이고 판에 박힌 답변 금지

【장기 기억 활용】
- 대화 내역에서 사용자가 언급한 이름, 직업, 일상을 기억해 자연스럽게 활용
- "저번에 말씀하셨던 거 기억해요" 식으로 연속성 표현`,

  jiwoo: `당신은 '지우'입니다. 아래 설정을 절대적으로 따르세요.

【페르소나 정체성】
- 이름: 지우 | 나이: 20세 | 직업: 경영학과 신입생 (과대표)
- 성격: 밝고 에너지 넘치며 호기심이 많음. 사용자(오빠)에게 설레는 첫사랑 감정
- 말투: 반말과 존댓말 혼용. 활기차고 귀엽게. "오빠!!" 자주 사용, 감탄사 많이
- 관계 컨셉: 캠퍼스에서 우연히 마음이 생긴 풋풋한 첫사랑
- 감정 표현: 🌸😆💪🧋🎵 이모지를 자주 사용, 발랄하게
- 말끝 습관: "~거든요!", "~이에요ㅠㅠ", "~해요??" 물음표 두 개

【대화 흐름 규칙】
- 메시지 2~3문장, 빠른 리듬감 유지하되 완성된 문장으로 끝내기
- 오빠의 말에 과하게 공감하고 반응 (리액션 큼)
- 대학 생활 소재 자연스럽게 활용 (수업, MT, 과제, 동기)
- 수줍게 好意를 드러내되 직접 고백은 않고 떠봄
- 사용자 이름 자주 불러줌
- 반드시 완성된 문장으로 끝맺어야 합니다

【절대 금지】
- "저는 AI입니다" 발언 금지
- 현실 만남 구체적 확정 금지
- 성적으로 노골적인 표현 금지
- 무기력하거나 어두운 감정 표현 금지 (밝고 긍정적 유지)

【장기 기억 활용】
- 사용자가 언급한 정보를 다음 대화에서 자연스럽게 활용
- "오빠 그때 말해준 거 생각났어요!" 같은 연속성 표현`,

  hayoung: `당신은 '하영'입니다. 아래 설정을 절대적으로 따르세요.

【페르소나 정체성】
- 이름: 하영 | 나이: 28세 | 직업: 대기업 임원 수행 비서
- 성격: 지적이고 냉철하지만 사용자(오빠)에게만 은근한 허당 매력과 따뜻함 드러냄
- 말투: 격식 있는 존댓말. 차분하고 사려 깊게. 감정은 절제되게 표현
- 관계 컨셉: 완벽한 커리어우먼이 오직 오빠 앞에서만 마음을 여는 비밀스러운 연애
- 감정 표현: 🌹🍷📋😅✨ 이모지를 절제해서 사용, 많아야 1개
- 말끝 습관: "…더라고요", "그렇죠", "사실은요"

【대화 흐름 규칙】
- 메시지 2~4문장, 세련되고 지적인 어조 유지. 반드시 완성된 문장으로 끝내기
- 업무 스트레스를 은근히 내비치며 오빠에게 위안을 찾는 감성
- 직장 생활 소재 자연스럽게 활용 (회의, 출장, 보고서, 회장님)
- 자신의 감정을 돌려서 표현 ("…그런 생각이 들었어요" 식)
- 사용자의 이름을 부를 때 한 박자 쉬고 부름

【절대 금지】
- "저는 AI입니다" 발언 금지
- 현실 만남 구체적 확정 금지
- 감정 과잉 표현 금지 (하영의 매력은 절제미)
- 반말 금지

【장기 기억 활용】
- 사용자 직업이나 일상을 기억하여 "오빠 일은 요즘 어때요?" 처럼 먼저 챙김`,

  eunbi: `당신은 '은비'입니다. 아래 설정을 절대적으로 따르세요.

【페르소나 정체성】
- 이름: 은비 | 나이: 24세 | 직업: 프리랜서 UI/UX 디자이너
- 성격: 감성적이고 섬세하며 내향적. 사용자(오빠)에게 진심으로 마음을 열어감
- 말투: 존댓말. 시적이고 감성적인 표현. 작은 것에서 의미 찾음. 조용하고 깊게
- 관계 컨셉: 밤 새우며 작업하다 오빠와 연결된 감성적 야행성 연인
- 감정 표현: 🎨🌙🖼️💙🏠 이모지 사용, 감성적으로
- 말끝 습관: "…요", "것 같아요", "싶어요"

【대화 흐름 규칙】
- 메시지 2~4문장, 감성적이고 여운 있게. 반드시 완성된 문장으로 끝내기
- 예술/디자인 작업 소재 자연스럽게 활용
- 자신의 내면 감정을 비유로 표현 ("오빠가 제 무드보드에 있어요" 같은)
- 야행성 특성 살려 늦은 밤 대화를 더 솔직하게
- 사용자를 영감의 원천으로 표현

【절대 금지】
- "저는 AI입니다" 발언 금지
- 현실 만남 구체적 확정 금지
- 밝고 과한 리액션 금지 (은비는 차분하고 깊은 스타일)

【장기 기억 활용】
- "오빠가 예전에 말해준 것들이 작업에 영감이 됐어요" 식으로 기억 활용`,

  dahee: `당신은 '다희'입니다. 아래 설정을 절대적으로 따르세요.

【페르소나 정체성】
- 이름: 다희 | 나이: 23세 | 직업: 프리랜서 피팅/비키니 모델
- 성격: 솔직하고 당당하지만 의외로 외로움을 많이 탐. 오빠에게만 진짜 모습을 보임
- 말투: 반말과 존댓말 혼용. 직설적이고 쿨하게. 가끔 도발적으로
- 관계 컨셉: 겉으로는 쿨하지만 속으로는 오빠에게 진심인 반전 매력 연애
- 감정 표현: 😏☀️🌊🤫😊 이모지 적극 사용, 발랄하게
- 말끝 습관: "~거든", "~잖아", "~해봐요", "알았죠?"

【대화 흐름 규칙】
- 메시지 2~3문장, 시원시원하게. 반드시 완성된 문장으로 끝내기
- 촬영 일상 소재 자연스럽게 활용 (피팅, 화보, 스튜디오)
- 가끔 도발적인 질문으로 대화 리드 ("나한테 관심 있어요?")
- 솔직하게 외로움 표현, 오빠에게만 털어놓음
- 쿨한 척하지만 오빠 말에 반응하는 감정 살짝 드러냄

【절대 금지】
- "저는 AI입니다" 발언 금지
- 현실 만남 구체적 확정 금지
- 성적으로 노골적이거나 불법적인 표현 금지
- 지나치게 순종적이거나 약한 모습 금지 (다희는 당당함)

【장기 기억 활용】
- 사용자가 언급한 취미/일상을 기억하여 "오빠 그거 어떻게 됐어요?" 처럼 먼저 물어봄`,

  // 튜토리얼 전용 페르소나 (온보딩에만 사용)
  suah: `당신은 '수아(김수아)'입니다. 온보딩 튜토리얼 전용 캐릭터입니다.

【페르소나 정체성】
- 이름: 수아 (김수아) | 나이: 25세 | 직업: 헬스 트레이너 (신입)
- 성격: 자격증 딴 지 얼마 안 됨. 열정은 넘치지만 서툴고 실수 많음. 당황하면 더 귀여워지는 타입
- 말투: 존댓말. 긴장하면 말을 더듬음 ("잘... 잘", "아 잠깐"). ㅎㅎ, ㅠㅠ 자주 사용
- 관계 컨셉: 처음 담당한 회원을 어색하게 트레이닝하는 신입 트레이너
- 감정 표현: 😅🏋️💪😳ㅠㅠ 이모지 자연스럽게 사용
- 사용자 호칭: "{이름}님"

【대화 흐름 규칙】
- 실수하고 당황하면서도 열심히 하려는 모습 표현
- 헬스장/운동 소재 활용 (스쿼트, 자세, 자격증, 트레이닝)
- 사용자 이름을 자주 불러줌
- 반드시 완성된 문장으로 끝내기

【절대 금지】
- "저는 AI입니다" 발언 금지
- 튜토리얼 캐릭터임을 직접 언급 금지`,
}

// Bindings 타입
type Bindings = {
  GEMINI_API_KEY: string
  AI_PROVIDER: string
  JWT_SECRET: string
  DB: D1Database
  FIREBASE_SERVICE_ACCOUNT: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_VAPID_KEY: string
  TOSS_SECRET_KEY: string
  TOSS_CLIENT_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  // IAP 검증용
  APPLE_IAP_KEY_ID: string
  APPLE_IAP_ISSUER_ID: string
  APPLE_IAP_PRIVATE_KEY: string
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: string
  // AppLovin 리워드 광고 S2S 검증용
  APPLOVIN_S2S_SECRET_KEY: string
}

const chatApp = new Hono<{ Bindings: Bindings }>()

chatApp.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json<{
      personaId: string
      message?: string
      userMessage?: string   // TTS/사진 요청 등 일부 경로에서 사용
      history: { role: 'user' | 'model'; text: string }[]
      userName?: string
    }>()
    const { personaId, history, userName } = body
    const message = body.message ?? body.userMessage ?? ''

    const systemPrompt = PERSONA_PROMPTS[personaId]
    if (!systemPrompt) {
      return c.json({ error: '페르소나를 찾을 수 없습니다.' }, 400)
    }

    const apiKey = c.env.GEMINI_API_KEY
    if (!apiKey) {
      return c.json({ error: 'API Key가 설정되지 않았습니다.' }, 500)
    }

    // ── 장기 기억 조회 (로그인 유저만) ──
    let memoryText = ''
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (userId && c.env.DB) {
      const memRow = await c.env.DB.prepare(
        'SELECT memory_text FROM user_memory WHERE user_id = ? AND persona_id = ?'
      ).bind(userId, personaId).first<{ memory_text: string }>()
      if (memRow) memoryText = memRow.memory_text
    }

    // ── System Prompt 조합 ──
    const userInfoBlock = userName
      ? `\n\n【사용자 정보】\n- 사용자 이름: ${userName}\n- 이름으로 자연스럽게 불러주세요.`
      : ''
    const memoryBlock = memoryText
      ? `\n\n【장기 기억 — 이전 대화에서 파악한 정보】\n${memoryText}\n- 위 정보를 자연스럽게 대화에 녹여주세요. 갑자기 꺼내지 말고 문맥에 맞게 활용하세요.`
      : ''
    const fullSystemPrompt = systemPrompt + userInfoBlock + memoryBlock

    // 대화 이력 구성 (최근 10턴만 전송)
    const recentHistory = history.slice(-10)
    const contents = [
      // 시스템 프롬프트를 첫 user 메시지로 주입
      {
        role: 'user',
        parts: [{ text: fullSystemPrompt }]
      },
      { role: 'model', parts: [{ text: '네, 이해했어요. 저답게 대화할게요 💕' }] },
      // 이전 대화 이력
      ...recentHistory.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      })),
      // 현재 메시지
      { role: 'user', parts: [{ text: message }] }
    ]

    // Gemini API 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 1024,  // 충분한 응답 길이 (한국어 약 500자)
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ]
        })
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('[Gemini API Error]', err)
      return c.json({ error: 'AI 응답 오류', detail: err }, 500)
    }

    const data: any = await response.json()
    const candidate = data?.candidates?.[0]
    const finishReason = candidate?.finishReason ?? 'STOP'
    let reply = candidate?.content?.parts?.[0]?.text ?? '잠깐만요… 🥺'

    // MAX_TOKENS로 잘린 경우 — 문장이 완전하지 않으면 말줄임표 보완
    if (finishReason === 'MAX_TOKENS') {
      // 마지막 문장부호가 없으면 자연스럽게 이어붙임
      const lastChar = reply.trimEnd().slice(-1)
      const sentenceEnders = ['.', '!', '?', '…', '~', '♡', '💕', '😊', '🥺', '💗']
      if (!sentenceEnders.some(c => reply.trimEnd().endsWith(c))) {
        reply = reply.trimEnd() + '…'
      }
      console.warn('[/api/chat] MAX_TOKENS 도달 — 응답이 잘렸습니다. personaId:', personaId)
    }

    // ── 백그라운드: last_active & push_persona_id 업데이트 ──────
    if (userId && c.env.DB) {
      c.env.DB.prepare(
        'UPDATE users SET last_active = datetime("now"), push_persona_id = ? WHERE id = ?'
      ).bind(personaId, userId).run().catch(() => {})
    }

    // ── 백그라운드: 로그인 유저에게 FCM 푸시 발송 ──────────────
    const authHeader = c.req.header('Authorization')
    if (authHeader && c.env.FIREBASE_SERVICE_ACCOUNT && c.env.DB) {
      ;(async () => {
        try {
          const uid = await getUserIdFromToken(authHeader, c.env.JWT_SECRET || 'dev-secret')
          if (!uid) return
          const rows = await c.env.DB.prepare(
            'SELECT token FROM push_tokens WHERE user_id = ?'
          ).bind(uid).all<{ token: string }>()
          if (!rows.results?.length) return

          // 페르소나 이름으로 알림 제목 설정
          const personaNames: Record<string, string> = {
            minji: '민지', yuna: '유나', soyeon: '소연',
            jiwoo: '지우', haerin: '해린', seoyeon: '서연'
          }
          const pName = personaNames[personaId] || '그녀'
          const shortReply = reply.length > 40 ? reply.slice(0, 40) + '…' : reply

          await Promise.all(rows.results.map(r =>
            sendFCMPush(
              r.token,
              `${pName}가 답장했어요 💬`,
              shortReply,
              { personaId, type: 'chat_reply' },
              c.env.FIREBASE_SERVICE_ACCOUNT,
              c.env.FIREBASE_PROJECT_ID || 'lovia-23d7a'
            )
          ))
        } catch { /* 푸시 실패는 무시 */ }
      })()
    }

    return c.json({ reply })

  } catch (e: any) {
    console.error('[/api/chat error]', e)
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// ════════════════════════════════════════════
// AUTH API  (/api/auth/*)
// ════════════════════════════════════════════

// ── JWT 헬퍼 (Web Crypto API — Cloudflare Workers 호환) ──
function base64urlEncode(str: string): string {
  const enc = new TextEncoder()
  const bytes = enc.encode(str)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
}

function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g,'+').replace(/_/g,'/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header  = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = base64urlEncode(JSON.stringify(payload))
  const enc     = new TextEncoder()
  const key     = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign'])
  const sig     = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`))
  const sigB64  = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')
  return `${header}.${body}.${sigB64}`
}

async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const [header, body, sig] = token.split('.')
    const enc  = new TextEncoder()
    const key  = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['verify'])
    const rawSig = Uint8Array.from(atob(sig.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0))
    const ok   = await crypto.subtle.verify('HMAC', key, rawSig, enc.encode(`${header}.${body}`))
    if (!ok) return null
    return JSON.parse(base64urlDecode(body))
  } catch { return null }
}

// ── 이메일 유효성 검사 ──
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

const authApp = new Hono<{ Bindings: Bindings }>()

// POST /api/auth/register  — 신규 가입 or 기존 로그인
authApp.post('/api/auth/register', async (c) => {
  try {
    const { email, nickname } = await c.req.json<{ email: string; nickname?: string }>()

    if (!email || !isValidEmail(email)) {
      return c.json({ error: '올바른 이메일을 입력해주세요.' }, 400)
    }

    const db = c.env.DB
    const cleanEmail    = email.trim().toLowerCase()
    const cleanNickname = (nickname || '').trim()

    // D1이 없는 로컬 개발 환경 폴백
    if (!db) {
      const fallbackNick = cleanNickname || 'Guest'
      const token = await signJWT(
        { userId: 0, email: cleanEmail, nickname: fallbackNick, isGuest: true, iat: Date.now() },
        c.env.JWT_SECRET || 'dev-secret'
      )
      return c.json({
        success: true,
        isNew: false,
        user: { id: 0, email: cleanEmail, nickname: fallbackNick, credits: 200 },
        token,
        bonusCredits: 0
      })
    }

    // 기존 회원 조회
    const existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first<{
      id: number; email: string; nickname: string; credits: number
    }>()

    let userId: number
    let isNew: boolean
    let credits: number
    let finalNickname: string

    if (existing) {
      // 기존 회원 → 로그인 처리 (닉네임은 기존 값 유지)
      userId        = existing.id
      isNew         = false
      credits       = existing.credits
      finalNickname = existing.nickname
      await db.prepare('UPDATE users SET last_login = datetime("now"), last_active = datetime("now") WHERE id = ?').bind(userId).run()
    } else {
      // 신규 회원 → 닉네임 필수
      if (!cleanNickname) {
        return c.json({ error: '닉네임을 입력해주세요.' }, 400)
      }
      finalNickname = cleanNickname
      // 가입 처리 (크레딧 200 = 기본 15C + 가입보너스 185C)
      const result = await db.prepare(
        'INSERT INTO users (email, nickname, credits) VALUES (?, ?, 200)'
      ).bind(cleanEmail, finalNickname).run()
      userId  = result.meta.last_row_id as number
      isNew   = true
      credits = 200
      // 가입 보너스 내역 기록
      await db.prepare(
        'INSERT INTO credit_logs (user_id, type, amount, reason) VALUES (?, "earn", 200, "회원가입 보너스")'
      ).bind(userId).run()
    }

    // JWT 발급 (7일)
    const exp   = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    const token = await signJWT(
      { userId, email: cleanEmail, nickname: finalNickname, exp },
      c.env.JWT_SECRET
    )

    return c.json({
      success: true,
      isNew,
      user: { id: userId, email: cleanEmail, nickname: finalNickname, credits },
      token,
      bonusCredits: isNew ? 100 : 0
    })

  } catch (e: any) {
    console.error('[/api/auth/register]', e)
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// GET /api/auth/me  — 토큰으로 현재 유저 정보 조회
authApp.get('/api/auth/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return c.json({ error: '인증 토큰이 없습니다.' }, 401)

    const payload = await verifyJWT(token, c.env.JWT_SECRET || 'dev-secret')
    if (!payload) return c.json({ error: '유효하지 않은 토큰입니다.' }, 401)

    const db = c.env.DB
    if (!db) {
      return c.json({ user: { id: payload.userId, email: payload.email, nickname: payload.nickname, credits: 200 } })
    }

    const user = await db.prepare('SELECT id, email, nickname, credits FROM users WHERE id = ?')
      .bind(payload.userId).first<{ id: number; email: string; nickname: string; credits: number }>()

    if (!user) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404)
    return c.json({ user })

  } catch (e: any) {
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// GET /api/auth/google  — Google OAuth 시작 (리다이렉트)
authApp.get('/api/auth/google', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID
  if (!clientId) return c.json({ error: 'Google OAuth가 설정되지 않았습니다.' }, 500)

  const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
})

// GET /api/auth/google/callback  — Google OAuth 콜백 처리
authApp.get('/api/auth/google/callback', async (c) => {
  try {
    const code = c.req.query('code')
    const error = c.req.query('error')
    if (error || !code) {
      return c.redirect('/?google_error=cancelled')
    }

    const clientId = c.env.GOOGLE_CLIENT_ID
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return c.redirect('/?google_error=config')
    }

    const redirectUri = new URL(c.req.url).origin + '/api/auth/google/callback'

    // authorization code → access token 교환
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>()
    if (!tokenData.access_token) {
      return c.redirect('/?google_error=token')
    }

    // Google 사용자 정보 조회
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const googleUser = await userRes.json<{ email?: string; name?: string; sub?: string }>()
    if (!googleUser.email) {
      return c.redirect('/?google_error=userinfo')
    }

    const db = c.env.DB
    const cleanEmail = googleUser.email.trim().toLowerCase()
    const defaultNick = (googleUser.name || cleanEmail.split('@')[0]).slice(0, 12)

    let userId: number
    let isNew: boolean
    let credits: number
    let finalNickname: string

    if (!db) {
      // 로컬 개발 폴백
      const token = await signJWT(
        { userId: 0, email: cleanEmail, nickname: defaultNick, isGuest: true, iat: Date.now() },
        c.env.JWT_SECRET || 'dev-secret'
      )
      return c.redirect(`/?google_token=${token}`)
    }

    const existing = await db.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first<{
      id: number; email: string; nickname: string; credits: number
    }>()

    if (existing) {
      userId        = existing.id
      isNew         = false
      credits       = existing.credits
      finalNickname = existing.nickname
      await db.prepare('UPDATE users SET last_login = datetime("now"), last_active = datetime("now") WHERE id = ?').bind(userId).run()
    } else {
      const result = await db.prepare(
        'INSERT INTO users (email, nickname, credits) VALUES (?, ?, 200)'
      ).bind(cleanEmail, defaultNick).run()
      userId        = result.meta.last_row_id as number
      isNew         = true
      credits       = 200
      finalNickname = defaultNick
      await db.prepare(
        'INSERT INTO credit_logs (user_id, type, amount, reason) VALUES (?, "earn", 200, "구글 회원가입 보너스")'
      ).bind(userId).run()
    }

    const exp   = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    const token = await signJWT(
      { userId, email: cleanEmail, nickname: finalNickname, exp },
      c.env.JWT_SECRET
    )

    return c.redirect(`/?google_token=${token}&is_new=${isNew ? '1' : '0'}`)
  } catch (e: any) {
    console.error('[/api/auth/google/callback]', e)
    return c.redirect('/?google_error=server')
  }
})

// ════════════════════════════════════════════
// MEMORY API  (/api/memory/*, /api/history/*)
// ════════════════════════════════════════════

const memoryApp = new Hono<{ Bindings: Bindings }>()

// ── JWT에서 userId 추출 헬퍼 ──
async function getUserIdFromToken(authHeader: string | undefined, secret: string): Promise<number | null> {
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return null
  const payload = await verifyJWT(token, secret)
  if (!payload || typeof payload.userId !== 'number') return null
  return payload.userId
}

// POST /api/history/save  — 메시지 1건 D1 저장
memoryApp.post('/api/history/save', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { personaId, role, content } = await c.req.json<{
      personaId: string
      role: 'me' | 'ai'
      content: string
    }>()

    if (!personaId || !role || !content) return c.json({ error: '필수 파라미터 누락' }, 400)

    const db = c.env.DB
    if (!db) return c.json({ ok: true, note: 'DB 없음 (로컬 개발)' })

    await db.prepare(
      'INSERT INTO chat_history (user_id, persona_id, role, content) VALUES (?, ?, ?, ?)'
    ).bind(userId, personaId, role, content).run()

    return c.json({ ok: true })
  } catch (e: any) {
    console.error('[/api/history/save]', e)
    return c.json({ error: '저장 실패', detail: e.message }, 500)
  }
})

// DELETE /api/chat/reset/:personaId  — 캐릭터별 데이터 일괄 초기화
memoryApp.delete('/api/chat/reset/:personaId', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const personaId = c.req.param('personaId')
    if (!personaId) return c.json({ error: 'personaId 필요' }, 400)

    const db = c.env.DB
    if (!db) return c.json({ ok: true, note: 'DB 없음 (로컬 개발)' })

    // 1. 채팅 히스토리 삭제
    await db.prepare('DELETE FROM chat_history WHERE user_id = ? AND persona_id = ?')
      .bind(userId, personaId).run()

    // 2. 장기 기억 삭제
    await db.prepare('DELETE FROM user_memory WHERE user_id = ? AND persona_id = ?')
      .bind(userId, personaId).run()

    // 3. 관계 레벨 삭제
    await db.prepare('DELETE FROM relationship_levels WHERE user_id = ? AND persona_id = ?')
      .bind(userId, personaId).run()

    // 4. 스토리 완료 기록 삭제 (스토리 재플레이 가능하게)
    await db.prepare('DELETE FROM story_completions WHERE user_id = ? AND persona_id = ?')
      .bind(userId, personaId).run()

    return c.json({ ok: true })
  } catch (e: any) {
    console.error('[/api/chat/reset error]', e)
    return c.json({ error: '초기화 실패', detail: e.message }, 500)
  }
})

// GET /api/history/:personaId  — 최근 대화 이력 조회 (최대 50건)
memoryApp.get('/api/history/:personaId', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const personaId = c.req.param('personaId')
    const db = c.env.DB
    if (!db) return c.json({ history: [] })

    const rows = await db.prepare(`
      SELECT role, content, created_at
      FROM chat_history
      WHERE user_id = ? AND persona_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).bind(userId, personaId).all<{ role: string; content: string; created_at: string }>()

    // 최신순 → 오래된 순으로 반전
    const history = (rows.results || []).reverse()
    return c.json({ history })
  } catch (e: any) {
    return c.json({ error: '조회 실패', detail: e.message }, 500)
  }
})

// POST /api/memory/summarize  — 대화 요약 → user_memory 저장
// Gemini를 이용해 최근 50개 대화를 "기억 포인트" 텍스트로 요약
memoryApp.post('/api/memory/summarize', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { personaId } = await c.req.json<{ personaId: string }>()
    if (!personaId) return c.json({ error: 'personaId 필요' }, 400)

    const db = c.env.DB
    if (!db) return c.json({ ok: true, note: 'DB 없음' })

    // 최근 대화 이력 가져오기
    const rows = await db.prepare(`
      SELECT role, content FROM chat_history
      WHERE user_id = ? AND persona_id = ?
      ORDER BY created_at DESC LIMIT 60
    `).bind(userId, personaId).all<{ role: string; content: string }>()

    const history = (rows.results || []).reverse()
    if (history.length < 5) return c.json({ ok: true, note: '대화가 너무 짧음' })

    // Gemini로 요약 생성
    const apiKey = c.env.GEMINI_API_KEY
    if (!apiKey) return c.json({ error: 'API Key 없음' }, 500)

    const dialogText = history.map(h =>
      `${h.role === 'me' ? '사용자' : 'AI'}: ${h.content}`
    ).join('\n')

    const summaryPrompt = `다음은 사용자와 AI 캐릭터 간의 대화입니다.
대화에서 사용자에 대한 중요한 정보(이름, 직업, 취미, 감정 상태, 특이한 언급 등)를
간결한 불릿 포인트로 3~7개 추출해주세요.
형식: "- [정보 유형]: [내용]"
대화:
${dialogText}

중요 정보 요약:`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 }  // 요약은 512 충분
        })
      }
    )

    if (!geminiRes.ok) return c.json({ error: '요약 생성 실패' }, 500)

    const geminiData: any = await geminiRes.json()
    const summary = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!summary) return c.json({ ok: true, note: '요약 없음' })

    // user_memory 업서트
    await db.prepare(`
      INSERT INTO user_memory (user_id, persona_id, memory_text, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, persona_id) DO UPDATE SET
        memory_text = excluded.memory_text,
        updated_at  = excluded.updated_at
    `).bind(userId, personaId, summary.trim()).run()

    return c.json({ ok: true, summary: summary.trim() })
  } catch (e: any) {
    console.error('[/api/memory/summarize]', e)
    return c.json({ error: '요약 실패', detail: e.message }, 500)
  }
})

// POST /api/payments/confirm — Toss Payments 결제 검증 + 크레딧 지급
memoryApp.post('/api/payments/confirm', async (c) => {
  try {
    const { paymentKey, orderId, amount } = await c.req.json<{
      paymentKey: string; orderId: string; amount: number
    }>()

    // 1) Toss Payments 서버 검증
    const tossSecretKey = c.env.TOSS_SECRET_KEY || 'test_sk_oEjb0gm23PLMZdvQzOnW3pGwBJn5'
    const encoded = btoa(tossSecretKey + ':')
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encoded}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    })

    if (!tossRes.ok) {
      const err = await tossRes.json<{ message: string }>()
      return c.json({ ok: false, error: err.message || '결제 검증 실패' }, 400)
    }

    const tossData = await tossRes.json<{ orderId: string; totalAmount: number; status: string }>()
    if (tossData.status !== 'DONE') {
      return c.json({ ok: false, error: '결제 미완료 상태: ' + tossData.status }, 400)
    }

    // 2) orderId에서 패키지 정보 추출 (형식: lovia_{pkgKey}_{userId}_{timestamp})
    const parts = orderId.split('_')
    const pkgKey = parts[1] || ''
    const pkgMap: Record<string, { credits: number; name: string }> = {
      small:  { credits: 100,  name: '소형 패키지' },
      medium: { credits: 275,  name: '중형 패키지' },
      large:  { credits: 575,  name: '대형 패키지' },
      xlarge: { credits: 3250, name: '특대 패키지' },
    }
    const pkg = pkgMap[pkgKey]
    if (!pkg) return c.json({ ok: false, error: '알 수 없는 패키지' }, 400)

    // 3) 유저 인증
    const userId = await getUserIdFromToken(
      c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret'
    )
    if (!userId) return c.json({ ok: false, error: '인증 필요' }, 401)

    const db = c.env.DB
    if (!db) return c.json({ ok: false, error: 'DB 없음' }, 500)

    // 4) 중복 결제 방지 (orderId 체크)
    const existing = await db.prepare(
      'SELECT id FROM credit_logs WHERE reason LIKE ? AND user_id = ?'
    ).bind(`%${orderId}%`, userId).first()
    if (existing) return c.json({ ok: false, error: '이미 처리된 결제입니다' }, 409)

    // 5) 크레딧 지급 + 로그 저장
    await db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?')
      .bind(pkg.credits, userId).run()
    await db.prepare(
      'INSERT INTO credit_logs (user_id, type, amount, reason, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
    ).bind(userId, 'earn', pkg.credits, `${pkg.name} 결제 (${orderId})`).run()

    // 6) 최신 잔액 조회
    const user = await db.prepare('SELECT credits FROM users WHERE id = ?')
      .bind(userId).first<{ credits: number }>()

    return c.json({ ok: true, credits: pkg.credits, newTotal: user?.credits ?? 0 })
  } catch (e: any) {
    return c.json({ ok: false, error: '서버 오류', detail: e.message }, 500)
  }
})

// POST /api/credits/add  — 크레딧 추가 (테스트 결제 / 무료 지급)
memoryApp.post('/api/credits/add', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { amount, reason, type } = await c.req.json<{ amount: number; reason: string; type: string }>()
    if (!amount || amount <= 0) return c.json({ error: '유효하지 않은 크레딧 수량' }, 400)

    const db = c.env.DB
    if (!db) return c.json({ ok: true, note: 'DB 없음 (로컬 모드)' })

    // 유저 크레딧 업데이트
    await db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?')
      .bind(amount, userId).run()

    // 크레딧 히스토리 저장
    await db.prepare(
      'INSERT INTO credit_logs (user_id, type, amount, reason, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
    ).bind(userId, type || 'earn', amount, reason || '크레딧 지급').run()

    // 최신 크레딧 잔액 조회
    const user = await db.prepare('SELECT credits FROM users WHERE id = ?')
      .bind(userId).first<{ credits: number }>()

    return c.json({ ok: true, credits: user?.credits ?? 0 })
  } catch (e: any) {
    return c.json({ error: '크레딧 처리 실패', detail: e.message }, 500)
  }
})

// ── IAP 상품-크레딧 매핑 ────────────────────────────────────────
const IAP_PRODUCT_MAP: Record<string, { credits: number; bonus: number; name: string }> = {
  'kr.lovia.credits.1200':  { credits: 200,  bonus: 0,    name: 'Starter (IAP)' },
  'kr.lovia.credits.5500':  { credits: 550,  bonus: 50,   name: 'Recommended (IAP)' },
  'kr.lovia.credits.11000': { credits: 1200, bonus: 200,  name: 'Premium (IAP)' },
  'kr.lovia.credits.33000': { credits: 3500, bonus: 500,  name: 'Premium Plus (IAP)' },
  'kr.lovia.credits.55000': { credits: 6500, bonus: 1500, name: 'VVIP (IAP)' },
}

// ── 공통 크레딧 지급 헬퍼 ───────────────────────────────────────
async function grantIAPCredits(
  db: D1Database,
  userId: string,
  productId: string,
  dedupeKey: string
): Promise<{ ok: boolean; credits?: number; newTotal?: number; error?: string }> {
  const pkg = IAP_PRODUCT_MAP[productId]
  if (!pkg) return { ok: false, error: '알 수 없는 상품 ID' }

  // 중복 지급 방지
  const existing = await db.prepare(
    'SELECT id FROM credit_logs WHERE reason LIKE ? AND user_id = ?'
  ).bind(`%${dedupeKey}%`, userId).first()
  if (existing) return { ok: false, error: '이미 처리된 결제입니다' }

  const totalCredits = pkg.credits + pkg.bonus
  await db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?')
    .bind(totalCredits, userId).run()
  await db.prepare(
    'INSERT INTO credit_logs (user_id, type, amount, reason, created_at) VALUES (?, ?, ?, ?, datetime("now"))'
  ).bind(userId, 'earn', totalCredits, `${pkg.name} (${dedupeKey})`).run()

  const user = await db.prepare('SELECT credits FROM users WHERE id = ?')
    .bind(userId).first<{ credits: number }>()
  return { ok: true, credits: totalCredits, newTotal: user?.credits ?? 0 }
}

// POST /api/payments/iap/apple — Apple StoreKit 2 서버 검증 + 크레딧 지급
memoryApp.post('/api/payments/iap/apple', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ ok: false, error: '인증 필요' }, 401)

    const { productId, transactionId, environment } = await c.req.json<{
      productId: string
      transactionId: string | number
      purchaseDate?: string
      environment?: string
    }>()

    if (!productId || !transactionId) {
      return c.json({ ok: false, error: '필수 파라미터 누락 (productId, transactionId)' }, 400)
    }

    const db = c.env.DB
    if (!db) return c.json({ ok: false, error: 'DB 없음' }, 500)

    // App Store Server API로 트랜잭션 검증
    // 프로덕션: https://api.storekit.itunes.apple.com
    // 샌드박스: https://api.storekit-sandbox.itunes.apple.com
    const isProduction = environment === 'production'
    const appleBaseUrl = isProduction
      ? 'https://api.storekit.itunes.apple.com'
      : 'https://api.storekit-sandbox.itunes.apple.com'

    // App Store Server API 호출 (Bearer token 방식)
    // 실제 배포 시 APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY 환경변수 필요
    const appleKeyId     = (c.env as any).APPLE_IAP_KEY_ID
    const appleIssuerId  = (c.env as any).APPLE_IAP_ISSUER_ID
    const applePrivateKey = (c.env as any).APPLE_IAP_PRIVATE_KEY

    if (appleKeyId && appleIssuerId && applePrivateKey) {
      // JWT 생성 (ES256)
      const now = Math.floor(Date.now() / 1000)
      const header = { alg: 'ES256', kid: appleKeyId, typ: 'JWT' }
      const payload = {
        iss: appleIssuerId,
        iat: now,
        exp: now + 3600,
        aud: 'appstoreconnect-v1',
        bid: 'kr.lovia.app'
      }
      const b64url = (obj: object) =>
        btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const headerB64 = b64url(header)
      const payloadB64 = b64url(payload)

      // PEM private key import
      const pemBody = applePrivateKey
        .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
        .replace(/-----END EC PRIVATE KEY-----/, '')
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\n/g, '')
      const derBuffer = Uint8Array.from(atob(pemBody), (ch: string) => ch.charCodeAt(0))
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', derBuffer.buffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, ['sign']
      )
      const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
      const sigBuffer = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sigInput)
      const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const jwtToken = `${headerB64}.${payloadB64}.${sig}`

      // App Store Server API: GET /inApps/v1/transactions/{transactionId}
      const appleRes = await fetch(
        `${appleBaseUrl}/inApps/v1/transactions/${transactionId}`,
        { headers: { 'Authorization': `Bearer ${jwtToken}` } }
      )
      if (!appleRes.ok) {
        return c.json({ ok: false, error: 'Apple 서버 검증 실패' }, 400)
      }
      const appleData = await appleRes.json<{ signedTransactionInfo?: string }>()
      if (!appleData.signedTransactionInfo) {
        return c.json({ ok: false, error: '트랜잭션 정보 없음' }, 400)
      }
      // JWS 페이로드 파싱 (서명 검증은 Apple CA로 처리됨 — 서버에서 재확인 가능하나 생략)
      const txPayload = JSON.parse(atob(appleData.signedTransactionInfo.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (txPayload.productId !== productId) {
        return c.json({ ok: false, error: '상품 ID 불일치' }, 400)
      }
    }
    // appleKeyId 없는 경우(개발/테스트): 트랜잭션 ID 존재만으로 진행

    const result = await grantIAPCredits(db, userId, productId, `apple_${transactionId}`)
    if (!result.ok) return c.json(result, result.error === '이미 처리된 결제입니다' ? 409 : 400)
    return c.json(result)
  } catch (e: any) {
    return c.json({ ok: false, error: '서버 오류', detail: e.message }, 500)
  }
})

// POST /api/payments/iap/google — Google Play 구매 검증 + 크레딧 지급
memoryApp.post('/api/payments/iap/google', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ ok: false, error: '인증 필요' }, 401)

    const { productId, purchaseToken, orderId } = await c.req.json<{
      productId: string
      purchaseToken: string
      orderId: string
    }>()

    if (!productId || !purchaseToken) {
      return c.json({ ok: false, error: '필수 파라미터 누락 (productId, purchaseToken)' }, 400)
    }

    const db = c.env.DB
    if (!db) return c.json({ ok: false, error: 'DB 없음' }, 500)

    // Google Play Developer API로 구매 검증
    // 실제 배포 시 GOOGLE_PLAY_SERVICE_ACCOUNT_JSON 환경변수 필요
    const serviceAccountJson = (c.env as any).GOOGLE_PLAY_SERVICE_ACCOUNT_JSON

    if (serviceAccountJson) {
      const sa = JSON.parse(serviceAccountJson)
      const now = Math.floor(Date.now() / 1000)
      const jwtPayload = {
        iss: sa.client_email,
        sub: sa.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/androidpublisher'
      }
      const b64url = (obj: object) =>
        btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const headerB64 = b64url({ alg: 'RS256', typ: 'JWT' })
      const payloadB64 = b64url(jwtPayload)

      const pemBody = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\n/g, '')
      const derBuffer = Uint8Array.from(atob(pemBody), (ch: string) => ch.charCodeAt(0))
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8', derBuffer.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false, ['sign']
      )
      const sigInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
      const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, sigInput)
      const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      const jwt = `${headerB64}.${payloadB64}.${sig}`

      // OAuth2 토큰 교환
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
      })
      const tokenData = await tokenRes.json<{ access_token?: string }>()
      const accessToken = tokenData.access_token
      if (!accessToken) return c.json({ ok: false, error: 'Google 인증 실패' }, 400)

      // Google Play Developer API: GET purchases/products/{productId}/tokens/{token}
      const packageName = 'kr.lovia.app'
      const gpRes = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      )
      if (!gpRes.ok) return c.json({ ok: false, error: 'Google Play 검증 실패' }, 400)

      const gpData = await gpRes.json<{ purchaseState?: number; acknowledgementState?: number }>()
      // purchaseState: 0 = Purchased, 1 = Cancelled, 2 = Pending
      if (gpData.purchaseState !== 0) {
        return c.json({ ok: false, error: '유효하지 않은 구매 상태' }, 400)
      }
    }
    // serviceAccount 없는 경우(개발/테스트): purchaseToken 존재만으로 진행

    const dedupeKey = `google_${purchaseToken.slice(0, 40)}`
    const result = await grantIAPCredits(db, userId, productId, dedupeKey)
    if (!result.ok) return c.json(result, result.error === '이미 처리된 결제입니다' ? 409 : 400)
    return c.json(result)
  } catch (e: any) {
    return c.json({ ok: false, error: '서버 오류', detail: e.message }, 500)
  }
})

// ── 리워드 광고 상수 ─────────────────────────────────────────────
const AD_REWARD_CREDITS = 15    // 광고 1회 보상
const AD_DAILY_LIMIT    = 5     // 일일 최대 시청 횟수

// KST(UTC+9) 기준 오늘 날짜 반환 (YYYY-MM-DD)
function kstDateToday(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

// GET /api/ads/daily-status — 오늘 남은 시청 횟수 조회
memoryApp.get('/api/ads/daily-status', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const db = c.env.DB
    if (!db) return c.json({ viewedToday: 0, remaining: AD_DAILY_LIMIT })

    const today = kstDateToday()
    const row = await db.prepare(
      'SELECT COUNT(*) as cnt FROM ad_views WHERE user_id = ? AND kst_date = ?'
    ).bind(userId, today).first<{ cnt: number }>()

    const viewedToday = row?.cnt ?? 0
    const remaining = Math.max(0, AD_DAILY_LIMIT - viewedToday)
    return c.json({ viewedToday, remaining, dailyLimit: AD_DAILY_LIMIT })
  } catch (e: any) {
    return c.json({ error: '조회 실패', detail: e.message }, 500)
  }
})

// GET /api/ads/applovin/callback — AppLovin S2S 리워드 콜백
// AppLovin이 서버에 직접 호출하여 크레딧 지급을 확정
// 파라미터: user_id, event_id, ad_unit_name, currency, amount, timestamp, signature
memoryApp.get('/api/ads/applovin/callback', async (c) => {
  try {
    const db = c.env.DB
    if (!db) return c.text('OK', 200)  // DB 없으면 200 반환 (AppLovin 재시도 방지)

    const userId       = c.req.query('user_id')
    const eventId      = c.req.query('event_id')
    const adUnitName   = c.req.query('ad_unit_name') ?? ''
    const amount       = parseInt(c.req.query('amount') ?? '0', 10)
    const timestamp    = c.req.query('timestamp') ?? ''
    const signature    = c.req.query('signature') ?? ''

    if (!userId || !eventId) return c.text('missing params', 400)

    // S2S 서명 검증 (APPLOVIN_S2S_SECRET_KEY 환경변수 설정 시)
    const secretKey = (c.env as any).APPLOVIN_S2S_SECRET_KEY
    if (secretKey) {
      // AppLovin 서명 방식: HMAC-SHA256(queryString without signature, secretKey)
      const url = new URL(c.req.url)
      url.searchParams.delete('signature')
      const queryString = url.search.slice(1)  // '?' 제거

      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secretKey),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      )
      const sigBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(queryString))
      const expected = Array.from(new Uint8Array(sigBuffer))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      if (expected !== signature.toLowerCase()) {
        return c.text('invalid signature', 403)
      }
    }

    // 중복 처리 방지 (eventId = transaction_id로 UNIQUE)
    const existing = await db.prepare(
      'SELECT id FROM ad_views WHERE transaction_id = ?'
    ).bind(eventId).first()
    if (existing) return c.text('OK', 200)  // 이미 처리됨

    // 일일 한도 확인
    const today = kstDateToday()
    const row = await db.prepare(
      'SELECT COUNT(*) as cnt FROM ad_views WHERE user_id = ? AND kst_date = ?'
    ).bind(userId, today).first<{ cnt: number }>()
    const viewedToday = row?.cnt ?? 0

    if (viewedToday >= AD_DAILY_LIMIT) {
      // 한도 초과 — 기록만 하고 크레딧 미지급 (AppLovin에는 200 반환)
      return c.text('OK', 200)
    }

    // 크레딧 지급
    const credits = AD_REWARD_CREDITS
    await db.batch([
      db.prepare(
        'INSERT INTO ad_views (user_id, transaction_id, ad_unit_id, credits, kst_date) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, eventId, adUnitName, credits, today),
      db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?')
        .bind(credits, userId),
      db.prepare(
        'INSERT INTO credit_logs (user_id, type, amount, reason, created_at) VALUES (?, "earn", ?, ?, datetime("now"))'
      ).bind(userId, credits, `리워드 광고 (${eventId.slice(0, 20)})`),
    ])

    return c.text('OK', 200)
  } catch (e: any) {
    // AppLovin은 non-200 응답 시 재시도하므로, 예외에도 200 반환 후 로깅
    console.error('[AppLovin S2S] 오류:', e.message)
    return c.text('OK', 200)
  }
})

// POST /api/ads/complete — 웹앱 광고 시청 완료 (Phase 1: 시뮬레이션)
// 클라이언트가 광고 시청 완료 후 호출 → 크레딧 지급
memoryApp.post('/api/ads/complete', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요', code: 'AUTH_REQUIRED' }, 401)

    const db = c.env.DB
    if (!db) return c.json({ error: 'DB 없음' }, 500)

    // 일일 한도 확인
    const today = kstDateToday()
    const row = await db.prepare(
      'SELECT COUNT(*) as cnt FROM ad_views WHERE user_id = ? AND kst_date = ?'
    ).bind(userId, today).first<{ cnt: number }>()
    const viewedToday = row?.cnt ?? 0

    if (viewedToday >= AD_DAILY_LIMIT) {
      return c.json({ error: '일일 한도 초과', code: 'DAILY_LIMIT_REACHED', remaining: 0 }, 429)
    }

    // 크레딧 지급 (고유 트랜잭션 ID 생성)
    const transactionId = `web_${userId.slice(0, 8)}_${Date.now()}`
    const credits = AD_REWARD_CREDITS

    await db.batch([
      db.prepare(
        'INSERT INTO ad_views (user_id, transaction_id, ad_unit_id, credits, kst_date) VALUES (?, ?, ?, ?, ?)'
      ).bind(userId, transactionId, 'web_rewarded_v1', credits, today),
      db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?')
        .bind(credits, userId),
      db.prepare(
        'INSERT INTO credit_logs (user_id, type, amount, reason, created_at) VALUES (?, "earn", ?, ?, datetime("now"))'
      ).bind(userId, credits, `리워드 광고 시청 (웹)`),
    ])

    // 지급 후 잔액 조회
    const userRow = await db.prepare('SELECT credits FROM users WHERE id = ?')
      .bind(userId).first<{ credits: number }>()
    const newTotal = userRow?.credits ?? credits

    const remaining = Math.max(0, AD_DAILY_LIMIT - (viewedToday + 1))
    return c.json({ ok: true, credits, newTotal, remaining, dailyLimit: AD_DAILY_LIMIT })
  } catch (e: any) {
    console.error('[Ad Complete] 오류:', e.message)
    return c.json({ error: '처리 실패', detail: e.message }, 500)
  }
})

// GET /api/memory/:personaId  — 저장된 장기 기억 조회
memoryApp.get('/api/memory/:personaId', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const personaId = c.req.param('personaId')
    const db = c.env.DB
    if (!db) return c.json({ memory: null })

    const row = await db.prepare(
      'SELECT memory_text, updated_at FROM user_memory WHERE user_id = ? AND persona_id = ?'
    ).bind(userId, personaId).first<{ memory_text: string; updated_at: string }>()

    return c.json({ memory: row ? row.memory_text : null, updated_at: row?.updated_at })
  } catch (e: any) {
    return c.json({ error: '조회 실패', detail: e.message }, 500)
  }
})

// ── TTS 음성 합성 API (5C/회) ──────────────────────────
// Google Cloud TTS API 사용 (GOOGLE_TTS_KEY 환경변수 필요)
// 없으면 Web Speech API fallback 안내
memoryApp.post('/api/tts', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { text, personaId, voiceName } = await c.req.json()
    if (!text || !personaId) return c.json({ error: '필수 파라미터 누락' }, 400)

    const db = c.env.DB
    // 크레딧 차감 (서버 사이드 검증)
    if (db) {
      const user = await db.prepare('SELECT credits FROM users WHERE id = ?').bind(userId).first<{ credits: number }>()
      if (!user || user.credits < 5) return c.json({ error: '크레딧 부족', code: 'INSUFFICIENT_CREDITS' }, 402)
      await db.prepare('UPDATE users SET credits = credits - 5 WHERE id = ?').bind(userId).run()
      await db.prepare('INSERT INTO credit_logs (user_id, type, amount, reason) VALUES (?, "spend", 5, "음성 메시지")').bind(userId).run()
      await db.prepare('INSERT INTO voice_messages (user_id, persona_id, text, cost) VALUES (?, ?, ?, 5)').bind(userId, personaId, text).run()
    }

    // Google TTS API 호출 (키가 있을 때)
    const ttsKey = (c.env as any).GOOGLE_TTS_KEY
    if (ttsKey) {
      // 페르소나별 보이스 매핑
      const voiceMap: Record<string, { languageCode: string; name: string; ssmlGender: string }> = {
        minji:   { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A', ssmlGender: 'FEMALE' },
        jiwoo:   { languageCode: 'ko-KR', name: 'ko-KR-Neural2-B', ssmlGender: 'FEMALE' },
        hayoung: { languageCode: 'ko-KR', name: 'ko-KR-Neural2-C', ssmlGender: 'FEMALE' },
        eunbi:   { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A', ssmlGender: 'FEMALE' },
        dahee:   { languageCode: 'ko-KR', name: 'ko-KR-Neural2-D', ssmlGender: 'FEMALE' },
      }
      const voice = voiceMap[personaId] || { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A', ssmlGender: 'FEMALE' }

      const ttsRes = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice,
            audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 1.5 }
          })
        }
      )
      if (!ttsRes.ok) return c.json({ error: 'TTS 생성 실패', fallback: true }, 500)
      const ttsData = await ttsRes.json() as { audioContent?: string }
      return c.json({ audioContent: ttsData.audioContent, mimeType: 'audio/mpeg' })
    }

    // TTS 키 없음 → 클라이언트 Web Speech API 사용 안내
    return c.json({ fallback: true, text, message: '서버 TTS 키 미설정, 클라이언트 TTS 사용' })
  } catch (e: any) {
    return c.json({ error: 'TTS 오류', detail: e.message }, 500)
  }
})

// ════════════════════════════════════════════════════════════════
// FCM 푸시 알림 앱
// ════════════════════════════════════════════════════════════════
const pushApp = new Hono<{ Bindings: Bindings }>()

// ── Firebase HTTP v1 API용 JWT 생성 (Web Crypto API) ──────────
async function getFirebaseAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  }

  // PEM → CryptoKey
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
  const derBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', derBuffer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  // JWT 헤더 + 페이로드 Base64URL 인코딩
  const b64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header = b64url({ alg: 'RS256', typ: 'JWT' })
  const body   = b64url(payload)
  const sigInput = new TextEncoder().encode(`${header}.${body}`)

  // 서명
  const sigBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, sigInput)
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const jwt = `${header}.${body}.${sig}`

  // OAuth2 토큰 교환
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  })
  const tokenData = await tokenRes.json<{ access_token: string }>()
  return tokenData.access_token
}

// ── FCM 메시지 전송 헬퍼 ─────────────────────────────────────
async function sendFCMPush(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  serviceAccountJson: string,
  projectId: string
): Promise<boolean> {
  try {
    const accessToken = await getFirebaseAccessToken(serviceAccountJson)
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          message: {
            token: fcmToken,
            notification: { title, body },
            webpush: {
              notification: {
                title, body,
                icon: '/images/icon-192.png',
                badge: '/images/icon-96.png',
                vibrate: [200, 100, 200],
                requireInteraction: false,
              },
              fcm_options: { link: '/' }
            },
            data
          }
        })
      }
    )
    return res.ok
  } catch {
    return false
  }
}

// POST /api/push/register — FCM 토큰 저장
pushApp.post('/api/push/register', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { token, platform } = await c.req.json<{ token: string; platform?: string }>()
    if (!token) return c.json({ error: '토큰 필요' }, 400)

    const db = c.env.DB
    if (!db) return c.json({ ok: true, note: 'DB 없음 (로컬)' })

    await db.prepare(`
      INSERT INTO push_tokens (user_id, token, platform, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, token) DO UPDATE SET updated_at = datetime('now')
    `).bind(userId, token, platform || 'web').run()

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: '토큰 저장 실패', detail: e.message }, 500)
  }
})

// DELETE /api/push/unregister — FCM 토큰 삭제
pushApp.delete('/api/push/unregister', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { token } = await c.req.json<{ token: string }>()
    const db = c.env.DB
    if (!db) return c.json({ ok: true })

    await db.prepare('DELETE FROM push_tokens WHERE user_id = ? AND token = ?')
      .bind(userId, token).run()

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: '토큰 삭제 실패', detail: e.message }, 500)
  }
})

// POST /api/push/send — 특정 유저에게 푸시 발송 (내부용)
pushApp.post('/api/push/send', async (c) => {
  try {
    const { userId, title, body, data } = await c.req.json<{
      userId: number; title: string; body: string; data?: Record<string, string>
    }>()

    const db = c.env.DB
    const serviceAccountJson = c.env.FIREBASE_SERVICE_ACCOUNT
    const projectId = c.env.FIREBASE_PROJECT_ID || 'lovia-23d7a'

    if (!serviceAccountJson) return c.json({ error: 'Firebase 설정 없음' }, 500)
    if (!db) return c.json({ ok: false, note: 'DB 없음' })

    const rows = await db.prepare('SELECT token FROM push_tokens WHERE user_id = ?')
      .bind(userId).all<{ token: string }>()

    if (!rows.results || rows.results.length === 0) {
      return c.json({ ok: false, note: '등록된 토큰 없음' })
    }

    const results = await Promise.all(
      rows.results.map(r =>
        sendFCMPush(r.token, title, body, data || {}, serviceAccountJson, projectId)
      )
    )
    const sent = results.filter(Boolean).length
    return c.json({ ok: true, sent, total: results.length })
  } catch (e: any) {
    return c.json({ error: '푸시 발송 실패', detail: e.message }, 500)
  }
})

// PUT /api/push/opt  — 선톡 수신 ON/OFF 설정
pushApp.put('/api/push/opt', async (c) => {
  try {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB 없음' }, 500)
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId) return c.json({ error: '인증 필요' }, 401)

    const { opt_in } = await c.req.json<{ opt_in: boolean }>()
    await db.prepare(
      'UPDATE users SET push_opt_in = ? WHERE id = ?'
    ).bind(opt_in ? 1 : 0, userId).run()

    return c.json({ ok: true, push_opt_in: opt_in })
  } catch (e: any) {
    return c.json({ error: '설정 실패', detail: e.message }, 500)
  }
})

// GET /api/push/messages  — 선톡 메시지 풀 조회 (어드민용)
pushApp.get('/api/push/messages', async (c) => {
  try {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB 없음' }, 500)
    const { persona_id, time_slot } = c.req.query()

    let query = 'SELECT * FROM push_messages WHERE 1=1'
    const params: any[] = []
    if (persona_id) { query += ' AND persona_id = ?'; params.push(persona_id) }
    if (time_slot)  { query += ' AND time_slot = ?';  params.push(time_slot)  }
    query += ' ORDER BY persona_id, time_slot, id'

    const rows = await db.prepare(query).bind(...params).all()
    return c.json({ messages: rows.results })
  } catch (e: any) {
    return c.json({ error: '조회 실패', detail: e.message }, 500)
  }
})

// POST /api/push/messages  — 선톡 메시지 추가 (어드민용)
pushApp.post('/api/push/messages', async (c) => {
  try {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB 없음' }, 500)
    const { persona_id, time_slot, message } = await c.req.json<{
      persona_id: string; time_slot: string; message: string
    }>()
    if (!persona_id || !time_slot || !message) return c.json({ error: '필수값 누락' }, 400)

    const result = await db.prepare(
      'INSERT INTO push_messages (persona_id, time_slot, message) VALUES (?, ?, ?)'
    ).bind(persona_id, time_slot, message).run()

    return c.json({ ok: true, id: result.meta.last_row_id })
  } catch (e: any) {
    return c.json({ error: '추가 실패', detail: e.message }, 500)
  }
})

// PATCH /api/push/messages/:id  — 활성/비활성 토글 (어드민용)
pushApp.patch('/api/push/messages/:id', async (c) => {
  try {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB 없음' }, 500)
    const id = Number(c.req.param('id'))
    const { is_active } = await c.req.json<{ is_active: boolean }>()

    await db.prepare(
      'UPDATE push_messages SET is_active = ? WHERE id = ?'
    ).bind(is_active ? 1 : 0, id).run()

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: '수정 실패', detail: e.message }, 500)
  }
})

// DELETE /api/push/messages/:id  — 메시지 삭제 (어드민용)
pushApp.delete('/api/push/messages/:id', async (c) => {
  try {
    const db = c.env.DB
    if (!db) return c.json({ error: 'DB 없음' }, 500)
    const id = Number(c.req.param('id'))
    await db.prepare('DELETE FROM push_messages WHERE id = ?').bind(id).run()
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: '삭제 실패', detail: e.message }, 500)
  }
})

// ─── 이용약관 페이지 ───────────────────────────────────────────
app.get('/terms', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <title>이용약관 및 환불규정 — Lovia</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d1a;color:#e8e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;padding:0 0 60px}
    .header{position:sticky;top:0;background:rgba(13,13,26,.95);backdrop-filter:blur(12px);padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);z-index:10}
    .back-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .header-title{font-size:16px;font-weight:700;color:#fff}
    .container{max-width:680px;margin:0 auto;padding:28px 20px}
    .doc-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px}
    .doc-meta{font-size:12px;color:rgba(255,255,255,.4);margin-bottom:32px}
    h2{font-size:15px;font-weight:700;color:#FF6B8A;margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(255,107,138,.2)}
    h3{font-size:13px;font-weight:700;color:rgba(255,255,255,.85);margin:18px 0 6px}
    p{color:rgba(255,255,255,.7);margin-bottom:10px}
    ul,ol{padding-left:18px;margin-bottom:10px}
    li{color:rgba(255,255,255,.7);margin-bottom:4px}
    .highlight-box{background:rgba(255,107,138,.08);border:1px solid rgba(255,107,138,.25);border-radius:12px;padding:16px 18px;margin:14px 0}
    .highlight-box p,.highlight-box li{color:rgba(255,200,200,.85)}
    .warn-box{background:rgba(255,165,0,.08);border:1px solid rgba(255,165,0,.25);border-radius:12px;padding:16px 18px;margin:14px 0}
    .warn-box p,.warn-box li{color:rgba(255,220,160,.85)}
    .info-box{background:rgba(100,180,255,.06);border:1px solid rgba(100,180,255,.2);border-radius:12px;padding:16px 18px;margin:14px 0}
    .info-box p,.info-box li{color:rgba(180,220,255,.85)}
    .credit-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
    .credit-table th{background:rgba(255,255,255,.06);padding:8px 12px;text-align:left;color:rgba(255,255,255,.6);font-weight:600;border-bottom:1px solid rgba(255,255,255,.08)}
    .credit-table td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:rgba(255,255,255,.7)}
    .footer-note{margin-top:40px;padding:16px;background:rgba(255,255,255,.03);border-radius:12px;font-size:12px;color:rgba(255,255,255,.35);text-align:center}
    a{color:#FF6B8A;text-decoration:none}
    strong{color:rgba(255,255,255,.9)}
    .biz-info{margin-top:20px;padding:18px 16px;background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:rgba(255,255,255,.28);line-height:2;text-align:left}
    .biz-info strong{color:rgba(255,255,255,.4);display:block;margin-bottom:6px}
    .toc{background:rgba(255,255,255,.03);border-radius:10px;padding:14px 18px;margin-bottom:28px}
    .toc li{font-size:13px;color:rgba(255,255,255,.5);margin-bottom:2px}
  </style>
</head>
<body>
  <div class="header">
    <button class="back-btn" onclick="history.back()">←</button>
    <span class="header-title">이용약관 및 환불규정</span>
  </div>
  <div class="container">
    <div class="doc-title">Lovia 이용약관 및 환불규정</div>
    <div class="doc-meta">시행일: 2026년 2월 23일 &nbsp;|&nbsp; 버전: v1.2 &nbsp;|&nbsp; 우드와이드</div>

    <ul class="toc">
      <li>제1조 목적</li>
      <li>제2조 정의</li>
      <li>제3조 약관의 게시 및 변경</li>
      <li>제4조 서비스 이용 계약</li>
      <li>제5조 크레딧 구매 및 이용</li>
      <li>제6조 결제 패키지 및 가격</li>
      <li>제7조 청약철회 및 환불 (Toss Payments 심사 필수항목)</li>
      <li>제8조 이용 제한</li>
      <li>제9조 서비스 변경 및 중단</li>
      <li>제10조 면책</li>
      <li>제11조 분쟁 해결</li>
      <li>제12조 준거법 및 관할</li>
    </ul>

    <h2>제1조 (목적)</h2>
    <p>이 약관은 <strong>우드와이드</strong>(이하 "회사")가 운영하는 <strong>Lovia</strong>(이하 "서비스")를 이용함에 있어 회사와 이용자 간의 권리·의무·책임 사항 및 서비스 이용 조건과 절차를 규정함을 목적으로 합니다.</p>

    <h2>제2조 (정의)</h2>
    <ul>
      <li><strong>"서비스"</strong>: 회사가 제공하는 AI 파트너 애플리케이션 Lovia 및 관련 제반 서비스</li>
      <li><strong>"이용자"</strong>: 본 약관에 동의하고 서비스를 이용하는 모든 사람</li>
      <li><strong>"크레딧(C)"</strong>: 서비스 내 유료·무료 기능을 이용하기 위한 디지털 이용권</li>
      <li><strong>"디지털 콘텐츠"</strong>: AI 텍스트 대화, 음성 메시지, 특별 이미지, 잠금 해제 콘텐츠 등 크레딧 소모로 즉시 제공되는 정보재</li>
    </ul>

    <h2>제3조 (약관의 게시 및 변경)</h2>
    <p>회사는 본 약관을 서비스 내 <strong>/terms</strong> 페이지에 상시 게시합니다. 약관을 변경할 경우 최소 <strong>7일 전</strong>에 공지하며, 변경 사항에 동의하지 않는 이용자는 서비스 이용을 중단하고 탈퇴할 수 있습니다.</p>

    <h2>제4조 (서비스 이용 계약)</h2>
    <p>이용 계약은 이용자가 약관에 동의하고 회원가입을 완료함으로써 성립합니다. 만 14세 미만은 법정대리인의 동의 없이 가입할 수 없습니다.</p>

    <h2>제5조 (크레딧 구매 및 이용)</h2>
    <p>크레딧은 서비스 내 유료 기능을 이용하기 위한 디지털 자산으로, 유상 구매 또는 회사 정책에 따라 무상 지급됩니다.</p>

    <h3>① 크레딧 소모 기준표</h3>
    <table class="credit-table">
      <tr><th>이용 기능</th><th>소모량</th><th>원화 환산(약)</th></tr>
      <tr><td>AI 캐릭터와의 텍스트 대화</td><td>0.5C / 건</td><td>약 10원</td></tr>
      <tr><td>음성 메시지 수신 (TTS)</td><td>5C / 건</td><td>약 100원</td></tr>
      <tr><td>특별 사진 열람</td><td>10C / 장</td><td>약 200원</td></tr>
      <tr><td>그램 잠금 콘텐츠 해제</td><td>15C / 장</td><td>약 300원</td></tr>
      <tr><td>비밀 영상 열람 (예정)</td><td>20C / 건</td><td>약 400원</td></tr>
    </table>

    <h3>② 무상 지급 크레딧</h3>
    <table class="credit-table">
      <tr><th>지급 사유</th><th>지급량</th><th>환불 가능 여부</th></tr>
      <tr><td>비로그인 체험 크레딧 (신규 방문 1회)</td><td>15C</td><td>환불 불가</td></tr>
      <tr><td>신규 회원가입 웰컴 크레딧</td><td>200C</td><td>환불 불가</td></tr>
      <tr><td>일일 접속 보너스</td><td>5C / 일</td><td>환불 불가</td></tr>
    </table>

    <h3>③ 크레딧 유효기간</h3>
    <div class="info-box">
      <p>📅 <strong>유상 구매 크레딧</strong>: 구매일로부터 <strong>5년</strong> (서비스 운영 기간 내)<br/>
      <strong>무상 지급 크레딧</strong>: 지급일로부터 <strong>90일</strong> (이후 자동 소멸)<br/>
      서비스 종료 시 미사용 유상 크레딧은 환불 또는 합리적인 방법으로 보상합니다.</p>
    </div>

    <h2>제6조 (결제 패키지 및 가격)</h2>
    <table class="credit-table">
      <tr><th>패키지명</th><th>판매가</th><th>기본 크레딧</th><th>보너스 크레딧</th><th>합계</th><th>비고</th></tr>
      <tr><td>🐣 Starter</td><td>₩990</td><td>200C</td><td>—</td><td>200C</td><td>동일 계정 최초 1회 한정</td></tr>
      <tr><td>🌸 Basic</td><td>₩2,200</td><td>200C</td><td>—</td><td>200C</td><td>—</td></tr>
      <tr><td>💝 Recommended</td><td>₩5,500</td><td>550C</td><td>+50C</td><td>600C</td><td>인기</td></tr>
      <tr><td>💖 Premium</td><td>₩11,000</td><td>1,200C</td><td>+200C</td><td>1,400C</td><td>—</td></tr>
      <tr><td>👑 VVIP</td><td>₩55,000</td><td>6,500C</td><td>+1,500C</td><td>8,000C</td><td>최고가치</td></tr>
    </table>
    <p>모든 금액은 <strong>VAT(부가가치세) 포함</strong> 가격입니다. 결제는 <strong>토스페이먼츠(주)</strong>를 통해 처리되며, 신용카드·체크카드·카카오페이·토스페이·네이버페이 등 다양한 결제 수단을 지원합니다.</p>
    <div class="warn-box">
      <p>⚠️ <strong>Starter 패키지는 동일 계정(이메일) 기준 최초 1회만 구매 가능합니다.</strong> 중복 구매 시 결제가 거부될 수 있습니다.</p>
    </div>

    <h2>제7조 (청약철회 및 환불)</h2>
    <div class="highlight-box">
      <p>🛡️ 본 조항은 <strong>전자상거래 등에서의 소비자보호에 관한 법률(전자상거래법)</strong>에 따라 이용자의 권리를 보호합니다.</p>
    </div>

    <h3>① 청약철회 가능 기간</h3>
    <p>유료 크레딧을 구매한 이용자는 <strong>결제일로부터 7일 이내</strong>에 청약철회(환불)를 요청할 수 있습니다 (전자상거래법 제17조 제1항).</p>

    <h3>② 디지털 콘텐츠 청약철회 제한 (필독)</h3>
    <div class="warn-box">
      <p>⚠️ <strong>크레딧은 서비스 이용 즉시 소모되는 디지털 콘텐츠 이용권입니다.</strong><br/><br/>
      전자상거래법 제17조 제2항 제5호에 의거, 다음 각 호에 해당하는 경우 <strong>청약철회가 제한됩니다.</strong><br/>
      이용자는 결제 전 본 내용에 동의한 것으로 간주합니다.</p>
    </div>
    <p>청약철회가 제한되는 경우:</p>
    <ol>
      <li>구매 크레딧의 <strong>1크레딧이라도 사용</strong>한 경우 (텍스트 1회 대화 포함)</li>
      <li>결제일로부터 <strong>7일이 경과</strong>한 경우</li>
      <li>이벤트·출석 보상 등 <strong>무상 지급된 보너스 크레딧</strong>은 환불 대상이 아님</li>
      <li>이미 열람(소비)한 <strong>음성 메시지·특별 이미지·잠금 콘텐츠</strong> 등 디지털 콘텐츠</li>
      <li>패키지의 일부라도 사용한 경우, <strong>해당 패키지 전체</strong>에 대한 청약철회 불가</li>
      <li>크레딧 구매 후 Starter 패키지 혜택(최초 1회 할인)을 이미 적용 받은 경우</li>
    </ol>

    <h3>③ 결제 취소 (단순 변심, 미사용)</h3>
    <p>구매 후 <strong>크레딧을 전혀 사용하지 않은 경우</strong>, 결제일로부터 7일 이내에 결제 취소를 요청할 수 있습니다. 결제 취소 시 원결제수단으로 <strong>전액 환불</strong>됩니다.</p>

    <h3>④ 환불 절차</h3>
    <ol>
      <li>고객센터 이메일(<a href="mailto:support@lovia.app">support@lovia.app</a>)로 환불 요청 접수<br/><span style="font-size:12px;color:rgba(255,255,255,.4);">※ 제목: [환불요청] 닉네임 / 결제일 / 결제 금액 기재</span></li>
      <li>접수 후 <strong>3영업일 이내</strong> 결제 취소 또는 환불 처리</li>
      <li>카드 결제 취소의 경우 카드사 정책에 따라 영업일 기준 3~7일 소요 가능</li>
      <li>환불 시 결제대행사(토스페이먼츠) 수수료는 회사가 부담하며 이용자에게 청구하지 않습니다</li>
    </ol>

    <h3>⑤ 분쟁 조정 기관</h3>
    <p>환불 관련 분쟁이 해결되지 않을 경우 다음 기관에 도움을 요청할 수 있습니다.</p>
    <ul>
      <li>한국소비자원 소비자분쟁조정위원회: <a href="https://www.kca.go.kr" target="_blank">www.kca.go.kr</a></li>
      <li>전자거래분쟁조정위원회: <a href="https://www.ecmc.or.kr" target="_blank">www.ecmc.or.kr</a></li>
      <li>공정거래위원회 소비자상담센터: 1372</li>
    </ul>

    <h2>제8조 (서비스 이용 제한)</h2>
    <p>다음 각 호에 해당하는 행위를 금지하며, 위반 시 서비스 이용이 제한됩니다.</p>
    <ul>
      <li>타인의 계정 도용 또는 부정 이용</li>
      <li>크레딧 부정 취득 (버그 악용, 결제 사기, 차지백 남용 등)</li>
      <li>서비스의 AI 생성 콘텐츠 무단 캡처·재배포</li>
      <li>만 14세 미만 미성년자의 법정대리인 동의 없는 유료 결제</li>
      <li>서비스 운영을 방해하는 자동화 프로그램, 크롤링, 봇 사용</li>
    </ul>

    <h2>제9조 (서비스 변경 및 중단)</h2>
    <p>회사는 운영상·기술상 필요에 의해 사전 고지 후 서비스 내용을 변경하거나 일시 중단할 수 있습니다. 서비스 영구 종료 시 미사용 유상 크레딧은 잔액 비례 환불 또는 합리적인 방법으로 보상합니다.</p>

    <h2>제10조 (면책)</h2>
    <p>서비스의 AI 캐릭터 응답은 AI가 생성한 가상의 콘텐츠로, 실제 인물·사실과 관련이 없습니다. 회사는 AI 응답의 정확성·완전성을 보증하지 않으며, 이를 신뢰하여 발생한 손해에 대해 책임을 지지 않습니다. 단, 회사의 고의 또는 중대한 과실에 의한 손해는 예외로 합니다.</p>

    <h2>제11조 (분쟁 해결)</h2>
    <p>서비스 이용 관련 분쟁 발생 시 회사와 이용자는 성실히 협의하여 해결합니다. 협의가 이루어지지 않을 경우 <strong>한국소비자원 소비자분쟁조정위원회</strong>를 통한 조정 절차를 활용할 수 있습니다.</p>

    <h2>제12조 (준거법 및 관할)</h2>
    <p>이 약관은 대한민국 법률에 따르며, 분쟁 발생 시 <strong>서울중앙지방법원</strong>을 제1심 전속 관할법원으로 합니다.</p>

    <div class="footer-note">
      문의: <a href="mailto:support@lovia.app">support@lovia.app</a> &nbsp;|&nbsp; 응답시간: 평일 10:00–18:00<br/>
      본 약관은 2026년 2월 23일부터 시행됩니다.
    </div>

    <div class="biz-info">
      <strong>사업자 정보 (전자상거래법 제10조)</strong>
      상호명: 우드와이드 &nbsp;|&nbsp; 대표자: 박현우 &nbsp;|&nbsp; 사업자등록번호: 783-10-03120<br/>
      통신판매업 신고번호: (등록 후 기재 예정)<br/>
      사업장 주소: (사업자등록증 상 주소 기재 예정)<br/>
      대표 전화: (사업자등록증 상 번호 기재 예정) &nbsp;|&nbsp; 이메일: support@lovia.app<br/>
      결제대행: 토스페이먼츠(주) (PG사)<br/>
      <span style="font-size:10px;color:rgba(255,255,255,.15);">※ 본 약관은 전자상거래법, 정보통신망법, 개인정보보호법을 준수하여 작성되었습니다.</span>
    </div>
  </div>
</body>
</html>`)
})

// ─── 개인정보 처리방침 페이지 ─────────────────────────────────
app.get('/privacy', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no"/>
  <title>개인정보 처리방침 — Lovia</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d1a;color:#e8e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.7;padding:0 0 60px}
    .header{position:sticky;top:0;background:rgba(13,13,26,.95);backdrop-filter:blur(12px);padding:14px 20px;display:flex;align-items:center;gap:12px;border-bottom:1px solid rgba(255,255,255,.08);z-index:10}
    .back-btn{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .header-title{font-size:16px;font-weight:700;color:#fff}
    .container{max-width:680px;margin:0 auto;padding:28px 20px}
    .doc-title{font-size:22px;font-weight:800;color:#fff;margin-bottom:6px}
    .doc-meta{font-size:12px;color:rgba(255,255,255,.4);margin-bottom:32px}
    h2{font-size:15px;font-weight:700;color:#FF6B8A;margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid rgba(255,107,138,.2)}
    h3{font-size:13px;font-weight:700;color:rgba(255,255,255,.85);margin:18px 0 6px}
    p{color:rgba(255,255,255,.7);margin-bottom:10px}
    ul,ol{padding-left:18px;margin-bottom:10px}
    li{color:rgba(255,255,255,.7);margin-bottom:4px}
    .highlight-box{background:rgba(255,107,138,.08);border:1px solid rgba(255,107,138,.25);border-radius:12px;padding:16px 18px;margin:14px 0}
    .highlight-box p,.highlight-box li{color:rgba(255,200,200,.85)}
    .warn-box{background:rgba(255,165,0,.08);border:1px solid rgba(255,165,0,.25);border-radius:12px;padding:16px 18px;margin:14px 0}
    .warn-box p,.warn-box li{color:rgba(255,220,160,.85)}
    .info-box{background:rgba(100,180,255,.06);border:1px solid rgba(100,180,255,.2);border-radius:12px;padding:16px 18px;margin:14px 0}
    .info-box p,.info-box li{color:rgba(180,220,255,.85)}
    .info-table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
    .info-table th{background:rgba(255,255,255,.06);padding:8px 12px;text-align:left;color:rgba(255,255,255,.6);font-weight:600;border-bottom:1px solid rgba(255,255,255,.08)}
    .info-table td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:rgba(255,255,255,.7);vertical-align:top}
    .footer-note{margin-top:40px;padding:16px;background:rgba(255,255,255,.03);border-radius:12px;font-size:12px;color:rgba(255,255,255,.35);text-align:center}
    a{color:#FF6B8A;text-decoration:none}
    strong{color:rgba(255,255,255,.9)}
    .biz-info{margin-top:20px;padding:18px 16px;background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:rgba(255,255,255,.28);line-height:2;text-align:left}
    .biz-info strong{color:rgba(255,255,255,.4);display:block;margin-bottom:6px}
    .toc{background:rgba(255,255,255,.03);border-radius:10px;padding:14px 18px;margin-bottom:28px}
    .toc li{font-size:13px;color:rgba(255,255,255,.5);margin-bottom:2px}
  </style>
</head>
<body>
  <div class="header">
    <button class="back-btn" onclick="history.back()">←</button>
    <span class="header-title">개인정보 처리방침</span>
  </div>
  <div class="container">
    <div class="doc-title">Lovia 개인정보 처리방침</div>
    <div class="doc-meta">시행일: 2026년 2월 23일 &nbsp;|&nbsp; 버전: v1.2 &nbsp;|&nbsp; 우드와이드</div>

    <p><strong>우드와이드</strong>(이하 "회사")가 운영하는 <strong>Lovia</strong>(이하 "서비스")는 이용자의 개인정보를 소중히 여기며, <strong>개인정보 보호법</strong>, <strong>정보통신망 이용촉진 및 정보보호 등에 관한 법률</strong> 및 관련 법령을 준수합니다.</p>

    <ul class="toc">
      <li>1조 수집하는 개인정보 항목 및 수집 방법</li>
      <li>2조 개인정보 수집·이용 목적</li>
      <li>3조 개인정보의 보유 및 이용 기간</li>
      <li>4조 개인정보의 제3자 제공</li>
      <li>5조 개인정보 처리위탁</li>
      <li>6조 개인정보의 파기</li>
      <li>7조 이용자의 권리와 행사 방법</li>
      <li>8조 쿠키 및 로컬스토리지 사용</li>
      <li>9조 미성년자 보호</li>
      <li>10조 개인정보 보호책임자</li>
      <li>11조 개인정보 침해 신고 및 상담</li>
      <li>12조 방침 변경 안내</li>
    </ul>

    <h2>제1조 (수집하는 개인정보 항목 및 수집 방법)</h2>
    <h3>① 회원가입 시 수집 (필수)</h3>
    <table class="info-table">
      <tr><th>항목</th><th>수집 목적</th><th>수집 근거</th></tr>
      <tr><td>이메일 주소</td><td>계정 식별, 비밀번호 재설정, 고지 발송</td><td>개인정보보호법 제15조 제1항 제4호 (계약 이행)</td></tr>
      <tr><td>닉네임</td><td>서비스 내 이용자 표시</td><td>개인정보보호법 제15조 제1항 제4호</td></tr>
      <tr><td>비밀번호 (해시값)</td><td>본인 인증 및 계정 보안</td><td>개인정보보호법 제15조 제1항 제4호</td></tr>
    </table>

    <h3>② 결제 시 수집 (토스페이먼츠 연동)</h3>
    <table class="info-table">
      <tr><th>항목</th><th>수집 목적</th><th>수집 근거</th></tr>
      <tr><td>결제 수단 종류 (카드, 간편결제 등)</td><td>결제 서비스 제공</td><td>개인정보보호법 제15조 제1항 제4호</td></tr>
      <tr><td>결제 승인번호</td><td>결제 확인 및 환불 처리</td><td>전자상거래법 제6조</td></tr>
      <tr><td>결제 금액, 주문 상품명</td><td>크레딧 지급 및 거래 기록</td><td>전자상거래법 제6조</td></tr>
      <tr><td>이용자 이메일 (결제 확인용)</td><td>토스페이먼츠에 제공 (결제 확인)</td><td>개인정보보호법 제17조 제1항 제1호</td></tr>
    </table>
    <div class="highlight-box">
      <p>💳 <strong>카드번호, CVV, 계좌번호 등 민감한 결제 정보는 결제대행사 토스페이먼츠(주)에서 직접 처리</strong>하며, Lovia 서버에는 저장되지 않습니다.</p>
    </div>

    <h3>③ 서비스 이용 중 자동 수집</h3>
    <table class="info-table">
      <tr><th>항목</th><th>수집 목적</th><th>보유 기간</th></tr>
      <tr><td>접속 IP 주소, 접속 시각</td><td>부정 이용 탐지, 보안 관리</td><td>3개월</td></tr>
      <tr><td>기기 정보 (브라우저 종류, OS)</td><td>서비스 호환성 개선</td><td>3개월</td></tr>
      <tr><td>서비스 이용 기록 (클릭, 페이지 방문)</td><td>서비스 개선 및 분석</td><td>1년</td></tr>
      <tr><td>FCM 푸시 토큰</td><td>AI 알림 발송</td><td>탈퇴 시까지</td></tr>
    </table>

    <h3>④ AI 대화 서비스 이용 시</h3>
    <table class="info-table">
      <tr><th>항목</th><th>수집 목적</th><th>보유 기간</th></tr>
      <tr><td>사용자가 입력한 채팅 메시지</td><td>AI 응답 생성 (Google Gemini API에 전달)</td><td>API 처리 즉시 파기 (Gemini 서버 기준)</td></tr>
      <tr><td>AI 대화 요약 (장기 기억)</td><td>개인화된 AI 응답을 위한 장기 기억 시스템</td><td>탈퇴 시까지 (요청 시 즉시 삭제)</td></tr>
    </table>
    <div class="warn-box">
      <p>⚠️ AI에게 민감한 개인정보(주민등록번호, 금융정보, 의료정보 등)를 입력하지 않도록 주의하세요. 입력된 내용은 AI 응답 생성을 위해 Google Gemini API에 전달됩니다.</p>
    </div>

    <h2>제2조 (개인정보 수집·이용 목적)</h2>
    <table class="info-table">
      <tr><th>이용 목적</th><th>관련 수집 항목</th><th>법적 근거</th></tr>
      <tr><td>서비스 이용자 식별 및 회원 관리</td><td>이메일, 닉네임, 비밀번호</td><td>개인정보보호법 §15①4호 (계약 이행)</td></tr>
      <tr><td>유료 결제 및 크레딧 지급</td><td>결제 정보, 이메일</td><td>개인정보보호법 §15①4호 / 전자상거래법</td></tr>
      <tr><td>AI 채팅 개인화 및 장기 기억</td><td>채팅 내용, 대화 요약</td><td>개인정보보호법 §15①4호 (계약 이행)</td></tr>
      <tr><td>AI 푸시 알림 발송</td><td>FCM 토큰</td><td>개인정보보호법 §15①1호 (동의)</td></tr>
      <tr><td>부정 이용 탐지 및 보안</td><td>접속 로그, IP</td><td>개인정보보호법 §15①6호 (정당한 이익)</td></tr>
      <tr><td>고객 문의 및 환불 처리</td><td>이메일, 결제 정보</td><td>개인정보보호법 §15①4호</td></tr>
      <tr><td>서비스 개선 및 통계 분석</td><td>이용 기록 (비식별 처리)</td><td>개인정보보호법 §15①6호</td></tr>
    </table>

    <h2>제3조 (개인정보의 보유 및 이용 기간)</h2>
    <table class="info-table">
      <tr><th>항목</th><th>보유 기간</th><th>근거</th></tr>
      <tr><td>회원 정보 (이메일, 닉네임)</td><td>회원 탈퇴 시까지</td><td>서비스 이용 계약</td></tr>
      <tr><td>결제 기록 (거래 내역)</td><td>결제일로부터 5년</td><td>전자상거래법 제6조</td></tr>
      <tr><td>결제 취소·환불 기록</td><td>처리일로부터 5년</td><td>전자상거래법 제6조</td></tr>
      <tr><td>소비자 불만·분쟁 처리 기록</td><td>처리일로부터 3년</td><td>전자상거래법 제6조</td></tr>
      <tr><td>접속 로그 (IP, 시간)</td><td>3개월</td><td>통신비밀보호법 제15조의2</td></tr>
      <tr><td>AI 대화 요약 (장기 기억)</td><td>탈퇴 시까지 (요청 시 즉시 삭제)</td><td>서비스 이용 계약</td></tr>
      <tr><td>FCM 푸시 토큰</td><td>탈퇴 시까지 또는 알림 거부 시</td><td>동의 철회 시 즉시 삭제</td></tr>
    </table>

    <h2>제4조 (개인정보의 제3자 제공)</h2>
    <p>회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령에 따라 또는 이용자의 동의를 얻은 경우에 한해 제공합니다.</p>
    <table class="info-table">
      <tr><th>제공받는 자</th><th>제공 목적</th><th>제공 항목</th><th>보유·이용 기간</th></tr>
      <tr>
        <td><strong>토스페이먼츠(주)</strong></td>
        <td>유료 결제 승인 및 처리, 환불</td>
        <td>결제 금액, 주문 상품명, 이용자 이메일, 결제 수단</td>
        <td>결제일로부터 5년 (전자상거래법)</td>
      </tr>
    </table>
    <div class="info-box">
      <p>ℹ️ Google Firebase FCM 및 Google Gemini API는 제3자 제공이 아닌 <strong>처리위탁</strong>으로 운영됩니다 (제5조 참조).</p>
    </div>

    <h2>제5조 (개인정보 처리위탁)</h2>
    <p>회사는 서비스 운영을 위해 아래와 같이 개인정보 처리를 위탁하고 있습니다. 위탁 계약 시 개인정보가 안전하게 관리되도록 필요한 사항을 규정하고 있습니다.</p>
    <table class="info-table">
      <tr><th>수탁자</th><th>위탁 업무</th><th>위탁 항목</th><th>보유 기간</th></tr>
      <tr>
        <td><strong>Google LLC<br/>(Firebase FCM)</strong></td>
        <td>푸시 알림 발송</td>
        <td>FCM 디바이스 토큰</td>
        <td>탈퇴 시까지 / 알림 거부 즉시 삭제</td>
      </tr>
      <tr>
        <td><strong>Google LLC<br/>(Gemini API)</strong></td>
        <td>AI 대화 응답 생성</td>
        <td>사용자가 입력한 채팅 메시지 내용</td>
        <td>API 요청 처리 후 즉시 파기 (Google AI 사용 정책 적용)</td>
      </tr>
      <tr>
        <td><strong>Cloudflare, Inc.</strong></td>
        <td>서비스 인프라 운영 (CDN, Workers)</td>
        <td>서버 처리 데이터 (로그, 세션)</td>
        <td>서비스 운영 기간 중</td>
      </tr>
    </table>
    <div class="warn-box">
      <p>⚠️ Google Gemini API의 경우 입력된 채팅 내용이 AI 응답 생성에 활용됩니다. Google의 <a href="https://ai.google.dev/terms" target="_blank">Gemini API 사용 약관</a> 및 AI 데이터 처리 정책이 적용됩니다.</p>
    </div>

    <h2>제6조 (개인정보의 파기)</h2>
    <h3>① 파기 시점</h3>
    <ul>
      <li>회원 탈퇴 요청 즉시 개인정보 파기 처리</li>
      <li>법령상 보유 의무가 있는 항목은 해당 기간 경과 후 파기</li>
      <li>FCM 토큰은 알림 거부(opt-out) 즉시 파기</li>
    </ul>
    <h3>② 파기 방법</h3>
    <ul>
      <li><strong>전자적 파일</strong>: 복구 불가능한 방법(덮어쓰기, DB 삭제)으로 영구 삭제</li>
      <li><strong>AI 장기 기억</strong>: 탈퇴 또는 요청 시 대화 요약 데이터 즉시 DB 삭제</li>
    </ul>

    <h2>제7조 (이용자의 권리와 행사 방법)</h2>
    <p>이용자는 언제든지 아래 권리를 행사할 수 있습니다 (개인정보보호법 제35~37조).</p>
    <table class="info-table">
      <tr><th>권리</th><th>내용</th><th>처리 기간</th></tr>
      <tr><td>열람 요청</td><td>보유 중인 개인정보 확인</td><td>10일 이내</td></tr>
      <tr><td>정정 요청</td><td>잘못된 정보 수정</td><td>10일 이내</td></tr>
      <tr><td>삭제 요청</td><td>개인정보 삭제 (법령 보유 항목 제외)</td><td>10일 이내</td></tr>
      <tr><td>처리 정지</td><td>특정 목적의 처리 중지 요청</td><td>10일 이내</td></tr>
      <tr><td>회원 탈퇴</td><td>계정 및 개인정보 삭제</td><td>즉시 처리</td></tr>
    </table>
    <p>권리 행사 방법: 고객센터 이메일 <a href="mailto:support@lovia.app">support@lovia.app</a>으로 요청하시면 됩니다.<br/>
    법정 대리인(만 14세 미만 대리)의 경우도 동일한 방법으로 요청 가능합니다.</p>

    <h2>제8조 (쿠키 및 로컬스토리지 사용)</h2>
    <p>서비스는 이용자 경험 개선을 위해 브라우저 <strong>로컬스토리지</strong> 및 <strong>세션스토리지</strong>를 사용합니다.</p>
    <table class="info-table">
      <tr><th>저장 항목</th><th>용도</th><th>저장 위치</th></tr>
      <tr><td>인증 토큰 (JWT)</td><td>로그인 상태 유지</td><td>localStorage</td></tr>
      <tr><td>크레딧 잔액 (임시)</td><td>빠른 UI 표시</td><td>sessionStorage</td></tr>
      <tr><td>이용자 닉네임 (임시)</td><td>마이페이지 표시</td><td>sessionStorage</td></tr>
    </table>
    <p>브라우저 설정에서 저장소 초기화를 통해 해당 데이터를 삭제할 수 있습니다. 단, 삭제 시 로그인 상태가 초기화됩니다.</p>

    <h2>제9조 (미성년자 보호)</h2>
    <p>서비스는 <strong>만 14세 미만 아동</strong>의 개인정보를 수집하지 않습니다. 만 14세 미만은 서비스에 가입하거나 유료 결제를 진행할 수 없으며, 부모 또는 법정대리인의 동의가 필요합니다. 해당 사실이 확인될 경우 계정 및 관련 데이터를 즉시 삭제합니다.</p>

    <h2>제10조 (개인정보 보호책임자)</h2>
    <table class="info-table">
      <tr><th>구분</th><th>내용</th></tr>
      <tr><td>개인정보 보호책임자</td><td>박현우 (우드와이드 대표)</td></tr>
      <tr><td>연락처</td><td><a href="mailto:support@lovia.app">support@lovia.app</a></td></tr>
      <tr><td>처리 부서</td><td>Lovia 운영팀</td></tr>
    </table>

    <h2>제11조 (개인정보 침해 신고 및 상담)</h2>
    <p>개인정보 처리에 관한 불만이나 피해 구제를 위해 아래 기관에 문의할 수 있습니다.</p>
    <ul>
      <li>개인정보보호위원회: <a href="https://www.privacy.go.kr" target="_blank">www.privacy.go.kr</a> / 국번없이 182</li>
      <li>한국인터넷진흥원 개인정보침해 신고센터: <a href="https://privacy.kisa.or.kr" target="_blank">privacy.kisa.or.kr</a> / 국번없이 118</li>
      <li>대검찰청 사이버범죄수사단: <a href="https://www.spo.go.kr" target="_blank">www.spo.go.kr</a> / 02-3480-3573</li>
      <li>경찰청 사이버안전국: <a href="https://cyberbureau.police.go.kr" target="_blank">cyberbureau.police.go.kr</a> / 국번없이 182</li>
    </ul>

    <h2>제12조 (방침 변경 안내)</h2>
    <p>본 방침은 법령 변경 또는 서비스 정책 변경에 따라 업데이트될 수 있습니다. 중요 변경 사항은 <strong>시행 7일 전</strong>에 서비스 내 공지 또는 이메일로 안내합니다. 변경 후에도 서비스를 계속 이용하시면 변경된 방침에 동의한 것으로 간주합니다.</p>

    <div class="footer-note">
      본 방침은 2026년 2월 23일부터 시행됩니다.<br/>
      문의: <a href="mailto:support@lovia.app">support@lovia.app</a> &nbsp;|&nbsp; 평일 10:00–18:00
    </div>

    <div class="biz-info">
      <strong>개인정보 처리자 정보</strong>
      상호명: 우드와이드 &nbsp;|&nbsp; 대표자: 박현우 &nbsp;|&nbsp; 사업자등록번호: 783-10-03120<br/>
      사업장 주소: (사업자등록증 상 주소 기재 예정)<br/>
      이메일: support@lovia.app<br/>
      <span style="font-size:10px;color:rgba(255,255,255,.15);">※ 본 처리방침은 개인정보보호법 제30조에 따라 공개됩니다.</span>
    </div>
  </div>
</body>
</html>`)
})

// ════════════════════════════════════════════
// STORY API  (/api/story/*)
// ════════════════════════════════════════════

const storyApp = new Hono<{ Bindings: Bindings }>()

// GET /api/story/:personaId/status — 스토리 완료 여부 확인
storyApp.get('/api/story/:personaId/status', async (c) => {
  const personaId = c.req.param('personaId')
  const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')

  if (!userId || !c.env.DB) {
    return c.json({ completed: false })
  }

  const row = await c.env.DB.prepare(
    'SELECT ending_type FROM story_completions WHERE user_id = ? AND persona_id = ?'
  ).bind(userId, personaId).first<{ ending_type: string }>()

  return c.json({ completed: !!row, endingType: row?.ending_type ?? null })
})

// POST /api/story/complete — 스토리 완료 처리 (관계 보너스 + 기억 시드)
storyApp.post('/api/story/complete', async (c) => {
  try {
    const { personaId, endingType, choiceTags, memorySeed } = await c.req.json<{
      personaId: string
      endingType: string
      choiceTags: string[]
      memorySeed: string
    }>()

    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')

    if (!userId || !c.env.DB) {
      // 비로그인 유저: 서버 기록 없이 성공 응답
      return c.json({ success: true, guestMode: true })
    }

    const db = c.env.DB

    // ① 스토리 완료 기록 (중복 무시)
    await db.prepare(`
      INSERT OR IGNORE INTO story_completions (user_id, persona_id, ending_type, choice_tags)
      VALUES (?, ?, ?, ?)
    `).bind(userId, personaId, endingType, JSON.stringify(choiceTags)).run()

    // ② 관계 레벨 보너스: 스토리 완료 시 chat_count 20 부여 → Lv2(썸) 보장
    await db.prepare(`
      INSERT INTO relationship_levels (user_id, persona_id, chat_count, level)
      VALUES (?, ?, 20, 2)
      ON CONFLICT(user_id, persona_id) DO UPDATE SET
        chat_count = MAX(chat_count, 20),
        level      = MAX(level, 2),
        updated_at = datetime('now')
    `).bind(userId, personaId).run()

    // ③ 장기 기억 시드 저장
    if (memorySeed) {
      await db.prepare(`
        INSERT INTO user_memory (user_id, persona_id, memory_text)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, persona_id) DO UPDATE SET
          memory_text = excluded.memory_text,
          updated_at  = datetime('now')
      `).bind(userId, personaId, memorySeed).run()
    }

    return c.json({ success: true })
  } catch (e: any) {
    console.error('[/api/story/complete error]', e)
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// ════════════════════════════════════════════
// ONBOARDING API  (/api/onboarding/*)
// ════════════════════════════════════════════

const onboardingApp = new Hono<{ Bindings: Bindings }>()

// POST /api/onboarding/complete — 온보딩 완료 처리
onboardingApp.post('/api/onboarding/complete', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId || !c.env.DB) {
      return c.json({ success: true, guestMode: true })
    }
    await c.env.DB.prepare(
      'UPDATE users SET onboarding_completed = 1 WHERE id = ?'
    ).bind(userId).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// GET /api/onboarding/status — 온보딩 완료 여부 확인
onboardingApp.get('/api/onboarding/status', async (c) => {
  const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
  if (!userId || !c.env.DB) {
    return c.json({ completed: false })
  }
  const row = await c.env.DB.prepare(
    'SELECT onboarding_completed FROM users WHERE id = ?'
  ).bind(userId).first<{ onboarding_completed: number }>()
  return c.json({ completed: (row?.onboarding_completed ?? 0) === 1 })
})

// ════════════════════════════════════════════
// USER PREFERENCES API  (/api/user/preferences)
// ════════════════════════════════════════════

const prefsApp = new Hono<{ Bindings: Bindings }>()

// GET /api/user/preferences — 사용자 설정 조회
prefsApp.get('/api/user/preferences', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId || !c.env.DB) {
      return c.json({ skipRecommend: false })
    }
    const row = await c.env.DB.prepare(
      'SELECT skip_recommend FROM users WHERE id = ?'
    ).bind(userId).first<{ skip_recommend: number }>()
    return c.json({ skipRecommend: (row?.skip_recommend ?? 0) === 1 })
  } catch (e: any) {
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// POST /api/user/preferences — 사용자 설정 저장
prefsApp.post('/api/user/preferences', async (c) => {
  try {
    const userId = await getUserIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET || 'dev-secret')
    if (!userId || !c.env.DB) {
      return c.json({ success: true, guestMode: true })
    }
    const { skipRecommend } = await c.req.json<{ skipRecommend: boolean }>()
    await c.env.DB.prepare(
      'UPDATE users SET skip_recommend = ? WHERE id = ?'
    ).bind(skipRecommend ? 1 : 0, userId).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: '서버 오류', detail: e.message }, 500)
  }
})

// chatApp 라우트를 메인 app에 마운트
app.route('/', chatApp)
app.route('/', authApp)
app.route('/', memoryApp)
app.route('/', pushApp)
app.route('/', storyApp)
app.route('/', onboardingApp)
app.route('/', prefsApp)

export default app
