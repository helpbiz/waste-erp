# mobile-admin-landings Planning Document

> **Summary**: admin role의 모바일 첫 랜딩(`/complaints`)과 슈퍼관리자 콘솔(`/super-admin`)에서 카드 액션 버튼 협소·상세 모달 닫기 불편·모바일 표준 이탈 3가지 pain point를 해결한다.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-28
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | admin 사용자(super/company/manager)가 모바일에서 `/complaints`를 첫 랜딩으로 사용 중인데(또는 `/super-admin` 콘솔 접근 시), (1) 카드의 텍스트와 액션 버튼이 작고 좁아 터치 정확도 낮음, (2) 상세 모달이 화면을 가려서 닫기 어려움(모달 외부 클릭 영역 좁음), (3) 모바일 표준 패턴(bottom sheet / 큰 터치 타겟 / swipe to close)에 미달. 가로 오버플로우는 없으나 사용성이 떨어진다. |
| **Solution** | (1) 카드 액션 버튼을 모바일에서 `flex-wrap` + 최소 44x44px 터치 타겟 + 큰 폰트로 강화. (2) 상세 모달을 모바일(<768px)에서 **bottom sheet 패턴**으로 전환 — 화면 하단에서 슬라이드 업, 80vh, swipe-to-dismiss 또는 sticky close 버튼. (3) 필터 다중 필드를 모바일에서 collapsible "필터 보기" 토글로 압축 — 기본은 닫힘. |
| **Function/UX Effect** | 모바일 admin 사용자가 / complaints 카드 액션을 한 손으로 정확히 누르고, 모달을 swipe 또는 큰 close 버튼으로 즉시 닫고, 필터 영역의 화면 점유를 줄여 콘텐츠에 집중할 수 있다. 데스크탑 UX는 유지(반응형 분기). |
| **Core Value** | "모바일에서도 데스크탑과 동등한 작업 효율" — admin role 사용자가 외근/현장에서 phone으로 주요 업무(민원 처리, 상태 변경)를 수행 가능. 향후 추가 admin 페이지에 동일 모바일 패턴(BottomSheet 컴포넌트, FilterToggle 컴포넌트) 재사용 토대. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | admin 모바일 첫 랜딩의 카드/모달/필터 UX가 모바일 표준에 미달, 한 손 사용 정확도 떨어짐 |
| **WHO** | super_admin / contractor_admin / internal_admin / muni_admin (4 admin role), 모바일 환경 |
| **RISK** | bottom sheet 도입 → 데스크탑/모바일 분기 코드 증가 + visual baseline drift 다수 발생 가능. 기존 모달 사용처가 다른 페이지에도 있으면 일관성 위해 추가 작업 필요 |
| **SUCCESS** | (1) 카드 액션 터치 타겟 ≥44x44px (2) 모바일 모달 = bottom sheet (3) 필터 collapsible (4) e2e 5 spec 회귀 없음 (5) 새 baseline 갱신 PR 통과 |
| **SCOPE** | `/complaints` 카드 + 모달 / `/super-admin` 모달 / 새 컴포넌트 `BottomSheet` + `FilterToggle`. 다른 페이지 모달 통합은 별도 PDCA |

---

## 1. Overview

### 1.1 Purpose

admin 모바일 사용자(super/company/manager)가 외근·이동 중 한 손으로 민원 처리·상태 변경·콘솔 작업을 수행할 수 있도록, `/complaints`와 `/super-admin`의 카드·모달·필터 UX를 모바일 표준 패턴으로 보강한다.

### 1.2 Background

- 사용자 보고 (2026-04-28): "지금 super와 company, manager 화면은 데스크톱 그대로여서 모바일 사용이 불편" — `mobile-admin-landing` 단순 redirect 만으로는 부족, 페이지 자체의 모바일 UX 보강 필요.
- 4 PDCA 누적 후속 PDCA 후보 (mobile-admin-landings 첫번째)
- 검증: 가로 오버플로우 미발생 (4 device PASS) — **세부 UX 개선 영역**
- 사용자 결정 (Pain Points): (1) 카드 액션 협소, (2) 모달 닫기 불편, (3) 모바일 표준 미달
- 사용자 결정 (Scope): /complaints + /super-admin 통합

### 1.3 Related Documents

