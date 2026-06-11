'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const ALERT_COLOR: Record<string, string> = {
  HEATWAVE: 'bg-red-100 text-red-800 border-red-300',
  COLDWAVE: 'bg-blue-100 text-blue-800 border-blue-300',
  TYPHOON:  'bg-purple-100 text-purple-800 border-purple-300',
  STORM:    'bg-slate-100 text-ink-muted border-slate-300',
  OTHER:    'bg-amber-100 text-amber-800 border-amber-300',
};
const ALERT_LABEL: Record<string, string> = {
  HEATWAVE: '🌡 폭염', COLDWAVE: '❄️ 한파', TYPHOON: '🌀 태풍', STORM: '⛈ 강풍·폭우', OTHER: '⚠️ 기타',
};
const ACTION_PRESETS = [
  '물 500ml 이상 섭취', '10분 이상 그늘 휴식', '휴게실 냉방 이용', '작업 중단 후 안전한 장소로 이동',
  '냉각 조끼 착용', '온열 증상 없음 확인', '핫팩 사용', '방한복 착용', '실내 작업으로 전환',
];

type Notice = {
  id: string; alertType: string; title: string; content: string | null;
  noticeDate: string;
  myPhoto: { id: string; uploadedAt: string; recordTime: string | null; feelsLike: number | null; actionTaken: string | null; managerName: string | null } | null;
};

