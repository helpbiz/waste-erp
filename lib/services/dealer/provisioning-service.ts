/**
 * dealer-channel Design §2.0 Option B / §9.4 — 원자적 프로비저닝 코어.
 * 리드 승인(실계정)과 데모 셀프발급이 이 서비스 하나를 공유한다(Plan Open Q2 해소).
 *
 * 중요 제약(절대 위반 금지):
 *  - 데모 발급 시 admin 계정 role은 반드시 CONTRACTOR_ADMIN. SUPER_ADMIN 부여 코드 경로를
 *    만들지 않는다 (Design §7 Security Considerations, 보안 상담 핵심 권고).
 *  - 전체가 단일 prisma.$transaction 안에서 원자적으로 실행된다.
 */
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { DEMO_TTL_DAYS } from '@/lib/types/dealer';

export type ProvisionInput = {
  municipalityName: string;
  municipalityCode?: string;
  municipalityRegion?: string;
  contractorName: string;
  contractorBusinessNo?: string;
  adminUsername: string;
  adminPassword?: string;
  adminName: string;
  dealerId: bigint;
};

export type ProvisionResult = {
  municipalityId: bigint;
  contractorId: bigint;
  adminUserId: bigint;
  adminUsername: string;
  /** adminPassword를 자동생성한 경우에만 평문 비밀번호를 1회 반환(로그인 안내용) */
  generatedPassword?: string;
  /** isDemo=true일 때만 발급 — 예비고객이 딜러 개입 없이 바로 접속하는 매직링크 토큰 */
  demoAccessToken?: string;
};

function randomSuffix(len = 8): string {
  return randomBytes(len).toString('hex').slice(0, len);
}

/**
 * 지자체 + 위탁업체(dealerId 스탬프) + CONTRACTOR_ADMIN 계정 + 기본 접근정책 + 최소 처리시설 1건을
 * 단일 트랜잭션으로 생성한다.
 *
 * isDemo=false(리드 승인 경로): municipalityCode/contractorBusinessNo 필수.
 * isDemo=true(데모 셀프발급): 위 값들을 자동 생성(고유 코드/사업자번호).
 * adminPassword: 2026-07-06 승인플로우 간소화 — 어느 경로든 미입력 시 시스템이 자동생성해
 *   generatedPassword로 1회 반환한다(제3자가 신규 계정 비밀번호를 미리 알게 되는 백도어 방지,
 *   보안 상담 권고). 호출자가 명시적으로 넘기면 그 값을 그대로 사용.
 */
export async function provision(
  input: ProvisionInput,
  opts: { isDemo: boolean },
): Promise<ProvisionResult> {
  const isDemo = opts.isDemo;

  if (!isDemo && (!input.municipalityCode || !input.contractorBusinessNo)) {
    throw new Error('실계정 프로비저닝에는 municipalityCode/contractorBusinessNo가 필수입니다.');
  }

  const municipalityCode = input.municipalityCode ?? `DEMO-${randomSuffix(10)}`;
  const contractorBusinessNo = input.contractorBusinessNo ?? `DEMO-${randomSuffix(12)}`;
  const generatedPassword = input.adminPassword ? undefined : randomSuffix(12);
  const adminPasswordPlain = input.adminPassword ?? generatedPassword!;
  const demoExpiresAt = isDemo ? new Date(Date.now() + DEMO_TTL_DAYS * 24 * 60 * 60 * 1000) : null;
  // 2026-07-06 — 예비고객 직접 접속 매직링크. 32바이트 랜덤(추측 불가능한 길이) + isDemo 전용.
  const demoAccessToken = isDemo ? randomBytes(32).toString('base64url') : undefined;

  const passwordHash = await hashPassword(adminPasswordPlain);

  const result = await prisma.$transaction(async (tx) => {
    const municipality = await tx.municipality.create({
      data: {
        name: input.municipalityName,
        code: municipalityCode,
        region: input.municipalityRegion ?? null,
        status: 'ACTIVE',
        createdBy: input.dealerId,
        isDemo,
        demoExpiresAt,
      },
    });

    // 위탁업체 등록에는 활성 처리시설 최소 1건이 필요 (POST /api/contractors 기존 규칙과 동일하게 유지)
    await tx.wasteTreatmentFacility.create({
      data: {
        municipalityId: municipality.id,
        type: 'OTHER',
        name: isDemo ? `${input.contractorName} (데모 기본시설)` : `${input.contractorName} 기본시설`,
        active: true,
      },
    });

    await tx.muniAccessPolicy.create({
      data: {
        municipalityId: municipality.id,
        updatedBy: input.dealerId,
      },
    });

    const contractor = await tx.contractor.create({
      data: {
        municipalityId: municipality.id,
        companyName: input.contractorName,
        businessNo: contractorBusinessNo,
        status: isDemo ? 'ACTIVE' : 'SETUP',
        dealerId: input.dealerId,
        isDemo,
        demoExpiresAt,
        demoAccessToken,
      },
    });

    const adminUser = await tx.user.create({
      data: {
        contractorId: contractor.id,
        username: input.adminUsername,
        passwordHash,
        role: 'CONTRACTOR_ADMIN', // 절대 SUPER_ADMIN 아님 — Design §7 하드코딩 요구사항
        name: input.adminName,
        status: 'ACTIVE',
      },
    });

    return {
      municipalityId: municipality.id,
      contractorId: contractor.id,
      adminUserId: adminUser.id,
      adminUsername: adminUser.username,
    };
  });

  return { ...result, generatedPassword, demoAccessToken };
}
