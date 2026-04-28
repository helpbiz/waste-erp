# CleanERP PWA — 전면 UI 아키텍처 재설계 제안서

> 기준일: 2026-04-28
> 목표: "이번엔 진짜 호평 받는 어플" — 고령자 페르소나 우선, 부분 패치 금지, 전면 재설계
> 세부 토큰: `pwa-mobile-ux-mastering.tokens.md`
> 셸 아키텍처: `pwa-mobile-ux-mastering.shell.md`

---

## 배경 및 문제 진단

Wave 1–4를 통해 레이아웃 구조는 개선됐으나 세 가지 근본 문제가 미해결 상태다.

| # | 문제 | 현상 | 위반 기준 |
|---|---|---|---|
| 1 | 로그아웃 시인성 | 12px / text-slate-200 / 터치타겟 ~24px | WCAG 2.5.5 (44px), 1.4.6 (AAA 7:1) |
| 2 | viewport 자유 줌 | `maximumScale` 미설정 → iOS 자동 zoom | PWA UX 확정 요구사항 |
| 3 | 4-role UI 일관성 | AdminShell ↔ WorkerShell 디자인 언어 분리 | 제품 응집성 |

이번 재설계는 토큰·셸·로그인·컴포넌트 표준을 동시에 확정하여 일회성 수정이 아닌 **지속 가능한 설계 기반**을 구축한다.

---

## A. Design Token System

세부 정의: `pwa-mobile-ux-mastering.tokens.md`

### 핵심 결정

