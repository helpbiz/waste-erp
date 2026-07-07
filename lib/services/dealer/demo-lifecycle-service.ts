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
import { DEALER_DEMO_QUOTA, DEMO_TTL_DAYS, MUNI_DEMO_COMPANY_COUNT } from '@/lib/types/dealer';

function randomSuffix(len = 12): string {
  return randomBytes(len).toString('hex').slice(0, len);
}

export class DemoNotFoundError extends Error {
  constructor() { super('demo_not_found'); }
}

export class DemoQuotaExceededError extends Error {
  constructor() { super('demo_quota_exceeded'); }
}

/**
 * 딜러당 활성 데모 개수 — Contractor가 아니라 "데모 지자체(Municipality)" 단위로 센다.
 * 단독 회사 데모(무니1:회사1)와 지자체 모드 그룹 데모(무니1:회사3)를 동일하게 "1"로 카운트해
 * 쿼터가 자연히 통일된다(에이전트팀 검토 권고). Municipality.createdBy는 dealer-channel
 * 경로에서만 dealerId가 세팅되므로(provision()/provisionMunicipalityDemo() 실측 확인)
 * isDemo=true 범위 안에서는 안전하게 dealerId로 취급 가능.
 */
export async function countActiveDemos(dealerId: bigint): Promise<number> {
  return prisma.municipality.count({
    where: { createdBy: dealerId, isDemo: true, demoExpiresAt: { gt: new Date() } },
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

export type ProvisionMunicipalityDemoResult = {
  municipalityId: bigint;
  contractorIds: bigint[];
  adminUsername: string;
  generatedPassword: string;
  demoAccessToken: string;
  expiresAt: string;
};

/**
 * 지자체 모드 그룹 데모 — 가상 지자체 1개 + 가상 위탁업체 MUNI_DEMO_COMPANY_COUNT개 +
 * MUNI_ADMIN 데모 계정 1개를 한 번에 만들어 3개 회사를 통합 모니터링하는 실제
 * MUNI_ADMIN 대시보드를 시연할 수 있게 한다(에이전트팀 조건부 승인, 2026-07-08).
 *
 * 절대 제약: 관리자 계정 role은 반드시 MUNI_ADMIN — SUPER_ADMIN 부여 코드 경로 신설 금지
 * (provisioning-service.ts의 기존 CONTRACTOR_ADMIN 하드코딩 원칙과 동일하게 적용).
 * 지자체 생성 트랜잭션과 각 회사의 데이터 시딩(seedDemoData)은 분리한다 — 시딩까지
 * 하나의 긴 트랜잭션에 묶으면 실서비스와 같은 DB의 락 점유 시간이 길어짐(DB 안정성 검토 권고).
 */
export async function provisionMunicipalityDemo(dealerId: bigint): Promise<ProvisionMunicipalityDemoResult> {
  const activeCount = await countActiveDemos(dealerId);
  if (activeCount >= DEALER_DEMO_QUOTA) throw new DemoQuotaExceededError();

  const suffix = Date.now().toString(36).slice(-6);
  const demoExpiresAt = new Date(Date.now() + DEMO_TTL_DAYS * 24 * 60 * 60 * 1000);
  const demoAccessToken = randomBytes(32).toString('base64url');
  const generatedPassword = randomSuffix(12);
  const adminUsername = `muni_demo_${suffix}`;

  const created = await prisma.$transaction(async (tx) => {
    const municipality = await tx.municipality.create({
      data: {
        name: `데모지자체-${suffix}`,
        code: `DEMO-M-${randomSuffix(10)}`,
        status: 'ACTIVE',
        createdBy: dealerId,
        isDemo: true,
        demoExpiresAt,
        demoAccessToken,
      },
    });

    await tx.muniAccessPolicy.create({ data: { municipalityId: municipality.id, updatedBy: dealerId } });

    await tx.user.create({
      data: {
        municipalityId: municipality.id,
        username: adminUsername,
        passwordHash: await hashPassword(generatedPassword),
        role: 'MUNI_ADMIN', // 절대 SUPER_ADMIN 아님 — provisioning-service.ts와 동일한 하드코딩 원칙
        name: '데모 지자체관리자',
        status: 'ACTIVE',
      },
    });

    const contractorIds: bigint[] = [];
    for (let i = 1; i <= MUNI_DEMO_COMPANY_COUNT; i += 1) {
      await tx.wasteTreatmentFacility.create({
        data: {
          municipalityId: municipality.id,
          type: 'OTHER',
          name: `데모위탁업체${i}-${suffix} (데모 기본시설)`,
          active: true,
        },
      });
      const contractor = await tx.contractor.create({
        data: {
          municipalityId: municipality.id,
          companyName: `데모위탁업체${i}-${suffix}`,
          businessNo: `DEMO-${randomSuffix(12)}`,
          status: 'ACTIVE',
          dealerId,
          isDemo: true,
          demoExpiresAt,
        },
      });
      contractorIds.push(contractor.id);
    }

    return { municipalityId: municipality.id, contractorIds };
  });

  for (const contractorId of created.contractorIds) {
    await seedDemoData(contractorId);
  }

  return {
    municipalityId: created.municipalityId,
    contractorIds: created.contractorIds,
    adminUsername,
    generatedPassword,
    demoAccessToken,
    expiresAt: demoExpiresAt.toISOString(),
  };
}

export async function listActiveMunicipalityDemos(dealerId: bigint) {
  const municipalities = await prisma.municipality.findMany({
    where: { createdBy: dealerId, isDemo: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, demoExpiresAt: true, createdAt: true, demoAccessToken: true,
      contractors: { where: { isDemo: true }, select: { id: true, companyName: true } },
    },
  });
  return municipalities;
}

/**
 * 2026-07-06 — 예비고객이 딜러 개입 없이 바로 접속하는 매직링크 토큰 검증.
 * isDemo=true + 만료 전인 Contractor만 매칭, 해당 데모의 CONTRACTOR_ADMIN 계정을 함께 반환한다.
 *
 * 2026-07-08 — 지자체 모드 그룹 데모 확장: 토큰이 Contractor 것이 아니면 Municipality
 * 것인지 확인한다(둘 다 32바이트 랜덤이라 충돌 사실상 불가능). Municipality 쪽은
 * isDemo + 미만료 + role==='MUNI_ADMIN' 3중 가드를 동일하게 적용(보안 상담 권고).
 */
export async function resolveDemoAccessToken(token: string) {
  const contractor = await prisma.contractor.findUnique({
    where: { demoAccessToken: token },
    select: { id: true, isDemo: true, demoExpiresAt: true },
  });
  if (contractor) {
    if (!contractor.isDemo) return null;
    if (!contractor.demoExpiresAt || contractor.demoExpiresAt < new Date()) return null;
    const adminUser = await prisma.user.findFirst({
      where: { contractorId: contractor.id, role: 'CONTRACTOR_ADMIN' },
    });
    if (!adminUser || adminUser.status !== 'ACTIVE') return null;
    return { kind: 'contractor' as const, contractor, adminUser };
  }

  const municipality = await prisma.municipality.findUnique({
    where: { demoAccessToken: token },
    select: { id: true, isDemo: true, demoExpiresAt: true },
  });
  if (municipality) {
    if (!municipality.isDemo) return null;
    if (!municipality.demoExpiresAt || municipality.demoExpiresAt < new Date()) return null;
    const adminUser = await prisma.user.findFirst({
      where: { municipalityId: municipality.id, role: 'MUNI_ADMIN' },
    });
    if (!adminUser || adminUser.status !== 'ACTIVE') return null;
    return { kind: 'municipality' as const, municipality, adminUser };
  }

  return null;
}

/** 링크 유출 시 딜러가 직접 재발급(구 링크는 즉시 무효화) */
export async function regenerateDemoAccessToken(contractorId: bigint, dealerId: bigint): Promise<string> {
  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!contractor || contractor.dealerId !== dealerId || !contractor.isDemo) throw new DemoNotFoundError();

  const token = randomBytes(32).toString('base64url');
  await prisma.contractor.update({ where: { id: contractorId }, data: { demoAccessToken: token } });
  return token;
}

/** 지자체 모드 그룹 데모용 매직링크 재발급 — Municipality.createdBy로 소유 딜러 검증 */
export async function regenerateMunicipalityDemoAccessToken(municipalityId: bigint, dealerId: bigint): Promise<string> {
  const municipality = await prisma.municipality.findUnique({ where: { id: municipalityId } });
  if (!municipality || municipality.createdBy !== dealerId || !municipality.isDemo) throw new DemoNotFoundError();

  const token = randomBytes(32).toString('base64url');
  await prisma.municipality.update({ where: { id: municipalityId }, data: { demoAccessToken: token } });
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

/**
 * 딜러가 필요 없어진 단독 회사 데모를 만료를 기다리지 않고 즉시 삭제해 쿼터 슬롯을 회수한다.
 * cleanupExpiredDemos()와 동일한 삭제 로직(deleteDemoContractorData/deleteDemoMunicipalityIfEmpty)을
 * 재사용 — 소유 딜러 검증만 추가.
 */
export async function deleteDemoNow(contractorId: bigint, dealerId: bigint): Promise<void> {
  const contractor = await prisma.contractor.findUnique({ where: { id: contractorId } });
  if (!contractor || contractor.dealerId !== dealerId || !contractor.isDemo) throw new DemoNotFoundError();

  await prisma.$transaction(async (tx) => {
    await deleteDemoContractorData(tx, contractorId);
    await deleteDemoMunicipalityIfEmpty(tx, contractor.municipalityId);
  });
}

/** 지자체 모드 그룹 데모 즉시 삭제 — 산하 위탁업체 전부 + MUNI_ADMIN 계정 + 지자체까지 한 번에 정리 */
export async function deleteMunicipalityDemoNow(municipalityId: bigint, dealerId: bigint): Promise<void> {
  const municipality = await prisma.municipality.findUnique({ where: { id: municipalityId } });
  if (!municipality || municipality.createdBy !== dealerId || !municipality.isDemo) throw new DemoNotFoundError();

  const contractors = await prisma.contractor.findMany({
    where: { municipalityId, isDemo: true },
    select: { id: true },
  });

  for (const c of contractors) {
    await prisma.$transaction(async (tx) => {
      await deleteDemoContractorData(tx, c.id);
      await deleteDemoMunicipalityIfEmpty(tx, municipalityId);
    });
  }
  // 산하 위탁업체가 애초에 0개였던 경우(이론상 없음, 방어) — 지자체만 남아있으면 마저 정리
  await prisma.$transaction(async (tx) => {
    await deleteDemoMunicipalityIfEmpty(tx, municipalityId);
  });
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
