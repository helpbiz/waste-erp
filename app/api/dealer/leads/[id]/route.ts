/**
 * PATCH /api/dealer/leads/:id — 딜러가 본인 리드의 회사정보를 보강(상담 진행에 따라 이어서 입력)
 * 권한: DEALER 전용, 본인 리드만. Design §9.4, 2026-07-06 승인플로우 간소화.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseId } from '@/lib/ids';
import { readSession } from '@/lib/auth';
import { updateLeadCompanyFields, LeadNotFoundError, LeadAlreadyReviewedError } from '@/lib/services/dealer/lead-service';
import { toLeadDTO } from '@/lib/types/dealer';

export const runtime = 'nodejs';

const PatchBody = z.object({
  municipalityName: z.string().trim().max(100).optional().nullable(),
  municipalityCode: z.string().trim().max(20).optional().nullable(),
  municipalityRegion: z.string().trim().max(50).optional().nullable(),
  contractorName: z.string().trim().max(100).optional().nullable(),
  contractorBusinessNo: z.string().trim().max(20).optional().nullable(),
  adminUsername: z.string().trim().max(50).optional().nullable(),
  adminName: z.string().trim().max(50).optional().nullable(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const leadId = parseId(params.id);
  if (!leadId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const lead = await updateLeadCompanyFields(leadId, BigInt(session.userId), parsed.data);
    return NextResponse.json(toLeadDTO(lead));
  } catch (e) {
    if (e instanceof LeadNotFoundError) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
    if (e instanceof LeadAlreadyReviewedError) return NextResponse.json({ error: 'lead_already_reviewed' }, { status: 409 });
    throw e;
  }
}
