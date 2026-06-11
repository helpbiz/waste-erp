/** @type {import('next').NextConfig} */
/* P1-3: CSP는 middleware.ts에서 요청별 nonce와 함께 동적 생성.
   여기서는 CSP를 설정하지 않는다 — 정적 CSP는 unsafe-eval/unsafe-inline을 남겨야 하므로.
   다른 보안 헤더는 여기서 정적으로 설정한다. */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=()' },
];

/* /login 디자인 고정 — Phase 31: 브라우저·CDN·SW 모든 레이어 캐싱 차단 */
const noCacheHeaders = [
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
  { key: 'Pragma', value: 'no-cache' },
  { key: 'Expires', value: '0' },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',  // Docker 운영용 — server.js 단독 실행
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      /* /login: 캐시 0 — PWA에서 옛 디자인 잔존 방지 */
      { source: '/login', headers: noCacheHeaders },
      { source: '/login/:path*', headers: noCacheHeaders },
      /* sw.js / manifest.json — 브라우저 HTTP 캐시 차단 (사양상 24h까지 stale 허용 → 즉시 갱신 차단됨) */
      { source: '/sw.js', headers: noCacheHeaders },
      { source: '/manifest.json', headers: noCacheHeaders },
    ];
  },
};
