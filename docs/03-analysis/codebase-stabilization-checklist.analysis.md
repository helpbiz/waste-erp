---
template: analysis
feature: codebase-stabilization-checklist
date: 2026-07-20
author: review (bkit:enterprise-expert + bkit:code-analyzer + bkit:qa-strategist 상담)
project: waste-erp (Clean ERP)
---

# "바이브 코딩 프로젝트 안정화" 체크리스트 검토 — waste-erp 적용성 분석

> **배경**: 2026-07-20 서버 이관(wci.helpbiz.kr → cleanerp.kr) 완료 직후, 본격 상용화 단계 진입을 앞두고 외부에서 받은 일반론적 "바이브 코딩 유지보수 체크리스트"를 검토. 실제 코드베이스 실측 + 에이전트 3인(enterprise-expert/code-analyzer/qa-strategist) 상담 결과를 종합함.

---

## 0. 결론 요약

체크리스트의 큰 방향(문서화·SRP분리·테스트·AI컨텍스트)은 **원칙적으로 맞지만, 이 프로젝트에 대해서는 전제 진단이 두 군데 틀렸다.**

| 체크리스트 전제 | 실제 | 판정 |
|---|---|---|
| "문서가 없으면 개선도 불가능" (사양서 역추적 필요) | `docs/01-plan/02-design/03-analysis/04-report` + `docs/architecture/{api-reference,data-model,feature-catalog,rbac-matrix}.md` 이미 존재 | **전제 틀림** — 역추적보다 기존 문서 리프레시가 맞는 처방 |
| "회귀테스트·CI/CD 파이프라인 구축 필요" (전무 가정) | Playwright E2E 11개 spec + axe-core + `.github/workflows/{e2e,deploy}.yml` 이미 가동 중 | **부분 틀림** — E2E/CI는 있음, **유닛테스트만** 없음 |
| "UI/로직/데이터가 한 파일에 섞여있을 확률 높음" | `_users-client.tsx`(2986줄), `_super-admin-client.tsx`(2907줄) 등 6개 파일 전수 확인 결과 전부 해당 | **전제 맞음** — 가장 시급한 항목은 유지 |
| "AI 컨텍스트 관리 파일 없음" | `CLAUDE.md` 등 프로젝트 루트 AI 컨텍스트 파일 전혀 없음 | **전제 맞음** |

**체크리스트에 빠진 진짜 공백** (enterprise-expert 지적): 백업/복구 **검증**(백업이 도는지가 아니라 실제 복원되는지), 관측성/알림(에러 발생 시 사람이 아는 방법), 그리고 CLAUDE.md 자체.

---

## 1. 1단계 검토 — 코드 자산화 및 리팩토링

### 1-(a) 리버스 엔지니어링 사양서 역추적 → **스킵 권고**

이미 `docs/architecture/` 4종 문서가 존재. 다만 전부 **2026-05-02 이후 갱신 안 됨** — 당시 `rbac-matrix.md`엔 "super-admin 5탭"으로 적혀 있는데 현재 코드 기준 12탭으로 늘어나 있어 **2.5개월+ drift**가 실측 확인됨(그 사이 딜러채널, 근태정정, 반입엑셀 등 다수 기능 추가). 사양서를 처음부터 새로 뽑을 필요는 없고, **기존 4개 문서를 현재 코드 기준으로 리프레시**하는 것이 훨씬 저비용·고효율.

### 1-(b) SRP 분리 → **가장 시급, 실제로 심각함 (code-analyzer 확인)**

6개 대형 client 컴포넌트(`users` 2986줄, `super-admin` 2907줄, `attendance`/`complaints`/`vehicles`/`vehicle-log` 700~1300줄대) **전부**에서 "god-file" 패턴 확인: 파일 하나에 컴포넌트 15~25개, 각 서브컴포넌트가 `useState`(폼)+`useEffect+fetch`(로드)+`useMemo`(계산)+JSX(렌더)+`onClick` 인라인 `fetch`(저장)를 전부 한 함수 안에서 처리.

