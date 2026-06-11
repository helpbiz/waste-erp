/**
 * POST /api/import/workers
 * 파싱된 행 데이터 + 컬럼 매핑을 받아 WORKER 계정을 일괄 생성한다.
 * - username: employeeNo 우선, 없으면 자동 생성
 * - password: 계정마다 crypto.randomBytes(9) 개별 생성 (P0-6: 하드코딩 제거)
 * - role: WORKER, status: ACTIVE
 * ⚠ 기존 사용자 계정은 절대 변경하지 않음 — 신규 생성 계정에만 적용
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { readSession, hashPassword } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';

const BodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(1000),
  colMap: z.object({
    name:       z.string().nullable(),
    phone:      z.string().nullable().optional(),
    employeeNo: z.string().nullable().optional(),
    hireDate:   z.string().nullable().optional(),
    rank:       z.string().nullable().optional(),
  }),
  contractorId: z.union([z.string(), z.number()]).optional(),
});

/** P0-6: 계정마다 개별 초기 비밀번호 생성 (9 random bytes → 12자 base64url) */
function generateInitialPassword(): string {
  return randomBytes(9).toString('base64url');
}

async function makeUniqueUsername(base: string): Promise<string> {
  const clean = base.replace(/[^a-zA-Z0-9_\-가-힣]/g, '').slice(0, 40) || 'worker';
  let candidate = clean;
  for (let suffix = 0; suffix <= 999; suffix++) {
    candidate = suffix === 0 ? clean : `${clean}${suffix}`;
    const exists = await prisma.user.findUnique({ where: { username: candidate } });
    if (!exists) return candidate;
  }
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!canManageUsers(session.role)) {
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
    message: string; name?: string; username?: string; initialPassword?: string;
  };
  const results: RowResult[] = [];
  let okCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 2;

    const name = (colMap.name ? row[colMap.name] ?? '' : '').trim();
    if (!name || name.toLowerCase() === 'nan') {
      results.push({ rowNo, status: 'SKIP', message: '이름 없음 — 건너뜀' });
      continue;
    }

    const phone = colMap.phone ? (row[colMap.phone] ?? '').trim() || null : null;
    const employeeNo = colMap.employeeNo ? (row[colMap.employeeNo] ?? '').trim() || null : null;

    let hireDate: Date | null = null;
    if (colMap.hireDate) {
      const raw = (row[colMap.hireDate] ?? '').trim();
      if (raw) {
        try {
          const d = new Date(raw);
          if (!isNaN(d.getTime())) hireDate = d;
        } catch { /* ignore */ }
      }
    }

    const rank = colMap.rank ? (row[colMap.rank] ?? '').trim() || null : null;

    try {
      const usernameBase = employeeNo ?? `w_${name.replace(/\s+/g, '')}`;
      const username = await makeUniqueUsername(usernameBase);
      /* P0-6: 계정마다 개별 랜덤 초기 비밀번호 — 기존 계정과 무관 */
      const initialPassword = generateInitialPassword();
      const passwordHash = await hashPassword(initialPassword);

      const created = await prisma.user.create({
        data: {
          contractorId,
          username,
          passwordHash,
          name,
          phone,
          employeeNo,
          hireDate,
          rank,
          role: 'WORKER',
          status: 'ACTIVE',
        },
      });
      okCount++;
      results.push({ rowNo, status: 'OK', message: `등록 완료 (ID=${created.id})`, name, username, initialPassword });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 80) : 'DB 오류';
      results.push({ rowNo, status: 'ERROR', message: msg, name });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId),
      actorRole: session.role,
      action: 'WORKER_BULK_IMPORT',
      resourceType: 'user',
      resourceId: contractorId.toString(),
      ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      metadata: { total: rows.length, ok: okCount } as object,
    },
  });

  return NextResponse.json({ ok: true, total: rows.length, okCount, results });
}
