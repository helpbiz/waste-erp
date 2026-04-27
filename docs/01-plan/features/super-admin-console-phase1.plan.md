---
template: plan
version: 1.3
feature: super-admin-console-phase1
date: 2026-04-28
author: 4365won@gmail.com
project: waste-erp (Clean ERP)
version: 0.1.0-alpha
---

# 슈퍼관리자 콘솔 재설계 Phase 1 — Planning Document

> **Summary**: 슈퍼관리자 콘솔 5개 탭 중 영업 시연에 직결되는 UX 7개 항목을 1주 내 완료 — DB 스키마 변경 없음, 운영 회귀 0
>
> **Project**: waste-erp (Clean ERP)
> **Version**: 0.1.0-alpha
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-28
> **Status**: Draft
> **Spec Reference**: [07_슈퍼관리자_콘솔_재설계_개발규격서.md](../../specs/07_슈퍼관리자_콘솔_재설계_개발규격서.md)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 슈퍼관리자 콘솔 5개 탭이 flat list · 기본 select · 단일 차고지 등 초기 MVP 구조에 머물러 지자체 영업 시연 시 시각적 임팩트 부족 |
| **Solution** | DB 스키마 변경 없이 광역-기초 아코디언 · 계층 권한 그룹 · SearchableSelect · DateRangePresets · 빈 화면 개선 7개 항목을 1주 집중 완료 |
| **Function/UX Effect** | Tab 1 클릭 수 1/3 감소 (17 광역 그룹), Tab 2 권한 상태 색상 즉시 식별, Tab 4 조회 진입 장벽 제거 (최근 조회 5건 · 프리셋 필터) |
| **Core Value** | 1인 운영자가 1주(16~18h)만에 영업 시연용 핵심 UX 완성. 차고지·HWP 등 고위험 작업은 Phase 2/3로 안전하게 분리 |

---

## Context Anchor

> Auto-propagated to Design/Do documents.

| Key | Value |
|-----|-------|
| **WHY** | 지자체 영업 시연 핵심 화면이 초기 MVP 수준에 머물러 계약 전환율에 영향을 주고 있음. 1주 내 시각적 임팩트 확보가 목표 |
| **WHO** | (1차) 슈퍼관리자(1인 운영자) — 시연 진행 및 일상 운영, (2차) 지자체 공무원 — 시연 참관자 |
| **RISK** | `/api/super-admin/muni-policies` region 필드 누락 시 Tab 2 계층 그룹핑 전체 블록. P1-2가 P1-4 선행 의존성 |
| **SUCCESS** | 7개 항목 모두 TypeScript 빌드 통과 + 기존 5개 탭 회귀 0 + 영업 시연 라이브 통과 |
| **SCOPE** | Phase 1 7개 항목만. DB 스키마 변경 없음. 차고지 다중(Phase 2) · Geo-fencing(Phase 3) · HWP 출력(포기) 제외 |

---

## 1. Goals & Success Criteria

### 1.1 Goals

1. 슈퍼관리자 콘솔을 지자체 영업 시연에 즉시 활용 가능한 수준으로 격상
2. DB 마이그레이션 없이 프론트엔드 + API 최소 변경만으로 시각적 임팩트 달성
3. 기존 5개 탭의 기능 회귀 없이 신규 UX 적용

### 1.2 Success Criteria

