/**
 * 회사별 기능 비활성 안내 — 게이트 차단 시 redirect 대상.
 * raw 403 대신 사용자 친화 페이지로 안내.
 */
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { getFeatureMeta } from '@/lib/features';

export const dynamic = 'force-dynamic';

export default async function FeatureDisabledPage({ searchParams }: { searchParams: { feature?: string } }) {
  const session = await readSession();
  const featureKey = searchParams.feature ?? '';
  const meta = getFeatureMeta(featureKey);

  const homeHref = !session ? '/login' : session.role === 'WORKER' ? '/worker' : '/dashboard';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-cyan-50 flex items-center justify-center p-6">
      <div className="max-w-[520px] w-full bg-white rounded-2xl shadow-xl border border-line p-8 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-xl font-black text-ink mb-2">이 기능은 현재 사용할 수 없습니다</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          {meta ? (
            <>
              요청하신 <span className="font-extrabold text-purple-700">{meta.label}</span> 기능이 회사 요금제에 포함되어 있지 않습니다.
            </>
          ) : (
            <>요청하신 기능이 회사 요금제에 포함되어 있지 않습니다.</>
          )}
        </p>
        {meta && (
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">{meta.description}</p>
        )}

        <div className="mt-6 px-4 py-3 rounded-lg bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900 text-left leading-relaxed">
          💡 기능 활성화는 <span className="font-extrabold">슈퍼관리자(헬프비즈)</span> 에 문의해 주세요.
          요금제 패키지 업그레이드 후 즉시 사용 가능합니다.
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href={homeHref}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-cyan-800 text-white text-sm font-extrabold shadow-md active:scale-95"
          >
            🏠 메인으로
          </Link>
          <button
            onClick={() => { if (typeof window !== 'undefined') window.history.back(); }}
            className="px-4 py-2 rounded-lg border-2 border-line bg-white hover:bg-slate-50 text-slate-700 text-sm font-bold active:scale-95"
            type="button"
          >
            ← 이전 화면
          </button>
        </div>

        {meta && (
          <div className="mt-5 text-[0.6875rem] font-mono text-slate-400">
            feature key: {meta.key}
          </div>
        )}
      </div>
    </main>
  );
}
