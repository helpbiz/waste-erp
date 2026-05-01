# 📚 CleanERP 개발/운영 문서 허브

> **단일 진입점** — 어떤 문서가 어디에 있는지 빠르게 찾기 위한 마스터 인덱스.
> 마지막 갱신: 2026-05-02 (16 commits 세션 종료 시점)

---

## 🚀 빠른 시작

| 목적 | 문서 |
|---|---|
| 프로젝트 처음 — 무엇이 만들어졌나 | [README.md](../README.md) |
| **신규 개발자** 환경 셋업 | [`유지보수_메뉴얼.md` §13](../유지보수_메뉴얼.md) |
| 운영 배포 (코드 변경 후) | [DEPLOY.md](../DEPLOY.md) |
| 다음 세션 재개 | [RESUME_NOTE.md](../RESUME_NOTE.md) |
| 사용자 (관리자/워커) 사용법 | [사용자_설명서.md](../사용자_설명서.md) |

---

## 🏛 1. 아키텍처 (Architecture)

| 문서 | 내용 |
|---|---|
| [`architecture/feature-catalog.md`](architecture/feature-catalog.md) | **8개 기능 인벤토리** — 파일·API·RBAC·게이트 매핑 |
| [`architecture/api-reference.md`](architecture/api-reference.md) | API 엔드포인트 도메인별 정리 |
| [`architecture/data-model.md`](architecture/data-model.md) | Prisma 주요 테이블 + 관계 |
| [`architecture/rbac-matrix.md`](architecture/rbac-matrix.md) | 5-tier 역할 × 기능 권한표 |

---

## 🛠 2. 운영 (Operations)

| 문서 | 빈도 | 내용 |
|---|---|---|
| [`유지보수_메뉴얼.md`](../유지보수_메뉴얼.md) | 상시 | **메인 운영 매뉴얼** (1366줄) — 일일/주간/월간 점검, 장애 대응, DB 관리 |
| [`OPERATIONS.md`](OPERATIONS.md) | 상시 | 운영 명령어 모음 |
| [`OPS-NOC-SETUP.md`](OPS-NOC-SETUP.md) | 1회 | NOC 56인치 TV 키오스크 셋업 절차 |
| [`DEPLOY-READINESS.md`](DEPLOY-READINESS.md) | 배포 전 | 배포 전 점검 체크리스트 |
| [`서비스_개설_절차.md`](../서비스_개설_절차.md) | 신규 도입 시 | 신규 위탁업체/지자체 개설 절차 |

---

## 📋 3. 기획·계획 (PM·Plan)

| 디렉터리 | 내용 |
|---|---|
| [`00-pm/`](00-pm/) | PM 분석 (mobile-ux-research, mobile-nav-pattern-research, multi-tenant-saas-review, pwa-mobile-ux-mastering) |
| [`01-plan/`](01-plan/) | 초기 계획 |
| [`specs/`](specs/) | 기능별 개발 규격서 (8개 spec) — 신청페이지, 견적자동화, SLA, 슈퍼관리자, 역할권한 등 |

---

## 🎨 4. 설계 (Design)

| 문서 | 내용 |
|---|---|
| [`02-design/mobile-ux-overhaul.md`](02-design/mobile-ux-overhaul.md) | 모바일 UX 전면 개편 (1168줄) |
| [`02-design/mobile-nav-revisit.md`](02-design/mobile-nav-revisit.md) | 햄버거 → Tab 5 재설계 (Option C) |
| [`02-design/features/`](02-design/features/) | 기능별 설계 문서 |

---

## 📊 5. 보고서·세션 로그 (Reports)

