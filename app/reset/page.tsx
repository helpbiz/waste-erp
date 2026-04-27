/**
 * /reset — 캐시·SW 강제 초기화 페이지
 *
 * 사용자가 모바일에서 화면이 갱신되지 않을 때 직접 접속:
 *   https://wci.helpbiz.kr/reset
 *
 * 동작:
 *   1. Service Worker 모두 unregister
 *   2. CacheStorage 모두 삭제
 *   3. /login 으로 이동
 *
 * 미들웨어에서 공개 경로로 처리되어 비로그인 상태에서도 접근 가능
 */
import ResetClient from './_reset-client';

export const metadata = { title: 'CleanERP 캐시 초기화' };

export default function ResetPage() {
  return <ResetClient />;
}
