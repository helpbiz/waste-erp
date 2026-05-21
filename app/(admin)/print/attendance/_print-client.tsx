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

  function handleExcel() {
    window.location.href = `/api/print/attendance-excel?ym=${ym}`;
  }

  const TITLE = `월별 출퇴근 현황 — ${year}년 ${month}월 · 총 ${rows.length}명`;
  const TOTAL_COLS = 4 + daysInMonth + 1;

  return (
    <div className="bg-white min-h-screen">
      {/* 화면 전용 컨트롤 — 인쇄 시 숨김 */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-slate-50">
        <span className="text-sm font-bold text-ink">{TITLE}</span>
        <button
          onClick={() => window.print()}
          className="ml-auto px-5 py-2 rounded-lg text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700"
        >
          🖨 인쇄
        </button>
        <button
          onClick={handleExcel}
          className="px-5 py-2 rounded-lg text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700"
        >
          📊 엑셀 출력
        </button>
        <a href="/print" className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-100 border border-line hover:bg-slate-200">
          🖨 출력센터
        </a>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-line hover:bg-slate-50"
        >
          닫기
        </button>
      </div>

      <div className="px-4 py-4 print:px-2 print:py-2">
        {/* 화면 전용 제목 — 인쇄 시 숨김 (thead 에서 반복 출력) */}
        <div className="print:hidden border-t-4 border-double border-slate-800 pt-3 mb-4">
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
                {/* 인쇄 전용 반복 타이틀 — 화면에서는 숨김 */}
                <tr className="screen-hidden">
                  <th
                    colSpan={TOTAL_COLS}
                    style={{
                      textAlign: 'center', fontWeight: 900, fontSize: '13pt',
                      padding: '6px 4px 4px', borderBottom: '2px solid #1e293b',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {TITLE}
                  </th>
                </tr>
                {/* 컬럼 헤더 */}
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

        <div className="mt-4 text-right text-[9px] font-mono text-slate-400 print:hidden">
          출력일: {new Date().toLocaleDateString('ko-KR')}
        </div>
      </div>

      <style>{`
        /* 화면에서 인쇄 전용 타이틀 행 숨기기 */
        .screen-hidden { display: none; }

        @media print {
          /* 앱 셸 전체 숨김 (햄버거·메뉴명·날짜·시스템상태·로그아웃) */
          header,
          aside,
          nav,
          [data-sidebar],
          .sidebar,
          .no-print {
            display: none !important;
          }

          /* 인쇄 전용 타이틀 행 표시 */
          .screen-hidden { display: table-row !important; }

          /* 페이지 설정 */
          @page { size: A3 landscape; margin: 8mm; }

          /* thead 가 각 페이지 상단에 반복 출력되도록 */
          thead { display: table-header-group; }

          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 8px;
            background: white !important;
          }

          /* 화면 전용 요소 숨김 */
          .print\\:hidden { display: none !important; }

          /* 컨텐츠 여백 최소화 */
          .print\\:px-2 { padding-left: 4px !important; padding-right: 4px !important; }
          .print\\:py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
        }
      `}</style>
    </div>
  );
}
