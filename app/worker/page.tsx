// Design Ref: docs/02-design/mobile-nav-revisit.md (Option C — Tab 5 + 헤더 아바타)
// Wave 4: 햄버거 제거. 자주 사용 메뉴는 탭바, 가끔 사용은 홈 그리드. 프로필은 헤더 아바타.
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getTodayAttendance } from '@/lib/attendance';
import { formatHmKst } from '@/lib/dates';
import { hasFeature } from '@/lib/features';
import { PunchButtons } from './_punch-buttons';

export const dynamic = 'force-dynamic';

export default async function WorkerHomePage() {
  const session = (await readSession())!;
  const att = await getTodayAttendance(session);
  const me = att.isWorker ? att.me : null;

  /* RAPID 직책만 추천경로 카드 노출 */
  const userInfo = await prisma.user.findUnique({
    where: { id: BigInt(session.userId) },
    select: {
      position: { select: { code: true } },
      isComplaintManager: true,
      isNoticeManager: true,
      isPayrollManager: true,
    },
  });
  const isRapid = userInfo?.position?.code === 'RAPID';
  const isComplaintMgr = userInfo?.isComplaintManager === true;
  const isNoticeMgr = userInfo?.isNoticeManager === true;
  const isPayrollMgr = userInfo?.isPayrollManager === true;

  /* 익명 건의함 — 회사 기능 권한 게이트 */
  const suggestionEnabled = await hasFeature(session.contractorId, 'workerSuggestion');
  const payslipEnabled    = await hasFeature(session.contractorId, 'payslip');

  const checkedIn = !!me?.checkInTime;
  const checkedOut = !!me?.checkOutTime;
  const statusLabel = !checkedIn ? '출근 전' : checkedOut ? '근무 완료' : '근무 중';
  const statusColor = !checkedIn
    ? 'bg-white/20 text-white'
    : checkedOut
    ? 'bg-green-400/30 text-green-100'
    : 'bg-yellow-400/30 text-yellow-100';

  return (
    <div className="px-2.5 pt-2.5 pb-4 space-y-2.5">
      {/* 인사 카드 — 한 단계 더 컴팩트 + 이름 wrap 보장 */}
      <div className="bg-gradient-to-br from-accent to-cyan-700 rounded-xl px-3 py-2.5 text-white shadow-md">
        <div className="flex items-center justify-between mb-1.5 gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[0.6875rem] font-semibold text-cyan-100">{todayLabel()}</p>
            <h1 className="text-sm font-black mt-0.5 leading-tight break-keep">
              {session.name}님, 안녕하세요
            </h1>
          </div>
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold ${statusColor}`}>{statusLabel}</span>
          {checkedIn && me?.checkInTime && (
            <span className="text-[0.6875rem] text-cyan-50 font-semibold">
              출근 {formatHmKst(new Date(me.checkInTime))}
              {checkedOut && me.checkOutTime && (
                <> · 퇴근 {formatHmKst(new Date(me.checkOutTime))}</>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 출근 / 퇴근 버튼 */}
      <div className="bg-surface border border-line rounded-xl px-3 py-3 shadow-card">
        <div className="text-[0.6875rem] font-extrabold text-ink-muted mb-2">출퇴근 등록</div>
        <PunchButtons
          workerName={session.name}
          initial={{
            checkInTime: me?.checkInTime ? new Date(me.checkInTime).toISOString() : null,
            checkOutTime: me?.checkOutTime ? new Date(me.checkOutTime).toISOString() : null,
          }}
        />
      </div>

      {/* 기타 메뉴 그리드 — auto-fit: 화면 폭에 따라 자동 컬럼 증가
          (320~360폰=2col / 480~640tablet=3~4col / 데스크톱=5+col)
          minmax(120px, 1fr) — 카드 최소 120px 확보, 남는 공간 균등분배. */}
      <section>
        <div className="px-1 mb-1.5 text-[0.6875rem] font-extrabold text-ink tracking-widest">기타 메뉴</div>
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
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
            href="/worker/vehicle-log"
            color="bg-orange-600"
            title="차량일지"
            desc="주유 · 점검 · 정비"
            iconPath="M8 17a1 1 0 01-1-1v-1a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 01-1 1H8zm-3-4V8a2 2 0 012-2h10a2 2 0 012 2v5H5zm1-6h12v5H6V7zm2 2h2v2H8V9zm5 0h2v2h-2V9z"
          />
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
          {payslipEnabled && (
            <MenuCard
              href="/worker/payslip"
              color="bg-green-700"
              title="급여명세"
              desc="월별 급여명세 · 인쇄"
              iconPath="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
            />
          )}
          {suggestionEnabled && (
            <MenuCard
              href="/worker/suggestion"
              color="bg-indigo-600"
              title="익명 건의함"
              desc="만족도 · 개선의견 (익명)"
              iconPath="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          )}
          <MenuCard
            href="/worker/health"
            color="bg-rose-600"
            title="건강검진"
            desc="검진결과 직접 입력"
            iconPath="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
          {/* 📘 사용법 — /manual/worker 새 탭 (PWA 셸 유지) */}
          <MenuCard
            href="/manual/worker"
            color="bg-emerald-600"
            title="사용법"
            desc="처음 쓰는 분도 막힘없이"
            iconPath="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            newTab
          />
        </div>
      </section>

      {/* 관리자 기능 바로가기 — 특수 권한 부여 근로자 전용 */}
      {(isComplaintMgr || isNoticeMgr || isPayrollMgr) && (
        <section>
          <div className="px-1 mb-1.5 text-[0.6875rem] font-extrabold text-ink tracking-widest">관리자 기능</div>
          <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
            {isComplaintMgr && (
              <MenuCard
                href="/complaints"
                color="bg-orange-600"
                title="민원관리"
                desc="조회·수정·담당자 배정"
                iconPath="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            )}
            {isNoticeMgr && (
              <MenuCard
                href="/announcements"
                color="bg-emerald-600"
                title="공지사항"
                desc="작성·수정·삭제"
                iconPath="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            )}
            {isPayrollMgr && (
              <MenuCard
                href="/payroll"
                color="bg-purple-600"
                title="급여관리"
                desc="근태마감·명세서 발송"
                iconPath="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </div>
        </section>
      )}

      {/* 안내 카드 — 추가 다운 */}
      <div className="bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5 text-[0.6875rem] text-amber-900 font-semibold leading-relaxed flex items-start gap-1.5">
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
  newTab,
}: {
  href: string;
  title: string;
  desc: string;
  color: string;
  iconPath: string;
  newTab?: boolean;
}) {
  const linkProps = newTab ? { target: '_blank', rel: 'noopener' } : {};
  return (
    <Link
      href={href}
      {...linkProps}
      className="bg-surface border border-line rounded-xl p-2.5 shadow-card flex flex-col gap-1 min-h-[64px] active:scale-[0.97] active:bg-surface-soft transition-transform"
    >
      <div className={`w-7 h-7 rounded-md ${color} flex items-center justify-center flex-shrink-0 shadow-md`}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-end">
        <div className="text-sm font-extrabold text-ink leading-tight">{title}</div>
        <div className="text-[0.6875rem] font-semibold text-ink-faint mt-0.5 leading-tight">{desc}</div>
      </div>
    </Link>
  );
}

function todayLabel() {
  const d = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
