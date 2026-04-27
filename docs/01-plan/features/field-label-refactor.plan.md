# field-label-refactor Planning Document

> **Summary**: 10개 페이지에 중복 정의된 `Field` 컴포넌트(138 사용)를 공용 `<components/Field.tsx>`로 통합. `useId` + `cloneElement`로 시맨틱 `<label htmlFor>` + input `id` 자동 연결. a11y-form-labels에서 추가했던 9개 우회용 `aria-label`을 제거하고 진짜 라벨 association으로 대체.
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
| **Problem** | 10개 페이지가 동일한 `Field` 컴포넌트를 각자 자체 정의(138 인스턴스 사용). 모두 `<div>` 라벨이라 시맨틱 HTML이 아님 → form input과 association 없음 → a11y에서 모든 입력에 `aria-label` 우회 추가 필요했음(a11y-form-labels에서 9건). 향후 form 추가마다 동일 우회 반복 강제. |
| **Solution** | `components/Field.tsx` 공용 컴포넌트 생성 (`useId` + `cloneElement`로 `<label htmlFor>` + input `id` 자동 연결). 10개 자체 정의 제거 + 138 인스턴스 일괄 import 교체. a11y-form-labels 단계의 우회 `aria-label` 9건 제거 가능. |
| **Function/UX Effect** | 시각 변화 0건 (동일 마크업 유지, label만 시맨틱화). 스크린리더 사용자가 모든 form 입력의 라벨을 자동 인식. 향후 신규 form은 `<Field label="..."><input /></Field>` 만 쓰면 a11y 자동 통과. 코드 중복 제거(10 → 1). |
| **Core Value** | a11y-serious-fix에서 학습한 "토큰 시스템 변경의 cascading 영향"의 다음 단계 — **컴포넌트 시스템도 단일 source of truth로 통합**. 향후 a11y 회귀 차단의 자동화 토대 마련. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Field 컴포넌트 단편화(10 중복)와 시맨틱 HTML 미준수가 향후 form 추가 시 a11y 우회 코드를 강제하는 구조적 부채 |
| **WHO** | 1차: 스크린리더 사용자(시맨틱 라벨), 2차: 개발자(공용 컴포넌트 단일 사용), 3차: 디자인 시스템 정합성 |
| **RISK** | cloneElement는 단일 child만 허용 — 일부 Field 인스턴스가 다중 child / 다른 props를 갖는 경우 마이그레이션 충돌 |
| **SUCCESS** | (1) 공용 Field 1개로 통합 (2) 10 자체 정의 제거 (3) 138 인스턴스 모두 통과 (4) typecheck + 5 spec 전체 PASS (5) a11y-form-labels의 9 aria-label 제거 |
| **SCOPE** | components/Field.tsx 신규 + 10 페이지 import 교체 + 138 인스턴스 검증 + 9 aria-label 제거 |

---

## 1. Overview

### 1.1 Purpose

10개 페이지에 중복 정의된 `Field` 컴포넌트를 단일 공용 컴포넌트로 통합하고 시맨틱 `<label htmlFor>`로 마이그레이션. a11y-form-labels에서 우회로 추가했던 `aria-label` 9건을 제거하여 디자인 시스템을 정리한다.

### 1.2 Background

- 2026-04-27 a11y-form-labels PDCA에서 발견: bulky-waste의 `Field`는 `<div>` 렌더 → input에 `aria-label` 우회 9건
- 2026-04-27 본 PDCA 시작 시 codebase 인벤토리: 10개 페이지가 동일 시그니처의 `Field`를 각자 정의 (시맨틱 부채 + 단편화)
- a11y-form-labels Outstanding Items에서 후속 PDCA 후보로 명시

### 1.3 Related Documents

- 선행 PDCA: [a11y-form-labels.report.md](../../04-report/a11y-form-labels.report.md) §5.1 (Field 컴포넌트 함정)
- 선행 PDCA: [a11y-serious-fix.report.md](../../04-report/a11y-serious-fix.report.md) §5.2 (디자인 시스템 정리 필요)

---

## 2. Scope

### 2.1 In Scope

- [ ] `components/Field.tsx` 공용 컴포넌트 신규 생성 (`useId` + `cloneElement`)
- [ ] 10개 페이지 자체 `Field` 정의 제거:
  - `app/(admin)/dashboard/_attend-table.tsx:291`
  - `app/(admin)/vehicles/_vehicles-client.tsx:611`
  - `app/(admin)/super-admin/_super-admin-client.tsx:1119`
  - `app/(admin)/health/_health-client.tsx:264`
  - `app/(admin)/bulky-waste/_bulky-waste-client.tsx:342`
  - `app/(admin)/live-vehicles/_live-vehicles-client.tsx:528`
  - `app/(admin)/users/_users-client.tsx:2249`
  - `app/worker/leave/_leave-client.tsx:277`
  - `app/worker/performance/_performance-client.tsx:431`
  - `app/worker/profile/_profile-client.tsx:201`
