/**
 * 외부 내비 앱 (카카오맵 / 네이버지도 / T맵) URL 스킴 런처.
 * 모바일 PWA에서 클릭 1회로 차량 내비 시작 — 백엔드 변경 불필요.
 *
 * 동작: 설치된 앱 자동 실행. 미설치 시 OS가 스토어 안내 또는 무반응(브라우저별).
 * 출발지: 모든 스킴이 미입력 시 현재 위치(GPS) 자동 사용.
 */

export type NavApp = 'kakaomap' | 'nmap' | 'tmap';

export const NAV_LABEL: Record<NavApp, string> = {
  kakaomap: '카카오맵',
  nmap: '네이버지도',
  tmap: 'T맵',
};

const PREF_KEY = 'cleanerp:preferred-nav';

export function launchNav(app: NavApp, lat: number, lng: number, name: string): void {
  if (typeof window === 'undefined') return;
  const dest = encodeURIComponent(name || '민원지');
  let url = '';
  switch (app) {
    case 'kakaomap':
      // 출발지(sp) 미지정 → 카카오맵이 현재 위치 사용. by=CAR 차량 길안내.
      url = `kakaomap://route?ep=${lat},${lng}&by=CAR`;
      break;
    case 'nmap':
      // 네이버지도: dlat/dlng 도착, dname 표시명, appname 콜백 식별
      url = `nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${dest}&appname=kr.helpbiz.cleanerp`;
      break;
    case 'tmap':
      // T맵: goalx=경도, goaly=위도 (xy 순서 반전 주의), rGoYType=0 빠른길
      url = `tmap://route?goalname=${dest}&goalx=${lng}&goaly=${lat}&rGoYType=0`;
      break;
  }
  window.location.href = url;
}

export function getPreferredNav(): NavApp | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === 'kakaomap' || v === 'nmap' || v === 'tmap') return v;
  } catch {
    /* localStorage 거부된 환경 무시 */
  }
  return null;
}

export function setPreferredNav(app: NavApp): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREF_KEY, app);
  } catch {
    /* 무시 */
  }
}
