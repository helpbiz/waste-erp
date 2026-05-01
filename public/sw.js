/**
 * CleanERP Service Worker — 자동 갱신 강화 버전
 *  - install: skipWaiting()으로 즉시 대기 해제
 *  - activate: 이전 캐시 모두 삭제 + clients.claim()
 *  - fetch: 페이지는 network-first (캐시 의존 최소화) / 정적 자산만 SWR
 *  - 사용자 폰의 v1 SW가 v3로 자동 교체되도록 설계
 */
/* PWA Mobile UX Mastering 적용 — v4 강제 캐시 무효화로 모바일 사용자에게 즉시 새 UI 배포 */
const CACHE_NAME = 'cleanerp-v62-2026-05-02-pwa-manual-entry-points';
const APP_SHELL = ['/login', '/manifest.json'];  /* 최소 셸만 — 페이지는 항상 네트워크 우선 */

self.addEventListener('install', (event) => {
  /* 새 SW가 즉시 활성화되도록 — 기존 탭이 살아 있어도 대기 안 함 */
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => null))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      /* 이전 버전 캐시 모두 삭제 */
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      /* 활성 클라이언트(탭) 즉시 제어권 획득 → controllerchange 발생 → 페이지 새로고침 */
      self.clients.claim(),
    ])
  );
});

/* 클라이언트가 강제 갱신 요청 시 */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/* WebPush 수신 — 백그라운드(앱 닫힘)에서도 OS 알림 표시.
   서버가 sendPushToUser() 로 보낸 payload (JSON: { title, body, tag, url? }) 를 파싱.
   사용자가 클릭하면 url 로 포커스 이동. */
self.addEventListener('push', (event) => {
  let data = { title: 'CleanERP', body: '새로운 알림이 있습니다', tag: 'cleanerp' };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (e) { /* */ }
  const opts = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'cleanerp',
    data: { url: data.url || '/dashboard' },
    vibrate: [200, 100, 200],
    requireInteraction: data.severity === 'CRITICAL',
  };
  event.waitUntil(self.registration.showNotification(data.title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      /* 이미 열린 탭이 있으면 포커스 + url 이동 */
      for (const c of list) {
        if ('focus' in c) { c.navigate(url).catch(() => null); return c.focus(); }
      }
      /* 없으면 새 창 */
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* API: network-only — 절대 캐시 사용 안 함 */
  if (url.pathname.startsWith('/api/')) return;

  /* GET 외: pass-through */
  if (request.method !== 'GET') return;

  /* 정적 리소스(_next/static, icons): stale-while-revalidate */
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
          return cached ?? fetchPromise;
        })
      )
    );
    return;
  }

  /* 페이지 / 동적 리소스: network-first (오프라인 시에만 캐시) */
  event.respondWith(
    fetch(request).then((res) => {
      /* 200 응답만 일부 캐싱 (오프라인 폴백용) */
      if (res.ok && (url.pathname === '/login' || url.pathname === '/manifest.json')) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return res;
    }).catch(() => caches.match(request).then((c) => c ?? caches.match('/login')))
  );
});
