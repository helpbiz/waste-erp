# PWA Mobile UX Mastering — QA 테스트 전략

| 항목 | 내용 |
|------|------|
| feature | pwa-mobile-ux-mastering |
| phase | Check |
| 작성일 | 2026-04-28 |
| 작성 | bkit:qa-strategist |
| 시나리오 총수 | 60 |

---

## 1. 시나리오 매트릭스

### 공통 전제

| 항목 | 값 |
|------|----|
| Playwright 프로젝트 (viewport) | 375-iPhone-SE / 393-Pixel7 / 360-GalaxyS / 768-iPad |
| Auth state (test) | INTERNAL_ADMIN (admin shell 기준) |
| Auth state (super) | SUPER_ADMIN |
| Worker / Citizen | 별도 seed 계정 필요 (현재 global.setup.ts 미포함 → 신규 추가 대상) |
| baseURL | http://localhost:3001 (로컬) / http://localhost:3000 (CI) |

### 1-A. login → role 자동 라우팅 (16 시나리오)

> `resolveRoleRoute()` 우선순위: explicitNext > 모바일+admin → /dashboard > redirectTo > /complaints

| # | Role (DB role) | 기대 라우팅 | 검증 포인트 |
|---|---------------|------------|------------|
| 1-4 | company (CONTRACTOR_ADMIN) × 4 viewport | 모바일 → /dashboard, 데스크탑 → redirectTo 또는 /complaints | URL, 셸 헤더 타이틀 |
| 5-8 | manager (INTERNAL_ADMIN) × 4 viewport | 모바일 → /dashboard | 동일 |
| 9-12 | muni (MUNI_ADMIN) × 4 viewport | 모바일 → /dashboard | 동일 |
| 13-16 | worker (WORKER) × 4 viewport | redirectTo 또는 /worker | worker 셸 탭바 표출 |

추가 검증:
- `?next=/safety` 명시 시 role 무관 explicitNext 우선
- needsConsent=true 시 `/consent?next=...` 리다이렉트

### 1-B. logout (16 시나리오)

| # | 표면 | 진입점 | 검증 |
|---|------|-------|------|
| 17-20 | admin 사이드바 | LogoutButton variant=compact | 다이얼로그 → /login |
| 21-24 | admin 헤더 | 동일 | 동일 |
| 25-28 | worker 프로필 카드 | LogoutButton variant=full | 다이얼로그 / 취소 잔류 |
| 29-32 | citizen 전환 / consent 거부 | 별도 버튼 + AccessibleConfirmDialog | AAA 대비, 동작 |

### 1-C. PWA 설치 버튼 (4)
- 4 viewport 에서 "앱으로 설치하기" 노출 + fallback alert
- 실제 prompt.userChoice는 수동 검증

### 1-D. viewport 줌 잠금 (4)
- `meta[name=viewport]` 의 `maximum-scale=1` 포함 검증 (4 viewport)
- 핀치 줌은 Playwright API 미지원 → 수동

### 1-E. AccessibleConfirmDialog (12)
- ESC → 취소 (4)
- 포커스 트랩 cancel ↔ confirm 순환 (4)
- destructive 백드롭 클릭 무시 (4)

### 1-F. RAPID worker 추천경로 (8)
- RAPID 계정 × 4 → 메뉴 표출
- 일반 worker × 4 → 미표출

### 합계

| 흐름 | 수 |
|------|----|
| 1-A 라우팅 | 16 |
| 1-B logout | 16 |
| 1-C PWA 설치 | 4 |
| 1-D viewport 잠금 | 4 |
| 1-E ConfirmDialog | 12 |
| 1-F RAPID 메뉴 | 8 |
| **합계** | **60** |

---

## 2. Playwright spec 추가 권장

### 폴더 구조

```
e2e/pwa-mobile-ux/
├── login-routing.spec.ts
├── logout-aaa.spec.ts
├── viewport-lock.spec.ts
├── accessibility.spec.ts
└── rapid-menu.spec.ts
```

### storageState 추가 필요

- `worker-state.json` — WORKER, position.code != 'RAPID'
- `rapid-worker-state.json` — WORKER, position.code = 'RAPID'
- `citizen-state.json` — CITIZEN

### spec별 핵심

- **login-routing**: 4 role 로그인 → 각 viewport 별 라우팅 검증. `?next=` / `needsConsent` 분기 포함.
- **logout-aaa**: 4 표면(admin sidebar/admin header/worker profile/citizen) 시인성 + 다이얼로그 동작. AAA 대비비는 axe `color-contrast-enhanced` 룰로 자동 검증.
- **viewport-lock**: meta tag content 확인 + input font-size ≥16px 확인.
- **accessibility**: 신규 페이지(login, worker home/safety, citizen, consent) 에 axe-core 적용. 기존 a11y.spec.ts 는 ADMIN_PAGES 유지.
- **rapid-menu**: position.code 따라 추천경로 메뉴 표출/미표출 검증. `data-testid="rapid-menu"` 추가 권장.

---

## 3. axe-core 통합

### 신규 페이지 추가

- /login (storageState 없음)
- /worker, /worker/safety (worker-state)
- /citizen, /consent (citizen-state)

