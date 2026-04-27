# Plan — user-mgmt-extended

> 사용자관리 확장: 직책 마스터, 부서, 프로필 사진, 디지털 서명 + 결재 통합

**Feature**: user-mgmt-extended
**Author**: 4365won@gmail.com
**Created**: 2026-04-25
**Phase**: Plan

---

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | 기존 사용자 등록은 권한(Role) 한 가지만 분류해 실제 인사관리(직책 분리·부서 식별·결재자 신원 확인)가 안 되고, 휴가/연차 결재가 종이/별도 서명대장으로 흩어져 audit가 분산됨. |
| **Solution** | User에 직책(Position 마스터 12종 시드)·부서·프로필 사진(data URL 500KB)·디지털 서명(PNG data URL) 추가 + 휴가 승인·연차 부여·사용자 등록/비활성화 시점에 관리자 서명을 자동 첨부해 audit_logs와 동기화. |
| **Function UX Effect** | 등록 모달에서 직책 드롭다운+부서 입력+사진 업로드+서명 캔버스 4단 폼, 인사 카드에 사진·직책 표시, 휴가 승인 버튼 클릭 시 서명 모달 → 즉시 결재 완료. |
| **Core Value** | 단일 화면 인사 식별·디지털 결재·audit 통합 — 종이 결재 0건, 결재자 책임 추적 100%. |

---

## Context Anchor

| 키 | 내용 |
|---|---|
| **WHY** | 종이 결재·외부 인사대장 → 단일 시스템 디지털 결재로 통합해 audit/책임추적 확보 |
| **WHO** | CONTRACTOR_ADMIN·INTERNAL_ADMIN(결재자) / WORKER(피결재자, 사진·서명 본인 등록) / SUPER_ADMIN(전체) |
| **RISK** | (R1) 직책 마스터 변경 시 기존 행 정합성 (R2) data URL DB 비대 (R3) 서명 위변조 (R4) PII(사진) 동의 |
| **SUCCESS** | SC1 12종 직책 시드 후 등록 정상 / SC2 사진 500KB 초과 시 422 / SC3 휴가 승인 시 서명 미등록자는 차단 / SC4 audit_logs.metadata.signatureRef 일치 / SC5 기존 사용자 데이터 무손실 |
| **SCOPE** | User 4필드 + Position 마스터 + LeaveRequest.approverSignature + UI 5곳(등록 모달/인적사항/연차 부여/휴가 승인/비활성화) — RBAC 매트릭스 변경 X, S3/PKI 제외 |

---

## 1. Background

### 1.1 도메인 컨텍스트
- 본 ERP는 지자체 위탁 폐기물 수거운반 업체 운영을 위한 시스템으로, 수십명 ~ 수백명 규모의 위탁업체 인력을 관리.
- 직책: 사무직 라인(대표/임원/본부장/실장/팀장/사원)과 현장 라인(운전원/수거원/기동반/가로청소/골목청소)이 동시 존재 — RBAC(시스템권한)와는 별개의 분류 축.
- 휴가/연차 결재는 산업안전보건·근로기준법 §60 준거 audit이 필수 (기존 `audit_logs` 활용).

### 1.2 현재 한계
- `User`에 `Role`(시스템권한)만 존재 → 사무직/현장직 구분, 부서별 보고서 불가.
- 휴가 승인 시 결재자 본인 확인이 `actorId`(JWT 세션)에 의존 → "내가 승인한 적 없다" 부인 시 입증 부족.
- 인사카드/조직도/명함 기능 부재.

---

## 2. Requirements

### FR (Functional Requirements)

