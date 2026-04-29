'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatKoreanPhone } from '@/lib/phone';

/* ─── 의료 표준치 평가 (사용자 요청 2026-04-28) ───
   출처:
   - 혈압: 대한고혈압학회 + WHO (성인 일반)
   - 심박수: AHA (안정시)
   - 혈당: 대한당뇨학회 (공복혈당)
   - 시력: 운전면허 적성검사 + 시각장애 등급 기준
   환경미화원 직군 특성: 야외 노동 + 차량 운행 가능성 → 시력/혈압 정상 권장.
*/
type HealthLevel = 'ok' | 'warn' | 'danger' | null;

/** 혈압 평가 — sys/dia mmHg.
 *  ok: 120/80 미만 (정상)
 *  warn: 120-139 / 80-89 (주의 단계 / 고혈압 전단계) 또는 저혈압(< 90/60)
 *  danger: 140/90 이상 (고혈압) 또는 ≥ 160/100 (위험) */
function evalBP(sys: number | null | undefined, dia: number | null | undefined): HealthLevel {
  if (sys == null || dia == null) return null;
  if (sys >= 140 || dia >= 90) return 'danger';
  if (sys >= 120 || dia >= 80) return 'warn';
  if (sys < 90 || dia < 60) return 'warn';
  return 'ok';
}

/** 심박수 평가 — bpm 안정시.
 *  ok: 60-100
 *  warn: 50-59 또는 101-120
 *  danger: < 50 (서맥) 또는 > 120 (빈맥) */
function evalHR(hr: number | null | undefined): HealthLevel {
  if (hr == null) return null;
  if (hr < 50 || hr > 120) return 'danger';
  if (hr < 60 || hr > 100) return 'warn';
  return 'ok';
}

/** 혈당 평가 — mg/dL 공복.
 *  ok: 70-99
 *  warn: 100-125 (공복혈당장애)
 *  danger: < 70 (저혈당) 또는 ≥ 126 (당뇨 진단기준) */
function evalBS(bs: number | null | undefined): HealthLevel {
  if (bs == null) return null;
  if (bs < 70 || bs >= 126) return 'danger';
  if (bs >= 100) return 'warn';
  return 'ok';
}

/** 시력 평가 — 양안 중 낮은 쪽 기준.
 *  ok: ≥ 1.0
 *  warn: 0.5-0.9 (운전 가능 / 교정 권장)
 *  danger: < 0.5 (운전제한 / 정밀검진 필요) */
function evalVision(vl: number | null | undefined, vr: number | null | undefined): HealthLevel {
  if (vl == null || vr == null) return null;
  const min = Math.min(vl, vr);
  if (min < 0.5) return 'danger';
  if (min < 1.0) return 'warn';
  return 'ok';
}

/* ─── 긴급 비상연락처 — 관계/이름/전화 분리 (사용자 요청 2026-04-28) ───
   DB 스키마 변경 없이 단일 string 컬럼(emergencyContact)에 ` | ` 구분자로 직렬화.
   기존 legacy 포맷("배우자 010-0000-0000" 등) 자동 파싱. */
const EMERGENCY_RELATIONS = ['배우자', '자녀', '부모', '형제', '기타'] as const;

function parseEmergencyContact(s: string | null | undefined): { rel: string; name: string; phone: string } {
  if (!s) return { rel: '', name: '', phone: '' };
  /* 신 포맷: "관계 | 이름 | 전화" */
  if (s.includes('|')) {
    const parts = s.split('|').map((p) => p.trim());
    return { rel: parts[0] ?? '', name: parts[1] ?? '', phone: parts[2] ?? '' };
  }
  /* Legacy: 첫 단어가 관계인지 판단 + 끝부분 전화번호 추출 */
  for (const rel of EMERGENCY_RELATIONS) {
    if (s.startsWith(rel + ' ') || s.startsWith(rel + '\t')) {
      const rest = s.slice(rel.length).trim();
      const phoneMatch = rest.match(/[\d-]+\s*$/);
      if (phoneMatch) {
        const phone = phoneMatch[0].trim();
        const name = rest.slice(0, rest.length - phoneMatch[0].length).trim();
        return { rel, name, phone };
      }
      return { rel, name: '', phone: rest };
    }
  }
  /* 알 수 없는 포맷: 전화 칸에 통째 (사용자가 수정 시 정규화됨) */
  return { rel: '', name: '', phone: s };
}

function formatEmergencyContact(rel: string, name: string, phone: string): string | null {
  const r = rel.trim(), n = name.trim(), p = phone.trim();
  if (!r && !n && !p) return null;
  return `${r} | ${n} | ${p}`;
}