### AAA 등급 활성화 권장 (방법 B — 노이즈 최소)

```typescript
new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .withRules(['color-contrast-enhanced'])  // AAA 7:1
  .analyze();
```

`color-contrast-enhanced` 만 AAA 추가 — 전체 AAA 활성화 시 `link-in-text-block` 등 현실 통과 불가.

### blocking severity

| severity | 정책 |
|---|---|
| critical / serious / moderate | block |
| AAA color-contrast-enhanced | block (신규 페이지 한정) |

---

## 4. Visual Regression Baseline

### 갱신 대상

| 화면 | 변경 원인 |
|------|----------|
| /login | PWA 설치 버튼, 에러, CTA min-h-14 |
| /dashboard | 헤더 배지, 사이드바 AAA |
| /attendance, /safety, /complaints | AppBar / tab 시인성 |
| /worker, /worker/safety | 신규 baseline |
| /citizen, /consent | 신규 baseline |

### 갱신 방법

1. GHA workflow_dispatch — `update_snapshots: true`
2. 자동 PR 생성 → 육안 diff 확인 → merge

신규 페이지 baseline 은 별도 spec `e2e/pwa-mobile-ux/visual-regression-pwa.spec.ts` 생성 권장 (storageState 분기 단순화).

---

## 5. 수동 체크리스트 (시니어 사용성)

### 5-A. 5분 학습 가능성

| 체크 | 기준 |
|------|------|
| 로그인 | 2분 이내 |
| 로그아웃 버튼 발견 | 별도 안내 없이 |
| PWA "앱으로 설치하기" 의미 파악 | 즉시 |
| 다이얼로그 취소/확인 구분 | 명확 |
| CTA 1탭 성공 | 1회 시도 |

### 5-B. 야외 환경 시뮬레이션

화면 밝기 50% + DevTools `filter: brightness(1.5) contrast(0.8)`:
- 로그인 CTA / LogoutButton / 에러 / 사이드바 / 본문 14-16px / 푸터 white/85 모두 가독성

### 5-C. OS 폰트 / 다크 / 모션

| 체크 | 방법 |
|------|------|
| iOS Dynamic Type 최대 | 손쉬운 사용 → 더 큰 텍스트 |
| Android 글꼴 200% | 화면 → 글꼴 크기 |
| 다크모드 호환 | OS 설정 |
| prefers-reduced-motion | OS 설정 → 모션 줄이기 |
| 핀치 줌 (보조기기 줌) | iOS Safari 두 손가락 확대 — userScalable=true 로 허용됨 |

---

## 6. 게이트 (CI 통과 조건)

| # | 게이트 | 임계값 |
|---|--------|--------|
| G-1 | Lighthouse Accessibility | ≥ 95 |
| G-2 | axe E2E (critical/serious/moderate) | 0건 |
| G-3 | axe AAA color-contrast-enhanced (신규 페이지) | 0건 |
| G-4 | visual regression (4 viewport) | 100% (maxDiffPixelRatio ≤ 1%) |
| G-5 | login-routing.spec | 16/16 |
| G-6 | logout-aaa.spec | 16/16 |
| G-7 | viewport-lock.spec | 4/4 |
| G-8 | accessibility.spec | 100% |
| G-9 | rapid-menu.spec | 8/8 |
| G-10 | 수동 체크리스트 5-A,B,C | 전항목 완료 |

### 차단 정책

- G-2/G-3 axe 위반 → iterate (Report 진입 불가)
- G-4 visual regression → baseline 갱신 후 육안 확인
- G-1 < 95 → ARIA landmark / best-practice 룰 점검
- G-10 수동 미완 → 이니셔티브 완료 선언 불가

---

## 부록: 시드 / 인프라 선행 작업

| # | 작업 | 비고 |
|---|------|------|
| P-1 | prisma/seed.ts WORKER(일반) 계정 추가 | position.code != 'RAPID' |
| P-2 | prisma/seed.ts WORKER(RAPID) 계정 추가 | position.code = 'RAPID' |
| P-3 | prisma/seed.ts CITIZEN 계정 + needsConsent 케이스 | |
| P-4 | global.setup.ts worker/rapid/citizen 인증 추가 | storageState 3종 |
| P-5 | worker home/safety 에 data-testid="rapid-menu" 추가 | rapid-menu.spec 의존 |
| P-6 | helpers/pages.ts WORKER_PAGES / CITIZEN_PAGES / AUTH_PAGES 추가 | accessibility.spec 의존 |
| P-7 | Lighthouse CI 통합 (선택) | G-1 자동화 |

---

## 주요 발견

- `playwright.config.ts` 실제 viewport는 375/393/360/768 (요청의 320/1280과 다름) — 실제 config 기준으로 매트릭스 작성
- `e2e/visual-regression.spec.ts`는 ADMIN_PAGES 11개 × 4 viewport = 44 스냅샷 (코드 주석의 36은 오래된 수치)
- `global.setup.ts` 현재 test/super 두 계정만 — worker/citizen spec 실행 전 시드/setup 확장 필수
- AccessibleConfirmDialog 포커스 트랩은 cancelRef ↔ confirmRef 두 버튼 사이만 순환 — Tab 검증 시 두 요소만 체크