| ID | 항목 | 측정 기준 |
|----|------|-----------|
| SC-01 | Tab 3 권한설정 라운드트립 smoke test | CSV 직렬화 → 역직렬화 후 원본과 동일한 권한 객체 반환. 테스트 통과 |
| SC-02 | API region 필드 추가 | `/api/super-admin/muni-policies` 응답 JSON에 `region` 키 존재 및 비어 있지 않음 |
| SC-03 | Tab 1 광역-기초 아코디언 | 17개 광역 그룹 렌더링 + 클릭 시 소속 기초 지자체 펼침 + 접힘 동작 |
| SC-04 | Tab 2 계층 권한 뷰 | region 기준 그룹핑 + 텍스트 검색 필터 + 권한 상태 색상 배지 + 상위 지자체명 표시 |
| SC-05 | Tab 4 SearchableSelect | 드롭다운 내 텍스트 검색 + 결과 0건 시 "없음" 안내 + 정렬(가나다) |
| SC-06 | Tab 4 DateRangePresets | [오늘][이번주][이번달][전분기][올해] 클릭 시 시작/종료일 자동 세팅 + 시작>종료 유효성 차단 |
| SC-07 | Tab 4 빈 화면 개선 | 조회 이력 없는 최초 진입 시 `localStorage` 기반 최근 조회 5건 카드 표시 (첫 방문은 안내 문구) |

---

## 2. Scope

### 2.1 In Scope

- [ ] **P1-1** Tab 3 권한설정 CSV 직렬화 라운드트립 smoke test 작성 (단위 테스트)
- [ ] **P1-2** `/api/super-admin/muni-policies` 라우트에 `region` 필드 추가
- [ ] **P1-3** Tab 1 `_municipality-tab.tsx` 광역-기초 아코디언 컴포넌트
- [ ] **P1-4** Tab 2 `_policy-matrix-tab.tsx` 계층 그룹 + 검색 필터 + 콤팩트 행 + 권한 상태 시각화 + 상위 지자체 병기
- [ ] **P1-5** Tab 4 `_contractor-tab.tsx` SearchableSelect 컴포넌트 (드롭다운 검색 + 0건 정렬)
- [ ] **P1-6** Tab 4 DateRangePresets 컴포넌트 ([오늘][이번주][이번달][전분기][올해])
- [ ] **P1-7** Tab 4 빈 화면 개선 (`localStorage` 최근 조회 5건 카드)

### 2.2 Out of Scope

| 항목 | 분류 | 근거 |
|------|------|------|
| `ContractorGarage` 모델 신규 + 차고지 1:N 마이그레이션 | Phase 2 | DB 스키마 변경 → `/live-vehicles` 등 광범위 회귀 위험 |
| Tab 5 좌-우-하단 3분할 + 다중 차고지 CRUD UI | Phase 2 | 위 DB 변경 선행 필요 |
| Tab 4 Excel 출력 (`exceljs`) | Phase 2 | 라이브러리는 준비됨. 시연에 필수 아님 |
| HWP 출력 | 폐기 (Q1) | 브라우저 native 불가. 외부 변환 서비스 = 별도 계약 필요 |
| Geo-fencing (leaflet-draw + 폴리곤) | Phase 3 | 폴리곤 설계 + 이탈 감지 + 모바일 권한 = 단독 2주+ |
| Tab 5 GIS 좌표 자동 매핑 | Phase 3 | Nominatim 연동은 영업 후 |
| Tab 4 '거래처 있는 지자체만' 체크박스 | Phase 3 | 작지만 시연 필수 아님 |
| 모바일 반응형 (슈퍼관리자 콘솔) | Phase 2 이후 | 데스크톱 우선 콘솔. 모바일 시연 요구 미확인 |

---

## 3. Functional Requirements

