# a11y-form-labels Design Document

> **Summary**: Plan에서 확정된 결정에 따라 aria-label 방식으로 6 파일 일괄 수정. 3-옵션 비교는 생략 (Plan에서 라벨 방식·임계값 모두 사용자 확정).
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-27
> **Status**: Draft
> **Planning Doc**: [a11y-form-labels.plan.md](../../01-plan/features/a11y-form-labels.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | e2e CI 발견 5건 즉시 해결, 검증 게이트 녹색 복구 |
| **WHO** | 스크린리더 사용자 / 키보드 사용자 / 개발자 |
| **RISK** | aria-label 텍스트 부정확 시 UX 악화 — 코드 컨텍스트 확인 |
| **SUCCESS** | a11y 9/9 + tab-modal 9/9 + visual 36/36 (베이스라인 영향 0) |
| **SCOPE** | 4 페이지 form-label + 1 toggle 키보드 + 1 spec 셀렉터 |

---

## 1. Architecture Selected

**Option: Minimal Inline aria-label** (Plan에서 확정)

| 결정 | 선택 | Rationale |
|---|---|---|
| 라벨 방식 | aria-label 인라인 | 시각 변경 0, 베이스라인 영향 0 (사용자 결정) |
| /safety 토글 | role + tabIndex + onKeyDown | DOM 형태 유지, styling 영향 0 |
| 일괄/분할 | 일괄 (6 파일 1 모듈) | 변경 작아서 분할 이익 < overhead |
| a11y 임계값 | critical 유지 | 점진 강화 정책 (사용자 결정) |

3-옵션 비교를 생략한 이유: Plan §7.2에서 모든 핵심 결정이 사용자에 의해 확정됨. 추가 분기점 없음.

---

## 2. Implementation Mapping

### 2.1 페이지별 변경

| 파일 | 라인 | 현재 | 변경 |
|---|---|---|---|
| `attendance/_attendance-client.tsx` | 46 | `<input type="date" value={selectedDate} ...>` | `+ aria-label="기준일"` |
| `users/_users-client.tsx` | 264 | `<select value={roleFilter} ...>` (권한) | `+ aria-label="권한 필터"` |
| `users/_users-client.tsx` | 268 | `<select value={statusFilter} ...>` (상태) | `+ aria-label="상태 필터"` |
| `bulky-waste/_bulky-waste-client.tsx` | 142 | `<input value={form.ppaegiUsername} ...>` | `+ aria-label="빼기앱 사용자 ID"` |
| `bulky-waste/_bulky-waste-client.tsx` | 147 | `<input type="password" value={form.ppaegiPassword} ...>` | `+ aria-label="빼기앱 비밀번호"` |
| `bulky-waste/_bulky-waste-client.tsx` | 184 | `<input value={form.adminDongCodes} ...>` | `+ aria-label="행정동 코드 (콤마 구분)"` |
| `performance/_performance-client.tsx` | 145 | `<input type="date" value={date} ...>` (기록일) | `+ aria-label="기록일"` |
| `performance/_performance-client.tsx` | 289 | `<input type="date" value={from} ...>` | `+ aria-label="조회 시작일"` |
| `performance/_performance-client.tsx` | 294 | `<input type="date" value={to} ...>` | `+ aria-label="조회 종료일"` |
| `safety/_weather-alert.tsx` | 104 | `<header onClick={() => setOpen(!open)}>` | `+ role="button" tabIndex={0} aria-expanded={open} onKeyDown` |
| `e2e/tab-modal.spec.ts` | 셀렉터 | `getByRole('button', { name: /알림\|날씨\|발송/ })` | `page.locator('header').filter({ hasText: '기상악화' })` |

### 2.2 /safety 토글 변경 상세

```tsx
// Before
<header
  className="px-5 py-4 ... cursor-pointer ..."
  onClick={() => setOpen(!open)}
>

// After (Plan §8.2 키보드 접근 컨벤션)
<header
  role="button"
  tabIndex={0}
  aria-expanded={open}
  className="px-5 py-4 ... cursor-pointer ..."
  onClick={() => setOpen(!open)}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(!open);
    }
  }}
>
```

---

## 8. Test Plan

### 8.1 검증 명령

```bash
npm run e2e:a11y         # 9/9 PASS 목표 (현재 5/9)
npm run e2e:tab-modal    # 9/9 PASS 목표 (현재 5/9, 4 graceful skip)
npm run e2e:visual       # 36/36 PASS 유지 (베이스라인 변화 없음 검증)
npm run e2e:mobile       # 37/37 PASS 유지
npx tsc --noEmit         # 0 error
```

### 8.2 수동 검증 (1회)

- [ ] /safety 페이지에서 Tab 키로 "기상악화 알림톡 공지" 헤더 도달
- [ ] Enter 또는 Space 키로 토글 동작 확인

---

## 11. Implementation Guide

### 11.1 단일 모듈

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| All Fixes | `module-1` | 6 파일 수정 + 5 spec 재실행 검증 | 8-12 |

### 11.2 실행 순서

1. attendance/_attendance-client.tsx (1줄)
2. users/_users-client.tsx (2줄)
3. bulky-waste/_bulky-waste-client.tsx (3줄)
4. performance/_performance-client.tsx (3줄)
5. safety/_weather-alert.tsx (5줄 — role/tabIndex/aria-expanded/onKeyDown 블록)
6. e2e/tab-modal.spec.ts (셀렉터 보정)
7. tsc + 5 spec 재실행

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | Minimal Design — Plan 확정 사항 매핑 | 4365won@gmail.com |