| 문서 | 일자 | 내용 |
|---|---|---|
| [`04-report/2026-05-02-session-log.md`](04-report/2026-05-02-session-log.md) | 2026-05-02 | **본 세션** — 15 feature commits + 4 docs (TTS / 자동배정 / 패키지 / 게이트 / WebPush) |
| [`04-report/2026-04-29-session-log.md`](04-report/2026-04-29-session-log.md) | 2026-04-29 | 자동경로탐색 / 분포 시각화 / NOC / 슈퍼관리자 마법사 / 다중 테넌트 보안 |
| [`04-report/mobile-ux-overhaul.report.md`](04-report/mobile-ux-overhaul.report.md) | — | 모바일 UX 완료 보고서 |
| [`04-report/pwa-mobile-ux-mastering.report.md`](04-report/pwa-mobile-ux-mastering.report.md) | — | PWA 모바일 UX 마스터링 |
| [`04-report/a11y-*.report.md`](04-report/) | — | 접근성 개선 보고 |
| [`mobile-history.md`](mobile-history.md) | — | 모바일 변경 이력 |
| [`super-admin-history.md`](super-admin-history.md) | — | 슈퍼관리자 변경 이력 |
| [`개발_기록.md`](../개발_기록.md) | 누적 | 역사적 개발 로그 |

---

## 🔬 6. 분석 (Analysis)

| 문서 | 내용 |
|---|---|
| [`03-analysis/e2e-ci-integration.analysis.md`](03-analysis/e2e-ci-integration.analysis.md) | E2E CI 통합 분석 |
| [`pwa-mobile-ux-audit.md`](pwa-mobile-ux-audit.md) | PWA UX 감사 |
| [`pwa-mobile-ux-gap-analysis.md`](pwa-mobile-ux-gap-analysis.md) | PWA UX 갭 분석 |

---

## 🐞 7. 디버깅·이슈 트래킹

| 문서 | 내용 |
|---|---|
| [`mobile-issues.md`](mobile-issues.md) | 모바일 이슈 모음 |
| [`ci-debug.md`](ci-debug.md) | CI 디버깅 노트 |

---

## 🗺 문서 갱신 정책

### 신규 문서 작성 시 위치 결정

| 유형 | 위치 |
|---|---|
| 아키텍처/시스템 도면 | `docs/architecture/` |
| 신규 PM 리서치 | `docs/00-pm/` |
| 기능 설계서 | `docs/02-design/features/` (또는 `docs/specs/`) |
| 세션 로그 | `docs/04-report/YYYY-MM-DD-session-log.md` |
| 운영 매뉴얼 변경 | `유지보수_메뉴얼.md` 본체 갱신 |

### 갱신 책임
- **세션 종료 시**: `RESUME_NOTE.md` + 해당 일자 session-log + (필요 시) `architecture/feature-catalog.md`
- **신규 기능 배포 시**: `architecture/feature-catalog.md` + `api-reference.md` + `rbac-matrix.md`
- **신규 사용자 절차**: `사용자_설명서.md` + `유지보수_메뉴얼.md`

### 폐기·이관
- 6개월 이상 갱신 없는 reports → `docs/04-report/archive/` (TODO: 폴더 미생성)
- 다음 세션 우선순위는 `RESUME_NOTE.md` 만 보면 충분

---

## 🔍 자주 찾는 답

| 질문 | 문서 |
|---|---|
| "이 기능은 어디에 구현되어 있나?" | [`architecture/feature-catalog.md`](architecture/feature-catalog.md) |
| "어떤 API 가 있나?" | [`architecture/api-reference.md`](architecture/api-reference.md) |
| "이 사용자가 이 작업을 할 수 있나?" | [`architecture/rbac-matrix.md`](architecture/rbac-matrix.md) |
| "DB 스키마 구조는?" | [`architecture/data-model.md`](architecture/data-model.md) |
| "장애 대응 절차" | [`유지보수_메뉴얼.md` §9](../유지보수_메뉴얼.md) |
| "코드 변경 후 배포" | [`DEPLOY.md`](../DEPLOY.md) |
| "지난번 세션에서 뭘 했나?" | 가장 최신 [`04-report/YYYY-MM-DD-session-log.md`](04-report/) |
