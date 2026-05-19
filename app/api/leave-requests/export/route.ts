/**
 * GET /api/leave-requests/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|csv
 *  - 가시범위 휴가 통계 + 신청 목록 엑셀/CSV 다운로드
 */
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { readSession } from '@/lib/auth';
import { collectLeaveStats } from '@/lib/leave-stats';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

const TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차', ANNUAL_HALF: '연차(반차)', SPECIAL: '경조사', MATERNITY: '출산',
  FAMILY_CARE: '가족돌봄', MENSTRUAL: '생리', OFFICIAL: '공가',
  SICK: '병가', BUSINESS_TRIP: '출장', TRAINING: '교육', OTHER: '기타',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: '신청', IN_REVIEW: '결재 중', APPROVED: '결재 완료', REJECTED: '반려',
};

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(stats: Awaited<ReturnType<typeof collectLeaveStats>>): string {
  const headers = ['ID', '근로자', '사번', '부서', '직책', '유형', '상태', '시작일', '종료일', '일수', '사유', '1차결재자', '대표결재자', '신청일'];
  const lines = [headers.join(',')];
  for (const r of stats.rows) {
    lines.push([
      r.id, r.workerName, r.workerEmployeeNo, r.departmentName ?? '',
      r.positionLabel ?? '', TYPE_LABEL[r.requestType] ?? r.requestType,
      STATUS_LABEL[r.status] ?? r.status, r.startDate, r.endDate, r.days,
      r.reason ?? '', r.firstApproverName ?? '', r.finalApproverName ?? '',
      r.createdAt.slice(0, 19).replace('T', ' '),
    ].map(csvEscape).join(','));
  }
  return '﻿' + lines.join('\n');
}

async function buildXlsx(stats: Awaited<ReturnType<typeof collectLeaveStats>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();
  const period = `${stats.range.from} ~ ${stats.range.to}`;

  /* 1) 요약 */
  const s1 = wb.addWorksheet('요약');
  applyStandardHeader(s1, { title: '휴가신청 현황 — 요약', colCount: 2, period, totalCount: stats.total.requested });
  addHeaderRow(s1, ['항목', '건수/일수']);
  const summaryRows = [
    ['전체 신청', stats.total.requested],
    ['결재 완료', stats.total.approved],
    ['결재 중', stats.total.inReview],
    ['반려', stats.total.rejected],
    ['총 신청 일수', stats.totalDays.requested],
    ['승인 일수', stats.totalDays.approved],
    ['연차 사용 일수', stats.totalDays.annualUsed],
  ];
  summaryRows.forEach((r, idx) => {
    const row = s1.addRow(r);
    styleDataRow(row, idx + 1);
    row.height = 18;
  });
  s1.columns = [{ width: 20 }, { width: 16 }];

  /* 2) 유형별 */
  const s2 = wb.addWorksheet('유형별');
  applyStandardHeader(s2, { title: '휴가신청 현황 — 유형별', colCount: 3, period, totalCount: stats.total.requested });
  addHeaderRow(s2, ['유형', '건수', '일수']);
  Object.entries(stats.byType).forEach(([t, v], idx) => {
    const row = s2.addRow([TYPE_LABEL[t] ?? t, v.count, v.days]);
    styleDataRow(row, idx + 1);
    row.height = 18;
  });
  s2.columns = [{ width: 16 }, { width: 10 }, { width: 10 }];

  /* 3) 근로자별 */
  const s3 = wb.addWorksheet('근로자별');
  applyStandardHeader(s3, { title: '휴가신청 현황 — 근로자별', colCount: 4, period, totalCount: stats.total.requested });
  addHeaderRow(s3, ['근로자', '사번', '건수', '일수']);
  stats.byWorker.forEach((w, idx) => {
    const row = s3.addRow([w.workerName, w.employeeNo ?? '', w.count, w.days]);
    styleDataRow(row, idx + 1);
    row.height = 18;
  });
  s3.columns = [{ width: 16 }, { width: 12 }, { width: 10 }, { width: 10 }];

  /* 4) 부서별 */
  const s4 = wb.addWorksheet('부서별');
  applyStandardHeader(s4, { title: '휴가신청 현황 — 부서별', colCount: 3, period, totalCount: stats.total.requested });
  addHeaderRow(s4, ['부서', '건수', '일수']);
  stats.byDepartment.forEach((d, idx) => {
    const row = s4.addRow([d.departmentName, d.count, d.days]);
    styleDataRow(row, idx + 1);
    row.height = 18;
  });
  s4.columns = [{ width: 20 }, { width: 10 }, { width: 10 }];

  /* 5) 월별 */
  const s5 = wb.addWorksheet('월별');
  applyStandardHeader(s5, { title: '휴가신청 현황 — 월별', colCount: 3, period, totalCount: stats.total.requested });
  addHeaderRow(s5, ['월', '건수', '일수']);
  stats.byMonth.forEach((m, idx) => {
    const row = s5.addRow([m.ym, m.count, m.days]);
    styleDataRow(row, idx + 1);
    row.height = 18;
  });
  s5.columns = [{ width: 12 }, { width: 10 }, { width: 10 }];

  /* 6) 신청 내역 (메인 시트) */
  const s6 = wb.addWorksheet('신청 내역');
  applyStandardHeader(s6, { title: '휴가신청 현황', colCount: 14, period, totalCount: stats.rows.length });
  addHeaderRow(s6, [
    'ID', '근로자', '사번', '부서', '직책', '유형', '상태',
    '시작일', '종료일', '일수', '사유', '1차결재자', '대표결재자', '신청일',
  ]);
  stats.rows.forEach((r, idx) => {
    const row = s6.addRow([
      r.id, r.workerName, r.workerEmployeeNo,
      r.departmentName, r.positionLabel,
      TYPE_LABEL[r.requestType] ?? r.requestType,
      STATUS_LABEL[r.status] ?? r.status,
      r.startDate, r.endDate, r.days,
      r.reason ?? '',
      r.firstApproverName ?? '', r.finalApproverName ?? '',
      r.createdAt.slice(0, 19).replace('T', ' '),
    ]);
    styleDataRow(row, idx + 1);
    row.height = 18;
    row.getCell(11).alignment = { horizontal: 'left', vertical: 'middle' }; // 사유 좌측
  });
  s6.columns = [
    { width: 8 },  // ID
    { width: 12 }, // 근로자
    { width: 10 }, // 사번
    { width: 14 }, // 부서
    { width: 12 }, // 직책
    { width: 12 }, // 유형
    { width: 10 }, // 상태
    { width: 12 }, // 시작일
    { width: 12 }, // 종료일
    { width: 8 },  // 일수
    { width: 30 }, // 사유
    { width: 12 }, // 1차결재자
    { width: 12 }, // 대표결재자
    { width: 18 }, // 신청일
  ];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const format = (url.searchParams.get('format') ?? 'xlsx').toLowerCase();
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  }
  const from = new Date(fromStr + 'T00:00:00Z');
  const to = new Date(toStr + 'T23:59:59Z');
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to.getTime() < from.getTime()) {
    return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 });
  }

  const stats = await collectLeaveStats(session, { from, to }, {
    requestType: url.searchParams.get('type') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    workerId: url.searchParams.get('workerId') ?? undefined,
    departmentId: url.searchParams.get('departmentId') ?? undefined,
  });

  if (format === 'csv') {
    const csv = buildCsv(stats);
    const filename = `휴가신청현황_${fromStr}_${toStr}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  }

  const buf = await buildXlsx(stats);
  return xlsxResponse(buf, makeFilename('휴가신청현황'));
}
