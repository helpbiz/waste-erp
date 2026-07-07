/**
 * POST /api/dealer/demo/municipality/:municipalityId/regenerate-link
 * 유출된 지자체 모드 그룹 데모 링크 무효화 + 재발급. 권한: DEALER 전용, 본인 데모만.
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { readSession } from '@/lib/auth';
import { regenerateMunicipalityDemoAccessToken, DemoNotFoundError } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { municipalityId: string } }) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const municipalityId = parseId(params.municipalityId);
  if (!municipalityId) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });

  try {
    const accessToken = await regenerateMunicipalityDemoAccessToken(municipalityId, BigInt(session.userId));
    return NextResponse.json({ accessToken });
  } catch (e) {
    if (e instanceof DemoNotFoundError) return NextResponse.json({ error: 'demo_not_found' }, { status: 404 });
    throw e;
  }
}
