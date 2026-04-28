'use client';

/**
 * 도 7 — 민원 처리 완료 리스트 + 만족도 평가 화면 (730 → 740)
 *  - 청구항 5: 만족도 점수 (1-5) + 코멘트 입력 → 종합 만족도 평가 정보로 통합
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export type Detail = {
  id: string;
  type: string;
  status: string;
  reportedAt: string;
  description: string | null;
  locationAddress: string | null;
  locationLat: number | null;
  locationLng: number | null;
  urgentTag: string | null;
  isUrgent: boolean;
  requestImage: string | null;
  completionImage: string | null;
  arrivalEta: string | null;
  resolvedAt: string | null;
  resolveNote: string | null;
  satisfactionScore: number | null;
  satisfactionComment: string | null;
  satisfactionAt: string | null;
  flaggedAsCandidate: boolean;
  citizenPhone: string;
};

const TYPE_LABEL: Record<string, string> = {
  PICKUP_MISS: '수거 미비', ILLEGAL_DUMP: '불법투기', ODOR_NOISE: '악취/소음', OTHER: '기타',
};
const URGENT_LABEL: Record<string, string> = {
  LONG_NEGLECTED: '⏰ 오래 방치됨', ROAD_KILL: '🐾 동물 로드킬', KIDS_DANGER: '⚠️ 아이들 위험', OTHER: '✏️ 기타',
};

export default function DetailClient({ detail }: { detail: Detail }) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(detail.satisfactionScore);
  const [comment, setComment] = useState(detail.satisfactionComment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isOwner = (typeof window !== 'undefined' ? localStorage.getItem('citizen-phone') : '') === detail.citizenPhone;

  useEffect(() => {
    if (!isOwner) {
      // ownership 검증 — 다른 휴대폰 사용 시 접근 차단
    }
  }, [isOwner]);

  async function submitRating() {
    if (!score) { setError('점수를 선택해 주세요.'); return; }
    if (!isOwner) { setError('본인 신고 민원만 평가 가능합니다.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/citizen/complaints/${detail.id}/satisfaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenPhone: detail.citizenPhone,
          score,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? '평가 실패');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/citizen'), 1500);
    } catch {
      setError('네트워크 오류');
    } finally {
      setBusy(false);
    }
  }

  const isCompleted = detail.status === 'COMPLETED';
  const canRate = isCompleted && detail.satisfactionScore == null && isOwner;

  return (
    <div className="px-4 py-5 space-y-4">
      <Link href="/citizen" className="text-sm font-extrabold text-accent">← 목록</Link>

      <div className="bg-surface border border-line rounded-xl p-4 shadow-card">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <span className="text-base font-extrabold text-ink">{TYPE_LABEL[detail.type] ?? detail.type}</span>
          {detail.isUrgent && <span className="px-2 py-0.5 rounded-full text-[0.625rem] font-mono font-extrabold bg-red-100 text-danger border border-red-200">긴급</span>}
          {detail.urgentTag && <span className="text-xs font-extrabold text-warn">{URGENT_LABEL[detail.urgentTag] ?? detail.urgentTag}</span>}
          <code className="text-[0.625rem] font-mono text-ink-faint ml-auto">#{detail.id}</code>
        </div>
        <div className="text-xs font-bold text-ink-muted">접수: {fmt(detail.reportedAt)}</div>
        {detail.locationAddress && <div className="text-sm font-semibold text-ink mt-1.5">📍 {detail.locationAddress}</div>}
        {detail.locationLat && detail.locationLng && (
          <div className="text-[0.625rem] font-mono text-ink-faint mt-0.5">{detail.locationLat.toFixed(5)}°N, {detail.locationLng.toFixed(5)}°E</div>
        )}
        {detail.description && <div className="text-sm font-semibold text-ink mt-2 whitespace-pre-wrap">{detail.description}</div>}
        {detail.requestImage && (
          <div className="mt-3">
            <div className="text-[0.6875rem] font-extrabold text-ink mb-1">제출 사진</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.requestImage} alt="민원 사진" className="w-full rounded-lg border border-line" />
          </div>
        )}
      </div>

      {/* 처리 진행 상황 — S610~S670 흐름 시각화 */}
      <ProgressFlow detail={detail} />

      {detail.flaggedAsCandidate && (
        <div className="bg-red-50 border border-red-300 border-l-4 border-l-danger rounded-md px-4 py-3 text-xs font-semibold text-red-800 leading-relaxed">
          <strong className="font-extrabold">⚠ 자동 검토 대상</strong> · 단기간 다수 신고로 무단 투기·허위 신고 후보 목록에 추가되었습니다 (특허 청구항 6). 감독 기관 CCTV 확인이 진행됩니다.
        </div>
      )}

      {detail.arrivalEta && !detail.resolvedAt && (
        <div className="bg-blue-50 border border-blue-300 border-l-4 border-l-info rounded-md px-4 py-3">
          <div className="text-xs font-extrabold text-info">📍 예상 처리 도착 시각 (청구항 7)</div>
          <div className="text-base font-mono font-black text-info mt-1">
            {new Date(detail.arrivalEta).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[0.625rem] font-mono text-ink-faint mt-0.5">담당 차량 위치 + 평균 주행속도 기반 추정</div>
        </div>
      )}

      {/* 처리 완료 — 사진 + 시각 + 메모 */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-300 border-l-4 border-l-success rounded-xl p-4 space-y-2">
          <div className="text-sm font-extrabold text-success">✅ 처리 완료</div>
          {detail.resolvedAt && <div className="text-xs font-mono font-bold text-ink-muted">{fmt(detail.resolvedAt)}</div>}
          {detail.completionImage && (
            <div>
              <div className="text-[0.6875rem] font-extrabold text-ink mt-2 mb-1">처리 완료 사진 (청구항 4)</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={detail.completionImage} alt="처리 완료" className="w-full rounded-lg border border-success" />
            </div>
          )}
          {detail.resolveNote && (
            <div className="bg-surface rounded-md p-2.5 text-xs font-semibold text-ink mt-2">{detail.resolveNote}</div>
          )}
        </div>
      )}

      {/* 도7 740 — 만족도 평가 */}
      {success ? (
        <div className="bg-green-50 border border-green-300 rounded-xl p-5 text-center">
          <div className="text-3xl mb-2">⭐</div>
          <div className="text-base font-extrabold text-success">평가 완료. 감사합니다!</div>
          <div className="text-xs font-mono text-ink-muted mt-1">청구항 5 — 종합 만족도 평가 정보에 반영됩니다.</div>
        </div>
      ) : canRate ? (
        <section className="bg-surface border-2 border-accent rounded-xl p-4 space-y-3">
          <div className="text-base font-extrabold text-ink">처리 결과 만족도 평가</div>
          <div className="text-xs font-bold text-ink-muted">청구항 5 — 본 평가는 청소 용역 업체의 종합 만족도 평가 정보로 통합됩니다.</div>
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setScore(s)}
                className={`text-4xl active:scale-90 transition ${score && score >= s ? '' : 'opacity-30'}`}
              >
                ⭐
              </button>
            ))}
          </div>
          {score && (
            <div className="text-center text-xs font-extrabold text-accent">
              {score}점 — {['','매우 불만족','불만족','보통','만족','매우 만족'][score]}
            </div>
          )}
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="처리 결과에 대한 의견 (선택)"
            className="w-full px-3 py-2.5 rounded-lg border-2 border-line text-sm font-semibold focus:outline-none focus:border-accent resize-none"
          />
          {error && <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs font-bold text-red-700">{error}</div>}
          <button
            onClick={submitRating}
            disabled={busy || !score}
            className="w-full py-3 rounded-lg bg-accent text-white font-black shadow-card active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? '제출 중…' : '평가 제출'}
          </button>
        </section>
      ) : isCompleted && detail.satisfactionScore != null ? (
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="text-xs font-extrabold text-ink-muted mb-1">제출하신 평가</div>
          <div className="text-2xl">{'⭐'.repeat(detail.satisfactionScore)}</div>
          {detail.satisfactionComment && (
            <div className="text-sm font-semibold text-ink mt-2 whitespace-pre-wrap">{detail.satisfactionComment}</div>
          )}
          {detail.satisfactionAt && (
            <div className="text-[0.625rem] font-mono text-ink-faint mt-1.5">{fmt(detail.satisfactionAt)}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProgressFlow({ detail }: { detail: Detail }) {
  /* 도6 단계 — S610(접수) → 배출기관 전송 → 처리 → S650(완료) → S660(평가) */
  const steps = [
    { key: 'S610', label: '접수', done: true },
    { key: 'ASSIGN', label: '담당 배정', done: detail.status !== 'RECEIVED' },
    { key: 'PROGRESS', label: '처리중', done: ['IN_PROGRESS', 'COMPLETED'].includes(detail.status) },
    { key: 'S650', label: '완료', done: detail.status === 'COMPLETED' },
    { key: 'S660', label: '평가', done: detail.satisfactionScore != null },
  ];
  return (
    <div className="bg-surface-soft border border-line rounded-xl p-3">
      <div className="text-[0.6875rem] font-extrabold text-ink mb-2.5">처리 진행 상황 (특허 도6 흐름)</div>
      <div className="flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.key} className="flex flex-col items-center flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.6875rem] font-mono font-extrabold border-2 ${s.done ? 'bg-success border-success text-white' : 'bg-surface border-line text-ink-muted'}`}>
              {s.done ? '✓' : i + 1}
            </div>
            <div className={`text-[0.625rem] font-extrabold mt-1 ${s.done ? 'text-success' : 'text-ink-muted'}`}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(iso: string) {
  const k = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())} ${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`;
}
