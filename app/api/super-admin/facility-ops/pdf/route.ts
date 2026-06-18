/**
 * GET /api/super-admin/facility-ops/pdf?facilityId=N&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * AVAC 시설 운전기록 PDF 출력 (landscape A4).
 * Puppeteer + 인라인 HTML 템플릿으로 생성.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import { renderPdf } from '@/lib/report/pdf-renderer';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_DAYS = 90;

async function resolveMunicipalityId(session: {
  role: string;
  contractorId: string | null;
}): Promise<bigint | null | 'all'> {
  if (session.role === 'SUPER_ADMIN') return 'all';
  if (session.contractorId) {
    const c = await prisma.contractor.findUnique({
      where: { id: BigInt(session.contractorId) },
      select: { municipalityId: true },
    });
    return c?.municipalityId ?? null;
  }
  return null;
}

function n(val: unknown, decimals = 2): string {
  const f = parseFloat(String(val ?? 0));
  return isNaN(f) ? '0' : f.toFixed(decimals);
}

function buildHtml(params: {
  facilityName: string;
  from: string;
  to: string;
  rows: Array<{
    facilityName: string;
    opsDate: string;
    generalOpHours: unknown;
    foodOpHours: unknown;
    downtimeHours: unknown;
    generalWasteTon: unknown;
    foodWasteTon: unknown;
    generalCollectTon: unknown;
    foodCollectTon: unknown;
    generalTransferTon: unknown;
    foodTransferTon: unknown;
    prevDayPowerKwh: unknown;
    downtimeReason: string | null;
    notes: string | null;
  }>;
}): string {
  const { facilityName, from, to, rows } = params;

  // Totals
  const totals = rows.reduce(
    (acc, r) => ({
      generalOpHours: acc.generalOpHours + parseFloat(String(r.generalOpHours ?? 0)),
      foodOpHours: acc.foodOpHours + parseFloat(String(r.foodOpHours ?? 0)),
      downtimeHours: acc.downtimeHours + parseFloat(String(r.downtimeHours ?? 0)),
      generalWasteTon: acc.generalWasteTon + parseFloat(String(r.generalWasteTon ?? 0)),
      foodWasteTon: acc.foodWasteTon + parseFloat(String(r.foodWasteTon ?? 0)),
      generalCollectTon: acc.generalCollectTon + parseFloat(String(r.generalCollectTon ?? 0)),
      foodCollectTon: acc.foodCollectTon + parseFloat(String(r.foodCollectTon ?? 0)),
      generalTransferTon: acc.generalTransferTon + parseFloat(String(r.generalTransferTon ?? 0)),
      foodTransferTon: acc.foodTransferTon + parseFloat(String(r.foodTransferTon ?? 0)),
      prevDayPowerKwh: acc.prevDayPowerKwh + parseFloat(String(r.prevDayPowerKwh ?? 0)),
    }),
    { generalOpHours: 0, foodOpHours: 0, downtimeHours: 0, generalWasteTon: 0, foodWasteTon: 0, generalCollectTon: 0, foodCollectTon: 0, generalTransferTon: 0, foodTransferTon: 0, prevDayPowerKwh: 0 },
  );

  const dataRows = rows.map((r) => `
    <tr>
      <td>${r.facilityName}</td>
      <td>${r.opsDate}</td>
      <td class="num">${n(r.generalOpHours)}</td>
      <td class="num">${n(r.foodOpHours)}</td>
      <td class="num">${n(r.downtimeHours)}</td>
      <td class="note">${r.downtimeReason ?? ''}</td>
      <td class="num">${n(r.generalWasteTon, 3)}</td>
      <td class="num">${n(r.foodWasteTon, 3)}</td>
      <td class="num">${n(r.generalCollectTon, 3)}</td>
      <td class="num">${n(r.foodCollectTon, 3)}</td>
      <td class="num">${n(r.generalTransferTon, 3)}</td>
      <td class="num">${n(r.foodTransferTon, 3)}</td>
      <td class="num">${n(r.prevDayPowerKwh)}</td>
      <td class="note">${r.notes ?? ''}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; font-size: 8.5pt; color: #111; }
  h1 { font-size: 13pt; font-weight: 700; text-align: center; margin-bottom: 6px; }
  .subtitle { text-align: center; font-size: 8pt; color: #555; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #1e4d8c;
    color: #fff;
    font-weight: 600;
    font-size: 7.5pt;
    padding: 4px 3px;
    border: 1px solid #163a6b;
    text-align: center;
    white-space: nowrap;
  }
  td {
    border: 1px solid #ccc;
    padding: 3px 4px;
    font-size: 7.5pt;
    vertical-align: middle;
  }
  tr:nth-child(even) td { background: #f5f8ff; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .note { font-size: 7pt; color: #444; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr.total td {
    background: #e8f0fe;
    font-weight: 700;
    border-top: 2px solid #1e4d8c;
  }
  .generated { text-align: right; font-size: 7pt; color: #888; margin-top: 6px; }
</style>
</head>
<body>
<h1>AVAC 시설 운전기록</h1>
<p class="subtitle">${facilityName} &nbsp;|&nbsp; ${from} ~ ${to} &nbsp;|&nbsp; 총 ${rows.length}건</p>
<table>
  <thead>
    <tr>
      <th>집하장</th>
      <th>운영일자</th>
      <th>일반가동<br/>(h)</th>
      <th>음식가동<br/>(h)</th>
      <th>비가동<br/>(h)</th>
      <th>비가동사유</th>
      <th>일반처리<br/>(ton)</th>
      <th>음식처리<br/>(ton)</th>
      <th>일반수거<br/>(ton)</th>
      <th>음식수거<br/>(ton)</th>
      <th>일반반출<br/>(ton)</th>
      <th>음식반출<br/>(ton)</th>
      <th>전일전력<br/>(kWh)</th>
      <th>비고</th>
    </tr>
  </thead>
  <tbody>
    ${dataRows}
    ${rows.length > 0 ? `
    <tr class="total">
      <td colspan="2" style="text-align:center">합 계</td>
      <td class="num">${totals.generalOpHours.toFixed(2)}</td>
      <td class="num">${totals.foodOpHours.toFixed(2)}</td>
      <td class="num">${totals.downtimeHours.toFixed(2)}</td>
      <td></td>
      <td class="num">${totals.generalWasteTon.toFixed(3)}</td>
      <td class="num">${totals.foodWasteTon.toFixed(3)}</td>
      <td class="num">${totals.generalCollectTon.toFixed(3)}</td>
      <td class="num">${totals.foodCollectTon.toFixed(3)}</td>
      <td class="num">${totals.generalTransferTon.toFixed(3)}</td>
      <td class="num">${totals.foodTransferTon.toFixed(3)}</td>
      <td class="num">${totals.prevDayPowerKwh.toFixed(2)}</td>
      <td></td>
    </tr>` : ''}
  </tbody>
</table>
<p class="generated">생성: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
</body>
</html>`;
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!['SUPER_ADMIN', 'CONTRACTOR_ADMIN'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const facilityIdParam = url.searchParams.get('facilityId');

  if (!from || !to) return NextResponse.json({ error: 'from and to are required' }, { status: 400 });

  const diffDays = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
  if (diffDays > MAX_DAYS) {
    return NextResponse.json({ error: `기간은 최대 ${MAX_DAYS}일까지 가능합니다` }, { status: 400 });
  }

  const muniId = await resolveMunicipalityId(session);
  if (muniId === null) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const facilityId = facilityIdParam ? BigInt(facilityIdParam) : null;

  const items = await prisma.facilityDailyOps.findMany({
    where: {
      ...(facilityId ? { facilityId } : {}),
      ...(muniId !== 'all' ? { facility: { municipalityId: muniId } } : {}),
      opsDate: { gte: new Date(from), lte: new Date(to) },
    },
    include: { facility: { select: { name: true } } },
    orderBy: [{ facilityId: 'asc' }, { opsDate: 'asc' }],
  });

  let facilityLabel = '전체 집하장';
  if (facilityId) {
    facilityLabel = items[0]?.facility.name ?? `시설 ${facilityIdParam}`;
  }

  const rows = items.map((r) => ({
    facilityName: r.facility.name,
    opsDate: r.opsDate.toISOString().slice(0, 10),
    generalOpHours: r.generalOpHours,
    foodOpHours: r.foodOpHours,
    downtimeHours: r.downtimeHours,
    downtimeReason: r.downtimeReason,
    generalWasteTon: r.generalWasteTon,
    foodWasteTon: r.foodWasteTon,
    generalCollectTon: r.generalCollectTon,
    foodCollectTon: r.foodCollectTon,
    generalTransferTon: r.generalTransferTon,
    foodTransferTon: r.foodTransferTon,
    prevDayPowerKwh: r.prevDayPowerKwh,
    notes: r.notes,
  }));

  const html = buildHtml({ facilityName: facilityLabel, from, to, rows });

  try {
    const pdfBuffer = await renderPdf(html);
    const filename = `avac_ops_${from}_${to}.pdf`;
    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: 'pdf_generation_failed' }, { status: 500 });
  }
}
