/**
 * 민원 자동 배정 — 신규 민원 접수 시 호출.
 *
 * Strategy
 *  1) 같은 contractor 의 기동반(position.code='RAPID') WORKER 후보 수집 (status APPROVED).
 *  2) AI 후보 정렬 — 다음 기준을 가중 합산해 best 1 명을 primary 배정:
 *      a. 최근 30일 출퇴근 lat/lng → 민원 위치까지 Haversine 거리 (가까울수록 ↑)
 *      b. 현재 진행중 민원 부하 (적을수록 ↑)
 *      c. 행정동(zoneId) 일치 보너스
 *  3) primary 1 명 → assignedTo + status='ASSIGNED'.
 *  4) 나머지 RAPID 후보 + 인근 일반 워커(같은 zone 또는 2km 이내)에 broadcast 알림 생성.
 *     audience='WORKER' 의 회사 한정 Announcement 1건 — body 에 인근 워커 명단·거리 명시.
 *
 * 실패 / 후보 0 → assigned 안 하고 RECEIVED 유지(관리자 수동 배정).
 *
 * 호출자: app/api/complaints POST 핸들러 (create 직후, 트랜잭션 외부에서 best-effort).
 */
import { prisma } from '@/lib/db';
import { haversine } from '@/lib/geo';

type AssignInput = {
  complaintId: bigint;
  contractorId: bigint;
  locationLat: number | null;
  locationLng: number | null;
  locationAddress: string | null;
  zoneId: bigint | null;
  /* AI 인근 워커 broadcast 활성 여부 — 회사별 기능 권한에서 주입 */
  broadcastNearby?: boolean;
};

type WorkerLoc = {
  id: bigint;
  name: string;
  positionCode: string | null; /* 'RAPID' | 그 외 */
  lat: number | null;
  lng: number | null;
  recentZoneId: bigint | null;
  activeLoad: number;
  distanceKm: number | null;
};

type AssignResult = {
  primary: { id: string; name: string } | null;
  nearby: { id: string; name: string; distanceKm: number | null }[];
  reason: string;
};

const NEARBY_RADIUS_KM = 2.0;

/* 동(洞) 추출 — 한국 주소 패턴 */
function extractDong(addr: string): string | null {
  const m = addr.match(/([가-힣A-Za-z0-9]+동)\b/);
  return m ? m[1] : null;
}

