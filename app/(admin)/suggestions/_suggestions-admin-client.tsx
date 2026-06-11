'use client';

/**
 * 관리자 — 작업자 익명 건의함.
 *  - 통계 카드 (카테고리/부서별 평균, 만족도)
 *  - 목록 + 답변 작성 (게시판형 공개)
 *  - 부서 인원 < 3명 → 응답 시 마스킹됨 (서버 책임)
 */
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ui/Toast';

type Cat = 'WORK_ENV' | 'EQUIPMENT' | 'SAFETY' | 'MANAGEMENT' | 'WELFARE' | 'OTHER';
type Status = 'NEW' | 'REVIEWING' | 'ANSWERED' | 'ARCHIVED';

const CAT_LABEL: Record<Cat, string> = {
  WORK_ENV: '업무환경',
  EQUIPMENT: '장비/도구',
  SAFETY: '안전',
  MANAGEMENT: '관리/소통',
  WELFARE: '복지/처우',
  OTHER: '기타',
};

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  NEW:       { label: '신규',     cls: 'bg-blue-100 text-blue-800' },
  REVIEWING: { label: '검토 중',  cls: 'bg-amber-100 text-amber-900' },
  ANSWERED:  { label: '답변 완료', cls: 'bg-emerald-100 text-emerald-800' },
  ARCHIVED:  { label: '보관',     cls: 'bg-slate-100 text-ink-muted' },
};

type Item = {
  id: string;
  contractorId: string;
  category: Cat;
  satisfactionScore: number;
  content: string;
  photos: string[];
  status: Status;
  createdAt: string;
  departmentName: string | null;
  positionCode: string | null;
  replies: { id: string; content: string; createdAt: string; replierName: string; replierRole: string }[];
};

type Stats = {
  total: number;
  avgSatisfaction: number | null;
  byStatus: Record<string, number>;
  byCategory: { category: string; count: number; avgSatisfaction: number }[];
  byDepartment: {
    contractorId: string; departmentId: string;
    departmentName: string | null; masked: boolean;
    count: number; avgSatisfaction: number;
  }[];
};

