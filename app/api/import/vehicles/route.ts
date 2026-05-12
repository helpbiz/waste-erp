/**
 * POST /api/import/vehicles
 * 파싱된 행 데이터 + 컬럼 매핑을 받아 차량을 일괄 등록한다.
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { isVehicleLogManager } from '@/lib/vehicle-logs';
import { VEHICLE_TYPE_VALUES, VEHICLE_TYPE_LABEL } from '@/lib/vehicle-types';

const BodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(1000),
  colMap: z.object({
    vehicleNo:       z.string().nullable(),
    vehicleType:     z.string().nullable(),
    vehicleTon:      z.string().nullable().optional(),
    fuelType:        z.string().nullable().optional(),
    yearManufactured: z.string().nullable().optional(),
  }),
  contractorId: z.union([z.string(), z.number()]).optional(),
});

/* 한국어 차종명 → Prisma enum 매핑 */
const KO_VEHICLE_TYPE: Record<string, string> = {
  '압착진개': 'PRESS_REFUSE', '압착': 'PRESS_REFUSE',
  '압축진개': 'COMPACTOR_REFUSE', '압축': 'COMPACTOR_REFUSE',
  '암롤차': 'ARM_ROLL', '암롤': 'ARM_ROLL',
  '덤프트럭': 'DUMP_TRUCK', '덤프': 'DUMP_TRUCK',
  '집게차': 'GRAB_TRUCK', '집게': 'GRAB_TRUCK',
  '카고트럭': 'CARGO_TRUCK', '카고': 'CARGO_TRUCK',
  '진개덤프': 'REFUSE_DUMP',
  '탱크로리': 'TANK_LORRY', '탱크': 'TANK_LORRY',
  '윙바디': 'WING_BODY', '윙': 'WING_BODY',
  '지게차': 'FORKLIFT', '지게': 'FORKLIFT',
  '기타': 'OTHER',
};

function resolveVehicleType(raw: string): string {
  const s = raw.trim();
  if (!s) return 'OTHER';
  if (VEHICLE_TYPE_VALUES.includes(s as never)) return s;
  for (const [label, key] of Object.entries(VEHICLE_TYPE_LABEL)) {
    if (label === s) return key;  // 기존 label 역방향 매핑 (key→label이므로 swap)
  }
  // label → key
  for (const [key, label] of Object.entries(VEHICLE_TYPE_LABEL)) {
    if (label === s) return key;
  }
  const norm = s.replace(/\s+/g, '');
  for (const [ko, en] of Object.entries(KO_VEHICLE_TYPE)) {
    if (norm.includes(ko) || ko.includes(norm)) return en;
  }
  return 'OTHER';
}

function resolveFuelType(raw: string): 'DIESEL' | 'LPG' | 'ELECTRIC' | 'CNG' {
  const s = raw.trim().toUpperCase();
  if (s === 'DIESEL' || s.includes('디젤')) return 'DIESEL';
  if (s === 'LPG' || s.includes('가스') || s.includes('LPG')) return 'LPG';
  if (s === 'ELECTRIC' || s.includes('전기')) return 'ELECTRIC';
  if (s === 'CNG' || s.includes('CNG')) return 'CNG';
  return 'DIESEL';
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isVehicleLogManager(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { rows, colMap, contractorId: rawCid } = parsed.data;

  let contractorId: bigint;
  if (session.role === 'SUPER_ADMIN') {
    if (!rawCid) return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
    contractorId = BigInt(rawCid);
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  type RowResult = {
    rowNo: number; status: 'OK' | 'SKIP' | 'ERROR';
    message: string; vehicleNo?: string; vehicleType?: string;
  };
  const results: RowResult[] = [];
  let okCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;

    const vehicleNo = (colMap.vehicleNo ? row[colMap.vehicleNo] ?? '' : '').trim();
    if (!vehicleNo) {
      results.push({ rowNo, status: 'SKIP', message: '차량번호 없음 — 건너뜀' });
      continue;
    }

    const vehicleTypeRaw = colMap.vehicleType ? row[colMap.vehicleType] ?? '' : '';
    const vehicleType = resolveVehicleType(vehicleTypeRaw);

    const vehicleTon = colMap.vehicleTon
      ? (row[colMap.vehicleTon] ?? '').trim() || null
      : null;

    const fuelRaw = colMap.fuelType ? row[colMap.fuelType ?? ''] ?? '' : '';
    const fuelType = fuelRaw ? resolveFuelType(fuelRaw) : 'DIESEL';

    const yearRaw = colMap.yearManufactured ? row[colMap.yearManufactured ?? ''] ?? '' : '';
    const yearParsed = yearRaw ? parseInt(yearRaw.replace(/[^0-9]/g, '')) : NaN;
    const yearManufactured = !isNaN(yearParsed) && yearParsed >= 1990 && yearParsed <= 2099
      ? yearParsed : null;

    try {
      const existing = await prisma.vehicle.findUnique({
        where: { contractorId_vehicleNo: { contractorId, vehicleNo } },
      });
      if (existing) {
        results.push({ rowNo, status: 'SKIP', message: `차량번호 중복 (기존 ID=${existing.id})`, vehicleNo });
        continue;
      }

      const created = await prisma.vehicle.create({
        data: {
          contractor: { connect: { id: contractorId } },
          vehicleNo,
          vehicleType: vehicleType as never,
          vehicleTon,
          fuelType,
          yearManufactured,
          status: 'ACTIVE',
        },
      });
      okCount++;
      results.push({ rowNo, status: 'OK', message: `등록 완료 (ID=${created.id})`, vehicleNo, vehicleType });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 80) : 'DB 오류';
      results.push({ rowNo, status: 'ERROR', message: msg, vehicleNo });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'VEHICLE_BULK_IMPORT',
      resourceType: 'vehicle',
      resourceId: contractorId.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { total: rows.length, ok: okCount } as object,
    },
  });

  return NextResponse.json({ ok: true, total: rows.length, okCount, results });
}
