'use client';

import { useEffect } from 'react';

const MATERIAL_LABEL: Record<string, string> = {
  GENERAL: '생활', FOOD: '음식물', RECYCLING: '재활용', WOOD: '대형폐기물',
};

type Row = {
  no: number;
  vehiclePlate: string | null;
  intakeTime: string;
  facilityName: string | null;
  materialCategory: string;
  weightTon: number;
  note: string | null;
};

type Summary = { category: string; label: string; totalTon: number };

export default function DailyTreatmentPrintClient({
  date,
  contractor,
  summary,
  rows,
  totalWeight,
  generatedBy,
}: {
  date: string;
  contractor: { companyName: string; businessNo: string; municipalityName: string | null };
  summary: Summary[];
  rows: Row[];
  totalWeight: number;
  generatedBy: string;
}) {
  useEffect(() => {
    setTimeout(() => window.print(), 400);
  }, []);

  const d = new Date(date + 'T00:00:00');
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const formattedDate = `${date} (${dayName})`;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print flex items-center gap-3 p-4 bg-slate-100 border-b border-line">
        <button onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-extrabold hover:bg-accent-strong">
          🖨 인쇄 / PDF 저장
        </button>
        <a href="/print"
          className="px-4 py-2 rounded-lg bg-slate-100 border border-slate-300 text-ink text-sm font-bold hover:bg-slate-200">
          🖨 출력센터
        </a>
        <button onClick={() => window.close()}
          className="px-4 py-2 rounded-lg bg-slate-200 text-ink text-sm font-bold hover:bg-slate-300">
          닫기
        </button>
        <span className="text-sm text-ink-muted">{formattedDate} · {contractor.companyName}</span>
      </div>

      <article className="bg-white p-8 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
        <h2 className="text-2xl font-black text-center mb-4 border-b-2 border-slate-900 pb-3">
          일일 처리실적 일보
        </h2>

        <table className="w-full border-collapse text-sm mb-4">
          <tbody>
            <tr>
              <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold w-[100px]">위탁업체</th>
              <td className="px-3 py-2 border border-line">{contractor.companyName}</td>
              <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold w-[100px]">지자체</th>
              <td className="px-3 py-2 border border-line">{contractor.municipalityName ?? '—'}</td>
            </tr>
            <tr>
              <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold">사업자번호</th>
              <td className="px-3 py-2 border border-line font-mono">{contractor.businessNo}</td>
              <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold">날짜</th>
              <td className="px-3 py-2 border border-line font-mono font-bold">{formattedDate}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {(['GENERAL', 'FOOD', 'RECYCLING', 'WOOD'] as const)
            .map((cat) => summary.find((s) => s.category === cat))
            .filter((s): s is Summary => Boolean(s))
            .map((s) => (
              <div key={s.category} className="border border-line rounded-md p-3 text-center bg-slate-50">
                <div className="text-xs font-mono font-extrabold text-ink mb-1">{s.label}</div>
                <div className="font-mono font-black text-xl text-ink">
                  {s.totalTon.toFixed(3)}<span className="text-[11px] font-bold ml-0.5">t</span>
                </div>
              </div>
            ))}
          <div className="border border-accent rounded-md p-3 text-center bg-cyan-50">
            <div className="text-xs font-mono font-extrabold text-accent mb-1">합계</div>
            <div className="font-mono font-black text-xl text-accent">
              {totalWeight.toFixed(3)}<span className="text-[11px] font-bold ml-0.5">t</span>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-700 text-white">
              <th className="px-2 py-2 border border-slate-600 w-[17%]">차량번호</th>
              <th className="px-2 py-2 border border-slate-600 w-[12%]">반입시각</th>
              <th className="px-2 py-2 border border-slate-600 w-[30%]">처리시설</th>
              <th className="px-2 py-2 border border-slate-600 w-[14%]">성상</th>
              <th className="px-2 py-2 border border-slate-600 w-[15%]">중량(t)</th>
              <th className="px-2 py-2 border border-slate-600 w-[12%]">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 border border-line text-center text-slate-500 italic">
                  해당 날짜의 반입 데이터가 없습니다.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.no} className="even:bg-slate-50">
                <td className="px-2 py-1.5 border border-line font-mono">{row.vehiclePlate ?? '—'}</td>
                <td className="px-2 py-1.5 border border-line font-mono text-center">{row.intakeTime}</td>
                <td className="px-2 py-1.5 border border-line">{row.facilityName ?? <span className="text-slate-400 italic">(미지정)</span>}</td>
                <td className="px-2 py-1.5 border border-line text-center">{MATERIAL_LABEL[row.materialCategory] ?? row.materialCategory}</td>
                <td className="px-2 py-1.5 border border-line text-right font-mono font-bold">{row.weightTon.toFixed(3)}</td>
                <td className="px-2 py-1.5 border border-line text-xs">{row.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-extrabold">
                <td colSpan={4} className="px-2 py-2 border border-line text-right">합계</td>
                <td className="px-2 py-2 border border-line text-right font-mono">{totalWeight.toFixed(3)}</td>
                <td className="px-2 py-2 border border-line"></td>
              </tr>
            </tfoot>
          )}
        </table>

        <div className="mt-6 text-right text-[10px] font-mono text-slate-500">
          생성: {new Date().toLocaleString('ko-KR')} · 생성자: {generatedBy}
        </div>
      </article>
    </>
  );
}
