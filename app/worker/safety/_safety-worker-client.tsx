'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { WeatherSnapshot } from '@/lib/weather';
import SignaturePad from './_signature-pad';
import { useToast } from '@/components/ui/Toast';
import { hapticSuccess, hapticError, hapticHeavy } from '@/lib/haptics';

type ChecklistDef = { key: string; label: string };
type ItemState = ChecklistDef & { ok: boolean };
type TbmInfo = { id: string; topic: string; content: string | null; signed: boolean; signCount: number };
export type FacilityOption = { id: string; name: string };

const ICONS: Record<string, string> = {
  helmet: '🪖', vest: '🦺', glove: '🧤', shoes: '👢',
  tire: '🛞', brake: '🔦', lift: '⚙️',
};

export default function SafetyWorkerClient({
  checklistDef,
  submitted,
  submittedAt,
  allChecked,
  tbm: tbmProp,
  weather,
  guardian,
  isAvac = false,
  facilities = [],
  isFacilityOperator = false,
  operatorFacility = null,
}: {
  checklistDef: ChecklistDef[];
  submitted: boolean;
  submittedAt: string | null;
  allChecked: boolean;
  tbm: TbmInfo | null;
  weather: WeatherSnapshot;
  guardian: { name: string | null; phone: string | null };
  isAvac?: boolean;
  facilities?: FacilityOption[];
  isFacilityOperator?: boolean;
  operatorFacility?: FacilityOption | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<ItemState[]>(checklistDef.map((d) => ({ ...d, ok: false })));
  const [busy, setBusy] = useState(false);
  const [reportType, setReportType] = useState<'NEAR_MISS' | 'INCIDENT' | null>(null);
  const [severity, setSeverity] = useState<'MINOR' | 'INJURY' | 'SEVERE' | 'FATAL'>('MINOR');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [sosArmed, setSosArmed] = useState(false);
  const [sosResult, setSosResult] = useState<{ recipients: number; reportId: string; provider: string } | null>(null);
  const [tbmSignaturePad, setTbmSignaturePad] = useState<string | null>(null);
  const [tbmShowPad, setTbmShowPad] = useState(false);

  // AVAC: 시설 선택 + 동적 TBM + 공지 로드
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    isAvac && facilities.length === 1 ? facilities[0].id : null
  );
  const [avacTbm, setAvacTbm] = useState<TbmInfo | null>(null);
  const [avacTbmLoading, setAvacTbmLoading] = useState(false);
  const [avacNotices, setAvacNotices] = useState<{ id: string; title: string; body: string; severity: string; pinned: boolean }[]>([]);

  const tbm = isAvac ? avacTbm : tbmProp;

  async function loadAvacTbm(facilityId: string) {
    setAvacTbmLoading(true);
    setAvacTbm(null);
    try {
      const res = await fetch(`/api/tbm/today?facilityId=${facilityId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        setAvacTbm({
          id: data.session.id,
          topic: data.session.topic,
          content: data.session.content,
          signed: data.signed,
          signCount: data.session.signCount,
        });
      }
    } finally {
      setAvacTbmLoading(false);
    }
  }

  async function loadAvacNotices(facilityId: string) {
    const res = await fetch(`/api/announcements?facilityId=${facilityId}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json();
    setAvacNotices(data.items ?? []);
  }

  function selectFacility(fId: string) {
    setSelectedFacilityId(fId);
    setTbmShowPad(false);
    setTbmSignaturePad(null);
    loadAvacTbm(fId);
    loadAvacNotices(fId);
  }

  // 시설 담당자: TBM 작성 폼 상태
  const [opTbmTopic, setOpTbmTopic] = useState('');
  const [opTbmContent, setOpTbmContent] = useState('');
  const [opTbmSaving, setOpTbmSaving] = useState(false);

  async function saveTbm() {
    if (!operatorFacility || !opTbmTopic.trim()) return;
    setOpTbmSaving(true);
    try {
      const res = await fetch('/api/tbm/today', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: opTbmTopic.trim(), content: opTbmContent.trim() || undefined, facilityId: operatorFacility.id }),
      });
      if (res.ok) {
        setOpTbmTopic(''); setOpTbmContent('');
        router.refresh();
      } else {
        alert('TBM 저장 실패');
      }
    } finally {
      setOpTbmSaving(false);
    }
  }

  // 시설 1개면 자동 로드
  useEffect(() => {
    if (isAvac && facilities.length === 1) {
      selectFacility(facilities[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkedCount = items.filter((i) => i.ok).length;

  function toggle(key: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ok: !i.ok } : i)));
  }

  async function submitChecklist() {
    setBusy(true);
    
    
    try {
      const res = await fetch('/api/safety/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: 'DAILY_CHECKLIST', checklistItems: items }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(translate(data?.error) ?? '제출 실패');
        return;
      }
      hapticSuccess();
      toast.success(`일일 점검 제출 완료 (${checkedCount}/${items.length})`);
      router.refresh();
    } catch {
      toast.error('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function submitIncident() {
    if (description.trim().length < 5) {
      toast.error('상세 내용을 5자 이상 입력해 주세요.');
      return;
    }
    setBusy(true);
    
    
    try {
      const res = await fetch('/api/safety/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          severity: reportType === 'INCIDENT' ? severity : 'NONE',
          description: description.trim(),
          locationAddress: address.trim() || undefined,
          occurredAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(translate(data?.error) ?? '제출 실패');
        return;
      }
      const deadline = data.report?.molDeadline;
      hapticSuccess();
      toast.success(
        reportType === 'INCIDENT'
          ? `재해 보고 접수 #${data.report.id}${deadline ? ` (MOL 기한 ${new Date(deadline).toLocaleString('ko-KR')})` : ''}`
          : `아차사고 보고 접수 #${data.report.id}`,
        5000
      );
      setDescription('');
      setAddress('');
      setReportType(null);
      router.refresh();
    } catch {
      toast.error('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function fireSos() {
    setBusy(true);
    
    
    try {
      const body: Record<string, unknown> = { description: '워커앱 SOS 버튼 발신' };
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          body.locationLat = pos.coords.latitude;
          body.locationLng = pos.coords.longitude;
        } catch { /* GPS 실패해도 SOS 발신 */ }
      }
      const res = await fetch('/api/safety/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'SOS 발신 실패');
        return;
      }
      hapticHeavy();
      setSosResult({
        recipients: data.notification.recipientsNotified,
        reportId: data.reportId,
        provider: data.notification.provider,
      });
      toast.success(`긴급 SOS 발신 완료 — ${data.notification.recipientsNotified}곳 알림`, 5000);
      setSosArmed(false);
      router.refresh();
    } catch {
      toast.error('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function signTbm() {
    if (!tbmSignaturePad) {
      toast.error('서명을 먼저 그려주세요.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { signatureData: tbmSignaturePad };
      if (isAvac && selectedFacilityId) body.facilityId = selectedFacilityId;
      const res = await fetch('/api/tbm/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error === 'already_signed' ? '이미 서명했습니다.' : (data?.error === 'no_session_today' ? '오늘 TBM 세션이 등록되지 않았습니다.' : '서명 실패'));
        return;
      }
      toast.success(`✓ TBM 서명 완료 — "${data.sessionTopic}"`);
      setTbmSignaturePad(null);
      setTbmShowPad(false);
      if (isAvac && selectedFacilityId) {
        await loadAvacTbm(selectedFacilityId);
      } else {
        router.refresh();
      }
    } catch {
      toast.error('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="px-1">
        <h1 className="text-2xl font-black text-ink">산업안전보건</h1>
        {/* P1: 12px → 14px (text-sm), 시니어 가독성 */}
        <p className="text-sm font-semibold text-ink-mid mt-1">출근 직후 일일 체크리스트와 TBM 서명을 완료해 주세요.</p>
      </div>

      {/* 인라인 에러/성공 배너 → Toast (Wave 3-C) */}

      {/* 기상 카드 — 위험도별 색상 */}
      <WeatherCard w={weather} />

      {/* AVAC: 시설 선택 (2개 이상일 때만 표시. 1개면 자동 선택) */}
      {isAvac && facilities.length > 1 && (
        <section className="bg-surface rounded-xl border-2 border-indigo-200 shadow-card overflow-hidden">
          <header className="px-4 py-3 bg-indigo-50 border-b-2 border-indigo-200">
            <div className="text-base font-extrabold text-indigo-900">🏗 담당 시설 선택</div>
            <div className="text-sm font-semibold text-indigo-700 mt-0.5">오늘 근무할 집하장을 선택하면 해당 시설의 TBM을 불러옵니다.</div>
          </header>
          <div className="p-3 grid grid-cols-2 gap-2">
            {facilities.map((f) => (
              <button
                key={f.id}
                onClick={() => selectFacility(f.id)}
                className={`min-h-12 px-3 py-2.5 rounded-lg border-2 text-sm font-extrabold transition active:scale-95 text-center ${
                  selectedFacilityId === f.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-surface border-line text-ink hover:border-indigo-400'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* AVAC + 시설 미선택 안내 */}
      {isAvac && !selectedFacilityId && facilities.length > 1 && (
        <section className="bg-indigo-50 border-2 border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-800 font-semibold">
          위에서 담당 시설을 선택하면 TBM 세션을 확인할 수 있습니다.
        </section>
      )}

      {/* AVAC TBM 로딩 중 */}
      {isAvac && selectedFacilityId && avacTbmLoading && (
        <section className="bg-surface rounded-xl border border-line px-4 py-6 text-center text-sm text-ink-mid font-semibold">
          TBM 세션 불러오는 중…
        </section>
      )}

      {/* TBM 서명판 */}
      {(!isAvac || (selectedFacilityId && !avacTbmLoading)) && tbm ? (
        <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
          <header className="px-4 py-3 bg-surface-soft border-b-2 border-line flex items-center gap-2">
            <span className="text-xl">📋</span>
            <div className="flex-1">
              <div className="text-base font-extrabold text-ink">오늘 TBM (안전교육)</div>
              <div className="text-sm font-semibold text-ink-mid mt-0.5">{tbm.signCount}명 서명 완료</div>
            </div>
            {tbm.signed && <span className="px-3 py-1 rounded-full text-sm font-mono font-extrabold bg-green-100 text-success border-2 border-green-300">✓ 서명 완료</span>}
          </header>
          <div className="p-4">
            <div className="text-lg font-extrabold text-ink mb-2">{tbm.topic}</div>
            {tbm.content && <p className="text-base font-semibold text-ink-mid leading-relaxed mb-3 whitespace-pre-wrap">{tbm.content}</p>}
            {!tbm.signed && !tbmShowPad && (
              /* P1: CTA 14px → 16px (text-base) min-h-14 */
              <button
                onClick={() => setTbmShowPad(true)}
                className="w-full min-h-14 py-3 rounded-lg bg-info text-white text-base font-black shadow-card active:scale-[0.98]"
              >
                ✍ TBM 서명하기
              </button>
            )}
            {!tbm.signed && tbmShowPad && (
              <div className="space-y-3 mt-2">
                <div className="text-sm font-extrabold text-ink">아래 영역에 서명해 주세요 (마우스/터치 모두 가능)</div>
                <SignaturePad onChange={setTbmSignaturePad} disabled={busy} />
                <div className="flex gap-2">
                  <button
                    onClick={signTbm}
                    disabled={busy || !tbmSignaturePad}
                    className="flex-1 min-h-14 py-3 rounded-lg bg-info text-white text-base font-black shadow-card active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? '제출 중…' : '서명 제출'}
                  </button>
                  <button
                    onClick={() => { setTbmShowPad(false); setTbmSignaturePad(null); }}
                    className="min-h-14 px-4 py-3 rounded-lg border-2 border-line-strong text-ink text-base font-bold active:scale-95"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        // AVAC + 시설 미선택 상태에선 안내 생략 (위에서 별도 표시)
        (!isAvac || (selectedFacilityId && !avacTbmLoading)) && (
          <section className="bg-amber-50 border-2 border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-sm text-amber-900 font-semibold">
            오늘 TBM 세션이 아직 등록되지 않았습니다. 관리자에게 문의해 주세요.
          </section>
        )
      )}

      {/* AVAC: 집하장별 공지 */}
      {isAvac && selectedFacilityId && avacNotices.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-extrabold text-indigo-800 px-1">🏗 집하장 공지</div>
          {avacNotices.map((n) => (
            <div key={n.id} className={`rounded-xl border-2 px-4 py-3 ${
              n.severity === 'CRITICAL' ? 'bg-red-50 border-red-300' :
              n.severity === 'WARNING'  ? 'bg-amber-50 border-amber-300' :
                                          'bg-indigo-50 border-indigo-200'
            }`}>
              {n.pinned && <span className="text-[0.6875rem] font-extrabold mr-1.5">📌</span>}
              <span className="text-sm font-extrabold text-ink">{n.title}</span>
              {n.body && <p className="text-sm text-ink-mid mt-1 whitespace-pre-wrap leading-relaxed">{n.body}</p>}
            </div>
          ))}
        </section>
      )}

      {/* 일일 체크리스트 */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <header className="px-4 py-3 bg-surface-soft border-b-2 border-line flex items-center justify-between">
          <div className="text-base font-extrabold text-ink">일일 체크리스트</div>
          <span className="text-sm font-mono font-extrabold text-ink-mid">{checkedCount} / {items.length}</span>
        </header>
        {submitted && (
          <div className="px-4 py-3 bg-green-50 border-b border-success">
            <div className="text-sm font-extrabold text-success">
              ✓ 오늘 점검 제출 완료 {submittedAt && '— ' + new Date(submittedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              {!allChecked && <span className="ml-2 text-warn">(일부 미완료)</span>}
            </div>
          </div>
        )}
        <div className="divide-y divide-line">
          {items.map((item) => (
            <label key={item.key} className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${submitted ? 'opacity-60 pointer-events-none' : 'active:bg-surface-soft'}`}>
              <span className="text-2xl">{ICONS[item.key] ?? '✓'}</span>
              <span className="flex-1 text-sm font-bold text-ink">{item.label}</span>
              <input
                type="checkbox"
                checked={item.ok}
                onChange={() => toggle(item.key)}
                disabled={submitted}
                className="w-5 h-5 rounded accent-success"
              />
            </label>
          ))}
        </div>
        {!submitted && (
          <div className="p-4">
            <button
              onClick={submitChecklist}
              disabled={busy}
              className="w-full py-3 rounded-lg bg-success text-white text-sm font-black shadow-card active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? '제출 중…' : `점검 결과 제출 (${checkedCount}/${items.length})`}
            </button>
          </div>
        )}
      </section>

      {/* 아차사고 / 재해 신고 */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <header className="px-4 py-3 bg-surface-soft border-b-2 border-line">
          <div className="text-base font-extrabold text-ink">아차사고 / 재해 보고</div>
          <div className="text-sm font-semibold text-ink-mid mt-1">위험 상황을 발견했나요? 즉시 보고해 주세요.</div>
        </header>
        <div className="p-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => { setReportType('NEAR_MISS');   }}
            className="min-h-14 px-3 py-3 rounded-lg border-2 border-dashed border-warn text-warn text-base font-extrabold active:scale-[0.98] hover:bg-amber-50 transition text-center leading-tight"
          >
            <div>⚠️ 아차사고</div>
            <div className="underline underline-offset-2 decoration-2 text-sm font-bold mt-1">(위험요소)</div>
          </button>
          <button
            onClick={() => { setReportType('INCIDENT');   }}
            className="min-h-14 px-3 py-3 rounded-lg border-2 border-dashed border-danger text-danger text-base font-extrabold active:scale-[0.98] hover:bg-red-50 transition text-center leading-tight"
          >
            <div>🚨 재해발생</div>
            <div className="underline underline-offset-2 decoration-2 text-sm font-bold mt-1">(사고)</div>
          </button>
        </div>
        {reportType && (
          <div className="px-4 pb-4 space-y-3 border-t border-line pt-4">
            <div className="text-xs font-extrabold text-ink">
              {reportType === 'NEAR_MISS' ? '아차사고 보고' : '재해 발생 보고'}
            </div>
            {reportType === 'INCIDENT' && (
              <>
                <label className="block text-xs font-extrabold text-ink mb-1">심각도</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { v: 'MINOR', label: '경미', color: 'border-info text-info' },
                    { v: 'INJURY', label: '부상', color: 'border-warn text-warn' },
                    { v: 'SEVERE', label: '중상', color: 'border-danger text-danger' },
                    { v: 'FATAL', label: '사망', color: 'border-danger text-danger bg-red-50' },
                  ].map((opt) => (
                    <button key={opt.v} onClick={() => setSeverity(opt.v as 'MINOR' | 'INJURY' | 'SEVERE' | 'FATAL')} className={`px-2 py-2 rounded-md border-2 text-xs font-extrabold ${opt.color} ${severity === opt.v ? 'ring-2 ring-accent ring-offset-1' : ''}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="발생 상황을 구체적으로 기록해 주세요 (5자 이상)" className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="발생 위치" className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent" />
            <div className="flex gap-2">
              <button onClick={submitIncident} disabled={busy || description.trim().length < 5} className={`flex-1 py-3 rounded-lg text-white text-sm font-black shadow-card active:scale-[0.98] disabled:opacity-50 ${reportType === 'INCIDENT' ? 'bg-danger' : 'bg-warn'}`}>
                {busy ? '제출 중…' : '보고 제출'}
              </button>
              <button onClick={() => { setReportType(null); setDescription(''); setAddress('');  }} className="px-4 py-3 rounded-lg border-2 border-line text-ink text-sm font-bold active:scale-95">
                취소
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 119 자동 SOS */}
      <section className="bg-red-50 border-2 border-danger rounded-xl px-4 py-4">
        <div className="text-base font-extrabold text-danger mb-2">🚨 긴급 SOS — 119 자동 발신</div>
        {sosResult && (
          <div className="bg-surface border-2 border-danger rounded-md px-3 py-2 mb-3 text-sm font-bold text-ink">
            ✓ 보고서 #{sosResult.reportId} 생성 · {sosResult.recipients}곳 알림
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-mono font-extrabold ${sosResult.provider === 'SIMULATION' ? 'bg-amber-100 text-warn' : 'bg-green-100 text-success'}`}>
              {sosResult.provider === 'SIMULATION' ? 'SIMULATION' : `provider=${sosResult.provider}`}
            </span>
          </div>
        )}
        {!sosArmed ? (
          <button onClick={() => setSosArmed(true)} className="w-full min-h-14 py-4 rounded-xl bg-danger text-white text-xl font-black shadow-card active:scale-[0.98]">
            🚨 SOS 버튼
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-base text-danger font-extrabold">정말 긴급 SOS를 발신하시겠습니까?</p>
            <p className="text-sm text-ink-mid font-semibold leading-relaxed">위탁업체 매니저 + 119(시뮬레이션)에 즉시 알림이 발송되며, SafetyReport(중상)가 자동 생성됩니다.</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={fireSos} disabled={busy} className="min-h-14 py-3.5 rounded-lg bg-danger text-white text-base font-black shadow-card active:scale-[0.98] disabled:opacity-50">
                {busy ? '발신 중…' : '🚨 발신 확정'}
              </button>
              <button onClick={() => setSosArmed(false)} className="min-h-14 py-3.5 rounded-lg border-2 border-line-strong text-ink text-base font-bold active:scale-95">
                취소
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── 시설 담당자 전용 섹션 ── */}
      {isFacilityOperator && operatorFacility && (
        <>
          {/* TBM 작성 카드 */}
          <section className="bg-surface rounded-xl border-2 border-indigo-300 shadow-card overflow-hidden">
            <header className="px-4 py-3 bg-indigo-50 border-b-2 border-indigo-200">
              <div className="text-base font-extrabold text-indigo-800">🏭 TBM 작성 — {operatorFacility.name}</div>
              <div className="text-xs text-indigo-600 mt-0.5">시설 담당자 권한 · 오늘의 TBM을 직접 등록합니다</div>
            </header>
            <div className="p-4 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-ink-muted">주제 *</span>
                <input
                  value={opTbmTopic}
                  onChange={(e) => setOpTbmTopic(e.target.value)}
                  placeholder="오늘의 안전 주제를 입력하세요"
                  className="border border-line rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-ink-muted">내용 (선택)</span>
                <textarea
                  value={opTbmContent}
                  onChange={(e) => setOpTbmContent(e.target.value)}
                  rows={3}
                  placeholder="상세 교육 내용 또는 주의사항"
                  className="border border-line rounded px-3 py-2 text-sm resize-none"
                />
              </label>
              <button
                type="button"
                onClick={saveTbm}
                disabled={opTbmSaving || !opTbmTopic.trim()}
                className="w-full py-3 rounded-lg bg-indigo-600 text-white text-sm font-extrabold disabled:opacity-50 active:scale-[0.98]"
              >
                {opTbmSaving ? '저장 중…' : 'TBM 등록'}
              </button>
            </div>
          </section>

        </>
      )}

      {/* 비상연락처 */}
      <section className="bg-surface border border-line rounded-xl px-4 py-3">
        <div className="text-base font-extrabold text-ink mb-2">긴급 비상연락처</div>
        <div className="grid grid-cols-3 gap-2">
          <a href="tel:119" className="bg-surface-alt rounded-lg border-2 border-line py-3 text-center active:scale-95 transition min-h-14 flex flex-col items-center justify-center">
            <div className="font-mono text-lg font-black text-danger">119</div>
            <div className="text-sm font-bold text-ink-mid">소방·구급</div>
          </a>
          <a href="tel:112" className="bg-surface-alt rounded-lg border-2 border-line py-3 text-center active:scale-95 transition min-h-14 flex flex-col items-center justify-center">
            <div className="font-mono text-lg font-black text-info">112</div>
            <div className="text-sm font-bold text-ink-mid">경찰</div>
          </a>
          {guardian.phone ? (
            <a
              href={`tel:${guardian.phone.replace(/[^\d+]/g, '')}`}
              className="bg-warn/10 border-2 border-warn rounded-lg py-3 text-center leading-tight active:scale-95 transition flex flex-col items-center justify-center min-h-14"
              title={`보호자 ${guardian.name ?? ''} ${guardian.phone}`}
            >
              <div className="text-base font-black text-warn">보호자</div>
              <div className="text-sm font-extrabold text-warn mt-0.5 truncate px-1 max-w-full">
                {guardian.name ?? '등록됨'}
              </div>
            </a>
          ) : (
            <a
              href="/worker/profile"
              className="bg-surface-alt rounded-lg border-2 border-dashed border-warn/60 py-3 text-center active:scale-95 transition min-h-14 flex flex-col items-center justify-center"
            >
              <div className="font-mono text-lg font-black text-warn">＋</div>
              <div className="text-sm font-bold text-warn">보호자 등록</div>
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

function WeatherCard({ w }: { w: WeatherSnapshot }) {
  const hazardColor: Record<string, string> = {
    NONE: 'bg-blue-50 border-blue-200 text-info',
    CAUTION: 'bg-amber-50 border-amber-200 text-warn',
    WARN: 'bg-amber-100 border-amber-400 text-warn',
    DANGER: 'bg-red-100 border-danger text-danger animate-pulse',
  };
  return (
    <section className={`rounded-xl border-2 border-l-4 px-4 py-3 ${hazardColor[w.hazardLevel] ?? hazardColor.NONE}`}>
      <div className="flex items-center gap-3">
        <div className="text-3xl">
          {w.condition === 'CLEAR' ? '☀️' : w.condition === 'CLOUDY' ? '⛅' : w.condition === 'RAIN' ? '🌧' : w.condition === 'SNOW' ? '❄️' : '🌪'}
        </div>
        <div className="flex-1">
          <div className="text-xs font-extrabold tracking-widest">{w.region.replace('서울특별시 ', '')} · {w.conditionLabel}</div>
          <div className="font-mono text-2xl font-black tracking-tight">
            {w.temp}°C
            <span className="text-sm font-bold ml-2">체감 {w.feelsLike}°C</span>
          </div>
          <div className="text-xs font-bold mt-0.5 font-mono">
            습도 {w.humidity}% · 풍속 {w.windSpeed}m/s · PM10 {w.pm10}㎍ ({w.pm10Label})
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-extrabold border bg-white/60">
          {w.hazardLabel}
        </span>
      </div>
      {w.hazardLevel !== 'NONE' && (
        <div className="mt-2 pt-2 border-t border-current/20 text-xs font-extrabold">
          ⚠ {w.hazardReason} — {w.workAdvice}
        </div>
      )}
    </section>
  );
}

function translate(code?: string): string | null {
  switch (code) {
    case 'duplicate_daily_report': return '오늘 일일 점검은 이미 제출했습니다.';
    case 'checklist_required': return '체크리스트 항목이 필요합니다.';
    case 'severity_required': return '재해 발생 보고는 심각도 선택이 필수입니다.';
    case 'gps_out_of_range': return 'GPS 좌표가 국내 범위를 벗어났습니다.';
    case 'no_contractor': return '소속 위탁업체가 지정되지 않았습니다.';
    case 'invalid_request': return '입력값이 올바르지 않습니다.';
    default: return null;
  }
}

