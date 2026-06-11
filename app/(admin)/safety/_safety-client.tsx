'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { todayLocalStr } from '@/lib/dates';
import type { ChecklistItem as BaseChecklistItem } from '@/lib/safety';
type ChecklistItem = BaseChecklistItem & { reason?: string };
import type { WeatherSnapshot } from '@/lib/weather';
import WeatherAlertCard, { type WorkerOpt } from './_weather-alert';

type TbmInfo = {
  id: string; topic: string; content: string | null; photoDataUrl: string | null;
  leader: string | null; location: string | null; hazards: string | null;
  department: string | null; signCount: number; createdBy: string;
  signedWorkers: Array<{ id: string; name: string; employeeNo: string | null }>;
  unsignedWorkers: Array<{ id: string; name: string; employeeNo: string | null }>;
};

export type Row = {
  id: string;
  reportType: string;
  severity: string;
  reportDate: string;
  occurredAt: string | null;
  description: string | null;
  locationAddress: string | null;
  allChecked: boolean;
  checklistItems: ChecklistItem[] | null;
  status: string;
  reviewNote: string | null;
  molDeadline: string | null;
  molReportedAt: string | null;
  reportedAt: string;
  reporter: string;
  reviewer: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  DAILY_CHECKLIST: '일일점검',
  NEAR_MISS: '아차사고',
  INCIDENT: '재해 발생',
  TBM_SIGNATURE: 'TBM 서명',
};
const SEV_LABEL: Record<string, string> = {
  NONE: '일반', MINOR: '경미', INJURY: '부상', SEVERE: '중상', FATAL: '사망',
};
const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '접수', REVIEWED: '검토 완료', MOL_REPORTED: '지자체 보고 완료', RESOLVED: '종결',
};

type Tab = 'ALL' | 'INCIDENT' | 'NEAR_MISS' | 'CHECKLIST' | 'PENDING' | 'DAILY' | 'ABNORMAL';

export type ContractorOpt = { id: string; name: string };

