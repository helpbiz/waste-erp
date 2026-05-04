# contractor-org-master Planning Document

> **Summary**: 전역 `Position` 모델을 업체별 독립 `ContractorPosition`·`ContractorRank`로 전환하고, admin이 `/users` 탭에서 자사 직책·직급을 CRUD할 수 있게 한다.
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
| **Problem** | `Position` 모델이 전역 공유(contractorId 없음)라 한 업체가 직책을 추가하면 모든 업체에 노출됨. `rank` 필드도 `String?` 자유문자열(enum 코드)로 저장되어 업체별 직급 체계 커스터마이징 불가. |
| **Solution** | `ContractorPosition` + `ContractorRank` Prisma 모델 신설, `User` 모델에 새 FK 추가, 기존 데이터 마이그레이션, admin `/users` 페이지에 직책·직급 관리 탭 추가. |
| **Function/UX Effect** | CONTRACTOR_ADMIN이 `/users` 설정 탭에서 자사 직책·직급을 추가·수정·비활성화. 사용자 편집 모달의 직책/직급 선택지가 자사 목록으로 교체. 신규 업체 온보딩 시 기본 세트 자동 적용. |
| **Core Value** | 슈퍼관리자 병목 제거 + 업체별 조직 문화 반영 + 기존 전역 Position 코드(결재정책 등)와 독립적으로 운영. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 전역 Position → 모든 업체에 직책 노출 버그 + 업체별 직급 체계 커스터마이징 불가 |
| **WHO** | CONTRACTOR_ADMIN(자사 직책·직급 CRUD), SUPER_ADMIN(전체 업체 관리), WORKER(본인 직책·직급 읽기 전용) |
| **RISK** | User.positionId 마이그레이션(전역 Position FK → ContractorPosition FK) + User.rank String enum → rankId FK 전환 + ApprovalPolicy.positionCodes(CSV 문자열)는 전역 코드 의존 — 이번 범위 외 |
| **SUCCESS** | admin이 자사 직책 추가/수정/비활성화 가능 + 사용자 편집 시 자사 직책·직급만 노출 + tsc 오류 없음 + e2e 회귀 없음 |
| **SCOPE** | ContractorPosition + ContractorRank 모델 + 마이그레이션 + API 4개 + /users 탭 UI + 온보딩 seed |

---

## 1. Overview

### 1.1 Purpose

업체(contractor)별로 독립된 직책·직급 마스터를 admin이 직접 관리할 수 있게 하여, 슈퍼관리자 병목 없이 각 업체가 자사 조직 체계를 자율 설정할 수 있게 한다.

### 1.2 Background

- `Position` 모델: `code` unique, `contractorId` 없음 → 전역 공유 (버그 원인)
- `User.rank`: `String? @db.VarChar(30)` — `ENGINEER_HIGH` 등 enum 코드 저장
- `ApprovalPolicy.positionCodes`: CSV 문자열(`TEAM_LEAD,HEAD`) — 전역 Position code 참조 (이번 변경과 독립)
- `WorkerSuggestion.positionCode`: 통계용 nullable — 전역 코드 참조 (이번 변경과 독립)
- Streamlit 설계 문서(`wci-회사별-직급직책.design.md`) 이미 존재 — DB 설계 참조 가능

### 1.3 마이그레이션 전략

**점진적 이중 필드 방식**: 기존 필드를 즉시 삭제하지 않고, 신규 FK 필드를 nullable로 추가하여 병행 운영 후 별도 PDCA에서 정리.

```
현재: User.positionId → Position(전역)
신규: User.contractorPositionId → ContractorPosition(업체별) [nullable]
      User.rankId → ContractorRank(업체별) [nullable]
이번 PDCA 내: 기존 데이터 마이그레이션 스크립트 실행
```

---

## 2. Scope

### 2.1 In Scope

- [ ] `ContractorPosition` Prisma 모델 (contractorId, name, category, active, sortOrder)
- [ ] `ContractorRank` Prisma 모델 (contractorId, name, level, active, sortOrder)
- [ ] `User` 모델에 `contractorPositionId` + `rankId` nullable FK 추가
- [ ] `GET/POST /api/contractor/positions` — 자사 직책 목록/추가
- [ ] `PATCH /api/contractor/positions/[id]` — 수정·비활성화
- [ ] `GET/POST /api/contractor/ranks` — 자사 직급 목록/추가
- [ ] `PATCH /api/contractor/ranks/[id]` — 수정·비활성화
- [ ] `/users` 페이지에 "직책·직급 관리" 서브탭 추가
  - 직책 목록·추가·수정·비활성화 UI
  - 직급 목록·추가·수정·비활성화 UI
