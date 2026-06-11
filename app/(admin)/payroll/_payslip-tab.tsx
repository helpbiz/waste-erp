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

type WorkHours = {
  연장기본?: number; 연장추가?: number; 야간기본?: number; 야간추가?: number;
  overtimeBasic?: number; overtimeExtra?: number; nightBasic?: number; nightExtra?: number;
};

type PublishedRecord = {
  id: string; workerId: string; workerName: string; employeeNo: string | null;
  yearMonth: string; isPublished: boolean; publishedAt: string | null;
  approvedAt: string | null;
  data: {
    totals: PayslipTotals;
    workDays?: number;
    payDate?: string | null;
    earnings?: Record<string, number>;
    deductions?: Record<string, number>;
    extras?: Record<string, number>;
    workHours?: WorkHours;
  };
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
  const [payDateInput, setPayDateInput] = useState('');
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [info,        setInfo]        = useState<string | null>(null);
  const [tmpl,        setTmpl]        = useState<Template | null>(null);
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
  const [expandedId,  setExpandedId]  = useState<string | null>(null);

  function printPayslip(r: PublishedRecord) {
    const win = window.open('', '_blank');
    if (!win) return;
    const d = r.data;
    const fmt = (v: number) => v.toLocaleString('ko-KR') + '원';
    const earningRows = sortByTemplate(Object.entries(d.earnings ?? {}) as [string, number][], tmpl?.earnings)
      .map(([k, v]) => `<tr><td class="label">${k}</td><td class="val">${fmt(v)}</td></tr>`).join('');
    const extrasRows = Object.entries(d.extras ?? {}).filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `<tr><td class="label">${k}</td><td class="val">${fmt(v as number)}</td></tr>`).join('');
    const deductRows = sortByTemplate(Object.entries(d.deductions ?? {}) as [string, number][], tmpl?.deductions)
      .map(([k, v]) => `<tr><td class="label">${k}</td><td class="val">${fmt(v)}</td></tr>`).join('');
    const wh = d.workHours;
    const overtimeH = wh ? (wh['연장기본'] ?? wh['overtimeBasic'] ?? 0) + (wh['연장추가'] ?? wh['overtimeExtra'] ?? 0) : 0;
    const nightH    = wh ? (wh['야간기본'] ?? wh['nightBasic'] ?? 0) + (wh['야간추가'] ?? wh['nightExtra'] ?? 0) : 0;
    win.document.write([
      '<html><head><meta charset="utf-8"><title>임금명세서</title>',
      '<style>',
      'body{font-family:\'맑은 고딕\',sans-serif;padding:20px;font-size:13px}',
      'h2{font-size:1.1em;margin-bottom:8px}',
      '.meta{color:#555;margin-bottom:12px;font-size:12px}',
      'table{width:100%;border-collapse:collapse;margin-bottom:10px}',
      'td{border:1px solid #ccc;padding:5px 9px}',
      'thead td{background:#f5f5f5;font-weight:700}',
      'td.label{width:55%}td.val{text-align:right;font-family:monospace;font-weight:700}',
      '.net{background:#dbeafe;font-weight:900;font-size:1.05em;padding:8px 9px;border:1px solid #93c5fd}',
      '.hours{color:#555;font-size:12px;margin-top:4px}',
      '@media print{body{padding:8px}}',
      '</style></head><body>',
      `<h2>${r.workerName} (${r.yearMonth}) 임금명세서</h2>`,
      '<div class="meta">',
      d.workDays != null ? `출근일수: <b>${d.workDays}일</b>&nbsp;&nbsp;` : '',
      d.payDate ? `지급일: <b>${d.payDate}</b>` : '',
      '</div>',
      '<table><thead><tr><td>지급항목</td><td style="text-align:right">금액</td></tr></thead><tbody>',
      earningRows, extrasRows,
      '</tbody></table>',
      '<table><thead><tr><td>공제항목</td><td style="text-align:right">금액</td></tr></thead><tbody>',
      deductRows,
      '</tbody></table>',
      `<div class="net">실수령액: ${getNetPay(d.totals).toLocaleString('ko-KR')}원</div>`,
      (wh && (overtimeH > 0 || nightH > 0))
        ? `<div class="hours">연장근로: <b>${overtimeH}시간</b>&nbsp;&nbsp;야간근로: <b>${nightH}시간</b></div>`
        : '',
      '</body></html>',
    ].join(''));
    win.document.close();
    win.print();
  }
  const [loadingList, setLoadingList] = useState(false);
  const [expandRow,   setExpandRow]   = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadList = useCallback(async () => {
    setLoadingList(true);
    const [listRes, tmplRes] = await Promise.all([
      fetch(`/api/payroll/payslips?yearMonth=${ym}`).catch(() => null),
      fetch('/api/payroll/payslip-template').catch(() => null),
    ]);
    if (listRes?.ok) {
      const d = await listRes.json();
      setPublished(d.items ?? []);
    }
    if (tmplRes?.ok) {
      const d = await tmplRes.json();
      setTmpl(d.template ?? DEFAULT_TEMPLATE);
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
    if (payDateInput.trim()) fd.append('payDate', payDateInput.trim());
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
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[0.6875rem] font-extrabold text-ink-muted">지급일 <span className="text-ink-faint font-normal">(미입력 시 템플릿 기본값)</span></label>
            <input
              type="text"
              value={payDateInput}
              onChange={(e) => setPayDateInput(e.target.value)}
              placeholder="예) 2026년 6월 12일"
              className="px-3 py-1.5 rounded-md border border-line text-sm font-mono w-44 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
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
                    {(needsApproval ? ['이름', '직원번호', '실수령액', '결재', '발송상태', ''] : ['이름', '직원번호', '실수령액', '발송상태', '']).map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-extrabold text-ink uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {published.map((r, i) => (<>
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
                      <td className="px-3 py-2 border-b border-line">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                            className="text-xs font-extrabold text-accent hover:underline"
                          >
                            {expandedId === r.id ? '닫기' : '내용보기'}
                          </button>
                          <button
                            disabled={deletingIds.has(r.id)}
                            onClick={async () => {
                              if (!confirm(`${r.workerName}(${r.yearMonth}) 명세서를 삭제하시겠습니까?`)) return;
                              setDeletingIds((s) => new Set(s).add(r.id));
                              try {
                                const res = await fetch(`/api/payroll/payslips?id=${r.id}`, { method: 'DELETE' });
                                if (res.ok) { await loadList(); }
                                else { const d = await res.json().catch(()=>({})); alert(d.error ?? '삭제 실패'); }
                              } finally {
                                setDeletingIds((s) => { const n = new Set(s); n.delete(r.id); return n; });
                              }
                            }}
                            className="text-xs font-extrabold text-danger hover:underline disabled:opacity-50"
                          >
                            {deletingIds.has(r.id) ? '삭제 중…' : '삭제'}
                          </button>
                        </div>
                      </td>
                    </tr>,
                    {expandedId === r.id && (
                      <tr key={r.id + '-detail'}>
                        <td colSpan={needsApproval ? 6 : 5} className="px-4 py-3 bg-slate-50 border-b border-line">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-extrabold text-ink">{r.workerName} ({r.yearMonth}) 임금명세서</span>
                            <button onClick={() => printPayslip(r)} className="text-xs font-extrabold text-emerald-700 hover:underline">🖨 인쇄</button>
                          </div>
                          <PublishedPayslipDetail data={r.data} template={tmpl} />
                        </td>
                      </tr>
                    )}
                  </>))}
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

/* ─── 발송된 명세서 상세 뷰 ──────────────────────────────────────── */
function sortByTemplate(entries: [string, number][], cols?: PayslipColumn[]): [string, number][] {
  if (!cols || cols.length === 0) return entries;
  const order = new Map(cols.map((c, i) => [c.key, i]));
  return [...entries].sort(([a], [b]) => {
    const ia = order.get(a) ?? 999;
    const ib = order.get(b) ?? 999;
    return ia - ib;
  });
}

function PublishedPayslipDetail({ data, template }: { data: PublishedRecord['data']; template?: Template | null }) {
  const net = getNetPay(data.totals);
  const wh = data.workHours;
  const overtimeH = (wh?.연장기본 ?? wh?.overtimeBasic ?? 0) + (wh?.연장추가 ?? wh?.overtimeExtra ?? 0);
  const nightH    = (wh?.야간기본 ?? wh?.nightBasic ?? 0)    + (wh?.야간추가 ?? wh?.nightExtra ?? 0);

  const earningEntries = sortByTemplate(Object.entries(data.earnings ?? {}) as [string, number][], template?.earnings);
  const deductEntries  = sortByTemplate(Object.entries(data.deductions ?? {}) as [string, number][], template?.deductions);

  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      {(data.workDays != null || data.payDate) && (
        <div className="col-span-2 flex gap-4 text-ink-muted flex-wrap">
          {data.workDays != null && <span>출근일수: <b className="text-ink">{data.workDays}일</b></span>}
          {data.payDate && <span>지급일: <b className="text-ink">{data.payDate}</b></span>}
        </div>
      )}
      <div>
        <div className="font-extrabold text-ink mb-1">지급 항목</div>
        {earningEntries.map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5 border-b border-line">
            <span className="text-ink-muted">{k}</span>
            <span className="font-mono font-bold">{(v as number).toLocaleString('ko-KR')}</span>
          </div>
        ))}
        {Object.entries(data.extras ?? {}).filter(([, v]) => (v as number) > 0).map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5 border-b border-line">
            <span className="text-ink-muted">{k}</span>
            <span className="font-mono font-bold">{(v as number).toLocaleString('ko-KR')}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="font-extrabold text-ink mb-1">공제 항목</div>
        {deductEntries.map(([k, v]) => (
          <div key={k} className="flex justify-between py-0.5 border-b border-line">
            <span className="text-ink-muted">{k}</span>
            <span className="font-mono font-bold">{(v as number).toLocaleString('ko-KR')}</span>
          </div>
        ))}
      </div>
      <div className="col-span-2 bg-accent/10 rounded-lg px-3 py-1.5 flex items-center justify-between">
        <span className="font-extrabold text-accent text-sm">실수령액</span>
        <span className="font-mono font-black text-accent">{net.toLocaleString('ko-KR')}원</span>
      </div>
      {wh && (overtimeH > 0 || nightH > 0) && (
        <div className="col-span-2 grid grid-cols-2 gap-2 text-xs border border-line rounded-lg px-3 py-2">
          <span className="text-ink-muted">연장근로: <b className="text-ink font-mono">{overtimeH}시간</b></span>
          <span className="text-ink-muted">야간근로: <b className="text-ink font-mono">{nightH}시간</b></span>
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
  function moveCol(section: ColSection, idx: number, dir: -1 | 1) {
    if (!template) return;
    const cols = [...template[section]];
    const target = idx + dir;
    if (target < 0 || target >= cols.length) return;
    [cols[idx], cols[target]] = [cols[target], cols[idx]];
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
        onChange={(i, f, v) => updateCol('earnings', i, f, v)}
        onMoveUp={(i) => moveCol('earnings', i, -1)} onMoveDown={(i) => moveCol('earnings', i, 1)} />

      <ColSection title="공제내역" section="deductions" cols={template.deductions}
        onAdd={() => addCol('deductions')} onRemove={(i) => removeCol('deductions', i)}
        onChange={(i, f, v) => updateCol('deductions', i, f, v)}
        onMoveUp={(i) => moveCol('deductions', i, -1)} onMoveDown={(i) => moveCol('deductions', i, 1)} />

      <ColSection title="별도항목 (급식비·생일축하금 등)" section="extras" cols={template.extras}
        onAdd={() => addCol('extras')} onRemove={(i) => removeCol('extras', i)}
        onChange={(i, f, v) => updateCol('extras', i, f, v)}
        onMoveUp={(i) => moveCol('extras', i, -1)} onMoveDown={(i) => moveCol('extras', i, 1)} />

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
  onMoveUp?: (i: number) => void;
  onMoveDown?: (i: number) => void;
};
function ColSection({ title, cols, onAdd, onRemove, onChange, onMoveUp, onMoveDown }: ColSectionProps) {
  return (
    <section className="bg-surface rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-surface-soft">
        <div>
          <h4 className="text-sm font-extrabold text-ink">{title}</h4>
          <p className="text-[0.625rem] text-ink-muted font-mono mt-0.5">출력 순서 = 목록 순서 · ↑↓ 로 변경</p>
        </div>
        <button onClick={onAdd} className="px-3 py-1 rounded-md bg-accent text-white text-xs font-extrabold hover:bg-cyan-800 active:scale-95">+ 추가</button>
      </div>
      {/* 컬럼 헤더 */}
      <div className="px-3 pt-2 pb-1 grid grid-cols-[28px_1fr_1fr_56px_48px_32px] gap-2 text-[0.625rem] font-extrabold text-ink-muted uppercase tracking-wide">
        <span className="text-center">순서</span>
        <span>항목 키 (엑셀 헤더)</span>
        <span>출력 표시명</span>
        <span className="text-center">필수</span>
        <span className="text-center">이동</span>
        <span></span>
      </div>
      <div className="px-3 pb-3 space-y-1.5">
        {cols.map((col, i) => (
          <div key={i} className="grid grid-cols-[28px_1fr_1fr_56px_48px_32px] gap-2 items-center bg-surface-soft/50 rounded-lg px-2 py-1.5">
            {/* 순서 번호 */}
            <span className="text-center text-[0.75rem] font-mono font-extrabold text-ink-muted">{i + 1}</span>
            {/* 항목 키 */}
            <input
              value={col.key}
              onChange={(e) => onChange(i, 'key', e.target.value)}
              placeholder="기본급"
              className="px-2 py-1 rounded border border-line text-xs font-bold focus:outline-none focus:border-accent bg-white"
            />
            {/* 표시명 */}
            <input
              value={col.label}
              onChange={(e) => onChange(i, 'label', e.target.value)}
              placeholder="기본급"
              className="px-2 py-1 rounded border border-line text-xs focus:outline-none focus:border-accent bg-white"
            />
            {/* 필수 */}
            <label className="flex items-center justify-center gap-1 cursor-pointer">
              <input type="checkbox" checked={col.required} onChange={(e) => onChange(i, 'required', e.target.checked)}
                className="accent-accent w-3.5 h-3.5" />
              <span className={`text-[0.625rem] font-extrabold ${col.required ? 'text-danger' : 'text-ink-muted'}`}>
                {col.required ? '필수' : '선택'}
              </span>
            </label>
            {/* ↑↓ 이동 */}
            <div className="flex gap-0.5 justify-center">
              <button
                onClick={() => onMoveUp?.(i)}
                disabled={i === 0}
                className="w-5 h-5 rounded text-[0.75rem] font-bold text-ink-muted hover:bg-surface hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="위로"
              >↑</button>
              <button
                onClick={() => onMoveDown?.(i)}
                disabled={i === cols.length - 1}
                className="w-5 h-5 rounded text-[0.75rem] font-bold text-ink-muted hover:bg-surface hover:text-accent disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                title="아래로"
              >↓</button>
            </div>
            {/* 삭제 */}
            <button onClick={() => onRemove(i)} className="text-danger text-xs font-extrabold hover:underline text-center" title="삭제">✕</button>
          </div>
        ))}
        {cols.length === 0 && (
          <p className="text-xs text-ink-muted font-semibold text-center py-3">항목 없음 — 추가 버튼으로 항목을 넣으세요.</p>
        )}
      </div>
    </section>
  );
}
