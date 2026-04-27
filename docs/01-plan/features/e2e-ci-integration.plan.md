# e2e-ci-integration Planning Document

> **Summary**: Playwright e2e 테스트를 GitHub Actions에 통합하고 시각 회귀 베이스라인을 도입하여 모바일 반응형 회귀를 PR 단계에서 자동 차단한다.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-27
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 현재 모바일 회귀(가로 오버플로우, 그리드 깨짐 등)는 변경 후 사람이 수동으로 4종 디바이스에서 확인해야만 발견 가능. PR 머지 후에야 발견되는 경우가 많고, 시각적 변화는 코드 리뷰로도 잡히지 않는다. |
| **Solution** | (1) GitHub Actions에서 PR/main push마다 Playwright 36건 모바일 회귀 자동 실행. (2) `toHaveScreenshot()` 베이스라인으로 픽셀 단위 변화 감지. (3) 실패 시 diff 이미지를 PR에 artifact 업로드. |
| **Function/UX Effect** | 개발자: PR Check에 mobile e2e 통과/실패가 표시되어 머지 전 회귀 차단. 디자이너/PM: PR comment에서 시각 diff 이미지 즉시 확인 가능. CI 시간: 약 2-3분 추가 (postgres 부팅 + 빌드 + 36 테스트). |
| **Core Value** | "모바일은 별도 점검이 필요한 영역"에서 "PR 통과 = 모바일 회귀 없음"으로 신뢰 기반 변경. 향후 Top 5 같은 일괄 모바일 수정 작업이 회귀 두려움 없이 안전하게 가능. |

---

## Context Anchor

> Auto-generated from Executive Summary. Propagated to Design/Do documents for context continuity.

| Key | Value |
|-----|-------|
| **WHY** | 모바일 회귀가 PR 머지 후에야 발견되는 문제를 자동화로 차단한다. |
| **WHO** | 1차: 개발자(머지 전 안심), 2차: 디자이너/PM(PR에서 시각 diff 확인), 3차: 사용자(회귀 노출 감소) |
| **RISK** | 시각 회귀는 OS/폰트/렌더링 차이로 false positive 발생 가능 → CI Linux 베이스라인을 단일 source of truth로 고정. 최초 도입 시 베이스라인 캡처가 필요. |
| **SUCCESS** | (1) PR마다 e2e 자동 실행 (2) 36건 모바일 + 시각 diff 모두 GitHub Checks에 노출 (3) 회귀 발생 시 PR 차단 (4) artifact로 diff 이미지 다운로드 가능 |
| **SCOPE** | Phase 1: GitHub Actions workflow + postgres service. Phase 2: 시각 회귀 베이스라인 캡처. Phase 3: 추가 시나리오(탭/모달, 로그인, a11y). |

---

## 1. Overview

### 1.1 Purpose

waste-erp의 Phase 1A 단계에서 모바일 사용성을 보장하기 위해 도입한 Top 5 반응형 수정(2026-04-27)을 회귀 없이 유지하고, 향후 모든 변경에 대해 자동 모바일 검증 게이트를 구축한다.

### 1.2 Background

- 2026-04-26 모바일 점검 결과 36건의 호환성 위반 발견 (`docs/mobile-issues.md`).
- 2026-04-27 Top 5 일괄 수정 (10개 파일, 17개 테이블 + 3개 그리드 + 2개 KPI 카드).
- 동일 일자 Playwright 도입 + 첫 회귀 검증 통과 (37/37, 24.4초). 그러나 로컬 수동 실행만 가능하여 회귀 자동 차단은 미구축.
- GitHub Actions가 이미 다른 워크플로(예상)에 사용 중일 가능성 → CI 런타임 비용 최소화 필요.

### 1.3 Related Documents

- 기존 점검: `docs/mobile-issues.md` (36건 → 21건 수정 + 검증 완료)
- 기존 e2e: `e2e/global.setup.ts`, `e2e/mobile-responsive.spec.ts`, `playwright.config.ts`
- 빌드/배포: `Dockerfile`, `docker-compose.prod.yml`
- 시드: `prisma/seed.ts` (test/test 계정 포함)

---

## 2. Scope

### 2.1 In Scope

