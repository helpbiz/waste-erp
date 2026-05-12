'use client';

/**
 * 글로벌 알림 마운트 — 모든 화면 공통.
 *
 * 사용자 요청 2026-05-02: "어떤 화면을 보고있던 자동으로 팝업 노출".
 *
 * - root layout 에 1회만 마운트
 * - 두 banner 는 fetch 실패(401) 시 silent → 비로그인 화면(login/reset/citizen) 자동 no-op
 * - 인증된 페이지(admin/worker/noc/dashboard 등) 어디서나 동일한 폴링·팝업·TTS 동작
 *
 * 이전: admin shell + worker shell 에 각각 마운트 → /noc 같은 shell 외부 페이지 미커버.
 *
 * NOC 예외 (사용자 결정 2026-05-02):
 *   /noc 풀스크린 관제에서는 AnnouncementBanner 가 화면 점유·잔류해 시야 방해.
 *   해당 경로에서만 공지 배너 미표시. ComplaintBanner(민원 도착)는 관제 본분이라 유지.
 */
import { usePathname } from 'next/navigation';
import AnnouncementBanner from './AnnouncementBanner';
import ComplaintBanner from './ComplaintBanner';
import ApprovalBanner from './ApprovalBanner';
import PushSubscriber from './PushSubscriber';

export default function GlobalNotifications() {
  const pathname = usePathname();
  const suppressAnnouncement = pathname?.startsWith('/noc') ?? false;

  return (
    <>
      {!suppressAnnouncement && <AnnouncementBanner />}
      <ComplaintBanner />
      <ApprovalBanner />
      <PushSubscriber />
    </>
  );
}
