'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Signer = { name: string; employeeNo: string | null; signedAt: string; signatureData: string | null };
type Session = {
  id: string;
  sessionDate: string;
  topic: string;
  content: string | null;
  photoDataUrl: string | null;
  department: string | null;
  createdBy: string;
  signCount: number;
  signers: Signer[];
};

export default function TbmPrintClient({
  yearMonth: initialYM,
  facilityId,
}: {
  yearMonth: string;
  facilityId: string;
}) {
  const router = useRouter();
  const [yearMonth, setYearMonth] = useState(initialYM);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(ym: string) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ yearMonth: ym });
    if (facilityId) params.set('facilityId', facilityId);
    fetch(`/api/tbm/monthly?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setSessions(d.sessions ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(yearMonth); }, []);

  function navigate() {
    const params = new URLSearchParams({ yearMonth });
    if (facilityId) params.set('facilityId', facilityId);
    router.push(`/safety/tbm-print?${params}`);
    load(yearMonth);
  }

  const [y, m] = yearMonth.split('-');

  return (
    <div className="space-y-4">
      {/* 컨트롤 바 */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">대상 월</div>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold"
          />
        </div>
        <button
          onClick={navigate}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong"
        >
          조회
        </button>
        <button
          onClick={() => window.print()}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700"
        >
          🖨 인쇄
        </button>
        <a href="/safety" className="px-3 py-1.5 rounded text-xs font-bold bg-white border border-line hover:bg-slate-50">
          ← 안전관리
        </a>
      </div>

      {/* 로딩/에러 */}
      {loading && <div className="py-10 text-center text-slate-500 text-sm print:hidden">로딩 중…</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700 print:hidden">{error}</div>}

      {/* 출력 영역 */}
      {!loading && (
        <div className="bg-white print:bg-white">
          <div className="border-t-4 border-double border-slate-700 pt-3 px-2">
            <h1 className="text-2xl font-black text-center mb-1">TBM 안전교육 월별 기록</h1>
            <div className="text-center text-sm font-bold text-slate-600 mb-4">{y}년 {m}월</div>

            {sessions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">해당 월에 등록된 TBM 기록이 없습니다.</div>
            ) : (
              <div>
                {sessions.map((s, idx) => {
                  const date = new Date(s.sessionDate);
                  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
                  const dd = String(date.getUTCDate()).padStart(2, '0');
                  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()];
                  return (
                    <article
                      key={s.id}
                      className={`border-2 border-slate-700 mb-6${idx > 0 ? ' print-page-break' : ''}`}
                    >
                      {/* 헤더 */}
                      <header className="bg-slate-100 border-b border-slate-700 px-3 py-2 grid grid-cols-3 gap-2 text-sm">
                        <div><span className="font-bold">날짜:</span> {y}년 {mm}월 {dd}일 ({dow})</div>
                        {s.department && <div><span className="font-bold">팀:</span> {s.department}</div>}
                        <div className="col-start-3 text-right"><span className="font-bold">등록:</span> {s.createdBy}</div>
                      </header>

                      {/* 주제 + 내용 */}
                      <div className="px-3 py-3 border-b border-slate-300 space-y-1.5 text-sm">
                        <div><span className="font-bold">주제:</span> {s.topic}</div>
                        {s.content && (
                          <div><span className="font-bold">내용:</span> <span className="whitespace-pre-wrap">{s.content}</span></div>
                        )}
                        {s.photoDataUrl && (
                          <img
                            src={s.photoDataUrl}
                            alt="TBM 사진"
                            className="mt-2 max-h-48 rounded border border-slate-300 object-contain"
                          />
                        )}
                      </div>

                      {/* 서명자 */}
                      <div className="px-3 py-2">
                        <div className="text-[11px] font-bold text-slate-600 mb-1.5">
                          ◎ 서명자 ({s.signCount}명)
                        </div>
                        {s.signers.length === 0 ? (
                          <div className="text-xs text-slate-500">서명자 없음</div>
                        ) : (
                          <div className="grid grid-cols-4 gap-x-2 gap-y-1 text-xs">
                            {s.signers.map((sig, i) => (
                              <div key={i} className="border border-slate-300 rounded px-2 py-1 text-center">
                                {sig.signatureData && (
                                  <img
                                    src={sig.signatureData}
                                    alt={sig.name}
                                    className="h-8 w-full object-contain mb-0.5"
                                  />
                                )}
                                <div className="font-bold text-[11px]">{sig.name}</div>
                                {sig.employeeNo && <div className="text-[10px] text-slate-500">{sig.employeeNo}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}

                {/* 월별 집계 */}
                <div className="border-2 border-slate-700 px-3 py-3 mb-4 text-sm">
                  <div className="font-bold mb-1.5">◎ 월별 요약</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="font-bold">총 TBM 횟수:</span> {sessions.length}회</div>
                    <div><span className="font-bold">총 서명 건수:</span> {sessions.reduce((a, s) => a + s.signCount, 0)}건</div>
                    <div><span className="font-bold">평균 서명:</span> {sessions.length > 0 ? (sessions.reduce((a, s) => a + s.signCount, 0) / sessions.length).toFixed(1) : 0}명/회</div>
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-x-1 gap-y-1 text-[10px]">
                    {sessions.map((s) => {
                      const d = new Date(s.sessionDate);
                      const dd = String(d.getUTCDate()).padStart(2, '0');
                      return (
                        <div key={s.id} className="text-center border border-slate-300 rounded py-0.5 px-1">
                          <div className="font-bold">{dd}일</div>
                          <div>{s.signCount}명</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-[10px] font-mono text-slate-600">
              출력일시: {new Date().toLocaleString('ko-KR')}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          .print-page-break { break-before: page; page-break-before: always; }
        }
      `}</style>
    </div>
  );
}
