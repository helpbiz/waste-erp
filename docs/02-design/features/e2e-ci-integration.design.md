# e2e-ci-integration Design Document

> **Summary**: GitHub Actions 2-job 워크플로(Functional + Visual)로 Playwright e2e 자동화 + 시각 회귀 베이스라인을 도입한다. PostgreSQL service 컨테이너로 prod 동등 검증 환경을 제공한다.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-27
> **Status**: Draft
> **Planning Doc**: [e2e-ci-integration.plan.md](../../01-plan/features/e2e-ci-integration.plan.md)

---

## Context Anchor

> Copied from Plan document. Ensures strategic context survives Design→Do handoff.

| Key | Value |
|-----|-------|
| **WHY** | 모바일 회귀가 PR 머지 후에야 발견되는 문제를 자동화로 차단한다. |
| **WHO** | 1차: 개발자, 2차: 디자이너/PM, 3차: 사용자 |
| **RISK** | 시각 회귀는 OS/폰트/렌더링 차이로 false positive — CI Linux Chromium을 단일 source of truth로 고정 |
| **SUCCESS** | (1) PR마다 자동 실행 (2) 36건 모바일 + 시각 diff GitHub Checks 노출 (3) 회귀 시 PR 차단 (4) artifact 다운로드 가능 |
| **SCOPE** | Phase 1: GHA workflow + postgres. Phase 2: 시각 회귀 베이스라인. Phase 3: 탭/모달, 로그인, a11y. |

---

## 1. Overview

### 1.1 Design Goals

- 단일 워크플로 파일로 PR/main push 양쪽 트리거 처리
- Functional 실패와 Visual 실패를 GitHub Checks에서 분리 → 디버깅 시간 단축
- 첫 도입 후 1주일 내 false positive < 5% 유지
- CI 1회 실행 시간 ≤ 5분 (postgres 부팅 + build + 5개 spec 실행)
- 베이스라인 갱신은 별도 PR을 통해서만 가능 (`npm run e2e:update`)

### 1.2 Design Principles

- **Separation of Concerns**: Functional regression(논리 오류)과 Visual regression(픽셀 변화)은 다른 시그널 → 별도 job
- **Fail Fast on Functional, Tolerant on Visual**: Functional은 첫 실패 시 즉시 차단, Visual은 항상 모든 페이지 실행 후 종합 보고
- **Single Source of Truth for Baselines**: CI Linux Chromium에서만 베이스라인 생성, 로컬 git commit 금지
- **No Mock**: prod와 동일한 postgres + prisma migrate + seed 사용

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Single Job | Option B: Matrix Sharding | Option C: 2-Job (Func+Visual) |
|----------|:-:|:-:|:-:|
| **Approach** | 한 job에 모두 순차 실행 | 4 shard 병렬 + composite | Functional / Visual 분리 |
| **New Files** | 1 (workflow) | 2 (workflow + composite action) | 1 (workflow) |
| **Modified Files** | 3 (config, scripts, gitignore) | 3 | 3 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Low | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | High (visual+functional 혼합) | Low | Low |
| **Recommendation** | 단순 PoC | 100+ 테스트 규모 | **선택** |

**Selected**: **Option C — 2-Job (Functional + Visual)**

