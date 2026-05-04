import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// 서버 프로세스 시작 시 1회 평가 → 배포마다 새 값
// production: 서버 재시작 = 새 배포 → CACHE_NAME 자동 교체
const DEPLOY_ID = Date.now();
const IS_DEV = process.env.NODE_ENV !== 'production';

const buildSwContent = (deployId: number, isDev: boolean) => `
/**
 * CleanERP Service Worker — 자동 갱신 강화 버전
 *  - install: skipWaiting()으로 즉시 대기 해제
 *  - activate: 이전 캐시 모두 삭제 + clients.claim()
 *  - fetch: dev=network-only(캐싱 없음) / prod=network-first+SWR
 */
const CACHE_NAME = 'cleanerp-${deployId}';
const IS_DEV = ${isDev};
const APP_SHELL = ['/login', '/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (!IS_DEV) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => null))
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

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
      for (const c of list) {
        if ('focus' in c) { c.navigate(url).catch(() => null); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  /* dev: 캐싱 없이 모두 network-only — HMR 방해 없음 */
  if (IS_DEV) return;

  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.method !== 'GET') return;

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

  event.respondWith(
    fetch(request).then((res) => {
      if (res.ok && (url.pathname === '/login' || url.pathname === '/manifest.json')) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return res;
    }).catch(() => caches.match(request).then((c) => c ?? caches.match('/login')))
  );
});
`;

export async function GET() {
  return new NextResponse(buildSwContent(DEPLOY_ID, IS_DEV), {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
