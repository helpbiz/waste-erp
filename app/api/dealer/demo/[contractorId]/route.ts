/**
 * DELETE /api/dealer/demo/:contractorId — 단독 회사 데모 즉시 삭제(쿼터 슬롯 즉시 회수).
 * 권한: DEALER 전용, 본인 데모만. 2026-07-08 추가.
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { deleteDemoNow, DemoNotFoundError } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function DELETE(req: Request, { params }: { params: { contractorId: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const contractorId = parseId(params.contractorId);
  if (!contractorId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  try {
    await deleteDemoNow(contractorId, BigInt(session.userId));
    await writeAudit(req, session, {
      action: 'DEMO_DELETE_MANUAL',
      resourceType: 'contractor',
      resourceId: contractorId.toString(),
      contractorId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof DemoNotFoundError) return NextResponse.json({ error: 'demo_not_found' }, { status: 404 });
    throw e;
  }
}
