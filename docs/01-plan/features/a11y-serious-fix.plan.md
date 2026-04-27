# a11y-serious-fix Planning Document

> **Summary**: a11y serious 위반(color-contrast 30+ nodes / scrollable-region 5 nodes)을 일괄 수정하고 a11y spec 임계값을 critical+serious로 강화한다. page 배경색 1줄 변경으로 contrast 위반의 대부분을 해소한다.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-27
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | a11y spec이 9 페이지에서 35+ serious 위반(color-contrast 30+, scrollable-region-focusable 5)을 warning으로 로깅 중. 근본 원인은 `page` 배경색 `#94a3b8`(slate-400 medium gray)이 어두운 텍스트와 1.85~4.03:1로 WCAG AA(4.5:1) 미달. 또한 Top 5 모바일 수정에서 추가한 `overflow-x-auto` 래퍼 17개에 `tabindex` 누락. |
| **Solution** | (1) `tailwind.config.ts:9` page 색상 1줄 변경 `#94a3b8 → #e2e8f0` (slate-200) — 6 페이지의 30+ contrast 위반 일괄 해소. (2) axe가 보고한 5개 `overflow-x-auto` 래퍼에 `tabIndex={0} role="region" aria-label`. (3) `a11y.spec.ts BLOCKING_IMPACTS = ['critical','serious']` 강화. |
| **Function/UX Effect** | page 배경이 좀 더 밝은 회색으로 변경됨 → 시각 변화 발생(베이스라인 36개 갱신 필요). 텍스트 가독성 개선. 키보드 사용자가 가로 스크롤 표를 Tab으로 도달·조작 가능. CI a11y 임계값 강화로 향후 serious 회귀까지 자동 차단. |
| **Core Value** | 점진적 a11y 강화 정책의 두 번째 단계 — critical(form-labels)에 이어 serious(contrast/keyboard) 해결로 WCAG 2.1 AA 준수율 대폭 상승. 디자인 시스템 토큰(page color) 1곳 변경으로 7 페이지 일괄 개선이라는 효율 입증. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | a11y serious 위반 35+건을 해소하고 spec 임계값을 critical+serious로 강화 |
| **WHO** | 시력 저하/색각 이상 사용자 / 키보드 전용 사용자 / WCAG AA 준수 정책 |
| **RISK** | page 배경색 변경 → 시각 회귀 36 baseline 모두 갱신, 디자인 의도와 어긋날 가능성 |
| **SUCCESS** | (1) a11y BLOCKING_IMPACTS=critical+serious 후 9/9 PASS (2) 시각 baseline 갱신 PR (3) CI 100% 녹색 유지 |
| **SCOPE** | tailwind.config.ts 1줄 + 5 overflow wrapper + a11y spec 임계값 + visual baseline 36 갱신 |

---

## 1. Overview

### 1.1 Purpose

a11y-form-labels(critical)에 이어 serious 임계까지 해결하여 WCAG 2.1 AA 미준수 위반을 0으로 만들고, e2e CI의 a11y 검사 임계값을 critical+serious로 강화한다.

### 1.2 Background

- 2026-04-27 a11y-form-labels PDCA 완료 후 a11y critical 0건 달성
- a11y warning 로그 분석: serious 35+건이 전 페이지에 산재
- 진단 결과 90% 이상의 contrast 위반이 page 배경색 1곳에서 기인
- 점진 강화 정책 (critical → serious → moderate)에 따라 두 번째 단계

### 1.3 Related Documents

- 선행 PDCA: [a11y-form-labels.report.md](../../04-report/a11y-form-labels.report.md)
- 부모 PDCA: [e2e-ci-integration.report.md](../../04-report/e2e-ci-integration.report.md)
- a11y spec: `e2e/a11y.spec.ts`
- 베이스라인 갱신 절차: `docs/ci-debug.md §4`

---

## 2. Scope

### 2.1 In Scope

- [ ] `tailwind.config.ts:9` page 색상 변경: `#94a3b8 → #e2e8f0` (slate-200)
- [ ] axe-core가 보고한 5개 `overflow-x-auto` 래퍼에 `tabIndex={0} role="region" aria-label="표 스크롤 영역"` 추가
  - `app/(admin)/dashboard/_attend-table.tsx` (1)
  - `app/(admin)/attendance/_attendance-client.tsx` (1)
  - `app/(admin)/vehicles/_vehicles-client.tsx` (1)
  - `app/(admin)/bulky-waste/_bulky-waste-client.tsx` (2)
- [ ] `e2e/a11y.spec.ts:9` `BLOCKING_IMPACTS = ['critical', 'serious']` 강화
- [ ] `npm run e2e:update`로 시각 baseline 36개 갱신 (별도 PR 권장)
- [ ] `npm run e2e:a11y` 9/9 PASS (serious 차단 후) 검증
- [ ] mobile-responsive / tab-modal / login-flow 회귀 없음 확인

### 2.2 Out of Scope