- [ ] `.github/workflows/e2e.yml` 작성 — PR + main push 트리거
- [ ] PostgreSQL service 컨테이너 + prisma migrate deploy + seed
- [ ] Next.js 빌드 + start (port 3001 매칭)
- [ ] Playwright 36건 mobile-responsive 실행
- [ ] 시각 회귀: `e2e/visual-regression.spec.ts` 추가, `toHaveScreenshot()` 사용, `e2e/__shots__/` 베이스라인 git commit
- [ ] CI 실패 시 `playwright-report/`, `test-results/`, `e2e/__shots__/*-actual.png`, `*-diff.png` artifact 업로드
- [ ] 추가 시나리오 spec 3종 — `tab-modal.spec.ts`, `login-flow.spec.ts`, `a11y.spec.ts`
- [ ] `@axe-core/playwright` 설치 + 9 페이지 a11y 기본 검사
- [ ] README/CLAUDE.md에 CI 갱신 섹션 추가 (베이스라인 갱신 절차)

### 2.2 Out of Scope

- 외부 시각 회귀 SaaS (Percy/Chromatic) — 비용/외부 의존 회피
- Webkit/Firefox 크로스 브라우저 — Chromium emulate로 통일 (이전 결정)
- 데스크탑 폭(1280/1920) — Top 5 수정 범위는 모바일 전용
- 성능 측정(Lighthouse) — 별도 PDCA로 분리
- E2E를 사용한 비즈니스 로직 검증 — 별도 PDCA(예: payroll-e2e)로 분리

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | PR 생성/업데이트 시 e2e 워크플로 자동 실행 | High | Pending |
| FR-02 | main 브랜치 push 시 e2e 워크플로 자동 실행 | High | Pending |
| FR-03 | PostgreSQL service 컨테이너에서 prisma migrate + seed 자동 수행 | High | Pending |
| FR-04 | 36건 모바일 가로 오버플로우 테스트 통과 시 PR Check ✅ | High | Pending |
| FR-05 | `toHaveScreenshot()` 시각 회귀: 베이스라인 PNG 9 페이지 × 4 디바이스 = 36개 git에 commit | High | Pending |
| FR-06 | 시각 diff 발생 시 `actual.png` + `diff.png` artifact 업로드 | High | Pending |
| FR-07 | `tab-modal.spec.ts`: /users 휴가관리 탭, /safety 날씨 알림 폼 클릭 후 가로 오버플로우 재검증 | Medium | Pending |
| FR-08 | `login-flow.spec.ts`: 비로그인 상태 /attendance 접근 → /login redirect → 로그인 → 원래 경로 복귀 검증 | Medium | Pending |
| FR-09 | `a11y.spec.ts`: @axe-core/playwright로 9 페이지 critical/serious 위반 0건 검증 | Medium | Pending |
| FR-10 | 베이스라인 갱신 명령(`npm run e2e:update`) 추가 + 절차 문서화 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 성능 | CI 1회 실행 ≤ 5분 | GitHub Actions step 시간 |
| 안정성 | flaky 테스트 < 3% (10회 연속 실행 기준) | retry 0회로 측정 |
| 비용 | GitHub Actions 무료 티어 내 (월 2000분) | actions/usage 페이지 |
| 결정성 | 시각 회귀 false positive 발생률 < 5% | 첫 2주 monitor + 임계값 조정 |
| 문서화 | CI 실패 시 디버깅 가이드 README 1페이지 이상 | `docs/ci-debug.md` 작성 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `.github/workflows/e2e.yml`이 main 브랜치에 머지되어 있다
- [ ] 첫 PR에서 e2e Check가 자동 실행되고 통과한다
- [ ] 의도적 회귀 테스트(예: `grid-cols-6` 복원)가 PR을 차단한다
- [ ] 시각 회귀 베이스라인 36개가 `e2e/__shots__/`에 git commit되어 있다
- [ ] 추가 spec 3종(tab-modal, login-flow, a11y)이 통과한다
- [ ] README 또는 `docs/ci-debug.md`에 베이스라인 갱신 절차가 문서화되어 있다

### 4.2 Quality Criteria