- 선행 PR: [#1 LogoutButton contrast](https://github.com/helpbiz/waste-erp/pull/1)
- 선행 PR: [#2 Escape key + worker tab active + SOS padding](https://github.com/helpbiz/waste-erp/pull/2)
- 선행 단순 변경: `mobile-admin-landing` (login redirect mobile→/dashboard)
- 통합 이력: [docs/mobile-history.md](../../mobile-history.md)
- 슈퍼관리자 콘솔 이력: [docs/super-admin-history.md](../../super-admin-history.md)

---

## 2. Scope

### 2.1 In Scope

- [ ] `components/BottomSheet.tsx` 신규 — 모바일 bottom sheet (슬라이드 업, swipe-to-dismiss, ESC, focus trap, role="dialog")
- [ ] `components/FilterToggle.tsx` 신규 — 모바일에서 필터 영역 collapsible
- [ ] `/complaints` 카드 (`_complaints-client.tsx`) — 액션 버튼 영역 모바일 분기 (44x44px, font-bold, 줄바꿈)
- [ ] `/complaints` 상세 모달 → BottomSheet 적용 (모바일 분기)
- [ ] `/complaints` 필터 영역 → FilterToggle 적용 (모바일 분기)
- [ ] `/super-admin` 콘솔 모달 → BottomSheet 적용
- [ ] e2e visual baseline 갱신 (drift 예상 — workflow_dispatch로 자동)
- [ ] mobile-history.md에 이번 사이클 추가

### 2.2 Out of Scope

- 다른 페이지의 모달 통합 (`/users`, `/safety` 등) — 별도 PDCA `bottom-sheet-rollout`
- 카드 자체의 정보 구조 변경 — UX 개선만, 기능 변경 X
- 다크 모드 / 색각 친화 — `a11y-moderate-fix` PDCA
- /complaints 신규 기능 — 기존 기능 보존
- swipe to refresh 등 모바일 제스처 — 별도 후속

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `BottomSheet` 컴포넌트 — 모바일(<768px)에서 화면 하단 슬라이드 업, 80vh, drag handle, swipe-down to dismiss, Escape 키, focus trap, role="dialog", aria-modal | High | Pending |
| FR-02 | `BottomSheet` — 데스크탑(≥768px)에서는 기존 중앙 모달 형태 유지 (responsive variant) | High | Pending |
| FR-03 | `FilterToggle` 컴포넌트 — 모바일에서 "🔍 필터 (n)" 버튼 + 펼침/접힘 / 데스크탑 항상 펼침 | Medium | Pending |
| FR-04 | `/complaints` 카드 액션 버튼 영역 — 모바일에서 `flex-wrap gap-2` + min-h-[44px] + text-sm font-bold | High | Pending |
| FR-05 | `/complaints` 상세 모달 → BottomSheet 적용 | High | Pending |
| FR-06 | `/complaints` 필터 → FilterToggle 적용 | Medium | Pending |
| FR-07 | `/super-admin` 모달 (1136 라인 — 다중 모달 가능) → BottomSheet 적용 | High | Pending |
| FR-08 | e2e 5 spec 회귀 없음 + visual baseline 자동 갱신 | High | Pending |
| FR-09 | a11y critical+serious 위반 없음 (BottomSheet에 role/aria-* 적절히) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|----------|----------|-------------|
| 터치 타겟 | 카드 액션 버튼 ≥ 44x44px (Apple HIG / Material) | Chrome DevTools Inspector |
| 시각 분기 | mobile <768 vs desktop ≥768 — 동일 컴포넌트가 두 형태 렌더 | Playwright 4 device 스냅샷 |
| 키보드 접근 | BottomSheet ESC 닫기 + focus trap | Playwright keyboard 시뮬 |
| 성능 | BottomSheet 슬라이드 업 60fps | 시각 검증 |
| 회귀 | mobile-responsive / a11y / login-flow 모두 PASS 유지 | GHA |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] BottomSheet + FilterToggle 컴포넌트 신규 + tsc 무오류
- [ ] /complaints에 적용 (카드 + 모달 + 필터)
- [ ] /super-admin 모달에 적용
- [ ] PR Checks (functional + visual) 모두 ✅ (visual은 baseline 갱신 후)
- [ ] mobile-history.md 갱신
- [ ] WCAG 2.1.2 (No Keyboard Trap) + 4.1.2 (Name/Role/Value) 준수

### 4.2 Quality Criteria

- 데스크탑 UX 변화 없음 (기존 중앙 모달 + 항상 펼친 필터)
- 변경 라인 ≤ 400 (compute: 2 신규 컴포넌트 + 2 페이지 patch)
- a11y critical 0 / serious 0 유지

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| BottomSheet 도입으로 visual baseline drift 다수 (4 device × 2 페이지 = 8 PNG 이상) | Medium | High | workflow_dispatch update_snapshots로 자동 갱신 (PR template §3 안내) |
| swipe-to-dismiss touch 이벤트가 desktop에서 충돌 | Medium | Low | 미디어 쿼리로 mobile만 touch handler 등록 |
| /super-admin 다중 모달 (어느 모달이 BottomSheet 대상?) | Medium | Medium | Design 단계에서 모달 인벤토리 + 우선순위 결정. 기본은 가장 자주 보이는 1-2개만 |
| FilterToggle 도입으로 데스크탑 필터 위치 변화 | Low | Low | desktop은 항상 펼침 — 기존과 시각 동일 |
| focus trap 구현 시 react-focus-lock 의존성 추가 | Low | Medium | 자체 구현 권장 (5 라인 핸들러) — 의존성 없음 |
| /complaints 텍스트 wrap이 카드 높이 변동 → baseline drift | Low | Medium | 모바일에서만 적용 → 모바일 baseline만 영향 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|---|---|---|
| `components/BottomSheet.tsx` | 신규 | 모바일 bottom sheet + 데스크탑 fallback |
| `components/FilterToggle.tsx` | 신규 | 모바일 collapsible filter |
| `app/(admin)/complaints/_complaints-client.tsx` | Modify | 카드 액션 + 모달 + 필터 patch |
| `app/(admin)/super-admin/_super-admin-client.tsx` | Modify | 1-2개 주요 모달을 BottomSheet으로 |
| `e2e/visual-regression.spec.ts-snapshots/*.png` | 갱신 | 8-16건 baseline drift (workflow_dispatch로 자동) |
| `docs/mobile-history.md` | Modify | 이번 사이클 추가 |

### 6.2 Current Consumers

| Resource | Impact |
|---|---|
| `/complaints` 데스크탑 사용자 | 변화 없음 (반응형 분기) |
| `/complaints` 모바일 사용자 | ✅ 한 손 조작 정확도 ↑ |
| `/super-admin` 데스크탑 | 변화 없음 |
| `/super-admin` 모바일 | ✅ 모달 dismiss 편의성 ↑ |
| 기타 admin 페이지 | 변화 없음 (BottomSheet 적용 외) |

### 6.3 Verification

- [ ] 5 e2e spec 모두 PASS (visual은 baseline 갱신 후)
- [ ] 키보드 ESC로 BottomSheet 닫힘
- [ ] DevTools 모바일 시뮬에서 swipe-down 동작
- [ ] 데스크탑에서 BottomSheet이 중앙 모달로 표시 (또는 동일 형태 유지)

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Selected |
|-------|:--------:|
| Dynamic | ☑ |

### 7.2 Key Architectural Decisions

| Decision | Options | Rationale |
|----------|---------|-----------|
| 모바일 모달 패턴 | BottomSheet (슬라이드 업) | 모바일 표준 (iOS/Android 공통). 사용자 결정 |
| 컴포넌트 위치 | `components/*.tsx` (공용) | 다른 페이지 재사용 토대 |
| 분기 방식 | Tailwind `md:` + JS conditional | tailwind는 시각, JS는 swipe handler — 둘 다 필요 |
| Focus trap | 자체 구현 (~10 라인) | 의존성 회피 |
| Filter 토글 | 모바일만 collapsible | 데스크탑 사용자 영향 0 |

### 7.3 BottomSheet 시그니처 (예시)

```tsx
<BottomSheet
  open={open}
  onClose={() => setOpen(false)}
  title="민원 상세"
  height="80vh"  // optional
>
  {/* 내용 */}
</BottomSheet>
```

내부 분기:
- mobile: `<div className="fixed inset-x-0 bottom-0 ...">` + slide-up animation
- desktop: 기존 중앙 모달 그대로

---

## 8. Convention Prerequisites

### 8.1 신규 컨벤션

| Item | Convention |
|---|---|
| 모바일 모달 | `<BottomSheet>` 사용 (커스텀 fixed 모달 금지) |
| 모바일 필터 | `<FilterToggle>` wrap |
| 터치 타겟 최소 | min-h-[44px] (CTA 버튼) |
| swipe-to-dismiss | mobile에서만, drag distance > 100px 시 close |

### 8.2 기존 코드와 호환성

- BottomSheet는 기존 `<div className="fixed inset-0 z-50">` 모달과 호환되도록 prop 시그니처 동일하게
- 점진 마이그레이션: 이번 PDCA는 2 페이지만, 다른 페이지는 별도 PDCA에서 마이그레이션

---

## 9. Next Steps

1. [ ] `/pdca design mobile-admin-landings` — 3가지 아키텍처 옵션 (Minimal / Clean / Pragmatic) + BottomSheet 시그니처 확정
2. [ ] `/pdca do mobile-admin-landings` — 2 신규 컴포넌트 + 2 페이지 patch
3. [ ] PR 생성 + workflow_dispatch baseline 갱신 + merge
4. [ ] `/pdca report mobile-admin-landings` — 학습 정리

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-28 | 초안 — 3 pain points + 2 페이지 + BottomSheet/FilterToggle 도입 | 4365won@gmail.com |
