'use client';

/**
 * Service Worker 등록 + 자동 갱신
 * - 페이지 로드마다 SW 업데이트 체크 (registration.update())
 * - 새 SW가 활성화되면 (controllerchange) 자동 새로고침
 * - 사용자 별도 조작 없이 다음 방문 시 최신 코드 적용
 */
import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloaded = false;

    /* 1. 새 SW 활성화 → 자동 새로고침 (1회만) */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    /* 2. 등록 + 즉시 업데이트 체크 */
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        /* 페이지 로드 시 강제 업데이트 체크 */
        reg.update().catch(() => null);

        /* 30분마다 백그라운드 업데이트 체크 (앱 켜둔 상태 대응) */
        const t = setInterval(() => reg.update().catch(() => null), 30 * 60 * 1000);
        return () => clearInterval(t);
      })
      .catch(() => null);
  }, []);

  return null;
}