/** 행 단위 요약 — 최악 레벨 반환 (danger > warn > ok). */
function evalRow(rec: Record | null): HealthLevel {
  if (!rec) return null;
  const levels: HealthLevel[] = [
    evalBP(rec.bloodPressureSys, rec.bloodPressureDia),
    evalHR(rec.heartRate),
    evalBS(rec.bloodSugar),
    evalVision(rec.visionLeft, rec.visionRight),
  ];
  if (levels.includes('danger')) return 'danger';
  if (levels.includes('warn')) return 'warn';
  if (levels.every((l) => l === null)) return null;
  return 'ok';
}

/** 레벨별 셀 스타일 — 사용자 피드백 2026-04-28: 폰트 weight 통일(font-bold), 색상만으로 상태 전달.
    이전 font-black/extrabold 혼재 + ⚠/△ 유니코드 마커는 주변 셀과 톤이 안 맞아 제거. */
function levelClass(lv: HealthLevel): string {
  if (lv === 'danger') return 'text-danger font-bold';
  if (lv === 'warn') return 'text-warn font-bold';
  return 'text-ink font-bold';
}

export type Record = {
  lastCheckupDate: string | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  bloodSugar: number | null;
  visionLeft: number | null;
  visionRight: number | null;
  hearingLeft: string | null;
  hearingRight: string | null;
  bloodType: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  emergencyContact: string | null;
  notes: string | null;
};

export type Row = {
  workerId: string;
  workerName: string;
  employeeNo: string | null;
  record: Record | null;
};

