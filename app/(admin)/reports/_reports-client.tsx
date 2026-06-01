'use client';

import { useEffect, useState } from 'react';
import DailyTreatmentTab from './daily-treatment/_daily-treatment-tab';

type ReportTab = 'master' | 'f02';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: '슈퍼관리자', MUNI_ADMIN: '지자체 관리자', CONTRACTOR_ADMIN: '업체관리자',
  INTERNAL_ADMIN: '내부관리자', WORKER: '근로자',
};
const LEAVE_TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차', ANNUAL_HALF: '연차(반차)', SPECIAL: '경조사', MATERNITY: '출산',
  FAMILY_CARE: '가족돌봄', MENSTRUAL: '생리', OFFICIAL: '공가',
  SICK: '병가', BUSINESS_TRIP: '출장', TRAINING: '교육', OTHER: '기타',
};
const COMPLAINT_TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거 미비', ILLEGAL_DUMP: '불법투기', ODOR_NOISE: '악취/소음',
  BULKY_WASTE: '대형폐기물', OTHER: '기타',
};
const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수', ASSIGNED: '배정', IN_PROGRESS: '처리중', COMPLETED: '완료', REJECTED: '반려',
};
const MATERIAL_LABEL: Record<string, string> = {
  GENERAL: '일반', FOOD: '음식물', RECYCLING: '재활용', WOOD: '폐목재',
  COAL_ASH: '연탄재', MIXED_BLDG: '혼합건폐', PLASTIC: '합성수지', BATTERY: '폐건전지',
  FLUORESCENT: '폐형광등', MILK_CARTON: '우유팩', VINYL: '폐비닐', POCKET_SPRING: '포켓스프링',
  SCRAP_IRON: '잡철', STYROFOAM: '스티로폼',
};
const SAFETY_TYPE_LABEL: Record<string, string> = {
  DAILY_CHECKLIST: '일일점검', NEAR_MISS: '아차사고', INCIDENT: '재해', TBM_SIGNATURE: 'TBM 서명',
};
const SEV_LABEL: Record<string, string> = {
  NONE: '일반', MINOR: '경미', INJURY: '부상', SEVERE: '중상', FATAL: '사망',
};

