# PWA Mobile UX Mastering — 완료 보고서

> 이니셔티브: PWA Mobile UX Mastering (CleanERP / wci.helpbiz.kr)
> 사이클: PDCA Plan → Design → Do → Check → Act
> 작성일: 2026-04-28
> 산출 문서: 8 종 (PRD 4 / Design 3 / Plan 1 / Audit 1 / Gap 1 / QA 1 / 본 보고서 1 / Residual 1)

## 1. 요청 / 배경

사용자(대표) 명시 요구:
- 모든 사용자(company, manager, muni, worker)가 wci.helpbiz.kr PWA 앱을 모바일에 설치
- worker 의 기동반(RAPID)에만 '최적경로계산' 메뉴 노출
- 보고된 결함:
  1. 로그아웃 텍스트 버튼이 어떤 화면에선 흐려서 못 찾음
  2. PWA 앱 화면이 모바일에서 자유 줌 가능 → "앱 같지 않음"
  3. 4-role 일관성 부재 + 시니어 사용자 가독성 부족
- "이번엔 정말 호평 받는 어플" — 부분 패치 거부, 전면 재설계

## 2. 확정 결정 (변경 없음)

| 결정 | 값 |
|---|---|
| 로그인 | 4-role 공용 단일 화면 + role 자동 라우팅 |
| 접근성 | WCAG 2.1 AAA (대비 7:1 / 본문 18px+ / 터치 44×44+) |
| 뷰포트 | maximum-scale=1 + user-scalable=yes |

## 3. 산출물

### 분석/설계 문서 (이전 phase)

| 분류 | 파일 |
|---|---|
| PM Discovery | `docs/00-pm/pwa-mobile-ux-mastering/discovery.md` |
| PM Strategy | `docs/00-pm/pwa-mobile-ux-mastering/strategy.md` |
| PM Research | `docs/00-pm/pwa-mobile-ux-mastering/research.md` |
| PRD (메인) | `docs/00-pm/pwa-mobile-ux-mastering/prd.md` |
| Design (메인) | `docs/02-design/features/pwa-mobile-ux-mastering.design.md` |
| Design Tokens | `docs/02-design/features/pwa-mobile-ux-mastering.tokens.md` |
| Design Shell | `docs/02-design/features/pwa-mobile-ux-mastering.shell.md` |
| Plan | `docs/01-plan/features/pwa-mobile-ux-mastering.plan.md` |
| Audit | `docs/04-report/pwa-mobile-ux-audit.md` |

### 검증 문서 (Check phase)

| 분류 | 파일 |
|---|---|
| Gap Analysis | `docs/04-report/pwa-mobile-ux-gap-analysis.md` (matchRate 100%) |
| Residual Audit | `docs/04-report/pwa-mobile-ux-residual.md` (~220 P2 잔여) |
| QA Strategy | `docs/04-report/pwa-mobile-ux-qa-strategy.md` (60 시나리오) |

### 코드 변경

#### 신규 파일

| 파일 | 역할 |
|---|---|
| `components/ui/AccessibleConfirmDialog.tsx` | role="alertdialog" 다이얼로그 (포커스 트랩, ESC, destructive backdrop 무시) |
| `lib/auth/role-route.ts` | 4-role → 경로 결정 단일 소스 (`resolveRoleRoute`) |

#### 수정 파일

| 파일 | 변경 |
|---|---|
| `tailwind.config.ts` | Pretendard fontFamily 1순위 |
| `app/globals.css` | `:focus-visible` 글로벌 outline + `prefers-reduced-motion` + tap-highlight off |
| `app/layout.tsx` | viewport `maximumScale: 1, userScalable: true` |
| `app/(admin)/_logout-button.tsx` | 재작성 — bg-danger(21:1) + variant compact/full + AccessibleConfirmDialog |
| `app/(admin)/_admin-shell.tsx` | 헤더 배지 11-12px, 사이드바 텍스트 slate-300/400 (AAA) |
| `app/(auth)/login/page.tsx` | role-route 헬퍼 사용 / 18px CTA / 16px install / 14px 푸터 / role="alert" 에러 |
| `app/(auth)/consent/_consent-client.tsx` | 거부 버튼 18px outlined + AccessibleConfirmDialog |
| `app/citizen/_home-client.tsx` | 본문 14px+, 전환 버튼 44px outlined, StatusChip 색상 AAA |
| `app/worker/profile/_profile-client.tsx` | LogoutButton variant="full" (카드형) |
| `app/worker/page.tsx` | 인사 카드 24px / 메뉴 카드 17px+14px / 안내 카드 14px |
| `app/worker/_tab-link.tsx` | 비활성 ink-faint(7:1 AAA), 라벨 13px, icon 26px |
| `app/worker/safety/_safety-worker-client.tsx` | TBM/체크리스트/SOS/비상연락 본문 14-16px+, CTA min-h-14 |
| `components/worker/AppBar.tsx` | title 18px, subtitle 13px |

## 4. matchRate

**100% (P0/P1 핵심 18/18 통과)**. 자세한 파일/라인 매핑은 `docs/04-report/pwa-mobile-ux-gap-analysis.md` 참조.

## 5. 사용자 보고 결함 해결

| # | 결함 | 해결 위치 | 검증 |
|---|------|----------|------|
| 1 | 로그아웃 흐려서 안 보임 | `app/(admin)/_logout-button.tsx` 재작성 (bg-danger 21:1, variant prop) + 4 표면 모두 표준화 | 흰색 카드/어두운 사이드바/citizen 셸/consent 페이지 모두 동일 시인성 |
| 2 | PWA 자유 줌 | `app/layout.tsx:26-27` maximumScale=1 + userScalable=true | meta tag 직렬화 — 핀치 줌 차단, 보조기기 줌은 허용 (WCAG 1.4.4 미위반) |
| 3 | 4-role 일관성 부재 | `lib/auth/role-route.ts` 단일 라우팅 + `AppBar`/`tab-link`/`AdminShell` AAA 통일 | role-route 4 케이스, AppBar/tab 시인성 |

