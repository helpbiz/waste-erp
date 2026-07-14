'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

type Worker  = { id: string; name: string; employeeNo: string | null };
type Signer  = { workerId: string; name: string; employeeNo: string | null; signedAt: string; signatureData: string | null };
type Session = {
  id: string; sessionDate: string; topic: string; content: string | null;
  photoDataUrl: string | null; department: string | null; createdBy: string;
  signCount: number; signers: Signer[]; audienceWorkerIds: string[] | null;
};

export default function TbmPrintClient({
  yearMonth: initialYM,
  facilityId,
}: {
  yearMonth: string;
  facilityId: string;
}) {
  const router    = useRouter();
  const [yearMonth, setYearMonth] = useState(initialYM);
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [workers, setWorkers]     = useState<Worker[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

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
        setWorkers(d.workers ?? []);
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

  function handleExcel() {
    const params = new URLSearchParams({ yearMonth });
    if (facilityId) params.set('facilityId', facilityId);
    window.location.href = `/api/print/tbm-excel?${params}`;
  }

  const [y, m] = yearMonth.split('-');
  const ymLabel = `${y}년 ${m}월`;

  return (
    <div className="space-y-4">

      {/* ── 컨트롤 바 ── */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <div className="text-sm font-mono font-extrabold text-ink-faint mb-1">대상 월</div>
          <input
            type="month" value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold"
          />
        </div>
        <button onClick={navigate}
          className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
          조회
        </button>
        <button onClick={() => window.print()}
          className="ml-auto px-5 py-1.5 rounded text-sm font-extrabold bg-emerald-600 text-white hover:bg-emerald-700">
          🖨 인쇄
        </button>
        <button onClick={handleExcel}
          className="px-5 py-1.5 rounded text-sm font-extrabold bg-blue-600 text-white hover:bg-blue-700">
          📊 엑셀 출력
        </button>
        <a href="/safety" className="px-3 py-1.5 rounded text-sm font-bold bg-white border border-line hover:bg-slate-50">
          ← 안전관리
        </a>
        <a href="/print" className="px-3 py-1.5 rounded text-sm font-bold bg-slate-100 border border-line hover:bg-slate-200">
          🖨 출력센터
        </a>
      </div>

      {loading && <div className="py-10 text-center text-ink-faint text-sm print:hidden">로딩 중…</div>}
      {error && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700 print:hidden">{error}</div>}

      {!loading && (
        <div className="bg-white print:bg-white">

          {/* 화면 전용 제목 */}
          <div className="print:hidden border-t-4 border-double border-slate-700 pt-3 px-2 mb-4">
            <h1 className="text-2xl font-black text-center underline underline-offset-4 mb-1">TBM 안전교육</h1>
            <div className="text-center text-sm font-bold text-ink-faint">{ymLabel}</div>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12 text-ink-faint text-sm">해당 월에 등록된 TBM 기록이 없습니다.</div>
          ) : (
            <div className="px-2">
              {sessions.map((s) => {
                const date = new Date(s.sessionDate);
                const mm   = String(date.getUTCMonth() + 1).padStart(2, '0');
                const dd   = String(date.getUTCDate()).padStart(2, '0');
                const dow  = DOW[date.getUTCDay()];
                const dateLabel = `${y}년 ${mm}월 ${dd}일 (${dow})`;

                /* 미서명자 계산 — 서명대상 프리셋이 있으면 그 대상만, 없으면 전사 워커 기준(기존 동작) */
                const signerIds = new Set(s.signers.map((sig) => sig.workerId));
                const sessionWorkers = s.audienceWorkerIds
                  ? workers.filter((w) => s.audienceWorkerIds!.includes(w.id))
                  : workers;
                const unsigned = sessionWorkers.filter((w) => !signerIds.has(w.id));

                return (
                  <article key={s.id} className="tbm-sheet border-2 border-slate-700 mb-6">

                    {/* 인쇄 전용 반복 헤더 */}
                    <div className="screen-hidden border-b-2 border-double border-slate-700 px-3 py-2 text-center tbm-print-header">
                      <div className="font-black underline underline-offset-2 tracking-tight" style={{ fontSize: '14pt' }}>
                        TBM 안전교육
                      </div>
                      <div className="font-bold text-ink-faint mt-0.5" style={{ fontSize: '10pt' }}>
                        {dateLabel}
                      </div>
                    </div>

                    {/* 화면용 날짜 헤더 */}
                    <header className="print:hidden bg-slate-100 border-b border-slate-700 px-3 py-2 flex justify-between items-center text-sm">
                      <div><span className="font-bold">날짜:</span> {dateLabel}</div>
                      {s.department && <div><span className="font-bold">팀:</span> {s.department}</div>}
                      <div><span className="font-bold">등록:</span> {s.createdBy}</div>
                    </header>

                    {/* 인쇄용 날짜 헤더 — 팀·등록자 포함 */}
                    <header className="screen-hidden border-b border-slate-700 px-3 py-1.5 grid grid-cols-3 gap-2 tbm-print-header">
                      <div><span className="font-bold">날짜:</span> {dateLabel}</div>
                      {s.department
                        ? <div><span className="font-bold">팀:</span> {s.department}</div>
                        : <div />}
                      <div className="text-right"><span className="font-bold">등록:</span> {s.createdBy}</div>
                    </header>

                    {/* 주제 + 내용 */}
                    <div className="px-3 py-2 border-b border-slate-300 space-y-1 tbm-body">
                      <div><span className="font-bold">주제:</span> {s.topic}</div>
                      {s.content && (
                        <div>
                          <span className="font-bold">내용:</span>{' '}
                          <span className="whitespace-pre-wrap">{s.content}</span>
                        </div>
                      )}
                      {s.photoDataUrl && (
                        <img
                          src={s.photoDataUrl}
                          alt="TBM 사진"
                          className="mt-1 max-h-40 rounded border border-slate-300 object-contain print:hidden"
                        />
                      )}
                    </div>

                    {/* 서명 현황 — 이미지 없이 인원 요약 + 미서명자만 */}
                    <div className="px-3 py-2 tbm-body">
                      <div className="font-bold mb-1.5">
                        ◎ 서명자 {s.signCount}명
                        {unsigned.length > 0 && (
                          <span className="ml-2 text-red-700">· 미서명자 {unsigned.length}명</span>
                        )}
                      </div>

                      {/* 서명자 이름 목록 (이미지 없이) */}
                      {s.signers.length > 0 && (
                        <div className="mb-1.5">
                          <span className="text-ink-faint font-semibold">서명자: </span>
                          <span>{s.signers.map((sig) => sig.name).join(', ')}</span>
                        </div>
                      )}

                      {/* 미서명자 이름만 */}
                      {unsigned.length > 0 && (
                        <div className="border border-red-300 rounded px-2 py-1.5">
                          <span className="font-bold text-red-700">미서명자: </span>
                          <span className="text-red-800">{unsigned.map((w) => w.name).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* 월별 집계 */}
              <div className="tbm-sheet-last border-2 border-slate-700 px-3 py-3 mb-4 tbm-body">
                <div className="screen-hidden border-b-2 border-double border-slate-700 -mx-3 px-3 py-2 mb-3 text-center tbm-print-header">
                  <div className="font-black underline underline-offset-2" style={{ fontSize: '14pt' }}>TBM 안전교육</div>
                  <div className="font-bold text-ink-faint mt-0.5" style={{ fontSize: '10pt' }}>{ymLabel} · 월별 요약</div>
                </div>
                <div className="font-bold mb-1.5">◎ 월별 요약</div>
                <div className="grid grid-cols-3 gap-2">
                  <div><span className="font-bold">총 TBM 횟수:</span> {sessions.length}회</div>
                  <div><span className="font-bold">총 서명 건수:</span> {sessions.reduce((a, s) => a + s.signCount, 0)}건</div>
                  <div>
                    <span className="font-bold">평균 서명:</span>{' '}
                    {sessions.length > 0
                      ? (sessions.reduce((a, s) => a + s.signCount, 0) / sessions.length).toFixed(1)
                      : 0}명/회
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-7 gap-x-1 gap-y-1" style={{ fontSize: '9pt' }}>
                  {sessions.map((s) => {
                    const d  = new Date(s.sessionDate);
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

          <div className="mt-4 text-center font-mono text-ink-faint print:hidden" style={{ fontSize: '9pt' }}>
            출력일시: {new Date().toLocaleString('ko-KR')}
          </div>
        </div>
      )}

      <style>{`
        .screen-hidden { display: none; }

        @media print {
          header, aside, nav, [data-sidebar], .sidebar { display: none !important; }
          .screen-hidden { display: block !important; }
          .print\\:hidden { display: none !important; }

          @page { size: A4 portrait; margin: 8mm; }

          /* 모든 배경색 제거 — 회색 사이드 막대 방지 */
          * { background: white !important; background-color: white !important;
              -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* 스크롤 컨테이너 해제 → 전체 내용 인쇄 */
          html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          main, section { overflow: visible !important; height: auto !important; max-height: none !important; }

          body { font-size: 9pt !important; }

          /* 글자 크기 통일 */
          .tbm-body, .tbm-body * { font-size: 9pt !important; }
          table { width: 100% !important; table-layout: fixed !important; }
          td, th { font-size: 9pt !important; }

          /* 좌우 세로 테두리 제거 */
          .tbm-sheet, .tbm-sheet-last { border-left: none !important; border-right: none !important; }

          /* 서명 그리드: 잘리지 않도록 페이지 내 유지 */
          .tbm-sheet { break-after: page; page-break-after: always; margin-bottom: 0 !important; break-inside: avoid-page; }
          .tbm-sheet:last-child { break-after: auto !important; page-break-after: auto !important; }
        }
      `}</style>
    </div>
  );
}
