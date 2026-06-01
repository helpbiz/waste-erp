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
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

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
      zone: { select: { zoneName: true, contractor: { select: { companyName: true } } } },
      contractor: { select: { companyName: true } },
    },
    orderBy: [
      { contractor: { companyName: 'asc' } },
      { zone: { zoneName: 'asc' } },
      { reportedAt: 'asc' },
    ],
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
    zoneName: c.zone
      ? `${c.zone.contractor?.companyName ?? c.contractor?.companyName ?? ''}(${c.zone.zoneName})`
      : (c.contractor?.companyName ?? ''),
    reportedAt: c.reportedAt.toLocaleString('ko-KR'),
    resolveNote: c.resolveNote ?? '',
    resolvedAt: c.resolvedAt?.toLocaleString('ko-KR') ?? '',
  }));

  if (format === 'csv') {
    const headers = ['No', 'ID', '유형', '상태', '주소', '민원내용', '접수자', '연락처', '담당자', '업체(구역)', '접수일시', '처리내용', '완료일시'];
    const lines = ['﻿' + headers.join(',')];
    for (const r of items) {
      lines.push([
        r.no, r.id, r.type, r.status, r.locationAddress, r.description,
        r.reporter, r.complainantPhone, r.assignee, r.zoneName,
        r.reportedAt, r.resolveNote, r.resolvedAt,
      ].map(csvEscape).join(','));
    }
    const filename = `민원대장_${fromStr}_${toStr}.csv`;
    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  /* xlsx */
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('민원대장');

  // 표준 헤더 (1~3행)
  applyStandardHeader(ws, {
    title: '민원 대장',
    colCount: 13,
    period: `${fromStr} ~ ${toStr}`,
    totalCount: items.length,
  });

  // 4행: 컬럼 헤더
  addHeaderRow(ws, ['No', 'ID', '유형', '상태', '주소', '민원내용', '접수자', '연락처', '담당자', '업체(구역)', '접수일시', '처리내용', '완료일시']);

  // 5행~: 데이터
  items.forEach((r, idx) => {
    const row = ws.addRow([
      r.no, r.id, r.type, r.status, r.locationAddress, r.description,
      r.reporter, r.complainantPhone, r.assignee, r.zoneName,
      r.reportedAt, r.resolveNote, r.resolvedAt,
    ]);
    styleDataRow(row, idx + 1);
    row.height = 18;
    // 주소·내용·처리내용 좌측 정렬
    [5, 6, 12].forEach((col) => {
      row.getCell(col).alignment = { horizontal: 'left', vertical: 'middle' };
    });
    // 담당자(9) · 업체(구역)(10) 중앙 정렬
    [9, 10].forEach((col) => {
      row.getCell(col).alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  ws.columns = [
    { width: 6 },  // No
    { width: 12 }, // ID
    { width: 14 }, // 유형
    { width: 10 }, // 상태
    { width: 30 }, // 주소
    { width: 40 }, // 민원내용
    { width: 12 }, // 접수자
    { width: 14 }, // 연락처
    { width: 12 }, // 담당자
    { width: 22 }, // 업체(구역)
    { width: 20 }, // 접수일시
    { width: 40 }, // 처리내용
    { width: 20 }, // 완료일시
  ];

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  return xlsxResponse(buf, makeFilename('민원대장'));
}