| ID | 요구사항 | Priority | Status |
|----|----------|----------|--------|
| FR-01 | Tab 3 권한설정: CSV 직렬화(`serialize`) → 역직렬화(`deserialize`) 라운드트립 smoke test. 임의 권한 객체를 CSV 변환 후 복원했을 때 원본과 deep-equal 검증 | Must | Pending |
| FR-02 | `/api/super-admin/muni-policies` GET 응답의 각 지자체 객체에 `region: string` 필드 추가. `Municipality.region` 컬럼(기존 존재)을 SELECT에 포함하면 됨 | Must | Pending |
| FR-03 | Tab 1 광역-기초 아코디언: 17개 광역 그룹을 접힌 상태로 초기 렌더링. 광역 헤더 클릭 시 소속 기초 지자체 목록 펼침/접힘. 아코디언은 다중 펼침 허용 | Must | Pending |
| FR-04 | Tab 2 계층 권한 뷰: (a) `region` 기준으로 지자체를 광역 단위 그룹 헤더로 묶어 표시, (b) 상단 텍스트 검색으로 지자체명 실시간 필터, (c) 권한 상태를 색상 배지(활성/비활성/부분)로 시각화, (d) 기초 지자체 행에 상위 광역 지자체명 병기 | Must | Pending |
| FR-05 | Tab 4 SearchableSelect: 거래처/지자체 드롭다운에 텍스트 입력 검색 추가. 검색 결과 0건 시 "검색 결과 없음" 표시. 목록 기본 정렬은 가나다 오름차순 | Must | Pending |
| FR-06 | Tab 4 DateRangePresets: [오늘][이번주][이번달][전분기][올해] 5개 프리셋 버튼. 클릭 시 시작일·종료일 자동 세팅. 시작일 > 종료일 입력 시 UI 단에서 즉시 에러 표시 및 조회 차단 | Must | Pending |
| FR-07 | Tab 4 빈 화면 개선: 조회 결과가 없을 때 `localStorage` 키 `super-admin:recent-queries`에서 최근 조회 5건을 카드 형태로 표시. `localStorage` 미존재(첫 방문) 시 "아직 조회 이력이 없습니다" 안내 문구 표시 | Must | Pending |

---

## 4. Non-Functional Requirements

| Category | 기준 | 측정 방법 |
|----------|------|-----------|
| Performance | Tab 1 아코디언 초기 렌더 < 300ms (지자체 250건 기준) | React DevTools Profiler |
| Performance | Tab 2 검색 필터 응답 < 100ms (클라이언트 필터링) | 입력 이벤트 → 렌더 완료 시간 |
| Compatibility | Chrome/Edge 최신 버전 데스크톱에서 레이아웃 깨짐 없음 | 수동 크로스 브라우저 확인 |
| Accessibility | 아코디언 키보드 탐색 (Enter/Space 토글) | 키보드 전용 탐색 테스트 |
| Type Safety | TypeScript 컴파일 에러 0 / ESLint 경고 0 | `pnpm build` 통과 |
| Security | 슈퍼관리자(`SUPER_ADMIN`) 역할 미소지 접근 시 기존 권한 가드 동작 유지 | 역할별 접근 시도 확인 |
| Regression | 기존 Tab 1~5 기능 (권한 저장·조회·업체 조회) 회귀 없음 | 수동 스모크 테스트 5개 탭 전체 |

---

## 5. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `Municipality.region` 컬럼 일부 NULL 또는 빈 값 존재 | High | Medium | API에서 NULL → `"기타"` 그룹으로 fallback. 아코디언 "기타" 그룹을 최하단 고정 |
| P1-2 API 변경이 Tab 2 기존 소비 코드와 타입 불일치 | Medium | Medium | API 응답 타입(`MuniPolicyResponse`)에 `region?: string` optional 추가. 기존 코드 non-breaking |
| Tab 1 아코디언 DOM 노드 250+ 지자체 동시 렌더 → 초기 로드 지연 | Medium | Low | 광역 헤더만 초기 렌더. 기초 목록은 펼침 시 조건부 렌더(`{isOpen && ...}`) |
| `localStorage` 직렬화 실패(용량 초과·private mode) | Low | Low | `try/catch` wrapping. 실패 시 빈 화면 안내 문구로 graceful fallback |
| P1-4 Tab 2 수정 중 권한 저장(save) 로직 의도치 않은 변경 | High | Low | 저장 로직은 기존 핸들러 그대로 유지. 표시(뷰) 레이어만 수정. PR diff 범위 명시 |

---

## 6. Dependencies

### 6.1 내부 선행 의존성

| 선행 항목 | 후행 항목 | 이유 |
|-----------|-----------|------|
| P1-2 (API region 필드) | P1-4 (Tab 2 계층 그룹) | 클라이언트가 region 데이터 없으면 그룹핑 불가 |

### 6.2 외부 의존성

