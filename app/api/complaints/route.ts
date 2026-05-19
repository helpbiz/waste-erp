import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isInsideKorea } from '@/lib/gps';
import { roundCoord } from '@/lib/geo';
import { complaintWhere, isOverdue, isComplaintManager } from '@/lib/complaints';
import { writeAudit } from '@/lib/audit';
import { autoAssignComplaint } from '@/lib/complaint-assign';
import { hasFeature } from '@/lib/features';

export const runtime = 'nodejs';

/* 사진은 클라이언트에서 1024px·1MB 이하로 리사이즈된 data URL */
const DATA_URL_MAX = 2_000_000; // 2MB / 사진 (안전 마진)
const PHOTOS_MAX = 5;

const PostBody = z.object({
  type: z.enum(['PICKUP_MISS', 'ILLEGAL_DUMP', 'ODOR_NOISE', 'BULKY_WASTE', 'OTHER']),
  description: z.string().trim().max(2000).optional(),
  complainantPhone: z.string().trim().max(20).optional().or(z.literal('')),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  locationAddress: z.string().trim().max(255).optional(),
  zoneId: z.union([z.string(), z.number()]).optional(),
  contractorId: z.union([z.string(), z.number()]).optional(), // SUPER만 사용
  assigneeId: z.union([z.string(), z.number()]).optional(),   // 근로자 선택 배정 (선택)
  /* 청구항 4 — 처리 대상 폐기물 촬영 이미지 */
  requestImage: z.string().max(DATA_URL_MAX).optional(),                       // 단일 (하위 호환)
  requestImages: z.array(z.string().max(DATA_URL_MAX)).max(PHOTOS_MAX).optional(), // 다중 (신규)
});

/**
 * POST /api/complaints — 민원 등록
 * Plan §3-1 권한 매트릭스: 모든 Role 입력 가능
 *  - WORKER/INTERNAL/CONTRACTOR_ADMIN: 본인 contractorId 자동 사용
 *  - MUNI_ADMIN: 본인 지자체 산하 contractorId 명시 필요 (또는 무지정 → 적절한 위탁업체에 자동 배정)
 *  - SUPER_ADMIN: 명시적 contractorId 필수
 */
