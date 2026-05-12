/**
 * GET /api/complaints/export?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&format=xlsx|csv
 *  민원 대장 Excel/CSV 다운로드
 */
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { complaintWhere } from '@/lib/complaints';
import { ComplaintStatus } from '@prisma/client';

export const runtime = 'nodejs';

const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거 미비', ILLEGAL_DUMP: '불법투기', ODOR_NOISE: '악취/소음',
  BULKY_WASTE: '대형폐기물', OTHER: '기타',
};
const STATUS_LABEL: Record<string, string> = {
  RECEIVED: '접수', ASSIGNED: '배정', IN_PROGRESS: '처리중',
  COMPLETED: '완료', REJECTED: '반려',
};

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const statusFilter = url.searchParams.get('status') ?? '';
  const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase();

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }
  const from = new Date(fromStr + 'T00:00:00');
  const to = new Date(toStr + 'T23:59:59');

  const rows = await prisma.complaint.findMany({
    where: {
      ...complaintWhere(session),
      reportedAt: { gte: from, lte: to },
      ...(statusFilter ? { status: statusFilter as ComplaintStatus } : {}),
    },
    include: {
      reporter: { select: { name: true } },
      assignee: { select: { name: true } },
      zone: { select: { zoneName: true } },
    },
    orderBy: { reportedAt: 'asc' },
  });

  const items = rows.map((c, idx) => ({
    no: idx + 1,
    id: c.id.toString(),
    type: TYPE_LABEL[c.type] ?? c.type,
    status: STATUS_LABEL[c.status] ?? c.status,
    locationAddress: c.locationAddress ?? '',
    description: c.description ?? '',
    reporter: c.reporter?.name ?? c.citizenName ?? '시민',
    complainantPhone: c.complainantPhone ?? '',
    assignee: c.assignee?.name ?? '',
    zoneName: c.zone?.zoneName ?? '',
    reportedAt: c.reportedAt.toLocaleString('ko-KR'),
    resolveNote: c.resolveNote ?? '',
    resolvedAt: c.resolvedAt?.toLocaleString('ko-KR') ?? '',
  }));

  const filename = `민원대장_${fromStr}_${toStr}`;

  if (format === 'csv') {
    const headers = ['No', 'ID', '유형', '상태', '주소', '민원내용', '접수자', '연락처', '담당자', '구역', '접수일시', '처리내용', '완료일시'];
    const lines = ['﻿' + headers.join(',')];
    for (const r of items) {
      lines.push([
        r.no, r.id, r.type, r.status, r.locationAddress, r.description,
        r.reporter, r.complainantPhone, r.assignee, r.zoneName,
        r.reportedAt, r.resolveNote, r.resolvedAt,
      ].map(csvEscape).join(','));
    }
    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  /* xlsx */
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('민원대장');
  ws.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'ID', key: 'id', width: 12 },
    { header: '유형', key: 'type', width: 14 },
    { header: '상태', key: 'status', width: 10 },
    { header: '주소', key: 'locationAddress', width: 30 },
    { header: '민원내용', key: 'description', width: 40 },
    { header: '접수자', key: 'reporter', width: 12 },
    { header: '연락처', key: 'complainantPhone', width: 14 },
    { header: '담당자', key: 'assignee', width: 12 },
    { header: '구역', key: 'zoneName', width: 14 },
    { header: '접수일시', key: 'reportedAt', width: 20 },
    { header: '처리내용', key: 'resolveNote', width: 40 },
    { header: '완료일시', key: 'resolvedAt', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  ws.autoFilter = { from: 'A1', to: 'M1' };

  for (const r of items) {
    ws.addRow(r);
  }

  /* summary sheet */
  const ws2 = wb.addWorksheet('요약');
  ws2.columns = [{ width: 16 }, { width: 16 }];
  ws2.addRow(['민원 대장 요약']).font = { bold: true, size: 14 };
  ws2.addRow(['기간', `${fromStr} ~ ${toStr}`]);
  ws2.addRow([]);
  ws2.addRow(['총 건수', items.length]);
  const byStatus = new Map<string, number>();
  for (const r of items) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  for (const [s, cnt] of byStatus.entries()) ws2.addRow([s, cnt]);

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename + '.xlsx')}`,
      'content-length': String(buf.length),
    },
  });
}
