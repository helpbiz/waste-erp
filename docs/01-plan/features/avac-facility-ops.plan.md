# avac-facility-ops Planning Document

> **Summary**: Streamlit `07_시설운영.py`의 AVAC 시설 일일운영 기능(운전기록 입력·집계·Excel/PDF 출력)을 Next.js PWA 슈퍼관리자 콘솔로 이식한다.
>
> **Project**: waste-erp
> **Version**: 0.1.0-alpha.1
> **Author**: 4365won@gmail.com
> **Date**: 2026-05-04
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | AVAC 운영업체(파주·김포)의 시설 일일운전기록(가동시간·처리량·전력)이 Streamlit 앱(port 8502)에만 존재하여, PWA 통합 전까지 두 앱을 병행 운영해야 하는 비효율 발생. PWA /super-admin에 해당 기능 없음. |
| **Solution** | Prisma에 `FacilityDailyOps` 모델 추가 → `/api/super-admin/facility-ops` REST 라우트 신설 → super-admin 콘솔에 `facility-ops` 탭(3 서브탭: 운전기록 입력·집계 현황·출력) 추가. |
| **Function/UX Effect** | AVAC 운영 담당자가 PWA 슈퍼관리자 콘솔 단일 진입점에서 일일 운전기록 입력→집계→Excel/PDF 출력까지 완결. Streamlit 07 폐기 가능 조건 충족. |
| **Core Value** | Streamlit 의존 제거 + 모바일 BottomSheet 기반 UX 자동 적용 + 기존 감사 로그·권한 시스템 재사용으로 Streamlit 대비 보안·운영 품질 향상. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | AVAC 운영업체 일일 핵심 업무가 레거시 Streamlit에만 있어 PWA 통합 완료 불가 |
| **WHO** | SUPER_ADMIN (전체 조회·출력), CONTRACTOR_ADMIN (자기 업체 시설만 입력·조회) |
| **RISK** | Prisma 모델 추가 → DB 마이그레이션 필요 / `exceljs` 이미 존재하여 PDF는 별도 라이브러리 필요 없이 Excel만 우선 / Streamlit DB(`wci_ops_db`)와 PWA DB(`wci_erp`) 분리 — 데이터 이관 불필요 (신규 시작) |
| **SUCCESS** | (1) 일일 운전기록 upsert (2) 기간별 집계 KPI (3) Excel 다운로드 (4) e2e 회귀 없음 (5) tsc 오류 없음 |
| **SCOPE** | `/super-admin` `facility-ops` 탭 신설 + Prisma 모델 1개 + API 라우트 3개. PDF는 별도 후속 PDCA. |

---

## 1. Overview

### 1.1 Purpose

AVAC 시설 일일운영 데이터를 PWA DB에 저장·조회·출력하여 Streamlit 07 폐기 조건을 충족한다.

### 1.2 Background

- 갭 분석 결과: `07_시설운영.py`가 PWA 미이식 Critical 갭 1위
- `WasteTreatmentFacility` 모델 및 `/api/super-admin/facilities` 라우트 이미 존재 → 참조 가능
- `exceljs@4.4.0` 기설치 → Excel 출력 의존성 추가 불필요
- `BottomSheet` 컴포넌트 이미 존재 → 모달 입력 UX 자동 적용

### 1.3 Source Reference (Streamlit)

| 항목 | Streamlit 구현체 |
|---|---|
| 데이터 모델 | `FacilityDailyOpsORM` (`lib/infrastructure/db/models.py:535`) |
| 레포지터리 | `FacilityOpsRepo` (`lib/infrastructure/db/facility_ops_repo_impl.py`) |
| 입력 페이지 | `app/pages/07_시설운영.py:Tab1` — upsert + 7일 이력 |
| 집계 페이지 | `app/pages/07_시설운영.py:Tab2` — 일/주/월별 KPI |
| 출력 페이지 | `app/pages/07_시설운영.py:Tab3` — Excel/PDF |
| Excel 서비스 | `lib/application/avac_export_service.py:export_ops_excel` |

---

## 2. Scope

### 2.1 In Scope

- [ ] Prisma `FacilityDailyOps` 모델 추가 + 마이그레이션
- [ ] `GET /api/super-admin/facility-ops` — 기간별 목록 (지자체·업체 필터)
- [ ] `POST /api/super-admin/facility-ops` — 일일 운전기록 upsert
- [ ] `GET /api/super-admin/facility-ops/export` — Excel(.xlsx) 다운로드
- [ ] super-admin `facility-ops` 탭 신설 (3 서브탭)
  - **서브탭 1 — 운전기록 입력**: 시설 선택 → 날짜 → 수치 입력 → upsert + 7일 이력 표
  - **서브탭 2 — 집계 현황**: 기간(일/주/월) 선택 → KPI 카드 + 테이블
  - **서브탭 3 — 출력**: 기간 선택 → Excel 다운로드 버튼
