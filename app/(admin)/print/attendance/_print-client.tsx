'use client';

type DayRecord = { checkIn: string | null; checkOut: string | null };
type WorkerRow = {
  workerId: string; name: string; employeeNo: string;
  department: string; days: (DayRecord | null)[]; attendCount: number;
};

export default function AttendancePrintClient({
  ym, year, month, daysInMonth, dayHeaders, rows,
}: {
  ym: string; year: number; month: number;
  daysInMonth: number; dayHeaders: string[];
  rows: WorkerRow[];
}) {
  const SUN = 0, SAT = 6;
  const getDow = (day: number) => new Date(year, month - 1, day).getDay();

  return (
    <div className="bg-white min-h-screen">
      {/* 화면 전용 컨트롤 */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-slate-50">
        <span className="text-sm font-bold text-ink">
          월별 출퇴근 대장 — {ym} ({rows.length}명)
        </span>
        <button
          onClick={() => window.print()}
          className="ml-auto px-5 py-2 rounded-lg text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700"
        >
          🖨 인쇄
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-line hover:bg-slate-50"
        >
          닫기
        </button>
      </div>

      <div className="px-4 py-6">
        <div className="border-t-4 border-double border-slate-800 pt-3 mb-5">
          <h1 className="text-xl font-black text-center tracking-tight">월별 출퇴근 현황</h1>
          <div className="text-center text-sm font-bold text-slate-600 mt-1">
            {year}년 {month}월 · 총 {rows.length}명
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="text-center py-20 text-ink-muted font-bold">등록된 근로자가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-[9px] border-collapse min-w-full">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-1.5 py-1 text-center font-extrabold w-5 whitespace-nowrap">No</th>
                  <th className="border border-slate-300 px-1.5 py-1 text-left font-extrabold whitespace-nowrap">부서</th>
                  <th className="border border-slate-300 px-1.5 py-1 text-left font-extrabold whitespace-nowrap">성명</th>
                  <th className="border border-slate-300 px-1.5 py-1 text-left font-extrabold whitespace-nowrap">사번</th>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const dow = getDow(i + 1);
                    return (
                      <th key={i} className={`border border-slate-300 px-0.5 py-1 text-center font-extrabold w-10 ${
                        dow === SUN ? 'text-red-600 bg-red-50' : dow === SAT ? 'text-blue-600 bg-blue-50' : ''
                      }`}>
                        <div>{i + 1}</div>
                        <div className="font-normal">{dayHeaders[i]}</div>
                      </th>
                    );
                  })}
                  <th className="border border-slate-300 px-1.5 py-1 text-center font-extrabold whitespace-nowrap">출근일수</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.workerId} className={idx % 2 === 1 ? 'bg-slate-50/60' : ''}>
                    <td className="border border-slate-300 px-1 py-1 text-center text-slate-400">{idx + 1}</td>
                    <td className="border border-slate-300 px-1 py-1 whitespace-nowrap">{r.department}</td>
                    <td className="border border-slate-300 px-1 py-1 font-bold whitespace-nowrap">{r.name}</td>
                    <td className="border border-slate-300 px-1 py-1 font-mono whitespace-nowrap">{r.employeeNo}</td>
                    {r.days.map((d, i) => {
                      const dow = getDow(i + 1);
                      const isWeekend = dow === SUN || dow === SAT;
                      return (
                        <td key={i} className={`border border-slate-300 px-0.5 py-1 text-center ${
                          isWeekend ? 'bg-slate-100/60' : ''
                        } ${d?.checkIn ? '' : 'text-slate-300'}`}>
                          {d?.checkIn ? (
                            <div>
                              <div className="text-green-700 font-bold leading-tight">{d.checkIn}</div>
                              <div className="text-slate-500 leading-tight">{d.checkOut ?? '—'}</div>
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 px-1 py-1 text-center font-extrabold text-accent">
                      {r.attendCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 text-right text-[9px] font-mono text-slate-400">
          출력일: {new Date().toLocaleDateString('ko-KR')}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 8mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8px; }
        }
      `}</style>
    </div>
  );
}
