// Design Ref: docs/02-design/mobile-ux-overhaul.md §9.3 + pm-research §8 홈 메뉴 적용
// Wave 3-A: Bento 대시보드 + 16px+ 타이포 + 56dp+ 메뉴 카드 + 명확한 근무 상태 pill
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
  const statusLabel = !checkedIn ? '출근 전' : checkedOut ? '근무 완료' : '근무 중';
  const statusColor = !checkedIn ? 'bg-white/20 text-white' : checkedOut ? 'bg-green-400/30 text-green-100' : 'bg-yellow-400/30 text-yellow-100';

  return (
    <div className="px-4 pt-4 pb-6 space-y-4">
      {/* 인사 카드 — 그라데이션 + 근무 상태 pill (Bento 메인) */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-2xl px-5 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-cyan-200">{todayLabel()}</p>
            <h1 className="text-xl font-black mt-0.5 truncate">{session.name}님, 안녕하세요</h1>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${statusColor}`}>
            {statusLabel}
          </span>
          {checkedIn && me?.checkInTime && (
            <span className="text-sm text-cyan-100 font-medium">
              출근 {formatHmKst(new Date(me.checkInTime))}
              {checkedOut && me.checkOutTime && (
                <> · 퇴근 {formatHmKst(new Date(me.checkOutTime))}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 메뉴 카드 grid 2열 — Bento 패턴, min-h-[100px] 큰 터치 타겟 */}
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
          desc="현장 사진 첨부"
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
          title="휴가 신청"
          desc="잔여 연차 · 신청"
          iconPath="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </div>

      {/* 안내 카드 — 12px 이상 가독성 보장 */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-xs text-amber-900 font-semibold leading-relaxed flex items-start gap-2">
        <span aria-hidden className="text-base flex-shrink-0">🔒</span>
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
      className="bg-surface border border-line rounded-2xl p-4 shadow-card flex flex-col gap-2 min-h-[100px] active:scale-[0.97] active:bg-surface-soft transition-transform"
    >
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0 shadow-md`}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-end">
        <div className="text-[15px] font-extrabold text-ink leading-tight">{title}</div>
        <div className="text-xs font-bold text-ink-muted mt-0.5 leading-tight">{desc}</div>
      </div>
    </Link>
  );
}

function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
