/** GET /api/dealer/demo — 본인(딜러)의 활성 데모 목록(단독 회사 데모 + 지자체 모드 그룹 데모). Design §4.1. */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { listActiveDemos, listActiveMunicipalityDemos } from '@/lib/services/dealer/demo-lifecycle-service';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [items, municipalityItems] = await Promise.all([
    listActiveDemos(BigInt(session.userId)),
    listActiveMunicipalityDemos(BigInt(session.userId)),
  ]);

  return NextResponse.json({
    items: items.map((c) => ({
      contractorId: c.id.toString(),
      companyName: c.companyName,
      expiresAt: c.demoExpiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      accessToken: c.demoAccessToken,
    })),
    municipalityItems: municipalityItems.map((m) => ({
      municipalityId: m.id.toString(),
      municipalityName: m.name,
      companies: m.contractors.map((c) => ({ contractorId: c.id.toString(), companyName: c.companyName })),
      expiresAt: m.demoExpiresAt?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
      accessToken: m.demoAccessToken,
    })),
  });
}
