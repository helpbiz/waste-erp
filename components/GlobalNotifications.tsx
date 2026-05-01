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
 */
import AnnouncementBanner from './AnnouncementBanner';
import ComplaintBanner from './ComplaintBanner';
import PushSubscriber from './PushSubscriber';

export default function GlobalNotifications() {
  return (
    <>
      <AnnouncementBanner />
      <ComplaintBanner />
      <PushSubscriber />
    </>
  );
}