**Rationale**:
- 현재 37 테스트 / 24초 규모에서 Matrix sharding은 overhead가 이익보다 큼
- Visual regression은 false positive 발생률이 더 높아 별도 job으로 격리하면 functional 결과 신뢰도가 보존됨
- PR comment에서 "Functional ✅ / Visual ❌" 형태로 보이면 디자인 변경인지 코드 회귀인지 즉시 판단 가능

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Trigger                       │
│              pull_request | push to main                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
   ┌────────────────────────┐      ┌────────────────────────┐
   │  Job 1: functional      │      │  Job 2: visual          │
   │  (10 min timeout)       │      │  (needs: functional)    │
   │                         │      │  (10 min timeout)       │
   │  ┌──────────────────┐   │      │  ┌──────────────────┐   │
   │  │ services:        │   │      │  │ services:        │   │
   │  │   postgres:16    │   │      │  │   postgres:16    │   │
   │  └──────────────────┘   │      │  └──────────────────┘   │
   │                         │      │                         │
   │  steps:                 │      │  steps:                 │
   │   1. checkout           │      │   1. checkout           │
   │   2. setup-node + cache │      │   2. setup-node + cache │
   │   3. npm ci             │      │   3. npm ci             │
   │   4. prisma migrate     │      │   4. prisma migrate     │
   │   5. seed               │      │   5. seed               │
   │   6. next build         │      │   6. next build         │
   │   7. playwright install │      │   7. playwright install │
   │   8. start app (bg)     │      │   8. start app (bg)     │
   │   9. e2e:mobile         │      │   9. e2e:visual         │
   │   10. e2e:tab-modal     │      │   10. upload diff/      │
   │   11. e2e:login-flow    │      │       (on failure)      │
   │   12. e2e:a11y          │      └────────────────────────┘
   │   13. upload-artifact   │
   │       playwright-report │
   │       (always)          │
   └────────────────────────┘
                │                               │
                └───────────────┬───────────────┘
                                ▼
                  ┌────────────────────────┐
                  │   PR Checks UI          │
                  │   ✅/❌ functional      │
                  │   ✅/❌ visual          │
                  │   📎 artifacts          │
                  └────────────────────────┘
```

### 2.2 Data Flow

```
Code Change (PR/main push)
    │
    ▼
GHA Trigger → Job functional → spawn postgres → migrate → seed → build → start app
                                                                              │
                                                                              ▼
                                            Playwright (4 specs × 4 devices) — pass/fail
                                                                              │
                                                                              ▼
                                                      Upload playwright-report (always)
                                                                              │
                                            ┌─────────────────────────────────┘
                                            ▼
                                Job visual (depends on functional pass)
                                            │
                                            ▼
                                Playwright visual-regression spec
                                            │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                  toHaveScreenshot match              toHaveScreenshot diff
                            │                               │
                            ▼                               ▼
                          PASS                Upload {actual, diff}.png artifact
                                                            │
                                                            ▼
                                                  PR Check: Visual ❌
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| Job `functional` | postgres service | DB 부팅 후 migrate/seed 가능 |
| Job `visual` | Job `functional` (success) | Functional 회귀 없을 때만 시각 비교 의미 있음 |
| `next build` | postgres healthy + .env | Prisma generate + standalone output |
| `e2e:*` 스크립트 | dev server 또는 next start (3001) | baseURL 매칭 |
| `@axe-core/playwright` | playwright install | a11y 검사 도구 |

---

## 3. Data Model

본 PDCA는 데이터 모델 변경 없음. PostgreSQL은 기존 prisma schema + 기존 seed 사용.

| Entity | Source | 비고 |
|--------|--------|------|
| User (test/test) | `prisma/seed.ts` | 로그인 테스트용 — 이미 존재 |
| Worker, Vehicle 등 | `prisma/seed.ts` | 페이지 데이터 표시 — 이미 존재 |

---

## 4. API Specification

본 PDCA는 API 변경 없음. 기존 `POST /api/auth/login` + admin 페이지 사용.

| Method | Path | 사용처 |
|--------|------|-------|
| POST | /api/auth/login | global.setup.ts에서 세션 생성 |
| GET | /attendance, /users, /safety 등 9개 | mobile-responsive.spec.ts |
| GET | /login | login-flow.spec.ts |
| GET | /api/health | CI start app health check |

---

## 5. UI/UX Design

본 PDCA는 사용자 UI 변경 없음. CI 결과는 GitHub PR Checks UI에서 확인.

### 5.1 PR Checks UI 표시 형태

```
┌──────────────────────────────────────────────────────┐
│ Checks                                               │
├──────────────────────────────────────────────────────┤
│ ✅ e2e / functional   (3m 12s)    Details             │
│ ❌ e2e / visual       (2m 45s)    Details             │
│                                                      │
│ Some checks were not successful                      │
│ 1 failing and 1 successful checks                    │
└──────────────────────────────────────────────────────┘

[Details 클릭 시 시각 diff artifact 다운로드 링크 노출]
```

---

## 6. Error Handling

### 6.1 Workflow 실패 시나리오