export default function SuggestionsAdminClient({ canMutate, role }: { canMutate: boolean; role: string }) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<Cat | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL'>('ALL');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/suggestions', { cache: 'no-store' });
      const j = await r.json();
      setItems(j.items ?? []);
      setStats(j.stats ?? null);
    } catch {
      toast.error('목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return items.filter((i) => (filterCat === 'ALL' || i.category === filterCat) && (filterStatus === 'ALL' || i.status === filterStatus));
  }, [items, filterCat, filterStatus]);

  return (
    <div className="p-3 md:p-5 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-black text-ink">작업자 익명 건의함</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            🔒 작성자 식별 정보(userId/IP/UA)는 저장되지 않습니다. 부서 인원 3명 미만은 마스킹.
          </p>
        </div>
        <div className="text-[0.625rem] text-ink-muted font-mono">role: {role} · {canMutate ? '편집 가능' : '읽기 전용'}</div>
      </header>

      {/* 통계 */}
      {stats && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatCard label="총 건수" value={String(stats.total)} />
          <StatCard label="평균 만족도" value={stats.avgSatisfaction !== null ? `${stats.avgSatisfaction}/5` : '-'} />
          <StatCard label="신규(미열람)" value={String(stats.byStatus.NEW ?? 0)} accent="blue" />
          <StatCard label="답변 완료" value={String(stats.byStatus.ANSWERED ?? 0)} accent="emerald" />
        </section>
      )}

      {stats && stats.byCategory.length > 0 && (
        <section className="bg-surface border border-line rounded-lg p-3">
          <h2 className="text-sm font-extrabold text-ink mb-2">카테고리별</h2>
          <div className="space-y-1">
            {stats.byCategory.map((c) => (
              <div key={c.category} className="flex items-center gap-2 text-sm">
                <span className="w-20 font-bold">{CAT_LABEL[c.category as Cat] ?? c.category}</span>
                <span className="text-ink-muted">{c.count}건</span>
                <SatBar score={c.avgSatisfaction} />
                <span className="font-extrabold tabular-nums">{c.avgSatisfaction.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats && stats.byDepartment.length > 0 && (
        <section className="bg-surface border border-line rounded-lg p-3">
          <h2 className="text-sm font-extrabold text-ink mb-2">
            부서별 만족도 <span className="text-ink-muted font-normal">(낮은 순 — 즉시 개입 우선순위)</span>
          </h2>
          <div className="space-y-1">
            {stats.byDepartment.map((d) => (
              <div key={`${d.contractorId}-${d.departmentId}`} className="flex items-center gap-2 text-sm">
                <span className="w-32 font-bold truncate">
                  {d.masked ? <span className="text-ink-muted">[마스킹: 인원 &lt; 3]</span> : (d.departmentName ?? '미분류')}
                </span>
                <span className="text-ink-muted">{d.count}건</span>
                <SatBar score={d.avgSatisfaction} />
                <span className="font-extrabold tabular-nums">{d.avgSatisfaction.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap items-center bg-surface border border-line rounded-lg p-2">
        <FilterPill label="전체" active={filterCat === 'ALL'} onClick={() => setFilterCat('ALL')} />
        {(Object.keys(CAT_LABEL) as Cat[]).map((c) => (
          <FilterPill key={c} label={CAT_LABEL[c]} active={filterCat === c} onClick={() => setFilterCat(c)} />
        ))}
        <span className="mx-1 text-ink-muted">|</span>
        <FilterPill label="모든 상태" active={filterStatus === 'ALL'} onClick={() => setFilterStatus('ALL')} />
        {(Object.keys(STATUS_META) as Status[]).map((s) => (
          <FilterPill key={s} label={STATUS_META[s].label} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center text-sm text-ink-muted py-8">불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-ink-muted py-12 bg-surface-soft rounded-lg">조건에 맞는 건의가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((it) => (
            <AdminCard key={it.id} item={it} canMutate={canMutate} onChanged={load} onReplied={() => setFilterStatus('ALL')} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: 'blue' | 'emerald' }) {
  const cls = accent === 'blue' ? 'border-blue-300 bg-blue-50' : accent === 'emerald' ? 'border-emerald-300 bg-emerald-50' : 'border-line bg-surface';
  return (
    <div className={`rounded-lg border-2 px-3 py-2 ${cls}`}>
      <div className="text-[0.625rem] font-bold text-ink-muted">{label}</div>
      <div className="text-lg font-black text-ink mt-0.5">{value}</div>
    </div>
  );
}

function SatBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, (score / 5) * 100));
  const color = score >= 4 ? 'bg-emerald-500' : score >= 3 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-extrabold border ${
        active ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-surface text-ink-muted border-line'
      }`}
    >{label}</button>
  );
}

function AdminCard({ item, canMutate, onChanged, onReplied }: { item: Item; canMutate: boolean; onChanged: () => void; onReplied: () => void }) {
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  async function changeStatus(s: Status) {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/suggestions/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: s }),
      });
      if (!r.ok) { toast.error('상태 변경 실패'); return; }
      toast.success('변경됨');
      onChanged();
    } finally { setBusy(false); }
  }

  async function submitReply() {
    if (reply.trim().length < 2) { toast.error('답변을 입력해 주세요'); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/suggestions/${item.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim() }),
      });
      if (!r.ok) { toast.error('답변 등록 실패'); return; }
      toast.success('답변이 등록되었습니다');
      setReply('');
      onReplied();
      onChanged();
    } finally { setBusy(false); }
  }

  const statusM = STATUS_META[item.status];
  return (
    <article className="bg-surface rounded-xl border border-line p-3 shadow-sm">
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span className="px-2 py-0.5 rounded text-[0.625rem] font-extrabold bg-slate-100 text-ink-muted border border-slate-200">
          {CAT_LABEL[item.category] ?? item.category}
        </span>
        <span className="text-[0.625rem] font-bold text-ink-muted">만족도 {item.satisfactionScore}/5</span>
        <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-extrabold ${statusM.cls}`}>{statusM.label}</span>
        {item.departmentName && (
          <span className="text-[0.625rem] text-ink-muted">· {item.departmentName}</span>
        )}
        {item.positionCode && (
          <span className="text-[0.625rem] text-ink-muted">· {item.positionCode}</span>
        )}
        <span className="text-[0.625rem] text-ink-muted ml-auto">{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
      </div>
      <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{item.content}</p>
      {item.photos.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {item.photos.map((p, i) => (
            <button key={i} onClick={() => setLightboxSrc(p)}>
              <img src={p} alt="" className="w-20 h-20 rounded-md object-cover border border-line" />
            </button>
          ))}
        </div>
      )}

      {item.replies.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-line space-y-1.5">
          {item.replies.map((r) => (
            <div key={r.id} className="bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-2">
              <div className="text-[0.625rem] font-extrabold text-emerald-900 mb-1">
                💬 {r.replierName} ({r.replierRole}) · {new Date(r.createdAt).toLocaleString('ko-KR')}
              </div>
              <p className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">{r.content}</p>
            </div>
          ))}
        </div>
      )}

      {canMutate && (
        <div className="mt-3 pt-3 border-t border-line space-y-2">
          <div className="flex gap-1.5 flex-wrap">
            <button disabled={busy || item.status === 'REVIEWING'} onClick={() => changeStatus('REVIEWING')}
              className="px-2.5 py-1 rounded text-[0.6875rem] font-extrabold bg-amber-100 text-amber-900 border border-amber-200 disabled:opacity-50">
              검토 중으로
            </button>
            <button disabled={busy || item.status === 'ARCHIVED'} onClick={() => changeStatus('ARCHIVED')}
              className="px-2.5 py-1 rounded text-[0.6875rem] font-extrabold bg-slate-100 text-ink-muted border border-slate-200 disabled:opacity-50">
              보관
            </button>
          </div>
          <div className="flex gap-1.5 items-end">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="공식 답변 (작성자 외 회사 전체에 공개됩니다)"
              className="flex-1 text-sm border border-line rounded-md p-2 focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            />
            <button onClick={submitReply} disabled={busy}
              className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-extrabold disabled:opacity-50">
              답변 등록
            </button>
          </div>
        </div>
      )}

      {lightboxSrc && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center px-4" onClick={() => setLightboxSrc(null)}>
          <button onClick={() => setLightboxSrc(null)} className="absolute top-4 right-4 text-white text-3xl font-bold">&times;</button>
          <img src={lightboxSrc} alt="사진 크게 보기" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </article>
  );
}
