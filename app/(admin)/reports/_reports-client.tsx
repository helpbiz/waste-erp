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
  complaints: { total: number; byType: Array<{ type: string; count: number }>; byStatus: Array<{ status: string; count: number }> };
  vehicles: { total: number; active: number; maintenance: number; logsCount: number; wasteKg: number; wasteTon: number; fuelL: number; totalKm: number };
  waste: { total: number; records: number; byMaterial: Array<{ code: string; weight: number }> };
  intake: { total: number; records: number; byCategory: Array<{ code: string; weight: number }>; byVehicle: Array<{ vehicleId: string; vehicleNo: string; weight: number; count: number }> };
  safety: { total: number; byType: Array<{ type: string; count: number }>; bySeverity: Array<{ severity: string; count: number }> };
};

export default function ReportsClient({ session }: { session: { role: string; name: string } }) {
  const [reportTab, setReportTab] = useState<ReportTab>('master');

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-card overflow-x-auto print:hidden">
        <TabBtn active={reportTab === 'master'} onClick={() => setReportTab('master')}>📊 통합 운영 보고서</TabBtn>
        <TabBtn active={reportTab === 'f02'} onClick={() => setReportTab('f02')}>📄 일일 처리실적 일보 (F-02)</TabBtn>
      </nav>
      {reportTab === 'master' && <MasterStatsView session={session} />}
      {reportTab === 'f02' && <DailyTreatmentTab role={session.role} />}
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

function MasterStatsView({ session }: { session: { role: string; name: string } }) {
  const ymStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const ymEnd = new Date(new Date().getFullYear(), 11, 31).toISOString().slice(0, 10);
  const [from, setFrom] = useState(ymStart);
  const [to, setTo] = useState(ymEnd);
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/reports/master-stats?from=${from}&to=${to}`);
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

  const max = (arr: number[]) => Math.max(1, ...arr);

  return (
    <div className="space-y-5">
      {/* 컨트롤 (인쇄 시 숨김) */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일"
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="종료일"
            className="px-3 py-1.5 rounded border border-line text-sm font-mono font-bold" />
        </div>
        <div className="flex items-end gap-1">
          <button onClick={() => quick('thisMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[11px] font-bold hover:bg-slate-50">이번 달</button>
          <button onClick={() => quick('lastMonth')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[11px] font-bold hover:bg-slate-50">전월</button>
          <button onClick={() => quick('thisYear')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[11px] font-bold hover:bg-slate-50">올해</button>
          <button onClick={() => quick('lastYear')} className="px-2.5 py-1.5 rounded border border-line bg-white text-[11px] font-bold hover:bg-slate-50">전년</button>
        </div>
        <button onClick={load} disabled={loading}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong disabled:opacity-50">
          {loading ? '조회 중…' : '조회'}
        </button>
        <button onClick={printNow}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-700 text-white hover:bg-emerald-800">
          🖨 보고서 출력 (전체 영역)
        </button>
      </div>

      {!data && <div className="text-center py-12 text-slate-700 font-bold">조회 중…</div>}

      {data && (
        <div className="bg-white border-t-4 border-double border-slate-700 pt-4 px-4 print:px-2 print:pt-0">
          <h1 className="text-3xl font-black text-center mb-1">통합 운영 보고서</h1>
          <div className="text-center text-sm font-bold text-slate-600 mb-1">{data.range.from} ~ {data.range.to}</div>
          <div className="text-center text-[11px] font-mono text-slate-600 mb-6">
            출력자: {session.name} ({ROLE_LABEL[session.role]}) · 출력일시: {new Date().toLocaleString('ko-KR')}
          </div>

          {/* 1. 인사 */}
          <Section no={1} title="인사 현황" color="text-blue-700">
            <div className="grid grid-cols-4 gap-3 mb-3">
              <KCard label="전체 인원" value={`${data.hr.total}명`} tone="accent" />
              <KCard label="권한 종류" value={`${data.hr.byRole.length}종`} />
              <KCard label="직책 등록" value={`${data.hr.byPosition.length}종`} />
              <KCard label="부서" value={`${data.hr.byDepartment.length}개`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card title="권한별">
                {data.hr.byRole.length === 0 ? <Empty /> : data.hr.byRole.map((r) => (
                  <BarRow key={r.role} label={ROLE_LABEL[r.role] ?? r.role} value={r.count} max={max(data.hr.byRole.map((x) => x.count))} suffix="명" color="bg-blue-400" />
                ))}
              </Card>
              <Card title="부서별">
                {data.hr.byDepartment.length === 0 ? <Empty /> : data.hr.byDepartment.map((d) => (
                  <BarRow key={d.name} label={d.name} value={d.count} max={max(data.hr.byDepartment.map((x) => x.count))} suffix="명" color="bg-emerald-400" />
                ))}
              </Card>
            </div>
            <Card title="직책별 (사무 / 현장 / 기타)" cls="mt-3">
              <div className="grid grid-cols-3 gap-2">
                {['OFFICE', 'FIELD', 'OTHER'].map((cat) => (
                  <div key={cat}>
                    <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">{cat === 'OFFICE' ? '사무' : cat === 'FIELD' ? '현장' : '기타'}</div>
                    {data.hr.byPosition.filter((p) => p.category === cat).length === 0
                      ? <Empty />
                      : data.hr.byPosition.filter((p) => p.category === cat).map((p) => (
                        <div key={p.code} className="flex justify-between text-xs border-b border-line py-0.5">
                          <span>{p.label}</span>
                          <span className="font-mono font-extrabold">{p.count}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </Card>
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

          {/* 3. 휴가 */}
          <Section no={3} title="휴가 현황" color="text-emerald-700">
            <div className="grid grid-cols-5 gap-3 mb-3">
              <KCard label="신청" value={`${data.leave.requests}건`} />
              <KCard label="결재 완료" value={`${data.leave.approved}건`} tone="success" />
              <KCard label="결재 중" value={`${data.leave.inReview}건`} tone="warning" />
              <KCard label="대기" value={`${data.leave.pending}건`} />
              <KCard label="승인 일수" value={`${data.leave.approvedDays}일`} tone="accent" />
            </div>
            <Card title="유형별">
              {data.leave.byType.length === 0 ? <Empty /> : data.leave.byType.map((t) => (
                <BarRow key={t.type} label={LEAVE_TYPE_LABEL[t.type] ?? t.type} value={t.count} max={max(data.leave.byType.map((x) => x.count))} suffix="건" color="bg-emerald-400" />
              ))}
            </Card>
          </Section>

          {/* 4. 민원 */}
          <Section no={4} title="민원 현황" color="text-amber-700">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <KCard label="전체 민원" value={`${data.complaints.total}건`} />
              <KCard label="유형 종류" value={`${data.complaints.byType.length}종`} />
              <KCard label="상태 종류" value={`${data.complaints.byStatus.length}종`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Card title="유형별">
                {data.complaints.byType.length === 0 ? <Empty /> : data.complaints.byType.map((t) => (
                  <BarRow key={t.type} label={COMPLAINT_TYPE_LABEL[t.type] ?? t.type} value={t.count} max={max(data.complaints.byType.map((x) => x.count))} suffix="건" color="bg-amber-400" />
                ))}
              </Card>
              <Card title="상태별">
                {data.complaints.byStatus.length === 0 ? <Empty /> : data.complaints.byStatus.map((s) => (
                  <BarRow key={s.status} label={COMPLAINT_STATUS_LABEL[s.status] ?? s.status} value={s.count} max={max(data.complaints.byStatus.map((x) => x.count))} suffix="건" color="bg-orange-400" />
                ))}
              </Card>
            </div>
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

          {/* 6. 처리실적 */}
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

          {/* 7. 반입실적 */}
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

          {/* 결재란 — 서명 워터마크 */}
          <div className="mt-8 pt-4 border-t-2 border-slate-700 grid grid-cols-3 gap-6 text-sm">
            {['담당자', '관리자', '대표'].map((role) => (
              <div key={role} className="text-center">
                <div className="font-bold mb-1">{role}</div>
                <div className="relative border border-slate-400 h-16 bg-white overflow-hidden" aria-hidden="true">
                  <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-slate-200 select-none pointer-events-none tracking-[0.4em] -rotate-12">
                    서명
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 1.2cm; }
          .page-break { page-break-before: always; }
        }
      `}</style>
    </div>
  );
}

