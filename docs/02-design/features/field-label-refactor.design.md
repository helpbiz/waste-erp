# field-label-refactor Design Document

> **Summary**: Plan 확정 사항 매핑한 minimal Design. 3-옵션 비교 생략 — 모든 핵심 결정 사용자 확정.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-27
> **Status**: Draft
> **Planning Doc**: [field-label-refactor.plan.md](../../01-plan/features/field-label-refactor.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Field 단편화(10 중복) + 시맨틱 미준수 부채 해소 |
| **WHO** | 스크린리더 사용자 / 개발자 / 디자인 시스템 정합성 |
| **RISK** | cloneElement single-child 제약 위반 가능성 |
| **SUCCESS** | 공용 Field + 10 제거 + 138 통과 + 5 spec PASS + 9 aria-label 제거 |
| **SCOPE** | components/Field.tsx + 10 페이지 + 138 인스턴스 + 9 aria-label |

---

## 1. Architecture Selected

**Option: Single Shared Component with cloneElement** (Plan §7.2 확정)

| 결정 | 선택 | Rationale |
|---|---|---|
| 접근 | 공용 components/Field.tsx | 10 중복 제거 + 향후 자동 적용 |
| id 생성 | `useId()` (React 18) | SSR 안전, unique 보장 |
| 라벨 연결 | `cloneElement` + `htmlFor` | child 단일 input 가정 |
| API | label/children/hint/colSpan/required | 기존 10 정의 union |
| 적용 범위 | 138 인스턴스 동시 | typecheck + e2e 자동 검증 |
| aria-label 제거 | 9건 함께 | 시맨틱 자동 association으로 중복 제거 |

---

## 2. Implementation Mapping

### 2.1 신규 파일 (1개)

| 파일 | 내용 |
|---|---|
| `components/Field.tsx` | `useId` + `cloneElement` 시맨틱 Field |

### 2.2 수정 파일 (10개)

| 파일 | 변경 |
|---|---|
| `app/(admin)/dashboard/_attend-table.tsx` | function Field 정의 제거 + import 추가 |
| `app/(admin)/vehicles/_vehicles-client.tsx` | 동일 (단, hint props도 사용 — 호환 검증) |
| `app/(admin)/super-admin/_super-admin-client.tsx` | 동일 |
| `app/(admin)/health/_health-client.tsx` | 동일 |
| `app/(admin)/bulky-waste/_bulky-waste-client.tsx` | 동일 + colSpan 호환 |
| `app/(admin)/live-vehicles/_live-vehicles-client.tsx` | 동일 |
| `app/(admin)/users/_users-client.tsx` | 동일 + label optional 케이스 호환 |
| `app/worker/leave/_leave-client.tsx` | 동일 |
| `app/worker/performance/_performance-client.tsx` | 동일 |
| `app/worker/profile/_profile-client.tsx` | 동일 |

### 2.3 추가 정리 (선택적)

| 파일 | aria-label 제거 |
|---|---|
| `_attendance-client.tsx` | 1건 (input type=date) — Field 안 아니므로 유지 검토 |
| `_bulky-waste-client.tsx` | 5건 — Field로 감싸진 input은 제거 |
| `_performance-client.tsx` | 3건 — Field 안 아니므로 유지 검토 |

→ Do 단계에서 실제 마크업 확인 후 결정

---

## 8. Test Plan

### 8.1 검증 명령

```bash
npx tsc --noEmit               # 138 인스턴스 호환
npm run e2e:a11y               # 10/10 PASS (label association)
npm run e2e:visual             # 37/37 PASS (시각 영향 0)
npm run e2e:mobile             # 37/37 (회귀 없음)
npm run e2e:tab-modal          # 9/9 (회귀 없음)
npm run e2e:login-flow         # 4/4 (회귀 없음)
```

### 8.2 수동 검증 (1회)

- [ ] DevTools에서 임의 input + 옆 label의 `id` / `htmlFor` 일치 확인
- [ ] 라벨 클릭 시 input focus 이동 확인 (시맨틱 association 효과)

---

## 11. Implementation Guide

### 11.1 단일 모듈

| Module | Description | Est Turns |
|---|---|:---:|
| `module-1` | Field 신규 + 10 페이지 import 교체 + aria-label 정리 | 10-15 |

### 11.2 실행 순서

1. `components/Field.tsx` 작성
2. 10 페이지에서 자체 Field 함수 제거
3. 10 페이지 상단에 `import { Field } from '@/components/Field'` 추가
4. typecheck 즉시 실행 (cloneElement 호환 검증)
5. 9 aria-label 검토 — Field 래핑된 input만 제거
6. Docker 재빌드
7. 5 spec 회귀 검증
8. visual 36/36 PASS 확인 (베이스라인 갱신 불필요)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | Minimal Design — Plan 결정 매핑 | 4365won@gmail.com |
