// Lovia Service Worker — PWA 캐싱 + FCM 푸시 알림
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── Firebase 초기화 ──────────────────────────────────────────
firebase.initializeApp({
  apiKey:            "AIzaSyBTbU42WJUPvHda6PnR4K3FcOVeqM2qJ70",
  authDomain:        "lovia-23d7a.firebaseapp.com",
  projectId:         "lovia-23d7a",
  storageBucket:     "lovia-23d7a.firebasestorage.app",
  messagingSenderId: "545180989499",
  appId:             "1:545180989499:web:f9a1d2a4e7b43325a4441e"
});

const messaging = firebase.messaging();

// ── 백그라운드 메시지 수신 ────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || 'Lovia 💌', {
    body:    body || '새 메시지가 도착했어요',
    icon:    '/images/icon-192.png',
    badge:   '/images/icon-96.png',
    tag:     'lovia-chat-' + (data.personaId || 'default'),
    renotify: true,
    vibrate: [200, 100, 200],
    data:    { url: '/', personaId: data.personaId }
  });
});

// ── 알림 클릭 → 앱 열기 ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 이미 열려 있는 창이 있으면 포커스
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── PWA 캐싱 (기존 로직 유지) ────────────────────────────────
const CACHE_NAME = 'lovia-v2';
const STATIC_ASSETS = [
  '/',
  '/static/app.js',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
