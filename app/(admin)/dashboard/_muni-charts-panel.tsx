'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/* ── 색상 팔레트 ─────────────────────────────────────── */
const PALETTE = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/* ── 타입 ────────────────────────────────────────────── */
type ContractorItem = {
  id: string;
  companyName: string;
  users: number;
  attendance: number;
  pendingComplaints: number;
  vehicles: number;
  safety: number;
};

type MonthlyComplaint = { ym: string; count: number };
type AttendanceDaily = { date: string; count: number };

/* ── 커스텀 툴팁 ─────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-line rounded-lg shadow-lg p-3 text-sm">
      <p className="font-extrabold text-ink mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/* ── 메인 컴포넌트 ───────────────────────────────────── */
export default function MuniChartsPanel() {
  const [contractors, setContractors] = useState<ContractorItem[]>([]);
  const [monthlyComplaints, setMonthlyComplaints] = useState<MonthlyComplaint[]>([]);
  const [attendanceDaily, setAttendanceDaily] = useState<AttendanceDaily[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    /* 6개월 범위 — 추이 차트용 */
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const from = sixMonthsAgo.toISOString().slice(0, 10);

    Promise.all([
      fetch(`/api/super-admin/contractors-aggregate?from=${today}&to=${today}`).then((r) => r.json()),
      fetch(`/api/reports/master-stats?from=${from}&to=${today}`).then((r) => r.json()),
    ])
      .then(([aggData, statsData]) => {
        setContractors(aggData.contractors ?? []);
        setMonthlyComplaints(statsData.complaints?.byMonth ?? []);
        setAttendanceDaily((statsData.attendance?.daily ?? []).slice(-30));
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartSkeleton />;
  if (contractors.length === 0) return null;

  /* ── 차트용 데이터 가공 ─────────────────────────────── */
  const attendanceBarData = contractors.map((c) => ({
    name: c.companyName.length > 6 ? c.companyName.slice(0, 6) + '…' : c.companyName,
    출근율: c.users > 0 ? Math.round((c.attendance / c.users) * 100) : 0,
    미처리민원: c.pendingComplaints,
    운행차량: c.vehicles,
  }));

  const pieData = contractors.map((c) => ({
    name: c.companyName.length > 6 ? c.companyName.slice(0, 6) + '…' : c.companyName,
    value: c.users,
  }));

  const complaintLineData = monthlyComplaints.map((m) => ({
    월: m.ym.slice(5),
    민원수: m.count,
  }));

  const attendanceLine = attendanceDaily.map((d) => ({
    일자: d.date.slice(5),
    출근: d.count,
  }));

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-sm font-extrabold text-ink">통계 시각화</span>
      </div>

      {/* 상단 — 2열 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 차트 1: 업체별 출근율 BarChart */}
        <ChartCard title="업체별 오늘 출근율 (%)" sub="전체 인원 대비 출근 비율">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceBarData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="출근율" radius={[4, 4, 0, 0]}>
                {attendanceBarData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 차트 2: 업체별 인원 분포 PieChart */}
        <ChartCard title="업체별 인원 분포" sub="등록 근로자 기준">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v}명`, '인원']} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* 하단 — 2열 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 차트 3: 업체별 미처리 민원 BarChart */}
        <ChartCard title="업체별 미처리 민원" sub="현재 RECEIVED / ASSIGNED / IN_PROGRESS 합산">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceBarData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} unit="건" />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="미처리민원" radius={[4, 4, 0, 0]}>
                {attendanceBarData.map((_, i) => (
                  <Cell key={i} fill={attendanceBarData[i].미처리민원 > 0 ? '#f59e0b' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 차트 4: 월별 민원 추이 LineChart */}
        {complaintLineData.length > 0 ? (
          <ChartCard title="월별 민원 접수 추이" sub="최근 6개월">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={complaintLineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="월" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} unit="건" />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="민원수"
                  stroke="#0ea5e9"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0ea5e9' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : (
          /* 월별 민원 데이터가 없으면 최근 30일 출근 추이 */
          <ChartCard title="최근 30일 출근 추이" sub="전체 업체 합산">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendanceLine}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="일자" tick={{ fontSize: 10 }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} unit="명" />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="출근"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>
    </section>
  );
}

/* ── 서브 컴포넌트 ───────────────────────────────────── */
function ChartCard({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-xl shadow-card p-4">
      <div className="mb-3">
        <p className="text-sm font-extrabold text-ink">{title}</p>
        <p className="text-[0.6875rem] text-ink-muted">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface border border-line rounded-xl p-4 animate-pulse">
          <div className="h-3 bg-surface-soft rounded w-1/3 mb-2" />
          <div className="h-[220px] bg-surface-soft rounded" />
        </div>
      ))}
    </div>
  );
}
