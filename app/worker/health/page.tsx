'use client';

import { useEffect, useState } from 'react';

type Record = {
  lastCheckupDate: string | null;
  bloodPressureSys: number | null; bloodPressureDia: number | null;
  heartRate: number | null; bloodSugar: number | null;
  visionLeft: number | null; visionRight: number | null;
  hearingLeft: string | null; hearingRight: string | null;
  bloodType: string | null; allergies: string | null;
  chronicConditions: string | null; emergencyContact: string | null;
  notes: string | null;
};

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', '모름'];
const HEARING_OPTS = ['정상', '경도이상', '중도이상', '검사전'];

function Inp({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const cls = 'w-full px-3 py-2 rounded-lg border-2 border-line bg-white text-sm focus:outline-none focus:border-accent';

export default function WorkerHealthPage() {
  const [rec, setRec] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    lastCheckupDate: '', bloodPressureSys: '', bloodPressureDia: '',
    heartRate: '', bloodSugar: '', visionLeft: '', visionRight: '',
    hearingLeft: '', hearingRight: '', bloodType: '',
    allergies: '', chronicConditions: '', emergencyContact: '', notes: '',
  });

  function n(v: string) { return v.trim() === '' ? null : Number(v); }
  function s(v: string) { return v.trim() === '' ? null : v.trim(); }

  useEffect(() => {
    fetch('/api/health/my-record')
      .then((r) => r.json())
      .then((d) => {
        const r: Record = d.record;
        if (r) {
          setRec(r);
          setForm({
            lastCheckupDate: r.lastCheckupDate ?? '',
            bloodPressureSys: r.bloodPressureSys != null ? String(r.bloodPressureSys) : '',
            bloodPressureDia: r.bloodPressureDia != null ? String(r.bloodPressureDia) : '',
            heartRate: r.heartRate != null ? String(r.heartRate) : '',
            bloodSugar: r.bloodSugar != null ? String(r.bloodSugar) : '',
            visionLeft: r.visionLeft != null ? String(r.visionLeft) : '',
            visionRight: r.visionRight != null ? String(r.visionRight) : '',
            hearingLeft: r.hearingLeft ?? '',
            hearingRight: r.hearingRight ?? '',
            bloodType: r.bloodType ?? '',
            allergies: r.allergies ?? '',
            chronicConditions: r.chronicConditions ?? '',
            emergencyContact: r.emergencyContact ?? '',
            notes: r.notes ?? '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true); setError(null); setSuccess(false);
    const r = await fetch('/api/health/my-record', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lastCheckupDate: s(form.lastCheckupDate),
        bloodPressureSys: n(form.bloodPressureSys),
        bloodPressureDia: n(form.bloodPressureDia),
        heartRate: n(form.heartRate),
        bloodSugar: n(form.bloodSugar),
        visionLeft: form.visionLeft.trim() !== '' ? parseFloat(form.visionLeft) : null,
        visionRight: form.visionRight.trim() !== '' ? parseFloat(form.visionRight) : null,
        hearingLeft: s(form.hearingLeft),
        hearingRight: s(form.hearingRight),
        bloodType: s(form.bloodType),
        allergies: s(form.allergies),
        chronicConditions: s(form.chronicConditions),
        emergencyContact: s(form.emergencyContact),
        notes: s(form.notes),
      }),
    });
    setSaving(false);
    if (r.ok) { setSuccess(true); setTimeout(() => setSuccess(false), 3000); }
    else { const j = await r.json().catch(() => ({})); setError(j.error ?? '저장 실패'); }
  }

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  if (loading) return <div className="px-4 py-16 text-center text-sm text-slate-500">로딩 중…</div>;

  return (
    <div className="px-3 py-4 pb-24 space-y-5 max-w-lg mx-auto">
      <div>
        <h2 className="text-base font-black text-ink tracking-tight">건강검진 기록</h2>
        <p className="text-xs text-ink-muted mt-0.5">본인의 건강검진 결과를 직접 입력합니다. 데이터는 암호화 저장됩니다.</p>
      </div>

      {/* 검진일 */}
      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide">검진 정보</div>
        <Inp label="최근 검진일">
          <input type="date" value={form.lastCheckupDate} onChange={set('lastCheckupDate')} className={cls} />
        </Inp>
        <Inp label="혈액형">
          <select value={form.bloodType} onChange={set('bloodType')} className={cls + ' bg-white'}>
            <option value="">선택</option>
            {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Inp>
      </div>

      {/* 혈압·맥박·혈당 */}
      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide">혈압 · 맥박 · 혈당</div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="수축기 혈압 (mmHg)">
            <input type="number" value={form.bloodPressureSys} onChange={set('bloodPressureSys')} placeholder="예: 120" className={cls} />
          </Inp>
          <Inp label="이완기 혈압 (mmHg)">
            <input type="number" value={form.bloodPressureDia} onChange={set('bloodPressureDia')} placeholder="예: 80" className={cls} />
          </Inp>
          <Inp label="맥박 (bpm)">
            <input type="number" value={form.heartRate} onChange={set('heartRate')} placeholder="예: 72" className={cls} />
          </Inp>
          <Inp label="공복혈당 (mg/dL)">
            <input type="number" value={form.bloodSugar} onChange={set('bloodSugar')} placeholder="예: 95" className={cls} />
          </Inp>
        </div>
      </div>

      {/* 시력·청력 */}
      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide">시력 · 청력</div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="시력 좌">
            <input type="number" step="0.1" min="0" max="2.5" value={form.visionLeft} onChange={set('visionLeft')} placeholder="예: 1.2" className={cls} />
          </Inp>
          <Inp label="시력 우">
            <input type="number" step="0.1" min="0" max="2.5" value={form.visionRight} onChange={set('visionRight')} placeholder="예: 1.0" className={cls} />
          </Inp>
          <Inp label="청력 좌">
            <select value={form.hearingLeft} onChange={set('hearingLeft')} className={cls + ' bg-white'}>
              <option value="">선택</option>
              {HEARING_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Inp>
          <Inp label="청력 우">
            <select value={form.hearingRight} onChange={set('hearingRight')} className={cls + ' bg-white'}>
              <option value="">선택</option>
              {HEARING_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Inp>
        </div>
      </div>

      {/* 기저질환·알레르기·비상연락 */}
      <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
        <div className="text-xs font-extrabold text-ink-muted uppercase tracking-wide">병력 · 비상연락</div>
        <Inp label="알레르기">
          <textarea rows={2} value={form.allergies} onChange={set('allergies')} placeholder="예: 땅콩, 항생제" className={cls + ' resize-none'} />
        </Inp>
        <Inp label="만성질환 / 기저질환">
          <textarea rows={2} value={form.chronicConditions} onChange={set('chronicConditions')} placeholder="예: 고혈압, 당뇨" className={cls + ' resize-none'} />
        </Inp>
        <Inp label="비상연락처">
          <input type="tel" value={form.emergencyContact} onChange={set('emergencyContact')} placeholder="010-0000-0000 (보호자)" className={cls} />
        </Inp>
        <Inp label="기타 메모">
          <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="복용 중인 약 등" className={cls + ' resize-none'} />
        </Inp>
      </div>

      {error && <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 font-bold">{error}</div>}
      {success && <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-bold">저장되었습니다.</div>}

      {rec && rec.lastCheckupDate && (
        <div className="text-[0.6875rem] text-ink-muted font-semibold px-1">
          최근 수정: 검진일 {rec.lastCheckupDate}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
        {saving ? '저장 중…' : '저장'}
      </button>
    </div>
  );
}
