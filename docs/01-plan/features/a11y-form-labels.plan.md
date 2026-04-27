# a11y-form-labels Planning Document

> **Summary**: e2e a11y spec이 발견한 4건의 critical form-label 위반과 1건의 tab-modal 셀렉터 이슈를 일괄 수정하여 a11y 검사를 100% 통과시킨다. aria-label 방식으로 시각 변경 없이 접근성을 확보한다.
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
| **Problem** | e2e-ci-integration framework가 첫 실행에서 4건의 critical a11y 위반(`<input type=date>` 라벨 누락, `<select>` accessible name 누락 등)을 발견. 스크린리더 사용자에게 입력 필드의 의미 전달 불가 → WCAG 2.1 AA 4.1.2/3.3.2 위반. CI는 현재 이 회귀를 차단 중이라 정상 상태로 복구 필요. |
| **Solution** | 4개 페이지의 모든 unlabeled form 입력에 `aria-label` 추가 (시각 변경 없음). 추가로 `/safety` 날씨 알림 토글이 `<header onClick>`이라 키보드 접근 불가 — `role="button" + tabIndex/onKeyDown` 또는 `<button>`로 의미 보강. tab-modal 셀렉터를 새 식별자에 맞춰 보정. |
| **Function/UX Effect** | 시각적 변경 0건. 스크린리더 사용자가 모든 form 입력의 의미를 듣고 조작 가능. CI a11y critical 0건 + tab-modal 5/5 PASS → e2e CI 100% 통과. |
| **Core Value** | 회귀 차단 게이트가 발견한 첫 production 버그를 1 사이클 만에 해결 → e2e-ci-integration 도입 효과의 자체 입증. 향후 form 추가 시 a11y 미준수가 PR 단계에서 자동 차단됨. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | e2e CI가 발견한 4건 critical + 1건 important를 즉시 해결하여 검증 게이트를 녹색 상태로 복구 |
| **WHO** | 1차: 스크린리더 사용자, 2차: 키보드 사용자(/safety 토글), 3차: 개발자(CI 녹색 회복) |
| **RISK** | aria-label 텍스트 부정확 시 오히려 UX 악화 — 각 필드의 실제 의미를 코드 컨텍스트에서 확인 필요 |
| **SUCCESS** | (1) `npm run e2e:a11y` 9/9 PASS (2) `npm run e2e:tab-modal` 9/9 PASS (3) `<input type=date>` 모두 aria-label (4) 모든 `<select>` accessible name |
| **SCOPE** | 4 페이지 form-label + 1 페이지 toggle 키보드 접근 + 1 spec 셀렉터 보정. 별도 PDCA로 분리: serious/moderate a11y, color contrast |

---

## 1. Overview

### 1.1 Purpose

e2e-ci-integration framework가 첫 실행에서 자동 발견한 critical 5건을 일괄 수정하여 CI를 녹색으로 복구하고, 회귀 차단 게이트의 실효성을 입증한다.

### 1.2 Background

- 2026-04-27 e2e-ci-integration PDCA 완료 (Match Rate 98.5%)
- a11y spec(critical-only) 첫 실행에서 4건 위반 발견 — Plan Risk #4 예측 적중
- tab-modal `/safety` 셀렉터 미매칭으로 4 디바이스 모두 graceful skip
- 사용자 결정: critical 4건 + tab-modal 1건을 별도 PDCA로 분리 처리 (Match Rate 98.5% → 100% 목표는 이번 PDCA의 부수 결과)

### 1.3 Related Documents

- 선행 PDCA: [e2e-ci-integration.report.md](../../04-report/e2e-ci-integration.report.md) §4 Outstanding Items
- a11y spec: `e2e/a11y.spec.ts`
- tab-modal spec: `e2e/tab-modal.spec.ts`

---

## 2. Scope

### 2.1 In Scope

