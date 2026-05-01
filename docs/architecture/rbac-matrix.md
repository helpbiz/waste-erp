# 🔐 CleanERP RBAC 매트릭스

> 5-tier 역할 × 작업 권한 한눈에. 단일 진실 소스: `lib/auth/role-route.ts`, `lib/rbac.ts`, 각 API `route.ts` 핸들러.
> 마지막 갱신: 2026-05-02

---

## 5-Tier 역할

| Role | 한글 | contractorId | municipalityId | 주 화면 | 데스크톱/모바일 |
|---|---|---|---|---|---|
| `SUPER_ADMIN` | 시스템관리자 | NULL | NULL | `/super-admin` 콘솔 + 전체 | 데스크톱 |
| `MUNI_ADMIN` | 지자체관리자 | NULL | 지자체 | admin shell (GET-only + 일부 mutate) | 데스크톱 |
| `CONTRACTOR_ADMIN` | 회사 대표 | 회사 | NULL | admin shell + 회사 내부 | 데스크톱 |
| `INTERNAL_ADMIN` | 회사 일반관리자 | 회사 | NULL | admin shell + 회사 내부 | 데스크톱 |
| `WORKER` | 근로자 | 회사 | NULL | worker shell (모바일 PWA) | 모바일 |

---

## 가시범위 / 데이터 스코프

각 도메인의 `*Where(session)` helper 가 적용:

| 도메인 | helper | SUPER | MUNI | CONTRACTOR/INTERNAL | WORKER |
|---|---|---|---|---|---|
| 민원 | `complaintWhere` | 전체 | 산하 회사 전체 | 본인 회사 | 본인 신고 OR 본인 배정 |
| 안전 | `safetyWhere` | 전체 | 산하 회사 전체 | 본인 회사 | 본인 |
| 근태 | (도메인별) | 전체 | 산하 회사 전체 | 본인 회사 | 본인 |
| 차량 | (도메인별) | 전체 | 산하 회사 전체 | 본인 회사 | 본인 운행분 |

---

## 공지사항 audience 정책

### 작성권 (POST `/api/announcements`)
| Role | 선택 가능 audience | scope |
|---|---|---|
| SUPER_ADMIN | ALL / OWNER / ADMIN / WORKER / MUNI | 시스템 전체 (둘 다 NULL) |
| MUNI_ADMIN | OWNER / ADMIN / ALL | contractorId=NULL, muniId=본인지자체 |
| CONTRACTOR_ADMIN | ADMIN / WORKER / ALL ⚠ MUNI 제외 | 본인 회사 |
| INTERNAL_ADMIN | ADMIN / WORKER / ALL ⚠ MUNI 제외 | 본인 회사 |
| WORKER | (작성 불가) | — |

### 가시성 (뷰어 → 보이는 audience)
| Role | 보이는 audience |
|---|---|
| SUPER_ADMIN | 전체 |
| CONTRACTOR_ADMIN | ALL + OWNER + ADMIN |
| INTERNAL_ADMIN | ALL + ADMIN |
| WORKER | ALL + WORKER |
| MUNI_ADMIN | ALL + MUNI |

### 가시성 scope (어느 회사 공지를 보나)
- 시스템 공지(`contractorId=null, municipalityId=null`) → 전체 사용자
- 회사 공지(`contractorId=X`) → X 회사 사용자
- 지자체 broadcast(`contractorId=null, municipalityId=Y`) → Y 지자체 산하 회사 사용자
- per-user targeted(`targetUserId=Z`) → Z 사용자만

---

## 민원 처리 권한

### `lib/complaints.ts isComplaintManager(role)`
- SUPER_ADMIN / CONTRACTOR_ADMIN / INTERNAL_ADMIN → `true` (배정·반려·완료 모두 가능)

### `canTransitionComplaint(session, complaint)`
- 매니저 → 모두 가능
- WORKER → 본인 배정건만 (start/complete)

---

## 슈퍼관리자 전용 화면 / API

| 경로 | 용도 |
|---|---|
| `/super-admin` (12 탭) | 콘솔 |
| `/super-admin/permission-print` | 권한 매트릭스 인쇄 |
| `/noc` | NOC 운영센터 |
| `POST /api/super-admin/contractor-features/apply-package` | 요금제 패키지 |
| `POST /api/super-admin/users/[id]/lock` `/reset-pw` | 사용자 잠금 / PW 리셋 |
| `GET /api/super-admin/system-stats` | 시스템 모니터링 |
| `GET /api/super-admin/audit-logs` | 감사 로그 검색 |
| `POST /api/contractors/[id]/restore` | 휴지통 복원 |
| `POST /api/attendance/finalize-month/unlock` | 월 마감 해제 |

---

## MUNI_ADMIN GET-only + 화이트리스트 (middleware.ts)

기본 MUNI 의 모든 mutate (POST/PUT/PATCH/DELETE) 는 자동 403.

### 화이트리스트 (mutate 허용)
- `POST /api/complaints` — 시민 대신 입력
- `POST /api/auth/logout` `consent` — 본인 세션
- `PATCH /api/users/me/...` — 본인 PW/사진/서명
- **`POST /api/announcements`** — 공지 작성 (2026-05-02 추가)
- **`PATCH/DELETE /api/announcements/[id]`** — 본인 지자체 broadcast 만 canManage

---

## 회사별 기능 게이트 (8 features)

서버 게이트: `lib/feature-guard.ts requireFeature(session, key)` 또는 API 핸들러 내 `hasFeature()`.
contractor 없는 사용자(SUPER/MUNI) 는 모든 게이트 자동 통과.

| Feature | 게이트 위치 | OFF 시 |
|---|---|---|
| announcements | POST `/api/announcements` | 403 + sidebar 메뉴 숨김 |
| voiceTts | (클라이언트 토글) | 음성 발화 안 함 |
| complaintAutoAssign | POST `/api/complaints` | autoAssign skip |
| aiNearbyDispatch | autoAssign 내부 | 인근 broadcast 안 함 |
| recommendedRoute | `/worker/route` 페이지 + worker layout 메뉴 | redirect `/feature-disabled` |
| costCalculation | `/payroll` 페이지 | redirect `/feature-disabled` |
| vehicleTracking | `/live-vehicles` 페이지 + admin layout 메뉴 | redirect `/feature-disabled` |
| attendanceGps | check-in/out API | 좌표 저장 skip |

---

## 시드 계정 (운영 검증)

| 계정 | role | 비고 |
|---|---|---|
| super | SUPER_ADMIN | 전체 관리 |
| muni / muni1 / muni2 | MUNI_ADMIN | 강남구 / 파주시 |
| company / company1 / company2 | CONTRACTOR_ADMIN | 회사 대표 |
| manager | INTERNAL_ADMIN | 회사 관리자 |
| worker | WORKER | 일반 근로자 |
| worker3 | WORKER + RAPID | **기동반** (추천경로·자동배정 대상) |

비밀번호: `changeme1234!`

---

## 변경 절차

신규 role · 신규 권한 추가 시:
1. `lib/auth/role-route.ts` shell 분기 갱신
2. `lib/rbac.ts canMutate()` 등 helper 갱신
3. middleware `READ_ONLY_ROLES` / `isReadOnlyExempt` 갱신
4. 본 문서 갱신
5. session log 에 결정 근거 기록
