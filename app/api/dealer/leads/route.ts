/**
 * GET  /api/dealer/leads — 본인(딜러) 리드 목록
 * POST /api/dealer/leads — 리드 등록
 *
 * 권한: DEALER 전용. Design §4.1/§4.2.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSession } from '@/lib/auth';
import { createLead, listOwnLeads } from '@/lib/services/dealer/lead-service';
import { toLeadDTO } from '@/lib/types/dealer';

export const runtime = 'nodejs';

const CreateBody = z.object({
  prospectName: z.string().trim().min(1).max(100),
  prospectContact: z.string().trim().max(50).optional().nullable(),
  memo: z.string().max(2000).optional().nullable(),
  /* 2026-07-06 승인플로우 간소화 — 상담 시점에 알면 바로 입력, 모르면 비워두고 나중에 PATCH로 보강 */
  municipalityName: z.string().trim().max(100).optional().nullable(),
  municipalityCode: z.string().trim().max(20).optional().nullable(),
  municipalityRegion: z.string().trim().max(50).optional().nullable(),
  contractorName: z.string().trim().max(100).optional().nullable(),
  contractorBusinessNo: z.string().trim().max(20).optional().nullable(),
  adminUsername: z.string().trim().max(50).optional().nullable(),
  adminName: z.string().trim().max(50).optional().nullable(),
});

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const leads = await listOwnLeads(BigInt(session.userId));
  return NextResponse.json({ items: leads.map(toLeadDTO) });
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (session.role !== 'DEALER') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const lead = await createLead({
    dealerId: BigInt(session.userId),
    ...parsed.data,
  });

  return NextResponse.json(toLeadDTO(lead), { status: 201 });
}
