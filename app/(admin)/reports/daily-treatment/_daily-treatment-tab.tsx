// Design Ref: §5.1.3 — /reports 일일 처리실적 일보 탭
// Plan SC: 임의 일자 선택 → 미리보기 → 5초 내 PDF 다운로드
'use client';

import { useEffect, useMemo, useState } from 'react';

type ReportData = {
  header: {
    contractor: { id: string; companyName: string; businessNo: string; logoUrl: string | null };
    municipality: { id: string; name: string; code: string } | null;
    date: string;
  };
  summary: { category: string; label: string; totalTon: number }[];
  rows: Array<{
    no: number;
    vehiclePlate: string | null;
    intakeTime: string;
    facilityName: string | null;
    materialCategory: string;
    weightTon: number;
    note: string | null;
  }>;
  totals: { weightTon: number };
  meta: { generatedAt: string; generatedBy: { id: string; name: string } };
};

const MATERIAL_LABEL: Record<string, string> = {
  GENERAL: '생활',
  FOOD: '음식물',
  RECYCLING: '재활용',
  WOOD: '대형폐기물',
};

export default function DailyTreatmentTab({ role }: { role: string }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(todayStr);
  const [data, setData] = useState<ReportData | null>(null);
  const [contractorId, setContractorId] = useState<string>('');
  const [contractorOpts, setContractorOpts] = useState<{ id: string; companyName: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* SUPER_ADMIN/MUNI_ADMIN: 위탁업체 선택 가능 */
  const needsContractorPicker = role === 'SUPER_ADMIN' || role === 'MUNI_ADMIN';

  useEffect(() => {
    if (!needsContractorPicker) return;
    fetch('/api/contractors?active=true')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        const opts = (j.items ?? []).map((c: { id: string; companyName: string }) => ({
          id: c.id,
          companyName: c.companyName,
        }));
        setContractorOpts(opts);
        if (opts.length > 0 && !contractorId) setContractorId(opts[0].id);
      })
      .catch(() => undefined);
  }, [needsContractorPicker]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({ date });
      if (needsContractorPicker && contractorId) params.set('contractorId', contractorId);
      const r = await fetch(`/api/reports/daily-treatment?${params}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = await r.json();
      setData(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (needsContractorPicker && !contractorId) return;
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [date, contractorId]);

  function downloadPdf() {
    const params = new URLSearchParams({ date });
    if (needsContractorPicker && contractorId) params.set('contractorId', contractorId);
    window.location.href = `/api/reports/daily-treatment/pdf?${params}`;
  }

  const formattedDate = useMemo(() => {
    const d = new Date(date + 'T00:00:00');
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return `${date} (${dayName})`;
  }, [date]);

  return (
    <div className="space-y-4">
      {/* 컨트롤 */}
      <div className="bg-surface border border-line rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f02-date" className="block text-xs font-mono font-extrabold text-slate-600 mb-1">대상 일자</label>
          <input
            id="f02-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-md border-2 border-line text-sm font-mono font-bold focus:outline-none focus:border-accent min-h-[44px]"
          />
        </div>
        {needsContractorPicker && (
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="f02-contractor" className="block text-xs font-mono font-extrabold text-slate-600 mb-1">위탁업체</label>
            <select
              id="f02-contractor"
              value={contractorId}
              onChange={(e) => setContractorId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border-2 border-line text-sm font-bold bg-surface focus:outline-none focus:border-accent min-h-[44px]"
            >
              {contractorOpts.length === 0 && <option value="">— 선택 —</option>}
              {contractorOpts.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-extrabold hover:bg-cyan-800 disabled:opacity-50 min-h-[44px]"
        >
          {loading ? '조회 중…' : '🔍 조회'}
        </button>
        <button
          onClick={downloadPdf}
          disabled={!data || data.rows.length === 0}
          className="ml-auto px-5 py-2 rounded-md bg-emerald-700 text-white text-sm font-extrabold hover:bg-emerald-800 disabled:opacity-50 min-h-[44px]"
        >
          📄 PDF 다운로드
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-md px-4 py-3 text-sm font-bold text-red-700">
          오류: {error === 'template_not_found'
            ? '양식 템플릿이 등록되지 않았습니다. (시드 미실행)'
            : error === 'no_contractor_scope'
              ? '위탁업체가 지정되지 않았습니다.'
              : error}
        </div>
      )}

      {!data && !error && !loading && (
        <div className="bg-surface border border-line rounded-lg p-12 text-center text-sm text-ink-muted font-bold">
          일자를 선택하면 자동 조회됩니다.
        </div>
      )}

      {data && (
        <article className="bg-white border-t-4 border-double border-slate-700 p-6 print:p-0 print:border-none">
          {/* 양식 헤더 */}
          <header className="border-b-2 border-slate-900 pb-3 mb-4 flex items-end gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-black text-center mb-2">일일 처리실적 일보</h2>
            </div>
          </header>
          <table className="w-full border-collapse text-sm mb-4">
            <tbody>
              <tr>
                <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold w-[100px]">위탁업체</th>
                <td className="px-3 py-2 border border-line text-sm">{data.header.contractor.companyName}</td>
                <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold w-[100px]">지자체</th>
                <td className="px-3 py-2 border border-line text-sm">{data.header.municipality?.name ?? '—'}</td>
              </tr>
              <tr>
                <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold">사업자번호</th>
                <td className="px-3 py-2 border border-line text-sm font-mono">{data.header.contractor.businessNo}</td>
                <th className="bg-slate-100 px-3 py-2 border border-line text-left text-xs font-extrabold">날짜</th>
                <td className="px-3 py-2 border border-line text-sm font-mono font-bold">{formattedDate}</td>
              </tr>
            </tbody>
          </table>

          {/* 합계 카드 — 사용자 요청 2026-04-29: 순서 (생활→음식물→재활용→대형폐기물→합계),
              글자 진하게 + 1폰트 업 (label 10→12px+bold, value 18→20px). */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
            {(['GENERAL', 'FOOD', 'RECYCLING', 'WOOD'] as const)
              .map((cat) => data.summary.find((s) => s.category === cat))
              .filter((s): s is NonNullable<typeof s> => Boolean(s))
              .map((s) => (
                <div key={s.category} className="border border-line rounded-md p-3 text-center bg-slate-50">
                  <div className="text-xs font-mono font-extrabold text-ink mb-1">{s.label}</div>
                  <div className="font-mono font-black text-xl text-ink">{s.totalTon.toFixed(3)}<span className="text-xs font-bold ml-0.5">t</span></div>
                </div>
              ))}
            <div className="border border-accent rounded-md p-3 text-center bg-cyan-50">
              <div className="text-xs font-mono font-extrabold text-accent mb-1">합계</div>
              <div className="font-mono font-black text-xl text-accent">{data.totals.weightTon.toFixed(3)}<span className="text-xs font-bold ml-0.5">t</span></div>
            </div>
          </div>

          {/* 테이블 — 사용자 요청 2026-04-29: 번호 컬럼 삭제 + 비고 컬럼 폭 축소 (20% → 12%).
              번호 5% 제거 + 비고 8% 축소 = 13% 여유분을 차량번호/반입시각/처리시설/성상/중량에 분배. */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-sidebar text-white">
                <th className="px-2 py-2 border border-sidebar w-[17%]">차량번호</th>
                <th className="px-2 py-2 border border-sidebar w-[12%]">반입시각</th>
                <th className="px-2 py-2 border border-sidebar w-[30%]">처리시설</th>
                <th className="px-2 py-2 border border-sidebar w-[14%]">성상</th>
                <th className="px-2 py-2 border border-sidebar w-[15%]">중량(t)</th>
                <th className="px-2 py-2 border border-sidebar w-[12%]">비고</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 border border-line text-center text-slate-500 italic">
                    반입 데이터가 없습니다.
                  </td>
                </tr>
              )}
              {data.rows.map((row) => (
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
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-extrabold">
                  <td colSpan={4} className="px-2 py-2 border border-line text-right">합계</td>
                  <td className="px-2 py-2 border border-line text-right font-mono">{data.totals.weightTon.toFixed(3)}</td>
                  <td className="px-2 py-2 border border-line"></td>
                </tr>
              </tfoot>
            )}
          </table>

          <div className="mt-6 text-right text-xs font-mono text-slate-500">
            생성: {new Date(data.meta.generatedAt).toLocaleString('ko-KR')} · 생성자: {data.meta.generatedBy.name}
          </div>
        </article>
      )}
    </div>
  );
}
