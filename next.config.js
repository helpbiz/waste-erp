/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=()' },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',  // Docker 운영용 — server.js 단독 실행
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
