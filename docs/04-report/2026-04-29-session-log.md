# 2026-04-29 세션 작업 기록

> CleanERP 운영 + 신규 기능 + cross-tenant 안전성 강화. 단일 세션 내 다수 commit, 영역 분류 정리.

---

## Executive Summary

| 영역 | 신규/수정 | 주요 결과 |
|---|---|---|
| 로그인·UX | 12개 명세 항목 + 보안 | 부제·아이콘·SSL뱃지·환영 오버레이·계정잠금(5회/10분)·아이디 기억(default-on) |
| 모바일 반응형 | 글로벌 폰트 정책 | root font `clamp(17px,5vw,28px)` 화면 폭 비례 자동 스케일 |
| 한글 줄바꿈 | 전역 CSS | `word-break: keep-all` body 일괄 적용 |
| 자동 입력 | 신규 lib | 한국 전화번호 자동 하이픈, 사업자번호 체크디지트, 아이디 unique 검사 |
| 민원 | 자동경로탐색 Phase 1+2 | 카카오/네이버/T맵 런처 + 출동/도착 timestamp KPI |
| 보고서 | 분포 시각화 | 시간/요일/월/지역(행정동)/위탁업체/만족도/처리성과 + 워커 KPI Top 10 |
| 슈퍼관리자 | 마법사 + Phase 2 메뉴 | 5단계 위탁업체 개설 위저드 / 사용자(전체) / 시스템 모니터링 / 감사 로그 / 조직 트리 / 휴지통 |
| Multi-tenant 보안 | MUNI cross-tenant leak 차단 | 용산구 MUNI가 강남구 데이터까지 보던 버그 fix + lib/scopes.ts 신규 |
| 그룹 발송 | 신규 | 거래처 다중선택 → 이메일 mailto BCC / SMS 클립보드 |

---

## 영역별 상세 (commit 시간순 → 영역 재정렬)

### A. 모바일 반응형 + 타이포그래피

| Commit | 변경 |
|---|---|
| 840d35e, f67c11c, c118640 | root font 점진 확대 (18→32px) |
| 0e949b3 | text-[Npx] → text-[Nrem] 일괄 변환 (38 파일 / 417 위치) |
| c45839e | 작은 폰(320~380px) 화면 축소 fluid sizing |
| f86add7 | root 36px 영향 차단 — 로그인 절대 px 스코프 |
| 1abb4fd | post-login 36→32px |
| 82e06da | 워커 홈 인사 카드 풀스크린화 + 이름 잘림 |
| 0b72509 | auto-fit 반응형 그리드 (워커 + 대시보드) |
| 3540bef | **root `clamp(17px, 5vw, 28px)` — 폭 비례 자동 스케일** |
| 04ba803 | 한글 `word-break: keep-all` 전역 |
| ff74d6d | 스크롤바 폭 8→14px + Firefox 지원 |

### B. 로그인 화면 (12개 항목 + 보안)

| Commit | 변경 |
|---|---|
| db5918a | **12 항목 일괄 적용**: 부제 / 사용자·자물쇠 아이콘 / `#0E9F8E` CTA + boxShadow / 로딩 spinner / 화살표 / 아이디 X / 공용 PC 안내 / 풀 카피라이트 / `v1.0.0` / 관리자 문의 / SSL 뱃지 / a11y `<label sr-only>` / 환영 오버레이 1.2s |
| 916f082 | **#9 계정 잠금**: 5회 실패 시 10분 lockedUntil. AuditLog `LOGIN_FAILED/LOCKED` |
| fed75e0 | 아이디 기억하기 default-on |

### C. 자동 입력 + 검증 헬퍼

