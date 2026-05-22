import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { contractorScopeWhere } from '@/lib/scopes';
import { userScope } from '@/lib/users';
import AttendancePrintClient from './_print-client';

export const dynamic = 'force-dynamic';

export default async function AttendancePrintPage({
  searchParams,
}: {
  searchParams: { ym?: string };
}) {
  const session = (await readSession())!;

  const ym = searchParams.ym ?? new Date().toISOString().slice(0, 7);
  const [year, month] = ym.split('-').map(Number);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // 말일

  const daysInMonth = monthEnd.getDate();

  const recordScope = contractorScopeWhere(session);
  const userWhere = userScope(session);

  const [workers, records] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ['WORKER', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'] }, status: 'ACTIVE', ...userWhere },
      select: { id: true, name: true, employeeNo: true, department: { select: { name: true } } },
      orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
    }),
    prisma.attendanceRecord.findMany({
      where: {
        ...recordScope,
        workDate: { gte: monthStart, lte: monthEnd },
      },
      select: {
        workerId: true,
        workDate: true,
        checkInTime: true,
        checkOutTime: true,
        status: true,
      },
    }),
  ]);

  /* workerId → day → {in, out} 매핑 */
  type DayRecord = { checkIn: string | null; checkOut: string | null };
  const map = new Map<string, Map<number, DayRecord>>();

  for (const r of records) {
    const wid = r.workerId.toString();
    if (!map.has(wid)) map.set(wid, new Map());
    const d = r.workDate.getDate();
    const fmt = (t: Date | null) => {
      if (!t) return null;
      const utc = new Date(t.getTime() + 9 * 3600 * 1000);
      return `${String(utc.getUTCHours()).padStart(2, '0')}:${String(utc.getUTCMinutes()).padStart(2, '0')}`;
    };
    map.get(wid)!.set(d, { checkIn: fmt(r.checkInTime), checkOut: fmt(r.checkOutTime) });
  }

  const rows = workers.map((w) => {
    const dayMap = map.get(w.id.toString()) ?? new Map<number, DayRecord>();
    const days: (DayRecord | null)[] = Array.from({ length: daysInMonth }, (_, i) => dayMap.get(i + 1) ?? null);
    const attendCount = days.filter((d) => d?.checkIn).length;
    return {
      workerId: w.id.toString(),
      name: w.name,
      employeeNo: w.employeeNo ?? '',
      department: w.department?.name ?? '',
      days,
      attendCount,
    };
  });

  /* 요일 헤더 */
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(year, month - 1, i + 1);
    return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  });

  return (
    <AttendancePrintClient
      ym={ym}
      year={year}
      month={month}
      daysInMonth={daysInMonth}
      dayHeaders={dayHeaders}
      rows={rows}
    />
  );
}
