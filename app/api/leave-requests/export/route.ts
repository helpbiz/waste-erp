/**
 * GET /api/leave-requests/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=xlsx|csv
 *  - 가시범위 휴가 통계 + 신청 목록 엑셀/CSV 다운로드
 *
 * XLSX 시트: 1) 요약  2) 유형별  3) 워커별  4) 부서별  5) 월별  6) 신청 내역
 */
import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { readSession } from '@/lib/auth';
import { collectLeaveStats } from '@/lib/leave-stats';

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
  return '﻿' + lines.join('\n'); // UTF-8 BOM (Excel 한글 호환)
}

async function buildXlsx(stats: Awaited<ReturnType<typeof collectLeaveStats>>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CleanERP';
  wb.created = new Date();

  /* 1) 요약 */
  const s1 = wb.addWorksheet('요약');
  s1.columns = [{ width: 18 }, { width: 18 }];
  s1.addRow(['휴가 보고서']).font = { bold: true, size: 14 };
  s1.addRow(['기간', `${stats.range.from} ~ ${stats.range.to}`]);
  s1.addRow([]);
  s1.addRow(['전체 신청', stats.total.requested]);
  s1.addRow(['결재 완료', stats.total.approved]);
  s1.addRow(['결재 중', stats.total.inReview]);
  s1.addRow(['반려', stats.total.rejected]);
  s1.addRow([]);
  s1.addRow(['총 신청 일수', stats.totalDays.requested]);
  s1.addRow(['승인 일수', stats.totalDays.approved]);
  s1.addRow(['연차 사용 일수', stats.totalDays.annualUsed]);

  /* 2) 유형별 */
  const s2 = wb.addWorksheet('유형별');
  s2.columns = [
    { header: '유형', key: 'type', width: 16 },
    { header: '건수', key: 'count', width: 10 },
    { header: '일수', key: 'days', width: 10 },
  ];
  for (const [t, v] of Object.entries(stats.byType)) {
    s2.addRow({ type: TYPE_LABEL[t] ?? t, count: v.count, days: v.days });
  }
  s2.getRow(1).font = { bold: true };

  /* 3) 워커별 */
  const s3 = wb.addWorksheet('워커별');
  s3.columns = [
    { header: '근로자', key: 'name', width: 16 },
    { header: '사번', key: 'no', width: 12 },
    { header: '건수', key: 'count', width: 10 },
    { header: '일수', key: 'days', width: 10 },
  ];
  for (const w of stats.byWorker) {
    s3.addRow({ name: w.workerName, no: w.employeeNo ?? '', count: w.count, days: w.days });
  }
  s3.getRow(1).font = { bold: true };

  /* 4) 부서별 */
  const s4 = wb.addWorksheet('부서별');
  s4.columns = [
    { header: '부서', key: 'dept', width: 20 },
    { header: '건수', key: 'count', width: 10 },
    { header: '일수', key: 'days', width: 10 },
  ];
  for (const d of stats.byDepartment) {
    s4.addRow({ dept: d.departmentName, count: d.count, days: d.days });
  }
  s4.getRow(1).font = { bold: true };

  /* 5) 월별 */
  const s5 = wb.addWorksheet('월별');
  s5.columns = [
    { header: '월', key: 'ym', width: 12 },
    { header: '건수', key: 'count', width: 10 },
    { header: '일수', key: 'days', width: 10 },
  ];
  for (const m of stats.byMonth) {
    s5.addRow({ ym: m.ym, count: m.count, days: m.days });
  }
  s5.getRow(1).font = { bold: true };

  /* 6) 신청 내역 */
  const s6 = wb.addWorksheet('신청 내역');
  s6.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: '근로자', key: 'name', width: 12 },
    { header: '사번', key: 'no', width: 10 },
    { header: '부서', key: 'dept', width: 14 },
    { header: '직책', key: 'pos', width: 12 },
    { header: '유형', key: 'type', width: 12 },
    { header: '상태', key: 'status', width: 10 },
    { header: '시작일', key: 'start', width: 12 },
    { header: '종료일', key: 'end', width: 12 },
    { header: '일수', key: 'days', width: 8 },
    { header: '사유', key: 'reason', width: 30 },
    { header: '1차결재자', key: 'first', width: 12 },
    { header: '대표결재자', key: 'final', width: 12 },
    { header: '신청일', key: 'created', width: 18 },
  ];
  for (const r of stats.rows) {
    s6.addRow({
      id: r.id, name: r.workerName, no: r.workerEmployeeNo,
      dept: r.departmentName, pos: r.positionLabel,
      type: TYPE_LABEL[r.requestType] ?? r.requestType,
      status: STATUS_LABEL[r.status] ?? r.status,
      start: r.startDate, end: r.endDate, days: r.days,
      reason: r.reason ?? '',
      first: r.firstApproverName ?? '', final: r.finalApproverName ?? '',
      created: r.createdAt.slice(0, 19).replace('T', ' '),
    });
  }
  s6.getRow(1).font = { bold: true };
  s6.autoFilter = { from: 'A1', to: 'N1' };

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

  const filename = `leave-report_${stats.range.from}_${stats.range.to}`;

  if (format === 'csv') {
    const csv = buildCsv(stats);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}.csv"`,
      },
    });
  }

  /* xlsx */
  const buf = await buildXlsx(stats);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}.xlsx"`,
      'content-length': String(buf.length),
    },
  });
}
