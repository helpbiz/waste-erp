/**
 * dealer-channel Design §9.4 — 데모 발급/조회/시딩/정리.
 *
 * FR-09 범위 참고: 3~6개월치 "완전한" 시딩은 이번 1차 구현에서 근태·민원·차량일지
 * 3개 모듈, 최근 60일 분만 생성한다(대시보드 추이 시연에 충분한 최소 표본).
 * TBM/안전보고/급여 등 추가 모듈 시딩은 seedDemoData()에 같은 패턴으로 이어붙이면 된다.
 */
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { provision, type ProvisionResult } from './provisioning-service';
import { deleteDemoContractorData, deleteDemoMunicipalityIfEmpty } from '@/lib/demo/table-order';
import { DEALER_DEMO_QUOTA, DEMO_TTL_DAYS } from '@/lib/types/dealer';

export class DemoNotFoundError extends Error {
  constructor() { super('demo_not_found'); }
}

export class DemoQuotaExceededError extends Error {
  constructor() { super('demo_quota_exceeded'); }
}

export async function countActiveDemos(dealerId: bigint): Promise<number> {
  return prisma.contractor.count({
    where: { dealerId, isDemo: true, demoExpiresAt: { gt: new Date() } },
  });
}

export type ProvisionDemoResult = ProvisionResult & { expiresAt: string };

export async function provisionDemo(dealerId: bigint): Promise<ProvisionDemoResult> {
  const activeCount = await countActiveDemos(dealerId);
  if (activeCount >= DEALER_DEMO_QUOTA) throw new DemoQuotaExceededError();

  const suffix = Date.now().toString(36).slice(-6);
  const result = await provision(
    {
      municipalityName: `데모지자체-${suffix}`,
      contractorName: `데모위탁업체-${suffix}`,
      adminUsername: `demo_${suffix}`,
      adminName: '데모 관리자',
      dealerId,
    },
    { isDemo: true },
  );

  await seedDemoData(result.contractorId);

  const expiresAt = new Date(Date.now() + DEMO_TTL_DAYS * 24 * 60 * 60 * 1000);
  return { ...result, expiresAt: expiresAt.toISOString() };
}

export async function listActiveDemos(dealerId: bigint) {
  return prisma.contractor.findMany({
    where: { dealerId, isDemo: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, companyName: true, demoExpiresAt: true, createdAt: true, demoAccessToken: true },
  });
}

/**
 * 2026-07-06 — 예비고객이 딜러 개입 없이 바로 접속하는 매직링크 토큰 검증.
 * isDemo=true + 만료 전인 Contractor만 매칭, 해당 데모의 CONTRACTOR_ADMIN 계정을 함께 반환한다.
 */
export async function resolveDemoAccessToken(token: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { demoAccessToken: token },
    select: { id: true, isDemo: true, demoExpiresAt: true },
  });
  if (!contractor || !contractor.isDemo) return null;
  if (!contractor.demoExpiresAt || contractor.demoExpiresAt < new Date()) return null;

  const adminUser = await prisma.user.findFirst({
    where: { contractorId: contractor.id, role: 'CONTRACTOR_ADMIN' },
  });
  if (!adminUser || adminUser.status !== 'ACTIVE') return null;

  return { contractor, adminUser };
}

/** 링크 유출 시 딜러가 직접 재발급(구 링크는 즉시 무효화) */
export async function regenerateDemoAccessToken(contractorId: bigint, dealerId: bigint): Promise<string> {
  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!contractor || contractor.dealerId !== dealerId || !contractor.isDemo) throw new DemoNotFoundError();

  const token = randomBytes(32).toString('base64url');
  await prisma.contractor.update({ where: { id: contractorId }, data: { demoAccessToken: token } });
  return token;
}

/** 최근 60일 근태·민원·차량일지 샘플 데이터 시딩 (리포트/엑셀 시연용) */
async function seedDemoData(contractorId: bigint): Promise<void> {
  const worker = await prisma.user.create({
    data: {
      contractorId,
      username: `demo_worker_${contractorId}`,
      passwordHash: await hashPassword(`demo-${contractorId}-${Date.now()}`),
      role: 'WORKER',
      name: '데모 작업자',
      status: 'ACTIVE',
    },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      contractorId,
      vehicleNo: `데모${String(contractorId).slice(-4)}`,
      vehicleType: 'COMPACTOR_REFUSE',
      fuelType: 'DIESEL',
      status: 'ACTIVE',
      driverId: worker.id,
    },
  });

  const DAYS = 60;
  const today = new Date();
  const attendanceRows = [];
  const vehicleLogRows = [];
  const complaintRows = [];

  for (let i = 0; i < DAYS; i++) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const workDate = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    if (isWeekend) continue;

    attendanceRows.push({
      workerId: worker.id,
      contractorId,
      workDate,
      checkInTime: new Date(workDate.getTime() + 8 * 60 * 60 * 1000),
      checkOutTime: new Date(workDate.getTime() + 17 * 60 * 60 * 1000),
      workType: 'NORMAL' as const,
      status: 'APPROVED' as const,
    });

    vehicleLogRows.push({
      vehicleId: vehicle.id,
      driverId: worker.id,
      logDate: workDate,
      startMileage: 10000 + i * 40,
      endMileage: 10000 + i * 40 + 35,
      wasteWeightKg: 800 + (i % 5) * 50,
      tripCount: 3,
      status: 'APPROVED' as const,
    });

    if (i % 7 === 0) {
      complaintRows.push({
        contractorId,
        type: (['PICKUP_MISS', 'ILLEGAL_DUMP', 'ODOR_NOISE'] as const)[i % 3],
        description: '데모 샘플 민원 — 실제 시민 정보 아님',
        reportedAt: workDate,
      });
    }
  }

  await prisma.attendanceRecord.createMany({ data: attendanceRows });
  await prisma.vehicleLog.createMany({ data: vehicleLogRows });
  await prisma.complaint.createMany({ data: complaintRows });
}

export type CleanupResult = { dryRun: boolean; contractorsDeleted: number };

/**
 * 만료된 데모 Contractor/Municipality를 정리한다. dryRun=true면 카운트만 반환(삭제 없음).
 * 각 Contractor는 독립된 트랜잭션으로 삭제 — 하나가 실패해도(FK 누락 등) 나머지는 진행됨.
 */
export async function cleanupExpiredDemos(dryRun: boolean): Promise<CleanupResult> {
  const expired = await prisma.contractor.findMany({
    where: { isDemo: true, demoExpiresAt: { lt: new Date() } },
    select: { id: true, municipalityId: true },
  });

  if (dryRun) return { dryRun: true, contractorsDeleted: expired.length };

  let deleted = 0;
  for (const c of expired) {
    await prisma.$transaction(async (tx) => {
      await deleteDemoContractorData(tx, c.id);
      await deleteDemoMunicipalityIfEmpty(tx, c.municipalityId);
    });
    deleted += 1;
  }
  return { dryRun: false, contractorsDeleted: deleted };
}
