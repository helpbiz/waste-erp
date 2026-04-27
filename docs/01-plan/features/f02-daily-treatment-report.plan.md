---
template: plan
version: 1.3
feature: f02-daily-treatment-report
date: 2026-04-27
author: 4365won@gmail.com
project: waste-erp (Clean ERP)
version: 0.1.0-alpha
---

# F-02 일일 처리실적 일보 PDF 출력 — Planning Document

> **Summary**: 위탁업체가 매일 지자체에 제출하는 "일일 처리실적 일보"를 ERP 데이터에서 자동 생성하여 PDF로 출력
>
> **Project**: waste-erp (Clean ERP)
> **Version**: 0.1.0-alpha
> **Author**: 4365won@gmail.com
> **Date**: 2026-04-27
> **Status**: Draft
> **Spec Reference**: [05_지자체_모니터링_확장_개발규격서.md §3.1 F-02](../../specs/05_지자체_모니터링_확장_개발규격서.md)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 위탁업체가 일일 처리실적을 수기·엑셀로 작성해 지자체 제출 → 시간 소모 + 데이터 불일치 + 증빙 부족 |
| **Solution** | ERP에 이미 적재된 `RecyclingCenterIntake` 데이터 + 신규 처리시설 마스터를 결합해 표준 PDF 자동 생성 |
| **Function/UX Effect** | 입력 화면(/performance) + 보고서 화면(/reports) 두 진입점에서 1클릭 PDF 다운로드 |
| **Core Value** | 일보 작성 30분 → 30초 (60배 단축) + 지자체 신뢰 확보 (ERP 원본 데이터 직출력) |

---

## Context Anchor

> Auto-propagated to Design/Do documents.

| Key | Value |
|-----|-------|
| **WHY** | 일일 처리실적 일보 작성·제출이 위탁업체의 일상 행정 부담이며 지자체 모니터링 신뢰도의 기반 |
| **WHO** | (1차) 위탁업체 사무직(일보 작성자), (2차) 지자체 환경과 담당 공무원(검토자) |
| **RISK** | 처리시설 마스터 신규 도입 → 기존 입력 화면(/performance) 동시 수정 필요 → 회귀 가능성 |
| **SUCCESS** | 임의 일자 선택 → 5초 내 PDF 다운로드 + 모든 반입 레코드(차량·시각·성상·중량) 포함 + 처리시설 정보 표시 |
| **SCOPE** | F-02 단일 양식만. 계근표 첨부·외부 API 연동·XLSX 출력은 제외 |

---

## 1. Overview

### 1.1 Purpose

위탁업체가 지자체에 매일 제출해야 하는 "일일 처리실적 일보"를 ERP 데이터에서 자동 생성하여 PDF로 출력. 양식 작성 행정 부담을 제거하고, 지자체에는 원본 데이터 기반의 신뢰할 수 있는 증빙을 제공.

### 1.2 Background

- 현재 `RecyclingCenterIntake` 모델에 차량별 반입 데이터가 적재되고 있으나, **처리시설(facility) 식별자가 부재**하여 일보에 핵심 정보가 누락됨
- 양식 카탈로그 18종 중 가장 빠르게 효과를 낼 수 있는 양식 (데이터 충분, 수요 빈도 일 1회, 양식 단순)
- Phase 1 양식 4종(F-02/F-07/F-09 + FORM-03) 중 첫 번째 작업 단위

### 1.3 Related Documents

