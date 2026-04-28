/**
 * Tenant-scoped Prisma client (P0-residual Stage 2-A).
 *
 * 목적:
 *  - 비-SUPER 사용자가 `prisma.X.findMany()`를 직접 호출해도 본인 contractorId
 *    범위로 자동 필터링 (defense in depth).
 *  - 기존 `xxxWhere(session)` 헬퍼는 그대로 유지하되, 호출 누락이나 추후 신규
 *    라우트에서 깜빡 빠뜨리는 경우의 안전망.
 *  - SUPER_ADMIN은 본 wrapper 사용 시에도 무필터 (cross-tenant 작업 가능).
 *  - MUNI_ADMIN은 contractor.municipalityId 매칭 필터 자동 적용.
 *
 * 적용 대상 모델 (contractor_id 직접 보유):
 *   AttendanceRecord, AttendanceMonth(내부 prisma name 확인 필요), BulkyWasteConfig,
 *   Complaint, Delegation(내부 prisma name 확인 필요), LiveTrackingConfig,
 *   RecyclingCenterIntake, SafetyReport, TbmSession, User, Vehicle,
 *   WasteTreatmentRecord, HealthRecord, ReportTemplate, ApprovalPolicy,
 *   CleaningZone, AdminDong, CostCalculation, Department.
 *
 * 적용 메서드: findMany, findFirst, findUnique, count, aggregate, groupBy
 * 쓰기는 기존 명시 패턴 유지 (writeAudit + 명시 contractorId 인자).
 *
 * 사용 예:
 *   const tdb = tenantPrisma(session);  // session에서 자동 추출
 *   const items = await tdb.complaint.findMany({});  // contractorId 자동 주입
 *
 *   // SUPER_ADMIN cross-tenant 작업 시엔 그냥 prisma 사용:
 *   const all = await prisma.complaint.findMany({});
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { SessionPayload } from '@/lib/auth';

/* contractor_id 직접 컬럼 모델 (Prisma camelCase model name 기준) */
const CONTRACTOR_SCOPED_MODELS = new Set<string>([
  'AdminDong',
  'ApprovalPolicy',
  'AttendanceRecord',
  'BulkyWasteConfig',
  'CleaningZone',
  'Complaint',
  'CostCalculation',
  'Department',
  'HealthRecord',
  'LiveTrackingConfig',
  'RecyclingCenterIntake',
  'ReportTemplate',
  'SafetyReport',
  'TbmSession',
  'User',
  'Vehicle',
  'WasteTreatmentRecord',
]);

const READ_OPERATIONS = new Set<string>([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const MUTATE_OPERATIONS = new Set<string>([
  'updateMany',
  'deleteMany',
]);

type TenantContext = {
  role: string;
  contractorId: bigint | null;
  municipalityId: bigint | null;
};

function deriveContext(session: SessionPayload): TenantContext {
  return {
    role: session.role,
    contractorId: session.contractorId ? BigInt(session.contractorId) : null,
    municipalityId: session.municipalityId ? BigInt(session.municipalityId) : null,
  };
}

function buildTenantFilter(
  modelName: string,
  ctx: TenantContext
): Record<string, unknown> | null {
  if (ctx.role === 'SUPER_ADMIN') return null;
  if (!CONTRACTOR_SCOPED_MODELS.has(modelName)) return null;

  if (ctx.role === 'MUNI_ADMIN' && ctx.municipalityId !== null) {
    /* MUNI_ADMIN — contractor.municipalityId 매칭 (Vehicle/Complaint/SafetyReport 등 contractor 관계 보유) */
    return { contractor: { municipalityId: ctx.municipalityId } };
  }

  if (ctx.contractorId !== null) {
    return { contractorId: ctx.contractorId };
  }

  /* contractorId 없는 비-SUPER → 0건 강제 (불가능한 ID로 차단) */
  return { contractorId: -1n };
}

function mergeWhere(
  existing: Record<string, unknown> | undefined,
  filter: Record<string, unknown>
): Record<string, unknown> {
  if (!existing) return filter;
  /* AND 배열 병합으로 기존 where와 충돌 없이 적용 */
  return { AND: [existing, filter] };
}

/**
 * tenantPrisma(session) — 본 wrapper로 prisma 호출 시 contractor 범위 자동 필터.
 *
 * 주의:
 *  - findUnique 호출은 자동으로 findFirst로 전환됨 (where 추가 필터링 불가하므로).
 *  - 쓰기(create/update/delete)는 기존 패턴 유지 — wrapper는 mutateMany만 처리.
 */
export function tenantPrisma(session: SessionPayload) {
  const ctx = deriveContext(session);

  return prisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!CONTRACTOR_SCOPED_MODELS.has(model)) {
            return query(args);
          }
          const filter = buildTenantFilter(model, ctx);
          if (!filter) return query(args);

          if (READ_OPERATIONS.has(operation) || MUTATE_OPERATIONS.has(operation)) {
            const a = (args ?? {}) as Record<string, unknown>;

            /* findUnique → findFirst (where에 추가 필터 합성 가능하도록) */
            if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
              const newArgs = { ...a, where: mergeWhere(a.where as Record<string, unknown>, filter) };
              const newOp = operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';
              /* findUnique → findFirst 전환: extension query()는 operation 변경 불가하므로
                 prisma client 직접 호출 (model camelCase property 사용) */
              const client = prisma as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>;
              return client[modelToCamel(model)][newOp](newArgs);
            }

            const newWhere = mergeWhere(a.where as Record<string, unknown>, filter);
            return query({ ...a, where: newWhere } as typeof args);
          }

          return query(args);
        },
      },
    },
  });
}

/* Prisma model 이름은 PascalCase, client property는 camelCase */
function modelToCamel(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/* 타입 노출 — 사용처에서 ReturnType<typeof tenantPrisma> 활용 가능 */
export type TenantPrisma = ReturnType<typeof tenantPrisma>;

/* 명시적 `Prisma` 재노출 — 호출처에서 import 편의 */
export { Prisma };
