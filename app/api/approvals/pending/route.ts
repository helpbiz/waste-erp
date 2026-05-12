import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { safetyWhere } from '@/lib/safety';
import { vehicleLogWhere } from '@/lib/vehicle-logs';
import { contractorScopeWhere } from '@/lib/scopes';
import { canManageUsers } from '@/lib/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) return NextResponse.json({ leaves: 0, attendance: 0, vehicleLogs: 0, safetyReports: 0, total: 0 });

  const aWhere = contractorScopeWhere(session);
  const vlWhere = vehicleLogWhere(session);
  const sWhere = safetyWhere(session);
  const leaveWhere = session.contractorId
    ? { worker: { contractorId: BigInt(session.contractorId) } }
    : {};

  const [leaves, attendance, vehicleLogs, safetyReports] = await Promise.all([
    prisma.leaveRequest.count({ where: { ...leaveWhere, status: { in: ['PENDING', 'IN_REVIEW'] } } }),
    prisma.attendanceRecord.count({ where: { ...aWhere, status: 'PENDING' } }),
    prisma.vehicleLog.count({ where: { ...vlWhere, status: 'SUBMITTED' } }),
    prisma.safetyReport.count({ where: { ...sWhere, status: 'SUBMITTED' } }),
  ]);

  return NextResponse.json({ leaves, attendance, vehicleLogs, safetyReports, total: leaves + attendance + vehicleLogs + safetyReports });
}