export default function SafetyClient({
  rows,
  isManager,
  todayWorkers,
  todayChecklist,
  weather,
  tbm,
  alertWorkers,
  meName,
  meSignatureUrl,
  defaultTab = 'ALL',
  hasNearMiss = true,
  hasIncident = true,
  contractorOpts = [],
  selectedContractorId = '',
  from: initFrom = '',
  to: initTo = '',
}: {
  rows: Row[];
  isManager: boolean;
  todayWorkers: number;
  todayChecklist: number;
  weather: WeatherSnapshot;
  tbm: TbmInfo | null;
  alertWorkers: WorkerOpt[];
  meName: string | null;
  meSignatureUrl: string | null;
  defaultTab?: Tab;
  hasNearMiss?: boolean;
  hasIncident?: boolean;
  contractorOpts?: ContractorOpt[];
  selectedContractorId?: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [dateFrom, setDateFrom] = useState(initFrom);
  const [dateTo, setDateTo]   = useState(initTo);

  function navigateSafety(from: string, to: string, cid?: string) {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to)   p.set('to', to);
    const c = cid !== undefined ? cid : selectedContractorId;
    if (c) p.set('contractorId', c);
    router.push(`/safety?${p.toString()}`);
  }

  function quickRange(kind: 'thisMonth' | 'lastMonth' | 'last3') {
    const n = new Date();
    let f: string, t: string;
    if (kind === 'thisMonth') {
      f = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      t = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    } else if (kind === 'lastMonth') {
      const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
      f = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    } else {
      const d3 = new Date(n.getFullYear(), n.getMonth() - 2, 1);
      f = `${d3.getFullYear()}-${String(d3.getMonth() + 1).padStart(2, '0')}-01`;
      const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
      t = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    }
    setDateFrom(f); setDateTo(t);
    navigateSafety(f, t);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const from = `${new Date().getFullYear()}-01-01`;
      const to   = todayLocalStr();
      const res  = await fetch(`/api/safety/reports/export?from=${from}&to=${to}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `안전보건보고서_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(false); }
  }
  const [reviewStatus, setReviewStatus] = useState<'REVIEWED' | 'MOL_REPORTED' | 'RESOLVED'>('REVIEWED');
  const [note, setNote] = useState('');
  const [tbmEdit, setTbmEdit] = useState(false);
  const [tbmTopic, setTbmTopic] = useState(tbm?.topic ?? '');
  const [tbmContent, setTbmContent] = useState(tbm?.content ?? '');
  const [tbmDept, setTbmDept] = useState(tbm?.department ?? '');
  const [tbmPhoto, setTbmPhoto] = useState<string | null>(tbm?.photoDataUrl ?? null);
  const [tbmLeader, setTbmLeader] = useState(tbm?.leader ?? '');
  const [tbmLocation, setTbmLocation] = useState(tbm?.location ?? '');
  const [tbmHazards, setTbmHazards] = useState(tbm?.hazards ?? '');

  const filtered = useMemo(() => {
    if (tab === 'ALL') return rows;
    if (tab === 'PENDING') return rows.filter((r) => r.status === 'SUBMITTED');
    if (tab === 'CHECKLIST') return rows.filter((r) => r.reportType === 'DAILY_CHECKLIST');
    if (tab === 'INCIDENT') return rows.filter((r) => r.reportType === 'INCIDENT');
    if (tab === 'NEAR_MISS') return rows.filter((r) => r.reportType === 'NEAR_MISS');
    if (tab === 'ABNORMAL') return rows.filter(
      (r) => r.reportType === 'DAILY_CHECKLIST' && !r.allChecked
    );
    return rows;
  }, [rows, tab]);

  const incidentCounts = useMemo(() => {
    const by = { FATAL: 0, SEVERE: 0, INJURY: 0 } as Record<string, number>;
    rows.forEach((r) => {
      if (r.reportType === 'INCIDENT' && by[r.severity] != null) by[r.severity]++;
    });
    return by;
  }, [rows]);

  const overdueMol = rows.filter(
    (r) => r.reportType === 'INCIDENT' && r.molDeadline && !r.molReportedAt && new Date(r.molDeadline).getTime() < Date.now()
  ).length;

  const abnormalCount = rows.filter((r) => r.reportType === 'DAILY_CHECKLIST' && !r.allChecked).length;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'ALL', label: '전체', count: rows.length },
    { key: 'DAILY', label: '일별 보기', count: 0 },
    { key: 'PENDING', label: '미검토', count: rows.filter((r) => r.status === 'SUBMITTED').length },
    { key: 'CHECKLIST', label: '일일점검', count: rows.filter((r) => r.reportType === 'DAILY_CHECKLIST').length },
    { key: 'ABNORMAL', label: '⚠ 이상항목', count: abnormalCount },
    ...(hasNearMiss ? [{ key: 'NEAR_MISS' as Tab, label: '아차사고', count: rows.filter((r) => r.reportType === 'NEAR_MISS').length }] : []),
    ...(hasIncident ? [{ key: 'INCIDENT' as Tab, label: '재해', count: rows.filter((r) => r.reportType === 'INCIDENT').length }] : []),
  ];

  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const dailyRows = useMemo(() => rows.filter((r) => r.reportDate === dailyDate), [rows, dailyDate]);
  function printPage() { if (typeof window !== 'undefined') window.print(); }

  async function saveTbm() {
    if (tbmTopic.trim().length < 2) {
      setError('주제는 2자 이상');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/tbm/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: tbmTopic.trim(),
          content: tbmContent.trim() || undefined,
          department: tbmDept.trim() || undefined,
          photoDataUrl: tbmPhoto || undefined,
          leader: tbmLeader.trim() || undefined,
          location: tbmLocation.trim() || undefined,
          hazards: tbmHazards.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '저장 실패');
        return;
      }
      setTbmEdit(false);
      router.refresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!reviewing || note.trim().length < 2) {
      setError('검토 메모를 2자 이상 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/safety/reports/${reviewing.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: reviewStatus, reviewNote: note.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? '검토 처리 실패');
        return;
      }
      setReviewing(null);
      setNote('');
      router.refresh();
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-6xl space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-ink tracking-tight">산업안전보건 관리</h2>
          <p className="text-xs font-bold text-ink-muted mt-1">
            Plan §3-4 · 산안법 §54 (사망/중상 24h) · §57 (부상 30일) 보고
          </p>
        </div>
        {overdueMol > 0 && (
          <span className="px-3 py-1.5 rounded-full text-xs font-mono font-extrabold bg-red-100 text-danger border border-danger animate-pulse">
            ⚠ MOL 보고 기한 초과 {overdueMol}건
          </span>
        )}
      </header>

      {/* MUNI_ADMIN 업체 탭 필터 */}
      {/* 날짜 필터 */}
      <div className="bg-surface border border-line rounded-xl p-3 flex flex-wrap items-center gap-2 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-extrabold text-ink-muted whitespace-nowrap">기간</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-line text-xs font-mono font-bold bg-white focus:outline-none focus:border-accent" />
          <span className="text-xs text-ink-muted">~</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-1.5 rounded border border-line text-xs font-mono font-bold bg-white focus:outline-none focus:border-accent" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => quickRange('thisMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-surface-soft">이번달</button>
          <button onClick={() => quickRange('lastMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-surface-soft">전월</button>
          <button onClick={() => quickRange('last3')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-surface-soft">최근 3개월</button>
        </div>
        <button onClick={() => navigateSafety(dateFrom, dateTo)}
          className="px-4 py-1.5 rounded bg-accent text-white text-xs font-extrabold hover:bg-cyan-800 active:scale-95">조회</button>
        <span className="ml-auto text-[0.6875rem] font-mono text-ink-muted">{initFrom} ~ {initTo} · {rows.length}건</span>
      </div>

      {contractorOpts.length >= 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            onClick={() => navigateSafety(initFrom, initTo, '')}
            className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition ${
              !selectedContractorId ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
            }`}
          >
            전체 업체
          </button>
          {contractorOpts.map((c) => (
            <button
              key={c.id}
              onClick={() => navigateSafety(initFrom, initTo, c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition ${
                selectedContractorId === c.id ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-muted hover:bg-surface-soft'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* 기상 + TBM 카드 row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <WeatherWidget w={weather} />
        <TbmWidget
          tbm={tbm}
          isManager={isManager}
          editing={tbmEdit}
          topic={tbmTopic}
          content={tbmContent}
          dept={tbmDept}
          photo={tbmPhoto}
          leader={tbmLeader}
          location={tbmLocation}
          hazards={tbmHazards}
          onTopicChange={setTbmTopic}
          onContentChange={setTbmContent}
          onDeptChange={setTbmDept}
          onPhotoChange={setTbmPhoto}
          onLeaderChange={setTbmLeader}
          onLocationChange={setTbmLocation}
          onHazardsChange={setTbmHazards}
          onEdit={() => {
            setTbmEdit(true);
            setTbmTopic(tbm?.topic ?? '');
            setTbmContent(tbm?.content ?? '');
            setTbmDept(tbm?.department ?? '');
            setTbmPhoto(tbm?.photoDataUrl ?? null);
            setTbmLeader(tbm?.leader ?? '');
            setTbmLocation(tbm?.location ?? '');
            setTbmHazards(tbm?.hazards ?? '');
          }}
          onCancel={() => setTbmEdit(false)}
          onSave={saveTbm}
          busy={busy}
        />
      </div>

      {/* 기상악화 알림톡 공지 — 매니저만 노출 */}
      {isManager && (
        <WeatherAlertCard workers={alertWorkers} hazardLevel={weather.hazardLevel} />
      )}

      {/* 일자별 온도 바로가기 + Excel 내보내기 — 매니저만 노출 */}
      {isManager && (
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <a href="/safety/temperature"
            className="px-3 py-1.5 rounded-lg border border-line bg-white text-xs font-extrabold text-ink-muted hover:bg-slate-50 transition shadow-sm">
            🌡 일자별 온도조회
          </a>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-3 py-1.5 rounded-lg border border-line bg-white text-xs font-extrabold text-ink-muted hover:bg-slate-50 transition shadow-sm flex items-center gap-1 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? '생성 중…' : '보고서 Excel'}
          </button>
          <span className="text-[10px] text-slate-400">Open-Meteo 기반 · 월별 최고/최저 기온 + 폭염·고위험일 집계</span>
        </div>
      )}

      {/* 요약 카드 */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat label="오늘 점검 제출" value={`${todayChecklist} / ${todayWorkers}명`} tone={todayChecklist === todayWorkers && todayWorkers > 0 ? 'text-success' : 'text-warn'} />
        <Stat label="누적 재해 (사망)" value={`${incidentCounts.FATAL}건`} tone="text-danger" />
        <Stat label="중상" value={`${incidentCounts.SEVERE}건`} tone="text-danger" />
        <Stat label="부상" value={`${incidentCounts.INJURY}건`} tone="text-warn" />
        <Stat label="MOL 기한 초과" value={`${overdueMol}건`} tone={overdueMol > 0 ? 'text-danger' : 'text-success'} />
      </section>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-2.5 text-sm font-bold text-red-700">{error}</div>
      )}

      {/* 탭 */}
      <nav className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-card overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-extrabold whitespace-nowrap transition ${
              tab === t.key ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-surface-soft'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-[0.6875rem] font-mono ${tab === t.key ? 'text-cyan-100' : 'text-ink-muted'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </nav>

      {/* 일별 보기 모드 */}
      {tab === 'DAILY' && (
        <div className="bg-surface border border-line rounded-xl p-5 space-y-4 print:p-2">
          <div className="flex items-center gap-3 print:hidden">
            <h3 className="text-lg font-extrabold text-ink">일별 안전보건 출력</h3>
            <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
              className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
            <button onClick={printPage}
              className="ml-auto px-4 py-1.5 rounded bg-accent text-white text-sm font-extrabold hover:bg-accent-strong">
              🖨 인쇄
            </button>
          </div>
          <div className="border-t-4 border-double border-slate-700 pt-3">
            <h2 className="text-xl font-black text-center mb-3">산업안전보건 일일 보고서 — {dailyDate}</h2>

            {/* 일기예보 */}
            <DailySection title="🌤 기상 정보 (한국 기상청)">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><span className="font-bold">기온:</span> {weather.temp}°C</div>
                <div><span className="font-bold">날씨:</span> {weather.conditionLabel}</div>
                <div><span className="font-bold">풍속:</span> {weather.windSpeed}m/s</div>
                <div><span className="font-bold">습도:</span> {weather.humidity}%</div>
                <div><span className="font-bold">미세먼지:</span> {weather.pm10}㎍/㎥ ({weather.pm10Label})</div>
                <div><span className="font-bold">위험도:</span> {weather.hazardLevel}</div>
              </div>
            </DailySection>

            {/* TBM */}
            <DailySection title="📋 오늘 TBM 안전교육">
              {tbm ? (
                <div className="space-y-1 text-sm">
                  <div><span className="font-bold">주제:</span> {tbm.topic}</div>
                  {tbm.content && <div><span className="font-bold">내용:</span> <span className="whitespace-pre-wrap">{tbm.content}</span></div>}
                  <div><span className="font-bold">서명자:</span> {tbm.signCount}명</div>
                </div>
              ) : <div className="text-sm text-slate-600">등록된 TBM 없음</div>}
            </DailySection>

            {/* 일일점검 — 체크박스 형태로 항목 표시 */}
            <DailySection title="✅ 일일점검">
              {dailyRows.filter((r) => r.reportType === 'DAILY_CHECKLIST').length === 0
                ? <div className="text-sm text-slate-600">점검 보고 없음</div>
                : dailyRows.filter((r) => r.reportType === 'DAILY_CHECKLIST').map((r) => (
                  <div key={r.id} className="mb-3 border border-line rounded p-2">
                    <div className="flex items-center mb-1.5">
                      <span className="font-bold text-sm">{r.reporter}</span>
                      <span className={`ml-2 text-[0.625rem] font-mono font-extrabold px-1.5 py-0.5 rounded ${r.allChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {r.allChecked ? '✓ 전체 완료' : `${r.checklistItems?.filter((i) => i.ok).length ?? 0}/${r.checklistItems?.length ?? 0} 미완료`}
                      </span>
                    </div>
                    {r.checklistItems && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.6875rem]">
                        {(r.checklistItems as ChecklistItem[]).map((item, i) => (
                          <div key={i} className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block w-3 h-3 rounded border ${item.ok ? 'bg-emerald-500 border-emerald-600' : 'bg-white border-slate-400'}`}>
                                {item.ok && <span className="text-white text-[0.5rem] font-bold leading-none flex items-center justify-center h-full">✓</span>}
                              </span>
                              <span className={item.ok ? 'text-ink' : 'text-amber-800 font-bold'}>{item.label}</span>
                            </div>
                            {!item.ok && item.reason && (
                              <div className="ml-4.5 text-amber-700 text-[0.5625rem]">사유: {item.reason}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {r.reviewNote && (
                      <div className="mt-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-[0.6875rem] text-blue-800">
                        <span className="font-extrabold">관리자 조치:</span> {r.reviewNote}
                      </div>
                    )}
                  </div>
                ))}
            </DailySection>

            {/* 아차사고 */}
            <DailySection title="⚠ 아차사고">
              {dailyRows.filter((r) => r.reportType === 'NEAR_MISS').length === 0
                ? <div className="text-sm text-slate-600">신고 없음</div>
                : (
                  <ul className="space-y-1 text-sm">
                    {dailyRows.filter((r) => r.reportType === 'NEAR_MISS').map((r) => (
                      <li key={r.id}>
                        <span className="font-bold">{r.reporter}:</span> {r.description ?? '내용 없음'}
                      </li>
                    ))}
                  </ul>
                )}
            </DailySection>

            {/* 재해 발생 */}
            <DailySection title="🚨 재해 발생">
              {dailyRows.filter((r) => r.reportType === 'INCIDENT').length === 0
                ? <div className="text-sm text-slate-600">재해 없음 (안전 무재해 진행 중)</div>
                : (
                  <ul className="space-y-1 text-sm">
                    {dailyRows.filter((r) => r.reportType === 'INCIDENT').map((r) => (
                      <li key={r.id} className="text-red-700">
                        <span className="font-extrabold">[{SEV_LABEL[r.severity]}] {r.reporter}:</span> {r.description ?? '—'}
                      </li>
                    ))}
                  </ul>
                )}
            </DailySection>

            <div className="mt-6 pt-3 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-sm">
              <div>
                <div className="font-bold mb-2">담당자 {meName && <span className="text-xs font-mono">({meName})</span>}</div>
                <div className="border border-slate-400 h-16 flex items-center justify-center bg-white">
                  {meSignatureUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={meSignatureUrl} alt="signature" className="max-h-full" />
                  ) : <span className="text-[0.625rem] font-mono text-slate-500">서명 미등록</span>}
                </div>
              </div>
              <div>
                <div className="font-bold mb-2">관리자 결재</div>
                <div className="border border-slate-400 h-16 flex items-center justify-center bg-white">
                  {isManager && meSignatureUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={meSignatureUrl} alt="signature" className="max-h-full" />
                  ) : <span className="text-[0.625rem] font-mono text-slate-500">관리자 서명란</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리스트 (일별 모드 외) */}
      {tab !== 'DAILY' && <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-surface border border-line rounded-xl py-16 text-center text-sm text-ink-muted font-bold">
            해당 조건에 맞는 보고서가 없습니다.
          </div>
        )}
        {filtered.map((r) => {
          const overdue = r.reportType === 'INCIDENT' && r.molDeadline && !r.molReportedAt && new Date(r.molDeadline).getTime() < Date.now();
          return (
            <article key={r.id} className={`bg-surface border rounded-xl shadow-card overflow-hidden ${overdue ? 'border-danger ring-2 ring-danger/20' : 'border-line'}`}>
              <div className="px-5 py-4 flex items-start gap-4">
                <ReportIcon type={r.reportType} severity={r.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[0.9375rem] font-extrabold text-ink">{TYPE_LABEL[r.reportType]}</span>
                    {r.reportType === 'INCIDENT' && <SeverityChip s={r.severity} />}
                    <StatusChip s={r.status} />
                    {overdue && <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold bg-red-100 text-danger border border-danger">⚠ MOL 초과</span>}
                    <code className="text-[0.625rem] font-mono text-ink-faint">#{r.id}</code>
                  </div>
                  {r.reportType === 'DAILY_CHECKLIST' && r.checklistItems && (
                    <div className="text-xs text-ink font-semibold mt-1">
                      체크: {r.checklistItems.filter((i) => i.ok).length} / {r.checklistItems.length}
                      {r.allChecked ? ' ✓ 전체 완료' : ' (이상항목 있음)'}
                    </div>
                  )}
                  {/* 미체크 항목 + 사유 표시 */}
                  {r.reportType === 'DAILY_CHECKLIST' && !r.allChecked && r.checklistItems && (
                    <div className="mt-2 space-y-1">
                      {(r.checklistItems as ChecklistItem[]).filter((i) => !i.ok).map((item, idx) => (
                        <div key={idx} className="bg-amber-50 border border-amber-300 rounded px-2 py-1 text-xs">
                          <span className="font-extrabold text-amber-800">⚠ {item.label}</span>
                          {item.reason && (
                            <span className="ml-2 text-amber-700">— {item.reason}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {r.description && (
                    <div className="text-sm text-ink font-semibold mt-1.5 line-clamp-3">{r.description}</div>
                  )}
                  {r.locationAddress && (
                    <div className="text-xs text-ink-muted mt-1.5">📍 {r.locationAddress}</div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[0.6875rem] font-mono font-bold text-ink-faint">
                    <span>접수: {fmt(r.reportedAt)}</span>
                    <span>보고자: <span className="text-ink">{r.reporter}</span></span>
                    {r.occurredAt && <span>발생: {fmt(r.occurredAt)}</span>}
                    {r.molDeadline && (
                      <span className={overdue ? 'text-danger' : 'text-info'}>
                        MOL 기한: {fmt(r.molDeadline)}
                        {r.molReportedAt && ` · 완료 ${fmt(r.molReportedAt)}`}
                      </span>
                    )}
                    {r.reviewer && <span>검토자: <span className="text-accent">{r.reviewer}</span></span>}
                  </div>
                  {r.reviewNote && (
                    <div className="mt-2.5 px-3 py-2 bg-surface-alt rounded-md text-xs text-ink-muted font-semibold border-l-4 border-l-success">
                      <strong className="text-ink">검토 메모:</strong> {r.reviewNote}
                    </div>
                  )}
                </div>
              </div>
              {isManager && (r.status === 'SUBMITTED' || (r.reportType === 'DAILY_CHECKLIST' && !r.allChecked)) && (
                <div className="px-5 py-3 bg-surface-soft border-t border-line flex items-center gap-2">
                  {r.status === 'SUBMITTED' && (
                    <button
                      onClick={() => { setReviewing(r); setNote(''); setReviewStatus(r.reportType === 'INCIDENT' && (r.severity === 'FATAL' || r.severity === 'SEVERE' || r.severity === 'INJURY') ? 'MOL_REPORTED' : 'REVIEWED'); }}
                      className="px-3 py-1.5 rounded-md bg-accent text-white text-xs font-extrabold hover:bg-cyan-800 active:scale-95"
                    >
                      검토 처리
                    </button>
                  )}
                  {r.reportType === 'DAILY_CHECKLIST' && !r.allChecked && r.status !== 'SUBMITTED' && (
                    <button
                      onClick={() => { setReviewing(r); setNote(r.reviewNote ?? ''); setReviewStatus('RESOLVED'); }}
                      className="px-3 py-1.5 rounded-md bg-slate-600 text-white text-xs font-extrabold hover:bg-slate-700 active:scale-95"
                    >
                      조치사항 작성
                    </button>
                  )}
                  {r.reviewNote && (
                    <span className="text-xs font-semibold text-ink-muted">조치: {r.reviewNote}</span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>}

      {reviewing && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center px-4" onClick={() => setReviewing(null)}>
          <div className="w-full max-w-[520px] bg-surface rounded-xl shadow-modal" onClick={(e) => e.stopPropagation()}>
            <header className="px-5 py-4 bg-surface-soft border-b-2 border-line">
              <h3 className="text-base font-extrabold text-ink">안전 보고서 검토</h3>
              <div className="text-[0.6875rem] font-mono font-bold text-ink-muted mt-0.5">#{reviewing.id} · {TYPE_LABEL[reviewing.reportType]}</div>
            </header>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-extrabold text-ink mb-2">처리 결과</label>
              <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as 'REVIEWED' | 'MOL_REPORTED' | 'RESOLVED')} className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent">
                <option value="REVIEWED">검토 완료</option>
                <option value="MOL_REPORTED">지자체 보고 완료</option>
                <option value="RESOLVED">종결</option>
              </select>
              <label className="block text-xs font-extrabold text-ink mb-2">
                {reviewing?.reportType === 'DAILY_CHECKLIST' ? '조치사항 (예: 5/15 새 안전모 교체 완료)' : '검토 메모 (필수)'}
              </label>
              <textarea
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={reviewing?.reportType === 'DAILY_CHECKLIST'
                  ? '조치 내용을 입력하세요 (예: 5/15 새 안전모 교체 완료)'
                  : '조치 내역 / 후속 행동 / MOL 보고 첨부 등'}
                className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
              />
            </div>
            <footer className="px-5 py-3 bg-surface-soft border-t border-line flex justify-end gap-2">
              <button onClick={() => setReviewing(null)} className="px-4 py-2 rounded-md border border-line text-sm font-bold hover:bg-surface">취소</button>
              <button onClick={submitReview} disabled={busy || note.trim().length < 2} className="px-5 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
                {busy ? '처리 중…' : '검토 저장'}
              </button>
            </footer>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-300 border-l-4 border-l-info rounded-md px-4 py-3 text-xs text-info font-semibold leading-relaxed">
        <strong className="font-extrabold">지자체 보고 자동화</strong> · 사망·중상 보고서는 발생 시각 기준 24시간, 부상은 30일로 자동 마감 기한이 설정됩니다. 지자체 보고 완료 상태로 전이 시 보고 일시가 함께 기록되어 산안법 준수가 추적됩니다.
      </div>
    </div>
  );
}

function ReportIcon({ type, severity }: { type: string; severity: string }) {
  const colors: Record<string, string> = {
    INCIDENT: severity === 'FATAL' ? 'bg-red-200 text-danger' : severity === 'SEVERE' ? 'bg-red-100 text-danger' : 'bg-amber-100 text-warn',
    NEAR_MISS: 'bg-amber-100 text-warn',
    DAILY_CHECKLIST: 'bg-green-100 text-success',
    TBM_SIGNATURE: 'bg-blue-100 text-info',
  };
  const paths: Record<string, string> = {
    INCIDENT: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    NEAR_MISS: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    DAILY_CHECKLIST: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    TBM_SIGNATURE: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  };
  return (
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[type] ?? 'bg-slate-100 text-ink-muted'}`}>
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d={paths[type] ?? paths.INCIDENT} />
      </svg>
    </div>
  );
}

function SeverityChip({ s }: { s: string }) {
  const map: Record<string, string> = {
    FATAL: 'bg-red-200 text-danger border-danger animate-pulse',
    SEVERE: 'bg-red-100 text-danger border-red-200',
    INJURY: 'bg-amber-100 text-warn border-amber-200',
    MINOR: 'bg-blue-100 text-info border-blue-200',
    NONE: 'bg-slate-100 text-ink-muted border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${map[s] ?? map.NONE}`}>
      {SEV_LABEL[s] ?? s}
    </span>
  );
}

function StatusChip({ s }: { s: string }) {
  const map: Record<string, string> = {
    SUBMITTED: 'bg-amber-100 text-warn border-amber-200',
    REVIEWED: 'bg-blue-100 text-info border-blue-200',
    MOL_REPORTED: 'bg-green-100 text-success border-green-200',
    RESOLVED: 'bg-slate-100 text-ink-muted border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.6875rem] font-mono font-extrabold border tracking-wide ${map[s] ?? ''}`}>
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

function Stat({ label, value, tone = 'text-ink' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl px-4 py-3 shadow-card">
      <div className="text-[0.625rem] font-extrabold text-ink-muted tracking-widest uppercase">{label}</div>
      <div className={`mt-1 text-lg font-black font-mono tracking-tight ${tone}`}>{value}</div>
    </div>
  );
}

function fmt(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}

function WeatherWidget({ w }: { w: WeatherSnapshot }) {
  const tone: Record<string, string> = {
    NONE: 'border-info bg-blue-50 text-info',
    CAUTION: 'border-warn bg-amber-50 text-warn',
    WARN: 'border-warn bg-amber-100 text-warn',
    DANGER: 'border-danger bg-red-100 text-danger',
  };
  return (
    <div className={`bg-surface rounded-xl border-2 border-l-4 shadow-card overflow-hidden ${tone[w.hazardLevel] ?? tone.NONE}`}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="text-3xl">{w.condition === 'CLEAR' ? '☀️' : w.condition === 'CLOUDY' ? '⛅' : w.condition === 'RAIN' ? '🌧' : w.condition === 'SNOW' ? '❄️' : '🌪'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[0.6875rem] font-extrabold tracking-widest">기상 · {w.region.replace('서울특별시 ', '')}</div>
          <div className="font-mono text-xl font-black tracking-tight">{w.temp}°C <span className="text-[0.75rem] font-bold ml-1">체감 {w.feelsLike}°C</span></div>
          <div className="text-[0.6875rem] font-bold mt-0.5 font-mono">습도 {w.humidity}% · 풍속 {w.windSpeed}m/s · PM10 {w.pm10}㎍ ({w.pm10Label})</div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold border bg-white/70">{w.hazardLabel}</span>
      </div>
      {w.hazardLevel !== 'NONE' && (
        <div className="px-4 py-2 border-t border-current/20 text-[0.6875rem] font-extrabold">
          ⚠ {w.hazardReason} — {w.workAdvice}
        </div>
      )}
    </div>
  );
}

function TbmWidget({
  tbm, isManager, editing, topic, content, dept, photo, leader, location, hazards,
  onTopicChange, onContentChange, onDeptChange, onPhotoChange,
  onLeaderChange, onLocationChange, onHazardsChange,
  onEdit, onCancel, onSave, busy,
}: {
  tbm: TbmInfo | null;
  isManager: boolean;
  editing: boolean;
  topic: string;
  content: string;
  dept: string;
  photo: string | null;
  leader: string;
  location: string;
  hazards: string;
  onTopicChange: (s: string) => void;
  onContentChange: (s: string) => void;
  onDeptChange: (s: string) => void;
  onPhotoChange: (s: string | null) => void;
  onLeaderChange: (s: string) => void;
  onLocationChange: (s: string) => void;
  onHazardsChange: (s: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      onPhotoChange(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = url;
  }

  return (
    <div className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      <header className="px-4 py-3 bg-surface-soft border-b-2 border-line flex items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-ink">📋 오늘 TBM 안전교육</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {tbm && !editing && <span className="px-2.5 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold bg-blue-100 text-info border border-blue-200">{tbm.signCount}명 서명</span>}
          {isManager && !editing && (
            <>
              <a href="/safety/tbm-print" className="px-2 py-0.5 rounded text-[0.625rem] font-extrabold border border-slate-400 text-slate-600 hover:bg-slate-100 print:hidden">
                월별 출력
              </a>
              <a href="/safety/tbm-history"
                className="px-3 py-1 rounded text-xs font-extrabold border border-line bg-white hover:bg-slate-50 transition print:hidden">
                📋 TBM이력
              </a>
              <a href="/safety/alert-history"
                className="px-3 py-1 rounded text-xs font-extrabold border border-line bg-white hover:bg-slate-50 transition print:hidden">
                📡 공지이력
              </a>
            </>
          )}
        </div>
      </header>
      <div className="p-4">
        {editing ? (
          <div className="space-y-2">
            <input value={topic} onChange={(e) => onTopicChange(e.target.value)} placeholder="오늘의 안전 주제 (예: 폭염 대비 수분 섭취) *" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold focus:outline-none focus:border-accent" />
            <div className="grid grid-cols-2 gap-2">
              <input value={leader} onChange={(e) => onLeaderChange(e.target.value)} placeholder="리더 (예: 홍길동)" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent" />
              <input value={location} onChange={(e) => onLocationChange(e.target.value)} placeholder="교육 장소 (예: 차고지)" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent" />
            </div>
            <textarea rows={2} value={hazards} onChange={(e) => onHazardsChange(e.target.value)} placeholder="위험요인 (예: 폭염, 탈수, 교통사고)" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
            <input value={dept} onChange={(e) => onDeptChange(e.target.value)} placeholder="팀명 (선택, 예: 1팀)" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent" />
            <textarea rows={2} value={content} onChange={(e) => onContentChange(e.target.value)} placeholder="기타 내용 (선택)" className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none" />
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border-2 border-dashed border-line cursor-pointer hover:border-accent transition">
                <span className="text-xs font-bold text-ink-muted">📷 TBM 사진</span>
                {photo && <span className="text-[0.625rem] text-success font-bold">사진 선택됨</span>}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoFile} />
              </label>
              {photo && <button onClick={() => onPhotoChange(null)} className="px-2 py-1.5 text-[0.625rem] font-bold text-danger border border-danger rounded hover:bg-red-50">삭제</button>}
            </div>
            {photo && <img src={photo} alt="TBM 사진 미리보기" className="w-full rounded-md max-h-40 object-contain bg-slate-50 border border-line" />}
            <div className="flex gap-2">
              <button onClick={onSave} disabled={busy || topic.trim().length < 2} className="flex-1 px-3 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50">
                {busy ? '저장 중…' : '저장'}
              </button>
              <button onClick={onCancel} className="px-4 py-2 rounded-md border border-line text-sm font-bold">취소</button>
            </div>
          </div>
        ) : tbm ? (
          <div>
            <div className="flex items-center gap-2">
              <div className="text-base font-extrabold text-ink">{tbm.topic}</div>
              {tbm.department && <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold bg-slate-100 text-ink-muted border">{tbm.department}</span>}
            </div>
            {(tbm.leader || tbm.location) && (
              <div className="flex gap-3 mt-1.5 text-xs font-semibold text-ink-muted">
                {tbm.leader && <span>리더: <span className="text-ink font-bold">{tbm.leader}</span></span>}
                {tbm.location && <span>장소: <span className="text-ink font-bold">{tbm.location}</span></span>}
              </div>
            )}
            {tbm.hazards && (
              <div className="mt-1 px-2 py-1.5 rounded bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                <span className="font-extrabold">위험요인: </span>{tbm.hazards}
              </div>
            )}
            {tbm.content && <p className="text-xs font-semibold text-ink-muted mt-1.5 line-clamp-3 whitespace-pre-wrap">{tbm.content}</p>}
            {tbm.photoDataUrl && <img src={tbm.photoDataUrl} alt="TBM 사진" className="mt-2 w-full rounded-md max-h-48 object-contain bg-slate-50 border border-line" />}
            <div className="flex items-center justify-between mt-2.5">
              <div className="text-[0.6875rem] font-mono font-bold text-ink-faint">등록: {tbm.createdBy}</div>
              {isManager && <button onClick={onEdit} className="text-xs font-extrabold text-accent hover:underline">수정</button>}
            </div>

            {/* 서명자 / 미서명자 리스트 */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-emerald-50 border border-emerald-300 rounded p-2">
                <div className="text-[0.625rem] font-mono font-extrabold text-emerald-800 mb-1">
                  ✓ 서명 완료 ({tbm.signedWorkers.length}명)
                </div>
                <div className="max-h-[80px] overflow-y-auto">
                  {tbm.signedWorkers.length === 0
                    ? <span className="text-[0.625rem] text-slate-600">없음</span>
                    : (
                      <div className="flex flex-wrap gap-1">
                        {tbm.signedWorkers.map((w) => (
                          <span key={w.id} className="text-[0.625rem] font-bold px-1.5 py-0.5 bg-white rounded border border-emerald-300">{w.name}</span>
                        ))}
                      </div>
                    )}
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded p-2">
                <div className="text-[0.625rem] font-mono font-extrabold text-amber-800 mb-1">
                  ⚠ 미서명 ({tbm.unsignedWorkers.length}명)
                </div>
                <div className="max-h-[80px] overflow-y-auto">
                  {tbm.unsignedWorkers.length === 0
                    ? <span className="text-[0.625rem] text-emerald-700 font-bold">전원 서명 완료</span>
                    : (
                      <div className="flex flex-wrap gap-1">
                        {tbm.unsignedWorkers.map((w) => (
                          <span key={w.id} className="text-[0.625rem] font-bold px-1.5 py-0.5 bg-white rounded border border-amber-300">{w.name}</span>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs font-bold text-ink-muted mb-2">오늘 TBM 세션이 등록되지 않았습니다.</p>
            {isManager && (
              <button onClick={onEdit} className="px-4 py-2 rounded-md bg-info text-white text-sm font-extrabold hover:bg-blue-700">
                + TBM 세션 등록
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DailySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 border-l-4 border-accent pl-3">
      <h3 className="font-extrabold text-ink mb-2 text-base">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