| 시나리오 | 원인 | 동작 | 디버깅 |
|---------|-----|-----|-------|
| postgres 부팅 실패 | service health check timeout | step 자동 fail | `pg_isready` 로그 확인 |
| migrate 실패 | schema 변경/마이그레이션 누락 | step fail | `prisma migrate status` 출력 |
| build 실패 | 타입 오류/의존성 누락 | step fail | next build 로그 |
| 첫 spec 실패 | 회귀 또는 환경 차이 | functional job fail → visual skip | playwright-report artifact |
| 시각 diff 발생 | 의도적 변경 또는 false positive | visual job fail | actual+diff PNG artifact |
| flaky | 네트워크/타이밍 | retry 1회 (CI에서만) | trace.zip artifact |

### 6.2 Error Response Format

GHA 표준 — step exit code != 0이면 fail. Playwright는 `--reporter=html`로 HTML report 생성.

---

## 7. Security Considerations

- [ ] CI 환경변수에 실제 production secret 사용 금지 — 모두 dummy 값 (`JWT_SECRET=ci-dummy-secret-32chars-padding`)
- [ ] PostgreSQL service password도 dummy (`POSTGRES_PASSWORD=ci-test`)
- [ ] e2e 시드 계정 (`test/test`)은 prod에서 비활성화 보장 (별도 항목)
- [ ] 베이스라인 PNG에 민감 데이터 노출 금지 — 시드 데이터에서 점검
- [ ] artifact 업로드는 30일 보존 (기본값) — secret 포함 금지
- [ ] PR fork에서는 secret 미주입 (GitHub 기본 동작)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: Workflow Validation | YAML syntax + step success | actionlint + 첫 PR 실행 | Do |
| L2: Functional Specs | 4 spec × 4 device 통과 | Playwright | Do |
| L3: Visual Baseline | 36 PNG 베이스라인 일치 | Playwright toHaveScreenshot | Do |
| L4: Regression Test | 의도적 회귀 PR로 차단 검증 | 별도 brunch | Check |

### 8.2 L1: Workflow Validation

| # | 검증 | 기대 결과 |
|---|------|----------|
| 1 | `actionlint .github/workflows/e2e.yml` | 경고/오류 없음 |
| 2 | 첫 PR 푸시 후 워크플로 트리거 발동 | Actions 탭에 e2e 실행 표시 |
| 3 | postgres service 부팅 | service health: healthy |
| 4 | npm ci + prisma migrate + seed | exit code 0 |

### 8.3 L2: Functional Specs

| # | Spec | 검증 |
|---|------|-----|
| 1 | mobile-responsive.spec.ts | 36 테스트 통과 (4 device × 9 page) |
| 2 | tab-modal.spec.ts | 휴가관리 탭 + 날씨 알림 폼 클릭 후 스크롤 폭 검증 |
| 3 | login-flow.spec.ts | 비로그인 → /attendance → /login redirect → 로그인 → 원래 경로 복귀 |
| 4 | a11y.spec.ts | 9 페이지 critical/serious axe 위반 0 |

### 8.4 L3: Visual Regression

| # | 시나리오 | 검증 |
|---|---------|-----|
| 1 | 9 페이지 × 4 디바이스 = 36 캡처 | 베이스라인과 픽셀 단위 일치 |
| 2 | 의도적 변경 (예: 색상) | diff 발생 → artifact upload |
| 3 | threshold 0.2 / maxDiffPixelRatio 0.01 | 폰트 안티앨리어싱 등 미세 차이 흡수 |

### 8.5 L4: Regression Verification

| # | 시나리오 | 기대 |
|---|---------|------|
| 1 | `grid-cols-6` 복원 PR | mobile-responsive 실패 → PR 차단 |
| 2 | 색상 변경 PR | visual 실패 → diff artifact |
| 3 | 베이스라인 갱신 PR | 변경 사유 명시 + reviewer 승인 |

### 8.6 Seed Data Requirements

| Entity | 최소 개수 | 필수 필드 |
|--------|:--------:|----------|
| User (test) | 1 | username=test, password=test, role=INTERNAL_ADMIN |
| Worker | ≥3 | 페이지 표시용 |
| Vehicle | ≥3 | /vehicles 표시용 |
| 기타 | 시드 기본값 사용 | — |

