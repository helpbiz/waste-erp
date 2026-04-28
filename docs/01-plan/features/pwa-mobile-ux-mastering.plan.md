# Plan — PWA Mobile UX Mastering

> 이니셔티브: **PWA Mobile UX Mastering** (CleanERP / wci.helpbiz.kr)
> 단계: PDCA Plan
> 작성일: 2026-04-28
> 통합: PRD + Design Tokens/Shell/Components + Audit

## 0. 배경

Wave 1~4 부분 패치 누적에도 불구하고 사용자가 직접 보고한 결함:
1. 로그아웃 버튼 시인성 처참 (특정 화면에서 사라짐)
2. PWA 자유 줌 (앱 같지 않음)
3. 4-role × 페이지마다 일관성 부재

**감사 결과** (`docs/04-report/pwa-mobile-ux-audit.md`): P0 5건 + P1 6 카테고리 ~600 occurrences + P2 2 카테고리.

핵심 원인: `LogoutButton` 의 `text-slate-200` 하드코딩이 admin sidebar(어두운 배경) 컨텍스트에선 우연히 OK였다가, `worker/profile` 흰색 카드에 그대로 재사용 → 대비 1.16:1 → 비가시. **컨텍스트 무시한 부분 패치의 전형적 회귀**.

## 1. 확정된 결정 (변경 불가)

- 로그인: 4-role 공용 단일 화면 + 로그인 후 `user.role` 기반 자동 라우팅 (옵션 A)
- 접근성: **WCAG 2.1 AAA** (본문 대비 7:1, 본문 18px+, 터치타겟 44×44px+)
- PWA 뷰포트: `maximum-scale=1` + `user-scalable=yes`
- 4-role: company / manager / muni / worker (worker 하위 RAPID 시 '최적경로계산')
- 핵심 페르소나: 50~60대 환경미화원 (P1 김순기), 자력 5분 학습

자세한 페르소나·KPI·GTM: `docs/00-pm/pwa-mobile-ux-mastering/prd.md`

## 2. 산출물 (이미 생성됨)

| 분류 | 파일 |
|---|---|
| PM Discovery | `docs/00-pm/pwa-mobile-ux-mastering/discovery.md` |
| PM Strategy | `docs/00-pm/pwa-mobile-ux-mastering/strategy.md` |
| PM Research | `docs/00-pm/pwa-mobile-ux-mastering/research.md` |
| PRD (메인) | `docs/00-pm/pwa-mobile-ux-mastering/prd.md` |
| Design (메인) | `docs/02-design/features/pwa-mobile-ux-mastering.design.md` |
| Design Tokens | `docs/02-design/features/pwa-mobile-ux-mastering.tokens.md` |
| Design Shell | `docs/02-design/features/pwa-mobile-ux-mastering.shell.md` |
| Audit | `docs/04-report/pwa-mobile-ux-audit.md` |

## 3. 우선순위 / 작업 순서

### P0 — 즉시 수정 (블로커)

| # | 항목 | 파일 | 수용기준 |
|---|---|---|---|
| P0-1 | viewport 잠금 | `app/layout.tsx:20-25` | `maximumScale: 1, userScalable: true` 추가 |
| P0-2 | 디자인 토큰 신설 | `tailwind.config.ts`, `app/globals.css` | tokens.md §7,§8 그대로 적용 |
| P0-3 | LogoutButton 표준화 | `app/(admin)/_logout-button.tsx` | `bg-danger text-white` (21:1) + `min-h-11 min-w-11` + 16px+ |
| P0-4 | AccessibleConfirmDialog | `components/ui/AccessibleConfirmDialog.tsx` (신설) | `window.confirm()` 대체, role="alertdialog" |
| P0-5 | citizen 로그아웃 | `app/citizen/_home-client.tsx:139` | LogoutButton 재사용 |
| P0-6 | consent 로그아웃 | `app/(auth)/consent/_consent-client.tsx:193` | LogoutButton 재사용 |
| P0-7 | 통합 로그인 화면 + role 라우팅 | `app/(auth)/login/page.tsx`, `lib/auth/role-route.ts` | 56px 필드 + 18px 라벨 + role→경로 매트릭스 |

**P0 수용기준 (게이트)**: Lighthouse Accessibility ≥ 95, Playwright × 4 viewport 신규 baseline 통과, 사용자 보고 결함 3건 모두 회귀 없음.

### P1 — 이번 사이클 (디자인 시스템 안착)

