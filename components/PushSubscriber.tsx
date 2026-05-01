'use client';

/**
 * WebPush 구독 — 사용자가 Notification 권한을 grant 한 시점에 SW PushManager 로 구독 후 서버 저장.
 *
 * 동작:
 *  1. SW 등록 대기 → Notification.permission 확인
 *  2. permission='granted' && PushManager 지원 시 subscribe 시도
 *  3. 결과 PushSubscription → POST /api/webpush/subscribe 등록
 *
 * VAPID public key 환경변수: NEXT_PUBLIC_VAPID_PUBLIC_KEY (미설정이면 구독 시도 skip)
 *
 * root layout 의 GlobalNotifications 옆에 마운트 — 모든 인증 화면에서 1회 시도.
 */
import { useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushSubscriber() {
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let cancelled = false;

    async function subscribe() {
      try {
        if (Notification.permission !== 'granted') return;
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          /* TS 타입: BufferSource — Uint8Array.buffer 가 ArrayBufferLike 라 narrow 필요.
             신규 ArrayBuffer 로 복사 후 전달. */
          const keyBytes = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          const buf = new ArrayBuffer(keyBytes.byteLength);
          new Uint8Array(buf).set(keyBytes);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: buf,
          });
        }
        if (cancelled || !sub) return;

        /* 서버 등록 — 401(비로그인)이면 silent */
        const json = sub.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
        await fetch('/api/webpush/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: json.endpoint,
            keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
          }),
        }).catch(() => null);
      } catch { /* silent */ }
    }

    /* permission 이 default 면 첫 사용자 클릭 시 요청 */
    if (Notification.permission === 'default') {
      const onClick = () => {
        Notification.requestPermission().then((p) => {
          if (p === 'granted') subscribe();
        }).catch(() => null);
        window.removeEventListener('click', onClick);
      };
      window.addEventListener('click', onClick, { once: true });
      return () => { cancelled = true; window.removeEventListener('click', onClick); };
    }
    if (Notification.permission === 'granted') subscribe();

    return () => { cancelled = true; };
  }, []);

  return null;
}
