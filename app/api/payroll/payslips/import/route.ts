/**
 * POST /api/payroll/payslips/import
 * multipart/form-data: file (Excel), yearMonth, contractorId?
 *
 * 1. ExcelJS로 파싱
 * 2. 회사 PayslipTemplate 로드
 * 3. 행 × 이름/직원번호 → DB 근로자 매칭
 * 4. PayslipRecord upsert (isPublished=false)
 * 5. 미리보기 결과 반환
 */
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { canManageUsers } from '@/lib/users';
import { DEFAULT_TEMPLATE, type PayslipTemplate } from '@/lib/payslip-template';

function cellVal(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    if ('result' in v) return String((v as ExcelJS.CellFormulaValue).result ?? '');
    if ('error' in v) return '';
    if ('text' in v) return String((v as { text: string }).text);
  }
  return String(v);
}

function toNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const isManagerRole = canManageUsers(session.role);
  let workerIsPayrollManager = false;
  if (!isManagerRole && session.role === 'WORKER') {
    const flag = await prisma.user.findUnique({ where: { id: BigInt(session.userId) }, select: { isPayrollManager: true } });
    workerIsPayrollManager = flag?.isPayrollManager === true;
  }
  if (!isManagerRole && !workerIsPayrollManager) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: 'multipart_required' }, { status: 400 }); }

  const file         = formData.get('file') as File | null;
  const yearMonth    = (formData.get('yearMonth') as string | null)?.trim() ?? '';
  const rawCid       = formData.get('contractorId') as string | null;
  const payDateParam = (formData.get('payDate') as string | null)?.trim() || null;

  if (!file)          return NextResponse.json({ error: 'no_file' },          { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yearMonth))
    return NextResponse.json({ error: 'invalid_yearMonth' }, { status: 400 });

  let contractorId: bigint;
  if (session.role === 'SUPER_ADMIN') {
    if (!rawCid) return NextResponse.json({ error: 'contractor_id_required' }, { status: 400 });
    contractorId = BigInt(rawCid);
  } else {
    if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });
    contractorId = BigInt(session.contractorId);
  }

  /* 엑셀 파싱 */
  const buf = await file.arrayBuffer();
  const wb  = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); }
  catch { return NextResponse.json({ error: 'invalid_excel' }, { status: 400 }); }

  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return NextResponse.json({ error: 'empty_sheet' }, { status: 400 });

  /* 헤더 자동 감지 */
  let headerRowIdx = 1;
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const vals = (ws.getRow(r).values as unknown[]).slice(1);
    if (vals.filter((v) => typeof v === 'string' && (v as string).trim()).length >= 2) {
      headerRowIdx = r; break;
    }
  }
  const headers: string[] = [];
  ws.getRow(headerRowIdx).eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = cellVal(cell).trim();
  });

  /* 회사 템플릿 로드 */
  const feat = await prisma.contractorFeature.findUnique({
    where: { contractorId_featureKey: { contractorId, featureKey: 'payslip' } },
    select: { config: true },
  });
  const tmpl: PayslipTemplate = (feat?.config as PayslipTemplate | null) ?? DEFAULT_TEMPLATE;
  const allCols = [...tmpl.earnings, ...tmpl.deductions];

  /* 근로자 목록 (해당 회사) */
  const workers = await prisma.user.findMany({
    where: { contractorId, role: 'WORKER', status: 'ACTIVE' },
    select: { id: true, name: true, employeeNo: true },
  });
  const byEmpNo = new Map(workers.filter((w) => w.employeeNo).map((w) => [w.employeeNo!, w]));
  const byName  = new Map(workers.map((w) => [w.name, w]));

  type RowResult = {
    rowNo: number; status: 'OK' | 'SKIP' | 'WARN' | 'ERROR';
    message: string; workerName?: string; employeeNo?: string;
    preview?: Record<string, unknown>;
  };
  const results: RowResult[] = [];
  const upserts: Array<{ workerId: bigint; data: object }> = [];

  for (let r = headerRowIdx + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj: Record<string, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const h = headers[col - 1];
      if (h) obj[h] = cellVal(cell);
    });
    if (!Object.values(obj).some((v) => v.trim())) continue;

    const name       = (obj['이름'] ?? '').trim();
    const employeeNo = (obj['직원번호'] ?? '').trim() || null;

    if (!name) { results.push({ rowNo: r, status: 'SKIP', message: '이름 없음 — 건너뜀' }); continue; }

    const worker = (employeeNo && byEmpNo.get(employeeNo)) ?? byName.get(name);
    if (!worker) {
      results.push({ rowNo: r, status: 'ERROR', message: `근로자 미매칭 (이름: ${name}, 직원번호: ${employeeNo ?? '없음'})`, workerName: name });
      continue;
    }

    const earnings:   Record<string, number> = {};
    const deductions: Record<string, number> = {};
    const extras:     Record<string, number> = {};

    for (const col of tmpl.earnings)   earnings[col.key]   = toNum(obj[col.key] ?? '0');
    for (const col of tmpl.deductions) deductions[col.key] = toNum(obj[col.key] ?? '0');
    for (const col of tmpl.extras)     extras[col.key]     = toNum(obj[col.key] ?? '0');

    /* 근로자 기본정보 */
    const position   = (obj['직책']     ?? '').trim() || null;
    const birthDate  = (obj['생년월일'] ?? '').trim() || null;
    const hireDate   = (obj['입사년월일'] ?? '').trim() || null;
    let workDays   = toNum(obj['출근일수'] ?? '');
    const payDate    = payDateParam || (obj['지급일'] ?? '').trim() || (tmpl.payDayLabel ?? null);
    /* 출근일수 미기재 시 MonthlyAttendanceSummary에서 자동 조회 */
    if (workDays === 0) {
      const summary = await prisma.monthlyAttendanceSummary.findUnique({
        where: { workerId_yearMonth: { workerId: worker.id, yearMonth } },
        select: { totalWorkDays: true },
      });
      if (summary?.totalWorkDays) workDays = summary.totalWorkDays;
    }
    const hourlyRate = toNum(obj['시급'] ?? '');

    /* 근로시간 */
    const workHours = {
      연장기본: toNum(obj['연장기본'] ?? ''),
      연장추가: toNum(obj['연장추가'] ?? ''),
      야간기본: toNum(obj['야간기본'] ?? ''),
      야간추가: toNum(obj['야간추가'] ?? ''),
    };

    /* 합계: 엑셀값 우선, 없으면 자동계산 */
    const grossRaw  = toNum(obj['지급합계'] ?? '');
    const deductRaw = toNum(obj['공제합계'] ?? '');
    const netRaw    = toNum(obj['실수령액'] ?? '');
    const gross  = grossRaw  || Object.values(earnings).reduce((a, b) => a + b, 0);
    const deduct = deductRaw || Object.values(deductions).reduce((a, b) => a + b, 0);
    const net    = netRaw    || gross - deduct;

    const extrasTotal = Object.values(extras).reduce((a, b) => a + b, 0);
    const data = {
      employeeNo: worker.employeeNo ?? employeeNo ?? null,
      position,
      birthDate,
      hireDate,
      workDays,
      payDate,
      hourlyRate,
      earnings,
      deductions,
      extras,
      workHours,
      totals: { 지급합계: gross, 공제합계: deduct, 실수령액: net },
    };

    /* 필수항목 누락 경고 */
    const missing = allCols.filter((c) => c.required && !(c.key in obj)).map((c) => c.label);
    const status  = missing.length > 0 ? 'WARN' : 'OK';
    const message = missing.length > 0 ? `필수항목 누락: ${missing.join(', ')}` : '정상';

    results.push({ rowNo: r, status, message, workerName: worker.name, employeeNo: worker.employeeNo ?? undefined, preview: data });
    upserts.push({ workerId: worker.id, data });
  }

  /* PayslipRecord upsert (isPublished=false — 발송 전 저장) */
  let savedCount = 0;
  for (const u of upserts) {
    await prisma.payslipRecord.upsert({
      where:  { contractorId_workerId_yearMonth: { contractorId, workerId: u.workerId, yearMonth } },
      update: { data: u.data, updatedAt: new Date(), createdBy: BigInt(session.userId) },
      create: { contractorId, workerId: u.workerId, yearMonth, data: u.data, isPublished: false, createdBy: BigInt(session.userId) },
    });
    savedCount++;
  }

  await prisma.auditLog.create({
    data: {
      actorId: BigInt(session.userId), actorRole: session.role,
      action: 'PAYSLIP_IMPORT', resourceType: 'payslip_record',
      resourceId: contractorId.toString(),
      contractorId,
      metadata: { yearMonth, total: results.length, saved: savedCount } as object,
    },
  });

  return NextResponse.json({ ok: true, yearMonth, total: results.length, savedCount, results });
}