- [ ] `/attendance` `<input type="date">` 1건 → `aria-label="기준일"` (`_attendance-client.tsx:46`)
- [ ] `/users` `<select>` 2건 → `aria-label` (필터: 권한, 상태) (`_users-client.tsx:264, 268`)
- [ ] `/bulky-waste` form 입력 3건 → `aria-label` (빼기 ID/PW + 행정동 코드 등) (`_bulky-waste-client.tsx:142, 147, 184`)
- [ ] `/performance` `<input type="date">` 3건 → `aria-label` (기록일 / 시작일 / 종료일) (`_performance-client.tsx:145, 289, 294`)
- [ ] `/safety` `<header onClick>` 토글 → `role="button" tabIndex={0} onKeyDown` 또는 `<button>` (`_weather-alert.tsx:104`)
- [ ] `e2e/tab-modal.spec.ts` 셀렉터 보정 → `page.locator('header').filter({ hasText: '기상악화' })` 또는 `getByRole('button', { name: /기상악화/ })`
- [ ] 모든 수정 후 `npm run e2e:a11y` 9/9 PASS, `npm run e2e:tab-modal` 9/9 PASS 검증

### 2.2 Out of Scope

- serious 임계 위반 (color-contrast, scrollable-region-focusable 등) — 별도 PDCA `a11y-serious-fix`
- moderate/minor — 별도 PDCA
- 신규 페이지 — 본 PDCA는 발견된 4 페이지만
- form 디자인 변경 — `aria-label` 방식 (사용자 결정)
- 모바일 화면 외 데스크톱 추가 검사 — Out of scope

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `/attendance` 날짜 input → `aria-label="기준일"` | High | Pending |
| FR-02 | `/users` role/status 필터 select 2건 → 각각 `aria-label` | High | Pending |
| FR-03 | `/bulky-waste` 빼기 username/password + 행정동 코드 input 3건 → `aria-label` | High | Pending |
| FR-04 | `/performance` 날짜 input 3건 → `aria-label` (기록일/시작일/종료일) | High | Pending |
| FR-05 | `/safety` 날씨 알림 헤더 토글 → 키보드/스크린리더 접근 가능 | High | Pending |
| FR-06 | `e2e/tab-modal.spec.ts` 날씨알림 셀렉터 보정 | Medium | Pending |
| FR-07 | `npm run e2e:a11y` 9/9 PASS (critical 0건) | High | Pending |
| FR-08 | `npm run e2e:tab-modal` 9/9 PASS | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|---|---|---|
| 시각적 영향 | 픽셀 단위 변화 0 | `npm run e2e:visual` 36/36 PASS (베이스라인 갱신 불필요) |
| 키보드 접근 | /safety 토글 Tab 키로 도달 + Enter/Space로 작동 | Playwright `page.keyboard.press` 검증 |
| 회귀 | mobile-responsive 37/37 유지 | 변경 후 재실행 |
| 타입 안전 | tsc --noEmit 무오류 | 변경 후 재실행 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `npm run e2e:a11y` 9/9 PASS (현재 5 PASS / 4 fail)
- [ ] `npm run e2e:tab-modal` 9/9 PASS (현재 5 PASS / 4 graceful skip)
- [ ] `npm run e2e:mobile` 37/37 유지
- [ ] `npm run e2e:visual` 36/36 PASS — **베이스라인 PNG 변화 없음** (시각 영향 0 검증)
- [ ] tsc --noEmit 무오류

### 4.2 Quality Criteria

