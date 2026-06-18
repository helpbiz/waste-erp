/**
 * GET /api/admin/suggestions/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * 익명 건의함 목록 Excel 다운로드 (마스킹 포함)
 */
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { buildSmallGroupMasks } from '@/lib/suggestions';
import ExcelJS from 'exceljs';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'MUNI_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN']);

const CAT_LABEL: Record<string, string> = {
  WORK_ENV: '업무환경', EQUIPMENT: '장비/도구', SAFETY: '안전',
  MANAGEMENT: '관리/소통', WELFARE: '복지/처우', OTHER: '기타',
};
const STATUS_LABEL: Record<string, string> = {
  NEW: '신규', REVIEWING: '검토 중', ANSWERED: '답변 완료', ARCHIVED: '보관',
};

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return Response.json({ error: 'unauthenticated' }, { status: 401 });
  if (!ADMIN_ROLES.has(session.role)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  /* scope 결정 */
  let contractorIdFilter: bigint[] | null = null;
  if (session.role === 'CONTRACTOR_ADMIN' || session.role === 'INTERNAL_ADMIN') {
    if (!session.contractorId) return new Response(null, { status: 204 });
    contractorIdFilter = [BigInt(session.contractorId)];
  } else if (session.role === 'MUNI_ADMIN') {
    if (!session.municipalityId) return new Response(null, { status: 204 });
    const cs = await prisma.contractor.findMany({
      where: { municipalityId: BigInt(session.municipalityId), deletedAt: null },
      select: { id: true },
    });
    contractorIdFilter = cs.map((c) => c.id);
    if (contractorIdFilter.length === 0) return new Response(null, { status: 204 });
  }

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from + 'T00:00:00');
  if (to) { const d = new Date(to + 'T23:59:59'); dateFilter.lte = d; }

  const where = {
    ...(contractorIdFilter ? { contractorId: { in: contractorIdFilter } } : {}),
    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
  };

  const rows = await prisma.workerSuggestion.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      department: { select: { name: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { replier: { select: { name: true, role: true } } },
      },
    },
  });

  /* 마스킹 처리 */
  const distinctContractorIds = Array.from(new Set(rows.map((r) => r.contractorId.toString()))).map((s) => BigInt(s));
  const masksByContractor = new Map<string, Awaited<ReturnType<typeof buildSmallGroupMasks>>>();
  await Promise.all(
    distinctContractorIds.map(async (cId) => {
      masksByContractor.set(cId.toString(), await buildSmallGroupMasks(cId));
    }),
  );

  /* Excel 생성 */
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WCI-ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('익명건의함');
  const period = from && to ? `${from} ~ ${to}` : from ? `${from} 이후` : to ? `${to} 이전` : '전체';

  applyStandardHeader(ws, {
    title: '익명 건의함 현황',
    colCount: 9,
    period,
    totalCount: rows.length,
  });

  addHeaderRow(ws, ['No', '접수일', '부서', '직위', '카테고리', '만족도', '건의내용', '처리상태', '답변내용']);

  rows.forEach((r, idx) => {
    const masks = masksByContractor.get(r.contractorId.toString());
    const deptMasked = r.departmentId ? !!masks?.smallDepartmentIds.has(r.departmentId.toString()) : true;
    const posMasked = r.positionCode ? !!masks?.smallPositionCodes.has(r.positionCode) : true;

    const replyText = r.replies.length > 0
      ? r.replies.map((rep) => `[${rep.replier.name}] ${rep.content}`).join('\n')
      : '';

    const row = ws.addRow([
      idx + 1,
      r.createdAt.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }),
      deptMasked ? '(익명)' : (r.department?.name ?? '—'),
      posMasked ? '(익명)' : (r.positionCode ?? '—'),
      CAT_LABEL[r.category] ?? r.category,
      r.satisfactionScore ?? '—',
      r.content ?? '',
      STATUS_LABEL[r.status] ?? r.status,
      replyText,
    ]);
    styleDataRow(row, idx + 1);
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 9 };
      if ([1, 2, 5, 6, 8].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
    });
  });

  ws.columns = [
    { width: 6 }, { width: 13 }, { width: 12 }, { width: 10 }, { width: 12 },
    { width: 8 }, { width: 40 }, { width: 10 }, { width: 30 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  return xlsxResponse(Buffer.from(buffer), makeFilename('익명건의함'));
}