- moderate / minor 임계 — 별도 PDCA `a11y-moderate-fix`
- 나머지 12개 `overflow-x-auto`(5개 외) — axe 미보고. 향후 회귀로 발견 시 처리
- 다크 모드 / 색각 친화 팔레트 — 별도 디자인 시스템 작업
- 디자인 시스템 전반 리팩터(`Field` 컴포넌트가 진짜 `<label>` 렌더하도록 등) — 별도 PDCA

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | tailwind.config.ts page = '#e2e8f0' | High | Pending |
| FR-02 | 5개 overflow-x-auto에 tabIndex/role/aria-label | High | Pending |
| FR-03 | a11y.spec.ts BLOCKING_IMPACTS에 'serious' 추가 | High | Pending |
| FR-04 | 시각 baseline 36개 재캡처 + git commit | High | Pending |
| FR-05 | a11y 9/9 PASS (serious 차단 후) | High | Pending |
| FR-06 | mobile-responsive 37/37 회귀 없음 | High | Pending |
| FR-07 | tab-modal 9/9 회귀 없음 | High | Pending |
| FR-08 | login-flow 4/4 회귀 없음 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|---|---|---|
| 시각 변화 | 의도된 변경 (page bg 한정), 다른 회귀 없음 | visual diff 검토 후 baseline 갱신 |
| 키보드 접근 | 5개 표를 Tab으로 도달 + ←→키로 가로 스크롤 | 수동 검증 1회 |
| 회귀 차단 | a11y spec 강화 후 모든 spec PASS | CI 통과 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `npm run e2e:a11y` 9/9 PASS (BLOCKING_IMPACTS=['critical','serious'])
- [ ] `npm run e2e:visual` 36/36 PASS (새 baseline)
- [ ] `npm run e2e:mobile` 37/37 (회귀 없음)
- [ ] `npm run e2e:tab-modal` 9/9 (회귀 없음)
- [ ] `npm run e2e:login-flow` 4/4 (회귀 없음)
- [ ] tsc --noEmit 무오류

### 4.2 Quality Criteria

- 변경 라인 수 ≤ 30 (tailwind 1, spec 1, 5 overflow wrapper 5)
- 시각 baseline diff가 page 배경색 변화로만 설명 가능
- 키보드로 모든 표 도달 가능

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| page 배경 변경이 디자인 의도와 다름 | High | Medium | slate-200/50 두 후보 중 사용자 선택. 변경 후 시각 검토 → 베이스라인 PR 별도 |
| axe가 미보고한 추가 contrast 위반 | Medium | Medium | 첫 도입 후 잠시 모니터, 발견 시 색상 미세 조정 또는 텍스트 색상 강화 |
| moderate 위반이 노출되며 차단 발생 | Low | Low | BLOCKING_IMPACTS는 'critical','serious'만 — moderate는 warning |
| 5개 외 overflow에서 누락 발견 | Medium | Low | spec이 모든 페이지 검사 — 발견 시 동일 패턴 적용 |
| 새 baseline에 의도치 않은 변화 포함 | High | Low | diff 검토 — 다른 변화 발견 시 즉시 원복 후 재분석 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|---|---|---|
| `tailwind.config.ts` | Theme token | page 색상 1줄 변경 |
| `app/(admin)/dashboard/_attend-table.tsx` | Component | overflow wrapper 속성 추가 |
| `app/(admin)/attendance/_attendance-client.tsx` | Component | 동일 |
| `app/(admin)/vehicles/_vehicles-client.tsx` | Component | 동일 |
| `app/(admin)/bulky-waste/_bulky-waste-client.tsx` | Component | 동일 (2건) |
| `e2e/a11y.spec.ts` | Spec | BLOCKING_IMPACTS 변경 |
| `e2e/visual-regression.spec.ts-snapshots/` | Baseline | 36 PNG 갱신 |

### 6.2 Current Consumers

| Resource | Operation | Impact |
|---|---|---|
| 모든 페이지 (page bg 사용) | Visual | 배경색 미세 밝아짐 — 의도된 변경 |
| 키보드 사용자 | 표 스크롤 | ✅ 개선 |
| visual-regression 36 baseline | 시각 비교 | ⚠️ 갱신 필수 |
| 다른 spec | 회귀 | 변화 없음 예상 |

### 6.3 Verification

- [ ] visual baseline diff가 page 배경 변화로만 설명되는지 시각 검토
- [ ] 모든 e2e spec 통과
- [ ] 키보드 수동 검증 (Tab으로 5개 표 도달)

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Selected |
|-------|:--------:|
| Dynamic | ☑ (변경 없음) |

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| Contrast 수정 방식 | **page 배경색 변경** | 1줄로 7 페이지 30+ 위반 해결 — 사용자 결정 |
| Page 색상 후보 | **`#e2e8f0` (slate-200)** | slate-50보다 약간 더 분명한 회색 유지 (디자인 의도 보존) |
| Scrollable wrapper 수정 범위 | **axe 보고 5개만** | 사용자 결정 — 17개 일괄은 불필요 |
| a11y 임계값 | **critical + serious** | 사용자 결정 — 점진 강화 다음 단계 |
| Baseline 갱신 | **별도 PR 분리** | ci-debug.md §4 절차 준수 |

---

## 8. Convention Prerequisites

### 8.1 신규 컨벤션

| Item | Convention |
|---|---|
| Scrollable region 패턴 | `<div tabIndex={0} role="region" aria-label="...">` 일괄 적용 |
| a11y 임계값 점진 강화 정책 | critical(완료) → serious(이번) → moderate(차후) → minor(차후) |

### 8.2 베이스라인 갱신 PR 작성

ci-debug.md §4 절차 적용:
- 별도 브랜치 `chore/visual-baseline-update-a11y-serious`
- PR description에 변경 사유 명시 (page 배경 + 5 wrapper)
- reviewer 1명 이상 승인

---

## 9. Next Steps

1. [ ] `/pdca design a11y-serious-fix` (또는 변경 작아 minimal design 후 do)
2. [ ] `/pdca do a11y-serious-fix` — 6 파일 수정 + baseline 갱신
3. [ ] `/pdca analyze a11y-serious-fix` — 5종 spec 재검증
4. [ ] `/pdca report a11y-serious-fix`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 — page 배경 + 5 wrapper + 임계값 강화 | 4365won@gmail.com |
