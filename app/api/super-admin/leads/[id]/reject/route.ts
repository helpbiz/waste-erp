/**
 * PATCH /api/super-admin/leads/:id/reject — 리드 반려
 * 권한: SUPER_ADMIN 전용. Design §4.2.
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { rejectLead, LeadNotFoundError, LeadAlreadyReviewedError } from '@/lib/services/dealer/lead-service';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const leadId = parseId(params.id);
  if (!leadId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  try {
    const lead = await rejectLead(leadId, BigInt(session.userId));

    await writeAudit(req, session, {
      action: 'LEAD_REJECT',
      resourceType: 'lead',
      resourceId: lead.id.toString(),
      metadata: { dealerId: lead.dealerId.toString(), crossTenant: true },
    });

    return NextResponse.json({ leadId: lead.id.toString(), status: lead.status });
  } catch (e) {
    if (e instanceof LeadNotFoundError) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
    if (e instanceof LeadAlreadyReviewedError) return NextResponse.json({ error: 'lead_already_reviewed' }, { status: 409 });
    throw e;
  }
}
