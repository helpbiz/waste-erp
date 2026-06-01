'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALERT_COLOR: Record<string, string> = {
  HEATWAVE: 'bg-red-100 text-red-800 border-red-300',
  COLDWAVE: 'bg-blue-100 text-blue-800 border-blue-300',
  TYPHOON:  'bg-purple-100 text-purple-800 border-purple-300',
  STORM:    'bg-slate-100 text-slate-800 border-slate-300',
  OTHER:    'bg-amber-100 text-amber-800 border-amber-300',
};
const ALERT_LABEL: Record<string, string> = {
  HEATWAVE: '🌡 폭염', COLDWAVE: '❄️ 한파', TYPHOON: '🌀 태풍', STORM: '⛈ 강풍·폭우', OTHER: '⚠️ 기타',
};

type Notice = {
  id: string; alertType: string; title: string; content: string | null;
  noticeDate: string; myPhoto: { id: string; uploadedAt: string } | null;
};

export default function WeatherNoticesWorkerClient({
  items, todayStr,
}: {
  items: Notice[];
  todayStr: string;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleFile(noticeId: string, file: File) {
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드 가능합니다.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하 이미지만 가능합니다.'); return; }
    setUploading(noticeId);
    setError(null);
    try {
      const reader = new FileReader();
      const photoData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/safety/weather-notices/${noticeId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoData }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? '업로드 실패');
        return;
      }
      router.refresh();
    } catch {
      setError('업로드 오류');
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-extrabold text-ink">날씨 안전관리</h2>
        <p className="text-xs font-bold text-ink-muted mt-0.5">{todayStr} · 오늘의 기상 안전 공지</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">☀️</div>
          <div className="text-sm font-extrabold text-ink">오늘의 기상 안전 공지가 없습니다.</div>
          <div className="text-xs text-ink-muted mt-1">공지 등록 시 여기에 표시됩니다.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <div key={n.id} className="bg-surface border-2 border-line rounded-2xl overflow-hidden shadow-sm">
              {/* 공지 내용 */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${ALERT_COLOR[n.alertType] ?? ALERT_COLOR.OTHER}`}>
                    {ALERT_LABEL[n.alertType] ?? n.alertType}
                  </span>
                </div>
                <h3 className="font-extrabold text-ink text-base">{n.title}</h3>
                {n.content && (
                  <p className="text-sm text-ink-muted mt-1.5 leading-relaxed whitespace-pre-wrap">{n.content}</p>
                )}
              </div>

              {/* 사진 업로드 영역 */}
              <div className="border-t border-line bg-surface-soft px-4 py-3">
                {n.myPhoto ? (
                  <div className="flex items-center gap-2">
                    <span className="text-success">✅</span>
                    <div>
                      <div className="text-xs font-extrabold text-success">휴식 인증 완료</div>
                      <div className="text-[0.6875rem] font-mono text-ink-muted">
                        {new Date(n.myPhoto.uploadedAt).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <button
                      onClick={() => fileRefs.current[n.id]?.click()}
                      className="ml-auto px-3 py-1.5 rounded-lg border border-line text-xs font-extrabold text-ink-muted hover:bg-surface"
                    >
                      재업로드
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRefs.current[n.id]?.click()}
                    disabled={uploading === n.id}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-accent/40 text-accent font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-accent/5 active:scale-95 transition disabled:opacity-50"
                  >
                    {uploading === n.id ? (
                      <>⏳ 업로드 중…</>
                    ) : (
                      <>📷 휴식 인증 사진 업로드</>
                    )}
                  </button>
                )}

                <input
                  ref={(el) => { fileRefs.current[n.id] = el; }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(n.id, f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
