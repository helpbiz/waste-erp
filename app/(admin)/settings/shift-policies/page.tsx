import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canManageUsers } from '@/lib/users';
import { redirect } from 'next/navigation';
import ShiftPoliciesClient, { type ShiftPolicyRow, type DeptOpt, type WorkerOpt } from './_shift-policies-client';

export const dynamic = 'force-dynamic';

export default async function ShiftPoliciesPage() {
  const session = (await readSession())!;
  if (!canManageUsers(session.role)) redirect('/');
  if (!session.contractorId) redirect('/');

  const contractorId = BigInt(session.contractorId);

  const [rows, departments, workers] = await Promise.all([
    prisma.shiftPolicy.findMany({
      where: { contractorId },
      include: {
        department: { select: { id: true, name: true } },
        worker: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { active: 'desc' }, { name: 'asc' }],
    }),
    prisma.department.findMany({
      where: { contractorId, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { contractorId, role: 'WORKER', status: 'ACTIVE' },
      select: { id: true, name: true, employeeNo: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const items: ShiftPolicyRow[] = rows.map((r) => ({
    id: r.id.toString(),
    departmentId: r.departmentId?.toString() ?? null,
    departmentName: r.department?.name ?? null,
    workerId: r.workerId?.toString() ?? null,
    workerName: r.worker?.name ?? null,
    shiftType: r.shiftType,
    name: r.name,
    checkInRecognizeFrom: r.checkInRecognizeFrom,
    checkInRecognizeUntil: r.checkInRecognizeUntil,
    checkOutRecognizeFrom: r.checkOutRecognizeFrom,
    checkOutRecognizeUntil: r.checkOutRecognizeUntil,
    checkOutNextDay: r.checkOutNextDay,
    offDays: r.offDays ? JSON.parse(r.offDays) : null,
    active: r.active,
    sortOrder: r.sortOrder,
  }));

  const depts: DeptOpt[] = departments.map((d) => ({ id: d.id.toString(), name: d.name }));
  const workerOpts: WorkerOpt[] = workers.map((w) => ({ id: w.id.toString(), name: w.name, employeeNo: w.employeeNo }));

  return <ShiftPoliciesClient rows={items} departments={depts} workers={workerOpts} />;
}
