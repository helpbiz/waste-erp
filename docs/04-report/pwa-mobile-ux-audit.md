# PWA Mobile UX Audit — WCAG 2.1 AAA

작성일: 2026-04-28
대상: CleanERP (wci.helpbiz.kr) — 4-role (company / manager / muni / worker) + 시민
감사자: code-analyzer (자동) + 직접 grep 보강

## 통계 (요약)

| 분류 | 건수 | 비고 |
|---|---|---|
| **P0** (즉시 수정) | **5** | 사용자가 사용 못 함 / 보안·동선 차단 |
| **P1** (이번 사이클) | **6 카테고리, ~600 occurrences** | AA 위반 또는 AAA 핵심 미달 |
| **P2** (다음 사이클) | **2 카테고리** | AA 통과 / AAA 미달 |

| Token | 정의 (tailwind.config.ts) | 흰색 배경 대비 | sidebar(#1e3a5f) 대비 | 평가 |
|---|---|---|---|---|
| `text-ink` | #000000 | 21:1 | 16.7:1 | ✅ AAA |
| `text-ink-mid` | #0f172a | 18.7:1 | 14.9:1 | ✅ AAA |
| `text-ink-muted` | #1e293b | 15.6:1 | 12.5:1 | ✅ AAA |
| `text-ink-faint` | #475569 | 7.0:1 | 5.6:1 | ⚠️ AA only on white |
| `text-slate-200` | #e2e8f0 | **1.16:1** | 12.4:1 | ❌ 흰색에서 거의 안 보임 |
| `text-slate-300` | #cbd5e1 | **1.5:1** | 9.3:1 | ❌ 흰색에서 안 보임 |
| `text-slate-500` | #64748b | 4.8:1 | 3.8:1 | ❌ AAA fail (AA borderline) |
| `text-slate-600` | #475569 | 7.0:1 | 5.6:1 | ⚠️ AA only on white |
| `text-white/70` | rgba(255,255,255,.7) | n/a | ~9:1 | ⚠️ AAA fail on light bg |
| `text-white/50` | rgba(255,255,255,.5) | n/a | ~6:1 | ❌ AAA fail |

`text-slate-500` 이하 + `text-ink-faint` (흰색이 아닌 배경) 가 광범위하게 쓰여 AAA 일괄 미달.

---

## P0 — 즉시 수정 (사용자가 사용 못 함)

### P0-1. LogoutButton — 흰색 배경에서 거의 보이지 않음 (사용자가 직접 보고)
- 파일: `app/(admin)/_logout-button.tsx:28-35`
- 코드:
  ```tsx
  className="text-[12px] font-extrabold tracking-tight
             text-slate-200 hover:text-red-300
             hover:underline underline-offset-2
             ..."
  ```
- 문제:
  1. **`text-slate-200` 하드코딩 (#e2e8f0)** — admin sidebar(#1e3a5f) 에선 12.4:1 OK 이지만, 같은 컴포넌트가 `app/worker/profile/_profile-client.tsx:197` 의 **흰색 카드** 안에 재사용되어 **대비 1.16:1 → 사실상 비가시**.
  2. **12px** — 고령자 가독성 18px+ 미달.
  3. 배경/테두리 없음 + hover-only underline → 모바일에선 평소 단순 회색 텍스트로 보임.
  4. 터치타겟 `px-1 py-0.5` ≈ 16×16px → WCAG 2.5.5(권장 44×44px) 위반.
  5. `window.confirm()` 사용 → 모바일/PWA에서 비표준 동작, 다이얼로그 디자인 통제 불가.
- 위반 기준: WCAG 1.4.6(Contrast Enhanced), 1.4.4(Resize Text — 18px), 2.5.5(Target Size), 3.3.4(Error Prevention)
- 권장: 디자인 토큰 D-1 사양 (`bg-danger text-white` 21:1 + `min-h-11 min-w-11` + 자체 AccessibleConfirmDialog) — design 문서 참조

### P0-2. PWA viewport — 자유 줌 가능 (사용자가 직접 보고)
- 파일: `app/layout.tsx:20-25`
- 코드:
  ```ts
  export const viewport: Viewport = {
    themeColor: '#0e7490',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
  ```
- 문제: `maximumScale` / `userScalable` 미설정 → 핀치 줌으로 화면이 끌려 "앱 같지 않음".
- 위반 기준: PWA 모범사례 + 사용자 직접 컴플레인.
- 권장: `maximumScale: 1, userScalable: true` 추가 (확정 결정 — `user-scalable=no` 는 접근성 안티패턴이므로 제외).

### P0-3. citizen 홈 로그아웃 — 11px (admin LogoutButton 보다 더 심함)
- 파일: `app/citizen/_home-client.tsx:139`
- 코드:
  ```tsx
  <button onClick={logout} className="text-[11px] font-bold text-ink-faint hover:text-danger">
  ```
- 문제: 11px + `text-ink-faint`(#475569 on white = 7.0:1, 본문 OK 이지만 11px 본문 미달) + 호버 의존.
- 위반 기준: WCAG 1.4.4 (18px 본문), 2.5.5 (터치타겟).
- 권장: 통합 LogoutButton 표준 적용.

### P0-4. consent 페이지 "동의 안 함 / 로그아웃" 12px + faint
- 파일: `app/(auth)/consent/_consent-client.tsx:193`
- 코드:
  ```tsx
  className="text-[12px] font-extrabold tracking-tight text-slate-600 hover:text-red-500 hover:underline ..."
  ```
- 문제: 12px + `text-slate-600`(#475569) + hover-only underline. 동의 거부는 사용자 권리 행사이므로 시인성 핵심.
- 위반 기준: WCAG 1.4.4, 1.4.6, 2.5.5.
- 권장: 보조 actions 도 18px 본문 + 명확 outlined 버튼 패턴.

### P0-5. login 페이지 푸터 10-11px white/50 (대비 6:1, AAA fail)
- 파일: `app/(auth)/login/page.tsx:213`
- 코드:
  ```tsx
  <div className="text-center mt-3 sm:mt-6 text-[10px] sm:text-[11px] font-semibold text-white/50">
  ```
- 문제: 10-11px + 50% 투명도 → AAA 미달 + 가독성 매우 낮음.
- 위반 기준: WCAG 1.4.6.
- 권장: 14px+ + `text-white/85` 이상.

---

## P1 — 이번 사이클 (AA 위반 또는 AAA 핵심 미달)

### P1-1. `text-[10-13px]` 명시 사용 (≥40 occurrences)
- 영향 파일 (대표):
  - `app/(admin)/_admin-shell.tsx:112,116,120,156,198,219` — 헤더 배지 / 권한 표시 9-11px
  - `app/(admin)/performance/_performance-client.tsx` — 폼 라벨/표 셀 **20+ occurrences** at 10-11px
  - `app/(admin)/attendance/_attendance-client.tsx:69,89,103,109,138` — 표 헤더/셀 10-13px
  - `app/(admin)/safety/_weather-alert.tsx` — 직원 선택 / 알림 모달 10-11px
  - `app/(admin)/reports/daily-treatment/_daily-treatment-tab.tsx` — 폼 라벨 10px
  - `app/(admin)/vehicles/print/_print-client.tsx` — 인쇄용은 예외 OK
- 위반 기준: WCAG 1.4.4 — 본문 18px (AAA) / 16px (AA).
- 권장:
  - 폼 라벨: `text-[10-11px]` → `text-sm font-bold` (14px) 또는 토큰 `text-label` (16px+).
  - 표 셀: `text-[10-11px]` → `text-base` (16px) 최소.
  - 헤더 배지/권한: 시각적 강조 위해 작게 쓰는 건 OK 이나 **본문 정보** 가 아닌 경우만 — 권한 표시는 **본문 정보** 이므로 14px+.

### P1-2. `text-xs` (12px) 광범위 사용 (356 occurrences)
- 본문/라벨에 12px 일괄 적용 — AAA 18px / AA 16px 모두 미달.
- 권장: 토큰 마이그레이션
  - 본문 → `text-base` (16px) 또는 `text-[18px]` (AAA 권장).
  - 캡션/메타 → `text-sm` (14px) — 본문이 아닌 보조 정보만.
  - 표 셀 (밀도 우선) → 최소 `text-sm` (14px).

### P1-3. `text-slate-{200,300,500,600}` 직접 사용 (184 occurrences)
- 토큰화 안 된 회색 → 다크/라이트 배경 컨텍스트와 무관하게 사용됨.
- 대표:
  - `app/(admin)/_admin-shell.tsx:143,158,176` — sidebar text-slate-{200,300}
  - `app/(admin)/performance/_performance-client.tsx` — 표 셀 text-slate-{500,600,700}
- 권장: 디자인 토큰 (`text-on-sidebar`, `text-ink-secondary` 등) 으로 컨텍스트별 매핑.

### P1-4. `text-sm` (14px) 광범위 사용 (440 occurrences)
- AA(16px) 미달, AAA(18px) 미달. 본문 거의 모두 14px.
- 권장: 본문 기본을 16px로 상향, 14px 는 캡션/secondary 만.

### P1-5. `focus:outline-none` 후 `focus:ring` 또는 `focus-visible` 미사용 (70 occurrences)
- 키보드 사용자가 포커스 위치 인지 불가 → WCAG 2.4.7 (Focus Visible) 위반.
- 권장: 글로벌 `focus-visible:ring-2 ring-accent ring-offset-2` 룰 강제 (globals.css 에서 `*:focus-visible`).

### P1-6. 폼 input — 명시적 label 또는 `aria-label` 누락 (~20 occurrences)
- 대표:
  - `app/(admin)/performance/_performance-client.tsx` — date/number/text input 10+ 개에 `<label>` 분리되어 있으나 `htmlFor` 미연결.
  - `app/(admin)/safety/_weather-alert.tsx:249,253` — 라디오에 라벨 텍스트만 옆에 있고 `aria-label` 없음.
- 권장: `htmlFor`/`id` 페어링 또는 `aria-label` 명시.

---

## P2 — 다음 사이클 (AAA 미달, AA 통과)

### P2-1. `text-ink-faint` (#475569) 사용 — 흰색에서만 AAA 통과
- 184 건 중 sidebar/소프트 배경 위 사용은 AAA 미달.
- 권장: 컨텍스트별 토큰 분리 (`text-ink-faint-on-light` vs `text-ink-faint-on-dark`).

### P2-2. 모션 — `prefers-reduced-motion` 미지원
- `transition-colors duration-150`, `animate-pulse`, `active:scale-95` 등이 광범위.
- 권장: 글로벌 `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` 추가.

---

## role별 분포 (P0 + P1 핵심)

| role | P0 | P1 (대략) | 위험도 |
|---|---|---|---|
| common (`app/layout.tsx`, `_logout-button`, `components/`) | 2 | 광범위 | **★★★** |
| admin (`(admin)/_admin-shell`, performance, attendance, users, safety) | 0 | 매우 광범위 (300+) | **★★★** |
| auth (`(auth)/login`, `consent`) | 2 | 중간 | ★★ |
| worker (`worker/*`) | 0 (간접 P0-1) | 중간 | ★★ |
| citizen (`citizen/_home-client`) | 1 | 중간 | ★★ |

**해석**: 사용자가 보고한 "어떤 화면에선 흐려서 안 보임" 의 정체 = `LogoutButton` 이 **흰색 카드** 에서 사용될 때(worker/profile). admin sidebar 는 우연히 OK.

---

## 권장 수정 순서

1. **viewport 메타** — 1줄 (P0-2) → 즉시 PWA 체감 개선.
2. **디자인 토큰 신설** (`tailwind.config.ts` + `globals.css`) — 모든 후속 수정의 전제.
3. **LogoutButton 표준화** (P0-1, P0-3, P0-4) — `bg-danger text-white` + 44px + AccessibleConfirmDialog.
4. **공용 로그인 셸 + 푸터** (P0-5) → 4-role 라우팅 확정.
5. **`text-xs` / `text-sm` / `text-[10-13px]` 일괄 마이그레이션** (P1-1,2,3,4) — 페이지별 순차.
6. **focus-visible 글로벌** + 폼 label (P1-5,6) — 회귀 방지.

회귀 방지 제안: ESLint custom rule 또는 stylelint 로 `text-[1[0-3]px]`, `text-slate-{200,300,500}` (흰색 컨텍스트) 차단.
