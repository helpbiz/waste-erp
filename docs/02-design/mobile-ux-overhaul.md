# 워커 PWA 모바일 UX 전면 재설계 명세

> 작성일: 2026-04-28  
> 대상: `app/worker/*` (8개 페이지)  
> 범위: admin / super-admin 제외

---

## 목차

1. [현재 상태 진단 — Anti-pattern 7가지](#1-현재-상태-진단)
2. [네비게이션 패턴 권고 — 햄버거 vs Bottom Tab Bar](#2-네비게이션-패턴-권고)
3. [Safe Area / Viewport 처리](#3-safe-area--viewport-처리)
4. [터치 타겟 & 인터랙션 표준](#4-터치-타겟--인터랙션-표준)
5. [한국 모바일 트렌드 적용](#5-한국-모바일-트렌드-적용)
6. [컴포넌트 인벤토리](#6-컴포넌트-인벤토리)
7. [디자인 토큰 권고](#7-디자인-토큰-권고)
8. [구현 단계 분할 (Wave 1~3)](#8-구현-단계-분할)
9. [페이지별 Before / After 상세](#9-페이지별-before--after-상세)

---

## 1. 현재 상태 진단

코드를 전수 분석한 결과, "데스크톱 화면을 확대·이동하는 느낌"이 나는 구체적인 Anti-pattern 7가지를 식별했다.

### Anti-pattern 1: max-w-[480px] 센터링 컨테이너 — 데스크톱 시뮬레이션 UI

```tsx
// app/worker/layout.tsx:26
<div className="w-full max-w-[480px] h-full bg-surface flex flex-col shadow-card relative">
```

모바일 기기에서 480px 제한은 의미 없다. 실제 iPhone 14 Pro는 390px 논리 픽셀이며, 이 컨테이너는 데스크톱 브라우저에서 "스마트폰 프레임을 보여주는" 시뮬레이터 UI다. 진짜 모바일 앱은 100vw를 완전히 채운다.

**영향:** 좌우 여백이 없는 기기에서는 정상이지만, 태블릿·데스크톱에서 앱을 열었을 때 폰 모양의 테두리가 생긴다. 더 나쁜 점은 이 패턴이 "실제 네이티브 앱처럼 화면을 가득 채운다"는 기대를 깨뜨린다.

**수정 방향:** 컨테이너를 제거하고 `w-full`만 유지. 태블릿 이상에서는 별도 레이아웃이나 중앙 고정 max-w-md 유지(단, shadow 제거).

---

### Anti-pattern 2: 정보 밀도 과다 — 10px 이하 폰트 남용

```tsx
// app/worker/page.tsx
<span className="text-[10px] font-mono font-bold text-cyan-100 ml-auto">{todayLabel()}</span>
<span className="text-[10px] font-mono font-extrabold tracking-widest text-cyan-100">오늘 근무</span>

// app/worker/safety/_safety-worker-client.tsx
<div className="text-[11px] font-extrabold text-ink-muted">{tbm.signCount}명 서명 완료</div>
<span className="text-[10px] font-mono font-extrabold bg-green-100 text-success">✓ 서명 완료</span>
```

10px, 11px 폰트는 야외 작업 환경(직사광선, 장갑 착용, 이동 중)에서 판독 불가 수준이다. iOS 권장 최소 폰트는 11pt(물리), 안드로이드 Material Design은 12sp. 한글은 영문보다 복잡한 자소 구조로 12px 미만에서 급격히 가독성이 떨어진다.

**발생 위치:** 10px 이하 폰트가 코드베이스 전체에 27곳 이상 존재한다.

**수정 방향:** 최소 12px(`text-xs`), 본문 14px(`text-sm`), 주요 라벨 16px(`text-base`). `text-[10px]` 패턴을 전면 금지한다.

---

### Anti-pattern 3: hover: 의존 인터랙션 — 터치 기기 사용자 소외

```tsx
// app/worker/_tab-link.tsx:27
className={`... ${active ? 'text-accent font-extrabold' : 'text-ink-muted hover:text-accent'}`}

// app/worker/punch/_punch-client.tsx:181
className={`... ${phase === 'before-in' ? 'bg-success hover:bg-green-700' : 'bg-info hover:bg-blue-700'}`}

// app/worker/page.tsx:106
className={`... ${disabled ? 'opacity-60' : 'active:scale-[0.98] cursor-pointer'} transition`}
```

`hover:` 상태는 터치 디바이스에서 발생하지 않거나 한 번의 탭에서 일시적으로만 나타난다. 버튼의 눌림 피드백은 `hover:`가 아니라 `active:` 또는 JavaScript 레벨 `touchstart`/`touchend`로 구현해야 한다. `cursor-pointer`는 데스크톱 전용 개념으로 모바일에서 불필요하다.

**수정 방향:** `hover:` 색상 변경 → 제거 또는 `@media (hover: hover)` 가드 적용. 모든 인터랙티브 요소에 `active:scale-[0.97]` + `active:brightness-90` 적용.

---

### Anti-pattern 4: 작은 터치 타겟 — 44pt 기준 미달 다수

```tsx
// app/worker/punch/_punch-client.tsx:166-170
<button
  onClick={requestGps}
  className="px-3 py-1.5 rounded-md border border-line text-xs font-extrabold ..."
>
  ↻ 재시도
</button>
```

`py-1.5`는 약 24px 높이로 Apple HIG·Material Design 공통 권장 최소치 44px의 절반이다.

```tsx
// app/worker/safety/_safety-worker-client.tsx:275
<label className={`flex items-center gap-3 px-4 py-3 cursor-pointer ...`}>
  <input type="checkbox" className="w-5 h-5 rounded accent-success" />
```

체크박스 자체는 20px이며 `py-3`(24px) 행 높이도 44px 미달. 야외 장갑 착용 시 조작 불가능하다.

**주요 미달 위치:**

| 위치 | 현재 높이 | 문제 |
|------|---------|------|
| GPS 재시도 버튼 | ~24px | 44px 미달 |
| 체크리스트 행 | ~40px | 경계선상 |
| SOS armed 확인 버튼 `py-3` | ~40px | 경계선상 |
| 탭바 아이콘+라벨 | 68px 전체 / 항목당 flex-1 | OK (3~6분할 시 ~11~22mm) |
| 비상연락처 a[href=tel] | `py-2` ~32px | 44px 미달 |

**수정 방향:** 모든 인터랙티브 요소 `min-h-[44px]` 또는 `py-3` 이상 보장. 체크리스트 행 `py-3.5`(56px), 전화 링크 `py-3`(44px+).

---

### Anti-pattern 5: 스크롤 페이지 내부에 모든 섹션 노출 — 정보 과부하

```tsx
// app/worker/safety/_safety-worker-client.tsx
// 한 페이지에: WeatherCard + TBM 서명 + 체크리스트 + 아차사고/재해보고 + SOS + 비상연락처
// 추정 scroll 길이: 1200px+

// app/worker/punch/_punch-client.tsx
// 한 페이지에: 헤더 + 출퇴근 상태카드 + GPS 상태카드 + 액션버튼 + 안내배너
```

네이티브 모바일 앱 패턴(토스, 배민 커넥트, 카카오T)은 한 화면에 하나의 주요 액션을 제시한다. 긴 스크롤 페이지는 사용자가 무엇을 해야 할지 혼란스럽게 만든다. 특히 안전 페이지는 6개 섹션이 한 화면에 노출되어 가장 중요한 SOS 버튼이 화면 하단으로 밀린다.

**수정 방향:** 각 섹션을 BottomSheet 또는 탭(Tab) 패턴으로 분리. 첫 화면에는 가장 중요한 액션만 노출.

---

### Anti-pattern 6: 에러/성공 메시지 인라인 배너 — 화면 흐름 단절

```tsx
// app/worker/safety/_safety-worker-client.tsx:196-203
{success && (
  <div className="bg-green-50 border border-green-300 border-l-4 border-l-success rounded-md px-4 py-3 text-sm font-extrabold text-success">
    {success}
  </div>
)}
{error && (
  <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-xs font-bold text-red-700">{error}</div>
)}
```

이 패턴은 상태가 유지되어 사라지지 않으며, 페이지 레이아웃 흐름 안에 삽입되어 스크롤 위치에 따라 보이지 않을 수 있다. 네이티브 모바일 앱 피드백은 Toast 또는 Snackbar로 3~4초 후 자동 소멸한다. 동일한 패턴이 punch, complaint, leave 등 모든 페이지에 반복된다.

**수정 방향:** 전역 Toast/Snackbar 컴포넌트 도입. `success`/`error` 상태는 메시지 표시 후 3000ms 타이머로 자동 클리어.

---

### Anti-pattern 7: PWA manifest start_url이 /dashboard (관리자용)

```json
// public/manifest.json:6
"start_url": "/dashboard",
```

워커가 PWA를 홈 화면에 추가하면 `/dashboard`로 진입한다. WORKER 역할은 `/dashboard`에서 `/worker`로 리다이렉트되겠지만, 이는 불필요한 라운드트립이며 오프라인 상황에서 흰 화면을 유발할 수 있다. 또한 shortcuts가 모두 관리자 경로(complaints, vehicles)를 가리킨다.

**수정 방향:** 워커 전용 manifest를 분리하거나, 워커 layout에서 동적으로 manifest를 오버라이드한다. 최소한 shortcuts를 워커 경로로 교체해야 한다.

---

## 2. 네비게이션 패턴 권고

### 햄버거 vs Bottom Tab Bar — 결론: Bottom Tab Bar 유지 + Drawer 병행

워커 앱 특성을 고려한 근거:

| 요소 | 햄버거 드로어 | Bottom Tab Bar |
|------|------------|--------------|
| 한손 엄지 도달 범위 | 좌상단 — 도달 어려움 | 하단 — 엄지 자연 위치 |
| 야외 이동 중 사용 | 한 손에 쓰레기봉투, 한 손 폰 | 하단이 훨씬 편리 |
| 8개 메뉴 표시 | 모두 표시 가능 | 5개 직접 노출 + Drawer로 보조 |
| 현재 위치 인지 | 드로어 열어야 확인 | 탭 강조로 항상 가시 |
| 배민커넥트/카카오T 패턴 | 사용 안 함 | 사용 |

**권고: Bottom Tab Bar 5개 고정 + 더보기(More) 탭으로 나머지 메뉴 접근**

```
[홈] [출퇴근] [민원] [안전] [더보기▸]
                               ↓ Drawer
                          실적 / 휴가 / 프로필 / 경로(RAPID only)
```

RAPID 직책의 경로 탭은 더보기 드로어 최상단에 노출하되, RAPID가 아닌 사용자에게는 숨긴다.

이렇게 하면:
- 가장 빈번한 5개(홈·출퇴근·민원·안전·더보기)가 항상 하단에 고정
- 드로어는 보조 역할로 전환되어 복잡성 감소
- 기존 `isRapid` 서버 로직을 그대로 재사용 가능

### 개선된 Bottom Tab Bar 규격

```
높이: 64px (safe area padding 별도 추가)
아이콘: 24×24px (현재 22×22 → 2px 확대)
라벨: 12px (현재 11px → 최소 기준 충족)
터치 타겟: flex-1 전체 (아이콘+라벨 묶음으로 전체 탭 영역 터치)
active 표시: 상단 2px 인디케이터 + 아이콘 filled variant + 라벨 accent 색
inactive: text-slate-400 (현재 text-ink-muted는 contrast 불충분)
```

---

## 3. Safe Area / Viewport 처리

### 현재 상태

```tsx
// app/layout.tsx:23-28
export const viewport: Viewport = {
  themeColor: '#0e7490',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',  // 설정 있음 — 올바름
};
```

`viewportFit: 'cover'`는 설정되어 있으나, **safe area inset을 실제 padding에 반영하는 코드가 없다.**

### 문제 지점

```tsx
// app/worker/layout.tsx:28
<header className="px-5 py-3.5 bg-sidebar text-white flex items-center gap-3 flex-shrink-0 z-10">
// → iOS Dynamic Island / 노치 영역에 콘텐츠 침범 가능

// app/worker/layout.tsx:47
<nav className="h-[68px] flex-shrink-0 ...">
// → iOS 홈 인디케이터(34px) 영역에 탭 콘텐츠 침범
```

### 수정 방향

**globals.css에 safe area 유틸리티 추가:**

```css
/* safe-area padding 유틸 */
.pt-safe  { padding-top: env(safe-area-inset-top); }
.pb-safe  { padding-bottom: env(safe-area-inset-bottom); }
.pl-safe  { padding-left: env(safe-area-inset-left); }
.pr-safe  { padding-right: env(safe-area-inset-right); }

/* iOS 홈바 영역 보정용 bottom padding */
.pb-safe-nav { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
```

**tailwind.config.ts에 safe area spacing 추가:**

```ts
spacing: {
  'safe-top':    'env(safe-area-inset-top)',
  'safe-bottom': 'env(safe-area-inset-bottom)',
  'safe-left':   'env(safe-area-inset-left)',
  'safe-right':  'env(safe-area-inset-right)',
},
```

**layout.tsx 수정:**

```tsx
// Before
<header className="px-5 py-3.5 bg-sidebar text-white ...">

// After
<header className="px-5 pt-[calc(14px+env(safe-area-inset-top))] pb-3.5 bg-sidebar text-white ...">

// Before
<nav className="h-[68px] flex-shrink-0 ...">

// After
<nav className="flex-shrink-0 pb-[env(safe-area-inset-bottom)] ...">
  {/* 탭 컨텐츠 높이 64px 고정, safe area는 nav padding으로 처리 */}
```

**manifest.json 수정:**

```json
{
  "display": "standalone",
  // standalone + viewport-fit=cover 조합이 safe area 최적 조건
}
```

---

## 4. 터치 타겟 & 인터랙션 표준

### 최소 터치 타겟 규격 (Apple HIG 44pt, Material 48dp 기준)

모든 인터랙티브 요소에 다음 규칙을 적용한다:

```
primary CTA 버튼: min-h-[56px] (대형 액션 — 출퇴근 등록, SOS)
secondary 버튼: min-h-[48px]
tertiary / 아이콘 버튼: min-h-[44px] min-w-[44px]
리스트 행(체크리스트 등): min-h-[56px]
전화 링크 tel: : min-h-[48px]
탭바 각 탭: 높이 64px 전체 (충분)
```

### Before / After — GPS 재시도 버튼

```tsx
// Before (app/worker/punch/_punch-client.tsx:166)
<button className="px-3 py-1.5 rounded-md border border-line text-xs font-extrabold text-ink ...">
  ↻ 재시도
</button>
// 실제 높이: ~28px

// After
<button className="px-4 py-3 min-h-[44px] rounded-lg border border-line text-sm font-bold text-ink active:scale-95 active:bg-surface-soft transition-all duration-150 disabled:opacity-40">
  <span className="flex items-center gap-1.5">
    <RefreshCw className="w-4 h-4" />
    재시도
  </span>
</button>
```

### Before / After — 체크리스트 행

```tsx
// Before (app/worker/safety/_safety-worker-client.tsx:275)
<label className="flex items-center gap-3 px-4 py-3 cursor-pointer ...">
  <span className="text-2xl">{ICONS[item.key]}</span>
  <span className="flex-1 text-sm font-bold text-ink">{item.label}</span>
  <input type="checkbox" className="w-5 h-5 rounded accent-success" />
</label>
// 높이: ~40px

// After
<label className="flex items-center gap-3 px-4 min-h-[56px] py-3 active:bg-surface-soft transition-colors cursor-pointer select-none ...">
  <span className="text-2xl leading-none w-8 text-center">{ICONS[item.key]}</span>
  <span className="flex-1 text-sm font-semibold text-ink leading-snug">{item.label}</span>
  {/* 커스텀 체크박스 — 32×32px 터치 타겟 */}
  <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
    <input type="checkbox" className="sr-only peer" checked={item.ok} onChange={() => toggle(item.key)} />
    <div className="w-6 h-6 rounded-md border-2 border-line peer-checked:bg-success peer-checked:border-success flex items-center justify-center transition-all">
      {item.ok && <Check className="w-4 h-4 text-white stroke-[3]" />}
    </div>
  </div>
</label>
```

### Haptic Feedback

PWA에서 네이티브 햅틱 피드백을 부분적으로 구현한다:

```ts
// lib/haptics.ts
export function hapticLight() {
  if ('vibrate' in navigator) navigator.vibrate(10);
}
export function hapticMedium() {
  if ('vibrate' in navigator) navigator.vibrate(20);
}
export function hapticSuccess() {
  if ('vibrate' in navigator) navigator.vibrate([10, 50, 10]);
}
export function hapticError() {
  if ('vibrate' in navigator) navigator.vibrate([30, 20, 30]);
}
```

출퇴근 등록 완료 시 `hapticSuccess()`, SOS 발신 확정 시 `hapticMedium()`, 에러 시 `hapticError()` 호출.

---

## 5. 한국 모바일 트렌드 적용

### 토스 / 당근 / 배민커넥트 / 카카오T 공통 패턴 분석

| 패턴 | 토스 | 당근 | 배민커넥트 | 카카오T | 적용 방향 |
|------|-----|-----|---------|--------|---------|
| 화면당 주요 액션 1개 | O | O | O | O | 출퇴근: 버튼 1개 |
| Sticky CTA 하단 고정 | O | O | O | O | Wave 2 도입 |
| BottomSheet 모달 | O | O | O | O | 인라인 폼 대체 |
| Large Card with icon | O | O | O | O | 홈 메뉴카드 확대 |
| 단일 컬럼 스크롤 | O | O | O | O | 홈 grid 2열 → 1열 |
| Skeleton 로딩 | O | O | O | O | Wave 2 도입 |
| 상태 Pill Badge | O | O | O | O | 탭 알림 뱃지 |
| 풀투리프레시 | O | O | O | O | Wave 2 도입 |
| 다크모드 | O | 일부 | O | O | Wave 2 선택적 |

### 홈 화면 — Grid 2열 → Single Column Card

```tsx
// Before: 2열 grid, 아이콘 w-9 h-9
<div className="grid grid-cols-2 gap-2">
  <MenuCard href="/worker/punch" ... />
  ...
</div>

// After: 단일 컬럼, 풍부한 카드
<div className="flex flex-col gap-3 px-4 py-3">
  <PrimaryActionCard
    href="/worker/punch"
    icon={<Clock className="w-6 h-6" />}
    title="출퇴근 등록"
    subtitle={checkedIn ? `출근 ${formatHm(checkInTime)}` : '아직 출근 전'}
    status={checkedIn ? 'active' : 'pending'}
    color="accent"
  />
  <div className="grid grid-cols-2 gap-3">
    <SecondaryCard href="/worker/complaint" icon={Camera} title="민원 등록" />
    <SecondaryCard href="/worker/safety" icon={Shield} title="안전점검" />
    <SecondaryCard href="/worker/leave" icon={Calendar} title="휴가신청" />
    <SecondaryCard href="/worker/profile" icon={User} title="내 프로필" />
  </div>
</div>
```

### Sticky CTA 패턴 — 출퇴근 페이지

```tsx
// After: 출퇴근 버튼을 화면 하단에 sticky 고정
<div className="flex flex-col h-full">
  {/* 스크롤 영역 */}
  <div className="flex-1 overflow-y-auto px-4 py-5 pb-[88px]">
    {/* 상태카드, GPS 상태 등 */}
  </div>
  {/* Sticky CTA — 화면 하단 고정 */}
  <div className="fixed bottom-[64px] left-0 right-0 px-4 pb-3 bg-gradient-to-t from-surface via-surface/95 to-transparent pt-6">
    <button className="w-full min-h-[56px] rounded-2xl text-white text-lg font-black shadow-lg ...">
      {phase === 'before-in' ? '출근 등록' : '퇴근 등록'}
    </button>
  </div>
</div>
```

### BottomSheet — 아차사고/재해 보고 폼

현재 인라인으로 펼쳐지는 보고 폼을 BottomSheet로 교체:

```tsx
// Before: 페이지 내부에 인라인 조건부 렌더
{reportType && (
  <div className="px-4 pb-4 space-y-3 border-t border-line pt-4">
    ...
  </div>
)}

// After: BottomSheet 컴포넌트
<BottomSheet
  open={!!reportType}
  onClose={() => setReportType(null)}
  title={reportType === 'NEAR_MISS' ? '아차사고 보고' : '재해 발생 보고'}
  snapPoints={['85%']}
>
  <IncidentReportForm
    type={reportType}
    onSubmit={submitIncident}
    onCancel={() => setReportType(null)}
  />
</BottomSheet>
```

### Toast 전역 피드백

```tsx
// Before: 인라인 success/error state
{success && <div className="bg-green-50 ...">...</div>}
{error && <div className="bg-red-50 ...">...</div>}

// After: 전역 Toast
import { toast } from '@/components/ui/toast';

// 제출 성공
toast.success('일일 점검 제출 완료', { description: `${checkedCount}/${items.length}개 항목 확인` });

// 에러
toast.error('GPS 위치를 먼저 확인해 주세요.');

// Toast 컨테이너는 layout.tsx에 단 한 번 추가
```

### Pull-to-Refresh

```tsx
// components/ui/PullToRefresh.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: React.ReactNode }) {
  const startY = useRef(0);
  const [pulling, setPulling] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const threshold = 72;

  // touchstart/touchmove/touchend 핸들링
  // pullDist >= threshold 도달 시 onRefresh() 호출
  // 스피너 애니메이션 (rotate 진행률 반영)

  return (
    <div className="relative overflow-hidden h-full">
      {pulling && (
        <div className="absolute top-0 inset-x-0 flex justify-center pt-3 z-10 pointer-events-none">
          <RefreshCw
            className="w-6 h-6 text-accent transition-transform"
            style={{ transform: `rotate(${(pullDist / threshold) * 360}deg)` }}
          />
        </div>
      )}
      <div className="h-full overflow-y-auto overscroll-contain" ...>
        {children}
      </div>
    </div>
  );
}
```

### 야외 가시성 — 다크모드 vs 고대비 라이트모드

야외 직사광선 환경에서는 **일반 다크모드가 아닌 고대비 라이트모드**가 더 적합하다. 이유:

- 직사광선 아래 OLED 다크모드는 반사율이 낮아 가시성 저하
- 고대비 흰 배경은 전통 종이처럼 야외에서 읽기 쉬움
- 단, **글자 contrast ratio 4.5:1 이상 엄격 준수**가 필수

현재 `text-ink-muted: #1e293b`는 흰 배경 대비 15.6:1로 충분하지만, `text-cyan-100`(헤더의 부제목)은 `bg-accent(#0e7490)` 위에서 확인이 필요하다.

**선택적 다크모드 도입 시:** `@media (prefers-color-scheme: dark)` + 토글 버튼으로 사용자 제어 허용. 야외 환경 고려 시 기본값은 라이트모드 유지.

---

## 6. 컴포넌트 인벤토리

### 6.1 AppBar (신규)

```tsx
// components/worker/AppBar.tsx
interface AppBarProps {
  title: string;
  subtitle?: string;
  /** 좌측 액션 (기본: 햄버거 메뉴) */
  leading?: React.ReactNode;
  /** 우측 액션들 */
  actions?: React.ReactNode;
  /** 투명 배경 (그라데이션 헤더 위 오버레이용) */
  transparent?: boolean;
}
```

규격:
- 높이: 56px + safe-area-inset-top
- 배경: `bg-sidebar` (기존 유지) 또는 투명
- 타이포: title `text-base font-bold`, subtitle `text-xs text-white/70`
- Leading icon 터치 타겟: `min-w-[44px] min-h-[44px]`

### 6.2 Drawer (개선)

현재 admin 드로어(`_admin-shell.tsx`) 패턴을 워커용으로 전용:

```tsx
// components/worker/WorkerDrawer.tsx
interface WorkerDrawerProps {
  open: boolean;
  onClose: () => void;
  user: { name: string; role: string; id: string };
  isRapid: boolean;
}
```

규격:
- 너비: `min(85vw, 320px)` — 화면 85%를 넘지 않음
- 오버레이: `bg-black/50` backdrop-blur-sm
- 진입 애니메이션: `slide-in 200ms ease-out` (이미 tailwind.config에 정의됨)
- 닫기: 오버레이 탭 + Escape 키 + 내부 × 버튼
- 메뉴 항목 높이: `min-h-[56px]`
- 최하단: 로그아웃 텍스트 링크 (기존 원칙 유지)

메뉴 구성:
```
[아이콘] 실적          (/worker/performance)
[아이콘] 휴가신청       (/worker/leave)
[아이콘] 내 프로필      (/worker/profile)
--- (RAPID only) ---
[아이콘] 추천경로       (/worker/route)
---
[로그아웃 텍스트 링크]
```

### 6.3 BottomSheet

```tsx
// components/ui/BottomSheet.tsx
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 스냅 포인트 — 기본 ['50%', '90%'] */
  snapPoints?: string[];
  children: React.ReactNode;
}
```

규격:
- 진입 애니메이션: `slide-up 250ms ease-out` (이미 정의됨)
- 상단 핸들: `w-12 h-1.5 bg-line rounded-full mx-auto mt-3 mb-2`
- 오버레이: `bg-black/40`
- 스크롤: 내부 overflow-y-auto
- 닫기 조건: 핸들 아래로 드래그 (`translateY > 30%`) + 오버레이 탭

사용 케이스:
- 안전 페이지: 아차사고/재해 보고 폼
- 민원 페이지: 민원 유형 선택
- 홈: 알림 상세

### 6.4 Toast

```tsx
// components/ui/toast.ts
export const toast = {
  success: (message: string, options?: { description?: string; duration?: number }) => void;
  error: (message: string, options?: { duration?: number }) => void;
  warning: (message: string, options?: { duration?: number }) => void;
  info: (message: string, options?: { duration?: number }) => void;
};
```

규격:
- 위치: `top-safe + 8px` (상단, 탭바/CTA와 겹치지 않기 위해)
- 너비: `min(calc(100vw - 32px), 400px)`
- 자동 소멸: 기본 3000ms (error: 4000ms)
- 아이콘: success(초록 체크), error(빨간 X), warning(주황 !)
- 최대 3개 스택
- 스와이프 업으로 조기 닫기

### 6.5 Skeleton

```tsx
// components/ui/Skeleton.tsx
// 사용: 데이터 로딩 중 레이아웃 유지

// 홈 스켈레톤
<SkeletonCard className="h-24" />  // 상태 카드
<SkeletonCard className="h-16" />  // 메뉴 카드들

// Tailwind 클래스 기반 구현
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-surface-soft rounded-lg', className)} />;
}
```

### 6.6 Stat Tile (홈 KPI 카드)

```tsx
// components/worker/StatTile.tsx
interface StatTileProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  color?: 'accent' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}
```

홈 화면에서:
- 출근 시각
- 이번 달 근무일수
- 잔여 연차
- 처리 완료 민원 수

규격: `bg-surface border border-line rounded-2xl p-4 min-h-[80px]`

### 6.7 List Item (Touch-friendly)

```tsx
// components/ui/ListItem.tsx
interface ListItemProps {
  leading?: React.ReactNode;   // 아이콘 또는 아바타
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;  // 뱃지, 화살표, 토글
  onClick?: () => void;
  href?: string;
  /** 최소 높이 — 기본 56px */
  size?: 'default' | 'large';
}
```

규격:
- `min-h-[56px]` (기본) / `min-h-[72px]` (large)
- `px-4 py-3` 패딩
- `active:bg-surface-soft` 피드백
- trailing 영역: `min-w-[44px]` (토글/버튼 터치 타겟 보장)
- 구분선: `divide-y divide-line` 부모에서 처리

---

## 7. 디자인 토큰 권고

### 7.1 Color — 야외 가시성 기준 contrast ratio

현재 토큰에서 contrast ratio가 부족한 항목과 권고값:

| 토큰 | 현재 값 | 사용 배경 | 현재 CR | 권고 값 | 목표 CR |
|------|--------|---------|--------|--------|--------|
| `warn` | `#b45309` | `#ffffff` | 4.58:1 | `#92400e` | 7:1+ (AA Large 통과, 소형 텍스트 강화) |
| `danger` | `#b91c1c` | `#ffffff` | 5.14:1 | `#991b1b` | 7:1+ |
| `info` | `#1d4ed8` | `#ffffff` | 8.59:1 | 유지 | OK |
| `success` | `#15803d` | `#ffffff` | 5.56:1 | `#166534` | 7:1+ |
| `ink-muted` | `#1e293b` | `#ffffff` | 15.6:1 | 유지 | OK |
| `ink-faint` | `#475569` | `#ffffff` | 5.73:1 | `#334155` | 7:1+ (보조 텍스트 강화) |
| `text-cyan-100` on `bg-accent` | `#cffafe` on `#0e7490` | - | ~2.5:1 | `#ecfeff` 또는 `#ffffff` | 4.5:1+ |

**야외 가시성 전용 권고:** 주요 액션 버튼 텍스트는 항상 `#ffffff`(흰색)를 사용하고, 버튼 배경은 contrast ratio 4.5:1 이상 색상만 사용.

### 7.2 Typography — 한글 가독성 기준

```ts
// tailwind.config.ts 추가 권고
fontSize: {
  'xs':   ['12px', { lineHeight: '1.5', letterSpacing: '0' }],    // 최소 허용 크기 (현재 10px 사용 금지)
  'sm':   ['14px', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
  'base': ['16px', { lineHeight: '1.6', letterSpacing: '-0.01em' }],  // 모바일 zoom 방지 기준
  'lg':   ['18px', { lineHeight: '1.5', letterSpacing: '-0.02em' }],
  'xl':   ['20px', { lineHeight: '1.4', letterSpacing: '-0.02em' }],
  '2xl':  ['24px', { lineHeight: '1.3', letterSpacing: '-0.03em' }],
  '3xl':  ['30px', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
}
```

**폰트 로딩 개선 — Google Fonts 대신 self-host:**

현재 `app/layout.tsx`에서 Google Fonts CDN을 사용한다. PWA 오프라인 지원 및 초기 로딩 최적화를 위해 `@fontsource/noto-sans-kr`로 교체를 권고한다.

```bash
npm install @fontsource/noto-sans-kr
```

```tsx
// app/layout.tsx
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import '@fontsource/noto-sans-kr/900.css';
// Google Fonts <link> 제거
```

단, Noto Sans KR은 서브셋이 필요하다. 전체 패키지는 ~10MB이므로 `subset: latin + korean` 설정 또는 `@fontsource-variable` 사용.

### 7.3 Spacing — 4px Grid 기반

```ts
// 현재 임의 spacing (py-3.5, py-1.5 등) 정리
// 4px 기반 그리드로 정규화

spacing: {
  0:   '0',
  1:   '4px',
  2:   '8px',
  3:   '12px',
  4:   '16px',
  5:   '20px',
  6:   '24px',
  8:   '32px',
  10:  '40px',
  12:  '48px',
  14:  '56px',   // 터치 타겟 최소
  16:  '64px',   // 탭바 높이
  18:  '72px',   // pull-to-refresh 임계점
},
```

### 7.4 Border Radius

```ts
borderRadius: {
  'none': '0',
  'sm':   '6px',    // 소형 배지, 인풋
  'DEFAULT': '8px', // 카드, 버튼
  'lg':   '12px',   // 대형 카드
  'xl':   '16px',   // 모달, BottomSheet 상단
  '2xl':  '24px',   // 대형 CTA 버튼 (출퇴근 버튼)
  'full': '9999px', // 알약형 배지
},
```

### 7.5 Shadow / Elevation

```ts
boxShadow: {
  'sm':   '0 1px 3px rgba(15, 23, 42, 0.08)',    // 카드 기본
  'card': '0 4px 12px rgba(15, 23, 42, 0.10)',   // 현재 card (유지)
  'lg':   '0 8px 24px rgba(15, 23, 42, 0.14)',   // 탭바, AppBar
  'modal':'0 16px 48px rgba(15, 23, 42, 0.22)',  // BottomSheet
  'none': 'none',
},
```

### 7.6 Animation

```ts
// 현재 slide-in(220ms), slide-up(250ms) — 유지하되 표준화
transitionDuration: {
  'instant': '100ms',  // hover 색상 전환
  'fast':    '150ms',  // 버튼 scale
  'DEFAULT': '200ms',  // 일반 전환
  'slow':    '300ms',  // 모달 진입
},
transitionTimingFunction: {
  'DEFAULT': 'cubic-bezier(0.4, 0, 0.2, 1)',  // ease-in-out
  'out':     'cubic-bezier(0, 0, 0.2, 1)',     // ease-out (슬라이드 진입)
  'spring':  'cubic-bezier(0.34, 1.56, 0.64, 1)', // 스프링 (버튼 반동)
},
```

---

## 8. 구현 단계 분할

### Wave 1: Layout + Navigation (1 PR)

**목적:** 화면 고정, safe area 처리, 네비게이션 재설계  
**예상 공수:** 1.5일  
**범위:**

```
변경 파일:
- app/worker/layout.tsx          (AppBar + 5탭 + Drawer 구조)
- app/worker/_tab-link.tsx       (active 상태 개선, 12px 라벨, 44px+ 타겟)
- components/worker/AppBar.tsx   (신규)
- components/worker/WorkerDrawer.tsx (신규 — admin 드로어 패턴 참조)
- app/globals.css                (safe-area utilities)
- tailwind.config.ts             (safe-area spacing, font-size 표준화)
- public/manifest.json           (start_url → /worker, shortcuts 수정)

유지:
- 서버 컴포넌트 인증/권한 로직 (변경 없음)
- isRapid 로직 (Drawer 내 조건부 렌더로 이전)
- LogoutButton (Drawer 최하단으로 이동)
```

**PR 체크리스트:**
- [ ] iOS 노치/Dynamic Island safe area 검증 (시뮬레이터)
- [ ] Android 홈 인디케이터 safe area 검증
- [ ] 탭바 active 상태 전환 확인 (5개 탭 모두)
- [ ] Drawer 열기/닫기 애니메이션
- [ ] Escape 키로 Drawer 닫기 (키보드 a11y)
- [ ] PWA standalone 모드에서 탭바 위치 확인

---

### Wave 2: Touch / Feedback Primitives (1 PR)

**목적:** 전역 Toast, BottomSheet, Skeleton, Pull-to-Refresh, Haptic, 터치 타겟 수정  
**예상 공수:** 2일  
**범위:**

```
신규 컴포넌트:
- components/ui/Toast.tsx + useToast.ts
- components/ui/BottomSheet.tsx
- components/ui/Skeleton.tsx
- components/ui/PullToRefresh.tsx
- components/ui/ListItem.tsx
- lib/haptics.ts

수정:
- app/worker/layout.tsx: Toast 컨테이너 추가
- app/worker/punch/_punch-client.tsx:
    GPS 재시도 버튼 터치 타겟 수정
    Sticky CTA 패턴 적용
    success/error → toast 교체
    hapticSuccess/Error 추가
- app/worker/safety/_safety-worker-client.tsx:
    체크리스트 행 min-h-[56px]
    success/error → toast 교체
    비상연락처 전화 링크 min-h-[48px]
- 모든 worker 페이지: hover: → active: + @media(hover:hover) 가드
```

**PR 체크리스트:**
- [ ] Toast 3초 자동 소멸
- [ ] BottomSheet 드래그로 닫기
- [ ] Skeleton 로딩 상태 확인
- [ ] 모든 버튼 44px+ 터치 타겟 (DevTools Mobile 시뮬레이터로 측정)
- [ ] Haptic: 출퇴근 성공 시 진동 확인 (Android Chrome)
- [ ] WCAG 2.1 AA axe 재검증

---

### Wave 3: Per-page Mobile Optimization (페이지별 PR)

#### Wave 3-A: 홈 페이지 재설계 (1 PR)

```
app/worker/page.tsx 수정:
- 그라데이션 헤더 카드: font-size 최소 12px로 정규화
- 메뉴 카드: grid 2열 유지하되 min-h-[80px], 아이콘 w-10 h-10
- Stat tiles 추가 (근무 통계 — 별도 API 필요 시 Skeleton으로 defer)
- 안내 배너: text-xs(12px) 최소 유지, bg-amber-50 → 개선
components/worker/StatTile.tsx 신규
```

#### Wave 3-B: 출퇴근 페이지 (1 PR)

```
app/worker/punch/_punch-client.tsx:
- 시계 폰트: text-sm font-mono → text-base
- 상태 카드 박스: text-2xl 유지 (OK), Box 라벨 text-[11px] → text-xs
- GPS 카드: 재시도 버튼 크기 수정
- Sticky CTA 도입
- 완료 상태 배너: 스타일 개선 (더 명확한 체크 아이콘)
```

#### Wave 3-C: 안전 페이지 (1 PR — 가장 복잡)

```
app/worker/safety/_safety-worker-client.tsx:
- 아차사고/재해 보고 폼 → BottomSheet 전환
- 체크리스트 행 min-h-[56px], 커스텀 체크박스
- WeatherCard: font-size 정규화
- TBM 서명판: 텍스트 크기 개선
- SOS 섹션: armed 확인 버튼 py-3 → py-3.5
- 비상연락처: min-h-[48px]
- 전체 페이지 구조: 섹션 순서 재검토 (SOS를 더 접근하기 쉬운 위치로)
```

#### Wave 3-D: 민원 페이지 (1 PR)

```
app/worker/complaint/_complaint-client.tsx:
- 민원 유형 선택 → BottomSheet 전환 또는 현재 inline 개선
- 사진 업로더 터치 타겟 확인
- 지도 컴포넌트 높이 최적화 (200px → 240px, 모바일 핀 조작 개선)
- 폼 필드 min-h-[48px]
- 제출 버튼 Sticky CTA 패턴
```

#### Wave 3-E: 실적 / 휴가 / 프로필 페이지 (묶음 1 PR)

```
공통 수정:
- 텍스트 크기 정규화 (10px 폰트 제거)
- 터치 타겟 44px+ 보장
- 인라인 에러/성공 → Toast 교체
- 리스트 행 min-h-[56px]
```

---

## 9. 페이지별 Before / After 상세

### 9.1 layout.tsx — Before vs After

**Before:**
```tsx
<div className="flex justify-center bg-page" style={{ position: 'fixed', inset: 0, height: '100dvh', overscrollBehavior: 'none' }}>
  <div className="w-full max-w-[480px] h-full bg-surface flex flex-col shadow-card relative">
    <header className="px-5 py-3.5 bg-sidebar text-white flex items-center gap-3 flex-shrink-0 z-10">
      {/* 로고 + 이름 + 로그아웃 */}
    </header>
    <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>
    <nav className="h-[68px] flex-shrink-0 bg-surface border-t-2 border-line flex items-stretch">
      <TabLink href="/worker" label="홈" icon="home" />
      <TabLink href="/worker/punch" label="출퇴근" icon="clock" />
      <TabLink href="/worker/complaint" label="민원" icon="camera" />
      {isRapid && <TabLink href="/worker/route" label="경로" icon="route" />}
      <TabLink href="/worker/safety" label="안전" icon="shield" />
      <TabLink href="/worker/performance" label="실적" icon="chart" />
    </nav>
  </div>
</div>
```

**After:**
```tsx
<div
  className="bg-surface"
  style={{ position: 'fixed', inset: 0, height: '100dvh', overscrollBehavior: 'none' }}
>
  {/* max-w 센터링 컨테이너 제거 — 100% 너비 */}
  <div className="w-full h-full flex flex-col">
    {/* AppBar: safe-area-inset-top 포함 */}
    <AppBar
      title={session.name}
      subtitle={`WORKER · ID ${session.userId}`}
      leading={<HamburgerButton onClick={() => setDrawerOpen(true)} />}
    />

    {/* 본문 */}
    <main className="flex-1 overflow-y-auto overscroll-contain">{children}</main>

    {/* Bottom Tab Bar: safe-area-inset-bottom 포함 */}
    <nav
      className="flex-shrink-0 bg-surface border-t border-line flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* 높이 64px 고정, safe area는 padding으로 처리 */}
      <div className="flex w-full h-16">
        <TabLink href="/worker" label="홈" icon="home" />
        <TabLink href="/worker/punch" label="출퇴근" icon="clock" />
        <TabLink href="/worker/complaint" label="민원" icon="camera" />
        <TabLink href="/worker/safety" label="안전" icon="shield" />
        <TabLink href="/worker/more" label="더보기" icon="menu" isMore />
      </div>
    </nav>

    {/* Drawer: 실적/휴가/프로필/경로(RAPID) */}
    <WorkerDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      user={session}
      isRapid={isRapid}
    />

    {/* Toast 컨테이너 */}
    <ToastContainer />
  </div>
</div>
```

---

### 9.2 _tab-link.tsx — Before vs After

**Before:**
```tsx
// active 상태 없음, hover만 있음, 11px 라벨
<Link
  href={href}
  className={`flex-1 flex flex-col items-center justify-center gap-0.5 active:bg-surface-soft transition ${
    active ? 'text-accent font-extrabold' : 'text-ink-muted hover:text-accent'
  }`}
>
  <svg width="22" height="22" ...>
  <span className="text-[11px] font-extrabold">{label}</span>
</Link>
```

**After:**
```tsx
<Link
  href={href}
  aria-current={active ? 'page' : undefined}
  className="flex-1 flex flex-col items-center justify-center gap-1 relative active:bg-surface-soft/60 transition-colors duration-100"
>
  {/* Active 인디케이터 — 상단 2px 라인 */}
  {active && (
    <span className="absolute top-0 left-[20%] right-[20%] h-0.5 bg-accent rounded-full" />
  )}
  {/* 아이콘 — active 시 filled variant (별도 ICON_PATHS_FILLED 정의) */}
  <svg
    width="24" height="24"
    fill={active ? 'currentColor' : 'none'}
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={active ? 0 : 1.75}
    className={active ? 'text-accent' : 'text-slate-400'}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={active ? ICON_PATHS_FILLED[icon] : ICON_PATHS[icon]} />
  </svg>
  {/* 라벨 — 최소 12px */}
  <span className={`text-xs font-bold leading-none ${active ? 'text-accent' : 'text-slate-400'}`}>
    {label}
  </span>
</Link>
```

---

### 9.3 홈 페이지 상태 카드 — Before vs After

**Before:**
```tsx
<div className="bg-gradient-to-br from-accent to-cyan-700 rounded-xl p-3 text-white shadow-card">
  <div className="flex items-baseline gap-2 mb-0.5">
    <h1 className="text-base font-black truncate">{session.name}님</h1>
    <span className="text-[10px] font-mono font-bold text-cyan-100 ml-auto">{todayLabel()}</span>
  </div>
  <div className="flex items-center gap-2 mt-1">
    <span className="text-[10px] font-mono font-extrabold tracking-widest text-cyan-100">오늘 근무</span>
    <span className="text-base font-black">출근 전</span>
  </div>
</div>
```

**After:**
```tsx
<div className="bg-gradient-to-br from-accent to-cyan-700 rounded-2xl px-5 py-4 text-white shadow-lg mx-4 mt-4">
  <div className="flex items-center justify-between mb-3">
    <div>
      <p className="text-xs font-medium text-cyan-200">{todayLabel()}</p>
      <h1 className="text-xl font-black mt-0.5">{session.name}님, 안녕하세요</h1>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
      <Trash2 className="w-6 h-6 text-white" />
    </div>
  </div>
  {/* 근무 상태 Pill */}
  <div className="flex items-center gap-2">
    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
      !checkedIn ? 'bg-white/20 text-white' :
      checkedOut ? 'bg-green-400/30 text-green-100' : 'bg-yellow-400/30 text-yellow-100'
    }`}>
      {!checkedIn ? '출근 전' : checkedOut ? '근무 완료' : '근무 중'}
    </span>
    {checkedIn && (
      <span className="text-sm text-cyan-200 font-medium">
        출근 {formatHmKst(new Date(me!.checkInTime!))}
      </span>
    )}
  </div>
</div>
```

---

### 9.4 manifest.json — Before vs After

**Before:**
```json
{
  "start_url": "/dashboard",
  "shortcuts": [
    { "name": "대시보드", "url": "/dashboard" },
    { "name": "민원관리", "url": "/complaints" },
    { "name": "차량관리", "url": "/vehicles" }
  ]
}
```

**After:**
```json
{
  "start_url": "/worker",
  "shortcuts": [
    { "name": "출퇴근 등록", "url": "/worker/punch", "description": "GPS 출퇴근 등록" },
    { "name": "안전점검", "url": "/worker/safety", "description": "일일 체크리스트" },
    { "name": "민원 등록", "url": "/worker/complaint", "description": "현장 민원 사진 첨부" }
  ]
}
```

---

## 부록: 구현 우선순위 매트릭스

| 항목 | 사용자 임팩트 | 구현 난이도 | Wave |
|------|------------|----------|------|
| Safe area 처리 | 높음 (iOS 크래시 방지) | 낮음 | 1 |
| 탭바 active 상태 | 높음 (방향 인지) | 낮음 | 1 |
| manifest start_url | 중간 | 매우 낮음 | 1 |
| Toast 전역 피드백 | 높음 | 중간 | 2 |
| 터치 타겟 44px+ | 높음 (야외 조작성) | 낮음 | 2 |
| hover: → active: | 중간 | 낮음 | 2 |
| Sticky CTA (출퇴근) | 높음 | 중간 | 2 |
| BottomSheet (안전 보고) | 중간 | 높음 | 2 |
| 홈 단일 컬럼 카드 | 중간 | 낮음 | 3 |
| 폰트 크기 정규화 | 높음 (가독성) | 낮음 | 3 |
| Haptic feedback | 낮음 | 낮음 | 2 |
| Pull-to-refresh | 중간 | 중간 | 2 |
| 다크모드 | 낮음 (야외환경) | 높음 | 보류 |
| fontsource self-host | 낮음 (오프라인 시 유의미) | 중간 | 3 |

---

*문서 작성: Frontend Architect Agent — 2026-04-28*  
*참조 코드: `app/worker/layout.tsx`, `app/worker/_tab-link.tsx`, `app/worker/page.tsx`, `app/worker/punch/_punch-client.tsx`, `app/worker/safety/_safety-worker-client.tsx`, `public/manifest.json`, `tailwind.config.ts`*