| ID | 요구 | 우선 |
|---|---|---|
| FR-01 | User에 `position`(Position 마스터 FK)·`department`(VARCHAR(60))·`profilePhoto`(TEXT, data URL)·`signature`(TEXT, data URL) 4필드 추가 | P0 |
| FR-02 | Position 마스터 12종 시드 — 대표/임원/본부장/실장/팀장/운전원/수거원/기동반/가로청소/골목청소/사원/기타 + `code`/`label`/`category`(OFFICE\|FIELD\|OTHER)/`sortOrder` | P0 |
| FR-03 | 사용자 등록(POST /api/users) zod 확장 — `positionCode`·`department`·`profilePhoto`·`signature` 옵셔널 | P0 |
| FR-04 | 사용자 수정(PATCH /api/users/[id]) — 4필드 모두 변경 가능, audit `changes`에 `position`·`department`·`profilePhotoChanged`(boolean)·`signatureChanged`(boolean) 기록 (raw 이미지 노출 금지) | P0 |
| FR-05 | LeaveRequest.approverSignature(TEXT) 추가 — APPROVE 시 `signature` data URL 첨부 | P0 |
| FR-06 | PATCH /api/leave-requests/[id] — APPROVE 요청 시 본문 `signature` 필수, 미제출 시 400, User.signature 등록 자에 한해 자동 채움 옵션 (`useStoredSignature: true`) | P0 |
| FR-07 | 연차 부여 POST /api/users/[id]/leave-balance — `signature` 옵셔널 첨부, audit `metadata.signatureSnapshot` 저장 | P1 |
| FR-08 | 사용자 등록/비활성화 — 액터의 User.signature가 있으면 audit `metadata.actorSignature: 'stored'` 표기 | P2 |
| FR-09 | UI: 등록 모달 4번째 행에 직책/부서, 5번째 행에 사진 업로드(미리보기) + 서명 캔버스 | P0 |
| FR-10 | UI: 인적사항 폼 "직책·부서" 섹션, "사진·서명" 섹션 신설 + 미리보기·재서명 버튼 | P0 |
| FR-11 | UI: 휴가 승인 버튼 클릭 → 서명 모달(저장된 서명 자동 노출 + "재서명" 옵션) → APPROVE 호출 | P0 |
| FR-12 | UI: 사용자 리스트 행에 사진 썸네일(40px) + 직책 뱃지 표시 | P1 |
| FR-13 | UI: 휴가 신청 내역 결재 완료 행에 서명 이미지 썸네일(60px) 인라인 노출 | P1 |
| FR-14 | 본인 서명 자가 등록: WORKER가 `/worker/profile`에서 서명/사진 등록 (별도 PATCH 자가호출 라우트) | P2 |

### NFR (Non-Functional)

| ID | 요구 | 측정 |
|---|---|---|
| NFR-01 | 사진 데이터 URL 500KB 초과 시 zod 422 | curl 522KB 파일 → status 400 issues.profilePhoto |
| NFR-02 | 서명 데이터 URL 200KB 초과 시 zod 422 | 동일 |
| NFR-03 | 직책 마스터 read는 한 번 캐시(메모리) — `lib/positions.ts` | 1회 SELECT, 이후 N요청 0 SELECT |
| NFR-04 | 기존 User 행은 position=null·department=null 허용 | 마이그레이션 무손실 |
| NFR-05 | 휴가 APPROVE 시 서명 누락 → 400 `signature_required` | 자동 회귀 테스트 |
| NFR-06 | audit_logs.metadata에 raw 이미지 미저장 (changed flag만) | grep 검사 |

---

## 3. Out of Scope

- **권한(Role) 매트릭스 변경**: 직책은 식별/표시용. 직책별 RBAC(예: 팀장만 승인)은 별도 cycle.
- **S3/MinIO 이미지 업로드**: 이번 cycle은 data URL/base64. 후속 `pii-storage` cycle에서 presigned URL 마이그레이션.
- **PKI/공인전자서명**: 단순 캔버스 PNG. 법적 효력 강화는 별도 `e-signature-pki` cycle.
- **조직도/부서 트리**: 부서는 자유입력 string. 트리 구조·부서장 자동매칭은 후속.
- **연차 자동부여 cron**: 월초 자동 부여는 `/api/cron/grant-leave` 별도 cycle.

