'use client';

/**
 * 신규 사용자 등록 폼용 — username 자동 unique 검사 + 추천 아이디.
 * 입력값 변경 시 350ms debounce → /api/users/check-username 호출.
 *
 * 반환:
 *  - status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
 *  - suggestions: 사용 가능 대안 5개 (taken 일 때만)
 */
import { useEffect, useState } from 'react';

export type UsernameCheckStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function useUsernameCheck(username: string) {
  const [status, setStatus] = useState<UsernameCheckStatus>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const trimmed = (username ?? '').trim();
    if (!trimmed) {
      setStatus('idle');
      setSuggestions([]);
      return;
    }
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(trimmed)) {
      setStatus('invalid');
      setSuggestions([]);
      return;
    }
    setStatus('checking');
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/check-username?username=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const j = await r.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (j.available === true) {
          setStatus('available');
          setSuggestions([]);
        } else if (j.reason === 'format') {
          setStatus('invalid');
          setSuggestions([]);
        } else {
          setStatus('taken');
          setSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
        }
      } catch {
        /* abort 또는 네트워크 오류 — 무시 (UI 는 idle 유지) */
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [username]);

  return { status, suggestions };
}
