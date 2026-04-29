// Design Ref: docs/02-design/mobile-nav-revisit.md (Option C — Tab 5 + 헤더 아바타)
// Wave 4: 햄버거 제거. 자주 사용 메뉴는 탭바, 가끔 사용은 홈 그리드. 프로필은 헤더 아바타.
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTodayAttendance } from '@/lib/attendance';
import { formatHmKst } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function WorkerHomePage() {
  const session = (await readSession())!;
  const att = await getTodayAttendance(session);
  const me = att.isWorker ? att.me : null;

  /* RAPID 직책만 추천경로 카드 노출 */
  const userInfo = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: { position: { select: { code: true } } },
  });
  const isRapid = userInfo?.position?.code === 'RAPID';

  const checkedIn = !!me?.checkInTime;
  const checkedOut = !!me?.checkOutTime;
  const statusLabel = !checkedIn ? '출근 전' : checkedOut ? '근무 완료' : '근무 중';
  const statusColor = !checkedIn
    ? 'bg-white/20 text-white'
    : checkedOut
    ? 'bg-green-400/30 text-green-100'
    : 'bg-yellow-400/30 text-yellow-100';

  return (
    <div className="px-3 pt-3 pb-5 space-y-3">
      {/* 인사 카드 — 컴팩트화 (이름 잘림 + 카드 풀스크린화 해결).
          이름이 길어도 wrap 되도록 truncate 제거 + h1 사이즈 다운 + 아이콘/패딩 축소. */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-2xl px-3.5 py-3 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-cyan-100">{todayLabel()}</p>
            {/* text-2xl truncate → text-base 2줄 wrap (성+이름 모두 노출) */}
            <h1 className="text-base font-black mt-0.5 leading-tight break-keep">
              {session.name}님, 안녕하세요
            </h1>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${statusColor}`}>{statusLabel}</span>
          {checkedIn && me?.checkInTime && (
            <span className="text-xs text-cyan-50 font-semibold">
              출근 {formatHmKst(new Date(me.checkInTime))}
              {checkedOut && me.checkOutTime && (
                <> · 퇴근 {formatHmKst(new Date(me.checkOutTime))}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 기타 메뉴 그리드 — 햄버거 Drawer 대체. 가끔 사용 메뉴 1탭 진입.
          (자주 사용 메뉴는 탭바에 있음. 프로필은 헤더 아바타 클릭) */}
      <section>
        <div className="px-1 mb-1.5 text-xs font-extrabold text-ink tracking-widest">기타 메뉴</div>
        <div className="grid grid-cols-2 gap-2.5">
          {isRapid && (
            <MenuCard
              href="/worker/route"
              color="bg-cyan-600"
              title="추천경로"
              desc="기동반 전용 경로"
              iconPath="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          )}
          <MenuCard
            href="/worker/leave"
            color="bg-info"
            title="휴가 신청"
            desc="잔여 연차 · 신청"
            iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
          <MenuCard
            href="/worker/profile"
            color="bg-slate-700"
            title="내 프로필"
            desc="사진 · 서명 · 로그아웃"
            iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </div>
      </section>

      {/* 안내 카드 — 컴팩트 (text-xs, padding 축소) */}
      <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-3 py-2 text-xs text-amber-900 font-semibold leading-relaxed flex items-start gap-1.5">
        <span aria-hidden className="text-sm flex-shrink-0">🔒</span>
        <span>GPS 좌표는 PIPA 준수를 위해 ~10m 격자 라운딩 + 90일 후 자동 폐기됩니다.</span>
      </div>
    </div>
  );
}

function MenuCard({
  href,
  title,
  desc,
  color,
  iconPath,
}: {
  href: string;
  title: string;
  desc: string;
  color: string;
  iconPath: string;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border border-line rounded-2xl p-3 shadow-card flex flex-col gap-1.5 min-h-[80px] active:scale-[0.97] active:bg-surface-soft transition-transform"
    >
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center flex-shrink-0 shadow-md`}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-end">
        <div className="text-sm font-extrabold text-ink leading-tight">{title}</div>
        <div className="text-xs font-semibold text-ink-faint mt-0.5 leading-tight">{desc}</div>
      </div>
    </Link>
  );
}

function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
