/**
 * Tenant-aware audit log helper (P0-residual).
 *
 * 목적:
 *  - audit_log.contractor_id / municipality_id 자동 채움 → tenant 단위 forensic 검색
 *  - actor / IP / UA 패턴 통일
 *  - SUPER_ADMIN의 cross-tenant 작업도 명시적 contractorId 인자로 추적 가능
 *
 * 사용 예:
 *   import { writeAudit } from '@/lib/audit';
 *   await writeAudit(req, session, {
 *     action: 'ATTENDANCE_CHECK_IN',
 *     resourceType: 'attendance_record',
 *     resourceId: record.id.toString(),
 *     metadata: { lat, lng },
 *   });
 *
 * SUPER가 다른 tenant 자원을 변경하는 경우엔 contractorId/municipalityId 명시:
 *   await writeAudit(req, session, {
 *     action: 'SUPER_CONTRACTOR_UPDATE',
 *     resourceType: 'contractor',
 *     resourceId: id.toString(),
 *     contractorId: id, // 작업 대상 tenant
 *     metadata: { changes },
 *   });
 */
import { prisma } from '@/lib/db';
import type { SessionPayload } from '@/lib/auth';

export type AuditInput = {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | object | null;
  /* 명시적 override — SUPER_ADMIN이 cross-tenant 작업 시 사용 */
  contractorId?: bigint | string | number | null;
  municipalityId?: bigint | string | number | null;
};

function toBigIntOrNull(v: bigint | string | number | null | undefined): bigint | null {
  if (v == null) return null;
  if (typeof v === 'bigint') return v;
  try {
    return BigInt(v);
  } catch {
    return null;
  }
}

export async function writeAudit(
  req: Request,
  session: SessionPayload | null,
  input: AuditInput
): Promise<void> {
  const sessionContractorId = toBigIntOrNull(session?.contractorId ?? null);
  const sessionMunicipalityId = toBigIntOrNull(session?.municipalityId ?? null);
  const contractorId =
    input.contractorId !== undefined
      ? toBigIntOrNull(input.contractorId)
      : sessionContractorId;
  const municipalityId =
    input.municipalityId !== undefined
      ? toBigIntOrNull(input.municipalityId)
      : sessionMunicipalityId;

  await prisma.auditLog.create({
    data: {
      actorId: session ? toBigIntOrNull(session.userId) : null,
      actorRole: session?.role ?? null,
      contractorId,
      municipalityId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      metadata: (input.metadata ?? undefined) as object | undefined,
    },
  });
}
