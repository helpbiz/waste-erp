/**
 * POST /api/citizen/complaints/[id]/satisfaction — 만족도 평가 (S660·S670, 도7 740)
 *  - 청구항 5: 처리 만족도 → 주민 만족도 평가 정보의 종합 만족도 평가 정보로 통합
 *  - 본인이 신고한 민원만 평가 가능 (citizenPhone 일치)
 */
import { NextResponse } from 'next/server';
import { parseId } from '@/lib/ids';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const Body = z.object({
  citizenPhone: z.string().regex(/^01[0-9]-?\d{3,4}-?\d{4}$/),
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

function normalizePhone(p: string): string { return p.replace(/-/g, ''); }

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request', issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const id = parseId(params.id);
  if (id == null) return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  const phoneNorm = normalizePhone(parsed.data.citizenPhone);

  const target = await prisma.complaint.findFirst({
    where: { id, citizenPhone: phoneNorm },
  });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (target.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'not_completed', message: '처리 완료된 민원에 한해 평가 가능' }, { status: 409 });
  }
  if (target.satisfactionScore != null) {
    return NextResponse.json({ error: 'already_rated' }, { status: 409 });
  }

  const updated = await prisma.complaint.update({
    where: { id },
    data: {
      satisfactionScore: parsed.data.score,
      satisfactionComment: parsed.data.comment ?? null,
      satisfactionAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'CITIZEN_SATISFACTION',
      resourceType: 'complaint',
      resourceId: id.toString(),
      metadata: { score: parsed.data.score, hasComment: !!parsed.data.comment } as object,
    },
  });

  return NextResponse.json({
    ok: true,
    score: updated.satisfactionScore,
    satisfactionAt: updated.satisfactionAt?.toISOString() ?? null,
  });
}