- [ ] 첫 통과 후 5회 연속 실행에서 flaky 0건
- [ ] CI 1회 실행 시간 ≤ 5분 (postgres 부팅 + build + 36+α 테스트)
- [ ] PR comment에서 artifact 다운로드 링크 노출 확인
- [ ] tsc --noEmit 무오류 (e2e/*.ts 포함)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 시각 회귀 false positive (폰트 렌더링 차이) | High | High | CI Linux Chromium을 단일 source of truth, 로컬 베이스라인 git commit 금지 — 베이스라인은 `npm run e2e:update`로만 갱신하고 결과를 별도 PR로 검토 |
| PostgreSQL 시작 지연으로 build flaky | Medium | Medium | service health check + `wait-for-it.sh` 또는 `pg_isready` 폴링 |
| 첫 베이스라인 캡처가 누락된 디바이스/페이지 발견 | Medium | Medium | 첫 배포 후 1주일 모니터링, missing snapshot은 자동 생성 모드(`--update-snapshots`) on-demand |
| a11y 기본 검사가 기존 코드에서 다수 위반 발견 | Medium | High | 첫 도입 시 critical/serious만 차단, moderate/minor는 warning으로 시작 |
| GitHub Actions 무료 티어 한도 초과 | Low | Low | 워크플로에 `paths-ignore: ['docs/**', '*.md']` 추가, PR draft는 skip |
| 베이스라인 갱신 PR 리뷰 절차 부재 → 무분별 갱신 | Medium | Medium | CODEOWNERS에 베이스라인 폴더 지정 또는 PR 템플릿에 "베이스라인 갱신 사유" 필드 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `.github/workflows/e2e.yml` | CI 워크플로 | 신규 생성 |
| `playwright.config.ts` | Config | `expect.toHaveScreenshot` 옵션 추가 (threshold, maxDiffPixelRatio) |
| `e2e/__shots__/` | 베이스라인 디렉터리 | `.gitignore` 해제 + 36개 PNG commit |
| `package.json` | NPM 스크립트 | `e2e:update`, `e2e:visual` 추가, `@axe-core/playwright` devDep |
| `e2e/visual-regression.spec.ts` | 신규 spec | 시각 회귀 전용 |
| `e2e/tab-modal.spec.ts` | 신규 spec | 탭/모달 클릭 시나리오 |
| `e2e/login-flow.spec.ts` | 신규 spec | 인증 redirect 흐름 |
| `e2e/a11y.spec.ts` | 신규 spec | axe-core 자동 검사 |
| `.gitignore` | 설정 | `/e2e/__shots__/` 제외 (베이스라인은 commit) — `e2e/__shots__/diff/` 만 ignore |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `playwright.config.ts` | READ | `npm run e2e*` 4종 스크립트 | 호환 유지 (옵션 추가만) |
| `e2e/__shots__/` | WRITE | 기존 mobile-responsive.spec.ts의 `page.screenshot()` | 기존 매뉴얼 스크린샷은 `e2e/__shots__/manual/`로 분리 권장 |
| `prisma/seed.ts` | READ | CI postgres service 부팅 후 1회 실행 | 기존 dev seed와 동일 — 이미 idempotent 검증됨 |
| GitHub PR Checks | UI | 머지 가드 로직 | 첫 도입 후 required check 등록 시점 결정 필요 |

### 6.3 Verification

- [ ] 기존 `npm run e2e:mobile`이 새 spec들로 인해 깨지지 않음 (37/37 유지)
- [ ] 베이스라인 PNG가 git LFS 없이도 합리적 크기 (각 ~50-200KB, 합계 < 5MB) 검증
- [ ] CI 외부에서 베이스라인 캡처가 가능하도록 `npm run e2e:update`만으로 환경 일관성 유지

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | 단순 구조 | 정적 사이트 | ☐ |
| **Dynamic** | Feature-based modules | Web apps with backend | ☑ |
| **Enterprise** | 엄격한 레이어 분리 | 고트래픽 시스템 | ☐ |

waste-erp는 Dynamic — Next.js + Prisma + PostgreSQL의 표준 스택이며 별도 마이크로서비스 분리 없음.

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| CI Provider | GitHub Actions / GitLab CI / CircleCI | **GitHub Actions** | 코드 호스팅과 동일, 무료 티어 충분 |
| CI DB | postgres service / docker-compose / mock | **postgres service** | 부팅 빠름(~10초), 프로덕션 동일 스킴 |
| 시각 회귀 도구 | Playwright toHaveScreenshot / Percy / Chromatic | **Playwright 내장** | 추가 의존 없음, 베이스라인 git에 commit |
| 베이스라인 저장소 | Git / Git LFS / S3 / 외부 SaaS | **Git (commit)** | <5MB 예상, 코드와 함께 버전 관리 |
| Browser | chromium / webkit / firefox / 모두 | **chromium만** | 이전 검증에서 webkit 호환성 이슈 — 모바일 viewport emulate로 통일 |
| a11y 도구 | axe-core / pa11y / Lighthouse | **@axe-core/playwright** | Playwright 통합 매끄러움, critical/serious 자동 분류 |
| Auth in CI | seed test 계정 / OAuth mock / 환경변수 | **seed test 계정** | 이미 test/test 시드되어 있음 |

### 7.3 Clean Architecture Approach

```
Selected Level: Dynamic

CI/E2E Folder Structure (변경):
┌─────────────────────────────────────────────────────┐
│ .github/                                            │
│   workflows/                                        │
│     e2e.yml          (신규)                         │
│ e2e/                                                │
│   global.setup.ts                                   │
│   mobile-responsive.spec.ts                         │
│   visual-regression.spec.ts  (신규)                 │
│   tab-modal.spec.ts          (신규)                 │
│   login-flow.spec.ts         (신규)                 │
│   a11y.spec.ts               (신규)                 │
│   __shots__/                 (git commit 대상)      │
│   __shots__/diff/            (.gitignore)           │
│   .auth/                     (.gitignore)           │
│ playwright.config.ts                                │
│ docs/                                               │
│   ci-debug.md                (신규)                 │
└─────────────────────────────────────────────────────┘
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] `tsconfig.json` 존재 — strict 모드 가정
- [x] ESLint (`eslint-config-next`) 설치됨
- [ ] CI 컨벤션 문서 부재 → 본 PDCA에서 신규 도입
- [ ] 베이스라인 갱신 절차 부재 → 본 PDCA에서 신규 도입

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| 워크플로 파일명 | 부재 | `e2e.yml` (단일) | High |
| 베이스라인 디렉터리 | 부재 | `e2e/__shots__/{project}__{path}.png` | High |
| 베이스라인 갱신 절차 | 부재 | 별도 PR + reviewer 1명 이상 승인 | Medium |
| flaky 테스트 처리 | 부재 | retry는 CI에서만 1회 허용 (`retries: process.env.CI ? 1 : 0`) | Low |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `DATABASE_URL` | CI postgres 연결 | Server | ☑ (workflow inline) |
| `JWT_SECRET` | 로그인 테스트용 | Server | ☑ (workflow inline, dummy 값) |
| `KMS_LOCAL_KEY` | 로컬 KMS | Server | ☑ (workflow inline, dummy 값) |
| `CRON_SECRET` | cron 보호 | Server | ☑ (workflow inline, dummy 값) |
| `E2E_BASE_URL` | Playwright 대상 | Test | 기본값 `http://localhost:3000` (CI) |
| `CI` | retry 분기 | Test | GitHub Actions 자동 제공 |

### 8.4 Pipeline Integration

본 PDCA는 9-Phase Pipeline 외 부가 작업(테스트/CI 인프라)이므로 phase mapping 없음. 단, Phase 9(Deployment)과 연관 — 향후 deploy workflow 통합 가능.

---

## 9. Next Steps

1. [ ] `/pdca design e2e-ci-integration` — 3가지 아키텍처 옵션 비교 + workflow 파일 구조 결정
2. [ ] `/pdca do e2e-ci-integration` — 구현 (workflow + spec 파일 + 베이스라인 캡처)
3. [ ] `/pdca analyze e2e-ci-integration` — 첫 PR로 회귀 검증 + 의도적 회귀 테스트
4. [ ] `/pdca report e2e-ci-integration` — 도입 효과 측정 (회귀 차단 건수, CI 평균 시간)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 작성 — 4종 PDCA Plan 검토 점 사용자 확정 | 4365won@gmail.com |
