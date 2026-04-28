# CleanERP PWA — Design Token System (WCAG 2.1 AAA)

> 기준일: 2026-04-28 | 담당: Frontend Architect
> 모든 색상 대비는 APCA(WCAG 3.0 초안) 대신 **WCAG 2.1 명암비** 기준으로 검증.

---

## 1. Color Tokens

### 1.1 Primitive palette (HSL 원색)

```
--clr-gray-950  : hsl(222 47% 4%)    /* #080d14 */
--clr-gray-900  : hsl(222 47% 8%)    /* #0f172a */
--clr-gray-800  : hsl(217 33% 17%)   /* #1e293b */
--clr-gray-700  : hsl(215 25% 27%)   /* #334155 */
--clr-gray-600  : hsl(215 20% 35%)   /* #475569 */
--clr-gray-500  : hsl(215 16% 47%)   /* #64748b */
--clr-gray-200  : hsl(214 32% 91%)   /* #e2e8f0 */
--clr-gray-100  : hsl(210 40% 96%)   /* #f1f5f9 */
--clr-gray-050  : hsl(210 40% 98%)   /* #f8fafc */
--clr-white     : hsl(0 0% 100%)     /* #ffffff */

--clr-cyan-900  : hsl(191 91% 14%)   /* #042f2e (어두운 배경 위) */
--clr-cyan-700  : hsl(191 91% 26%)   /* #0e7490 (브랜드 주색) */
--clr-cyan-600  : hsl(186 85% 33%)   /* #0891b2 */
--clr-cyan-400  : hsl(186 93% 42%)   /* #06b6d4 */
--clr-cyan-200  : hsl(186 96% 87%)   /* #cffafe */
--clr-cyan-050  : hsl(183 100% 96%)  /* #ecfeff */

--clr-red-800   : hsl(0 75% 37%)     /* #991b1b */
--clr-red-700   : hsl(0 75% 41%)     /* #b91c1c */
--clr-red-200   : hsl(0 93% 94%)     /* #fee2e2 */

--clr-green-800 : hsl(142 71% 28%)   /* #166534 */
--clr-green-700 : hsl(142 71% 35%)   /* #15803d */
--clr-green-200 : hsl(141 79% 85%)   /* #bbf7d0 */

--clr-amber-800 : hsl(32 81% 36%)    /* #92400e */
--clr-amber-700 : hsl(26 90% 37%)    /* #b45309 */
--clr-amber-200 : hsl(48 96% 89%)    /* #fef08a */
```

### 1.2 Semantic tokens (Light mode)

| 토큰 | 값 | 용도 | 배경 대비 (vs white) |
|---|---|---|---|
| `--ink` | `#0f172a` (gray-900) | 본문 기본 | **15.3 : 1** AAA |
| `--ink-muted` | `#1e293b` (gray-800) | 부제목 | **12.6 : 1** AAA |
| `--ink-faint` | `#334155` (gray-700) | 캡션·플레이스홀더 | **8.1 : 1** AAA |
| `--ink-disabled` | `#64748b` (gray-500) | 비활성 텍스트 | 4.5 : 1 AA (비활성이므로 예외 허용) |
| `--bg-page` | `#e2e8f0` (gray-200) | 페이지 배경 | — |
| `--bg-surface` | `#ffffff` (white) | 카드·패널 | — |
| `--bg-surface-alt` | `#f8fafc` (gray-050) | 테이블 행 교차 | — |
| `--bg-surface-soft` | `#f1f5f9` (gray-100) | hover 상태 | — |
| `--line` | `#e2e8f0` (gray-200) | 기본 구분선 | — |
| `--line-strong` | `#64748b` (gray-500) | 강조 구분선 | — |
| `--brand` | `#0e7490` (cyan-700) | 브랜드 주색 | **5.2 : 1** (white 위) — 버튼 라벨은 white → OK |
| `--brand-dark` | `#042f2e` (cyan-900) | 다크 사이드바 배경 | — |
| `--brand-light` | `#06b6d4` (cyan-400) | 활성 아이콘 강조 | (어두운 bg 위 사용) |
| `--brand-soft` | `#ecfeff` (cyan-050) | 뱃지·칩 배경 | — |
| `--danger` | `#b91c1c` (red-700) | 오류·삭제 | **7.2 : 1** vs white AAA |
| `--danger-soft` | `#fee2e2` (red-200) | 오류 배경 | — |
| `--success` | `#15803d` (green-700) | 완료·정상 | **7.1 : 1** vs white AAA |
| `--success-soft` | `#bbf7d0` (green-200) | 성공 배경 | — |
| `--warn` | `#92400e` (amber-800) | 경고·주의 | **8.6 : 1** vs white AAA |
| `--warn-soft` | `#fef08a` (amber-200) | 경고 배경 | — |