- [ ] SUPER_ADMIN: 지자체 단위 전체 조회 / CONTRACTOR_ADMIN: 자기 업체 시설만

### 2.2 Out of Scope

- PDF 출력 — 별도 후속 PDCA (`avac-facility-ops-pdf`)
- AVAC 이외 사업유형 운전기록 — 별도 후속
- 실시간 IoT 데이터 연동 (MANUAL 입력만)
- Streamlit DB 데이터 마이그레이션 (신규 시작)
- 모바일 전용 UX 분기 (BottomSheet 자동 적용으로 충분)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | Prisma `FacilityDailyOps` 모델 — `facilityId`, `opsDate`, 가동시간·처리량·전력·비가동 컬럼 (Streamlit 모델 매핑) | High | Pending |
| FR-02 | `POST /api/super-admin/facility-ops` — upsert (같은 facility+date는 UPDATE) | High | Pending |
| FR-03 | `GET /api/super-admin/facility-ops` — 기간·시설 필터, 페이지네이션 없음(기간 제한 30일) | High | Pending |
| FR-04 | SUPER_ADMIN: 지자체 내 전체 시설 조회·입력 / CONTRACTOR_ADMIN: 소속 업체 시설만 | High | Pending |
| FR-05 | 서브탭1 운전기록 입력 — 시설 셀렉트 + 날짜 입력 + 수치 폼 + 저장 + 7일 이력 표 | High | Pending |
| FR-06 | 서브탭2 집계 현황 — 기간 선택 → KPI 5개 카드(일반처리·음식처리·가동시간·전력·건수) + 상세 테이블 | High | Pending |
| FR-07 | 서브탭3 출력 — 기간 선택 → `GET .../export` → `.xlsx` 다운로드 | High | Pending |
| FR-08 | Excel 컬럼: 집하장/운영일자/일반가동(h)/음식가동(h)/비가동(h)/일반처리(t)/음식처리(t)/일반수거(t)/음식수거(t)/일반반출(t)/음식반출(t)/전일전력(kWh) | High | Pending |
| FR-09 | tsc 오류 없음 + e2e 회귀 없음 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 권한 | SUPER_ADMIN/CONTRACTOR_ADMIN만 접근 (MUNI_ADMIN 제외) |
| 데이터 격리 | CONTRACTOR_ADMIN은 자기 업체 `municipalityId` 산하 시설만 조회 |
| 기간 제한 | GET 조회 최대 90일 (성능 보호) |
| 감사 로그 | POST upsert 시 `writeAudit` 호출 |
| 모바일 UX | 입력 폼은 BottomSheet 패턴 적용 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `prisma migrate dev` 성공 + `FacilityDailyOps` 테이블 생성
- [ ] POST → GET 왕복 정상 (같은 facility+date upsert)
- [ ] Excel 다운로드 — 브라우저에서 `.xlsx` 파일 저장 확인
- [ ] CONTRACTOR_ADMIN 권한으로 타 업체 시설 접근 시 403
- [ ] tsc --noEmit 오류 없음
- [ ] e2e 5 spec 회귀 없음

### 4.2 Quality Criteria

- 변경 라인 ≤ 500 (모델 + API 3개 + 클라이언트 탭)
- Streamlit 07과 컬럼 1:1 매핑 유지 (데이터 호환성)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Prisma 마이그레이션 충돌 (기존 migrations) | High | Low | `prisma migrate dev --name avac_facility_ops` 단독 실행 |
| `exceljs` 서버사이드에서 스트림 응답 처리 | Medium | Medium | `route.ts`에서 `Buffer` 반환 → `application/vnd.openxmlformats` Content-Type |
| super-admin 탭 12개 → 13개로 증가 (스크롤) | Low | High | 기존 탭 그룹에 자연스럽게 편입. 필요 시 `facilities` 탭 바로 다음에 배치 |
| AVAC 전용 필터 없이 모든 시설 유형에 노출 | Medium | Medium | `WasteTreatmentFacility.type` 필터로 AVAC 시설만 조회 옵션 제공 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|---|---|---|
| `prisma/schema.prisma` | Modify | `FacilityDailyOps` 모델 추가 |
| `prisma/migrations/` | Add | 자동 생성 마이그레이션 파일 |
| `app/api/super-admin/facility-ops/route.ts` | New | GET(목록) + POST(upsert) |
| `app/api/super-admin/facility-ops/export/route.ts` | New | GET → .xlsx 스트림 |
| `app/(admin)/super-admin/_super-admin-client.tsx` | Modify | `facility-ops` 탭 + `FacilityOpsTab` 컴포넌트 추가 |