- [ ] 사용자 편집 모달 — 직책/직급 선택지를 ContractorPosition/ContractorRank 목록으로 교체
- [ ] `User.contractorPositionId` 업데이트 경로: `PUT /api/users/[id]`에 `contractorPositionId`, `rankId` 파라미터 추가
- [ ] 온보딩 마법사 완료 시 기본 직책·직급 세트 자동 seed
- [ ] 마이그레이션: 기존 업체별 `User.positionId`(전역) → `ContractorPosition` 생성 후 `contractorPositionId` 매핑
- [ ] 마이그레이션: 기존 `User.rank`(String) → `ContractorRank` 생성 후 `rankId` 매핑

### 2.2 Out of Scope

- 전역 `Position` 모델 삭제 — `ApprovalPolicy.positionCodes` 의존 해결 후 별도 PDCA
- `ApprovalPolicy` 직책 코드 → ContractorPosition 전환 — 별도 PDCA
- 직책별 권한 카테고리 매핑 (MANAGER → 민원 배정 가능 등)
- 대량 임포트 (CSV)
- 조직도 시각화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `ContractorPosition` 모델: contractorId(FK) + name(unique per contractor) + category(MANAGER/FIELD/ADMIN) + active + sortOrder | High | Pending |
| FR-02 | `ContractorRank` 모델: contractorId(FK) + name(unique per contractor) + level(숫자, 낮을수록 상위) + active + sortOrder | High | Pending |
| FR-03 | `GET /api/contractor/positions` — 자사 활성 직책 목록 (active=all 파라미터로 비활성 포함 조회) | High | Pending |
| FR-04 | `POST /api/contractor/positions` — 직책 추가 (name unique per contractor 검증) | High | Pending |
| FR-05 | `PATCH /api/contractor/positions/[id]` — name/category/sortOrder 수정, 사용 중인 직책 비활성화 방지 | High | Pending |
| FR-06 | FR-03~05와 동일한 직급 API (`/api/contractor/ranks`) | High | Pending |
| FR-07 | `/users` 페이지에 "조직 설정" 서브탭 — 직책·직급 CRUD UI | High | Pending |
| FR-08 | 사용자 편집 모달에서 직책/직급 선택지를 ContractorPosition/ContractorRank로 교체 | High | Pending |
| FR-09 | `PUT /api/users/[id]`에 `contractorPositionId`, `rankId` 파라미터 추가 | High | Pending |
| FR-10 | 온보딩 마법사 완료 시 기본 직책 8개 + 직급 5개 자동 seed | Medium | Pending |
| FR-11 | 마이그레이션: 기존 User.positionId(전역) → ContractorPosition + contractorPositionId 매핑 | High | Pending |
| FR-12 | 마이그레이션: 기존 User.rank(String enum) → ContractorRank + rankId 매핑 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria |
|----------|----------|
| 권한 | CONTRACTOR_ADMIN만 자사 직책·직급 수정 (SUPER_ADMIN은 전체 조회) |
| 데이터 격리 | 업체 간 직책·직급 목록 완전 분리 |
| 비활성화 정책 | 사용 중인 직책(contractorPositionId 참조 사용자 존재)은 비활성화 불가 |
| 감사 로그 | POST/PATCH 시 `writeAudit` 호출 |
| 마이그레이션 | 기존 User 데이터 무손실 (nullable 필드 — 매핑 실패 시 NULL 허용) |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] CONTRACTOR_ADMIN이 자사 직책 추가 → 사용자 편집 모달에 즉시 반영
- [ ] CONTRACTOR_ADMIN이 타 업체 직책 조회 시 403
- [ ] 사용 중인 직책 비활성화 시 409 (사용자 N명 안내)
- [ ] 온보딩 완료 시 기본 직책 8개 자동 생성
- [ ] 기존 User.positionId 데이터가 contractorPositionId로 정상 매핑
- [ ] tsc --noEmit 오류 없음
- [ ] e2e 5 spec 회귀 없음

### 4.2 Quality Criteria

