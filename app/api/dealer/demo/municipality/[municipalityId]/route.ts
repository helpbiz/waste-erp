/**
 * DELETE /api/dealer/demo/municipality/:municipalityId — 지자체 모드 그룹 데모 즉시 삭제
 * (산하 위탁업체 전부 + MUNI_ADMIN 계정 포함, 쿼터 슬롯 즉시 회수).
 * 권한: DEALER 전용, 본인 데모만. 2026-07-08 추가.
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { readSession } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';
import { deleteMunicipalityDemoNow, DemoNotFoundError } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function DELETE(req: Request, { params }: { params: { municipalityId: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const municipalityId = parseId(params.municipalityId);
  if (!municipalityId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  try {
    await deleteMunicipalityDemoNow(municipalityId, BigInt(session.userId));
    await writeAudit(req, session, {
      action: 'DEMO_MUNICIPALITY_DELETE_MANUAL',
      resourceType: 'municipality',
      resourceId: municipalityId.toString(),
      municipalityId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof DemoNotFoundError) return NextResponse.json({ error: 'demo_not_found' }, { status: 404 });
    throw e;
  }
}
