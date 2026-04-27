'use client';

import { useEffect, useState } from 'react';

type Step = 'idle' | 'sw' | 'cache' | 'done' | 'error';

export default function ResetClient() {
  const [step, setStep] = useState<Step>('idle');
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function append(msg: string) {
    setLog((p) => [...p, msg]);
  }

  async function run() {
    setStep('sw');
    setError(null);
    setLog([]);
    try {
      /* 1. Service Worker unregister */
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          await r.unregister();
          append(`✓ SW unregister: ${r.scope}`);
        }
        if (regs.length === 0) append('· 등록된 Service Worker 없음');
      } else {
        append('· Service Worker API 미지원');
      }

      /* 2. CacheStorage 모두 삭제 */
      setStep('cache');
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) {
          await caches.delete(k);
          append(`✓ Cache 삭제: ${k}`);
        }
        if (keys.length === 0) append('· 캐시 없음');
      } else {
        append('· CacheStorage 미지원');
      }

      /* 3. localStorage 일부 키 정리 (시민 전화번호 등은 유지) */
      append('· localStorage는 유지됨');

      setStep('done');
      append('');
      append('🎉 초기화 완료. 3초 후 로그인 페이지로 이동합니다…');
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } catch (e) {
      setStep('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    run();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center px-4 py-8"
      style={{
        background:
          'radial-gradient(circle at 20% 0%, #0e7490 0%, #164e63 45%, #0f172a 100%)',
      }}
    >
      <div className="w-full max-w-[480px]">
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-horizontal-dark.svg"
            alt="공비랩 Clean ERP"
            width={240}
            height={102}
            className="block w-[240px] h-auto drop-shadow-lg"
          />
        </div>
        <div className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-6">
        <div className="text-center mb-4">
          <h1 className="text-base font-extrabold text-ink">캐시 초기화</h1>
          <p className="text-[12px] font-bold text-ink-muted mt-1">
            오래된 화면이 표시되거나 새 기능이 안 보일 때 사용합니다
          </p>
        </div>

        <div className="bg-surface-soft rounded-lg p-3 font-mono text-[11px] leading-relaxed min-h-[140px]">
          {log.length === 0 && step !== 'error' && (
            <div className="text-ink-muted">초기화 시작 중…</div>
          )}
          {log.map((line, i) => (
            <div key={i} className={line.startsWith('✓') ? 'text-success font-bold' : line.startsWith('🎉') ? 'text-accent font-extrabold' : 'text-ink-muted'}>
              {line || ' '}
            </div>
          ))}
          {error && <div className="text-danger font-bold mt-2">⚠️ {error}</div>}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[10px] font-mono text-ink-faint">
            {step === 'sw' && '단계 1/3 — SW unregister…'}
            {step === 'cache' && '단계 2/3 — Cache 삭제…'}
            {step === 'done' && '단계 3/3 — 완료'}
            {step === 'error' && '⚠️ 오류 발생'}
          </span>
          <a
            href="/login"
            className="text-[11px] font-extrabold text-accent hover:underline"
          >
            로그인 바로가기 →
          </a>
        </div>

        <div className="mt-4 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-[10.5px] text-amber-900 font-bold leading-relaxed">
          💡 <strong>참고</strong>: 이 페이지가 여전히 동작하지 않으면 브라우저 설정에서{' '}
          <strong>사이트 데이터를 직접 삭제</strong>하거나 PWA 앱을{' '}
          <strong>완전히 제거 후 재설치</strong>해 주세요.
        </div>
        </div>
      </div>
    </main>
  );
}