- aria-label 텍스트가 한국어 사용자에게 자연스러운가 (예: "기준일" vs "날짜 선택")
- /safety 토글이 Tab 키로 도달 가능 + Enter/Space로 작동 (수동 검증 1회)
- 변경 라인 수 ≤ 30 (최소 침습)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `aria-label` 텍스트가 모호 | Medium | Medium | 페이지 컨텍스트 + 주변 라벨 텍스트 참조 후 명명 |
| `/safety` 헤더를 `<button>`으로 바꾸면 styling 변경 | Medium | Medium | `role/tabIndex/onKeyDown` 추가만으로 처리 (DOM 형태 유지) |
| 베이스라인 변경 발생 (시각 회귀 fail) | Medium | Low | aria-label은 비시각 속성 — 영향 0 예상. 발생 시 즉시 원복 후 재검토 |
| 다른 페이지에 누락된 추가 위반 발견 | High | Medium | 본 PDCA에선 발견된 4 페이지만 처리, 신규 발견은 별도 PDCA |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|---|---|---|
| `app/(admin)/attendance/_attendance-client.tsx` | React component | `<input type=date>` 에 aria-label |
| `app/(admin)/users/_users-client.tsx` | React component | 2 `<select>` 에 aria-label |
| `app/(admin)/bulky-waste/_bulky-waste-client.tsx` | React component | 3 `<input>` 에 aria-label |
| `app/(admin)/performance/_performance-client.tsx` | React component | 3 `<input type=date>` 에 aria-label |
| `app/(admin)/safety/_weather-alert.tsx` | React component | `<header>` 에 role/tabIndex/onKeyDown (또는 `<button>`) |
| `e2e/tab-modal.spec.ts` | Playwright spec | 셀렉터 보정 |

### 6.2 Current Consumers

| Resource | Operation | Impact |
|---|---|---|
| 기존 사용자(시각) | UI 표시 | 변화 없음 — aria-label은 비시각 |
| 스크린리더 사용자 | 입력 의미 파악 | ✅ 개선 |
| 키보드 사용자 | /safety 토글 도달 | ✅ 개선 |
| e2e:visual 베이스라인 36 PNG | 시각 비교 | 변화 없음 예상 |
| e2e:mobile 37 테스트 | 가로 오버플로우 | 변화 없음 |

### 6.3 Verification

- [ ] mobile-responsive 37/37 유지
- [ ] visual 36/36 PASS (베이스라인 갱신 불필요 확인)
- [ ] a11y 9/9 PASS
- [ ] tab-modal 9/9 PASS (날씨알림 4건 새로 통과)
- [ ] tsc --noEmit 무오류

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Selected |
|-------|:--------:|
| Dynamic | ☑ (변경 없음) |

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| 라벨 방식 | **aria-label** | 시각 변경 0, 가장 빠름, 베이스라인 영향 0 (사용자 결정) |
| /safety 토글 처리 | **role + tabIndex + onKeyDown** | DOM 구조 유지, styling 영향 0 |
| tab-modal 셀렉터 | `page.locator('header').filter({ hasText: '기상악화' })` 또는 `getByRole` | 텍스트 기반으로 견고 |
| a11y 임계값 | **critical 유지** | 사용자 결정 — 점진 강화 정책 |

---

## 8. Convention Prerequisites

### 8.1 aria-label 명명 규칙 (신규)

| 입력 종류 | aria-label 패턴 |
|---|---|
| 날짜 선택 | "기준일", "기록일", "시작일", "종료일" 등 의미 명시 |
| 필터 select | "{필터 대상} 필터" 또는 "{필터 대상} 선택" |
| 외부 시스템 자격 | "{시스템} {필드}" (예: "빼기앱 사용자 ID") |
| 행정 코드 | "행정동 코드 (콤마 구분)" 등 입력 형식 힌트 포함 |

### 8.2 키보드 접근 규칙 (신규)

clickable 요소가 `<button>`/`<a>`가 아닐 때:

```tsx
// ❌ Before
<header onClick={() => setOpen(!open)}>...</header>

// ✅ After
<header
  role="button"
  tabIndex={0}
  aria-expanded={open}
  onClick={() => setOpen(!open)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(!open);
    }
  }}
>...</header>
```

---

## 9. Next Steps

1. [ ] `/pdca design a11y-form-labels` — 3개 architecture 옵션 비교 (Minimal vs Refactored vs Pragmatic)
2. [ ] `/pdca do a11y-form-labels` — 6개 파일 수정
3. [ ] `/pdca analyze a11y-form-labels` — e2e 5종 spec 재실행 + Match Rate 측정
4. [ ] `/pdca report a11y-form-labels` — 완료 보고

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 — e2e가 발견한 5건 일괄 수정 계획 (aria-label 방식) | 4365won@gmail.com |