---

## 9. Clean Architecture

본 PDCA는 인프라/테스트 레이어로, src/ 비즈니스 코드 변경 없음.

| Layer | 본 PDCA 영향 |
|-------|-------------|
| Presentation | 없음 |
| Application | 없음 |
| Domain | 없음 |
| Infrastructure | `.github/workflows/`, `e2e/`, `playwright.config.ts` |

---

## 10. Coding Convention Reference

### 10.1 본 PDCA 신규 컨벤션

| Item | 컨벤션 |
|------|-------|
| Workflow 파일명 | `e2e.yml` (단일) |
| Spec 파일명 | `{scope}.spec.ts` (kebab-case) |
| 베이스라인 PNG 경로 | `e2e/__shots__/{project}__{path}.png` |
| 베이스라인 갱신 명령 | `npm run e2e:update` (별도 PR) |
| flaky retry 정책 | `retries: process.env.CI ? 1 : 0` |
| timeout | spec 30s, action 5s, expect 5s |

### 10.2 Workflow YAML 스타일

- 2-space indent
- `name:`은 모든 step에 명시 (디버깅 가독성)
- `timeout-minutes:` 모든 job에 설정 (기본 360분 회피)
- secret은 `${{ secrets.NAME }}` — 본 PDCA에선 dummy만 사용

---

## 11. Implementation Guide

### 11.1 File Structure

```
waste-erp/
├── .github/
│   └── workflows/
│       └── e2e.yml                          (신규)
├── e2e/
│   ├── global.setup.ts                      (기존)
│   ├── mobile-responsive.spec.ts            (기존)
│   ├── visual-regression.spec.ts            (신규)
│   ├── tab-modal.spec.ts                    (신규)
│   ├── login-flow.spec.ts                   (신규)
│   ├── a11y.spec.ts                         (신규)
│   ├── helpers/
│   │   └── visual.ts                        (신규 — 공통 시각 검증 헬퍼)
│   ├── __shots__/                           (git commit, 베이스라인)
│   │   └── *-darwin.png 등 환경별 무시       (.gitignore)
│   └── .auth/                               (.gitignore)
├── playwright.config.ts                     (수정 — toHaveScreenshot 옵션)
├── package.json                             (수정 — scripts + devDep)
├── .gitignore                               (수정 — diff/, .auth/만 ignore)
└── docs/
    └── ci-debug.md                          (신규 — 갱신/디버깅 가이드)
```

### 11.2 Implementation Order

1. [ ] **Module 1 — Foundation**: playwright.config.ts 시각 옵션 + axe-core 설치 + npm scripts + .gitignore
2. [ ] **Module 2 — Spec Files**: visual-regression / tab-modal / login-flow / a11y spec 4종
3. [ ] **Module 3 — Baseline Capture**: CI Linux Docker로 첫 베이스라인 36개 캡처 + git commit
4. [ ] **Module 4 — GHA Workflow**: `.github/workflows/e2e.yml` 작성 + actionlint
5. [ ] **Module 5 — Documentation**: `docs/ci-debug.md` 작성 + CLAUDE.md 또는 README 갱신

### 11.3 Session Guide

> Auto-generated. 본 PDCA는 5 모듈을 1-2 세션에 처리 가능.

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| Foundation | `module-1` | playwright config + scripts + axe 의존성 | 5-7 |
| Spec Files | `module-2` | 4종 spec 파일 작성 | 8-12 |
| Baseline Capture | `module-3` | CI 환경에서 베이스라인 생성 + commit | 4-6 |
| GHA Workflow | `module-4` | e2e.yml 작성 + 첫 PR 검증 | 6-10 |
| Documentation | `module-5` | ci-debug.md + 갱신 절차 문서 | 3-5 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 (현재) | Plan + Design | 전체 | ~25 |
| Session 2 | Do | `--scope module-1,module-2,module-3` | 25-35 |
| Session 3 | Do | `--scope module-4,module-5` | 15-25 |
| Session 4 | Check + Report | 의도적 회귀 PR 검증 + 보고 | 15-20 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 — Option C (2-Job) 채택, 5 모듈 분할 | 4365won@gmail.com |
