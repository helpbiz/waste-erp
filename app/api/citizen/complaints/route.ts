/**
 * POST /api/citizen/complaints — 시민 민원 요청 (S610, 도6)
 * GET  /api/citizen/complaints — 본인 phone 기반 민원 현황 (도7 720)
 *
 * 인증: 전화번호 + 디바이스 ID 기반 (시안). Phase 2: SMS OTP
 * 청구항 4: 처리 대상 폐기물 촬영 이미지 + 긴급 처리 특이사항
 * 청구항 6: 임계 횟수 초과 시 자동 후보 플래그 + CCTV 요청 트리거
 *
 * 미인증 라우트 (citizen은 로그인 안 함) — middleware에서 별도 화이트리스트
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';
import { evaluateCandidateFlag, estimateArrivalEta } from '@/lib/citizen';
import { writeAudit } from '@/lib/audit';
import { makeLookupToken, verifyLookupToken } from '@/lib/ids';

export const runtime = 'nodejs';

const PostBody = z.object({
  citizenPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/, '휴대폰 형식: 010-1234-5678'),
  citizenName: z.string().trim().min(1).max(50).optional(),
  type: z.enum(['PICKUP_MISS', 'ILLEGAL_DUMP', 'ODOR_NOISE', 'OTHER']),
  description: z.string().trim().max(2000).optional(),
  locationLat: z.number().min(-90).max(90),
  locationLng: z.number().min(-180).max(180),
  locationAddress: z.string().trim().max(255).optional(),
  /* 청구항 4 - 긴급 처리 특이사항 */
  urgentTag: z.enum(['LONG_NEGLECTED', 'ROAD_KILL', 'KIDS_DANGER', 'OTHER']).optional(),
  isUrgent: z.boolean().optional(),
  /* 청구항 4 - 처리 대상 폐기물 촬영 이미지 (data URL or storage URL) */
  requestImage: z.string().max(2_000_000).optional(),                                    // 단일 (하위 호환)
  requestImages: z.array(z.string().max(2_000_000)).max(5).optional(),                   // 다중 (최대 5장)
});

function normalizePhone(p: string): string {
  return p.replace(/-/g, '');
}

export async function POST(req: Request) {
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;
  if (!isInsideKorea(b.locationLat, b.locationLng)) {
    return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
  }

  /* P0-residual: PIPA — GPS 좌표는 ~10m 격자 라운딩 후 저장 */
  const lat = roundCoord(b.locationLat) as number;
  const lng = roundCoord(b.locationLng) as number;

  /* 위탁업체 자동 매칭 — 시안: 첫 번째 ACTIVE (실서비스: 좌표 기반 zone 매칭) */
  const contractor = await prisma.contractor.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { id: 'asc' },
  });
  if (!contractor) {
    return NextResponse.json({ error: 'no_active_contractor' }, { status: 503 });
  }

  /* 청구항 6 — 동일 phone 최근 신고 횟수 검사 */
  const phoneNorm = normalizePhone(b.citizenPhone);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.complaint.findMany({
    where: { citizenPhone: phoneNorm, reportedAt: { gte: since } },
    select: { reportedAt: true },
    orderBy: { reportedAt: 'desc' },
  });
  const candidate = evaluateCandidateFlag([{ reportedAt: new Date() }, ...recent]);

  /* 청구항 7 — 도착 예정 시각: 활성 차량 임의 1대 위치 → 민원 좌표 거리 기반 ETA */
  const todayLog = await prisma.vehicleLog.findFirst({
    where: { vehicle: { contractorId: contractor.id }, status: { in: ['SUBMITTED', 'APPROVED'] } },
    orderBy: { id: 'desc' },
    select: { vehicle: { select: { totalMileage: true } } },
  });
  /* 시안: 강남구 중심 좌표 기준 (실서비스: 차량 GPS 실시간) */
  const vehicleLat = 37.4979;
  const vehicleLng = 127.0473;
  void todayLog;
  const eta = estimateArrivalEta(vehicleLat, vehicleLng, lat, lng);

  /* 사진 정규화 — 다중이면 JSON 배열, 단일이면 그대로 */
  let imageBlob: string | null = null;
  if (b.requestImages && b.requestImages.length > 0) {
    imageBlob = b.requestImages.length === 1 ? b.requestImages[0] : JSON.stringify(b.requestImages);
  } else if (b.requestImage) {
    imageBlob = b.requestImage;
  }

  const created = await prisma.complaint.create({
    data: {
      contractorId: contractor.id,
      reportedBy: null,  // 시민
      citizenPhone: phoneNorm,
      citizenName: b.citizenName ?? null,
      complainantPhone: phoneNorm,
      type: b.type,
      description: b.description ?? null,
      locationLat: lat,
      locationLng: lng,
      locationAddress: b.locationAddress ?? null,
      urgentTag: b.urgentTag ?? null,
      isUrgent: b.isUrgent ?? false,
      requestImage: imageBlob,
      arrivalEta: eta,
      flaggedAsCandidate: candidate.flagged,
      flaggedReason: candidate.reason,
      status: 'RECEIVED',
    },
  });

  /* 청구항 6 — 후보 플래그된 경우 audit_log에 CCTV 영상 요청 메시지 기록 */
  if (candidate.flagged) {
    await prisma.complaint.update({
      where: { id: created.id },
      data: { cctvRequestSentAt: new Date() },
    });
    await writeAudit(req, null, {
      action: 'CCTV_VIDEO_REQUEST',
      resourceType: 'complaint',
      resourceId: created.id.toString(),
      contractorId: contractor.id,
      metadata: {
        targetCitizenPhone: phoneNorm.slice(0, 3) + '****' + phoneNorm.slice(-4),
        locationLat: lat,
        locationLng: lng,
        reason: candidate.reason,
      },
    });
  }

  await writeAudit(req, null, {
    action: 'CITIZEN_COMPLAINT_CREATE',
    resourceType: 'complaint',
    resourceId: created.id.toString(),
    contractorId: contractor.id,
    metadata: {
      type: b.type,
      urgentTag: b.urgentTag ?? null,
      isUrgent: b.isUrgent ?? false,
      flagged: candidate.flagged,
    },
  });

  const lookupToken = makeLookupToken(phoneNorm);

  return NextResponse.json({
    ok: true,
    lookupToken,
    complaint: {
      id: created.id.toString(),
      type: created.type,
      status: created.status,
      arrivalEta: created.arrivalEta?.toISOString() ?? null,
      flagged: created.flaggedAsCandidate,
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get('phone');
  const token = url.searchParams.get('token');
  if (!phone) return NextResponse.json({ items: [] });

  /* IDOR 방어 — 오늘 민원 접수 시 발급된 token 검증 */
  if (!token || !verifyLookupToken(normalizePhone(phone), token)) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 403 });
  }

  const phoneNorm = normalizePhone(phone);
  const items = await prisma.complaint.findMany({
    where: { citizenPhone: phoneNorm },
    orderBy: { reportedAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id.toString(),
      type: c.type,
      status: c.status,
      reportedAt: c.reportedAt.toISOString(),
      description: c.description,
      locationAddress: c.locationAddress,
      urgentTag: c.urgentTag,
      isUrgent: c.isUrgent,
      requestImage: c.requestImage,
      completionImage: c.completionImage,
      arrivalEta: c.arrivalEta?.toISOString() ?? null,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      resolveNote: c.resolveNote,
      satisfactionScore: c.satisfactionScore,
      satisfactionAt: c.satisfactionAt?.toISOString() ?? null,
      flaggedAsCandidate: c.flaggedAsCandidate,
    })),
  });
}
