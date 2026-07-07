'use client';

function fmt(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

type Item = {
  no: number; id: string; type: string; status: string;
  description: string; locationAddress: string;
  reportedAt: string; dueDate: string | null;
  reporter: string; assignee: string | null;
  zoneName: string | null; resolveNote: string | null;
  resolvedAt: string | null; complainantPhone: string | null;
  photosBefore: string[]; photosAfter: string[];
};

export default function ComplaintsPrintClient({
  items, from, to, statusFilter,
}: {
  items: Item[]; from: string; to: string; statusFilter: string;
}) {
  return (
    <div className="bg-white min-h-screen">
      {/* 화면 전용 컨트롤 */}
      <div className="print:hidden flex items-center gap-3 px-6 py-4 border-b bg-slate-50">
        <span className="text-sm font-bold text-ink">
          민원 대장 — {from} ~ {to}
          {statusFilter ? ` · ${statusFilter}` : ' · 전체'}
          <span className="ml-3 text-ink-muted font-mono">총 {items.length}건</span>
        </span>
        <a href="/print" className="ml-auto px-4 py-2 rounded-lg text-sm font-bold bg-slate-100 border border-line hover:bg-slate-200">
          🖨 출력센터
        </a>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-line hover:bg-slate-50"
        >
          닫기
        </button>
      </div>

      {/* 인쇄 영역 */}
      <div className="px-8 py-6">
        <div className="border-t-4 border-double border-slate-800 pt-3 mb-5">
          <h1 className="text-2xl font-black text-center tracking-tight">민 원 처 리 대 장</h1>
          <div className="text-center text-sm font-bold text-slate-600 mt-1">
            조회 기간: {from} ~ {to}
            {statusFilter ? `  |  상태: ${statusFilter}` : ''}
            {'  |  '}총 {items.length}건
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-20 text-ink-muted font-bold">해당 조건의 민원이 없습니다.</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-8">No</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-14">유형</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-14">상태</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-extrabold">주소</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-extrabold min-w-[120px]">민원내용</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-28">접수일시</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-16">접수자</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-16">담당자</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-28">완료일시</th>
                <th className="border border-slate-300 px-2 py-2 text-left font-extrabold min-w-[120px]">처리 내용</th>
                <th className="border border-slate-300 px-2 py-2 text-center font-extrabold w-32">사진</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-500">{c.no}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{c.type}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{c.status}</td>
                  <td className="border border-slate-300 px-2 py-1.5">{c.locationAddress}</td>
                  <td className="border border-slate-300 px-2 py-1.5 whitespace-pre-wrap">{c.description}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-mono">{fmt(c.reportedAt)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{c.reporter}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">{c.assignee ?? '—'}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-mono">
                    {c.resolvedAt ? fmt(c.resolvedAt) : '—'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 whitespace-pre-wrap">{c.resolveNote ?? '—'}</td>
                  <td className="border border-slate-300 px-1 py-1 align-top">
                    {c.photosBefore.length > 0 && (
                      <div className="mb-1">
                        <div className="text-[0.6rem] font-bold text-slate-500 mb-0.5">접수 전</div>
                        <div className="flex flex-wrap gap-1">
                          {c.photosBefore.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt={`접수 전 ${i + 1}`} className="w-14 h-14 object-cover rounded border border-slate-200" />
                          ))}
                        </div>
                      </div>
                    )}
                    {c.photosAfter.length > 0 && (
                      <div>
                        <div className="text-[0.6rem] font-bold text-slate-500 mb-0.5">처리 후</div>
                        <div className="flex flex-wrap gap-1">
                          {c.photosAfter.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt={`처리 후 ${i + 1}`} className="w-14 h-14 object-cover rounded border border-slate-200" />
                          ))}
                        </div>
                      </div>
                    )}
                    {c.photosBefore.length === 0 && c.photosAfter.length === 0 && (
                      <span className="text-slate-300 text-[0.65rem]">없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-8 text-right text-xs font-mono text-slate-400 print:block">
          출력일: {new Date().toLocaleDateString('ko-KR')}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
