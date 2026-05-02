'use client';

/**
 * 작업자 익명 건의함.
 *
 * 익명성:
 *  - 클라가 UUID(authorToken)를 localStorage 에 보관, 서버에는 SHA-256 해시만 전송.
 *  - 토큰 분실 시 자기 글 식별 불가 (= 보강).
 *
 * 탭:
 *  1) write    — 카테고리/만족도/내용/사진 작성
 *  2) board    — 회사 전체 게시판 (관리자 답변 공개)
 *  3) mine     — 내가 쓴 글 (token 기반 표시)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { hapticSuccess, hapticError } from '@/lib/haptics';

type Cat = 'WORK_ENV' | 'EQUIPMENT' | 'SAFETY' | 'MANAGEMENT' | 'WELFARE' | 'OTHER';

const CATS: { id: Cat; label: string; color: string }[] = [
  { id: 'WORK_ENV',   label: '업무환경',   color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'EQUIPMENT',  label: '장비/도구',  color: 'bg-amber-100 text-amber-900 border-amber-200' },
  { id: 'SAFETY',     label: '안전',       color: 'bg-red-100 text-red-800 border-red-200' },
  { id: 'MANAGEMENT', label: '관리/소통',  color: 'bg-violet-100 text-violet-800 border-violet-200' },
  { id: 'WELFARE',    label: '복지/처우',  color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'OTHER',      label: '기타',       color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

type Item = {
  id: string;
  category: Cat;
  satisfactionScore: number;
  content: string;
  photos: string[];
  status: 'NEW' | 'REVIEWING' | 'ANSWERED' | 'ARCHIVED';
  createdAt: string;
  departmentName: string | null;
  positionCode: string | null;
  isMine: boolean;
  replies: { id: string; content: string; createdAt: string; replierName: string; replierRole: string }[];
};

const TOKEN_KEY = 'wci.workerSuggestion.token';
const TOKEN_HASH_KEY = 'wci.workerSuggestion.tokenHash';

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getOrCreateToken(): string {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export default function SuggestionClient() {
  const toast = useToast();
  const [tab, setTab] = useState<'write' | 'board' | 'mine'>('write');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const tokenHashRef = useRef<string>('');

  /* mount: 토큰 준비 + 해시 계산 */
  useEffect(() => {
    (async () => {
      const t = getOrCreateToken();
      const h = await sha256Hex(t);
      tokenHashRef.current = h;
      localStorage.setItem(TOKEN_HASH_KEY, h);
    })();
  }, []);

  async function loadList(mineOnly: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/worker/suggestion${mineOnly ? '?mine=1' : ''}`, {
        headers: { 'x-author-token-hash': tokenHashRef.current },
        cache: 'no-store',
      });
      const j = await res.json();
      setItems(j.items ?? []);
    } catch {
      toast.error('목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'board') loadList(false);
    if (tab === 'mine') loadList(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="px-2.5 pt-2.5 pb-6 space-y-3">
      {/* 안내 헤더 */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 px-3.5 py-3 text-white shadow-md">
        <h1 className="text-base font-black leading-tight">익명 건의함</h1>
        <p className="text-[0.6875rem] mt-1 leading-relaxed text-indigo-100 font-semibold">
          작성자 누구인지 회사·관리자도 알 수 없습니다. 부담 없이 의견을 남겨주세요.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-surface-soft p-1 rounded-lg">
        <TabBtn active={tab === 'write'} onClick={() => setTab('write')}>작성</TabBtn>
        <TabBtn active={tab === 'board'} onClick={() => setTab('board')}>게시판</TabBtn>
        <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>내 건의</TabBtn>
      </div>

      {tab === 'write' && (
        <WriteForm
          tokenHashRef={tokenHashRef}
          onSubmitted={() => {
            setTab('mine');
          }}
        />
      )}

      {tab !== 'write' && (
        <ItemList items={items} loading={loading} mineOnly={tab === 'mine'} />
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-md text-xs font-extrabold transition-colors ${
        active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
      }`}
    >
      {children}
    </button>
  );
}

