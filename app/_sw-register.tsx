'use client';

import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reloaded = false;

    function forceSkip(sw: ServiceWorker) {
      sw.postMessage('SKIP_WAITING');
    }

    /* 새 SW 활성화 → 자동 새로고침 (1회만) */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      /* 이미 대기 중인 SW가 있으면 즉시 활성화 */
      if (reg.waiting) forceSkip(reg.waiting);

      /* 새 SW 설치 감지 → 설치 완료 즉시 활성화 */
      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed') forceSkip(next);
        });
      });

      reg.update().catch(() => null);

      const t = setInterval(() => reg.update().catch(() => null), 30 * 60 * 1000);
      return () => clearInterval(t);
    }).catch(() => null);
  }, []);

  return null;
}