- [ ] 10 페이지에 `import { Field } from '@/components/Field'` 추가
- [ ] 138 인스턴스 모두 typecheck 통과 (cloneElement props 호환 검증)
- [ ] a11y-form-labels에서 추가한 우회용 `aria-label` 9건 제거 (bulky-waste 5건, performance 3건, attendance 1건)
- [ ] 모든 5종 e2e spec 통과 + a11y 10/10 (critical+serious) 유지
- [ ] visual-regression 36/36 PASS (시각 변화 없음 검증)

### 2.2 Out of Scope

- 다른 공용 컴포넌트 통합 (KpiCard, StatCard 등) — 별도 PDCA 후보
- Field props 추가(예: error, disabled 시각 처리) — 별도 PDCA
- Tailwind 의미 토큰 도입 — 별도 PDCA
- 새 form UX 개선(공통 validation 등) — 별도 PDCA

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `components/Field.tsx` 신규 생성, label + children + hint + colSpan + required props 지원 | High | Pending |
| FR-02 | `useId`로 unique id 생성, child input에 `cloneElement`로 id 주입 | High | Pending |
| FR-03 | `<label htmlFor={id}>` 시맨틱 사용 | High | Pending |
| FR-04 | 10 페이지 자체 정의 제거 + import 교체 | High | Pending |
| FR-05 | 138 인스턴스 typecheck 통과 | High | Pending |
| FR-06 | a11y-form-labels의 우회 `aria-label` 9건 제거 | Medium | Pending |
| FR-07 | a11y 10/10 PASS (critical+serious) 유지 | High | Pending |
| FR-08 | visual-regression 36/36 PASS (시각 변화 0) | High | Pending |
| FR-09 | 다른 spec 회귀 없음 (mobile/tab-modal/login) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement |
|---|---|---|
| 시각 변화 | 픽셀 단위 0 | visual baseline 갱신 불필요 |
| 코드 라인 변화 | 10 자체 정의(약 60 lines) 제거 + 1 신규(약 30 lines) → 순감 30 lines | git diff stat |
| 타입 안전 | tsc --noEmit 무오류 | tsc 실행 |
| 향후 확장성 | 신규 form: `<Field label><input /></Field>` 1줄로 a11y 통과 | 신규 form 작성 시 검증 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `components/Field.tsx` 존재 + 단일 책임 (label + cloneElement)
- [ ] `grep "function Field" app/` → 0 (10 자체 정의 모두 제거)
- [ ] `grep "<Field " app/` → 138 (사용은 유지)
- [ ] typecheck 무오류
- [ ] `npm run e2e:a11y` 10/10 PASS
- [ ] `npm run e2e:visual` 37/37 PASS (베이스라인 변화 없음 — 시각 동일)
- [ ] `npm run e2e:mobile` 37/37 PASS
- [ ] `npm run e2e:tab-modal` 9/9 PASS
- [ ] `npm run e2e:login-flow` 4/4 PASS

### 4.2 Quality Criteria

- 신규 Field 컴포넌트가 children에 단일 input/select/textarea를 require (TypeScript에서)
- cloneElement가 기존 child의 id를 덮어쓰지 않음 (child가 이미 id 있으면 그대로 사용)
- htmlFor와 input id가 항상 동기화

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `cloneElement` single-child 제약 위반 | High | Medium | 138 인스턴스 grep으로 사전 점검, 다중 child 케이스는 wrapper로 감싸거나 별도 처리 |
| 이미 `id` 가진 input과 충돌 | Medium | Low | cloneElement 로직에서 child.props.id 우선 사용 |
| a11y-form-labels의 `aria-label`이 더 이상 필요 없는데 남음 | Low | Low | 9건 명시 제거 + a11y 재검증 |
| 미상의 Field-like 패턴 (다른 이름) 존재 | Medium | Medium | grep `function (?:Field|FormField|Input)` 광범위 점검, 본 PDCA scope에는 Field만 |
| visual baseline 미세 변화 (label rendered 다름) | Low | Low | label은 시맨틱만 변경되고 className/style 유지. baseline 변화 0 예상 |
| 138 인스턴스 import 교체 sed 실수 | Medium | Low | 페이지별 단계 commit 또는 한 번에 처리 후 typecheck 즉시 검증 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|---|---|---|
| `components/Field.tsx` | 신규 컴포넌트 | 생성 |
| 10 페이지 클라이언트 컴포넌트 | 자체 Field 정의 | 제거 + import 추가 |
| 9 input의 `aria-label` (a11y-form-labels에서 추가) | uncontrolled props | 제거 (시맨틱 라벨로 자동 association) |

