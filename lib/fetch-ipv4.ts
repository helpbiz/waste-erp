/**
 * IPv4 강제 fetch 헬퍼
 * undici(Node.js built-in fetch)가 IPv6를 우선 시도하다 타임아웃되는 환경에서
 * Node.js native https 모듈로 IPv4를 강제 사용.
 */
import https from 'https';

export function fetchJson<T = unknown>(url: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { family: 4 }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(raw) as T); }
        catch (e) { reject(new Error(`JSON parse error: ${String(e)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Request timeout: ${url}`));
    });
  });
}
