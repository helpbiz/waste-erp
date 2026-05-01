# 🗂 CleanERP 기능 카탈로그

> 운영 중인 모든 기능을 **파일 · API · RBAC · 회사별 게이트** 단위로 매핑.
> 유지보수 시 "이 기능 어디 있지?" → 이 문서 1개로 해결.
> 마지막 갱신: 2026-05-02

---

## 🎯 핵심 도메인 (Top-Level)

| 도메인 | 메뉴 경로 | 페이지 | 주요 라이브러리 |
|---|---|---|---|
| 인증 | `/login` `/consent` | `app/(auth)/` | `lib/auth.ts`, `middleware.ts` |
| 대시보드 | `/dashboard` | `app/(admin)/dashboard/` | — |
| 민원 | `/complaints` `/worker/complaint` | 두 페이지 분리 | `lib/complaints.ts`, `lib/complaint-assign.ts` |
| 근태 | `/attendance` `/worker/punch` | 관리/입력 분리 | `lib/attendance-aggregate.ts` |
| 차량 | `/vehicles` `/live-vehicles` | 등록/실시간 분리 | — |
| 안전 | `/safety` | — | `lib/safety.ts` |
| 실적 | `/performance` | — | `lib/performance.ts` |
| 통계·보고서 | `/reports` | — | `lib/master-stats.ts` |
| 인건비 | `/payroll` | — | `lib/payroll.ts` |
| 건강 | `/health` | — | — |
| 공지사항 | `/announcements` | admin 전용 | `lib/announcement-audience.ts` |
| 슈퍼관리자 | `/super-admin` | SUPER 전용 (12 탭) | — |
| NOC | `/noc` | TV 키오스크 | — |
| 시민앱 | `/citizen` | 공개 (전화번호 식별) | — |
| 소개·매뉴얼 | `/intro` `/manual` | 공개 | — |

---

## 🆕 회사별 권한(Entitlement) 게이트 대상 — 8 기능

> 슈퍼관리자가 회사마다 ON/OFF, 또는 요금제 패키지로 일괄 적용.
> 게이트: `lib/feature-guard.ts requireFeature()` 또는 API 핸들러 내 `hasFeature()`.

### 1. `announcements` — 공지사항 시스템
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | TRIAL 이상 |
| **메뉴** | `/announcements` (admin sidebar SETTINGS) |
| **페이지** | `app/(admin)/announcements/page.tsx` |
| **클라이언트** | `app/(admin)/announcements/_announcements-client.tsx` |
| **API** | `app/api/announcements/route.ts` (GET/POST) + `[id]/route.ts` (PATCH/DELETE) |
| **모델** | `Announcement` (Prisma schema:1086) |
| **RBAC** | SUPER/CONTRACTOR/INTERNAL/MUNI 작성 가능 (audience 정책 차등) |
| **게이트** | POST 시 `hasFeature('announcements')` |
| **음성 알림** | `components/AnnouncementBanner.tsx` (root mount) |
| **사용자 설정** | `lib/voice-settings.ts` (남/여 voice 선택) |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §2 §6.2 |

### 2. `voiceTts` — 음성 알림(TTS)
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | TRIAL 이상 |
| **구현** | Web Speech API (브라우저 native, 외부 서비스 불필요) |
| **트리거** | `AnnouncementBanner` + `ComplaintBanner` 신규 감지 시 |
| **메시지** | reporter/author role 기반 자동 분기 ("회사" / "지자체") |
| **사용자 선호** | `localStorage` `cleanerp:voice-settings:v1` (남/여 + voice 명시 선택) |
| **설정 UI** | `components/VoiceSettingsModal.tsx` |
| **라이브러리** | `lib/voice-settings.ts` |
| **게이트** | 클라이언트 `enabled` 토글 (서버 게이트 없음 — 클라이언트 발화 only) |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §2 |

### 3. `complaintAutoAssign` — 민원 자동 배정
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | BASIC 이상 |
| **트리거** | `POST /api/complaints` create 직후 |
| **알고리즘** | 점수 = 부하×10 + 거리×5 − zone일치(8) → best 1명 → `assignedTo` + `status='ASSIGNED'` |
| **우선순위** | 기동반(`position.code='RAPID'`) → fallback 일반 WORKER |
| **라이브러리** | `lib/complaint-assign.ts autoAssignComplaint()` |
| **게이트** | `hasFeature('complaintAutoAssign')` 호출부에서 통과 시 실행 |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §3 |

### 4. `aiNearbyDispatch` — AI 인근 워커 추천
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | PRO |
| **트리거** | `autoAssignComplaint()` 내부 (primary 배정 후) |
| **알고리즘** | AttendanceRecord checkInLat/Lng → Haversine 거리 ≤ 2km OR `AdminDong.dongName` 매칭 zone 일치 |
| **per-user targeting** | `Announcement.targetUserId` 컬럼 (각 워커에게 1건씩) |
| **만료** | 6시간 |
| **라이브러리** | `lib/complaint-assign.ts` (broadcastNearby 분기) |
| **데이터 의존성** | AttendanceRecord GPS 수집(=`attendanceGps` ON) + AdminDong 마스터 |
| **게이트** | `autoAssign` 단계에서 `hasFeature('aiNearbyDispatch')` |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §3 §6.3 |

### 5. `recommendedRoute` — 기동반 추천 경로
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | STANDARD 이상 |
| **메뉴** | `/worker/route` (RAPID 워커만) |
| **페이지** | `app/worker/route/page.tsx` + `_worker-route-client.tsx` |
| **게이트** | `requireFeature(session, 'recommendedRoute')` (페이지 진입) |
| **클라이언트 게이트** | `worker/layout.tsx` — 메뉴 자체 숨김 |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §6.5 |