**1. 본문 대비 15.3 : 1 (AAA 7:1의 2배 이상)**
- `--ink` (#0f172a) on `--bg-surface` (#ffffff)
- 야외 환경 + 고령자 시력 저하 대응

**2. Pretendard Variable 단일 스택으로 통일**
- 현재 `tailwind.config.ts`의 `font-sans`가 `Noto Sans KR`를 1순위로 가리키고 있음 → 교체 필요
- `globals.css`에 이미 `@font-face` 선언 존재 — Tailwind fontFamily와 동기화

**3. 18px 본문 기준 타이포 스케일**

```
caption    14px — 순수 정보 표시만
body-sm    16px — 보조 설명
body       18px — 본문 기본 (AAA 강제)
label      16px — 폼 라벨 최소
subheading 18px — 카드 제목
heading    22px
display    28px — 페이지 대제목
```

**4. Semantic color 구분 명확화**

기존 `globals.css`에 산재한 `text-ink`, `text-ink-muted` 등은 Tailwind 토큰으로 이전. CSS 변수 이중 관리 금지.

---

## B. App Shell Architecture

세부 정의: `pwa-mobile-ux-mastering.shell.md`

### 핵심 결정

**1. 단일 Shell 패턴**

role 분기는 nav 데이터(배열) 레벨에서만 처리. 레이아웃 로직은 `AdminShell`/`WorkerShell` 두 개로 유지 (admin은 사이드바, worker는 Bottom Tab의 특성이 근본적으로 다름). 그러나 `AppBar`, `LogoutButton`, `AccessibleConfirmDialog` 등 원자 컴포넌트는 공용화.

**2. 반응형 분기 확정**

| 범위 | 레이아웃 |
|---|---|
| < 768px | AppBar + Bottom Tab 5개 |
| ≥ 768px | Sidebar 240px + Header |

**3. 헤더 우상단 로그아웃 — 항상 보임**

- 모바일: AppBar 우측 아바타 → Sheet 열기 → 시트 내 로그아웃 버튼 (AAA)
- 데스크탑: Header 우상단 LogoutButton (AAA, red bg, 44px)

### 정보 위계 (모바일)

```
AppBar (54px)
  ← 뒤로가기    [페이지 제목 + 역할 뱃지]    아바타 →
─────────────────────────────────────────────
  본문 스크롤 영역 (flex-1, overflow-y-auto)
─────────────────────────────────────────────
Bottom Tab (64px + safe-area)
  [홈] [출퇴근] [민원] [안전] [실적]
```

모바일에서 깊이 제한 3단계: Tab → 목록 → 상세. 상세에서 더 들어가는 경우 Bottom Sheet 사용.

---

## C. Unified Login Screen

### 설계 원칙

- 4-role 선택 UI 없음. ID/PW 입력 → 서버 응답의 `user.role`로 자동 라우팅.
- 큰 입력 필드(56px), 큰 라벨(18px), 명확한 에러 메시지.
- PWA 설치 배너: iOS `beforeinstallprompt` / Android A2HS 유도.

### 화면 구조

```
┌─────────────────────────────────────────┐
│  [상단 여백 safe-area]                   │
│                                         │
│  [로고 영역]                             │
│  CleanERP                               │
│  생활폐기물 수집운반 관리시스템           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 아이디 (라벨 18px bold)           │  │
│  │ [입력 필드 56px 높이]             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 비밀번호 (라벨 18px bold)         │  │
│  │ [입력 필드 56px] [눈 아이콘 44px] │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [캡스락 경고 배너 — 조건부]             │
│  [에러 메시지 영역 — 조건부]             │
│                                         │
│  [로그인 버튼 CTA 56px, 100%, brand]    │
│                                         │
│  [PWA 설치 안내 배너 — 조건부]          │
│                                         │
│  [버전 정보 14px / --ink-faint]         │
└─────────────────────────────────────────┘
```

### 로그인 후 라우팅 매트릭스

```typescript
// app/api/auth/login/route.ts 기반
function redirectByRole(role: string): string {
  switch (role) {
    case 'COMPANY':  return '/admin';
    case 'MANAGER':  return '/admin';
    case 'MUNI':     return '/admin/super-admin';
    case 'WORKER':   return '/worker';
    default:         return '/login?error=invalid_role';
  }
}
```

RAPID 메뉴 노출: `/worker` 진입 후 `WorkerLayout`에서 `position.code === 'RAPID'` 확인 → 홈 그리드에 최적경로 카드 추가 (현재 구현 유지).

### 접근성 요구사항

| 요소 | 사양 |
|---|---|
| 입력 라벨 | `htmlFor` 연결 필수, 18px, --ink |
| 에러 메시지 | `role="alert"`, `aria-live="polite"`, 16px, --danger |
| 비밀번호 토글 | `aria-label="비밀번호 보기/숨기기"`, 44×44px |
| 캡스락 경고 | `onKeyUp` → `event.getModifierState('CapsLock')` |
| 로그인 버튼 | `type="submit"`, 56px 높이, 100% 너비 |
| PWA 배너 | `aria-label="앱 설치하기"` |

### 에러 메시지 표준

```
잘못된 아이디 또는 비밀번호입니다.
  → ID/PW 오류 통합 (보안: 어느 쪽 틀렸는지 노출 금지)

서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.
  → 네트워크 오류

계정이 잠겼습니다. 관리자에게 문의해 주세요.
  → 5회 실패 락

[소문자] 경고: 캡스락이 켜져 있습니다.
```

---

## D. Component Standards

### D-1. LogoutButton (신규 표준)

**파일**: `components/shell/LogoutButton.tsx`

```typescript
interface LogoutButtonProps {
  variant?: 'header' | 'sidebar' | 'sheet'; // 컨텍스트별 스타일
}
```

| 속성 | 값 |
|---|---|
| 높이 | 44px (min) |
| 너비 | 최소 80px |
| 폰트 | 16px / font-semibold |
| 배경 | #b91c1c (danger) — 모든 variant 공통 |
| 텍스트 | #ffffff (21:1) |
| radius | 8px |
| 확인 다이얼로그 | AccessibleConfirmDialog (window.confirm 대체) |

기존 `/app/(admin)/_logout-button.tsx` 는 위 표준 컴포넌트를 import하도록 리팩토링.

### D-2. PrimaryCTA

Wave 2 확정 — 유지.

```
높이: 56px
너비: 100% (모바일) / auto min-width 160px (데스크탑)
배경: --brand (#0e7490)
텍스트: #ffffff / 18px / font-bold
radius: 10px
shadow-btn: 0 2px 4px rgba(14,116,144,0.25)
loading: Spinner (20px) 인라인
disabled: opacity 0.5, cursor-not-allowed
```

### D-3. Field (Input / Select)

```
높이: 56px
라벨: 18px / font-bold / --ink (위쪽, 항상 노출 — placeholder 라벨 대체 금지)
입력 폰트: 18px / --ink
border: 1.5px solid --line
border (focus): 2px solid --brand
border (error): 2px solid --danger
radius: 10px
padding: 0 16px
에러 메시지: 14px / --danger / margin-top 6px / role="alert"
```

### D-4. Card

```
배경: --bg-surface
radius: 14px (radius-lg)
shadow: shadow-card
padding (모바일): 16px (space-4)
padding (데스크탑): 24px (space-6)
터치 가능 카드: min-height 56px, cursor-pointer
터치 가능 카드 active: scale(0.99) 150ms
```

### D-5. AccessibleConfirmDialog

`window.confirm` 전면 대체.

```
구조:
  <dialog> 기반 (native accessibility)
  제목: 18px / font-bold / --ink
  설명: 16px / --ink-muted
  [취소] 버튼: outlined, 56px, --ink 테두리
  [확인] 버튼: --danger 채움, 56px, #ffffff 텍스트
  backdrop: rgba(0,0,0,0.5)
  modal radius: 20px
  ESC 닫기 지원

  aria-modal="true"
  aria-labelledby 제목 연결
  focus trap (취소 ↔ 확인 사이클)
  확인 버튼에 자동 포커스
```

### D-6. LoadingSkeleton (Wave 2 기반)

```
animation: shimmer (좌→우 그라디언트)
duration: 1.5s infinite
색상: --bg-surface-soft → --line → --bg-surface-soft
radius: 상황에 맞게 (텍스트용 4px, 카드용 14px)
```

### D-7. Toast (Wave 2 기반 — `components/ui/Toast.tsx`)

```
위치: 하단 중앙, Bottom Tab 위 (bottom: 80px + safe-area)
너비: min 280px, max 90vw
폰트: 16px / font-semibold / #ffffff
배경: 타입별 (success: #166534 / danger: #991b1b / info: #1e3a8a)
radius: 10px
shadow: shadow-modal
자동 소멸: 4초
gesture: 좌우 스와이프로 닫기
```

---

## 구현 우선순위

| 우선순위 | 작업 | 파일 | 이유 |
|---|---|---|---|
| P0 | viewport maximumScale 추가 | `app/layout.tsx:20-25` | 즉시 UX 개선, 1줄 수정 |
| P0 | LogoutButton AAA 표준화 | `_logout-button.tsx` | WCAG 위반 해소 |
| P0 | tailwind.config.ts 토큰 교체 | `tailwind.config.ts` | 전체 토큰 기반 |
| P1 | Pretendard font-sans 1순위 | `tailwind.config.ts` | 한글 가독성 |
| P1 | AccessibleConfirmDialog | 신규 컴포넌트 | window.confirm 대체 |
| P1 | UnifiedLogin 화면 | `app/login/page.tsx` | 4-role 공용 |
| P2 | AdminShell Header LogoutButton 교체 | `_admin-shell.tsx` | 일관성 |
| P2 | 타이포 스케일 적용 (body 18px) | 전체 페이지 | AAA 완성 |
| P3 | Worker AppBar LogoutButton 통합 | `components/worker/AppBar.tsx` | 공용화 |

---

## 품질 검증 체크리스트

### 색상 대비 AAA (7:1+)

- [ ] 본문 텍스트: `#0f172a` on `#ffffff` → 15.3:1
- [ ] 부제목: `#1e293b` on `#ffffff` → 12.6:1
- [ ] 캡션: `#334155` on `#ffffff` → 8.1:1
- [ ] 로그아웃 버튼: `#ffffff` on `#b91c1c` → 21:1
- [ ] 사이드바 메뉴: `#e2e8f0` on `#0f172a` → 13.1:1
- [ ] 활성 메뉴: `#67e8f9` on `#0f172a` → 9.4:1

### 터치 타겟 (44×44px+)

- [ ] 로그아웃 버튼: 44px height
- [ ] Bottom Tab 각 항목: 64px height
- [ ] Nav Item (사이드바): 44px height
- [ ] 비밀번호 토글: 44×44px
- [ ] 뒤로가기 버튼: 44×44px
- [ ] 모든 링크·버튼: 최소 44px

### 폰트 크기

- [ ] 본문: 18px+
- [ ] 폼 라벨: 18px+
- [ ] 버튼 텍스트: 16px+
- [ ] 에러 메시지: 16px+

### PWA 뷰포트

- [ ] `maximumScale=1` 설정
- [ ] `userScalable=true` 설정
- [ ] `viewportFit=cover` 유지

### RAPID 메뉴

- [ ] `position.code === 'RAPID'` 조건 확인
- [ ] 홈 그리드에 최적경로 카드 노출
- [ ] 일반 WORKER에게 미노출

---

## 참조

- 세부 토큰 정의: `docs/02-design/features/pwa-mobile-ux-mastering.tokens.md`
- 셸 아키텍처: `docs/02-design/features/pwa-mobile-ux-mastering.shell.md`
- 기존 셸: `app/(admin)/_admin-shell.tsx`
- Worker 셸: `app/worker/_layout-shell.tsx`
- 현재 tailwind 토큰: `tailwind.config.ts`
- 글로벌 CSS: `app/globals.css`
