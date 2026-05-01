# 🔌 CleanERP API 레퍼런스

> **112 endpoints** — 도메인별 정리. 시그니처 상세는 각 `route.ts` 파일 직접 참조.
> 마지막 갱신: 2026-05-02

> 주의: 모든 API 는 기본 `JWT 쿠키` 필수. 공개 경로는 `middleware.ts isPublic()` 참조.
> MUNI_ADMIN 의 mutate 메서드는 `isReadOnlyExempt()` 화이트리스트 외에는 자동 403.

---

## 🔐 인증 (Auth)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| POST | `/api/auth/login` | 로그인 — JWT 쿠키 발급 | 공개 |
| POST | `/api/auth/logout` | 로그아웃 | 인증 |
| GET | `/api/auth/me` | 본인 세션 조회 | 인증 |
| POST | `/api/auth/consent` | 개인정보 동의 | 인증 (consent 미진행 시 필수) |

---

## 👥 사용자 / 본인 / 워커

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET/POST | `/api/users` | 사용자 목록 / 생성 | INTERNAL+ |
| GET/PATCH/DELETE | `/api/users/[id]` | 단건 / 수정 / 삭제 | INTERNAL+ |
| GET | `/api/users/check-username` | username 중복 검사 | 공개(검증) |
| GET | `/api/users/workers` | 워커 목록 (회사 scope) | 인증 |
| GET | `/api/users/[id]/audit` | 사용자별 감사 이력 | INTERNAL+ |
| GET | `/api/users/[id]/leave-balance` | 휴가 잔여 | INTERNAL+ |
| POST | `/api/users/leave-balance/bulk` | 휴가 일괄 부여 | INTERNAL+ |
| GET | `/api/users/leave-notify` | 휴가 만료 알림 | INTERNAL+ |
| POST | `/api/users/[id]/signature` | 서명 업로드 (관리자) | INTERNAL+ |
| POST/PATCH | `/api/users/me/signature` | 본인 서명 (MUNI 도 허용) | 인증 |
| **GET** | **`/api/me/features`** | **본인 contractor 기능 상태** | **인증** |
| GET/PATCH | `/api/worker/profile` | 워커 본인 프로필 | WORKER |
| GET/POST | `/api/worker/leave` | 워커 본인 휴가 신청 | WORKER |

---

## 🏢 위탁업체 / 회사 정보

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET/POST | `/api/contractors` | 위탁업체 목록 / 생성 | SUPER + 마법사 |
| GET/PATCH/DELETE | `/api/contractors/[id]` | 단건 / 수정 / soft-delete | SUPER |
| POST | `/api/contractors/[id]/restore` | 휴지통 복원 | SUPER |
| GET/PATCH | `/api/contractor/info` | 본인 회사 정보 | CONTRACTOR_ADMIN |

---

## 📢 공지사항

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/announcements` | 공지 목록 (audience+scope+targetUser 자동 필터) | 인증 |
| POST | `/api/announcements` | 공지 작성 (audience 정책 검증) | SUPER/CONTRACTOR/INTERNAL/MUNI |
| PATCH/DELETE | `/api/announcements/[id]` | 수정 / 삭제 (canManage 분기) | 작성자 회사 또는 SUPER/MUNI broadcast |

---

## 🚨 민원 (Complaint)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/complaints` | 민원 목록 (가시범위 자동 적용) | 인증 |
| POST | `/api/complaints` | 신규 민원 등록 + autoAssign 호출 | 모든 role |
| GET/PATCH/DELETE | `/api/complaints/[id]` | 단건 / 수정 / 삭제 | 회사 매니저 |
| POST | `/api/complaints/[id]/assign` | 수동 배정 | 매니저 |
| POST | `/api/complaints/[id]/depart` | 출동 (departedAt 기록) | WORKER 본인 |
| POST | `/api/complaints/[id]/arrive` | 도착 확인 (arrivedAt) | WORKER 본인 |
| POST | `/api/complaints/[id]/start` | 처리 시작 (IN_PROGRESS) | WORKER 본인 |
| POST | `/api/complaints/[id]/complete` | 완료 (COMPLETED) | WORKER 본인 |
| POST | `/api/complaints/[id]/reject` | 반려 | 매니저 |
| POST | `/api/complaints/[id]/complete-citizen` | 시민 만족도 평가 | 공개 (전화번호 검증) |
| GET/POST | `/api/citizen/complaints` | 시민앱 민원 등록 | 공개 |
| POST | `/api/citizen/complaints/[id]/satisfaction` | 시민 만족도 | 공개 |

---

## ⏱ 근태 (Attendance)

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| POST | `/api/attendance/check-in` | 출근 (attendanceGps 게이트) | WORKER |
| POST | `/api/attendance/check-out` | 퇴근 | WORKER |
| GET | `/api/attendance/today` | 오늘 출근 현황 | 매니저 |
| GET | `/api/attendance/month/[ym]` | 월별 집계 | 매니저 |
| POST | `/api/attendance/finalize-month` | 월 마감 | 매니저 |
| POST | `/api/attendance/finalize-month/unlock` | 마감 해제 | SUPER |
| GET | `/api/attendance/[id]/history` | 조정 이력 | 매니저 |
| POST | `/api/attendance/[id]/adjust` | 시간 조정 | 매니저 |
| POST | `/api/attendance/[id]/approve` | 승인 | 매니저 |
| POST | `/api/attendance/[id]/reject` | 반려 | 매니저 |

