/** dealer-channel Design §9.4 — 리드 등록/조회/승인/반려 */
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { provision } from './provisioning-service';

/** 2026-07-06 승인플로우 간소화 — 딜러가 리드 등록/보강 시점에 입력하는 회사정보 필드 */
export type LeadCompanyFields = {
  municipalityName?: string | null;
  municipalityCode?: string | null;
  municipalityRegion?: string | null;
  contractorName?: string | null;
  contractorBusinessNo?: string | null;
  adminUsername?: string | null;
  adminName?: string | null;
};

export type CreateLeadInput = {
  dealerId: bigint;
  prospectName: string;
  prospectContact?: string | null;
  memo?: string | null;
} & LeadCompanyFields;

export async function createLead(input: CreateLeadInput) {
  const referralCode = `LEAD-${randomBytes(6).toString('hex')}`;
  return prisma.lead.create({
    data: {
      dealerId: input.dealerId,
      prospectName: input.prospectName,
      prospectContact: input.prospectContact ?? null,
      memo: input.memo ?? null,
      referralCode,
      municipalityName: input.municipalityName ?? null,
      municipalityCode: input.municipalityCode ?? null,
      municipalityRegion: input.municipalityRegion ?? null,
      contractorName: input.contractorName ?? null,
      contractorBusinessNo: input.contractorBusinessNo ?? null,
      adminUsername: input.adminUsername ?? null,
      adminName: input.adminName ?? null,
    },
  });
}

export async function listOwnLeads(dealerId: bigint) {
  return prisma.lead.findMany({
    where: { dealerId },
    orderBy: { createdAt: 'desc' },
  });
}

/** 딜러가 상담 초기에 못 채운 회사정보를 나중에 보강(예: "시스템 소개 → 테스트 요청" 이후) */
export async function updateLeadCompanyFields(leadId: bigint, dealerId: bigint, fields: LeadCompanyFields) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError();
  if (lead.dealerId !== dealerId) throw new LeadNotFoundError();
  if (lead.status !== 'PENDING') throw new LeadAlreadyReviewedError();

  return prisma.lead.update({ where: { id: leadId }, data: fields });
}

const REQUIRED_COMPANY_FIELDS: (keyof LeadCompanyFields)[] = [
  'municipalityName', 'municipalityCode', 'contractorName', 'contractorBusinessNo', 'adminUsername', 'adminName',
];

export type ApproveLeadInput = {
  leadId: bigint;
  reviewerId: bigint;
  /** SUPER_ADMIN이 승인 화면에서 딜러 입력값을 정정하고 싶을 때만 사용(선택) */
  overrides?: LeadCompanyFields;
};

/**
 * 리드 승인 → 딜러가 등록해둔 회사정보(+SUPER_ADMIN 정정값)로
 * ProvisioningService.provision(isDemo:false) 호출 → 실계정 생성 →
 * Lead.status=APPROVED + contractorId 스탬프.
 * adminPassword는 절대 입력받지 않고 provision()이 자동생성 → 결과로 1회 반환.
 * Design §2.2 리드→승인 플로우, 2026-07-06 승인플로우 간소화 리팩토링.
 */
export async function approveLead(input: ApproveLeadInput) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new LeadNotFoundError();
  if (lead.status !== 'PENDING') throw new LeadAlreadyReviewedError();

  const merged: LeadCompanyFields = {
    municipalityName: input.overrides?.municipalityName ?? lead.municipalityName,
    municipalityCode: input.overrides?.municipalityCode ?? lead.municipalityCode,
    municipalityRegion: input.overrides?.municipalityRegion ?? lead.municipalityRegion,
    contractorName: input.overrides?.contractorName ?? lead.contractorName,
    contractorBusinessNo: input.overrides?.contractorBusinessNo ?? lead.contractorBusinessNo,
    adminUsername: input.overrides?.adminUsername ?? lead.adminUsername,
    adminName: input.overrides?.adminName ?? lead.adminName,
  };

  const missing = REQUIRED_COMPANY_FIELDS.filter((k) => !merged[k]);
  if (missing.length > 0) throw new LeadIncompleteError(missing);

  const result = await provision(
    {
      municipalityName: merged.municipalityName!,
      municipalityCode: merged.municipalityCode!,
      municipalityRegion: merged.municipalityRegion ?? undefined,
      contractorName: merged.contractorName!,
      contractorBusinessNo: merged.contractorBusinessNo!,
      adminUsername: merged.adminUsername!,
      adminName: merged.adminName!,
      dealerId: lead.dealerId,
      // adminPassword 미전달 — provision()이 자동생성
    },
    { isDemo: false },
  );

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: input.reviewerId,
      contractorId: result.contractorId,
      ...merged,
    },
  });

  return { lead: updated, provision: result };
}

export async function rejectLead(leadId: bigint, reviewerId: bigint) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadNotFoundError();
  if (lead.status !== 'PENDING') throw new LeadAlreadyReviewedError();

  return prisma.lead.update({
    where: { id: leadId },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: reviewerId },
  });
}

export class LeadNotFoundError extends Error {
  constructor() { super('lead_not_found'); }
}
export class LeadAlreadyReviewedError extends Error {
  constructor() { super('lead_already_reviewed'); }
}
export class LeadIncompleteError extends Error {
  missing: string[];
  constructor(missing: string[]) {
    super('lead_incomplete');
    this.missing = missing;
  }
}