- 개발 규격서: [docs/specs/05_지자체_모니터링_확장_개발규격서.md](../../specs/05_지자체_모니터링_확장_개발규격서.md)
- 기존 보고서 화면: [app/(admin)/reports/_reports-client.tsx](../../../app/(admin)/reports/_reports-client.tsx)
- 기존 실적 화면: [app/(admin)/performance/_performance-client.tsx](../../../app/(admin)/performance/_performance-client.tsx)
- 데이터 모델: [prisma/schema.prisma#L905](../../../prisma/schema.prisma)

---

## 2. Scope

### 2.1 In Scope

- [ ] `WasteTreatmentFacility` 마스터 모델 신규 (소각장/위탁처리장/매립시설/자원순환센터/기타)
- [ ] `RecyclingCenterIntake.facilityId` FK 추가 (Prisma 마이그레이션)
- [ ] 처리시설 마스터 관리 UI (간이 — 슈퍼관리자 콘솔 또는 회사정보 탭)
- [ ] `/performance` 반입 입력 폼에 처리시설 선택 드롭다운 추가
- [ ] `/reports` 메뉴에 "일일 처리실적 일보" 탭 추가 (날짜·지자체 선택 → HTML 미리보기 → PDF 다운로드)
- [ ] `/performance` 일자별 카드에 "PDF 출력" 버튼 추가 (해당 일자 즉시 출력)
- [ ] PDF 렌더링 엔진 통합 (`puppeteer` HTML→PDF)
- [ ] 표준 인쇄 레이아웃 1종 (A4 가로, 표 위주, 2인 서명란)
- [ ] PDF 다운로드 시 `AuditLog` 기록

### 2.2 Out of Scope

- 계근표 이미지 첨부란 (별도 PDF 페이지)
- XLSX 출력 (Phase 2 이후)
- 외부 계근소 API 연동 (Phase 4)
- 지자체별 양식 커스터마이징 (FORM-06 출력 양식 빌더가 담당)
- 다일자 일괄 출력 (단일 일자만)
- F-07/F-09 인쇄 양식 (별도 작업 단위)
- 디지털 직인 자동 합성 (수기 서명 전제)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `WasteTreatmentFacility` 모델: id, contractorId, type(enum), name, address, active | High | Pending |
| FR-02 | `RecyclingCenterIntake.facilityId` 컬럼 추가 + 기존 row는 NULL 허용 (이전 데이터 보존) | High | Pending |
| FR-03 | 처리시설 마스터 CRUD UI (목록·등록·수정·비활성화) | High | Pending |
| FR-04 | 반입 입력 폼([/performance](../../../app/(admin)/performance/_performance-client.tsx))에 처리시설 드롭다운 추가 | High | Pending |
| FR-05 | `/api/reports/daily-treatment` 엔드포인트: `?date=YYYY-MM-DD` → JSON (헤더 + 반입 row[]) | High | Pending |
| FR-06 | `/api/reports/daily-treatment.pdf` 엔드포인트: 동일 파라미터 → PDF binary stream | High | Pending |
| FR-07 | `/reports` 페이지에 "일일 처리실적 일보" 탭 — 날짜 picker + 미리보기 iframe + 다운로드 버튼 | High | Pending |
| FR-08 | `/performance` 일자별 카드에 "PDF 출력" 버튼 (해당 일자 1클릭 다운로드) | Medium | Pending |
| FR-09 | PDF 레이아웃: A4 가로, 헤더(업체·지자체·날짜) + 본문 표(번호·차량번호·반입시각·처리시설·성상·중량) + 합계 + 2인 서명란 | High | Pending |
| FR-10 | PDF 다운로드 시 `AuditLog` 기록 (`action="report_download"`, `entity="f02"`, `entityId=date`) | Medium | Pending |
| FR-11 | 권한 가드: 위탁업체는 자사 데이터만, 지자체는 `MuniAccessPolicy`에 따라 (BulkExport 토글 확인) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | PDF 생성 시간 < 5초 (반입 100건 기준) | 측정: `performance.now()` API 응답 시간 로깅 |
| Reliability | Puppeteer 인스턴스 풀링으로 동시 요청 안정 | 동시 5건 요청 시 모두 200 응답 |
| Security | 다른 위탁업체 데이터 접근 차단 | role=CONTRACTOR_ADMIN/INTERNAL_ADMIN/SUPER_ADMIN만 |
| Compatibility | A4 인쇄 시 텍스트 잘림 없음 | Chromium PDF 출력에서 1페이지 = 25행 기준 페이지 분할 |
| i18n | 한글 폰트 깨짐 방지 | 시스템 폰트 `Noto Sans KR` CSS 적용 (Pretendard 대체 가능) |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `WasteTreatmentFacility` 모델 마이그레이션 적용
- [ ] 처리시설 마스터 등록 가능 (최소 4종 type)
- [ ] `/performance` 반입 입력 폼에서 처리시설 선택 가능
- [ ] `/reports` "일일 처리실적 일보" 탭에서 임의 날짜 PDF 다운로드 성공
- [ ] `/performance` 일자별 카드에서 "PDF 출력" 버튼으로 1클릭 다운로드
- [ ] PDF에 표시되는 모든 반입 row가 DB의 해당 일자 데이터와 일치
- [ ] 다른 위탁업체 데이터 접근 시 403
- [ ] AuditLog에 다운로드 기록 적재
- [ ] TypeScript 컴파일 통과 / Lint 0 / Build 성공

### 4.2 Quality Criteria

- [ ] 단위 테스트: PDF API 라우트 핸들러 (행복 경로 + 권한 거부)
- [ ] E2E 테스트: 로그인 → /reports → 날짜 선택 → 다운로드 클릭 → PDF 응답 (Playwright)
- [ ] PDF 시각 회귀 테스트 1건 (스크린샷 비교, threshold 0.2)
- [ ] 한글 깨짐 0 / 표 정렬 정확

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 처리시설 마스터 도입 → 기존 반입 데이터 NULL facilityId | High | High | 마이그레이션에서 NULL 허용 + UI에서 NULL 시 "(미지정)" 표시. 일괄 backfill 스크립트는 운영 결정 사항 |
| Puppeteer 의존성(150MB) → 빌드 사이즈 증가 | Medium | High | API 라우트에서 `puppeteer-core` + `@sparticuz/chromium` 분리 검토. 서버리스 환경 대비 |
| 한글 폰트 누락으로 PDF 깨짐 | High | Medium | HTML 템플릿에 시스템 폰트 fallback 체인 + Puppeteer launch 시 폰트 디렉토리 확인 |
| `/performance` 폼 수정 → 기존 입력 워크플로우 회귀 | Medium | Medium | 폼 변경은 드롭다운 1개 추가만. 기존 필드 유지. 회귀 테스트 추가 |
| 동시 PDF 요청 시 Puppeteer 인스턴스 충돌 | Medium | Low | 단일 브라우저 인스턴스 + page 풀링 패턴 |
| 처리시설 type enum이 추후 부족 | Low | Medium | enum 대신 VARCHAR + 마스터 테이블의 type 컬럼으로 유연성 확보 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `RecyclingCenterIntake` (Prisma) | DB Model | `facilityId BigInt?` 컬럼 추가 (NULL 허용) |
| `WasteTreatmentFacility` (Prisma) | DB Model 신규 | id, contractorId, type, name, address, active |
| `/performance` 반입 입력 폼 | UI | 처리시설 드롭다운 추가 |
| `/api/intakes` (or 동등) | API | `body.facilityId` 받아 저장 |
| `/api/reports/daily-treatment(.pdf)` | API 신규 | 데이터 조회 + PDF 렌더 |
| `/reports` 페이지 | UI | 신규 탭 추가 |
| `/super-admin` 또는 `/company-info` | UI | 처리시설 마스터 관리 화면 |
| `package.json` | Config | `puppeteer` 또는 `puppeteer-core` 추가 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `RecyclingCenterIntake` | CREATE | [/performance](../../../app/(admin)/performance/_performance-client.tsx) → 반입 입력 | Needs verification — 새 facilityId 필드 |
| `RecyclingCenterIntake` | READ | [/reports](../../../app/(admin)/reports/_reports-client.tsx) → 통합 보고서 합산 | None — 기존 합산 로직 그대로 |
| `RecyclingCenterIntake` | READ | [/super-admin/aggregate](../../../app/(admin)/super-admin/_super-admin-client.tsx) → 거래처 집계 | None |
| `MuniAccessPolicy` | READ | 권한 매트릭스 | None — `allowedReports`에 `f02` 추가만 |
| `AuditLog` | CREATE | 다운로드 시점 신규 호출 | None — 기존 audit 패턴 재사용 |

### 6.3 Verification

- [ ] 기존 반입 입력 워크플로우 회귀 테스트
- [ ] 처리시설 마스터 미설정 상태에서 반입 입력 시도 → 적절한 안내 메시지
- [ ] 기존 통합 보고서(`/reports` 다른 탭) 출력 정상

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | Simple structure | Static sites | ☐ |
| **Dynamic** | Feature-based, BaaS | Web apps | ☑ |
| **Enterprise** | Strict layers, DI | Large systems | ☐ |

→ 기존 프로젝트(Dynamic) 일관성 유지

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Framework | Next.js 14 App Router | **Next.js (현재)** | 기존 코드 일관성 |
| PDF Engine | Puppeteer / pdfmake / jsPDF / react-pdf | **Puppeteer** | HTML/CSS 자유도, 한글 폰트 안정, 사용자 결정 (PDF 우선) |
| HTML Template | React SSR / Handlebars / 직접 문자열 | **React SSR (renderToStaticMarkup)** | 컴포넌트 재사용 + 미리보기와 동일 마크업 |
| Form Handling | react-hook-form / native | **native (현재 패턴)** | 기존 폼 일관성 |
| Date Picker | native input[type=date] / react-datepicker | **native** | 의존성 추가 회피 |
| Styling | Tailwind / 인쇄용 별도 CSS | **Tailwind + print-only CSS** | 미리보기·인쇄 통일 |

### 7.3 Folder Structure

```
app/(admin)/reports/
  _reports-client.tsx        (수정 — 탭 추가)
  daily-treatment/
    _daily-treatment-tab.tsx (신규 — 미리보기 + 다운로드)
    _print-template.tsx      (신규 — 인쇄용 React 컴포넌트)

app/(admin)/super-admin/
  _super-admin-client.tsx    (수정 — 처리시설 마스터 탭 추가)
  facilities/
    _facilities-tab.tsx      (신규 — 마스터 CRUD)

app/api/reports/
  daily-treatment/
    route.ts                 (신규 — JSON)
    pdf/route.ts             (신규 — PDF stream)

app/api/super-admin/
  facilities/
    route.ts                 (신규 — 마스터 CRUD)

lib/
  pdf-renderer.ts            (신규 — Puppeteer 래퍼)

prisma/
  schema.prisma              (수정 — 모델 추가)
  migrations/{timestamp}_add_treatment_facility/
```

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [x] CLAUDE.md 존재 여부 확인 필요 → 별도 검토
- [x] ESLint / Prettier 설정 존재 (next.config.js 기반)
- [x] TypeScript 엄격 모드 적용

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| **API 응답 포맷** | exists (`{data, error}` 패턴) | PDF binary 응답은 `Content-Type: application/pdf` + `Content-Disposition` | High |
| **에러 처리** | exists | PDF 생성 실패 시 fallback 페이지 vs 4xx | Medium |
| **권한 헬퍼** | exists (`readSession`) | report 다운로드 권한 체크 함수 | Medium |

### 8.3 Environment Variables Needed

| Variable | Purpose | Scope | To Be Created |
|----------|---------|-------|:-------------:|
| `PUPPETEER_EXECUTABLE_PATH` | Chromium 경로 (Docker/Vercel용) | Server | ☑ (조건부) |
| `PDF_RENDER_TIMEOUT_MS` | 렌더 타임아웃 | Server | ☑ |

---

## 9. Next Steps

1. [ ] Design 문서 작성 — 3 Architecture Options 비교 + 인쇄 레이아웃 시안 1차안
2. [ ] 인쇄 레이아웃 HTML 프로토타입 (A4 가로 시각 확인)
3. [ ] Prisma 마이그레이션 스크립트 작성 + 적용
4. [ ] FR-01~FR-11 순차 구현
5. [ ] Playwright E2E 1건 작성

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-04-27 | 초안 — 사용자 4개 결정사항 반영 (facility 신규 / 진입 2곳 / 2인 서명 / 계근 제외) | 4365won@gmail.com |