### 6.2 Existing Consumers (영향 없음)

| Resource | Impact |
|---|---|
| `/api/super-admin/facilities` | 변화 없음 (별도 라우트) |
| `WasteTreatmentFacility` 모델 | relation 1개 추가만 (기존 컬럼 불변) |
| 기존 super-admin 12개 탭 | 탭 1개 추가만 |

---

## 7. Architecture Considerations

### 7.1 Project Level

| Level | Selected |
|-------|:--------:|
| Dynamic | ☑ |

### 7.2 Key Architectural Decisions

| Decision | Options | Rationale |
|----------|---------|-----------| 
| 모델 위치 | Prisma (PWA DB) | Streamlit SQLAlchemy와 별개 — 신규 시작 |
| 권한 분기 | SUPER_ADMIN 전체 / CONTRACTOR_ADMIN 자기 업체 | 기존 super-admin 패턴 동일 |
| Excel 출력 | `exceljs` (기설치) | 추가 의존성 없음 |
| PDF 출력 | Out of scope | 후속 PDCA |
| 입력 UX | 탭 내 인라인 폼 (BottomSheet X) | 운전기록 입력은 테이블 행 클릭이 아닌 단순 폼 — 인라인이 적합 |
| 집계 방식 | 서버사이드 Prisma 집계 | 클라이언트 계산 회피 |

### 7.3 Prisma 모델 시그니처 (예시)

```prisma
model FacilityDailyOps {
  id                BigInt   @id @default(autoincrement())
  facilityId        BigInt   @map("facility_id")
  opsDate           DateTime @map("ops_date") @db.Date
  generalOpHours    Decimal  @default(0) @map("general_op_hours") @db.Decimal(5,2)
  foodOpHours       Decimal  @default(0) @map("food_op_hours")    @db.Decimal(5,2)
  downtimeHours     Decimal  @default(0) @map("downtime_hours")   @db.Decimal(5,2)
  downtimeReason    String?  @map("downtime_reason") @db.VarChar(200)
  generalWasteTon   Decimal  @default(0) @map("general_waste_ton")  @db.Decimal(8,3)
  foodWasteTon      Decimal  @default(0) @map("food_waste_ton")     @db.Decimal(8,3)
  generalCollectTon Decimal  @default(0) @map("general_collect_ton") @db.Decimal(8,3)
  foodCollectTon    Decimal  @default(0) @map("food_collect_ton")   @db.Decimal(8,3)
  generalTransferTon Decimal @default(0) @map("general_transfer_ton") @db.Decimal(8,3)
  foodTransferTon   Decimal  @default(0) @map("food_transfer_ton")  @db.Decimal(8,3)
  prevDayPowerKwh   Decimal  @default(0) @map("prev_day_power_kwh") @db.Decimal(10,2)
  notes             String?  @db.Text
  createdBy         BigInt?  @map("created_by")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  facility  WasteTreatmentFacility @relation(fields: [facilityId], references: [id])
  creator   User? @relation("FacilityOpsCreator", fields: [createdBy], references: [id])

  @@unique([facilityId, opsDate])
  @@index([opsDate])
  @@map("facility_daily_ops")
}
```

---

## 8. Convention Prerequisites

| Item | Convention |
|---|---|
| API 라우트 위치 | `/api/super-admin/facility-ops/` |
| 권한 체크 | `readSession()` → role 체크 → SUPER_ADMIN/CONTRACTOR_ADMIN만 허용 |
| 감사 로그 | POST 성공 시 `writeAudit({ action: 'facility_ops_upsert', ... })` |
| Prisma 날짜 | `opsDate: DateTime @db.Date` — 시간 정보 없음 |

---

## 9. Next Steps

1. [ ] `/pdca design avac-facility-ops` — 3가지 아키텍처 옵션 + 모듈 맵
2. [ ] `/pdca do avac-facility-ops` — Prisma → API → 탭 순서로 구현
3. [ ] tsc + e2e 회귀 검증
4. [ ] `/pdca report avac-facility-ops`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-04 | 초안 — Streamlit 07 이식 범위 정의 | 4365won@gmail.com |