function Section({ no, title, color, children }: { no: number; title: string; color: string; children: React.ReactNode }) {
  return (
    <section className={`mb-6 ${no > 1 ? 'page-break' : ''}`}>
      <h2 className={`font-black text-xl mb-3 border-l-[6px] border-current pl-3 ${color}`}>
        {no}. {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ title, children, cls = '' }: { title: string; children: React.ReactNode; cls?: string }) {
  return (
    <div className={`bg-surface border border-line rounded p-3 ${cls}`}>
      <div className="text-xs font-extrabold text-ink mb-2">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Empty() {
  return <div className="text-xs text-slate-700 text-center py-3">데이터 없음</div>;
}

function KCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  const c: Record<string, string> = {
    default: 'bg-white border-line text-ink',
    accent: 'bg-cyan-100 border-cyan-500 text-cyan-900',
    success: 'bg-emerald-100 border-emerald-500 text-emerald-900',
    warning: 'bg-amber-100 border-amber-500 text-amber-900',
  };
  return (
    <div className={`px-3 py-2 rounded border-2 ${c[tone]}`}>
      <div className="text-[10px] font-mono font-extrabold uppercase">{label}</div>
      <div className="text-xl font-black mt-0.5">{value}</div>
    </div>
  );
}

function BarRow({ label, value, max, suffix, color = 'bg-accent' }: { label: string; value: number; max: number; suffix: string; color?: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-[120px] text-[11px] font-bold text-ink truncate">{label}</div>
      <div className="flex-1 bg-slate-100 rounded-sm h-4 overflow-hidden">
        <div className={`h-full ${color} flex items-center justify-end pr-1.5 text-[9px] font-mono font-extrabold text-white`} style={{ width: `${Math.max(2, pct)}%` }}>
          {typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}{suffix}
        </div>
      </div>
    </div>
  );
}