**우선순위별 실행안**(난이도 낮은 순, 1인 운영 기준 한 사이클 1~2개 권장):

| 순위 | 작업 | 근거 |
|---|---|---|
| P1 | 엑셀 다운로드 훅 중복 제거 → `hooks/useExcelDownload()` | `attendance:48`, `complaints:179`, `vehicles:97`에 동일 로직 복붙, 저위험·즉시효과 |
| P2 | 공용 UI 프리미티브(`Modal/Section/Field/Stat/Badge`) `components/ui/`로 통합 | 파일마다 재선언됨(users:2817-2965 등), 이동만으로 수백 줄 감소 |
| P3 | 순수 계산함수 `lib/`로 분리 | `daysBetween`(users:2983), `parseRouteDetail`(vehicle-log:1243), `translateVehicleLogError`(vehicle-log:1249) 등. 부작용 없어 분리 즉시 유닛테스트 가능. `formatPhone`(users:2975)은 기존 `lib/phone`과 **중복 — 삭제 대상** |
| P4 | 탭별 파일 분리(`_tabs/RegisterTab.tsx` 등) | 기계적 작업, import만 변경, 저위험 |
| P5 | 데이터+상태를 `hooks/`로 추출(`useMunicipalities()` 등) | 가장 근본적 SRP 개선, 로직 이해 필요하므로 P4 이후 |

부수 발견: `attendance:819`에 죽은 코드 `_PendingApprovalModal_REMOVED` 잔존 — 정리 대상.

**적정 페이스** (enterprise-expert): 1인 운영 기준 **주 1개 파일, 목표 500~800줄 상한**. 2900줄 파일을 한 번에 갈아엎지 말 것 — 회귀 위험이 상용화 초기 안정성보다 커짐.

---

## 2. 2단계 검토 — 자동화된 테스트 환경

### 이미 있는 것
- Playwright E2E 11개 spec(mobile-responsive, visual-regression, a11y, login-flow, tab-modal, tenant-isolation, dealer-channel 등)
- axe-core 접근성 자동검증
- GitHub Actions `e2e.yml`(자동 실행) + `deploy.yml`(서버B 자동배포)

→ "CI/CD 파이프라인 구축"은 이미 완료된 항목. **체크리스트를 그대로 따르면 이미 있는 걸 새로 만들자는 낭비가 생김.**

### 진짜 공백: 유닛테스트 0건

E2E는 "화면이 뜨는가/권한이 막히는가"는 잡지만 **계산식 자체의 경계값 오류는 구조적으로 못 잡는다** — 실제로 근태·급여·반입량 계산 로직에 대한 유닛테스트나 과거 회귀 이력이 전무함(qa-strategist 조사: `docs/04-report`, `session-notes` 전체 검색 결과 "계산 오류" 사고 이력 0건 — 과거 P0는 전부 RBAC/테넌트격리 문제였음. **"한 번도 검증된 적 없다"는 사실 자체가 리스크 신호**).

**유닛테스트 우선순위(금전·법적 리스크 순)**:

| 순위 | 대상 | 파일:라인 | 리스크 |
|---|---|---|---|
| 1 | 근태 월 집계(연장/야간/결근일수) | `lib/attendance-aggregate.ts:45-48, 51-143, 192` | 급여 산정 근거 + 근로기준법 준수 증빙 — 오류 시 임금 미지급/과지급 |
| 2 | 야간근로 시간 계산(자정 넘김) | `lib/payroll-policy.ts:48-84` (`calcNightHours`) | 자정 전후 오프셋(-1440/0/1440) 계산 — 전형적 경계값 실수 지점 |
| 3 | 지각 판정 임계값 | `lib/dates.ts:26-28` (`isLateCheckIn`) | 근태상태칩(지각/조기 등) 직결, 인사평가 근거 |
| 4 | 반입량 집계·반올림 | `app/api/recycling-intake/stats/route.ts:42-67`, `app/api/reports/master-stats/route.ts:336,347-472` | 지자체 정산 근거, 근태보다 발생빈도 낮음 |

