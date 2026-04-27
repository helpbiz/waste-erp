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
    <div className="px-4 py-5 space-y-4">
      {/* 인사말 */}
      <div className="px-1">
        <h1 className="text-2xl font-black text-ink tracking-tight">안녕하세요, {session.name}님</h1>
        <p className="text-sm font-semibold text-ink-muted mt-1">{todayLabel()}</p>
      </div>

      {/* 오늘 근무 카드 */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-2xl p-5 text-white shadow-card">
        <div className="text-xs font-mono font-extrabold tracking-widest text-cyan-100 mb-2">오늘 근무</div>
        {!checkedIn ? (
          <>
            <div className="text-2xl font-black mb-1">출근 전</div>
            <div className="text-sm font-semibold text-cyan-100">하단 [출퇴근] 탭에서 출근을 등록해 주세요.</div>
          </>
        ) : checkedOut ? (
          <>
            <div className="text-2xl font-black mb-1">근무 완료 ✓</div>
            <div className="font-mono font-bold text-cyan-100">
              {formatHmKst(new Date(me!.checkInTime!))} → {formatHmKst(new Date(me!.checkOutTime!))}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-black mb-1">근무 중</div>
            <div className="font-mono font-bold text-cyan-100">
              출근 {formatHmKst(new Date(me!.checkInTime!))} · 퇴근 미등록
            </div>
          </>
        )}
      </div>

      {/* 4개 메뉴 카드 */}
      <div className="grid grid-cols-2 gap-3">
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

      {/* 알림 / 안내 */}
      <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 rounded-md px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed">
        <strong className="font-extrabold">개인정보 동의 안내</strong> · 출퇴근 GPS 좌표는 개인정보보호법에 따라 별도 동의 후 AES-256으로 저장되며, 6개월 후 자동 폐기됩니다.
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
  const cls = `bg-surface border border-line rounded-xl p-4 shadow-card flex flex-col gap-2 ${disabled ? 'opacity-60' : 'active:scale-[0.98] cursor-pointer'} transition`;
  const body = (
    <>
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div>
        <div className="text-[15px] font-extrabold text-ink">{title}</div>
        <div className="text-[11px] font-bold text-ink-muted mt-0.5">{desc}</div>
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