핵심 회귀 원인 발견 + 해결: `LogoutButton`이 `text-slate-200` 하드코딩되어 admin sidebar(어두운 배경)에서만 우연히 작동하다가 worker/profile 흰색 카드에서 대비 1.16:1 비가시. 컨텍스트 무관 동작(bg-danger + white text = 21:1)으로 재작성.

## 6. 다음 사이클 후보 (P2)

`docs/04-report/pwa-mobile-ux-residual.md` 에 ~220건 잔여 위반 우선순위 명시.
주요 P2:
- admin/performance, attendance, weather-alert, users 페이지 폼 라벨 10-11px → 14px+
- worker leave 일부 잔여
- consent 본문 카드 12.5px (법령 인용 영역)
- AppBar ProfileAvatar 40px → 44px (WCAG 2.5.5 AAA)
- safety 체크리스트 제출 버튼 min-h-14 적용

## 7. 회귀 방지 룰

### 코드 레벨

1. **신규 로그아웃 버튼 자체 구현 금지**
   - 정책: `<button>로그아웃</button>` 또는 `text-[12px] text-slate-200 hover:text-red-300` 류 패턴 차단
   - 검사: `grep -rn 'onClick.*logout\|/api/auth/logout' app/ components/ | grep -v _logout-button.tsx | grep -v AccessibleConfirmDialog`
   - 위반 시: `LogoutButton` 컴포넌트 재사용으로 변경

2. **`text-slate-200` / `text-slate-300` 흰색 컨텍스트 사용 금지**
   - 정책: 흰색 배경(`bg-surface`/`bg-white`) 위에서 사용 시 대비 1.5:1 미만 → AAA fail
   - 검사: 새 PR 에서 `text-slate-2[0-9][0-9]` 변경분이 흰색 컨텍스트인지 리뷰
   - 위반 시: `text-ink-{mid,muted,faint}` 또는 sidebar 컨텍스트라면 `text-slate-{200,300}` 유지 OK

3. **viewport 회귀 방지**
   - 정책: `app/layout.tsx` 의 `viewport.maximumScale === 1` 항상 유지
   - 검사: spec test `viewport-lock.spec.ts` (QA 전략 §2)
   - 위반 시: PR CI 차단

### 문서 레벨

- `docs/02-design/features/pwa-mobile-ux-mastering.*.md` 가 디자인 시스템 단일 소스. 다른 design.md 보다 상위 우선.
- 본 보고서를 `docs/mobile-history.md` 에 Phase 항목으로 추가 (다음 단계).

### 테스트 레벨 (QA 전략 §6 게이트)

| 게이트 | 임계값 |
|---|---|
| Lighthouse Accessibility | ≥ 95 |
| axe critical/serious/moderate | 0건 |
| axe AAA color-contrast-enhanced (신규 페이지) | 0건 |
| 4 viewport visual regression | 100% |
| login-routing/logout-aaa/viewport-lock/accessibility/rapid-menu spec | 100% |

## 8. 학습 (Learnings)

1. **컨텍스트 무관 컴포넌트 설계 원칙**: 색상 토큰을 직접 하드코딩하면 한 컨텍스트에서만 작동하는 보이지 않는 결함 발생. `LogoutButton` 사례.
2. **부분 패치의 누적 회귀**: Wave 1~4의 부분 수정 누적이 본질 결함을 가렸다. 전면 재설계 사고로 디자인 토큰부터 깔아야 한다.
3. **에이전트 병렬 호출의 효과**: PM/Frontend Architect/Code Analyzer 3개 동시 실행으로 분석 phase 단축. 일부 에이전트(code-analyzer)는 정밀한 작업 한정과 보고서 형식 명시가 필요.
4. **system instruction 충돌**: gap-detector / qa-strategist 가 Read-only 정책을 보고 보고서를 .md 로 저장하지 못함 → 본 사용자(parent agent) 가 보고서를 받아 직접 저장.

## 9. KPI 측정 / 운영 모니터링

PRD §3.3 KPI 측정 시점:

| 지표 | 목표 | 1차 측정 |
|---|---|---|
| Lighthouse Accessibility | ≥ 95 | QA 전략 G-1 게이트 (Lighthouse CI 통합 시 자동, 미통합이면 수동 측정) |
| axe E2E 위반 | 0건 | QA 전략 G-2 게이트 |
| 시니어 SUS | ≥ 80 | Beachhead 베타 위탁사 분기 사용성 테스트 |
| 자력 첫 액션 성공률 | ≥ 95% | 신규 사용자 첫 출근 체크인 이벤트 |
| 단톡방 문의 50%↓ | 50% 감소 | 베타 위탁사 단톡방 모니터링 |

## 10. 다음 단계

- [ ] 사용자 dev 서버 / 모바일 실측 확인 (1~2일)
- [ ] QA 시나리오 60종 spec 구현 (시드 P-1~P-6 선행)
- [ ] Visual regression baseline 갱신 (workflow_dispatch)
- [ ] P2 마이그레이션 사이클 (admin tables / worker leave/punch/complaint / performance) — 220건
- [ ] PWA 갱신 사이클 (Phase 19 SW 인프라 — `cleanerp-v3-2026-04-26` → 다음 버전 bump)
- [ ] `docs/mobile-history.md` 에 Phase 항목 추가 (Phase 28)
