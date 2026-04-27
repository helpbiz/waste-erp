/**
 * GET /api/reports/daily-treatment/pdf?date=YYYY-MM-DD&contractorId=...
 *
 * Design Ref: §4.1, §4.2 — F-02 PDF 스트림
 * Plan SC: 5초 내 PDF + AuditLog INSERT (report_download)
 */
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { loadReportTemplate } from '@/lib/report/template-loader';
import { resolveReportData } from '@/lib/report/data-resolver';
import { renderReportHtml } from '@/lib/report/html-renderer';
import { renderPdf } from '@/lib/report/pdf-renderer';

export const runtime = 'nodejs';
export const maxDuration = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: { 'content-type': 'application/json' } });

  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  const contractorIdQ = url.searchParams.get('contractorId');

  if (!date || !DATE_RE.test(date)) {
    return new Response(JSON.stringify({ error: 'invalid_date' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  let contractorId: string | null = null;
  if (session.role === 'SUPER_ADMIN') {
    contractorId = contractorIdQ || session.contractorId;
  } else if (session.role === 'MUNI_ADMIN') {
    if (!contractorIdQ) {
      return new Response(JSON.stringify({ error: 'contractor_required' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }
    contractorId = contractorIdQ;
  } else if (session.contractorId) {
    contractorId = session.contractorId;
  }

  if (!contractorId) {
    return new Response(JSON.stringify({ error: 'no_contractor_scope' }), { status: 403, headers: { 'content-type': 'application/json' } });
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
      user: { id: session.userId, name: session.name },
    });

    const html = await renderReportHtml(tpl.spec, data);
    const pdf = await renderPdf(html);

    /* AuditLog — report_download */
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    await prisma.auditLog.create({
      data: {
        actorId: BigInt(session.userId),
        actorRole: session.role,
        action: 'REPORT_DOWNLOAD',
        resourceType: 'report',
        resourceId: `f02:${date}`,
        ipAddress: ip,
        metadata: { code: 'F-02', date, contractorId } as object,
      },
    }).catch(() => undefined);

    const filename = `F-02_${data.header.contractor.companyName}_${date}.pdf`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'cache-control': 'private, no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error';
    const status = msg.startsWith('report_template_not_found') ? 404 : 500;
    return new Response(JSON.stringify({ error: msg }), { status, headers: { 'content-type': 'application/json' } });
  }
}
