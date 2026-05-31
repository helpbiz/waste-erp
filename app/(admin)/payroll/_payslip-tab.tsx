'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* ─── 타입 ─────────────────────────────────────────────────────── */
type PayslipColumn = { key: string; label: string; required: boolean };
type Template = {
  earnings:       PayslipColumn[];
  deductions:     PayslipColumn[];
  extras:         PayslipColumn[];
  showWorkHours:  boolean;
  showCalcMethod: boolean;
  payDayLabel:    string;
  footer:         string;
};

type ImportResult = {
  rowNo: number;
  status: 'OK' | 'WARN' | 'SKIP' | 'ERROR';
  message: string;
  workerName?: string;
  employeeNo?: string;
  preview?: {
    employeeNo: string | null;
    payDate?:   string | null;
    earnings:   Record<string, number>;
    deductions: Record<string, number>;
    extras?:    Record<string, number>;
    totals:     { 지급합계: number; 공제합계: number; 실수령액: number };
  };
};

type PayslipTotals = Record<string, number>;

type PublishedRecord = {
  id: string; workerId: string; workerName: string; employeeNo: string | null;
  yearMonth: string; isPublished: boolean; publishedAt: string | null;
  approvedAt: string | null;
  data: { totals: PayslipTotals };
};

type ApproverInfo = {
  approverId:           string | null;
  approverName:         string | null;
  isCurrentUserApprover: boolean;
};

const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString('ko-KR') + '원';
/** 명세서 데이터의 실수령액 — 구버전 키(실지급액)와 신버전 키(실수령액) 모두 지원 */
const getNetPay = (totals: PayslipTotals) => totals['실수령액'] ?? totals['실지급액'] ?? 0;
const DEFAULT_TEMPLATE: Template = {
  earnings: [
    { key: '기본급',           label: '기 본 급',               required: true  },
    { key: '주휴수당',         label: '주 휴 수 당',             required: false },
    { key: '운전수당',         label: '운 전 수 당',             required: false },
    { key: '기술수당',         label: '기 술 수 당',             required: false },
    { key: '연장근로수당',     label: '연 장 근 로 수 당',       required: false },
    { key: '야간근로수당',     label: '야 간 근 로 수 당',       required: false },
    { key: '법정휴일근로수당', label: '법 정 휴 일 근 로 수 당', required: false },
    { key: '연차수당',         label: '연 차 수 당',             required: false },
    { key: '조정수당',         label: '조 정 수 당',             required: false },
    { key: '특수작업수당',     label: '특 수 작 업 수 당',       required: false },
    { key: '보존수당',         label: '보 존 수 당',             required: false },
    { key: '직책수당',         label: '직 책 수 당',             required: false },
  ],
  deductions: [
    { key: '근로소득세',   label: '근 로 소 득 세',   required: true  },
    { key: '지방소득세',   label: '지 방 소 득 세',   required: true  },
    { key: '건강보험',     label: '건 강 보 험',       required: false },
    { key: '장기요양보험', label: '장 기 요 양 보 험', required: false },
    { key: '국민연금',     label: '국 민 연 금',       required: false },
    { key: '고용보험',     label: '고 용 보 험',       required: false },
    { key: '기타공제',     label: '기 타 공 제',       required: false },
    { key: '연말정산',     label: '연 말 정 산',       required: false },
  ],
  extras: [
    { key: '급식비',           label: '급 식 비',               required: false },
    { key: '생일축하금',       label: '생 일 축 하 금',         required: false },
    { key: '안전규정이행수당', label: '안 전 규 정 이 행 수 당', required: false },
  ],
  showWorkHours:  true,
  showCalcMethod: true,
  payDayLabel:    '매월 15일',
  footer: '※ 근로기준법 시행령에 의거 작성함.(2021년11월19일 시행)\n※ 개인정보 공유금지',
};

