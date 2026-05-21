'use client';

import { useState, useEffect } from 'react';

type Session = {
  id: string;
  sessionDate: string;
  topic: string;
  content: string | null;
  department: string | null;
  facilityName: string | null;
  createdBy: string;
  signCount: number;
  signers: Array<{ id: string; name: string; employeeNo: string | null; signedAt: string }>;
};

type WorkerStat = {
  id: string; name: string; employeeNo: string | null;
  department: string | null; position: string | null;
  count: number; minutesEstimated: number; lastDate: string;
};

type HistoryData = { total: number; page: number; limit: number; sessions: Session[] };
type EduData = {
  year: number; totalWorkers: number; participantCount: number;
  totalSessions: number; workers: WorkerStat[];
};

type Tab = 'history' | 'education';

export default function TbmHistoryClient() {
  const [tab, setTab] = useState<Tab>('history');

  // TBM 활동이력 state
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [hFrom, setHFrom] = useState(thisMonth + '-01');
  const [hTo, setHTo] = useState(new Date().toISOString().slice(0, 10));
  const [hData, setHData] = useState<HistoryData | null>(null);
  const [hLoading, setHLoading] = useState(false);
  const [hError, setHError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // 교육시간현황 state
  const [eduYear, setEduYear] = useState(new Date().getFullYear());
  const [eduData, setEduData] = useState<EduData | null>(null);
  const [eduLoading, setEduLoading] = useState(false);
  const [eduError, setEduError] = useState<string | null>(null);

  function loadHistory() {
    setHLoading(true);
    setHError(null);
    fetch(`/api/tbm/history?from=${hFrom}&to=${hTo}&limit=100`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setHData(d); })
      .catch((e: Error) => setHError(e.message))
      .finally(() => setHLoading(false));
  }

  function loadEducation() {
    setEduLoading(true);
    setEduError(null);
    fetch(`/api/tbm/education-stats?year=${eduYear}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setEduData(d); })
      .catch((e: Error) => setEduError(e.message))
      .finally(() => setEduLoading(false));
  }

  useEffect(() => { loadHistory(); }, []);

  return (
    <div className="space-y-4">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3">
        <a href="/safety" className="text-xs font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-white">
          ← 안전관리
        </a>
        <a href="/print" className="text-xs font-bold text-ink-muted hover:text-ink border border-line rounded px-2 py-1 bg-slate-50">
          🖨 출력센터
        </a>
        <h2 className="text-xl font-black text-ink tracking-tight">TBM 교육 관리</h2>
      </div>

      {/* 탭 */}
      <nav className="flex gap-1 bg-surface border border-line rounded-xl p-1.5 shadow-sm">
        <button onClick={() => { setTab('history'); if (!hData) loadHistory(); }}
          className={`px-4 py-2 rounded-lg text-sm font-extrabold whitespace-nowrap transition ${tab === 'history' ? 'bg-accent text-white' : 'text-ink hover:bg-surface-soft'}`}>
          📋 TBM 활동이력
        </button>
        <button onClick={() => { setTab('education'); if (!eduData) loadEducation(); }}
          className={`px-4 py-2 rounded-lg text-sm font-extrabold whitespace-nowrap transition ${tab === 'education' ? 'bg-accent text-white' : 'text-ink hover:bg-surface-soft'}`}>
          📊 교육시간현황
        </button>
      </nav>

      {/* TBM 활동이력 탭 */}
      {tab === 'history' && (
        <div className="space-y-3">
          {/* 필터 */}
          <div className="bg-surface border border-line rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">시작일</div>
              <input type="date" value={hFrom} onChange={(e) => setHFrom(e.target.value)}
                className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">종료일</div>
              <input type="date" value={hTo} onChange={(e) => setHTo(e.target.value)}
                className="px-3 py-1.5 rounded border border-line bg-white text-sm font-mono" />
            </div>
            <button onClick={loadHistory}
              className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
              조회
            </button>
            {hData && (
              <>
                <a
                  href={`/api/tbm/history/export?from=${hFrom}&to=${hTo}`}
                  className="px-4 py-1.5 rounded text-sm font-extrabold bg-green-700 text-white hover:bg-green-800"
                >
                  📥 Excel
                </a>
                <span className="text-xs text-ink-muted ml-auto">총 {hData.total}건</span>
              </>
            )}
          </div>

          {hLoading && <div className="py-10 text-center text-slate-500 text-sm">로딩 중…</div>}
          {hError && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">{hError}</div>}

          {hData && !hLoading && (
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              {hData.sessions.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">해당 기간에 TBM 기록이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-line">
                    <tr>
                      <th className="px-4 py-2 text-left font-extrabold text-xs">날짜</th>
                      <th className="px-4 py-2 text-left font-extrabold text-xs">주제</th>
                      <th className="px-4 py-2 text-left font-extrabold text-xs hidden sm:table-cell">팀/시설</th>
                      <th className="px-4 py-2 text-left font-extrabold text-xs hidden md:table-cell">작성자</th>
                      <th className="px-4 py-2 text-center font-extrabold text-xs">서명</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {hData.sessions.map((s) => {
                      const isOpen = expanded === s.id;
                      return (
                        <>
                          <tr key={s.id} className="hover:bg-surface-soft transition">
                            <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{s.sessionDate}</td>
                            <td className="px-4 py-2 font-bold text-sm max-w-[200px] truncate">{s.topic}</td>
                            <td className="px-4 py-2 text-xs text-ink-muted hidden sm:table-cell">
                              {s.department ?? s.facilityName ?? '—'}
                            </td>
                            <td className="px-4 py-2 text-xs text-ink-muted hidden md:table-cell">{s.createdBy}</td>
                            <td className="px-4 py-2 text-center">
                              <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                                {s.signCount}명
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => setExpanded(isOpen ? null : s.id)}
                                className="text-xs text-accent font-bold hover:underline">
                                {isOpen ? '닫기' : '상세'}
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={s.id + '-detail'} className="bg-slate-50">
                              <td colSpan={6} className="px-4 py-3">
                                {s.content && (
                                  <p className="text-xs text-ink-muted mb-2 whitespace-pre-wrap">{s.content}</p>
                                )}
                                {s.signers.length > 0 && (
                                  <div>
                                    <div className="text-[11px] font-bold text-slate-600 mb-1">서명자</div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {s.signers.map((sig) => (
                                        <span key={sig.id} className="text-[11px] bg-white border border-slate-200 rounded px-2 py-0.5">
                                          {sig.name}{sig.employeeNo ? ` (${sig.employeeNo})` : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* 교육시간현황 탭 */}
      {tab === 'education' && (
        <div className="space-y-3">
          {/* 필터 */}
          <div className="bg-surface border border-line rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] font-mono font-extrabold text-slate-600 mb-1">연도</div>
              <input type="number" value={eduYear} onChange={(e) => setEduYear(Number(e.target.value))}
                min={2020} max={2100}
                className="w-24 px-3 py-1.5 rounded border border-line bg-white text-sm font-mono font-bold" />
            </div>
            <button onClick={loadEducation}
              className="px-4 py-1.5 rounded text-sm font-extrabold bg-accent text-white hover:bg-accent-strong">
              조회
            </button>
            {eduData && (
              <a
                href={`/api/tbm/education-stats/export?year=${eduData.year}`}
                className="px-4 py-1.5 rounded text-sm font-extrabold bg-green-700 text-white hover:bg-green-800"
              >
                📥 Excel
              </a>
            )}
          </div>

          {eduLoading && <div className="py-10 text-center text-slate-500 text-sm">로딩 중…</div>}
          {eduError && <div className="px-4 py-2 bg-red-50 border border-red-300 rounded text-sm text-red-700">{eduError}</div>}

          {eduData && !eduLoading && (
            <div className="space-y-3">
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'TBM 횟수', value: `${eduData.totalSessions}회` },
                  { label: '참여 인원', value: `${eduData.participantCount}명` },
                  { label: '전체 근로자', value: `${eduData.totalWorkers}명` },
                  { label: '참여율', value: eduData.totalWorkers > 0
                    ? `${Math.round(eduData.participantCount / eduData.totalWorkers * 100)}%` : '0%' },
                ].map((c) => (
                  <div key={c.label} className="bg-surface border border-line rounded-xl p-4 text-center">
                    <div className="text-[10px] font-mono font-extrabold text-slate-500 mb-1">{c.label}</div>
                    <div className="text-xl font-black text-ink">{c.value}</div>
                  </div>
                ))}
              </div>

              {/* 근로자별 테이블 */}
              <div className="bg-surface border border-line rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-line">
                  <span className="text-xs font-extrabold text-slate-600">근로자별 교육시간현황 (1회 = 10분 기준)</span>
                </div>
                {eduData.workers.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-sm">{eduData.year}년 TBM 참여 기록이 없습니다.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-line">
                      <tr>
                        <th className="px-4 py-2 text-left font-extrabold text-xs">순번</th>
                        <th className="px-4 py-2 text-left font-extrabold text-xs">성명</th>
                        <th className="px-4 py-2 text-left font-extrabold text-xs hidden sm:table-cell">직위</th>
                        <th className="px-4 py-2 text-left font-extrabold text-xs hidden md:table-cell">담당</th>
                        <th className="px-4 py-2 text-center font-extrabold text-xs">참석횟수</th>
                        <th className="px-4 py-2 text-center font-extrabold text-xs">교육시간(분)</th>
                        <th className="px-4 py-2 text-center font-extrabold text-xs hidden sm:table-cell">최근참석</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {eduData.workers.map((w, idx) => (
                        <tr key={w.id} className="hover:bg-surface-soft">
                          <td className="px-4 py-2 text-xs text-ink-muted">{idx + 1}</td>
                          <td className="px-4 py-2 font-bold text-sm">{w.name}</td>
                          <td className="px-4 py-2 text-xs text-ink-muted hidden sm:table-cell">{w.position ?? '—'}</td>
                          <td className="px-4 py-2 text-xs text-ink-muted hidden md:table-cell">{w.department ?? '—'}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="font-extrabold text-accent">{w.count}회</span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="font-bold">{w.minutesEstimated}분</span>
                          </td>
                          <td className="px-4 py-2 text-center text-xs font-mono text-ink-muted hidden sm:table-cell">
                            {w.lastDate}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
