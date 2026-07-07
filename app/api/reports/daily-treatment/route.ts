/**
 * GET /api/reports/daily-treatment?date=YYYY-MM-DD&contractorId=...
 *
 * Design Ref: §4.1, §4.2 — F-02 일일 처리실적 일보 (JSON, 미리보기용)
 * Plan SC: 자사 + 권한 있는 지자체 조회 가능
 */
import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { loadReportTemplate } from '@/lib/report/template-loader';
import { resolveReportData } from '@/lib/report/data-resolver';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const contractorIdQ = url.searchParams.get('contractorId');

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
  }

  /* 권한별 contractorId 결정 */
  let contractorId: string | null = null;
  if (session.role === 'SUPER_ADMIN') {
    contractorId = contractorIdQ || session.contractorId;
  } else if (session.role === 'MUNI_ADMIN') {
    /* MUNI_ADMIN은 자기 관할 contractor 중 1곳 contractorId 필수 — 관할 소속 검증(org-chart와 동일 패턴) */
    if (!contractorIdQ) return NextResponse.json({ error: 'contractor_required' }, { status: 400 });
    const cid = (() => { try { return BigInt(contractorIdQ); } catch { return null; } })();
    if (!cid) return NextResponse.json({ error: 'invalid_contractor_id' }, { status: 400 });
    const c = await prisma.contractor.findUnique({ where: { id: cid }, select: { municipalityId: true } });
    if (!c || c.municipalityId.toString() !== session.municipalityId) {
      return NextResponse.json({ error: 'forbidden_contractor' }, { status: 403 });
    }
    contractorId = contractorIdQ;
  } else if (session.contractorId) {
    contractorId = session.contractorId;
  }

  if (!contractorId) {
    return NextResponse.json({ error: 'no_contractor_scope' }, { status: 403 });
  }

  try {
    const tpl = await loadReportTemplate({
      contractorId: BigInt(contractorId),
      municipalityId: session.municipalityId ? BigInt(session.municipalityId) : null,
      code: 'F-02',
    });

    const data = await resolveReportData(tpl.spec, {
      date,
      contractorId,
      user: { id: session.userId, name: session.name ?? '' },
    });

    return NextResponse.json({ data, template: { id: tpl.id.toString(), name: tpl.name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    if (msg.startsWith('report_template_not_found')) {
      return NextResponse.json({ error: 'template_not_found', detail: msg }, { status: 404 });
    }
    return NextResponse.json({ error: 'internal_error', detail: msg }, { status: 500 });
  }
}