---

## 🚛 차량 / 운행일지

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET/POST | `/api/vehicles` | 차량 목록 / 등록 | INTERNAL+ |
| GET/PATCH/DELETE | `/api/vehicles/[id]` | 단건 / 수정 / 삭제 | INTERNAL+ |
| POST | `/api/vehicles/[id]/retire` | 폐차 처리 | INTERNAL+ |
| GET/POST | `/api/vehicle-logs` | 운행일지 | 매니저 |
| POST | `/api/vehicle-logs/auto-generate` | 자동 생성 | 매니저 |
| POST | `/api/vehicle-logs/[id]/submit` | 제출 | 작성자 |
| POST | `/api/vehicle-logs/[id]/approve` | 승인 | 매니저 |
| POST | `/api/vehicle-logs/[id]/reject` | 반려 | 매니저 |

---

## 📦 폐기물 / 처리

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET/POST | `/api/waste-records` | 처리 기록 | 매니저 |
| GET | `/api/waste-records/stats` | 통계 | 매니저 |
| GET/POST | `/api/recycling-intakes` | 재활용 입고 | 매니저 |
| GET | `/api/bulky-waste/config` | 대형폐기물 설정 | INTERNAL+ |
| POST | `/api/bulky-waste/import` | 외부 시스템 import | SUPER |

---

## 🛡 안전 / 건강 / TBM / 휴가

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET/POST | `/api/safety` | 안전 보고서 | 매니저 |
| GET/POST | `/api/safety/[id]` | 단건 처리 | 매니저 |
| GET/POST | `/api/health` | 건강기록 | 매니저 |
| GET | `/api/health/records/[workerId]` | 워커별 건강 | 매니저 |
| GET | `/api/tbm/today` | 오늘 TBM | 매니저 |
| POST | `/api/tbm/sign` | TBM 서명 | 워커/매니저 |
| GET/POST | `/api/leave-requests` | 휴가 신청 | 매니저 |
| GET/POST | `/api/leave-requests/[id]` | 단건 처리 | 매니저 |
| GET | `/api/leave-requests/calendar` | 휴가 달력 | 매니저 |
| GET | `/api/leave-requests/export` | 엑셀 내보내기 | 매니저 |

---

## 📊 보고서 / 분석

| Method | Path | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/reports/master-stats` | 통합 통계 | 매니저+ |
| GET | `/api/reports/distribution/*` | 분포 시각화 (시간/요일/월/지역/만족도/...) | 매니저+ |

---

## ⚙ 슈퍼관리자 콘솔

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/super-admin/contractors-aggregate` | 거래처 일괄 |
| GET | `/api/super-admin/system-stats` | 시스템 모니터링 |
| GET | `/api/super-admin/users-global` | 전체 사용자 검색 |
| POST | `/api/super-admin/users/[id]/lock` | 사용자 잠금/해제 |
| POST | `/api/super-admin/users/[id]/reset-pw` | PW 강제 재설정 |
| GET/PATCH | `/api/super-admin/contractor-features` | **회사별 기능 권한** |
| **POST** | **`/api/super-admin/contractor-features/apply-package`** | **요금제 패키지 일괄 적용** |
| GET/POST | `/api/approval-policies` | 결재 정책 |
| GET/POST | `/api/delegations` | 위임 규칙 |
| GET/POST | `/api/departments` | 부서 |
| GET/POST | `/api/positions` | 직책 |
| GET/POST | `/api/zones` | 청소 구역 |
| GET/POST | `/api/admin-dongs` | 행정동 |
| GET/POST | `/api/treatment-facilities` | 처리시설 |

---

## 📡 알림 / WebPush

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/webpush/subscribe` | WebPush 구독 등록 |
| DELETE | `/api/webpush/subscribe?endpoint=` | 구독 해제 |

---

## 🔄 Cron (Bearer 토큰 인증, public 경로)

| Path | 주기 | 동작 |
|---|---|---|
| `/api/cron/gps-cleanup` | 매일 | 90일 경과 GPS 좌표 NULL 처리 (PIPA) |
| `/api/cron/grant-leave` | 매월 1일 | 휴가 자동 부여 |
| `/api/cron/bulky-waste-import` | 매일 | 외부 대형폐기물 데이터 import |
| `/api/cron/bulky-waste-resolve` | 매일 | 처리 완료 자동 매칭 |

---

## ☁ 외부 API (서버 사이드 fetch)

| 외부 | 사용 위치 |
|---|---|
| Nominatim (OSM) | 역지오코딩 — 좌표 → 한글 주소 |
| OpenRouteService / OSRM | 추천 경로 계산 (RAPID) |
| CartoDB Positron tiles | 지도 베이스 (CSP `*.basemaps.cartocdn.com`) |
| Tmap / Kakao / Naver Map | 워커 navigator 길안내 launcher (URL scheme) |

---

## 💡 변경 정책

이 문서는 신규 endpoint 추가 시 즉시 갱신. 권한 / 게이트가 바뀌면 같이 반영.
시그니처는 `route.ts` 가 단일 진실 소스 — 본 문서는 항해도일 뿐.