| 신규 lib | 기능 |
|---|---|
| `lib/phone.ts` `formatKoreanPhone` | 02/010/070 자동 하이픈, 11자 cap. 모든 type=tel input 자동 적용 |
| `lib/business-no.ts` `formatBusinessNo` + `validateBusinessNo` | 사업자번호 3-2-5 자동 + 국세청 체크디지트 modulo 알고리즘 |
| `lib/use-username-check.ts` | 350ms debounce username 중복 검사 + 5개 추천 칩 |
| `lib/nav-launch.ts` | 카카오/네이버/T맵 URL 스킴 + localStorage 선호도 |
| `lib/permission-presets.ts` | 권한 매트릭스 프리셋 3종 (표준/모니터링/전체) |
| `lib/scopes.ts` | **multi-tenant 가시범위 헬퍼 (MUNI cross-tenant 방지)** |

### D. 민원 + 자동경로탐색

| Commit | 변경 |
|---|---|
| fb85734 | 지도 표시 — leaflet 마커 로컬 자산 (CSP unpkg 제거) |
| b74f6d9 | **Phase 1**: NavButtons 컴포넌트 — 카카오/네이버/T맵 3종 런처 + 선호 저장 |
| 9ab34b6 | NavSettingCard — RAPID 경로 페이지에서 사전 선택 |
| 8a6fe18 | **Phase 2 KPI**: Complaint.departedAt / arrivedAt 추가, /api/complaints/[id]/depart + /arrive, sendBeacon 자동 호출, 보고서 KPI 3종 + 워커 Top 10 |

### E. 보고서 분포 시각화

| Commit | 변경 |
|---|---|
| 03d6cb8 | 민원 분포 8종: byHour(24h) / byWeekday(7d) / byMonth / byArea / byContractor / 만족도 1~5★ / 처리성과 (avg/overdue/urgent/unassigned) |
| 947eba9 | extractKoreanArea — 행정동까지 추출 (광역+시군구+동읍면) |
| 726a379 | 통합/개별 보고서 — `?contractorId` 파라미터 + UI dropdown |
| 726a379, b23645b | 모든 보고서 결재란 hide |

### F. 슈퍼관리자 콘솔 — Phase 1 위저드

설계서: `docs/specs/08_역할권한_설계서.md` §8 Q1~Q7 결정 기반.

| Commit | 변경 |
|---|---|
| 5bfd970 | **P1-3**: 5단계 신규 위탁업체 개설 마법사 (회사정보 → 지자체 → 권한프리셋 → 회사관리자 → CSV) |
| 46eaa5e | **P1-1·2·4·5**: PolicyEditModal 프리셋 버튼 / `/super-admin/permission-print` 인쇄 페이지 / SetupChecklist (자동3+수동5) / CSV 일괄 import + 클립보드 복사 |
| 4c8cad9 | 사업자번호 자동 하이픈 + 체크디지트 / 지자체 자동완성 우선순위 + 키보드 ↑↓Enter |
| 614e8e8 | SUSPENDED 지자체(264곳) 검색 안 되던 버그 — `?status=ACTIVE` 필터 제거 + 위탁업체 등록 시 자동 ACTIVE 승급 |
| 0872808 | 클립보드 복사 다단 fallback (HTTPS / execCommand / 수동 textarea) |

### G. 슈퍼관리자 콘솔 — Phase 2 메뉴 4종

| Commit | 변경 |
|---|---|
| 6b6fe5a | **4개 신규 탭**: 👥 사용자 (전체) / 📊 시스템 모니터링 / 📜 감사 로그 / 🌲 조직 트리 |
| 1779289 | 감사 로그 회사·지자체 컬럼 + 필터 |
| b7567cb | **§8 Q4=B 30일 soft-delete**: Contractor.deletedAt + 휴지통 탭 + 복구 + 영구삭제 |
| 0576117 | 신규 사용자 등록 모달 — MUNI_ADMIN/CONTRACTOR_ADMIN/INTERNAL_ADMIN/WORKER 모두 등록 |
| 83d07af | 아이디 unique 자동 검사 + 5개 추천 칩 + 복사 버튼 다단 fallback |
| b23645b | **거래처 그룹 발송**: 체크박스 다중 선택 + 이메일 mailto BCC + SMS 클립보드 |

### H. Multi-tenant 안전성 (CRITICAL)

