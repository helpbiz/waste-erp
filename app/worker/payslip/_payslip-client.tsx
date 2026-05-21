'use client';

import { useEffect, useState } from 'react';

/* ─── 타입 ──────────────────────────────────────────────────────── */
type WorkHours = { overtimeBasic: number; overtimeExtra: number; nightBasic: number; nightExtra: number };
type PayslipData = {
  employeeNo:   string | null;
  position:     string | null;
  birthDate:    string | null;
  hireDate:     string | null;
  workDays:     number | null;
  payDate:      string | null;
  hourlyRate:   number | null;
  earnings:     Record<string, number>;
  deductions:   Record<string, number>;
  extras:       Record<string, number>;
  workHours:    WorkHours | null;
  totals: Record<string, number>;
};

/* 구 필드명(지급합계/실수령액) → 신 필드명(임금소계/실지급액) 정규화 */
function normTotals(t: Record<string, number>) {
  return {
    임금소계: t['임금소계'] ?? t['지급합계'] ?? 0,
    공제소계: t['공제소계'] ?? t['공제합계'] ?? 0,
    실지급액: t['실지급액'] ?? t['실수령액'] ?? 0,
    총계:     t['총계']    ?? t['실수령액'] ?? t['실지급액'] ?? 0,
  };
}
type PayslipItem = { id: string; yearMonth: string; publishedAt: string | null; data: PayslipData };

const fmt   = (n: number) => n ? n.toLocaleString('ko-KR') : '-';
const dash  = (n: number | null | undefined) => (n && n !== 0) ? n.toLocaleString('ko-KR') : '-';