- 변경 라인 ≤ 700 (모델 2개 + API 6개 + UI 탭 + 마이그레이션)
- 전역 `Position` 모델 기존 동작 보존 (ApprovalPolicy 등 의존 코드 무변경)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| User.positionId 마이그레이션 실패 (전역 Position명 불일치) | Medium | Medium | nullable contractorPositionId — 매핑 실패 시 NULL, 기존 positionId 유지 |
| User.rank enum 코드(ENGINEER_HIGH 등)가 ContractorRank 직급명과 매핑 불가 | Medium | High | rank String 유지 + rankId nullable 추가. 관리자가 수동 매핑 후 이전 |
| 사용 중인 직책 비활성화 → 참조 무결성 | High | Low | API에서 사용자 수 확인 후 409 반환 |
| 전역 Position 모델 의존 코드(ApprovalPolicy) 영향 | High | Low | 이번 PDCA에서 전역 Position 모델 변경 없음 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change |
|---|---|---|
| `prisma/schema.prisma` | Modify | ContractorPosition + ContractorRank 모델 추가, User에 contractorPositionId + rankId FK 추가 |
| `app/api/contractor/positions/route.ts` | New | GET + POST |
| `app/api/contractor/positions/[id]/route.ts` | New | PATCH |
| `app/api/contractor/ranks/route.ts` | New | GET + POST |
| `app/api/contractor/ranks/[id]/route.ts` | New | PATCH |
| `app/api/users/[id]/route.ts` | Modify | contractorPositionId + rankId 파라미터 추가 |
| `app/(admin)/users/_users-client.tsx` | Modify | 직책·직급 관리 탭 + 사용자 편집 모달 선택지 교체 |
| `app/(admin)/super-admin/_onboarding-wizard.tsx` | Modify | 완료 시 seed API 호출 |

### 6.2 Existing Consumers (영향 없음)

| Resource | Impact |
|---|---|
| 전역 `Position` 모델 | 변경 없음 — `ApprovalPolicy.positionCodes`, `WorkerSuggestion.positionCode` 그대로 |
| `GET /api/positions` | 변경 없음 — 전역 위치 조회용 그대로 유지 |
| `User.positionId` (전역 FK) | 유지 — contractorPositionId와 병행 |
| `User.rank` (String) | 유지 — rankId와 병행 |

---

## 7. Architecture Considerations

### 7.1 Project Level

| Level | Selected |
|-------|:--------:|
| Dynamic | ☑ |

### 7.2 Key Architectural Decisions

| Decision | Options | Rationale |
|----------|---------|-----------| 
| 마이그레이션 방식 | 이중 필드 병행 vs 즉시 전환 | nullable 신규 FK 추가 + 데이터 이전 스크립트. 기존 코드 영향 최소화 |
| API 위치 | `/api/contractor/` | 업체 범위 리소스 — CONTRACTOR_ADMIN 접근 패턴과 일치 |
| 기본 세트 | 코드 내 상수 정의 | 별도 system_default 테이블 대신 상수 배열로 단순화 (Streamlit 설계보다 경량화) |
| UI 위치 | `/users` 탭 추가 | 사용자 관리 맥락과 직결 — 별도 페이지보다 접근성 좋음 |

---

## 8. 기본 직책·직급 세트 (상수)

### 기본 직책 (8개)

| name | category |
|---|---|
| 대표 | ADMIN |
| 이사 | ADMIN |
| 팀장 | MANAGER |
| 반장 | MANAGER |
| 기사 | FIELD |
| 환경미화원 | FIELD |
| 사무원 | ADMIN |
| 현장소장 | MANAGER |

### 기본 직급 (5개)

| name | level |
|---|---|
| 1급 | 1 |
| 2급 | 2 |
| 3급 | 3 |
| 4급 | 4 |
| 5급 | 5 |

---

## 9. Convention Prerequisites

| Item | Convention |
|---|---|
| API 위치 | `/api/contractor/positions/`, `/api/contractor/ranks/` |
| 권한 체크 | `readSession()` → `CONTRACTOR_ADMIN` 또는 `SUPER_ADMIN` |
| 감사 로그 | POST/PATCH 성공 시 `writeAudit({ action: 'contractor_position_create/update', ... })` |
| 비활성화 | DELETE 금지 — `active: false` 업데이트만 허용 |

---

## 10. Next Steps

1. [ ] `/pdca design contractor-org-master` — 3가지 아키텍처 옵션 + 모듈 맵
2. [ ] `/pdca do contractor-org-master` — Prisma → API → UI → 마이그레이션 순서로 구현
3. [ ] tsc + e2e 회귀 검증
4. [ ] `/pdca report contractor-org-master`

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-04 | 초안 — 전역 Position → 업체별 이식 범위 정의 | 4365won@gmail.com |
