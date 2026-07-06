/** dealer-channel Design §9.4 — Domain 타입 */
import type { Lead, LeadStatus, DealerCommission } from '@prisma/client';

export type LeadDTO = {
  id: string;
  dealerId: string;
  prospectName: string;
  prospectContact: string | null;
  referralCode: string;
  status: LeadStatus;
  memo: string | null;
  createdAt: string;
  reviewedAt: string | null;
  contractorId: string | null;
  /* 2026-07-06 승인플로우 간소화 — 딜러 입력 회사정보(승인 시 SUPER_ADMIN이 검토·확정) */
  municipalityName: string | null;
  municipalityCode: string | null;
  municipalityRegion: string | null;
  contractorName: string | null;
  contractorBusinessNo: string | null;
  adminUsername: string | null;
  adminName: string | null;
};

export function toLeadDTO(lead: Lead): LeadDTO {
  return {
    id: lead.id.toString(),
    dealerId: lead.dealerId.toString(),
    prospectName: lead.prospectName,
    prospectContact: lead.prospectContact,
    referralCode: lead.referralCode,
    status: lead.status,
    memo: lead.memo,
    createdAt: lead.createdAt.toISOString(),
    reviewedAt: lead.reviewedAt?.toISOString() ?? null,
    contractorId: lead.contractorId?.toString() ?? null,
    municipalityName: lead.municipalityName,
    municipalityCode: lead.municipalityCode,
    municipalityRegion: lead.municipalityRegion,
    contractorName: lead.contractorName,
    contractorBusinessNo: lead.contractorBusinessNo,
    adminUsername: lead.adminUsername,
    adminName: lead.adminName,
  };
}

export type DealerCommissionDTO = {
  id: string;
  dealerId: string;
  contractorId: string;
  commissionRate: string;
  createdAt: string;
};

export function toDealerCommissionDTO(c: DealerCommission): DealerCommissionDTO {
  return {
    id: c.id.toString(),
    dealerId: c.dealerId.toString(),
    contractorId: c.contractorId.toString(),
    commissionRate: c.commissionRate.toString(),
    createdAt: c.createdAt.toISOString(),
  };
}

/** 딜러당 동시 활성 데모(만료 전) 상한 — Plan Open Q1 기본값. Design §7.1 Q1. */
export const DEALER_DEMO_QUOTA = 3;

/** 데모 테넌트 기본 TTL(일) — Design §7.1 Q3 기본값 */
export const DEMO_TTL_DAYS = 14;

/** 데모 세션 JWT TTL(초) — 실계정 8h 대비 단축. Design §7 Security Considerations */
export const DEMO_SESSION_TTL_SEC = 60 * 45; // 45분
