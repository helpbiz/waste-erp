# mobile-admin-landings Design Document

> **Summary**: Plan §7.2 결정사항 매핑한 minimal Design. BottomSheet/FilterToggle 시그니처 + Module Map 4개.
>
> **Project**: waste-erp · **Version**: 0.1.0-alpha.1 · **Date**: 2026-04-28
> **Planning Doc**: [mobile-admin-landings.plan.md](../../01-plan/features/mobile-admin-landings.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | admin 모바일 카드/모달/필터 표준 미달 |
| **WHO** | 4 admin role × 모바일 |
| **RISK** | visual baseline drift 8-16건 → workflow_dispatch 자동 갱신 |
| **SUCCESS** | 카드 ≥44px + bottom sheet + filter collapse + 5 spec PASS |
| **SCOPE** | /complaints + /super-admin + 2 신규 컴포넌트 |

---

## 1. Architecture

**Selected**: **Pragmatic** — 신규 컴포넌트 2개 + 2 페이지 patch + 동일 시그니처로 미래 마이그레이션 토대.

3-옵션 비교 생략 — Plan §7.2에서 다음 5건 확정:
- 모바일 모달 = BottomSheet (사용자 결정)
- 컴포넌트 위치 = `components/*` (재사용 토대)
- 분기 = Tailwind `md:` + JS conditional
- Focus trap = 자체 구현 (의존성 회피)
- Filter = 모바일만 collapsible

---

## 2. Component Signatures

### 2.1 `components/BottomSheet.tsx`

```tsx
type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  mobileHeight?: string;       // 기본: 80vh
  desktopMaxWidth?: string;    // 기본: 600px
  children: React.ReactNode;
};
```

- **mobile <768px**: `fixed inset-x-0 bottom-0 rounded-t-2xl animate-slide-up` + drag handle + sticky close
- **desktop ≥768px**: 기존 중앙 모달 형태
- 공통: ESC + backdrop click + body scroll lock + focus trap + `role="dialog" aria-modal="true"`
- mobile 전용: swipe-down to dismiss (drag > 100px)

### 2.2 `components/FilterToggle.tsx`

```tsx
type FilterToggleProps = {
  activeCount?: number;     // 활성 필터 수 (배지)
  label?: string;            // 기본 '필터'
  defaultOpen?: boolean;
  children: React.ReactNode;
};
```

- **mobile <768px**: 🔍 필터 (n) 토글 버튼 + 클릭 시 펼침/접힘
- **desktop ≥768px**: 항상 펼침

---

## 8. Test Plan

```bash
npx tsc --noEmit
npm run e2e:mobile        # 37/37 회귀 없음
npm run e2e:tab-modal     # 9/9
npm run e2e:login-flow    # 4/4
npm run e2e:a11y          # 10/10 (BottomSheet에 dialog/aria-modal)
npm run e2e:visual        # 8-16건 drift → workflow_dispatch
```

---

## 11. Implementation Guide

### 11.1 Module Map

| Module | Scope | 파일 | Est |
|---|---|---|:---:|
| **M1 BottomSheet** | `m1` | `components/BottomSheet.tsx` 신규 | 6-8 |
| **M2 FilterToggle** | `m2` | `components/FilterToggle.tsx` 신규 | 3-5 |
| **M3 /complaints 적용** | `m3` | `_complaints-client.tsx` patch | 8-10 |
| **M4 /super-admin 적용** | `m4` | `_super-admin-client.tsx` patch | 5-7 |

### 11.2 실행 순서

1. M1 BottomSheet (animate-slide-up keyframes + drag handle + ESC + focus trap)
2. M2 FilterToggle
3. M3 /complaints (카드 액션 + 모달 import 변경 + 필터 wrap)
4. M4 /super-admin (주요 모달 1-2개)
5. tsc + push feature branch
6. PR 생성 → CI → visual fail 시 workflow_dispatch update_snapshots
7. baseline auto-commit → 재검증 → ✅ → merge

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-28 | Minimal Design — Plan 결정 매핑 | 4365won@gmail.com |
