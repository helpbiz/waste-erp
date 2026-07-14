import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageUsers } from '@/lib/users';
import { redirect } from 'next/navigation';
import PunchRestrictionsClient, { type RestrictionRow, type DeptOpt } from './_punch-restrictions-client';

export const dynamic = 'force-dynamic';

export default async function PunchRestrictionsPage() {
  const session = (await readSession())!;
  if (!canManageUsers(session.role)) redirect('/');
  if (!session.contractorId) redirect('/');

  const contractorId = BigInt(session.contractorId);

  const [rows, departments] = await Promise.all([
    prisma.punchRestriction.findMany({
      where: { contractorId },
      include: { department: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { active: 'desc' }, { name: 'asc' }],
    }),
    prisma.department.findMany({
      where: { contractorId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const items: RestrictionRow[] = rows.map((r) => ({
    id: r.id.toString(),
    departmentId: r.departmentId?.toString() ?? null,
    departmentName: r.department?.name ?? null,
    name: r.name,
    checkInFrom: r.checkInFrom,
    checkInUntil: r.checkInUntil,
    checkOutFrom: r.checkOutFrom,
    checkOutUntil: r.checkOutUntil,
    requireLocationCheckIn: r.requireLocationCheckIn,
    checkInLat: r.checkInLat ? Number(r.checkInLat) : null,
    checkInLng: r.checkInLng ? Number(r.checkInLng) : null,
    checkInRadiusMeters: r.checkInRadiusMeters,
    checkInLocationLabel: r.checkInLocationLabel,
    requireLocationCheckOut: r.requireLocationCheckOut,
    checkOutLat: r.checkOutLat ? Number(r.checkOutLat) : null,
    checkOutLng: r.checkOutLng ? Number(r.checkOutLng) : null,
    checkOutRadiusMeters: r.checkOutRadiusMeters,
    checkOutLocationLabel: r.checkOutLocationLabel,
    allowedDays: r.allowedDays ? JSON.parse(r.allowedDays) : null,
    active: r.active,
    sortOrder: r.sortOrder,
  }));

  const depts: DeptOpt[] = departments.map((d) => ({ id: d.id.toString(), name: d.name }));

  return <PunchRestrictionsClient rows={items} departments={depts} />;
}