---

## 4. Architecture Direction (3가지 옵션은 Design 단계)

방향성만 명시:
- 데이터: **Position 마스터 테이블 + FK** (변경 자유도 + audit 안정성)
- 이미지: **DB TEXT(data URL)** (MVP — 5KB~500KB 범위)
- 서명: **TBM canvas 컴포넌트 추출** (`components/SignaturePad.tsx`)
- 결재 흐름: **서명 모달 → API 호출** (서명 미등록자는 모달에서 즉석 등록 가능)

---

## 5. Risks

| ID | 리스크 | 영향 | 대응 |
|---|---|---|---|
| R1 | 직책 마스터 변경(예: "팀장" 명칭 변경)이 과거 audit에 영향 | 보고서 일관성 | Position.code(영문) 불변, label(한글)만 변경 |
| R2 | data URL로 DB row 비대(평균 50KB×500명=25MB) | DB 백업/조회 성능 | 500KB 제한 + Phase 2 S3 마이그레이션 path 확보 |
| R3 | 서명 캡처 후 본문 변조(다른 휴가 신청에 같은 서명 재사용) | 부인 방지 | audit `metadata`에 `signatureRef = sha256(signatureBase64).slice(0,16)` 기록 → 결재 후 변경 시 mismatch |
| R4 | PII(사진) 동의 미수집 | 개인정보보호법 위반 | 등록 모달 하단 동의 체크박스 + 미체크시 비활성 |
| R5 | 기존 14개 audit USER_UPDATE 로그가 `changes.profilePhoto` 전체 base64 dump 우려 | 저장 폭증 | TRACKED_FIELDS에서 profilePhoto/signature 제외 + boolean flag만 |

---

## 6. Success Criteria

| ID | 기준 | 검증 |
|---|---|---|
| SC1 | Position 12종 시드 후 등록 모달에서 드롭다운 노출, 신규 워커 등록 200 | curl POST /api/users with positionCode → DB User.positionId 채움 |
| SC2 | 500KB 초과 사진 업로드 시 422 + issues.profilePhoto | 522KB base64 페이로드 |
| SC3 | 서명 미등록 관리자가 휴가 APPROVE 시도 → 400 signature_required (또는 모달에서 즉석 등록 후 진행) | UI 시나리오 |
| SC4 | APPROVE 후 audit_logs.metadata.signatureRef 와 LeaveRequest.approverSignature SHA256 일치 | DB 직접 확인 |
| SC5 | 마이그레이션 후 기존 6명 User 행 무손실 (status·name·role 동일) | before/after diff |
| SC6 | 사용자 리스트 사진 썸네일 + 직책 뱃지 노출 (SSR 200) | UI 검사 |
| SC7 | 휴가 내역에 결재자 서명 60px 인라인 표시 | UI 검사 |

---

## 7. Dependencies

- 기존 `lib/auth.ts`, `lib/users.ts`, `lib/sms.ts`, `lib/crypto.ts`(향후 PII 암호화 cycle에서) — 변경 없음
- 기존 `tbm_signatures` Canvas 컴포넌트 위치: `app/(admin)/safety/_signature-canvas.tsx`(추출 대상)
- DB: PostgreSQL 16 (`text` 컬럼 추가) — 마이그레이션 비파괴
- 외부 API/패키지 추가: 없음

---

## 8. Estimated Effort

| 단계 | 시간 |
|---|---|
| 스키마 + Prisma 마이그레이션 + 시드 | 30분 |
| API 확장(zod + signature ref + audit) | 60분 |
| UI: SignaturePad 추출 + 등록/인적사항/휴가 모달 | 90분 |
| 검증 시나리오 + 회귀 | 30분 |
| **합계** | **약 3.5시간** |
