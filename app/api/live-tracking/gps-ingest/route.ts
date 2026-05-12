/**
 * POST /api/live-tracking/gps-ingest?contractorId=<id>
 *
 * GPS 단말 → 서버 Push 엔드포인트 (gisProvider='local' 전용)
 * 인증: Authorization: Bearer <apiKey>  (LiveTrackingConfig.apiKeyEnc 복호화 비교)
 *
 * body: { vehicleId?, vehicleNo?, lat, lng, speed?, heading? }
 *  - vehicleId 또는 vehicleNo 중 하나 필수
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { decryptField } from '@/lib/crypto';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';

export const runtime = 'nodejs';

const Body = z.object({
  vehicleId: z.union([z.string(), z.number()]).optional(),
  vehicleNo: z.string().max(20).optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().int().min(0).max(300).optional(),
  heading: z.number().int().min(0).max(360).optional(),
  source: z.string().max(50).optional(),
});

export async function POST(req: Request) {
  const url = new URL(req.url);
  const contractorIdParam = url.searchParams.get('contractorId');
  if (!contractorIdParam) {
    return NextResponse.json({ error: 'contractorId query required' }, { status: 400 });
  }

  /* Bearer token 인증 */
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let contractorId: bigint;
  try { contractorId = BigInt(contractorIdParam); } catch {
    return NextResponse.json({ error: 'invalid contractorId' }, { status: 400 });
  }

  const config = await prisma.liveTrackingConfig.findUnique({ where: { contractorId } });
  if (!config || config.gisProvider !== 'local') {
    return NextResponse.json({ error: 'gps_ingest_not_enabled' }, { status: 403 });
  }
  if (!config.apiKeyEnc) {
    return NextResponse.json({ error: 'ingest_token_not_configured' }, { status: 403 });
  }

  let expectedToken: string | null;
  try { expectedToken = await decryptField(config.apiKeyEnc); } catch {
    return NextResponse.json({ error: 'token_decrypt_failed' }, { status: 500 });
  }
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { vehicleId, vehicleNo, lat: rawLat, lng: rawLng, speed, heading, source } = parsed.data;
  if (!vehicleId && !vehicleNo) {
    return NextResponse.json({ error: 'vehicleId or vehicleNo required' }, { status: 400 });
  }

  const lat = roundCoord(rawLat) as number;
  const lng = roundCoord(rawLng) as number;
  if (!isInsideKorea(lat, lng)) {
    return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
  }

  /* 차량 조회 */
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      contractorId,
      ...(vehicleId ? { id: BigInt(vehicleId) } : { vehicleNo: vehicleNo! }),
    },
    select: { id: true },
  });
  if (!vehicle) {
    return NextResponse.json({ error: 'vehicle_not_found' }, { status: 404 });
  }

  await prisma.vehicleGpsPosition.upsert({
    where: { vehicleId: vehicle.id },
    create: { vehicleId: vehicle.id, contractorId, lat, lng, speed: speed ?? null, heading: heading ?? null, source: source ?? null },
    update: { lat, lng, speed: speed ?? null, heading: heading ?? null, source: source ?? null },
  });

  return NextResponse.json({ ok: true });
}