### 6.2 Current Consumers

| Resource | Operation | Impact |
|---|---|---|
| 138 `<Field>` 인스턴스 | UI 렌더 | API 동일 (label/children/hint/colSpan/required) — 호환 |
| a11y spec | input 라벨 검증 | ✅ 자동 통과 (시맨틱 label) |
| visual spec | 베이스라인 비교 | 시각 동일 — 변화 없음 |
| 신규 form 작성 | 개발자 워크플로 | ✅ 단순화 (Field만 쓰면 a11y 자동 통과) |

### 6.3 Verification

- [ ] 138 인스턴스 모두 `id` 자동 주입 검증 (devtools에서 input id + label htmlFor 매칭 sample 확인)
- [ ] `aria-label` 제거된 9 input이 axe에서 여전히 critical 0건
- [ ] visual baseline 36개 그대로 — 갱신 불필요

---

## 7. Architecture Considerations

### 7.1 Project Level

| Level | Selected |
|-------|:--------:|
| Dynamic | ☑ |

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| 통합 vs 페이지별 | **공용 컴포넌트** | 10 중복 제거 + 향후 form 추가 시 자동 적용 (사용자 결정) |
| id 생성 방식 | **`useId`** | React 18 표준, SSR 안전 |
| child 라벨 연결 | **`cloneElement`로 id 주입** | child가 단일 input일 때 가장 단순 (사용자 결정) |
| children 타입 | **단일 ReactElement** | TypeScript에서 제약 강제 → 다중 child 잘못 사용 컴파일 차단 |
| 적용 범위 | **138 인스턴스 동시** | typecheck + e2e로 회귀 자동 검증 (사용자 결정) |
| Field props | **label + children + hint + colSpan + required** | 기존 중복 정의들의 union (사용자 결정) |
| `aria-label` 제거 | **9건 함께 제거** | 시맨틱 라벨로 association 후 중복 불필요 |

### 7.3 Field 컴포넌트 설계

```tsx
// components/Field.tsx
import { useId, cloneElement, type ReactElement } from 'react';

type FieldProps = {
  label: string;
  children: ReactElement<{ id?: string }>;
  hint?: string;
  colSpan?: number;
  required?: boolean;
};

export function Field({ label, children, hint, colSpan, required }: FieldProps) {
  const fallbackId = useId();
  const childId = children.props.id ?? fallbackId;
  return (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <label
        htmlFor={childId}
        className="text-[11px] font-mono font-extrabold text-slate-700 mb-1 block"
      >
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {cloneElement(children, { id: childId })}
      {hint && <span className="text-xs text-slate-600 mt-0.5 block">{hint}</span>}
    </div>
  );
}
```

---

## 8. Convention Prerequisites

### 8.1 신규 컨벤션

| Item | Convention |
|---|---|
| Form 입력 작성 | `<Field label="..."><input ... /></Field>` 패턴 강제 (a11y 자동) |
| 페이지에 자체 Field 정의 금지 | grep `function Field` 발견 시 PR reject |
| 다중 child가 필요한 케이스 | Field 외부에 `<div className="col-span-2">` wrapper로 감싸거나 별도 컴포넌트 사용 |

### 8.2 기존 코드 정리 정책

a11y-form-labels에서 우회로 추가한 `aria-label` 9건 — Field 통합 후 자동 association 되므로 제거. 대상:
- `_attendance-client.tsx`: 1건 (input type=date)
- `_bulky-waste-client.tsx`: 5건 (input/select)
- `_performance-client.tsx`: 3건 (input type=date)

`_users-client.tsx`의 select 2건은 Field 안이 아닌 직접 사용이라 aria-label 유지.

---

## 9. Next Steps

1. [ ] `/pdca design field-label-refactor` (또는 minimal design 후 do)
2. [ ] `/pdca do field-label-refactor`
3. [ ] `/pdca analyze field-label-refactor` (또는 생략 — runtime 100% 자명 시)
4. [ ] `/pdca report field-label-refactor`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 — 10 중복 통합 + 138 인스턴스 + 9 aria-label 제거 | 4365won@gmail.com |
