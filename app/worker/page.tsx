import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { getTodayAttendance } from '@/lib/attendance';
import { formatHmKst } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function WorkerHomePage() {
  const session = (await readSession())!;
  const att = await getTodayAttendance(session);
  const me = att.isWorker ? att.me : null;

  const checkedIn = !!me?.checkInTime;
  const checkedOut = !!me?.checkOutTime;

  return (
    <div className="px-3 py-3 space-y-3">
      {/* 인사말 + 오늘 근무 — 1줄 컴팩트 헤더 */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-xl p-3 text-white shadow-card">
        <div className="flex items-baseline gap-2 mb-0.5">
          <h1 className="text-base font-black truncate">{session.name}님</h1>
          <span className="text-[10px] font-mono font-bold text-cyan-100 ml-auto">{todayLabel()}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-mono font-extrabold tracking-widest text-cyan-100">오늘 근무</span>
          {!checkedIn ? (
            <span className="text-base font-black">출근 전</span>
          ) : checkedOut ? (
            <span className="text-base font-black">
              근무 완료 ✓ <span className="text-xs font-mono font-bold text-cyan-100 ml-1">
                {formatHmKst(new Date(me!.checkInTime!))} → {formatHmKst(new Date(me!.checkOutTime!))}
              </span>
            </span>
          ) : (
            <span className="text-base font-black">
              근무 중 <span className="text-xs font-mono font-bold text-cyan-100 ml-1">
                출근 {formatHmKst(new Date(me!.checkInTime!))}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* 메뉴 카드 grid (컴팩트) */}
      <div className="grid grid-cols-2 gap-2">
        <MenuCard
          href="/worker/punch"
          color="bg-accent"
          title="출퇴근"
          desc="GPS 출퇴근 등록"
          iconPath="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <MenuCard
          href="/worker/complaint"
          color="bg-warn"
          title="민원 등록"
          desc="현장 민원 사진 첨부"
          iconPath="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <MenuCard
          href="/worker/safety"
          color="bg-success"
          title="안전점검"
          desc="일일 체크리스트"
          iconPath="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
        <MenuCard
          href="/worker/leave"
          color="bg-info"
          title="휴가신청"
          desc="잔여 연차 · 신청"
          iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
        <MenuCard
          href="/worker/profile"
          color="bg-slate-700"
          title="내 프로필"
          desc="사진 · 서명 · 연락처"
          iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </div>

      {/* 알림 / 안내 — 컴팩트 1줄 */}
      <div className="bg-amber-50 border border-amber-300 rounded-md px-3 py-1.5 text-[10px] text-amber-900 font-semibold leading-snug">
        🔒 GPS 좌표는 AES-256 암호화 + 6개월 자동 폐기
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
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  color: string;
  iconPath: string;
  disabled?: boolean;
}) {
  const cls = `bg-surface border border-line rounded-lg p-3 shadow-card flex items-center gap-2 ${disabled ? 'opacity-60' : 'active:scale-[0.98] cursor-pointer'} transition`;
  const body = (
    <>
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-extrabold text-ink truncate">{title}</div>
        <div className="text-[10px] font-bold text-ink-muted mt-0.5 truncate">{desc}</div>
      </div>
    </>
  );
  if (disabled) return <div className={cls}>{body}</div>;
  return (
    <Link href={href} className={cls}>{body}</Link>
  );
}

function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
