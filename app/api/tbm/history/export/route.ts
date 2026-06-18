/**
 * GET /api/tbm/history/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * TBM 활동이력 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { applyStandardHeader, addHeaderRow, styleDataRow, makeFilename, xlsxResponse } from '@/lib/excel-utils';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

function parseTbmContent(raw: string | null): {
  text: string | null; leader: string | null; location: string | null;
  hazards: string | null; preWorkCheck: string | null;
} {
  const empty = { text: null, leader: null, location: null, hazards: null, preWorkCheck: null };
  if (!raw) return empty;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') return {
      text:         p.text         ?? null,
      leader:       p.leader       ?? null,
      location:     p.location     ?? null,
      hazards:      p.hazards      ?? null,
      preWorkCheck: p.preWorkCheck ?? null,
    };
  } catch { /* ignore */ }
  return { text: raw, leader: null, location: null, hazards: null, preWorkCheck: null };
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!isManager(session.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (!session.contractorId) return NextResponse.json({ error: 'no_contractor' }, { status: 400 });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const contractorId = BigInt(session.contractorId);

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) { const d = new Date(to); d.setDate(d.getDate() + 1); dateFilter.lte = d; }

  const sessions = await prisma.tbmSession.findMany({
    where: {
      contractorId,
      ...(Object.keys(dateFilter).length > 0 ? { sessionDate: dateFilter } : {}),
    },
    include: {
      creator: { select: { name: true } },
      signatures: {
        include: { worker: { select: { id: true, name: true } } },
        orderBy: { signedAt: 'asc' },
      },
      facility: { select: { name: true } },
    },
    orderBy: { sessionDate: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'WCI-ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('TBM활동이력');
  const period = from && to ? `${from} ~ ${to}` : from ? `${from} 이후` : to ? `${to} 이전` : '전체';

  // 표준 헤더 (1~3행)
  applyStandardHeader(ws, {
    title: 'TBM 활동 이력',
    colCount: 13,
    period,
    totalCount: sessions.length,
  });

  // 4행: 컬럼 헤더
  addHeaderRow(ws, [
    'No', '실시일자', '작성자', '리더', '장소',
    '교육시간(분)', '작업내용(주제)', '위험요인',
    '안전대책', '작업전 안전점검', '참석(명)',
    '서명현황', '등록일시',
  ]);

  // 5행~: 데이터
  sessions.forEach((s, idx) => {
    const parsed = parseTbmContent(s.content ?? null);
    const location = parsed.location ?? s.facility?.name ?? '';
    const row = ws.addRow([
      idx + 1,
      s.sessionDate.toISOString().slice(0, 10),
      s.creator.name,
      parsed.leader ?? '',
      location,
      10,
      s.topic ?? '',
      parsed.hazards ?? '',
      parsed.text ?? '',
      parsed.preWorkCheck ?? '',
      s.signatures.length,
      `${s.signatures.length}명 서명`,
      s.createdAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    ]);
    styleDataRow(row, idx + 1);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 9 };
      if ([1, 2, 6, 11].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
      if (!cell.value || cell.value === '') {
        cell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FFCCCCCC' } };
      }
    });
  });

  ws.columns = [
    { width: 7 }, { width: 13 }, { width: 12 }, { width: 12 }, { width: 16 },
    { width: 12 }, { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 10 }, { width: 12 }, { width: 22 },
  ];

  /* 서명자 목록 시트 */
  const ws2 = wb.addWorksheet('서명자목록');
  applyStandardHeader(ws2, {
    title: 'TBM 서명자 상세',
    colCount: 5,
    period,
    totalCount: sessions.reduce((s, sess) => s + sess.signatures.length, 0),
    unit: '건',
  });
  addHeaderRow(ws2, ['No', '실시일자', '작업주제', '서명자', '서명일시']);

  let signNo = 0;
  for (const s of sessions) {
    for (const sig of s.signatures) {
      signNo++;
      const row = ws2.addRow([
        signNo,
        s.sessionDate.toISOString().slice(0, 10),
        s.topic ?? '',
        sig.worker.name,
        sig.signedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      ]);
      styleDataRow(row, signNo);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { name: '맑은 고딕', size: 9 };
        cell.alignment = { horizontal: [1, 4, 5].includes(colNum) ? 'center' : 'left', vertical: 'middle' };
      });
    }
  }
  ws2.columns = [{ width: 7 }, { width: 14 }, { width: 30 }, { width: 14 }, { width: 22 }];

  const buffer = await wb.xlsx.writeBuffer();
  return xlsxResponse(Buffer.from(buffer), makeFilename('TBM활동이력'));
}