| # | 항목 | 범위 | 수용기준 |
|---|---|---|---|
| P1-1 | `text-[10-13px]` 일괄 마이그레이션 | admin/performance, attendance, weather-alert, daily-treatment, _admin-shell | 모든 본문 정보 ≥ 14px (라벨/표 셀 16px 권장, AAA 18px 본문) |
| P1-2 | `text-xs` (12px) → `text-sm`/`text-base` 마이그레이션 | 356 occurrences | 본문 16px+, 캡션만 14px 허용 |
| P1-3 | `text-slate-{200,300,500,600}` → 토큰 | 184 occurrences | 토큰만 사용, 직접 slate 금지 (회귀 룰) |
| P1-4 | 공용 AppBar / BottomTab / Drawer 컴포넌트화 | `components/shell/` 신설 | shell.md 사양 |
| P1-5 | 4-role 셸 적용 | (admin)/_admin-shell, worker/_*, citizen/_home-client | 동일 컴포넌트 사용 |
| P1-6 | focus-visible 글로벌 + 폼 label 페어링 | globals.css + 폼 페이지 | `focus:outline-none` 단독 사용 0건 |
| P1-7 | RAPID 메뉴 분기 검증 | worker 메뉴 데이터 | 일반 worker는 '최적경로계산' 비표출 |

**P1 수용기준**: gap-detector matchRate ≥ 90%, axe E2E 위반 0건, 4-role × 4 viewport visual baseline 통과.

### P2 — 다음 사이클

- `text-ink-faint` 컨텍스트별 토큰 분리 (light/dark)
- `prefers-reduced-motion` 글로벌 적용 (이미 P0-2 토큰에 포함되므로 자동)
- 데스크탑 전용 화면 재설계 (별도 이니셔티브)

## 4. 작업 흐름 (Do)

```
1. P0-2 토큰 신설      → tailwind.config.ts + globals.css
2. P0-1 viewport       → app/layout.tsx (1줄)
3. P0-4 ConfirmDialog  → components/ui/AccessibleConfirmDialog.tsx
4. P0-3 LogoutButton   → 새 컴포넌트로 재작성
5. P0-5,6 재사용 적용  → citizen, consent 페이지 1줄씩
6. P0-7 로그인 + 라우팅 → page.tsx + role-route helper
7. → P0 게이트 통과 확인 (수동 시각 + dev 서버 4 viewport)
8. P1-4 공용 셸 컴포넌트 → components/shell/
9. P1-5 4-role 셸 적용  → 페이지별 (병렬 가능)
10. P1-1,2,3 토큰 마이그 → 페이지별 (병렬 가능)
11. P1-6 focus + label  → globals.css + 폼 페이지 일괄
12. P1-7 RAPID 검증     → 메뉴 데이터 + Playwright 시나리오
13. → P1 게이트 통과 확인 (gap-detector + qa)
```

## 5. 회귀 방지

### 코드 레벨
- `tailwind.config.ts` 의 `colors.ink` 외 직접 slate 사용 금지 — ESLint custom 또는 stylelint
- `components/ui/LogoutButton.tsx` 외 다른 곳에서 로그아웃 버튼 자체 구현 금지 (grep 검사)
- `app/layout.tsx` viewport에 `maximumScale` 키 존재 여부 검사 (test 추가)

### 문서 레벨
- `docs/mobile-history.md` 에 본 이니셔티브 결과 추가
- `docs/02-design/features/pwa-mobile-ux-mastering.*.md` 가 디자인 시스템 단일 소스 (다른 design.md 보다 상위 우선)

### 테스트 레벨
- Playwright × 4 viewport (320 / 375 / 768 / 1280) × 4 role 핵심 시나리오 (login → home → logout)
- axe-core E2E 통합 — `e2e/a11y.spec.ts` 에 본 이니셔티브 페이지 추가
- Visual regression baseline 갱신

## 6. 일정 (목표)

| 단계 | 예상 작업량 |
|---|---|
| P0 (토큰 + viewport + LogoutButton + 로그인 + ConfirmDialog) | 1-2 회기 |
| P1 (공용 셸 + 4-role 적용 + 토큰 마이그) | 2-3 회기 |
| 검증 (gap-detector + qa-strategist + Playwright) | 1 회기 |
| 보고 + 회귀 룰 | 0.5 회기 |

## 7. Pre-mortem 요약 (PRD §Pre-mortem 참조)

- **위험 1**: P0 도중 부분 패치 유혹 → 토큰을 먼저 깔아 의존성 제약으로 차단.
- **위험 2**: AAA 색상 제약이 브랜드 미려함 충돌 → cyan-700 (#0e7490) 유지하되 본문 텍스트는 ink 토큰만 사용.
- **위험 3**: 핀치 줌 잠금이 지도 충돌 → `user-scalable=yes` 유지로 회피 (확정).
- **위험 4**: 시니어 일부 큰 글씨 거부 → 본문 18px는 AAA 기본, 사용자 설정으로 14px 모드 제공 (P2 검토).