export default function HealthClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledCount = rows.filter((r) => r.record).length;
  /* 요주의 집계 — 시각화 우선순위 (danger > warn). */
  const dangerCount = rows.filter((r) => evalRow(r.record) === 'danger').length;
  const warnCount = rows.filter((r) => evalRow(r.record) === 'warn').length;

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">건강기록카드 관리</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">
            Plan §3-4 · 의료 정보 — 위탁업체 관리자만 조회 · 모든 접근 audit 기록
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-cyan-50 text-accent border border-accent">
            기록 {filledCount} / {rows.length}명
          </span>
          {dangerCount > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-red-50 text-danger border border-red-300">
              위험 {dangerCount}명
            </span>
          )}
          {warnCount > 0 && (
            <span className="px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-50 text-warn border border-amber-300">
              주의 {warnCount}명
            </span>
          )}
        </div>
      </header>

      <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed">
        <strong className="font-extrabold">개인정보보호법 §28 안내</strong> · 본 화면 접근 및 모든 변경은 audit_log에 영구 기록됩니다. 운영 단계에서는 컬럼 단위 AES-256 암호화 + 보존 기간 후 자동 폐기가 적용됩니다.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
      )}

      {/* 사용자 요청 2026-04-28: 최근 검진일 + 비상연락 컬럼 리스트에서 숨김 →
          개인 이름 클릭 시 직원정보 모달(HealthFormModal)에 표시. 리스트는 의료 핵심 지표만. */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[0.8125rem]">
          <thead>
            <tr>
              {['근로자', '혈압', '심박', '혈당', '시력', '혈액형', '알레르기', '액션'].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide text-ink bg-surface-soft border-b-2 border-line-strong font-mono whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              /* 셀별 표준치 평가 (사용자 요청 2026-04-28). */
              const bpLv = evalBP(r.record?.bloodPressureSys, r.record?.bloodPressureDia);
              const hrLv = evalHR(r.record?.heartRate);
              const bsLv = evalBS(r.record?.bloodSugar);
              const vsLv = evalVision(r.record?.visionLeft, r.record?.visionRight);
              const rowLv = evalRow(r.record);
              return (
              <tr key={r.workerId} className={i % 2 === 1 ? 'bg-surface-soft' : ''}>
                <td className="px-3 py-2.5 border-b border-line">
                  {/* 사용자 요청 2026-04-29: 이름과 배지 한 줄 표시 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setEditing(r); setError(null); }}
                      className="text-left font-extrabold text-ink hover:text-accent hover:underline underline-offset-2 active:text-cyan-800 transition-colors"
                      aria-label={`${r.workerName} 직원정보 보기`}
                    >
                      {r.workerName}
                    </button>
                    {rowLv === 'danger' && (
                      <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-red-50 text-danger border border-red-300" title="표준치 위험 항목 있음">
                        위험
                      </span>
                    )}
                    {rowLv === 'warn' && (
                      <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-warn border border-amber-300" title="표준치 주의 항목 있음">
                        주의
                      </span>
                    )}
                  </div>
                </td>
                <td className={`px-3 py-2.5 border-b border-line font-mono ${levelClass(bpLv)}`} title="정상 < 120/80 · 주의 120-139/80-89 · 위험 ≥ 140/90 (대한고혈압학회)">
                  {r.record?.bloodPressureSys && r.record?.bloodPressureDia
                    ? `${r.record.bloodPressureSys}/${r.record.bloodPressureDia}`
                    : <span className="text-ink-faint">—</span>}
                </td>
                <td className={`px-3 py-2.5 border-b border-line font-mono ${levelClass(hrLv)}`} title="정상 60-100 bpm · 주의 50-59 / 101-120 · 위험 < 50 또는 > 120 (AHA 안정시)">
                  {r.record?.heartRate != null
                    ? r.record.heartRate
                    : <span className="text-ink-faint">—</span>}
                </td>
                <td className={`px-3 py-2.5 border-b border-line font-mono ${levelClass(bsLv)}`} title="정상 70-99 mg/dL · 주의 100-125 (공복혈당장애) · 위험 < 70 또는 ≥ 126 (대한당뇨학회 공복)">
                  {r.record?.bloodSugar != null
                    ? r.record.bloodSugar
                    : <span className="text-ink-faint">—</span>}
                </td>
                <td className={`px-3 py-2.5 border-b border-line font-mono ${levelClass(vsLv)}`} title="정상 ≥ 1.0 · 주의 0.5-0.9 (운전 가능) · 위험 < 0.5 (운전 제한)">
                  {r.record?.visionLeft != null && r.record?.visionRight != null
                    ? `${r.record.visionLeft.toFixed(1)}/${r.record.visionRight.toFixed(1)}`
                    : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line font-mono font-bold text-ink">
                  {r.record?.bloodType ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line text-xs">
                  {r.record?.allergies ? <span className="text-warn font-bold">⚠ 있음</span> : <span className="text-ink-faint">없음</span>}
                </td>
                <td className="px-3 py-2.5 border-b border-line">
                  {/* 사용자 요청 2026-04-28: 버튼 통일 — record 유무 무관 동일 스타일/라벨. */}
                  <button
                    onClick={() => { setEditing(r); setError(null); }}
                    className="px-3 py-1.5 rounded-md text-xs font-extrabold border-2 border-accent text-accent hover:bg-accent hover:text-white transition active:scale-95"
                  >
                    조회/수정
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {editing && (
        <HealthFormModal
          row={editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (body) => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(`/api/health/records/${editing.workerId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              const data = await res.json();
              if (!res.ok) {
                setError(data?.error ?? '저장 실패');
                return false;
              }
              setEditing(null);
              router.refresh();
              return true;
            } catch {
              setError('네트워크 오류');
              return false;
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}
    </div>
  );
}

function HealthFormModal({
  row,
  onCancel,
  onSubmit,
  busy,
}: {
  row: Row;
  onCancel: () => void;
  onSubmit: (body: object) => Promise<boolean>;
  busy: boolean;
}) {
  const r = row.record ?? {} as Partial<Record>;
  const [lastCheckupDate, setLastCheckupDate] = useState(r.lastCheckupDate ?? '');
  const [bps, setBps] = useState(r.bloodPressureSys != null ? String(r.bloodPressureSys) : '');
  const [bpd, setBpd] = useState(r.bloodPressureDia != null ? String(r.bloodPressureDia) : '');
  const [hr, setHr] = useState(r.heartRate != null ? String(r.heartRate) : '');
  const [bs, setBs] = useState(r.bloodSugar != null ? String(r.bloodSugar) : '');
  /* 시력은 항상 소수점 1자리 — 사용자 요청 2026-04-28 */
  const [vl, setVl] = useState(r.visionLeft != null ? r.visionLeft.toFixed(1) : '');
  const [vr, setVr] = useState(r.visionRight != null ? r.visionRight.toFixed(1) : '');
  const [bt, setBt] = useState(r.bloodType ?? '');
  const [allergies, setAllergies] = useState(r.allergies ?? '');
  const [chronic, setChronic] = useState(r.chronicConditions ?? '');
  /* 긴급 비상연락처 — 관계 / 이름 / 전화 3분할 (사용자 요청 2026-04-28). */
  const initialEmergency = parseEmergencyContact(r.emergencyContact);
  const [emRel, setEmRel] = useState(initialEmergency.rel);
  const [emName, setEmName] = useState(initialEmergency.name);
  const [emPhone, setEmPhone] = useState(initialEmergency.phone);
  const [notes, setNotes] = useState(r.notes ?? '');

  async function save() {
    await onSubmit({
      lastCheckupDate: lastCheckupDate || null,
      bloodPressureSys: bps ? Number(bps) : null,
      bloodPressureDia: bpd ? Number(bpd) : null,
      heartRate: hr ? Number(hr) : null,
      bloodSugar: bs ? Number(bs) : null,
      visionLeft: vl ? Number(vl) : null,
      visionRight: vr ? Number(vr) : null,
      bloodType: bt || null,
      allergies: allergies || null,
      chronicConditions: chronic || null,
      /* 3분할 → 단일 string 직렬화 (DB 스키마 무변경) */
      emergencyContact: formatEmergencyContact(emRel, emName, emPhone),
      notes: notes || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={onCancel}>
      <div className="w-full max-w-[600px] bg-surface rounded-xl shadow-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 bg-surface-soft border-b-2 border-line">
          <h3 className="text-base font-extrabold text-ink">건강기록 — {row.workerName}</h3>
          <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">사번 {row.employeeNo ?? '—'} · 의료 정보 (audit 기록됨)</div>
        </header>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="최근 건강검진일">
              <input type="date" value={lastCheckupDate} onChange={(e) => setLastCheckupDate(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="혈액형">
              <select value={bt} onChange={(e) => setBt(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="">— 선택 —</option>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="혈압 수축기 (mmHg)">
              <input type="number" min={50} max={250} value={bps} onChange={(e) => setBps(e.target.value)} placeholder="120" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="혈압 이완기 (mmHg)">
              <input type="number" min={30} max={180} value={bpd} onChange={(e) => setBpd(e.target.value)} placeholder="80" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="심박수 (bpm)">
              <input type="number" min={30} max={220} value={hr} onChange={(e) => setHr(e.target.value)} placeholder="72" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="혈당 (mg/dL)">
              <input type="number" min={40} max={600} value={bs} onChange={(e) => setBs(e.target.value)} placeholder="95" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent" />
            </Field>
            <Field label="시력 (좌)">
              {/* 입력 종료 시 소수점 1자리로 정규화 — 사용자가 "1" 입력해도 "1.0" 으로 표시 */}
              <input
                type="number" step="0.1" min={0} max={2.5}
                value={vl}
                onChange={(e) => setVl(e.target.value)}
                onBlur={(e) => { const v = e.target.value; if (v) setVl(parseFloat(v).toFixed(1)); }}
                placeholder="1.0"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
            <Field label="시력 (우)">
              <input
                type="number" step="0.1" min={0} max={2.5}
                value={vr}
                onChange={(e) => setVr(e.target.value)}
                onBlur={(e) => { const v = e.target.value; if (v) setVr(parseFloat(v).toFixed(1)); }}
                placeholder="1.0"
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </Field>
          </div>
          <Field label="긴급 비상연락처">
            {/* 관계 / 이름 / 전화 한 줄 3분할 — 균등 폭 (사용자 피드백 2026-04-28) */}
            <div className="grid grid-cols-3 gap-2">
              <select
                value={emRel}
                onChange={(e) => setEmRel(e.target.value)}
                className="px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent"
                aria-label="관계"
              >
                <option value="">— 관계 —</option>
                {EMERGENCY_RELATIONS.map((rel) => (
                  <option key={rel} value={rel}>{rel}</option>
                ))}
              </select>
              <input
                type="text"
                value={emName}
                onChange={(e) => setEmName(e.target.value)}
                placeholder="이름"
                aria-label="이름"
                className="px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent"
              />
              <input
                type="tel"
                inputMode="numeric"
                value={emPhone}
                onChange={(e) => setEmPhone(formatKoreanPhone(e.target.value))}
                placeholder="010-0000-0000"
                aria-label="전화번호"
                maxLength={13}
                className="px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent"
              />
            </div>
          </Field>
          <Field label="알레르기">
            <textarea rows={2} value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="페니실린 / 갑각류 등" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Field label="만성질환">
            <textarea rows={2} value={chronic} onChange={(e) => setChronic(e.target.value)} placeholder="고혈압 / 당뇨 등" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
          </Field>
          <Field label="비고">
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
          </Field>
        </div>
        <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2 sticky bottom-0">
          <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
          <button onClick={save} disabled={busy} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
            {busy ? '저장 중…' : '저장'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// Design Ref: field-label-refactor §2 — shared Field로 통합
import { Field as BaseField } from '@/components/Field';
type FieldArgs = React.ComponentProps<typeof BaseField>;
function Field(props: FieldArgs) {
  return <BaseField {...props} labelClassName={props.labelClassName ?? 'block text-[0.6875rem] font-extrabold text-ink mb-1.5 tracking-wide'} />;
}