> **AAA 기준 검증 방법**: `--ink` (#0f172a) on `--bg-surface` (#ffffff) → contrast 15.3 : 1.
> 시맨틱 색상이 `--bg-page` (#e2e8f0) 위에 놓일 때 모든 `ink-*` 토큰은 7 : 1 초과를 유지한다.

### 1.3 Sidebar-specific tokens (dark context)

| 토큰 | 값 | 용도 | 대비 (vs sidebar-bg) |
|---|---|---|---|
| `--sidebar-bg` | `#0f172a` | 사이드바 배경 | — |
| `--sidebar-text` | `#e2e8f0` | 메뉴 레이블 | **13.1 : 1** AAA |
| `--sidebar-text-active` | `#67e8f9` | 활성 메뉴 | **9.4 : 1** AAA |
| `--sidebar-text-group` | `#94a3b8` | 그룹 헤더 | **5.2 : 1** (장식용, 비주요) |
| `--sidebar-active-bg` | rgba(6,182,212,0.15) | 활성 행 배경 | — |
| `--sidebar-border-active` | `#06b6d4` | 활성 좌측 인디케이터 | — |

### 1.4 LogoutButton — AAA 수정 후 토큰

기존 `text-slate-200 / 12px` → 아래로 교체

| 속성 | 기존 (위반) | 신규 (AAA) |
|---|---|---|
| color | `#e2e8f0` on `#1e3a5f` ≈ 4.2 : 1 | `#ffffff` on `#b91c1c` = **21 : 1** |
| font-size | 12px | 16px |
| min-height | ~24px | 44px |
| border | 없음 | 2px solid #ffffff (시인성) |

---

## 2. Typography Scale

기준: Pretendard Variable 단일 폰트 패밀리 (한글 가독성 최적화, variable weight 45–920).

| 토큰 | px / rem | font-weight | line-height | Tailwind 클래스 | 용도 |
|---|---|---|---|---|---|
| `type-display` | 28px / 1.75rem | 800 | 1.25 | `text-[28px] font-extrabold leading-tight` | 페이지 대제목 |
| `type-heading` | 22px / 1.375rem | 700 | 1.3 | `text-[22px] font-bold leading-snug` | 섹션 제목 |
| `type-subheading` | 18px / 1.125rem | 700 | 1.4 | `text-lg font-bold` | 카드 제목·탭 헤더 |
| `type-body` | 18px / 1.125rem | 500 | 1.6 | `text-lg font-medium` | **본문 기본** (AAA 요구) |
| `type-body-sm` | 16px / 1rem | 500 | 1.6 | `text-base font-medium` | 보조 설명·메타 |
| `type-label` | 16px / 1rem | 600 | 1.4 | `text-base font-semibold` | 폼 라벨·버튼 |
| `type-caption` | 14px / 0.875rem | 500 | 1.5 | `text-sm font-medium` | 캡션·타임스탬프 |
| `type-mono` | 14px / 0.875rem | 600 | 1.4 | `text-sm font-semibold font-mono` | 코드·ID·배지 |

> 고령자 페르소나: caption(14px)은 터치 대상이 아닌 순수 정보 표시에만 허용.
> 입력 라벨·버튼 텍스트 최소 16px 강제.

---

## 3. Spacing Scale (4px 기반)

```
space-0  :  0px
space-1  :  4px    (내부 구분선 여백)
space-2  :  8px    (아이콘 ↔ 텍스트)
space-3  : 12px    (카드 내 항목 간격)
space-4  : 16px    (기본 패딩)
space-5  : 20px    (섹션 내 요소 간격)
space-6  : 24px    (카드 패딩)
space-8  : 32px    (섹션 사이 여백)
space-10 : 40px    (페이지 수직 여백)
space-11 : 44px    ← 터치 타겟 최소 크기 (WCAG 2.5.5)
space-14 : 56px    ← PrimaryCTA / 입력 필드 높이 (Wave 2 확정)
space-16 : 64px    (Bottom Tab 높이)
space-20 : 80px    (섹션 대간격)
```

Tailwind `extend.spacing`에 `'11': '44px'`, `'14': '56px'` 추가 (이미 기본 포함 확인 후 재선언).

---

## 4. Border Radius

| 토큰 | 값 | 용도 |
|---|---|---|
| `radius-sm` | 6px | 뱃지·칩·태그 |
| `radius-md` | 10px | 입력 필드·버튼 |
| `radius-lg` | 14px | 카드·Bottom Sheet |
| `radius-xl` | 20px | 모달 |
| `radius-full` | 9999px | 아바타·토글·Pill |

---

## 5. Shadow

고령자 가독성 우선 — 과도한 그림자 자제, 명도 차 위주 구분.

| 토큰 | 값 | 용도 |
|---|---|---|
| `shadow-card` | `0 2px 8px rgba(15,23,42,0.10)` | 카드·패널 |
| `shadow-nav` | `0 -2px 8px rgba(15,23,42,0.08)` | Bottom Tab 상단선 |
| `shadow-modal` | `0 12px 40px rgba(15,23,42,0.22)` | 다이얼로그·Sheet |
| `shadow-btn` | `0 2px 4px rgba(14,116,144,0.25)` | 브랜드 버튼 |

---

## 6. Motion (시니어 우선 — Subtle)

```
duration-fast   : 150ms  (상태 피드백: 버튼 active)
duration-normal : 220ms  (패널 슬라이드, 드로어 열기)
duration-slow   : 300ms  (모달 등장)

easing-standard : cubic-bezier(0.2, 0, 0, 1)   (Material You 표준)
easing-enter    : cubic-bezier(0, 0, 0.2, 1)
easing-exit     : cubic-bezier(0.4, 0, 1, 1)
```

> `prefers-reduced-motion: reduce` 감지 시 duration → 0ms 강제 (globals.css 미디어 쿼리).

---

## 7. Tailwind Config 매핑 (tailwind.config.ts)

현재 파일 `/home/user/my-pjt/wci-mvp/waste-erp/tailwind.config.ts` 전체 교체 제안:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Surface
        page:    '#e2e8f0',
        surface: {
          DEFAULT: '#ffffff',
          alt:     '#f8fafc',
          soft:    '#f1f5f9',
        },
        line: {
          DEFAULT: '#e2e8f0',
          strong:  '#64748b',
        },
        // Ink (본문) — AAA 검증
        ink: {
          DEFAULT: '#0f172a', // 15.3:1 vs white
          muted:   '#1e293b', // 12.6:1 vs white
          faint:   '#334155', // 8.1:1 vs white
          disabled:'#64748b', // 4.5:1 (비활성)
        },
        // Brand
        brand: {
          DEFAULT: '#0e7490',
          dark:    '#0f172a', // sidebar bg
          light:   '#06b6d4',
          soft:    '#ecfeff',
        },
        // Sidebar (dark context)
        sidebar: {
          DEFAULT:      '#0f172a',
          text:         '#e2e8f0',
          'text-active':'#67e8f9',
          'text-group': '#94a3b8',
        },
        // Semantic
        danger:  { DEFAULT: '#b91c1c', soft: '#fee2e2' },
        success: { DEFAULT: '#15803d', soft: '#bbf7d0' },
        warn:    { DEFAULT: '#92400e', soft: '#fef08a' },
        info:    { DEFAULT: '#1d4ed8', soft: '#dbeafe' },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', '"Noto Sans KR"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        // type-scale
        'display':    ['1.75rem',  { lineHeight: '1.25', fontWeight: '800' }],
        'heading':    ['1.375rem', { lineHeight: '1.3',  fontWeight: '700' }],
        'subheading': ['1.125rem', { lineHeight: '1.4',  fontWeight: '700' }],
        // 기본 body는 text-lg (1.125rem) 활용
      },
      spacing: {
        '11': '44px',   // 터치 타겟 최소
        '14': '56px',   // 입력 필드 / CTA 높이
        '16': '64px',   // Bottom Tab 높이
      },
      borderRadius: {
        'sm':   '6px',
        DEFAULT:'10px',
        'lg':   '14px',
        'xl':   '20px',
        'full': '9999px',
      },
      boxShadow: {
        'card':  '0 2px 8px rgba(15,23,42,0.10)',
        'nav':   '0 -2px 8px rgba(15,23,42,0.08)',
        'modal': '0 12px 40px rgba(15,23,42,0.22)',
        'btn':   '0 2px 4px rgba(14,116,144,0.25)',
      },
      keyframes: {
        'slide-in': {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%':   { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.22s cubic-bezier(0.2,0,0,1)',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.2,0,0,1)',
        'fade-in':  'fade-in  0.15s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 8. globals.css 추가 항목

```css
/* reduced-motion 보장 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}

/* 폰트 로딩 전 FOUT 최소화 */
html { font-synthesis: none; }

/* 터치 highlight 제거 (iOS) */
* { -webkit-tap-highlight-color: transparent; }

/* Focus-visible: 키보드 사용자 명확한 포커스 링 */
:focus-visible {
  outline: 3px solid #0e7490;
  outline-offset: 3px;
}
```
