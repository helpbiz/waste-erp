/**
 * dealer-channel Design §3.3 — 데모 Contractor 정리(cleanup) 시 FK 안전 삭제 순서.
 *
 * 배경: Contractor 자식 모델 대부분이 onDelete: Cascade 를 쓰지 않는다(Cascade는
 * ContractorFeature 단 하나뿐, prisma/schema.prisma 실측 확인). 그래서 삭제는
 * 자식→부모 역순으로, 그리고 Contractor.id로 직접 스코핑되지 않는 조인 전용
 * 테이블(TbmSignature/VehicleLog/Signature/AnnualLeaveBalance/LeaveRequest/
 * WebPushSubscription)은 부모(TbmSession/Vehicle/User) 경유로 먼저 지워야 한다.
 *
 * ⚠️ 이 순서는 2026-07-06 기준 스키마 실측으로 작성된 1차 목록이다.
 * prisma.$transaction 안에서만 실행되므로, 순서가 틀리면 트랜잭션이 롤백될 뿐
 * 데이터가 깨지지는 않는다(fail-closed) — 그래도 프로덕션 cron 최초 실행 전
 * 반드시 스테이징에서 dryRun=false 로 실제 삭제 리허설을 한 번 돌려볼 것.
 * 신규 Contractor 자식 모델을 추가하면 이 배열/함수도 함께 갱신해야 한다.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * 순수 Contractor.id FK를 갖는 자식 테이블 — 역순(자식이 먼저) 삭제 대상.
 * User/Department/ContractorPosition/ContractorRank 는 상호 참조(순환)가 있어
 * 별도 처리(아래 deleteDemoContractorData 참고)하므로 이 목록에서 제외.
 */
const DIRECT_CHILD_MODELS = [
  'cleaningZone', 'adminDong', 'attendanceRecord', 'vehicle', 'costCalculation',
  'complaint', 'tbmSession', 'healthRecord', 'safetyReport', 'auditLog',
  'approvalPolicy', 'bulkyWasteConfig', 'wasteTreatmentRecord', 'recyclingCenterIntake',
  'reportTemplate', 'liveTrackingConfig', 'vehicleGpsPosition', 'announcement',
  'payslipRecord', 'garage', 'disposalSite', 'payrollPolicy', 'weatherSafetyNotice',
  'vehiclePdfArchive', 'workerZone',
  // WorkerSuggestion/PunchRestriction 은 departmentId 도 참조하므로 Department보다 먼저 삭제되도록
  // 이 배열 안에서 이미 앞쪽(위)에 위치 — 아래 workerSuggestion/punchRestriction 이후 department 순.
] as const;

const NEEDS_DEPARTMENT_BEFORE = ['workerSuggestion', 'punchRestriction'] as const;

export const DEMO_CHILD_TABLE_ORDER = [
  ...DIRECT_CHILD_MODELS,
  ...NEEDS_DEPARTMENT_BEFORE,
  'contractorFeature', // onDelete:Cascade 라 사실 자동 정리되지만 명시적으로도 포함
] as const;

/**
 * 데모 Contractor 하나(및 그 자식 전부)를 트랜잭션 안에서 삭제한다.
 * 호출자(DemoLifecycleService)가 prisma.$transaction(tx => ...) 콜백 안에서 tx를 넘겨야 한다.
 */
export async function deleteDemoContractorData(tx: Tx, contractorId: bigint): Promise<void> {
  const userIds = (
    await tx.user.findMany({ where: { contractorId }, select: { id: true } })
  ).map((u) => u.id);

  // 1) 순환 FK 차단: User → Signature/ContractorPosition/ContractorRank/Department 참조를 먼저 끊는다.
  if (userIds.length > 0) {
    await tx.user.updateMany({
      where: { id: { in: userIds } },
      data: { activeSignatureId: null, contractorPositionId: null, rankId: null, departmentId: null },
    });
  }

  // 2) User 경유로만 스코핑되는 조인 전용 테이블 (Contractor.id 직접 FK 없음)
  if (userIds.length > 0) {
    await tx.tbmSignature.deleteMany({ where: { workerId: { in: userIds } } });
    await tx.signature.deleteMany({ where: { userId: { in: userIds } } });
    await tx.webPushSubscription.deleteMany({ where: { userId: { in: userIds } } });
    await tx.annualLeaveBalance.deleteMany({ where: { workerId: { in: userIds } } });
    await tx.leaveRequest.deleteMany({ where: { workerId: { in: userIds } } });
  }

  // 3) Vehicle 경유로만 스코핑되는 조인 전용 테이블
  const vehicleIds = (
    await tx.vehicle.findMany({ where: { contractorId }, select: { id: true } })
  ).map((v) => v.id);
  if (vehicleIds.length > 0) {
    await tx.vehicleLog.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
  }

  // 4) Contractor.id 직접 FK를 갖는 자식들 — DIRECT_CHILD_MODELS + NEEDS_DEPARTMENT_BEFORE 순서 그대로
  for (const modelKey of DEMO_CHILD_TABLE_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (tx as any)[modelKey];
    if (!client?.deleteMany) continue;
    await client.deleteMany({ where: { contractorId } });
  }

  // 5) User 본체 삭제 (위에서 순환 FK를 이미 끊었으므로 안전)
  if (userIds.length > 0) {
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // 6) Contractor 본체 삭제
  await tx.contractor.delete({ where: { id: contractorId } });
}

/**
 * 해당 Municipality 산하에 (이 데모 외) 다른 Contractor가 없으면 Municipality도 함께 정리.
 *
 * ⚠️ 2026-07-08 — User.municipalityId는 @relation 미선언(DB FK 없음) 컬럼이라, MUNI_ADMIN
 * 데모 계정을 여기서 지우지 않으면 municipality 삭제가 에러 없이 조용히 성공하고 해당
 * User row(비밀번호 해시 포함)만 municipality_id가 가리키는 대상 없이 영구 고아로 남는다
 * (에이전트팀 검토로 확인된 실제 위험 — FK violation이 아니라 "조용한 성공"이라 더 위험).
 */
export async function deleteDemoMunicipalityIfEmpty(tx: Tx, municipalityId: bigint): Promise<void> {
  const remaining = await tx.contractor.count({ where: { municipalityId } });
  if (remaining > 0) return;

  const municipality = await tx.municipality.findUnique({ where: { id: municipalityId }, select: { isDemo: true } });
  if (!municipality?.isDemo) return; // 안전장치: 데모 지자체가 아니면 절대 삭제하지 않음

  const muniAdminIds = (
    await tx.user.findMany({ where: { municipalityId, role: 'MUNI_ADMIN' }, select: { id: true } })
  ).map((u) => u.id);
  if (muniAdminIds.length > 0) {
    await tx.user.updateMany({ where: { id: { in: muniAdminIds } }, data: { activeSignatureId: null } });
    await tx.signature.deleteMany({ where: { userId: { in: muniAdminIds } } });
    await tx.webPushSubscription.deleteMany({ where: { userId: { in: muniAdminIds } } });
    await tx.user.deleteMany({ where: { id: { in: muniAdminIds } } });
  }

  await tx.muniAccessPolicy.deleteMany({ where: { municipalityId } });
  await tx.wasteTreatmentFacility.deleteMany({ where: { municipalityId } });
  await tx.municipality.delete({ where: { id: municipalityId } });
}
