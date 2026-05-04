import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { userScope, recommendedAnnualLeaveDays, leaveRemaining } from '@/lib/users';
import { listActivePositions } from '@/lib/positions';
import UsersClient from './_users-client';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = (await readSession())!;
  const year = new Date().getFullYear();

  const [users, leaveRequests, positions, departments] = await Promise.all([
    prisma.user.findMany({
      where: userScope(session),
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      include: {
        contractor: { select: { id: true, companyName: true, municipality: { select: { id: true, name: true, region: true } } } },
        leaveBalances: { where: { year }, take: 1 },
        position: true,
        department: true,
        profilePhoto: { select: { contentRef: true } },
        activeSignature: { select: { signatureRef: true } },
        primaryFacility: { select: { id: true, name: true, type: true } },
        contractorPosition: { select: { id: true, name: true, category: true } },
        contractorRank: { select: { id: true, name: true, level: true } },
      },
      take: 200,
    }),
    prisma.leaveRequest.findMany({
      where: { worker: userScope(session) },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 100,
      include: {
        worker: { select: { id: true, name: true, employeeNo: true } },
        approvalEvent: {
          include: {
            actor: { select: { name: true, role: true } },
            signature: { include: { asset: { select: { contentRef: true } } } },
          },
        },
      },
    }),
    listActivePositions(),
    session.contractorId
      ? prisma.department.findMany({
          where: { contractorId: BigInt(session.contractorId), active: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const rows = users.map((u) => {
    const balance = u.leaveBalances[0];
    const recommend = recommendedAnnualLeaveDays(u.hireDate);
    return {
      id: u.id.toString(),
      username: u.username,
      name: u.name,
      role: u.role,
      status: u.status,
      contractorName: u.contractor?.companyName ?? null,
      contractorId: u.contractor?.id?.toString() ?? null,
      municipalityName: u.contractor?.municipality?.name ?? null,
      municipalityId: u.contractor?.municipality?.id?.toString() ?? null,
      municipalityRegion: u.contractor?.municipality?.region ?? null,
      phone: u.phone,
      employeeNo: u.employeeNo,
      birthDate: u.birthDate?.toISOString().slice(0, 10) ?? null,
      gender: u.gender,
      address: u.address,
      hireDate: u.hireDate?.toISOString().slice(0, 10) ?? null,
      resignDate: u.resignDate?.toISOString().slice(0, 10) ?? null,
      emergencyContact: u.emergencyContact,
      emergencyPhone: u.emergencyPhone,
      bankName: u.bankName,
      bankAccount: u.bankAccount,
      memo: u.memo,
      lastLogin: u.lastLogin?.toISOString() ?? null,
      tenureYears: recommend.years,
      recommendDays: recommend.days,
      recommendRule: recommend.rule,
      thisYearGranted: balance ? Number(balance.granted.toString()) : 0,
      thisYearUsed: balance ? Number(balance.used.toString()) : 0,
      thisYearCarriedOver: balance ? Number(balance.carriedOver.toString()) : 0,
      thisYearRemaining: balance ? leaveRemaining(balance) : 0,
      position: u.position
        ? { id: u.position.id.toString(), code: u.position.code, label: u.position.label, category: u.position.category }
        : null,
      department: u.department
        ? { id: u.department.id.toString(), name: u.department.name }
        : null,
      /* AVAC 보강 (Hot-fix 2026-05-02) */
      rank: u.rank ?? null,
      primaryFacility: u.primaryFacility
        ? { id: u.primaryFacility.id.toString(), name: u.primaryFacility.name, type: u.primaryFacility.type }
        : null,
      contractorPositionId: u.contractorPositionId?.toString() ?? null,
      contractorRankId: u.rankId?.toString() ?? null,
      contractorPosition: u.contractorPosition
        ? { id: u.contractorPosition.id.toString(), name: u.contractorPosition.name, category: u.contractorPosition.category }
        : null,
      contractorRank: u.contractorRank
        ? { id: u.contractorRank.id.toString(), name: u.contractorRank.name, level: u.contractorRank.level }
        : null,
      profilePhotoUrl: u.profilePhoto?.contentRef ?? null,
      activeSignatureRef: u.activeSignature?.signatureRef ?? null,
    };
  });

  const leaveRows = leaveRequests.map((r) => ({
    id: r.id.toString(),
    workerId: r.workerId.toString(),
    workerName: r.worker.name,
    employeeNo: r.worker.employeeNo,
    requestType: r.requestType,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate.toISOString().slice(0, 10),
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    approverName: r.approvalEvent?.actor.name ?? null,
    approverSignatureUrl: r.approvalEvent?.signature?.asset.contentRef ?? null,
    approverSignatureRef: r.approvalEvent?.signatureRef ?? null,
  }));

  return (
    <UsersClient
      session={{ role: session.role, userId: session.userId }}
      rows={rows}
      leaveRows={leaveRows}
      year={year}
      positions={positions.map((p) => ({
        id: p.id.toString(), code: p.code, label: p.label, category: p.category, sortOrder: p.sortOrder,
      }))}
      departments={departments.map((d) => ({
        id: d.id.toString(), name: d.name, parentId: d.parentId?.toString() ?? null,
      }))}
    />
  );
}