type Stats = {
  range: { from: string; to: string };
  hr: { total: number; byRole: Array<{ role: string; count: number }>; byPosition: Array<{ code: string; label: string; count: number; category: string }>; byDepartment: Array<{ name: string; count: number }> };
  attendance: { records: number; checkedIn: number; checkedOut: number; earlyLeaves: number; pendingApproval: number; daily: Array<{ date: string; count: number }> };
  leave: { requests: number; approved: number; pending: number; inReview: number; rejected: number; approvedDays: number; byType: Array<{ type: string; count: number }> };
  complaints: {
    total: number;
    byType: Array<{ type: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    byHour: Array<{ hour: number; count: number }>;
    byWeekday: Array<{ day: number; count: number }>;
    byMonth: Array<{ ym: string; count: number }>;
    byArea: Array<{ area: string; count: number }>;
    byContractor: Array<{ contractorId: string; name: string; count: number }>;
    performance: {
      avgResolveHours: number;
      resolvedCount: number;
      overdueCount: number;
      overdueRate: number;
      urgentCount: number;
      unassignedCount: number;
      avgReportToDepartMin: number;
      avgDepartToArriveMin: number;
      avgArriveToResolveMin: number;
      departToArriveCount: number;
    };
    satisfaction: { count: number; avg: number; byScore: Array<{ score: number; count: number }> };
    byWorker: Array<{ workerId: string; name: string; count: number; resolvedCount: number; avgResolveHours: number; avgDepartToArriveMin: number; avgArriveToResolveMin: number }>;
  };
  vehicles: { total: number; active: number; maintenance: number; logsCount: number; wasteKg: number; wasteTon: number; fuelL: number; totalKm: number };
  waste: { total: number; records: number; byMaterial: Array<{ code: string; weight: number }> };
  intake: { total: number; records: number; byCategory: Array<{ code: string; weight: number }>; byVehicle: Array<{ vehicleId: string; vehicleNo: string; weight: number; count: number }> };
  safety: { total: number; byType: Array<{ type: string; count: number }>; bySeverity: Array<{ severity: string; count: number }> };
};

export default function ReportsClient({ session, isAvac = false }: { session: { role: string; name: string }; isAvac?: boolean }) {
  const [reportTab, setReportTab] = useState<ReportTab>('master');

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-card overflow-x-auto print:hidden">
        <TabBtn active={reportTab === 'master'} onClick={() => setReportTab('master')}>📊 통합 운영 보고서</TabBtn>
        {!isAvac && (
          <TabBtn active={reportTab === 'f02'} onClick={() => setReportTab('f02')}>📄 일일 처리실적 일보</TabBtn>
        )}
      </nav>
      {reportTab === 'master' && <MasterStatsView session={session} isAvac={isAvac} />}
      {reportTab === 'f02' && !isAvac && <DailyTreatmentTab role={session.role} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-extrabold whitespace-nowrap transition min-h-[44px] ${
        active ? 'bg-accent text-white shadow-sm' : 'text-ink hover:bg-surface-soft'
      }`}
    >
      {children}
    </button>
  );
}

function MasterStatsView({ session, isAvac = false }: { session: { role: string; name: string }; isAvac?: boolean }) {
  const ymStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const ymEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
  const [from, setFrom] = useState(ymStart);
  const [to, setTo] = useState(ymEnd);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  /* 사용자 요청 2026-04-29: 위탁업체별 개별/통합 보고서.
     contractorId='' = 통합 (전체) / 특정 id = 개별 보고서. */
  const [contractorId, setContractorId] = useState<string>('');
  const [contractorOpts, setContractorOpts] = useState<Array<{ id: string; companyName: string; municipalityName: string | null }>>([]);

  /* SUPER/MUNI/CONTRACTOR 모두 본인 가시범위 안의 업체 목록 fetch */
  useEffect(() => {
    fetch('/api/contractors')
      .then((r) => r.json())
      .then((d) => setContractorOpts(d.items ?? []))
      .catch(() => null);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (contractorId) params.set('contractorId', contractorId);
      const r = await fetch(`/api/reports/master-stats?${params}`);
      setData(await r.json());
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function quick(kind: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear') {
    const now = new Date();
    let f: Date, t: Date;
    if (kind === 'thisMonth') { f = new Date(now.getFullYear(), now.getMonth(), 1); t = new Date(now.getFullYear(), now.getMonth() + 1, 0); }
    else if (kind === 'lastMonth') { f = new Date(now.getFullYear(), now.getMonth() - 1, 1); t = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (kind === 'lastYear') { f = new Date(now.getFullYear() - 1, 0, 1); t = new Date(now.getFullYear() - 1, 11, 31); }
    else { f = new Date(now.getFullYear(), 0, 1); t = new Date(now.getFullYear(), 11, 31); }
    setFrom(f.toISOString().slice(0, 10));
    setTo(t.toISOString().slice(0, 10));
  }
  function printNow() { if (typeof window !== 'undefined') window.print(); }

  async function exportComplaints() {
    try {
      const params = new URLSearchParams({ format: 'xlsx', from, to });
      if (contractorId) params.set('contractorId', contractorId);
      const res = await fetch(`/api/complaints/export?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `민원대장_${from}_${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  async function exportAttendance() {
    try {
      const ym = from.slice(0, 7);
      const params = new URLSearchParams({ ym });
      if (contractorId) params.set('contractorId', contractorId);
      const res = await fetch(`/api/print/attendance-excel?${params}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `출근대장_${ym}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }

  const max = (arr: number[]) => Math.max(1, ...arr);

  return (
    <div className="space-y-5">
      {/* 컨트롤 (인쇄 시 숨김) */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        {/* 위탁업체 선택 — 통합 vs 개별 */}
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">위탁업체</div>
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className="px-3 py-1.5 rounded border border-line text-sm font-bold min-w-[180px]"
            aria-label="위탁업체 선택"
          >
            <option value="">📊 통합 (전체)</option>
            {contractorOpts.map((c) => (
              <option key={c.id} value={c.id}>
                🏢 {c.companyName}{c.municipalityName ? ` (${c.municipalityName})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일"
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[0.625rem] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일"
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <div className="flex items-end gap-1">
          <button onClick={() => quick('thisMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">이번 달</button>
          <button onClick={() => quick('lastMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">전월</button>
          <button onClick={() => quick('thisYear')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">올해</button>
          <button onClick={() => quick('lastYear')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[0.6875rem] font-bold hover:bg-slate-50">전년</button>
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={exportComplaints}
            className="px-3 py-1.5 rounded border border-line bg-surface text-sm font-extrabold text-ink hover:bg-surface-soft flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            민원 Excel
          </button>
          <button onClick={exportAttendance}
            className="px-3 py-1.5 rounded border border-line bg-surface text-sm font-extrabold text-ink hover:bg-surface-soft flex items-center gap-1.5">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            출근대장 Excel
          </button>
          <button onClick={printNow}
            className="px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-700 text-white hover:bg-emerald-800">
            🖨 보고서 출력
          </button>
        </div>
      </div>

      {!data && <div className="text-center py-12 text-slate-700 font-bold">조회 중…</div>}

      {data && (
        <div className="bg-white border-t-4 border-double border-slate-700 pt-4 px-4 print:px-2 print:pt-0">
          <h1 className="text-3xl font-black text-center mb-1">통합 운영 보고서</h1>
          <div className="text-center text-sm font-bold text-slate-600 mb-1">{data.range.from} ~ {data.range.to}</div>
          {/* 업체명 — 개별 업체 선택 시 표시, 통합 시 '전체 업체' */}
          <div className="text-center text-base font-extrabold text-ink mb-1">
            {contractorId
              ? contractorOpts.find((c) => c.id === contractorId)?.companyName ?? '위탁업체'
              : '전체 업체 (통합)'}
          </div>
          <div className="text-center text-[0.6875rem] font-mono text-slate-600 mb-6">
            출력자: {session.name} ({ROLE_LABEL[session.role]}) · 출력일시: {new Date().toLocaleString('ko-KR')}
          </div>

          {/* 1. 인사 — 5 카드 (사용자 요청 2026-04-29 v2 — positions 7종 재정의 반영).
              운전원   = DRIVER
              수거원   = COLLECTOR + CLEANER (미화원 포함 — 사용자 요청)
              현장지원 = INDIRECT (간접인력)
              관리직   = OFFICE 카테고리 전체 (EXECUTIVE / MANAGER / ADMIN_STAFF) */}
          <Section no={1} title="인사 현황" color="text-blue-700">
            {(() => {
              const drivers = data.hr.byPosition.find((p) => p.code === 'DRIVER')?.count ?? 0;
              /* 수거원 = COLLECTOR + CLEANER (미화원) */
              const collectors = data.hr.byPosition
                .filter((p) => p.code === 'COLLECTOR' || p.code === 'CLEANER')
                .reduce((s, p) => s + p.count, 0);
              /* 현장지원 = INDIRECT (간접인력) — legacy(RAPID/STREET_CLEAN/ALLEY_CLEAN) 도 호환 합산 */
              const fieldSupport = data.hr.byPosition
                .filter((p) =>
                  p.code === 'INDIRECT' ||
                  /* legacy 호환 */
                  p.code === 'RAPID' || p.code === 'STREET_CLEAN' || p.code === 'ALLEY_CLEAN'
                )
                .reduce((s, p) => s + p.count, 0);
              /* 관리직 = OFFICE 카테고리 전체 (EXECUTIVE/MANAGER/ADMIN_STAFF + legacy CEO/EXEC/...) */
              const management = data.hr.byPosition
                .filter((p) => p.category === 'OFFICE')
                .reduce((s, p) => s + p.count, 0);
              return (
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <KCard label="전체 인원" value={`${data.hr.total}명`} tone="accent" />
                  <KCard label="운전원" value={`${drivers}명`} />
                  <KCard label="수거원" value={`${collectors}명`} />
                  <KCard label="현장지원" value={`${fieldSupport}명`} />
                  <KCard label="관리직" value={`${management}명`} />
                </div>
              );
            })()}
          </Section>

          {/* 2. 근태 */}
          <Section no={2} title="근태 현황" color="text-cyan-700">
            <div className="grid grid-cols-5 gap-3">
              <KCard label="기록" value={`${data.attendance.records}건`} />
              <KCard label="출근" value={`${data.attendance.checkedIn}명`} tone="success" />
              <KCard label="퇴근" value={`${data.attendance.checkedOut}명`} tone="accent" />
              <KCard label="조퇴" value={`${data.attendance.earlyLeaves}명`} tone="warning" />
              <KCard label="결재 대기" value={`${data.attendance.pendingApproval}건`} tone="warning" />
            </div>
          </Section>

          {/* 3. 휴가 — 사용자 요청 2026-04-29: 유형별 카드 숨김. KCard 5건만 유지. */}
          <Section no={3} title="휴가 현황" color="text-emerald-700">
            <div className="grid grid-cols-5 gap-3 mb-3">
              <KCard label="신청" value={`${data.leave.requests}건`} />
              <KCard label="결재 완료" value={`${data.leave.approved}건`} tone="success" />
              <KCard label="결재 중" value={`${data.leave.inReview}건`} tone="warning" />
              <KCard label="대기" value={`${data.leave.pending}건`} />
              <KCard label="승인 일수" value={`${data.leave.approvedDays}일`} tone="accent" />
            </div>
          </Section>

          {/* 4. 민원 — 분포 시각화 보강 (사용자 요청 2026-04-29) */}
          <Section no={4} title="민원 현황 · 분포 시각화" color="text-amber-700">
            {/* KPI 1열: 처리 성과 핵심 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <KCard label="전체 민원" value={`${data.complaints.total}건`} />
              <KCard label="평균 처리시간" value={`${data.complaints.performance.avgResolveHours}h`} unit={`(완료 ${data.complaints.performance.resolvedCount}건)`} tone="accent" />
              <KCard label="기한 초과" value={`${data.complaints.performance.overdueCount}건`} unit={`${data.complaints.performance.overdueRate}%`} tone={data.complaints.performance.overdueCount > 0 ? 'warning' : 'success'} />
              <KCard label="미배정" value={`${data.complaints.performance.unassignedCount}건`} tone={data.complaints.performance.unassignedCount > 0 ? 'warning' : 'success'} />
            </div>

            {/* KPI 2열: 긴급/만족도 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <KCard label="긴급 표시" value={`${data.complaints.performance.urgentCount}건`} tone={data.complaints.performance.urgentCount > 0 ? 'warning' : 'default'} />
              <KCard label="만족도 평균" value={data.complaints.satisfaction.count > 0 ? `${data.complaints.satisfaction.avg}/5` : '—'} unit={`(${data.complaints.satisfaction.count}건)`} tone={data.complaints.satisfaction.avg >= 4 ? 'success' : data.complaints.satisfaction.avg >= 3 ? 'default' : 'warning'} />
              <KCard label="유형 종류" value={`${data.complaints.byType.length}종`} />
              <KCard label="발생 지역" value={`${data.complaints.byArea.length}곳`} />
            </div>

            {/* 유형별 + 상태별 (기존) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Card title="유형별 분포">
                {data.complaints.byType.length === 0 ? <Empty /> : data.complaints.byType.map((t) => (
                  <BarRow key={t.type} label={COMPLAINT_TYPE_LABEL[t.type] ?? t.type} value={t.count} max={max(data.complaints.byType.map((x) => x.count))} suffix="건" color="bg-amber-400" />
                ))}
              </Card>
              <Card title="처리 상태별">
                {data.complaints.byStatus.length === 0 ? <Empty /> : data.complaints.byStatus.map((s) => (
                  <BarRow key={s.status} label={COMPLAINT_STATUS_LABEL[s.status] ?? s.status} value={s.count} max={max(data.complaints.byStatus.map((x) => x.count))} suffix="건" color="bg-orange-400" />
                ))}
              </Card>
            </div>

            {/* 시간 분포: 시간대별(24h) + 요일별(7d) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <Card title="시간대별 분포 (KST 0~23시)">
                <HourHistogram data={data.complaints.byHour} />
              </Card>
              <Card title="요일별 분포">
                <WeekdayBars data={data.complaints.byWeekday} />
              </Card>
            </div>

            {/* 월별 추이 */}
            <Card title="월별 추이">
              {data.complaints.byMonth.length === 0 ? <Empty /> : (
                <div className="flex items-end gap-1 h-24 px-1 pt-2">
                  {data.complaints.byMonth.map((m) => {
                    const mx = max(data.complaints.byMonth.map((x) => x.count));
                    const h = mx > 0 ? Math.max(4, (m.count / mx) * 100) : 4;
                    return (
                      <div key={m.ym} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="w-full bg-amber-400 rounded-t hover:bg-amber-500 transition" style={{ height: `${h}%` }} title={`${m.ym}: ${m.count}건`} />
                        <div className="text-[0.5625rem] font-mono font-bold text-slate-600 truncate w-full text-center">{m.ym.slice(5)}</div>
                        <div className="text-[0.625rem] font-mono font-extrabold text-ink">{m.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 지역 + 위탁업체 (지자체용) Top 10 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <Card title="지역 Top 10 (주소 기반)">
                {data.complaints.byArea.length === 0 ? <Empty /> : data.complaints.byArea.map((a) => (
                  <BarRow key={a.area} label={a.area} value={a.count} max={max(data.complaints.byArea.map((x) => x.count))} suffix="건" color="bg-cyan-500" />
                ))}
              </Card>
              {data.complaints.byContractor.length > 1 && (
                <Card title="위탁업체별 분포">
                  {data.complaints.byContractor.map((c) => (
                    <BarRow key={c.contractorId} label={c.name} value={c.count} max={max(data.complaints.byContractor.map((x) => x.count))} suffix="건" color="bg-indigo-500" />
                  ))}
                </Card>
              )}
              {data.complaints.byContractor.length <= 1 && data.complaints.satisfaction.count > 0 && (
                <Card title="만족도 점수 분포">
                  {data.complaints.satisfaction.byScore.map((s) => (
                    <BarRow key={s.score} label={`${'★'.repeat(s.score)}${'☆'.repeat(5 - s.score)}`} value={s.count} max={max(data.complaints.satisfaction.byScore.map((x) => x.count))} suffix="건" color={s.score >= 4 ? 'bg-emerald-500' : s.score === 3 ? 'bg-amber-400' : 'bg-rose-400'} />
                  ))}
                </Card>
              )}
            </div>

            {/* Phase 2 자동경로탐색 KPI — 응답성 + 처리 사이클 + 워커별 */}
            {(data.complaints.performance.departToArriveCount > 0 || data.complaints.byWorker.length > 0) && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <KCard label="평균 응답시간" value={`${data.complaints.performance.avgReportToDepartMin}분`} unit="(접수→출동)" tone="accent" />
                  <KCard label="평균 출동시간" value={`${data.complaints.performance.avgDepartToArriveMin}분`} unit="(출동→도착)" tone="accent" />
                  <KCard label="평균 현장처리" value={`${data.complaints.performance.avgArriveToResolveMin}분`} unit="(도착→완료)" tone="accent" />
                </div>
                {data.complaints.byWorker.length > 0 && (
                  <Card title="워커별 KPI Top 10">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-[0.625rem] font-mono font-extrabold text-slate-700 uppercase">
                          <tr className="border-b border-line">
                            <th className="text-left py-1.5">워커</th>
                            <th className="text-right py-1.5">담당</th>
                            <th className="text-right py-1.5">완료</th>
                            <th className="text-right py-1.5">평균 처리(h)</th>
                            <th className="text-right py-1.5">출동→도착(분)</th>
                            <th className="text-right py-1.5">도착→완료(분)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.complaints.byWorker.map((w) => (
                            <tr key={w.workerId} className="border-b border-line last:border-b-0">
                              <td className="py-1.5 font-bold text-ink">{w.name}</td>
                              <td className="py-1.5 text-right font-mono">{w.count}</td>
                              <td className="py-1.5 text-right font-mono font-extrabold text-emerald-700">{w.resolvedCount}</td>
                              <td className="py-1.5 text-right font-mono">{w.avgResolveHours > 0 ? w.avgResolveHours : '—'}</td>
                              <td className="py-1.5 text-right font-mono">{w.avgDepartToArriveMin > 0 ? w.avgDepartToArriveMin : '—'}</td>
                              <td className="py-1.5 text-right font-mono">{w.avgArriveToResolveMin > 0 ? w.avgArriveToResolveMin : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </Section>

          {/* 5. 차량/운행 */}
          <Section no={5} title="차량 운행" color="text-purple-700">
            <div className="grid grid-cols-4 gap-3 mb-3">
              <KCard label="차량 보유" value={`${data.vehicles.total}대`} />
              <KCard label="가동" value={`${data.vehicles.active}대`} tone="success" />
              <KCard label="정비중" value={`${data.vehicles.maintenance}대`} tone="warning" />
              <KCard label="운행일지" value={`${data.vehicles.logsCount}건`} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <KCard label="총 주행거리" value={`${data.vehicles.totalKm.toLocaleString()} km`} tone="accent" />
              <KCard label="총 연료" value={`${data.vehicles.fuelL.toFixed(1)} L`} />
              <KCard label="현장 수거량" value={`${data.vehicles.wasteTon} ton`} tone="accent" />
            </div>
          </Section>

          {/* 6. 처리실적 — 일반 수집운반 업체만 표시 */}
          {!isAvac && (
            <>
              {/* 6. 처리실적 — 일반 수집운반 업체만 */}
              <Section no={6} title="생활폐기물 처리실적 (14성상)" color="text-slate-700">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <KCard label="총 처리량" value={`${data.waste.total} ton`} tone="accent" />
                  <KCard label="기록 건수" value={`${data.waste.records}건`} />
                  <KCard label="성상 종류" value={`${data.waste.byMaterial.length}종`} />
                </div>
                <Card title="성상별">
                  {data.waste.byMaterial.length === 0 ? <Empty /> : data.waste.byMaterial.sort((a, b) => b.weight - a.weight).map((m) => (
                    <BarRow key={m.code} label={MATERIAL_LABEL[m.code] ?? m.code} value={m.weight} max={max(data.waste.byMaterial.map((x) => x.weight))} suffix="t" />
                  ))}
                </Card>
              </Section>

              {/* 7. 반입실적 — 일반 수집운반 업체만 */}
              <Section no={7} title="자원순환센터 반입실적" color="text-emerald-700">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <KCard label="총 반입량" value={`${data.intake.total} ton`} tone="success" />
                  <KCard label="반입 건수" value={`${data.intake.records}건`} />
                  <KCard label="반입 차량" value={`${data.intake.byVehicle.length}대`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card title="성상별">
                    {data.intake.byCategory.length === 0 ? <Empty /> : data.intake.byCategory.map((c) => (
                      <BarRow key={c.code} label={MATERIAL_LABEL[c.code] ?? c.code} value={c.weight} max={max(data.intake.byCategory.map((x) => x.weight))} suffix="t" color="bg-emerald-500" />
                    ))}
                  </Card>
                  <Card title="차량별 Top 10">
                    {data.intake.byVehicle.length === 0 ? <Empty /> : data.intake.byVehicle.sort((a, b) => b.weight - a.weight).slice(0, 10).map((v) => (
                      <BarRow key={v.vehicleId} label={`${v.vehicleNo} (${v.count}회)`} value={v.weight} max={max(data.intake.byVehicle.map((x) => x.weight))} suffix="t" color="bg-blue-400" />
                    ))}
                  </Card>
                </div>
              </Section>
            </>
          )}

          {/* 8. 안전보건 */}
          <Section no={8} title="산업안전보건" color="text-red-700">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <KCard label="전체 보고" value={`${data.safety.total}건`} />
              <KCard label="유형 종류" value={`${data.safety.byType.length}종`} />
              <KCard label="중증도 종류" value={`${data.safety.bySeverity.length}종`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card title="유형별">
                {data.safety.byType.length === 0 ? <Empty /> : data.safety.byType.map((t) => (
                  <BarRow key={t.type} label={SAFETY_TYPE_LABEL[t.type] ?? t.type} value={t.count} max={max(data.safety.byType.map((x) => x.count))} suffix="건" color="bg-red-400" />
                ))}
              </Card>
              <Card title="중증도별">
                {data.safety.bySeverity.length === 0 ? <Empty /> : data.safety.bySeverity.map((s) => (
                  <BarRow key={s.severity} label={SEV_LABEL[s.severity] ?? s.severity} value={s.count} max={max(data.safety.bySeverity.map((x) => x.count))} suffix="건" color="bg-orange-400" />
                ))}
              </Card>
            </div>
          </Section>

          {/* 결재란 — 사용자 요청 2026-04-29: 통합 운영 보고서에서 결재라인 표시 감춤. */}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1.2cm 1cm; }

          /* 앱 셸·컨트롤 바 숨김 */
          header, aside, nav, [data-sidebar], .sidebar { display: none !important; }

          /* 스크롤 컨테이너 해제 */
          html, body { overflow: visible !important; margin: 0 !important; padding: 0 !important; }
          main, section { overflow: visible !important; height: auto !important; max-height: none !important; }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
            font-size: 9pt !important;
          }

          /* 배경색 인쇄 강제 — BarRow 막대, KCard 배경 등 */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* 컨트롤 숨김 */
          .print\\:hidden { display: none !important; }

          /* 카드 내부 잘림 방지 */
          .mb-6 { page-break-inside: avoid; break-inside: avoid; }

          /* 섹션 페이지 구분 */
          .page-break { page-break-before: always; break-before: page; }

          /* BarRow 텍스트 크기 */
          .text-\\[0\\.625rem\\] { font-size: 7pt !important; }
          .text-\\[0\\.5625rem\\] { font-size: 6.5pt !important; }

          /* 그리드 인쇄 적합하게 */
          .grid { display: grid !important; }

          /* 헤더 폰트 */
          h1 { font-size: 18pt !important; }
          h2 { font-size: 13pt !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ no, title, color, children }: { no: number; title: string; color: string; children: React.ReactNode }) {
  /* 사용자 요청 2026-04-29: 카드 타이틀 1단계 업 (text-xl 20px → text-2xl 24px) */
  return (
    <section className={`mb-6 ${no > 1 ? 'page-break' : ''}`}>
      <h2 className={`font-black text-2xl mb-3 border-l-[6px] border-current pl-3 ${color}`}>
        {no}. {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ title, children, cls = '' }: { title: string; children: React.ReactNode; cls?: string }) {
  /* 내용 1단계 다운 — sub title text-xs 12px → text-[0.6875rem] */
  return (
    <div className={`bg-surface border border-line rounded p-3 ${cls}`}>
      <div className="text-[0.6875rem] font-extrabold text-ink mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Empty() {
  /* 내용 1단계 다운 — text-xs 12px → text-[0.6875rem] */
  return <div className="text-[0.6875rem] text-slate-700 text-center py-3">데이터 없음</div>;
}

function KCard({ label, value, unit, tone = 'default' }: { label: string; value: string; unit?: string; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  const c: Record<string, string> = {
    default: 'bg-white border-line text-ink',
    accent: 'bg-cyan-100 border-cyan-500 text-cyan-900',
    success: 'bg-emerald-100 border-emerald-500 text-emerald-900',
    warning: 'bg-amber-100 border-amber-500 text-amber-900',
  };
  return (
    <div className={`px-3 py-2 rounded border-2 text-center ${c[tone]}`}>
      <div className="text-xs font-mono font-extrabold uppercase">{label}</div>
      <div className="text-base font-black mt-0.5">{value}</div>
      {unit && <div className="text-[0.5625rem] font-mono font-bold opacity-70 mt-0.5">{unit}</div>}
    </div>
  );
}

function BarRow({ label, value, max, suffix, color = 'bg-accent' }: { label: string; value: number; max: number; suffix: string; color?: string }) {
  /* 내용 1단계 다운 — BarRow label text-[0.6875rem] → text-[0.625rem] */
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-[120px] text-[0.625rem] font-bold text-ink truncate">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-sm h-4 overflow-hidden">
        <div className={`h-full ${color} flex items-center justify-end pr-1.5 text-[0.5625rem] font-mono font-extrabold text-white`} style={{ width: `${Math.max(2, pct)}%` }}>
          {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}{suffix}
        </div>
      </div>
    </div>
  );
}

/* 시간대별 히스토그램 (24시간) */
function HourHistogram({ data }: { data: Array<{ hour: number; count: number }> }) {
  const mx = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="py-4 text-center text-xs text-slate-500">데이터 없음</div>;
  }
  return (
    <div>
      <div className="flex items-end gap-px h-20 px-1 pt-1">
        {data.map((d) => {
          const h = (d.count / mx) * 100;
          /* 시간대 색상: 새벽(짙은 파랑) / 오전(시안) / 오후(앰버) / 야간(보라) */
          const color =
            d.hour < 6 ? 'bg-indigo-500' :
            d.hour < 12 ? 'bg-cyan-500' :
            d.hour < 18 ? 'bg-amber-500' : 'bg-purple-500';
          return (
            <div
              key={d.hour}
              className={`flex-1 rounded-t ${color} hover:opacity-80 transition`}
              style={{ height: `${Math.max(2, h)}%` }}
              title={`${d.hour}시: ${d.count}건`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[0.5625rem] font-mono font-bold text-slate-500 mt-1 px-1">
        <span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>23시</span>
      </div>
    </div>
  );
}

/* 요일별 막대 */
function WeekdayBars({ data }: { data: Array<{ day: number; count: number }> }) {
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  const mx = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div className="py-4 text-center text-xs text-slate-500">데이터 없음</div>;
  }
  return (
    <div className="flex items-end gap-1.5 h-24 px-1 pt-1">
      {data.map((d) => {
        const h = (d.count / mx) * 100;
        const isWeekend = d.day === 0 || d.day === 6;
        const color = isWeekend ? 'bg-rose-400' : 'bg-amber-400';
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-[0.625rem] font-mono font-extrabold text-ink">{d.count}</div>
            <div className={`w-full rounded-t ${color} hover:opacity-80 transition`} style={{ height: `${Math.max(4, h)}%` }} />
            <div className={`text-[0.6875rem] font-bold ${isWeekend ? 'text-rose-600' : 'text-slate-700'}`}>{labels[d.day]}</div>
          </div>
        );
      })}
    </div>
  );
}
