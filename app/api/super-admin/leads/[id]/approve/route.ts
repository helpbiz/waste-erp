/**
 * PATCH /api/super-admin/leads/:id/approve — 리드 승인(검토+확정) → 실계정 프로비저닝
 * 권한: SUPER_ADMIN 전용.
 *
 * 2026-07-06 승인플로우 간소화: 회사정보는 딜러가 리드 등록/보강 시점에 이미 입력해뒀다는 전제.
 * body는 전부 선택(override) — SUPER_ADMIN이 딜러 입력값을 그대로 승인하려면 빈 body만 보내면 됨.
 * adminPassword는 절대 입력받지 않음(제3자 백도어 방지) — 시스템이 자동생성해 응답으로 1회 반환.
 * 필수 필드 누락 시 409 lead_incomplete + missing 목록 반환(승인 버튼을 막는 근거로 사용).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseId } from '@/lib/ids';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import {
  approveLead, LeadNotFoundError, LeadAlreadyReviewedError, LeadIncompleteError,
} from '@/lib/services/dealer/lead-service';

export const runtime = 'nodejs';

const Body = z.object({
  municipalityName: z.string().trim().min(1).max(100).optional(),
  municipalityCode: z.string().trim().min(2).max(20).optional(),
  municipalityRegion: z.string().trim().max(50).optional(),
  contractorName: z.string().trim().min(1).max(100).optional(),
  contractorBusinessNo: z.string().trim().min(1).max(20).optional(),
  adminUsername: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9_.@-]+$/).optional(),
  adminName: z.string().trim().min(1).max(50).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const leadId = parseId(params.id);
  if (!leadId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const { lead, provision } = await approveLead({
      leadId,
      reviewerId: BigInt(session.userId),
      overrides: parsed.data,
    });

    await writeAudit(req, session, {
      action: 'LEAD_APPROVE',
      resourceType: 'lead',
      resourceId: lead.id.toString(),
      contractorId: provision.contractorId,
      municipalityId: provision.municipalityId,
      metadata: {
        dealerId: lead.dealerId.toString(),
        crossTenant: true,
        overridesApplied: Object.keys(parsed.data).length > 0,
      },
    });

    return NextResponse.json({
      leadId: lead.id.toString(),
      contractorId: provision.contractorId.toString(),
      municipalityId: provision.municipalityId.toString(),
      adminUsername: provision.adminUsername,
      adminPassword: provision.generatedPassword,
    });
  } catch (e) {
    if (e instanceof LeadNotFoundError) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
    if (e instanceof LeadAlreadyReviewedError) return NextResponse.json({ error: 'lead_already_reviewed' }, { status: 409 });
    if (e instanceof LeadIncompleteError) return NextResponse.json({ error: 'lead_incomplete', missing: e.missing }, { status: 409 });
    throw e;
  }
}