| 항목 | 현황 | 비고 |
|------|------|------|
| `exceljs ^4.4.0` | `package.json` 이미 존재 | Phase 1 미사용. Phase 2 Tab 4 Excel 출력 시 활성화 |
| `Municipality.region` 컬럼 | Prisma 스키마 이미 존재 | 추가 마이그레이션 불필요 |
| `_super-admin-client.tsx` | 기존 1136 lines, 5탭 | 탭별 분리 없음 — 수정 시 파일 크기 주의 |

### 6.3 회귀 테스트 영역

Phase 1 완료 후 반드시 검증해야 할 기존 기능:

| 탭 | 검증 항목 |
|----|-----------|
| Tab 1 지자체 관리 | 지자체 목록 조회 · 정보 수정 · 저장 |
| Tab 2 권한 매트릭스 | 권한 토글 ON/OFF · 저장 · 새로고침 후 상태 유지 |
| Tab 3 권한설정 | CSV 내보내기 · 가져오기 전체 흐름 |
| Tab 4 거래처 조회 | 기존 select 기반 거래처 선택 + 기간 조회 + 결과 표시 |
| Tab 5 회사정보 | 업체 정보 조회 · 수정 · 저장 |

---

## 7. Architecture Decisions

### 7.1 Open Questions 결정 사항

| # | 질문 | 결정 | 근거 |
|---|------|------|------|
| Q1 | HWP 출력 구현 여부 | **포기** | 브라우저 native 불가. 외부 변환 서비스는 별도 계약 필요. Phase 1/2/3 전체 제외 |
| Q2 | 차고지 다중 관리 시점 | **Phase 2로 분리** | `ContractorGarage` 1:N 전환 시 `/live-vehicles` · 배차 · 근태 API 동시 회귀 위험. 정식 계약 후 작업 |
| Q3 | Excel 출력 라이브러리 | **`exceljs` 채택** (Phase 2 시) | `package.json`에 `^4.4.0` 이미 존재. Phase 1은 Excel 미포함 |

### 7.2 기술 결정

| 결정 항목 | 선택 | 근거 |
|-----------|------|------|
| DB 스키마 변경 | **없음** | Phase 1 전 항목이 기존 컬럼만 활용. `Municipality.region` 이미 존재 |
| 신규 라이브러리 추가 | **없음** | 아코디언 · SearchableSelect · DatePresets 모두 native React 구현 |
| 공통 컴포넌트 재사용 | **적극 활용** | SearchableSelect → Phase 2 이후 다른 탭에서도 재사용 가능하도록 `components/ui/` 배치 |
| 상태 관리 | **useState (로컬)** | 서버 상태 변경 없음. 전역 스토어 도입 불필요 |
| 아코디언 구현 방식 | **CSS height 트랜지션 + conditional render** | 의존성 0. 접근성(aria-expanded) 기본 지원 |

### 7.3 파일 변경 범위

```
app/(admin)/super-admin/
  _super-admin-client.tsx          (수정 — Tab 1/2/4 뷰 로직 교체)

app/api/super-admin/
  muni-policies/
    route.ts                       (수정 — region 필드 SELECT 추가)

components/ui/
  searchable-select.tsx            (신규 — Tab 4 재사용 컴포넌트)
  date-range-presets.tsx           (신규 — Tab 4 재사용 컴포넌트)

lib/super-admin/
  serialize.ts                     (기존 또는 신규 — smoke test 대상)

__tests__/super-admin/
  serialize.smoke.test.ts          (신규 — P1-1 smoke test)
```

---

## 8. Test Plan

### 8.1 단위 테스트 (P1-1)

| 테스트 | 내용 | 도구 |
|--------|------|------|
| CSV 라운드트립 smoke | 임의 권한 객체 → `serialize()` → CSV 문자열 → `deserialize()` → deep-equal 원본 | Jest / Vitest |
| serialize 경계값 | 빈 권한 객체, 전체 권한 ON, 특수문자 포함 지자체명 | Jest / Vitest |

