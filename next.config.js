/** @type {import('next').NextConfig} */
/* deploy-readiness P0: 보안헤더 + CSP — Leaflet/OSM tile + Nominatim 지오코딩 도메인 허용 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js inline scripts
  "style-src 'self' 'unsafe-inline'",                // Tailwind + Leaflet inline
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://*.tile.opentopomap.org https://*.basemaps.cartocdn.com",
  "font-src 'self' data:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://api.openrouteservice.org https://router.project-osrm.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=()' },
  { key: 'Content-Security-Policy', value: CSP },
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
    ];
  },
};