/* ─── 메인 ──────────────────────────────────────────────────────── */
export default function PayslipClient({ workerName }: { workerName: string }) {
  const [items,    setItems]    = useState<PayslipItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/payroll/payslips')
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-black text-ink tracking-tight">급여명세서</h1>
        <p className="text-xs text-ink-muted font-semibold mt-0.5">발송된 급여명세서를 확인하고 인쇄할 수 있습니다.</p>
      </div>

      {loading && <div className="px-4 py-16 text-center text-ink-muted text-sm">불러오는 중…</div>}

      {!loading && items.length === 0 && (
        <div className="px-4 py-16 text-center">
          <div className="text-4xl mb-2">💰</div>
          <div className="text-sm text-ink-muted font-bold">발송된 급여명세서가 없습니다</div>
        </div>
      )}

      <div className="px-4 pt-2 space-y-2">
        {items.map((item) => {
          const [y, m] = item.yearMonth.split('-');
          const isOpen = expanded === item.id;
          return (
            <article key={item.id} className="rounded-xl border-2 border-line bg-surface overflow-hidden shadow-card">
              {/* 목록 행 */}
              <button type="button" onClick={() => setExpanded(isOpen ? null : item.id)}
                className="w-full text-left px-4 py-3.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-base font-black">{m}월</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-ink">{y}년 {m}월 임금명세서</div>
                  {(() => { const t = normTotals(item.data.totals); return (
                  <div className="text-xs text-ink-muted font-semibold mt-0.5">
                    실지급액 <span className="text-success font-extrabold">{fmt(t.실지급액)}원</span>
                    {t.총계 !== t.실지급액 && <>&nbsp;· 총계 <span className="text-accent font-extrabold">{fmt(t.총계)}원</span></>}
                  </div>
                  ); })()}
                </div>
                <span className="text-ink-muted text-sm flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* 펼침: 명세서 전체 */}
              {isOpen && (
                <div className="border-t border-line">
                  <PayslipDetail item={item} workerName={workerName} month={m} year={y} />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ─── 명세서 상세 ────────────────────────────────────────────────── */
function PayslipDetail({ item, workerName, month, year }: { item: PayslipItem; workerName: string; month: string; year: string }) {
  const d = item.data;
  const totals = normTotals(d.totals);

  function handlePrint() {
    const win = window.open('', '_blank', 'width=780,height=1100');
    if (!win) return;
    win.document.write(buildPrintHtml({ item, workerName, month, year }));
    win.document.close();
  }

  return (
    <div className="px-4 pb-4 pt-3 space-y-4 text-[0.8125rem]">
      {/* 헤더 */}
      <div className="text-center py-2">
        <h2 className="text-base font-black text-ink tracking-widest">{month}월 임 금 명 세 서</h2>
        <p className="text-xs text-ink-muted font-bold mt-0.5">【 수 고 하 셨 습 니 다 ! 】</p>
        {d.payDate && <p className="text-xs text-ink-muted mt-0.5">· 지급일 : {d.payDate}</p>}
        {d.workDays != null && <p className="text-xs text-ink-muted">· 출근일수 : {d.workDays} 일</p>}
      </div>

      {/* 근로자 정보 */}
      <div className="bg-surface-soft rounded-lg border border-line overflow-hidden">
        <div className="grid grid-cols-2 border-b border-line">
          <Cell label="성명(사원번호)" value={`${workerName}${d.employeeNo ? `(${d.employeeNo})` : ''}`} />
          <Cell label="직 책" value={d.position ?? '-'} />
        </div>
        <div className="grid grid-cols-2">
          <Cell label="생년월일" value={d.birthDate ?? '-'} />
          <Cell label="입사년월일" value={d.hireDate ?? '-'} />
        </div>
      </div>

      {/* 임금구성항목 */}
      <div>
        <SectionHeader>임금구성항목</SectionHeader>
        <div className="border border-line rounded-b-lg overflow-hidden">
          {Object.entries(d.earnings).map(([k, v]) => (
            <Row key={k} label={k} value={dash(v)} />
          ))}
          <TotalRow label="임금 소계①" value={fmt(totals.임금소계)} accent />
        </div>
      </div>

      {/* 공제내역 */}
      <div>
        <SectionHeader>공 제 내 역</SectionHeader>
        <div className="border border-line rounded-b-lg overflow-hidden">
          {Object.entries(d.deductions).map(([k, v]) => (
            <Row key={k} label={k} value={dash(v)} />
          ))}
          <TotalRow label="공제 소계②" value={fmt(totals.공제소계)} danger />
        </div>
      </div>

      {/* 실지급액 */}
      <div className="bg-surface-soft border border-line rounded-lg overflow-hidden">
        <div className="flex justify-between items-center px-3 py-2">
          <span className="text-xs font-extrabold text-ink">실지급액 (①-②)</span>
          <span className="font-mono font-extrabold text-success">{fmt(totals.실지급액)}원</span>
        </div>
      </div>

      {/* 별도항목 + 총계 */}
      {Object.keys(d.extras ?? {}).length > 0 && (
        <div className="border border-line rounded-lg overflow-hidden">
          {Object.entries(d.extras).map(([k, v]) => (
            <div key={k} className="flex justify-between px-3 py-1.5 border-b border-line last:border-0 text-xs">
              <span className="text-ink-muted font-semibold">{k}</span>
              <span className="font-mono font-bold text-ink">{dash(v)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 bg-accent/10">
            <span className="text-xs font-extrabold text-accent">총 계</span>
            <span className="font-mono font-extrabold text-accent">{fmt(totals.총계)}원</span>
          </div>
        </div>
      )}

      {/* 근로시간 */}
      {d.workHours && (
        <div className="border border-line rounded-lg overflow-hidden text-xs">
          <SectionHeader>근 로 시 간</SectionHeader>
          <div className="divide-y divide-line">
            <div className="flex justify-between px-3 py-2">
              <span className="text-ink-muted font-semibold">연장근로시간</span>
              <span className="font-mono font-bold text-ink">{(d.workHours.overtimeBasic + d.workHours.overtimeExtra) || 0} 시간</span>
            </div>
            <div className="flex justify-between px-3 py-2">
              <span className="text-ink-muted font-semibold">야간근로시간</span>
              <span className="font-mono font-bold text-ink">{(d.workHours.nightBasic + d.workHours.nightExtra) || 0} 시간</span>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 버튼 */}
      <button type="button" onClick={handlePrint}
        className="w-full py-3 rounded-xl border-2 border-accent text-accent text-sm font-extrabold active:scale-[0.99] hover:bg-accent/5 transition">
        🖨 인쇄 / PDF 저장
      </button>
    </div>
  );
}

/* ─── 인쇄 HTML 생성 ─────────────────────────────────────────────── */
function buildPrintHtml({ item, workerName, month, year }: { item: PayslipItem; workerName: string; month: string; year: string }) {
  const d = item.data;
  const pt = normTotals(d.totals);
  const fmt = (n: number) => n ? n.toLocaleString('ko-KR') : '-';

  const earningsRows = Object.entries(d.earnings).map(([k, v]) =>
    `<tr><td class="label">${k}</td><td class="val">${fmt(v)}</td></tr>`).join('');

  const deductRows = Object.entries(d.deductions).map(([k, v]) =>
    `<tr><td class="label">${k}</td><td class="val">${fmt(v)}</td></tr>`).join('');

  const extraRows = Object.entries(d.extras ?? {}).map(([k, v]) =>
    `<tr><td class="label">${k}</td><td class="val">${fmt(v)}</td></tr>`).join('');

  const wh = d.workHours;
  const workHoursSection = wh ? `
    <table class="main-table" style="margin-top:12px">
      <tr><td colspan="2" class="section-header">근 로 시 간</td></tr>
      <tr><td class="label">연장근로시간</td><td class="val bold">${(wh.overtimeBasic+wh.overtimeExtra)||0} 시간</td></tr>
      <tr><td class="label">야간근로시간</td><td class="val bold">${(wh.nightBasic+wh.nightExtra)||0} 시간</td></tr>
    </table>` : '';

  const calcSection = (d.hourlyRate && wh) ? `
    <table class="main-table" style="margin-top:12px">
      <tr><td class="section-header" colspan="3">계산방법</td></tr>
      <tr><td class="sub-header">구분</td><td class="sub-header">산출방법</td><td class="sub-header">계산금액</td></tr>
      <tr><td class="label">연장근로수당</td><td class="label">${(wh.overtimeBasic+wh.overtimeExtra)||0}시간 × ${d.hourlyRate.toLocaleString('ko-KR')} × 150%</td><td class="val">${fmt(d.earnings['연장근로수당']||0)}</td></tr>
      <tr><td class="label">야간근로수당</td><td class="label">${(wh.nightBasic+wh.nightExtra)||0}시간 × ${d.hourlyRate.toLocaleString('ko-KR')} × 50%</td><td class="val">${fmt(d.earnings['야간근로수당']||0)}</td></tr>
    </table>` : '';

  return `<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8"><title>${year}년 ${month}월 임금명세서 - ${workerName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;padding:28px;font-size:12px;color:#111;max-width:700px;margin:0 auto}
  h1{text-align:center;font-size:20px;font-weight:900;letter-spacing:.3em;margin-bottom:3px}
  .subtitle{text-align:center;font-size:13px;font-weight:700;margin-bottom:3px}
  .meta{font-size:11px;margin-bottom:16px}
  .main-table{width:100%;border-collapse:collapse;margin-bottom:0}
  .main-table td,.main-table th{border:1px solid #bbb;padding:4px 8px;font-size:11px}
  .section-header{background:#d0e8f8;font-weight:900;text-align:center;font-size:11px;letter-spacing:.05em}
  .sub-header{background:#f0f0f0;font-weight:700;text-align:center;font-size:10px}
  .label{width:45%;font-weight:600;letter-spacing:.03em}
  .val{text-align:right;font-weight:700}
  .bold{font-weight:900}
  .subtotal{background:#e8f7e8;font-weight:900}
  .subtotal-d{background:#fff0f0;font-weight:900}
  .net{background:#d4edda;font-weight:900;font-size:13px}
  .total{background:#cce5ff;font-weight:900;font-size:13px}
  .info-table{width:100%;border-collapse:collapse;margin-bottom:10px}
  .info-table td{border:1px solid #bbb;padding:5px 8px;font-size:11px}
  .info-label{background:#f5f5f5;font-weight:700;width:30%}
  .two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
  .print-btn{display:block;margin:0 auto 14px;padding:8px 24px;background:#0077cc;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
  .footer{margin-top:14px;font-size:10px;color:#444;line-height:1.7;border-top:1px solid #ccc;padding-top:8px}
  .footer .warn{color:#c00;font-weight:700}
  @media print{.print-btn{display:none}.footer{page-break-inside:avoid}}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨 인쇄</button>
<h1>${month}월 임 금 명 세 서</h1>
<div class="subtitle">【 수 고 하 셨 습 니 다 ! 】</div>
<div class="meta">
  ${d.payDate ? `· 지급일 : ${d.payDate}<br>` : ''}
  ${d.workDays != null ? `· 출근일수 : ${d.workDays} 일` : ''}
</div>

<table class="info-table">
  <tr>
    <td class="info-label">성명(사원번호)</td>
    <td>${workerName}${d.employeeNo ? `(${d.employeeNo})` : ''}</td>
    <td class="info-label">직 책</td>
    <td>${d.position ?? '-'}</td>
  </tr>
  <tr>
    <td class="info-label">생년월일</td>
    <td>${d.birthDate ?? '-'}</td>
    <td class="info-label">입사년월일</td>
    <td>${d.hireDate ?? '-'}</td>
  </tr>
</table>

<table class="main-table" style="margin-bottom:8px">
  <tr><td colspan="2" class="section-header">임 금 구 성 항 목</td></tr>
  ${earningsRows}
  <tr class="subtotal"><td class="label bold">임금 소계①</td><td class="val">${(pt.임금소계 || 0).toLocaleString('ko-KR')}</td></tr>
</table>

<table class="main-table" style="margin-bottom:8px">
  <tr><td colspan="2" class="section-header">공 제 내 역</td></tr>
  ${deductRows}
  <tr class="subtotal-d"><td class="label bold">공제 소계②</td><td class="val">${(pt.공제소계 || 0).toLocaleString('ko-KR')}</td></tr>
</table>

<table class="main-table">
  <tr class="net"><td class="label bold" style="text-align:center">실지급액 (①-②)</td><td class="val" style="font-size:14px">${(pt.실지급액 || 0).toLocaleString('ko-KR')}</td></tr>
</table>

${extraRows ? `<table class="main-table" style="margin-top:8px">${extraRows}
  <tr class="total"><td class="label bold" style="text-align:center">총 계</td><td class="val" style="font-size:13px">${(pt.총계 || 0).toLocaleString('ko-KR')}</td></tr>
</table>` : ''}

${workHoursSection}
${calcSection}

<div class="footer">
  <span>※ 근로기준법 시행령에 의거 작성함.(2021년11월19일 시행)</span><br>
  <span class="warn">※ 개인정보 공유금지</span>
</div>
</body></html>`;
}

/* ─── 공용 컴포넌트 ──────────────────────────────────────────────── */
function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <div className="text-[0.625rem] font-extrabold text-ink-muted">{label}</div>
      <div className="text-xs font-bold text-ink mt-0.5">{value}</div>
    </div>
  );
}
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-1.5 bg-blue-100 text-blue-900 text-[0.6875rem] font-extrabold tracking-wide border border-line rounded-t-lg">{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-1.5 border-b border-line last:border-0 text-xs">
      <span className="text-ink-muted font-semibold">{label}</span>
      <span className="font-mono font-bold text-ink">{value}</span>
    </div>
  );
}
function TotalRow({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  const cls = accent ? 'bg-accent/10 text-accent' : danger ? 'bg-red-50 text-danger' : 'bg-surface-soft text-ink';
  return (
    <div className={`flex justify-between px-3 py-2 text-xs font-extrabold ${cls}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