### 8.2 수동 스모크 테스트

| # | 시나리오 | 예상 결과 |
|---|---------|-----------|
| S-01 | Tab 1 광역 헤더 클릭 → 기초 목록 펼침 | 해당 광역 소속 기초 지자체 표시 |
| S-02 | Tab 1 같은 헤더 재클릭 | 목록 접힘 |
| S-03 | Tab 2 검색창에 지자체명 입력 | 실시간 필터링, 관련 항목만 표시 |
| S-04 | Tab 2 권한 배지 확인 | 활성/비활성/부분 색상 구분 |
| S-05 | Tab 4 SearchableSelect 텍스트 입력 | 일치 항목만 표시, 0건 시 안내 |
| S-06 | Tab 4 [이번달] 프리셋 클릭 | 시작일·종료일 자동 세팅 |
| S-07 | Tab 4 첫 진입 (localStorage 없음) | "아직 조회 이력이 없습니다" 표시 |
| S-08 | Tab 4 조회 후 재진입 | 최근 조회 5건 카드 표시 |
| S-09 | Tab 3 권한설정 CSV 내보내기 → 가져오기 | 권한 상태 동일 복원 |
| S-10 | 기존 Tab 2 권한 토글 저장 | 새로고침 후 상태 유지 |

### 8.3 회귀 체크리스트

- [ ] TypeScript 빌드 통과 (`pnpm build`)
- [ ] ESLint 경고 0 (`pnpm lint`)
- [ ] 5개 탭 전체 스모크 수동 통과
- [ ] `/api/super-admin/muni-policies` 응답에 `region` 필드 존재 확인 (DevTools Network)

---

## 9. Module Map

| Module | 작업 ID | 대상 파일 | 공수 | 의존 |
|--------|---------|-----------|------|------|
| M1 | P1-1 | `__tests__/super-admin/serialize.smoke.test.ts` | 2h | — |
| M2 | P1-2 | `app/api/super-admin/muni-policies/route.ts` | 1h | — |
| M3 | P1-3 | `app/(admin)/super-admin/_super-admin-client.tsx` (Tab 1) | 6h | — |
| M4 | P1-4 | `app/(admin)/super-admin/_super-admin-client.tsx` (Tab 2) | 5h | M2 |
| M5 | P1-5 | `components/ui/searchable-select.tsx` + Tab 4 연결 | 2h | — |
| M6 | P1-6 | `components/ui/date-range-presets.tsx` + Tab 4 연결 | 1h | — |
| M7 | P1-7 | Tab 4 빈 화면 (localStorage 로직 인라인 또는 훅) | 1h | — |

**권장 구현 순서**: M1 → M2 → M3 → M4 → M5 → M6 → M7

M1(smoke test)을 선행하면 Tab 3 CSV 직렬화 로직 파악 후 나머지 탭 수정 시 안전망 확보. M2는 M4 선행 필요이므로 M3 전후 어느 시점에 완료해도 무방.

---

## 10. Estimated Effort

| Module | 작업 | 공수 |
|--------|------|------|
| M1 | Tab 3 권한설정 smoke test | 2h |
| M2 | API region 필드 추가 | 1h |
| M3 | Tab 1 광역-기초 아코디언 | 6h |
| M4 | Tab 2 계층 그룹 + 검색 + 시각화 | 5h |
| M5 | Tab 4 SearchableSelect | 2h |
| M6 | Tab 4 DateRangePresets | 1h |
| M7 | Tab 4 빈 화면 개선 | 1h |
| **합계** | | **18h (1주)** |

**전제 조건**:
- 1인 개발, 하루 3~4h 실 작업 기준 → 약 5~6일
- M4 완료 전 M2 API 배포 필요 (로컬 개발 환경에서는 병행 가능)
- Phase 1 범위 내 추가 요구사항 발생 시 별도 협의

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-28 | 초안 — Open Questions Q1/Q2/Q3 결정 반영, Phase 1 7개 모듈 정의 | 4365won@gmail.com |
