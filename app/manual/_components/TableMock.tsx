import type { ReactNode } from 'react';

/** 데스크톱 데이터 테이블 목업 — 헤더 + 행. 행 highlighted로 step 강조. */
export default function TableMock({
  headers,
  rows,
}: {
  headers: string[];
  rows: { cells: ReactNode[]; highlighted?: boolean }[];
}) {
  return (
    <div className="mock-table">
      <div className="mock-table-row mock-table-head">
        {headers.map((h) => <div className="mock-table-cell" key={h}>{h}</div>)}
      </div>
      {rows.map((r, i) => (
        <div className="mock-table-row" key={i} data-highlighted={r.highlighted}>
          {r.cells.map((c, j) => <div className="mock-table-cell" key={j}>{c}</div>)}
        </div>
      ))}
    </div>
  );
}