function WriteForm({
  tokenHashRef,
  onSubmitted,
}: {
  tokenHashRef: React.MutableRefObject<string>;
  onSubmitted: () => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState<Cat | null>(null);
  const [score, setScore] = useState<number>(3);
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onPickPhoto(file: File) {
    if (photos.length >= 3) {
      toast.error('사진은 최대 3장입니다');
      return;
    }
    /* 간단 압축: canvas 다운스케일 maxDim 1024 */
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();
    const maxDim = 1024;
    const r = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * r);
    const h = Math.round(img.height * r);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhotos((p) => [...p, dataUrl]);
  }

  async function submit() {
    if (!category) {
      toast.error('카테고리를 선택해 주세요');
      return;
    }
    if (content.trim().length < 5) {
      toast.error('내용을 5자 이상 작성해 주세요');
      return;
    }
    setBusy(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY) ?? getOrCreateToken();
      /* 토큰 해시 동기화 (mount 비동기 race 방지) */
      if (!tokenHashRef.current) {
        tokenHashRef.current = await sha256Hex(token);
        localStorage.setItem(TOKEN_HASH_KEY, tokenHashRef.current);
      }

      const res = await fetch('/api/worker/suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          satisfactionScore: score,
          content: content.trim(),
          photos: photos.length ? photos : undefined,
          authorToken: token,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (j.error === 'feature_disabled') {
          toast.error('이 회사에서는 건의함이 비활성화되어 있습니다');
        } else {
          toast.error(j.error === 'invalid_request' ? '입력값을 확인해 주세요' : '등록 실패');
        }
        hapticError();
        return;
      }
      hapticSuccess();
      toast.success('익명으로 등록되었습니다');
      setCategory(null);
      setScore(3);
      setContent('');
      setPhotos([]);
      onSubmitted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface rounded-xl border border-line p-3 space-y-3">
      {/* 카테고리 */}
      <div>
        <label className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">카테고리</label>
        <div className="grid grid-cols-3 gap-1.5">
          {CATS.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-2 py-2 rounded-lg text-xs font-extrabold border-2 transition-all ${
                category === c.id ? `${c.color} ring-2 ring-offset-1 ring-indigo-400` : 'bg-surface text-ink-muted border-line'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* 만족도 */}
      <div>
        <label className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">
          현재 업무 만족도 <span className="text-ink-muted font-bold">(1=매우 불만 ~ 5=매우 만족)</span>
        </label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setScore(n)}
              className={`flex-1 py-3 rounded-lg text-base font-black border-2 ${
                score === n ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-surface text-ink border-line'
              }`}
              aria-label={`만족도 ${n}점`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* 내용 */}
      <div>
        <label className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">내용</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="개선이 필요한 사항, 좋은 아이디어, 어려움 등 자유롭게 작성해 주세요."
          className="w-full text-sm border-2 border-line rounded-lg p-2.5 focus:border-indigo-500 focus:outline-none"
        />
        <div className="text-[0.625rem] text-ink-muted text-right mt-0.5">{content.length}/4000</div>
      </div>

      {/* 사진 */}
      <div>
        <label className="block text-[0.6875rem] font-extrabold text-ink mb-1.5">사진 (선택, 최대 3장)</label>
        <div className="flex gap-1.5 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative">
              <img src={p} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
              <button
                onClick={() => setPhotos((arr) => arr.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[0.625rem] font-black"
                aria-label="사진 제거"
              >×</button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="w-16 h-16 rounded-md border-2 border-dashed border-line flex items-center justify-center cursor-pointer text-ink-muted">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickPhoto(f);
                  e.target.value = '';
                }}
              />
              <span className="text-xl">＋</span>
            </label>
          )}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy}
        className="w-full py-3 rounded-lg bg-indigo-600 text-white font-extrabold text-sm disabled:opacity-50 active:bg-indigo-700"
      >
        {busy ? '등록 중…' : '익명으로 등록'}
      </button>

      <div className="text-[0.625rem] text-ink-muted leading-relaxed bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
        🔒 등록 후에도 누가 작성했는지 회사·관리자가 알 수 없습니다. 본인 글을 다시 보려면 같은 디바이스의 같은 브라우저에서 접속하세요.
      </div>
    </div>
  );
}

function ItemList({ items, loading, mineOnly }: { items: Item[]; loading: boolean; mineOnly: boolean }) {
  const filtered = useMemo(() => (mineOnly ? items.filter((i) => i.isMine) : items), [items, mineOnly]);

  if (loading) return <div className="text-center text-xs text-ink-muted py-6">불러오는 중…</div>;
  if (filtered.length === 0) {
    return (
      <div className="text-center text-xs text-ink-muted py-10 bg-surface-soft rounded-lg">
        {mineOnly ? '아직 작성한 건의가 없습니다.' : '아직 등록된 건의가 없습니다.'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((it) => <ItemCard key={it.id} item={it} />)}
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const cat = CATS.find((c) => c.id === item.category);
  return (
    <article className="bg-surface rounded-xl border border-line p-3 shadow-sm">
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        {cat && <span className={`px-2 py-0.5 rounded text-[0.625rem] font-extrabold border ${cat.color}`}>{cat.label}</span>}
        <span className="text-[0.625rem] font-bold text-ink-muted">만족도 {item.satisfactionScore}/5</span>
        <StatusBadge status={item.status} />
        {item.isMine && <span className="text-[0.625rem] font-extrabold text-indigo-600">내 글</span>}
        <span className="text-[0.625rem] text-ink-muted ml-auto">{formatDate(item.createdAt)}</span>
      </div>
      <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed">{item.content}</p>
      {item.photos.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {item.photos.map((p, i) => (
            <img key={i} src={p} alt="" className="w-16 h-16 rounded-md object-cover border border-line" />
          ))}
        </div>
      )}
      {item.replies.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-line space-y-1.5">
          {item.replies.map((r) => (
            <div key={r.id} className="bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-2">
              <div className="text-[0.625rem] font-extrabold text-emerald-900 mb-1">
                💬 {r.replierName} ({r.replierRole}) · {formatDate(r.createdAt)}
              </div>
              <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function StatusBadge({ status }: { status: Item['status'] }) {
  const map: Record<Item['status'], { label: string; cls: string }> = {
    NEW:       { label: '신규',     cls: 'bg-blue-100 text-blue-800' },
    REVIEWING: { label: '검토 중',  cls: 'bg-amber-100 text-amber-900' },
    ANSWERED:  { label: '답변 완료', cls: 'bg-emerald-100 text-emerald-800' },
    ARCHIVED:  { label: '보관',     cls: 'bg-slate-100 text-slate-700' },
  };
  const m = map[status];
  return <span className={`px-1.5 py-0.5 rounded text-[0.625rem] font-extrabold ${m.cls}`}>{m.label}</span>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