| Commit | 변경 |
|---|---|
| f98e8ee | **MUNI 동의 forbidden 무한루프 fix** — middleware isReadOnlyExempt에 `/api/auth/consent` + `/api/users/me/*` 화이트리스트 |
| 726a379 | **CRITICAL: MUNI cross-tenant leak**: 용산구 MUNI가 강남구 데이터까지 조회되던 버그 |

CRITICAL 진단:
- `/api/reports/master-stats` `contractorScope()` 함수에 MUNI 분기 누락
- 8곳에서 `cWhere.contractorId ? ... : {}` 패턴 사용 → MUNI 시 무필터 → 모든 회사 leak
- `attendance/page.tsx` 도 동일 패턴 (`session.contractorId || undefined`)

해결:
- `lib/scopes.ts` 신규 — `contractorScopeWhere(session)` 공통 헬퍼
- master-stats 8곳을 `...scopeContractorIdField` 일괄 spread로 교체
- attendance/page.tsx → `userScope` + `contractorScopeWhere` 사용

### I. UX 일관성

| Commit | 변경 |
|---|---|
| 9248946·1fd54b0·22e9bd5·aff8206 | 처리실적 입력박스 vw 비례 + 저장 버튼 viewport 보장 |
| c7fb368 | formatKoreanPhone 전 영역 일괄 적용 (users/health/citizen/worker) |
| 138f162 | sw.js + manifest.json no-cache 헤더 — 즉시 SW 갱신 보장 |

---

## §8 의사결정 7건 (확정 + 반영 commit)

| # | 질문 | 답 | 반영 |
|---|---|---|---|
| Q1 | CONTRACTOR_ADMIN이 직원 등록 가능? | **B** 가능 | 5bfd970 위저드는 SUPER가 1명만, 이후는 CONTRACTOR가 |
| Q2 | 한 사람이 여러 회사 소속? | **A** 1인 1회사 | schema 그대로 |
| Q3 | MUNI_ADMIN 다중 지자체? | **A** 1인 1지자체 | 신규 사용자 등록 모달 단일 선택 |
| Q4 | 회사 데이터 삭제? | **B** 30일 soft-delete | b7567cb Contractor.deletedAt + 휴지통 |
| Q5 | CONTRACTOR_ADMIN 권한 매트릭스 수정? | **A** 불가 | API permission SUPER 한정 유지 |
| Q6 | 신규 회사 마법사? | **B** 위저드 1개 통합 | 5bfd970 5단계 모달 |
| Q7 | MUNI_ADMIN 셀프 가입? | **A** SUPER 발급 | 0576117 모달은 SUPER만 호출 가능 |

---

## DB 스키마 변경

| Model | 필드 | 용도 |
|---|---|---|
| User | `failedLoginAttempts Int @default(0)` | 계정 잠금 카운트 |
| User | `lockedUntil DateTime?` | 5회 실패 시 10분 잠금 |
| Complaint | `departedAt DateTime?` | 워커 출동 (NavButtons 클릭 시 sendBeacon) |
| Complaint | `arrivedAt DateTime?` | 워커 도착 ([📍 도착 확인] 버튼) |
| Contractor | `deletedAt DateTime?` | 30일 soft-delete |

모두 `prisma db push` 적용 완료 (`cleanerp_prod`).

---

## 신규 API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/complaints/[id]/depart` | 출동 timestamp 기록 (멱등) |
| POST | `/api/complaints/[id]/arrive` | 도착 timestamp 기록 (멱등) |
| POST | `/api/contractors/[id]/restore` | soft-delete 복구 |
| GET | `/api/super-admin/users-global` | 전체 사용자 검색 |
| POST | `/api/super-admin/users/[id]/lock` | 사용자 잠금/해제 |
| POST | `/api/super-admin/users/[id]/reset-pw` | 임시 PW 재설정 (1회 노출) |
| GET | `/api/super-admin/system-stats` | 시스템 모니터링 (DB·로그인·잠금) |
| GET | `/api/super-admin/audit-log` | 감사 로그 검색 (회사·지자체 필터) |
| GET | `/api/super-admin/org-tree` | 조직 트리 (헬프비즈→지자체→업체→직원) |
| GET | `/api/users/check-username` | username 중복 검사 + 추천 |