export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const b = parsed.data;

  if (b.locationLat !== undefined && b.locationLng !== undefined) {
    if (!isInsideKorea(b.locationLat, b.locationLng)) {
      return NextResponse.json({ error: 'gps_out_of_range' }, { status: 422 });
    }
  }

  // contractorId 결정
  let contractorId: bigint | null = null;
  if (session.role === 'SUPER_ADMIN' || session.role === 'MUNI_ADMIN') {
    if (!b.contractorId) {
      return NextResponse.json(
        { error: 'contractor_id_required', message: '관리자가 입력 시 위탁업체 ID 필수' },
        { status: 400 }
      );
    }
    contractorId = BigInt(b.contractorId);

    // MUNI_ADMIN은 본인 지자체 소속만 허용
    if (session.role === 'MUNI_ADMIN') {
      const c = await prisma.contractor.findUnique({ where: { id: contractorId } });
      if (!c || c.municipalityId.toString() !== session.municipalityId) {
        return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
      }
    }
  } else {
    if (!session.contractorId) {
      return NextResponse.json({ error: 'no_contractor_assigned' }, { status: 400 });
    }
    contractorId = BigInt(session.contractorId);
  }

  /* 사진 정규화 — 다중이면 JSON 배열로, 단일이면 그대로 저장 */
  let imageBlob: string | null = null;
  if (b.requestImages && b.requestImages.length > 0) {
    imageBlob = b.requestImages.length === 1
      ? b.requestImages[0]
      : JSON.stringify(b.requestImages);
  } else if (b.requestImage) {
    imageBlob = b.requestImage;
  }

  const created = await prisma.complaint.create({
    data: {
      contractorId,
      reportedBy: BigInt(session.userId),
      type: b.type,
      description: b.description ?? null,
      complainantPhone: b.complainantPhone || null,
      locationLat: roundCoord(b.locationLat),
      locationLng: roundCoord(b.locationLng),
      locationAddress: b.locationAddress ?? null,
      zoneId: b.zoneId !== undefined ? BigInt(b.zoneId) : null,
      requestImage: imageBlob,
      reportedAt: new Date(),
      status: 'RECEIVED',
    },
  });

  await writeAudit(req, session, {
    action: 'COMPLAINT_CREATE',
    resourceType: 'complaint',
    resourceId: created.id.toString(),
    contractorId,
    metadata: {
      type: b.type,
      lat: roundCoord(b.locationLat),
      lng: roundCoord(b.locationLng),
      photoCount: b.requestImages?.length ?? (b.requestImage ? 1 : 0),
    },
  });

  /* 선택 배정 — 근로자가 직접 지정한 경우 자동배정 건너뜀 */
  let manualAssigned = false;
  if (b.assigneeId) {
    try {
      const aid = BigInt(b.assigneeId);
      const assignee = await prisma.user.findUnique({ where: { id: aid } });
      if (assignee && assignee.role === 'WORKER' && assignee.contractorId === contractorId) {
        await prisma.complaint.update({
          where: { id: created.id },
          data: { assignedTo: aid, status: 'ASSIGNED' },
        });
        manualAssigned = true;
      }
    } catch { /* 잘못된 assigneeId는 무시하고 자동배정으로 폴백 */ }
  }

  /* 자동 배정 — 회사별 기능 권한 ON 일 때만 실행 (best-effort) */
  let assignment: Awaited<ReturnType<typeof autoAssignComplaint>> | null = null;
  if (!manualAssigned) try {
    const autoAssignOn = await hasFeature(contractorId, 'complaintAutoAssign');
    if (autoAssignOn) {
      const aiNearbyOn = await hasFeature(contractorId, 'aiNearbyDispatch');
      assignment = await autoAssignComplaint({
        complaintId: created.id,
        contractorId,
        locationLat: b.locationLat ?? null,
        locationLng: b.locationLng ?? null,
        locationAddress: b.locationAddress ?? null,
        zoneId: b.zoneId !== undefined ? BigInt(b.zoneId) : null,
        broadcastNearby: aiNearbyOn,
      });
    }
  } catch (e) {
    console.error('[autoAssignComplaint] failed:', e);
  }

  return NextResponse.json({
    ok: true,
    complaint: {
      id: created.id.toString(),
      type: created.type,
      status: assignment?.primary ? 'ASSIGNED' : created.status,
      reportedAt: created.reportedAt.toISOString(),
    },
    assignment,
  });
}

/**
 * GET /api/complaints — 민원 조회 (가시범위 자동 적용)
 * Query: ?status=&limit=&offset=&overdue=true
 */
export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const workerIsManager = !isComplaintManager(session.role) && session.role === 'WORKER'
    ? ((await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isComplaintManager: true } }))?.isComplaintManager ?? false)
    : false;

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 20)));
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));

  const where = complaintWhere(session, workerIsManager);
  if (statusParam) {
    const valid = ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];
    if (valid.includes(statusParam)) (where as Record<string, unknown>).status = statusParam;
  }

  const [items, total] = await Promise.all([
    prisma.complaint.findMany({
      where,
      orderBy: [{ reportedAt: 'desc' }],
      take: limit,
      skip: offset,
      include: {
        reporter: { select: { id: true, name: true, role: true } },
        assignee: { select: { id: true, name: true } },
        zone: { select: { zoneName: true } },
      },
    }),
    prisma.complaint.count({ where }),
  ]);

  return NextResponse.json({
    role: session.role,
    total,
    items: items.map((c) => ({
      id: c.id.toString(),
      type: c.type,
      status: c.status,
      description: c.description,
      reportedAt: c.reportedAt.toISOString(),
      locationAddress: c.locationAddress,
      reporter: c.reporter
        ? { id: c.reporter.id.toString(), name: c.reporter.name, role: c.reporter.role }
        : { id: '0', name: c.citizenName ?? '시민', role: null },
      assignee: c.assignee ? { id: c.assignee.id.toString(), name: c.assignee.name } : null,
      zoneName: c.zone?.zoneName ?? null,
      dueDate: c.dueDate?.toISOString() ?? null,
      isOverdue: isOverdue({ dueDate: c.dueDate, status: c.status }),
      complainantPhone: c.complainantPhone,
      requestImage: c.requestImage,
      resolveNote: c.resolveNote,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    })),
  });
}