### 6. `costCalculation` — 원가 계산 / 인건비
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | BASIC 이상 |
| **메뉴** | `/payroll` (URL 직접 접근, 사이드바 미노출) |
| **페이지** | `app/(admin)/payroll/page.tsx` |
| **모델** | `CostCalculation` |
| **게이트** | `requireFeature(session, 'costCalculation')` |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §6.5 |

### 7. `vehicleTracking` — 실시간 차량 위치
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | STANDARD 이상 |
| **메뉴** | `/live-vehicles` |
| **페이지** | `app/(admin)/live-vehicles/page.tsx` + `_live-vehicles-client.tsx` |
| **지도** | Leaflet + CartoDB Positron tiles |
| **게이트** | `requireFeature(session, 'vehicleTracking')` |
| **클라이언트 게이트** | `(admin)/layout.tsx` — 메뉴 자체 숨김 |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §6.5 |

### 8. `attendanceGps` — 출퇴근 GPS
| 항목 | 값 |
|---|---|
| **카탈로그 기본** | ON |
| **요금제** | BASIC 이상 |
| **API** | `POST /api/attendance/check-in` `/check-out` |
| **저장 필드** | `AttendanceRecord.checkInLat/Lng`, `checkOutLat/Lng` |
| **게이트** | OFF 시 좌표 저장 skip (체크인 자체는 허용) |
| **AI 인근 추천 영향** | OFF 면 `aiNearbyDispatch` 의 거리 매트릭스 미작동 (zone 매칭만) |
| **세션 기록** | `04-report/2026-05-02-session-log.md` §6.5 |

---

## 🚦 슈퍼관리자 콘솔 12 탭 (`/super-admin`)

| 탭 | 컴포넌트 | 용도 |
|---|---|---|
| 지자체 관리 | `MunicipalitiesTab` | 전국 지자체 CRUD |
| 지자체 권한 매트릭스 | `PoliciesTab` | 지자체별 권한 정책 |
| 관할 거래처 일괄 조회/출력 | `AggregateTab` | 보고서 통합 출력 + 그룹 발송 |
| 회사정보·차고지 | `CompanyInfoTab` | 위탁업체 마스터 |
| GIS API 설정 | `GisConfigTab` | 외부 GIS API 키 |
| 처리시설 마스터 | `FacilitiesTab` | 처리시설 마스터 |
| 👥 사용자 (전체) | `UsersGlobalTab` | 전체 사용자 검색·잠금·PW 리셋 |
| 📊 시스템 모니터링 | `SystemStatsTab` | 활성 사용자·DB·로그인 통계 |
| 📜 감사 로그 | `AuditLogTab` | audit_log 검색·필터 |
| 🌲 조직 트리 | `OrgTreeTab` | 헬프비즈 → 지자체 → 위탁업체 |
| 🗑 위탁업체 삭제·복구 | `ContractorTrashTab` | 30일 soft-delete 휴지통 |
| 🎛 회사별 기능 권한 | `ContractorFeaturesTab` | **8 feature 매트릭스 + 4 패키지 일괄 적용** |

---

## 📡 알림 시스템

| 컴포넌트 | 위치 | 동작 |
|---|---|---|
| `GlobalNotifications` | root layout | AnnouncementBanner + ComplaintBanner + PushSubscriber wrapper |
| `AnnouncementBanner` | 글로벌 mount | 30s 폴링 → 신규 공지 감지 시 자동 팝업 + TTS + 진동 |
| `ComplaintBanner` | 글로벌 mount | 30s 폴링 → 신규 민원 감지 시 사운드 + 진동 + TTS + OS 알림 |
| `VoiceSettingsModal` | 공지 팝업 / 관리자 페이지 | 음성 ON/OFF, 남/여 토글, voice 명시 선택, 미리듣기 4종 |
| `PushSubscriber` | 글로벌 mount | Notification 권한 grant 시 SW PushManager 구독 → 서버 등록 |

### Service Worker 이벤트 (`public/sw.js`)
- `install` / `activate` — 캐시 버전 관리, skipWaiting
- `fetch` — API network-only / 정적 SWR / 페이지 network-first
- `push` — 백그라운드 OS 알림 표시 (VAPID 키 설정 후 활성)
- `notificationclick` — 알림 클릭 시 url 로 포커스/이동

---

## 🔐 RBAC 5-Tier 요약

| Role | contractorId | municipalityId | 주요 화면 | 작성권 (announcement audience) |
|---|---|---|---|---|
| SUPER_ADMIN | NULL | NULL | `/super-admin` 콘솔 + 모든 화면 | 전체 5종 (시스템 공지 포함) |
| MUNI_ADMIN | NULL | 지자체 | admin shell (GET-only + 일부 mutate 화이트리스트) | OWNER/ADMIN/ALL |
| CONTRACTOR_ADMIN | 회사 | NULL | admin shell + 회사 내부 | ADMIN/WORKER/ALL |
| INTERNAL_ADMIN | 회사 | NULL | admin shell + 회사 내부 | ADMIN/WORKER/ALL |
| WORKER | 회사 | NULL | worker shell (모바일) | (작성 불가) |

상세는 [`rbac-matrix.md`](rbac-matrix.md).

---

## 🔄 갱신 트리거

이 문서를 갱신해야 하는 시점:
- 신규 기능을 카탈로그에 추가할 때 (8 → 9 등)
- 신규 슈퍼관리자 콘솔 탭 추가 시
- 신규 메뉴 라우팅 추가 시
- 모델/API 시그니처 변경 시

본 문서는 **정확성 > 완전성** 원칙. 자세한 알고리즘은 세션 로그·원본 코드를 참조.