/* ─── 메인 컴포넌트 ─────────────────────────────────────────────── */
export default function PayslipTab({ ym, approverInfo }: { ym: string; approverInfo: ApproverInfo }) {
  const [sub, setSub] = useState<'send' | 'settings'>('send');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 bg-surface-soft rounded-lg p-1 border border-line max-w-xs">
        {(['send', 'settings'] as const).map((k) => (
          <button key={k} onClick={() => setSub(k)}
            className={`py-2 rounded-md text-sm font-extrabold transition ${sub === k ? 'bg-accent text-white shadow-card' : 'text-ink-muted hover:bg-surface'}`}>
            {k === 'send' ? '📤 발송' : '⚙️ 항목설정'}
          </button>
        ))}
      </div>

      {sub === 'send'     && <SendTab ym={ym} approverInfo={approverInfo} />}
      {sub === 'settings' && <SettingsTab />}
    </div>
  );
}

/* ─── 발송 탭 ────────────────────────────────────────────────────── */
function SendTab({ ym, approverInfo }: { ym: string; approverInfo: ApproverInfo }) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const STORAGE_KEY = `payslip_preview_${ym}`;
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [info,        setInfo]        = useState<string | null>(null);
  const [results,     setResults]     = useState<ImportResult[] | null>(() => {
    try {
      const saved = sessionStorage.getItem(`payslip_preview_${ym}`);
      return saved ? (JSON.parse(saved) as ImportResult[]) : null;
    } catch { return null; }
  });
  const [savedCount,  setSavedCount]  = useState(() => {
    try {
      const saved = sessionStorage.getItem(`payslip_preview_${ym}`);
      return saved ? (JSON.parse(saved) as ImportResult[]).filter((r) => r.status !== 'ERROR').length : 0;
    } catch { return 0; }
  });
  const [published,   setPublished]   = useState<PublishedRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandRow,   setExpandRow]   = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    const res = await fetch(`/api/payroll/payslips?yearMonth=${ym}`).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setPublished(d.items ?? []);
    }
    setLoadingList(false);
  }, [ym]);

  useEffect(() => { loadList(); }, [loadList]);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('엑셀 파일을 선택하세요.'); return; }
    setBusy(true); setError(null); setInfo(null); setResults(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('yearMonth', ym);
    const res  = await fetch('/api/payroll/payslips/import', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? '업로드 실패'); return; }
    const importedResults: ImportResult[] = data.results ?? [];
    setResults(importedResults);
    setSavedCount(data.savedCount ?? 0);
    setInfo(`✓ ${data.savedCount}명 불러오기 완료 — 아래 미리보기 확인 후 발송하세요.`);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(importedResults)); } catch { /* ignore */ }
    await loadList();
  }

  async function handleApprove() {
    if (!confirm(`${ym} 급여명세서 전체를 결재 승인하시겠습니까?\n승인 후 관리자가 근로자 앱으로 발송할 수 있습니다.`)) return;
    setBusy(true); setError(null);
    const res  = await fetch('/api/payroll/payslips/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearMonth: ym }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error === 'not_approver' ? '결재승인 권한이 없습니다.'
        : data.error === 'no_approver_configured' ? '승인권자가 지정되지 않았습니다.'
        : data.error ?? '결재 승인 실패');
      return;
    }
    setInfo(`✓ ${data.approvedCount}건 결재 승인 완료 — 이제 발송이 가능합니다.`);
    await loadList();
  }

  async function handlePublish() {
    if (!confirm(`${ym} 급여명세서를 근로자 앱에 발송하시겠습니까?\n발송 후 즉시 근로자가 확인할 수 있습니다.`)) return;
    setBusy(true); setError(null);
    const res  = await fetch('/api/payroll/payslips/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearMonth: ym }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      if (data.error === 'approval_required') {
        setError(`결재 승인 후 발송 가능합니다. 미승인 ${data.unapprovedCount}건이 있습니다.`);
      } else {
        setError(data.error ?? '발송 실패');
      }
      return;
    }
    setInfo(`✓ ${data.publishedCount}명에게 발송 완료`);
    setResults(null);
    await loadList();
  }

  const unpublishedCount  = published.filter((r) => !r.isPublished).length;
  const publishedCount    = published.filter((r) => r.isPublished).length;
  const unapprovedCount   = published.filter((r) => !r.approvedAt).length;
  const needsApproval     = !!approverInfo.approverId;
  const publishBlocked    = needsApproval && unapprovedCount > 0;

  return (
    <div className="space-y-4">

      {/* 결재승인 상태 배너 */}
      {needsApproval && (
        <section className={`rounded-xl border-2 px-5 py-4 ${unapprovedCount > 0 ? 'border-amber-400 bg-amber-50' : 'border-green-400 bg-green-50'}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className={`text-sm font-extrabold ${unapprovedCount > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                {unapprovedCount > 0
                  ? `⚠️ 결재 대기 중 — 승인 전 발송 불가 (미승인 ${unapprovedCount}건)`
                  : '✅ 결재 승인 완료 — 발송 가능'}
              </div>
              <div className="text-xs text-ink-muted font-semibold mt-1">
                결재승인권자: <strong className="text-ink">{approverInfo.approverName ?? '(지정됨)'}</strong>
              </div>
            </div>
            {approverInfo.isCurrentUserApprover && unapprovedCount > 0 && (
              <button onClick={handleApprove} disabled={busy}
                className="px-5 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-extrabold hover:bg-amber-600 active:scale-95 disabled:opacity-50 flex-shrink-0">
                {busy ? '처리 중…' : '✍️ 결재 승인'}
              </button>
            )}
          </div>
        </section>
      )}

      {/* 업로드 카드 */}
      <section className="bg-surface rounded-xl border border-line shadow-card p-5 space-y-3">
        <h3 className="text-sm font-extrabold text-ink">1단계 — 엑셀 업로드</h3>
        <p className="text-xs text-ink-muted font-semibold">
          헤더 행: <code className="bg-surface-soft px-1 rounded text-[0.7rem]">직원번호 | 이름 | 기본급 | 연장수당 | ... | 실수령액</code>
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="text-sm font-semibold text-ink-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-line file:text-xs file:font-extrabold file:bg-surface-soft file:text-ink hover:file:bg-surface" />
          <button onClick={handleImport} disabled={busy}
            className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 disabled:opacity-50">
            {busy ? '처리 중…' : '파일 불러오기'}
          </button>
        </div>
        {error && <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
        {info  && <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-xs font-bold text-success">{info}</div>}
      </section>

      {/* 미리보기 결과 */}
      {results && results.length > 0 && (
        <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-ink">2단계 — 미리보기 ({savedCount}명)</h3>
            {unpublishedCount > 0 && (
              <button onClick={handlePublish} disabled={busy || publishBlocked}
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-extrabold hover:bg-green-700 active:scale-95 disabled:opacity-50"
                title={publishBlocked ? '결재 승인 후 발송 가능합니다' : undefined}>
                {busy ? '발송 중…' : publishBlocked ? `🔒 결재 필요 (${unapprovedCount}건)` : `📤 ${unpublishedCount}명 발송`}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="bg-surface-soft border-b-2 border-line-strong">
                  {['행', '상태', '이름', '직원번호', '실수령액', '상세'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-extrabold text-ink uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const isOpen = expandRow === i;
                  const tone = r.status === 'OK' ? 'text-success' : r.status === 'WARN' ? 'text-warn' : r.status === 'SKIP' ? 'text-ink-muted' : 'text-danger';
                  return (
                    <>
                      <tr key={r.rowNo} className={i % 2 === 1 ? 'bg-surface-soft' : ''}>
                        <td className="px-3 py-2 border-b border-line font-mono text-xs text-ink-muted">{r.rowNo}</td>
                        <td className={`px-3 py-2 border-b border-line font-extrabold text-xs ${tone}`}>{r.status}</td>
                        <td className="px-3 py-2 border-b border-line font-bold text-ink">{r.workerName ?? '—'}</td>
                        <td className="px-3 py-2 border-b border-line font-mono text-xs text-ink-muted">{r.employeeNo ?? '—'}</td>
                        <td className="px-3 py-2 border-b border-line font-mono font-extrabold text-accent">
                          {r.preview ? fmt(r.preview.totals.실수령액) : '—'}
                        </td>
                        <td className="px-3 py-2 border-b border-line">
                          {(r.preview || r.status === 'ERROR' || r.status === 'WARN') && (
                            <button onClick={() => setExpandRow(isOpen ? null : i)} className="text-xs font-extrabold text-accent hover:underline">
                              {isOpen ? '닫기' : '상세'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${r.rowNo}-detail`}>
                          <td colSpan={6} className="px-4 pb-4 pt-1 bg-blue-50 border-b border-line">
                            {r.preview
                              ? <PayslipPreview data={r.preview} />
                              : <div className="text-sm font-bold text-danger py-2">{r.message}</div>
                            }
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 기존 발송 현황 */}
      {!results && (
        <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-ink">
              {ym} 발송 현황
              {publishedCount > 0 && <span className="ml-2 text-xs font-bold text-success">발송 {publishedCount}명</span>}
              {unpublishedCount > 0 && <span className="ml-2 text-xs font-bold text-warn">미발송 {unpublishedCount}명</span>}
            </h3>
            {unpublishedCount > 0 && (
              <button onClick={handlePublish} disabled={busy || publishBlocked}
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-extrabold hover:bg-green-700 active:scale-95 disabled:opacity-50"
                title={publishBlocked ? '결재 승인 후 발송 가능합니다' : undefined}>
                {busy ? '발송 중…' : publishBlocked ? `🔒 결재 필요 (${unapprovedCount}건)` : `📤 미발송 ${unpublishedCount}명 발송`}
              </button>
            )}
          </div>
          {loadingList ? (
            <div className="px-5 py-10 text-center text-ink-muted text-sm">불러오는 중…</div>
          ) : published.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-muted text-sm font-bold">이번 달 급여명세서가 없습니다. 엑셀을 업로드하세요.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr className="bg-surface-soft border-b-2 border-line-strong">
                    {(needsApproval ? ['이름', '직원번호', '실수령액', '결재', '발송상태'] : ['이름', '직원번호', '실수령액', '발송상태']).map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-extrabold text-ink uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {published.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 1 ? 'bg-surface-soft' : ''}>
                      <td className="px-3 py-2 border-b border-line font-bold text-ink">{r.workerName}</td>
                      <td className="px-3 py-2 border-b border-line font-mono text-xs text-ink-muted">{r.employeeNo ?? '—'}</td>
                      <td className="px-3 py-2 border-b border-line font-mono font-extrabold text-accent">{fmt(getNetPay(r.data.totals))}</td>
                      {needsApproval && (
                        <td className="px-3 py-2 border-b border-line">
                          {r.approvedAt
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-blue-100 text-info border border-blue-200">✅ 결재완료</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-amber-100 text-warn border border-amber-200">미결재</span>
                          }
                        </td>
                      )}
                      <td className="px-3 py-2 border-b border-line">
                        {r.isPublished
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-green-100 text-success border border-green-200">✓ 발송완료</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold bg-amber-100 text-warn border border-amber-200">미발송</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── 미리보기 컴포넌트 ──────────────────────────────────────────── */
function PayslipPreview({ data }: { data: NonNullable<ImportResult['preview']> }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-xs mt-2">
      <div>
        <div className="font-extrabold text-ink mb-1">지급 항목</div>
        {Object.entries(data.earnings).map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5 border-b border-line">
            <span className="text-ink-muted">{k}</span>
            <span className="font-mono font-bold text-ink">{v.toLocaleString('ko-KR')}</span>
          </div>
        ))}
        <div className="flex justify-between py-1 font-extrabold text-accent">
          <span>지급합계</span><span className="font-mono">{data.totals.지급합계.toLocaleString('ko-KR')}</span>
        </div>
      </div>
      <div>
        <div className="font-extrabold text-ink mb-1">공제 항목</div>
        {Object.entries(data.deductions).map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5 border-b border-line">
            <span className="text-ink-muted">{k}</span>
            <span className="font-mono font-bold text-ink">{v.toLocaleString('ko-KR')}</span>
          </div>
        ))}
        <div className="flex justify-between py-1 font-extrabold text-danger">
          <span>공제합계</span><span className="font-mono">{data.totals.공제합계.toLocaleString('ko-KR')}</span>
        </div>
      </div>
      <div className="col-span-2 bg-accent/10 rounded-lg px-4 py-2 flex items-center justify-between">
        <span className="font-extrabold text-accent">실수령액</span>
        <span className="font-mono text-xl font-black text-accent">{fmt(data.totals.실수령액)}</span>
      </div>
      {data.payDate && (
        <div className="col-span-2 flex items-center justify-between text-xs font-mono text-ink-muted border-t border-line pt-2">
          <span className="font-extrabold text-ink">임금 지급일</span>
          <span className="font-bold">{data.payDate}</span>
        </div>
      )}
    </div>
  );
}

/* ─── 항목설정 탭 ────────────────────────────────────────────────── */
type ColSection = 'earnings' | 'deductions' | 'extras';

function SettingsTab() {
  const [template, setTemplate] = useState<Template | null>(null);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info,  setInfo]  = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/payroll/payslip-template')
      .then((r) => r.json())
      .then((d) => setTemplate(d.template ?? DEFAULT_TEMPLATE))
      .catch(() => setTemplate(DEFAULT_TEMPLATE));
  }, []);

  function addCol(section: ColSection) {
    if (!template) return;
    setTemplate({ ...template, [section]: [...template[section], { key: '', label: '', required: false }] });
  }
  function removeCol(section: ColSection, idx: number) {
    if (!template) return;
    setTemplate({ ...template, [section]: template[section].filter((_, i) => i !== idx) });
  }
  function updateCol(section: ColSection, idx: number, field: keyof PayslipColumn, val: string | boolean) {
    if (!template) return;
    const cols = template[section].map((c, i) => i === idx ? { ...c, [field]: val } : c);
    if (field === 'key') cols[idx].label = cols[idx].label || String(val);
    setTemplate({ ...template, [section]: cols });
  }
  function setFlag(field: 'showWorkHours' | 'showCalcMethod', val: boolean) {
    if (!template) return;
    setTemplate({ ...template, [field]: val });
  }
  function setStr(field: 'payDayLabel' | 'footer', val: string) {
    if (!template) return;
    setTemplate({ ...template, [field]: val });
  }

  async function save() {
    if (!template) return;
    const invalid = [...template.earnings, ...template.deductions, ...template.extras].filter((c) => !c.key.trim());
    if (invalid.length) { setError('항목 키가 비어있는 행이 있습니다.'); return; }
    setBusy(true); setError(null); setInfo(null);
    const res  = await fetch('/api/payroll/payslip-template', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? '저장 실패'); return; }
    setInfo('✓ 항목 설정 저장 완료');
  }

  if (!template) return <div className="py-10 text-center text-ink-muted text-sm">불러오는 중…</div>;

  return (
    <div className="space-y-5">
      <ColSection title="임금구성항목 (지급)" section="earnings" cols={template.earnings}
        onAdd={() => addCol('earnings')} onRemove={(i) => removeCol('earnings', i)}
        onChange={(i, f, v) => updateCol('earnings', i, f, v)} />

      <ColSection title="공제내역" section="deductions" cols={template.deductions}
        onAdd={() => addCol('deductions')} onRemove={(i) => removeCol('deductions', i)}
        onChange={(i, f, v) => updateCol('deductions', i, f, v)} />

      <ColSection title="별도항목 (급식비·생일축하금 등)" section="extras" cols={template.extras}
        onAdd={() => addCol('extras')} onRemove={(i) => removeCol('extras', i)}
        onChange={(i, f, v) => updateCol('extras', i, f, v)} />

      {/* 표시 설정 */}
      <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-surface-soft">
          <h4 className="text-sm font-extrabold text-ink">표시 설정</h4>
        </div>
        <div className="p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={template.showWorkHours}
              onChange={(e) => setFlag('showWorkHours', e.target.checked)}
              className="accent-accent w-4 h-4" />
            <span className="text-sm font-semibold text-ink">연장·야간 근로시간 표 표시</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={template.showCalcMethod}
              onChange={(e) => setFlag('showCalcMethod', e.target.checked)}
              className="accent-accent w-4 h-4" />
            <span className="text-sm font-semibold text-ink">계산방법 섹션 표시</span>
          </label>
          <div className="grid grid-cols-[auto_1fr] items-center gap-3">
            <label className="text-sm font-semibold text-ink whitespace-nowrap">지급일 안내</label>
            <input value={template.payDayLabel}
              onChange={(e) => setStr('payDayLabel', e.target.value)}
              placeholder="예: 매월 15일"
              className="px-2.5 py-1.5 rounded-md border border-line text-sm focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-[auto_1fr] items-start gap-3">
            <label className="text-sm font-semibold text-ink whitespace-nowrap mt-1.5">하단 고지문</label>
            <textarea value={template.footer} rows={3}
              onChange={(e) => setStr('footer', e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-line text-xs font-semibold resize-y focus:outline-none focus:border-accent" />
          </div>
        </div>
      </section>

      {error && <div className="bg-red-50 border border-red-300 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
      {info  && <div className="bg-green-50 border border-green-300 rounded-md px-3 py-2 text-xs font-bold text-success">{info}</div>}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy}
          className="px-5 py-2.5 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 active:scale-95 disabled:opacity-50">
          {busy ? '저장 중…' : '저장'}
        </button>
        <p className="text-xs text-ink-muted font-semibold">저장 후 다음 업로드부터 새 항목이 적용됩니다.</p>
      </div>

      <div className="bg-blue-50 border border-blue-300 border-l-4 border-l-info rounded-md px-4 py-3 text-xs text-info font-semibold">
        <strong className="font-extrabold">엑셀 헤더 규칙</strong> — 항목 키 이름이 엑셀 헤더와 정확히 일치해야 합니다.
        예: 키를 <code className="bg-white px-1 rounded">기본급</code>으로 설정하면 엑셀 헤더도 <code className="bg-white px-1 rounded">기본급</code>이어야 합니다.
      </div>
    </div>
  );
}

type ColSectionProps = {
  title: string; section: ColSection; cols: PayslipColumn[];
  onAdd: () => void; onRemove: (i: number) => void;
  onChange: (i: number, f: keyof PayslipColumn, v: string | boolean) => void;
};
function ColSection({ title, cols, onAdd, onRemove, onChange }: ColSectionProps) {
  return (
    <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-surface-soft">
        <h4 className="text-sm font-extrabold text-ink">{title}</h4>
        <button onClick={onAdd} className="px-3 py-1 rounded-md bg-accent text-white text-xs font-extrabold hover:bg-cyan-800 active:scale-95">+ 추가</button>
      </div>
      <div className="p-3 space-y-2">
        {cols.map((col, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
            <input
              value={col.key}
              onChange={(e) => onChange(i, 'key', e.target.value)}
              placeholder="항목 키 (엑셀 헤더)"
              className="px-2.5 py-1.5 rounded-md border border-line text-xs font-bold focus:outline-none focus:border-accent"
            />
            <input
              value={col.label}
              onChange={(e) => onChange(i, 'label', e.target.value)}
              placeholder="표시명"
              className="px-2.5 py-1.5 rounded-md border border-line text-xs focus:outline-none focus:border-accent"
            />
            <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={col.required} onChange={(e) => onChange(i, 'required', e.target.checked)}
                className="accent-accent w-3.5 h-3.5" />
              <span className="text-xs font-semibold text-ink-muted">필수</span>
            </label>
            <button onClick={() => onRemove(i)} className="text-danger text-xs font-extrabold hover:underline px-1">삭제</button>
          </div>
        ))}
        {cols.length === 0 && (
          <p className="text-xs text-ink-muted font-semibold text-center py-2">항목 없음 — 추가 버튼으로 항목을 넣으세요.</p>
        )}
      </div>
    </section>
  );
}