export async function autoAssignComplaint(input: AssignInput): Promise<AssignResult> {
  const { complaintId, contractorId, locationLat, locationLng, locationAddress } = input;

  /* 1) 후보 수집 — 같은 contractor 의 active WORKER (RAPID 포함) */
  const workers = await prisma.user.findMany({
    where: {
      contractorId,
      role: 'WORKER',
      status: 'ACTIVE',
    },
    include: {
      position: { select: { code: true } },
    },
  });

  if (workers.length === 0) {
    return { primary: null, nearby: [], reason: 'no_workers' };
  }

  const workerIds = workers.map((w) => w.id);

  /* 최근 30일 attendance 위치 — 워커별 latest checkInLat/Lng + zoneId */
  const since = new Date(Date.now() - 30 * 86400_000);
  const recentAttend = await prisma.attendanceRecord.findMany({
    where: {
      workerId: { in: workerIds },
      workDate: { gte: since },
      checkInLat: { not: null },
      checkInLng: { not: null },
    },
    orderBy: { workDate: 'desc' },
    select: { workerId: true, checkInLat: true, checkInLng: true, zoneId: true },
  });
  const latestByWorker = new Map<string, { lat: number; lng: number; zoneId: bigint | null }>();
  for (const r of recentAttend) {
    const k = r.workerId.toString();
    if (latestByWorker.has(k)) continue;
    latestByWorker.set(k, {
      lat: Number(r.checkInLat),
      lng: Number(r.checkInLng),
      zoneId: r.zoneId,
    });
  }

  /* 활성 부하 */
  const loads = await prisma.complaint.groupBy({
    by: ['assignedTo'],
    where: {
      assignedTo: { in: workerIds },
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    _count: { _all: true },
  });
  const loadMap = new Map(loads.map((l) => [l.assignedTo!.toString(), l._count._all]));

  /* zoneId 추정 — 직접 부여된 값 우선, 없으면 주소에서 동명 → AdminDong 매칭 */
  let resolvedZoneId: bigint | null = input.zoneId;
  if (!resolvedZoneId && locationAddress) {
    const dong = extractDong(locationAddress);
    if (dong) {
      const ad = await prisma.adminDong.findFirst({
        where: { contractorId, dongName: dong },
        select: { zoneId: true },
      });
      if (ad) resolvedZoneId = ad.zoneId;
    }
  }

  /* 워커별 distance/zone 매트릭스 */
  const enriched: WorkerLoc[] = workers.map((w) => {
    const loc = latestByWorker.get(w.id.toString()) ?? null;
    let dist: number | null = null;
    if (loc && locationLat != null && locationLng != null) {
      dist = haversine(
        { lat: locationLat, lng: locationLng },
        { lat: loc.lat, lng: loc.lng },
      );
    }
    return {
      id: w.id,
      name: w.name,
      positionCode: w.position?.code ?? null,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      recentZoneId: loc?.zoneId ?? null,
      activeLoad: loadMap.get(w.id.toString()) ?? 0,
      distanceKm: dist,
    };
  });

  /* 2) primary 선정 — RAPID 우선 */
  const rapidPool = enriched.filter((w) => w.positionCode === 'RAPID');
  const primaryPool = rapidPool.length > 0 ? rapidPool : enriched;

  /* score (낮을수록 좋음) */
  const scored = primaryPool.map((w) => {
    let score = 0;
    score += w.activeLoad * 10;                                          /* 부하 페널티 */
    if (w.distanceKm != null) score += w.distanceKm * 5;                 /* 거리 페널티 */
    else score += 10;                                                    /* 위치 미상 약간 페널티 */
    if (resolvedZoneId && w.recentZoneId === resolvedZoneId) score -= 8; /* zone 일치 보너스 */
    return { w, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const primary = scored[0]?.w ?? null;

  /* 3) 배정 update */
  if (primary) {
    await prisma.complaint.update({
      where: { id: complaintId },
      data: { assignedTo: primary.id, status: 'ASSIGNED' },
    }).catch(() => null);
  }

  /* 4) 인근 후보 (primary 제외) — 거리 ≤ 2km 또는 zone 일치 */
  const nearby = enriched
    .filter((w) => primary && w.id !== primary.id)
    .filter((w) => {
      if (resolvedZoneId && w.recentZoneId === resolvedZoneId) return true;
      if (w.distanceKm != null && w.distanceKm <= NEARBY_RADIUS_KM) return true;
      return false;
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, 5);

  /* 5) 인근 워커 broadcast — Announcement 1건 (audience=WORKER, contractor 한정)
        broadcastNearby=false 면 skip (회사별 기능 OFF) */
  if (primary && nearby.length > 0 && input.broadcastNearby !== false) {
    const lines = nearby.map((w) => {
      const dTxt = w.distanceKm != null ? ` (${w.distanceKm.toFixed(1)}km)` : '';
      return `· ${w.name}${dTxt}`;
    });
    const body = [
      `📍 ${locationAddress ?? '위치 정보 없음'}`,
      `▶ 주 배정: ${primary.name}`,
      '',
      'AI 인근 작업자 추천:',
      ...lines,
      '',
      '※ 추가 인력이 필요하면 [민원] 메뉴에서 본인을 추가 배정할 수 있습니다.',
    ].join('\n');

    await prisma.announcement.create({
      data: {
        title: '🚨 인근 민원 접수 — 지원 가능자 확인',
        body,
        severity: 'WARNING',
        audience: 'WORKER',
        contractorId,
        pinned: false,
        expiresAt: new Date(Date.now() + 6 * 3600_000), /* 6시간 유효 */
        createdBy: primary.id, /* 시스템 발신 — primary 워커 명의로 (실제 createdBy 는 표시용) */
      },
    }).catch(() => null);
  }

  return {
    primary: primary ? { id: primary.id.toString(), name: primary.name } : null,
    nearby: nearby.map((w) => ({
      id: w.id.toString(),
      name: w.name,
      distanceKm: w.distanceKm,
    })),
    reason: primary ? (rapidPool.length > 0 ? 'rapid_primary' : 'fallback_worker') : 'no_candidate',
  };
}
