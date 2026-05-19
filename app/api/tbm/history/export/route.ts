/**
 * GET /api/tbm/history/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * TBM 활동이력 Excel 다운로드
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { readSession } from '@/lib/auth';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

function isManager(role: string) {
  return ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN'].includes(role);
}

function parseTbmContent(raw: string | null): { text: string | null } {
  if (!raw) return { text: null };
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object') return { text: p.text ?? null };
  } catch { /* ignore */ }
  return { text: raw };
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

  // Build Excel
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WCI-ERP';
  wb.created = new Date();

  const ws = wb.addWorksheet('TBM활동이력');

  const periodLabel = from && to
    ? `${from} ~ ${to}`
    : from ? `${from} 이후` : to ? `${to} 이전` : '전체';

  // ─── Title ───
  ws.mergeCells('A1:M1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'TBM 활동 이력';
  titleCell.font = { name: '맑은 고딕', bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  // ─── Period ───
  ws.mergeCells('A2:M2');
  const periodCell = ws.getCell('A2');
  periodCell.value = `조회기간: ${periodLabel}  |  총 ${sessions.length}건`;
  periodCell.font = { name: '맑은 고딕', size: 10 };
  periodCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 20;

  ws.addRow([]); // spacer row 3

  // ─── Header ───
  const headers = [
    'No', '실시일자', '작성자', '리더', '장소',
    '교육시간(분)', '작업내용(주제)', '위험요인',
    '안전대책', '작업전 안전점검', '참석(명)',
    '서명현황', '등록일시',
  ];
  const headerRow = ws.addRow(headers); // row 4
  headerRow.eachCell((cell) => {
    cell.font = { name: '맑은 고딕', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5DA8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  });
  ws.getRow(4).height = 32;

  // ─── Data rows ───
  sessions.forEach((s, idx) => {
    const parsed = parseTbmContent(s.content ?? null);
    const signerNames = s.signatures.map((sig) => sig.worker.name).join(', ');

    const row = ws.addRow([
      idx + 1,
      s.sessionDate.toISOString().slice(0, 10),
      s.creator.name,
      '(미입력)',   // 리더 — not stored in current schema
      s.facility?.name ?? '(미입력)', // 장소
      10,           // 교육시간 10분 기본
      s.topic ?? '',
      '(미입력)',   // 위험요인
      '(미입력)',   // 안전대책
      '(미입력)',   // 작업전 안전점검
      s.signatures.length,
      `${s.signatures.length}명 서명`,
      s.createdAt.toLocaleString('ko-KR'),
    ]);

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { name: '맑은 고딕', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
      };
      if ([1, 2, 6, 11].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
      }
      // Gray out placeholder cells
      if (['(미입력)'].includes(String(cell.value))) {
        cell.font = { name: '맑은 고딕', size: 9, color: { argb: 'FFAAAAAA' } };
      }
    });
    row.height = 20;
  });

  // ─── Signers detail sheet ───
  const ws2 = wb.addWorksheet('서명자목록');
  ws2.mergeCells('A1:E1');
  ws2.getCell('A1').value = 'TBM 서명자 상세';
  ws2.getCell('A1').font = { name: '맑은 고딕', bold: true, size: 13 };
  ws2.getCell('A1').alignment = { horizontal: 'center' };
  ws2.getRow(1).height = 28;

  const ws2Header = ws2.addRow(['No', '실시일자', '작업주제', '서명자', '서명일시']);
  ws2Header.eachCell((cell) => {
    cell.font = { name: '맑은 고딕', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3D6B9E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });

  let signRowIdx = 0;
  for (const s of sessions) {
    for (const sig of s.signatures) {
      signRowIdx++;
      const r = ws2.addRow([
        signRowIdx,
        s.sessionDate.toISOString().slice(0, 10),
        s.topic ?? '',
        sig.worker.name,
        sig.signedAt.toLocaleString('ko-KR'),
      ]);
      r.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.font = { name: '맑은 고딕', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
          left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        };
        cell.alignment = { horizontal: [1, 4, 5].includes(colNum) ? 'center' : 'left', vertical: 'middle' };
        if (signRowIdx % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
        }
      });
      r.height = 18;
    }
  }

  ws2.columns = [
    { width: 7 }, { width: 14 }, { width: 30 }, { width: 14 }, { width: 22 },
  ];

  // ─── Column widths (main sheet) ───
  ws.columns = [
    { width: 7 },  // No
    { width: 13 }, // 실시일자
    { width: 12 }, // 작성자
    { width: 12 }, // 리더
    { width: 16 }, // 장소
    { width: 12 }, // 교육시간
    { width: 28 }, // 작업내용
    { width: 18 }, // 위험요인
    { width: 18 }, // 안전대책
    { width: 18 }, // 작업전 안전점검
    { width: 10 }, // 참석수
    { width: 12 }, // 서명현황
    { width: 22 }, // 등록일시
  ];

  // ─── Note ───
  const noteRowIdx = 4 + sessions.length + 1;
  ws.mergeCells(`A${noteRowIdx}:M${noteRowIdx}`);
  const noteCell = ws.getCell(`A${noteRowIdx}`);
  noteCell.value = `출력일시: ${new Date().toLocaleString('ko-KR')}  |  리더/장소/위험요인/안전대책은 향후 시스템 구축 예정 항목`;
  noteCell.font = { name: '맑은 고딕', size: 8, color: { argb: 'FF888888' } };
  noteCell.alignment = { horizontal: 'right' };

  const buffer = await wb.xlsx.writeBuffer();
  const fromStr = from?.replace(/-/g, '') ?? '';
  const toStr = to?.replace(/-/g, '') ?? '';
  const filename = `TBM활동이력_${fromStr}${fromStr && toStr ? '_' : ''}${toStr || new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