**우선순위 밖(=지금은 테스트 불필요)**: 급여 실지급액(`payslip/prefill/route.ts:120-138`은 기본급·수당·공제 전부 관리자 수기입력, 자동계산 로직 자체가 없음), 딜러 수수료(코드 미구현) — **테스트할 로직이 아직 존재하지 않음.**

**도구 추천**: **Vitest** (Jest 아님). 현재 Next.js가 이미 SWC/ESM 기반이라 Vitest의 esbuild 트랜스폼과 마찰이 적고, `devDependencies`에 Jest 계열 의존성이 전혀 없어 신규 도입 비용도 Vitest 쪽이 낮음. 순수 함수(`attendance-aggregate.ts`, `payroll-policy.ts`, `dates.ts`)는 Prisma/Next 런타임과 무관해 mock 없이 바로 테스트 가능.

---

## 3. 3단계 검토 — AI 전용 프롬프트 컨텍스트 관리

**실제 공백 맞음** — `CLAUDE.md` 등 프로젝트 루트 AI 컨텍스트 파일이 전혀 없음. 도입 권장.

이 도메인(청소ERP) 기준 "절대불변 비즈니스룰" 후보(예시, 실제 작성 시 코드 재확인 필요):
- 근태 시간 계산은 `lib/attendance-aggregate.ts`/`lib/payroll-policy.ts`만을 단일 진실 소스로 사용 — 페이지별로 재계산 로직 복제 금지
- 인원수·건수 등 카운트 값은 정수 처리, 반입량(kg)은 소수점 3자리 반올림 규칙(`Math.round(weight*1000)/1000`) 통일
- RBAC 5-tier(SUPER/MUNI/CONTRACTOR/INTERNAL/WORKER) 권한 경계는 `lib/rbac.ts`/`role-route.ts`가 단일 진실 소스 — 페이지 컴포넌트에서 role 조건 임의 추가 금지
- KMS 암호화 필드(주소/연락처/계좌 등)는 `decryptField`/`encryptField` 외 경로로 직접 접근 금지
- `docs/architecture/*.md`는 기능 추가 시 갱신 의무 대상(현재 2.5개월 drift 상태 — 재발 방지 규칙으로 명문화 권장)

---

## 4. 체크리스트에 없는 추가 필수 항목 (enterprise-expert 제안)

1. **백업 "복구" 검증** — 매일 백업이 도는지가 아니라, 실제로 그 백업에서 **복원이 되는지**를 주기적으로 확인하는 절차. (참고: 이관 작업 중 `daily-sync-to-backup.sh`의 sudo 인증 조용한 부분실패 사례가 실제로 있었음 — P0 보안조치 항목과 연결, 7/22 예정)
2. **관측성/알림** — 에러 발생 시 로그를 사람이 직접 봐야만 아는 구조인지, 아니면 알림(Slack/이메일 등)이 오는지. 1인 운영 체제에서 특히 중요(사용자가 먼저 발견하기 전에 인지해야 함).
3. **CLAUDE.md 자체** — 위 3단계 항목.

---

## 5. 권장 실행 순서 (종합)

1. **CLAUDE.md 작성** (공수 적음, 즉시 가능) — 3단계
2. **Vitest 도입 + P1순위 근태/야간계산 유닛테스트** (금전·법적 리스크 직결) — 2단계
3. **SRP 분리는 P1→P2 순으로 주 1개 페이스** — 1단계(b), 2900줄 파일은 후순위로 늦춰도 무방(회귀 위험 관리)
4. **architecture 문서 4종 리프레시** (사양서 역추적 아님, 기존 문서 업데이트) — 1단계(a) 대체
5. **백업 복구 검증 + 관측성 최소 구축** — 체크리스트 외 추가 항목, 상용화 단계 진입 시점에 특히 중요

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 0.1 | 2026-07-20 | 초안 — 외부 체크리스트 검토, 에이전트 3인 상담(enterprise-expert/code-analyzer/qa-strategist) 종합 |