export default function WeatherNoticesWorkerClient({
  items, todayStr,
}: {
  items: Notice[];
  todayStr: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* 폼 상태: noticeId → 입력값 */
  const [forms, setForms] = useState<Record<string, {
    recordTime: string; feelsLike: string; actionTaken: string; managerName: string; photoFile?: File;
  }>>({});

  function initForm(noticeId: string, existing: Notice['myPhoto']) {
    if (forms[noticeId]) return;
    setForms((prev) => ({
      ...prev,
      [noticeId]: {
        recordTime:  existing?.recordTime  ?? new Date().toTimeString().slice(0, 5),
        feelsLike:   existing?.feelsLike   != null ? String(existing.feelsLike) : '',
        actionTaken: existing?.actionTaken ?? '',
        managerName: existing?.managerName ?? '',
      },
    }));
  }

  function updateForm(noticeId: string, field: string, value: string) {
    setForms((prev) => ({ ...prev, [noticeId]: { ...prev[noticeId], [field]: value } }));
  }

  async function handleSubmit(noticeId: string) {
    const f = forms[noticeId];
    if (!f) return;
    setSubmitting(noticeId);
    setError(null);
    try {
      let photoData: string | undefined;
      if (f.photoFile) {
        photoData = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(f.photoFile!);
          img.onload = () => {
            const MAX = 800;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            let quality = 0.7;
            let data = canvas.toDataURL('image/jpeg', quality);
            while (data.length > 270_000 && quality > 0.3) {
              quality -= 0.1;
              data = canvas.toDataURL('image/jpeg', quality);
            }
            resolve(data);
          };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
          img.src = url;
        });
      }
      const body: Record<string, unknown> = {
        recordTime:  f.recordTime  || null,
        feelsLike:   f.feelsLike   ? Number(f.feelsLike) : null,
        actionTaken: f.actionTaken || null,
        managerName: f.managerName || null,
      };
      if (photoData) body.photoData = photoData;

      const res = await fetch(`/api/safety/weather-notices/${noticeId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? '저장 실패');
        return;
      }
      setActiveForm(null);
      router.refresh();
    } catch {
      setError('저장 오류');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <div>
        <h2 className="text-lg font-extrabold text-ink">날씨 안전 기록</h2>
        <p className="text-sm font-bold text-ink-muted mt-0.5">{todayStr} · 폭염·한파 안전 조치를 기록하세요</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      {items.length === 0 ? (
        <div className="bg-surface border border-line rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">☀️</div>
          <div className="text-sm font-extrabold text-ink">오늘의 기상 안전 공지가 없습니다.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((n) => {
            const isOpen = activeForm === n.id;
            const f = forms[n.id];
            const hasRecord = !!n.myPhoto;

            return (
              <div key={n.id} className="bg-surface border-2 border-line rounded-2xl overflow-hidden shadow-sm">
                {/* 공지 내용 */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-sm font-extrabold border ${ALERT_COLOR[n.alertType] ?? ALERT_COLOR.OTHER}`}>
                      {ALERT_LABEL[n.alertType] ?? n.alertType}
                    </span>
                    {hasRecord && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-success text-[0.625rem] font-extrabold border border-green-300">✓ 기록 완료</span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-ink text-base">{n.title}</h3>
                  {n.content && <p className="text-sm text-ink-muted mt-1 leading-relaxed">{n.content}</p>}
                </div>

                {/* 기록 현황 (완료 시) */}
                {hasRecord && !isOpen && (
                  <div className="border-t border-line bg-green-50 px-4 py-3 space-y-1">
                    <div className="grid grid-cols-2 gap-x-4 text-sm">
                      {n.myPhoto?.recordTime  && <span><b>시간:</b> {n.myPhoto.recordTime}</span>}
                      {n.myPhoto?.feelsLike   != null && <span><b>체감온도:</b> {n.myPhoto.feelsLike}℃</span>}
                      {n.myPhoto?.managerName && <span><b>담당자:</b> {n.myPhoto.managerName}</span>}
                      {n.myPhoto?.actionTaken && <span className="col-span-2"><b>조치사항:</b> {n.myPhoto.actionTaken}</span>}
                    </div>
                    <button onClick={() => { initForm(n.id, n.myPhoto); setActiveForm(n.id); }}
                      className="text-sm font-extrabold text-accent hover:underline mt-1">수정하기 →</button>
                  </div>
                )}

                {/* 기록 입력 폼 */}
                {isOpen && f && (
                  <div className="border-t border-line p-4 space-y-3 bg-surface-soft">
                    <div className="grid grid-cols-2 gap-3">
                      {/* 시간 */}
                      <label className="flex flex-col gap-1">
                        <span className="text-[0.6875rem] font-extrabold text-ink-muted">시간 *</span>
                        <input type="time" value={f.recordTime}
                          onChange={(e) => updateForm(n.id, 'recordTime', e.target.value)}
                          className="px-3 py-2 rounded-xl border-2 border-line text-sm font-mono bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
                      </label>
                      {/* 체감온도 */}
                      <label className="flex flex-col gap-1">
                        <span className="text-[0.6875rem] font-extrabold text-ink-muted">체감온도 (℃)</span>
                        <input type="number" value={f.feelsLike} min="-50" max="60"
                          placeholder="예: 38"
                          onChange={(e) => updateForm(n.id, 'feelsLike', e.target.value)}
                          className="px-3 py-2 rounded-xl border-2 border-line text-sm font-mono bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
                      </label>
                    </div>

                    {/* 담당자 */}
                    <label className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-extrabold text-ink-muted">담당자</span>
                      <input type="text" value={f.managerName}
                        placeholder="담당자 이름"
                        onChange={(e) => updateForm(n.id, 'managerName', e.target.value)}
                        className="px-3 py-2 rounded-xl border-2 border-line text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent" />
                    </label>

                    {/* 조치사항 */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-extrabold text-ink-muted">조치사항</span>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {ACTION_PRESETS.map((p) => (
                          <button key={p} type="button"
                            onClick={() => updateForm(n.id, 'actionTaken', f.actionTaken ? f.actionTaken + ', ' + p : p)}
                            className="px-2 py-0.5 rounded-full bg-surface border border-line text-[0.625rem] font-bold hover:bg-accent hover:text-white hover:border-accent transition">
                            {p}
                          </button>
                        ))}
                      </div>
                      <textarea rows={3} value={f.actionTaken}
                        placeholder="조치사항을 입력하거나 위 버튼을 클릭하세요"
                        onChange={(e) => updateForm(n.id, 'actionTaken', e.target.value)}
                        className="px-3 py-2 rounded-xl border-2 border-line text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus:border-accent resize-none" />
                    </div>

                    {/* 사진 */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[0.6875rem] font-extrabold text-ink-muted">휴식 인증 사진</span>
                      <button type="button" onClick={() => fileRefs.current[n.id]?.click()}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-accent/40 text-accent font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-accent/5 active:scale-95">
                        {f.photoFile ? `📷 ${f.photoFile.name}` : (n.myPhoto?.uploadedAt ? '📷 사진 재촬영' : '📷 사진 첨부 (선택)')}
                      </button>
                      <input ref={(el) => { fileRefs.current[n.id] = el; }}
                        type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setForms((prev) => ({ ...prev, [n.id]: { ...prev[n.id], photoFile: file } }));
                          e.target.value = '';
                        }} />
                    </div>

                    {/* 저장 버튼 */}
                    <div className="flex gap-2">
                      <button onClick={() => setActiveForm(null)}
                        className="flex-1 py-3 rounded-xl border border-line text-sm font-extrabold text-ink-muted">
                        취소
                      </button>
                      <button onClick={() => handleSubmit(n.id)}
                        disabled={submitting === n.id}
                        className="flex-2 px-6 py-3 rounded-xl bg-accent text-white text-sm font-extrabold active:scale-95 disabled:opacity-50">
                        {submitting === n.id ? '저장 중…' : '✅ 기록 저장'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 기록 시작 버튼 (미기록 시) */}
                {!hasRecord && !isOpen && (
                  <div className="border-t border-line px-4 py-3">
                    <button onClick={() => { initForm(n.id, null); setActiveForm(n.id); }}
                      className="w-full py-3 rounded-xl bg-accent text-white font-extrabold text-sm flex items-center justify-center gap-2 active:scale-95">
                      📝 안전 조치 기록하기
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