확장된 API: `/api/super-admin/contractors-aggregate` (MUNI_ADMIN 권한 추가 + contact info 응답)

---

## SW 캐시 진행 (v25 → v42, 17버전)

| 버전 | 핵심 변경 |
|---|---|
| v25 | remember-default-on |
| v26 | nav-launch (Phase 1) |
| v27 | nav-kpi (Phase 2) |
| v28 | nav-setting-card |
| v29 | onboarding-wizard |
| v30 | phase1-complete |
| v31 | phase2-complete |
| v32 | wizard-improvements |
| v33 | muni-suspended |
| v34 | clipboard-fallback |
| v35 | audit-org-cols |
| v36 | soft-delete |
| v37 | create-user-modal |
| v38 | username-livecheck |
| v39 | muni-consent-fix |
| v40 | scrollbar-wide |
| v41 | muni-tenant-fix |
| v42 | broadcast |

---

## 미완료 / 후속 작업

### 즉시 권장 (다음 세션)
- [ ] `/contractors-overview` 페이지 신설 — MUNI_ADMIN admin 메뉴에서 직접 접근
- [ ] 일일처리실적 탭에도 contractor 선택기 추가 (master-stats와 동일 UX)
- [ ] **MUNI 대시보드** — 위탁업체 전체 모니터링 + 업체명 클릭 시 세부 페이지 (사용자 요청)
- [ ] 다른 admin 페이지 MUNI scope audit (vehicles/users/live-vehicles 등) — leak 가능성 점검

### 중기 (인프라 + 사업)
- [ ] 외부 SMS API 연동 (Aligo / NHN Cloud / AWS SNS) — 발신번호 등록 + 비용 발생
- [ ] 외부 SMTP / SendGrid 연동 — mailto 대신 백엔드 직접 발송
- [ ] 30일 경과 contractor 자동 hard-delete cron (현재 수동만 가능)
- [ ] §9 Phase 3: 요금제·청구 / Staging 환경 / soft-delete 자동화

### Nice-to-have
- [ ] 위저드 단계 5(CSV) 에서 QR PDF 자동 생성 (`qrcode` 패키지)
- [ ] CONTRACTOR_ADMIN의 자기 회사 삭제 요청 워크플로우

---

## 운영 가이드

### 외부 검증 절차 (반복 패턴)
1. `git push origin main` 후 docker compose --build app
2. PWA 강제 갱신: DevTools Application → Service Workers → Unregister → F5
3. 또는 모바일 PWA: 앱 완전 종료 후 재실행
4. SW가 v42로 갱신되면 모든 변경 반영

### 접속 경로
- 운영: `https://wci.helpbiz.kr/login`
- LAN 직접: `http://192.168.1.20:3001/login` (HTTPS 우회 — clipboard 등 일부 기능 제약)
- localhost: `http://localhost:3001/login`

### 진단 명령
```bash
# 컨테이너 상태
docker ps --filter name=cleanerp-app

# DB 직접
docker exec cleanerp-postgres psql -U cleanerp cleanerp_prod -c "SELECT ..."

# 빌드 검증 (특정 문자열 청크 포함 여부)
docker exec cleanerp-app sh -c "find /app/.next/static/chunks -name '*.js' | xargs grep -l '검증할 문자열' | head"

# 로그
docker logs cleanerp-app --tail 50
```

---

## 참고 문서
- [docs/specs/08_역할권한_설계서.md](../specs/08_역할권한_설계서.md) — Role 5단계 + Phase 1/2/3 + §8 의사결정
- [prisma/schema.prisma](../../prisma/schema.prisma) — DB 스키마 (User/Complaint/Contractor 변경 반영)
- [middleware.ts](../../middleware.ts) — MUNI 화이트리스트 + 인증 + ACME

---

> **세션 완료 — 47 commits / 17 SW versions / 5 DB columns / 10 신규 API.**
> Phase 1 + Phase 2 완료, Phase 3 + MUNI 대시보드 + cross-tenant audit 후속 작업 권장.
