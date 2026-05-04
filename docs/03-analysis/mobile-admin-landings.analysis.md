# mobile-admin-landings Analysis Report

> **Analysis Type**: Gap Analysis (Static + Runtime)
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Analyst**: 4365won@gmail.com
> **Date**: 2026-04-28
> **Design Doc**: [mobile-admin-landings.design.md](../02-design/features/mobile-admin-landings.design.md)
> **Plan Doc**: [mobile-admin-landings.plan.md](../01-plan/features/mobile-admin-landings.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | admin 모바일 카드/모달/필터 UX가 모바일 표준 미달 (44px 터치 타겟, 모달 dismiss 불편, 필터 화면 점유) |
| **WHO** | 4 admin role (super/contractor/internal/muni) × 모바일 |
| **RISK** | visual baseline drift 8-16건 → workflow_dispatch 자동 갱신 |
| **SUCCESS** | 카드 ≥44px + bottom sheet + filter collapse + 5 spec PASS |
| **SCOPE** | /complaints + /super-admin + 2 신규 컴포넌트 (BottomSheet, FilterToggle) |

---

## Strategic Alignment Check

### Plan Success Criteria Status

| FR | Criterion | Status | Evidence |
|---|---|:---:|---|
| FR-01 | BottomSheet — 모바일 슬라이드 업, 80vh, drag handle, swipe-to-dismiss, ESC, focus trap, role="dialog" | ✅ | `components/BottomSheet.tsx` — touch handler + keydown ESC/Tab + role/aria-modal |
| FR-02 | BottomSheet — 데스크탑에서 중앙 모달 형태 유지 | ✅ | `md:items-center md:px-4` + `window.innerWidth >= 768` 분기 |
| FR-03 | FilterToggle — 모바일 "🔍 필터 (n)" 버튼 + collapsible / 데스크탑 항상 펼침 | ✅ | `components/FilterToggle.tsx` — `md:hidden` 버튼 + `md:block` 패널 |
| FR-04 | /complaints 카드 액션 버튼 — 모바일 flex-wrap + min-h-[44px] + text-sm font-bold | ✅ | `_complaints-client.tsx` — 모바일 분기 적용 확인 |
| FR-05 | /complaints 상세 모달 → BottomSheet 적용 | ✅ | `_complaints-client.tsx:418, 706` — BottomSheet 래핑 |
| FR-06 | /complaints 필터 → FilterToggle 적용 | ✅ | `_complaints-client.tsx:167-189` — FilterToggle 래핑 |
| FR-07 | /super-admin 주요 모달 → BottomSheet 적용 | ✅ | `_super-admin-client.tsx:609, 1171, 1787, 1968` — 4개 모달 래핑 |
| FR-08 | e2e 5 spec 회귀 없음 + visual baseline 자동 갱신 | ✅ | commit a7b7b9d — 4 safety baseline PNG 갱신 포함 |
| FR-09 | a11y critical+serious 위반 없음 (BottomSheet role/aria-* 적절히) | ✅ | `role="dialog" aria-modal="true" aria-label={title}` |

**Success Rate**: 9/9 = **100%** ✅

---

### Non-Functional Requirements Status

| Category | Criteria | Status | Evidence |
|----------|----------|:------:|----------|
| 터치 타겟 | 카드 액션 버튼 ≥ 44x44px | ✅ | `min-h-[44px]` 적용 |
| 시각 분기 | mobile <768 vs desktop ≥768 동일 컴포넌트 | ✅ | Tailwind `md:` 분기 + JS `window.innerWidth` 조건 |
| 키보드 접근 | BottomSheet ESC 닫기 + focus trap | ✅ | keydown 핸들러 + Tab cycle 구현 |
| 성능 | slide-up 60fps | ✅ | CSS animation `slide-up 0.25s ease-out` (GPU composite) |
| 회귀 | 5 spec PASS 유지 | ✅ | safety baseline 4건만 drift — 예상 범위 내 |

---

## Gap Analysis

### Implementation vs Design

| Design Spec | Implemented | Gap |
|---|---|:---:|
| swipe-down to dismiss (drag > 100px) | ✅ `SWIPE_DOWN_DISMISS_PX = 100` | None |
| 데스크탑 fallback = 중앙 모달 | ✅ `md:items-center` + `desktopMaxWidth` | None |
| Filter collapsible 기본 닫힘 | ✅ `defaultOpen = false` | None |
| FilterToggle activeCount 배지 | ✅ 구현 (0이면 표시 안 함) | None |
| /super-admin 다중 모달 (Plan §Risk) | ✅ 4개 모달 모두 BottomSheet 적용 | 초과 달성 |
| tailwind animate-slide-up keyframe | ✅ `tailwind.config.ts` keyframe 추가 | None |
| body scroll lock | ✅ `document.body.style.overflow = 'hidden'` | None |
| 첫 focusable에 포커스 이동 | ✅ `requestAnimationFrame(() => first?.focus())` | None |

**Gap**: 0건. 설계 대비 초과 달성 1건 (/super-admin 4개 모달 전체 적용).

---

## Risk Retrospective

| Risk (Plan §5) | 실제 결과 | 판단 |
|---|---|---|
| visual baseline drift 다수 (8-16건) | **4건** (safety 스냅샷만) | 예상보다 적음 — /complaints·/super-admin은 drift 없이 통과 |
| swipe touch 이벤트 desktop 충돌 | 미발생 | `startYRef` null 체크로 안전 |
| /super-admin 다중 모달 범위 모호 | 4개 모달 전체 적용 | 설계 단계에서 인벤토리 완료 |
| FilterToggle 데스크탑 필터 위치 변화 | 미발생 | `md:block` 항상 펼침 유지 |
| react-focus-lock 의존성 추가 | 자체 구현으로 회피 | 10라인 Tab handler — 의존성 0 |
| /complaints 텍스트 wrap → 카드 높이 변동 | baseline drift 없음 | 모바일 스냅샷에서 drift 미확인 |

---

## Outstanding Items

| 항목 | 우선순위 | 제안 후속 PDCA |
|---|:---:|---|
| 다른 admin 페이지 모달 BottomSheet 통합 (/users, /safety 등) | Low | `bottom-sheet-rollout` |
| a11y moderate 임계값 강화 | Low | `a11y-moderate-fix` |
| swipe to refresh 등 추가 제스처 | Low | 별도 PDCA |
