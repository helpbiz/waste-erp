# Design — user-mgmt-extended (Option B: Clean Architecture)

**Feature**: user-mgmt-extended
**Architecture**: Clean Architecture (4-table separation, history-preserving)
**Phase**: Design

---

## Context Anchor (from Plan)

| 키 | 내용 |
|---|---|
| **WHY** | 종이 결재·외부 인사대장 → 단일 시스템 디지털 결재 통합, audit/책임추적 확보 |
| **WHO** | CONTRACTOR_ADMIN·INTERNAL_ADMIN(결재자) / WORKER(피결재자) / SUPER_ADMIN |
| **RISK** | (R1) 직책 마스터 변경 정합성 (R2) DB 비대 (R3) 서명 위변조 (R4) PII 동의 (R5) audit 폭증 |
| **SUCCESS** | SC1~SC7 (Plan §6 참조) |
| **SCOPE** | Position·Department·MediaAsset·Signature·ApprovalEvent + User 4 FK + UI 5곳 |

---

## 1. Overview

### 1.1 설계 원칙
- **History-preserving**: 사진·서명·승인은 추가만(append-only), 삭제 X. 결재 분쟁 시 시점 재현 가능.
- **Storage-agnostic**: `MediaAsset` 추상화로 추후 data URL → S3 presigned URL 마이그레이션 시 컬럼 추가 없이 가능.
- **결재 이벤트 1급화**: `ApprovalEvent`로 도메인 액션(휴가/연차/등록/비활성화)과 결재(서명·시각·결재자)를 분리.

### 1.2 핵심 결정 (Decision Record)
| # | 결정 | 근거 |
|---|---|---|
| D1 | Position을 enum이 아닌 마스터 테이블 | 라벨/순서/카테고리(OFFICE/FIELD) 운영 변경 잦음, code(영문) 불변 |
| D2 | Department는 단일 테이블 + parentId(self-FK) | 조직도 트리 표현 가능, parentId=NULL 시 평면 사용 |
| D3 | Signature 별도 테이블, User.activeSignatureId FK | 서명 변경 이력(언제 누가 변경했는지) 보존 + 결재 당시 서명 재현 |
| D4 | MediaAsset 추상화(provider/url/mimeType/sizeBytes) | data URL/S3 동시 지원 |
| D5 | ApprovalEvent로 결재 통합 | LeaveRequest, AnnualLeaveBalance, User(create/disable) 모두 동일 결재 모델 |
| D6 | signatureRef = sha256(signatureBase64).slice(0,16) | 결재 후 변조 탐지, raw 미저장으로 audit 슬림화 |

---

## 2. Data Model

### 2.1 신규 테이블

```prisma
// 직책 마스터 (D1)
model Position {
  id         BigInt   @id @default(autoincrement())
  code       String   @unique @db.VarChar(20)        // CEO, EXEC, DIRECTOR, MANAGER, TEAM_LEAD,
                                                       // DRIVER, COLLECTOR, RAPID, STREET_CLEAN,
                                                       // ALLEY_CLEAN, STAFF, OTHER (12종)
  label      String   @db.VarChar(40)                // 한글 라벨 (대표, 임원, ...)
  category   String   @db.VarChar(10)                // OFFICE | FIELD | OTHER
  sortOrder  Int      @default(0) @map("sort_order")
  active     Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  users      User[]

  @@map("positions")
}

// 부서 (D2 — self-FK 트리)
model Department {
  id          BigInt    @id @default(autoincrement())
  contractorId BigInt   @map("contractor_id")
  parentId    BigInt?   @map("parent_id")
  name        String    @db.VarChar(60)
  sortOrder   Int       @default(0) @map("sort_order")
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now()) @map("created_at")

  contractor  Contractor   @relation(fields: [contractorId], references: [id])
  parent      Department?  @relation("DeptTree", fields: [parentId], references: [id])
  children    Department[] @relation("DeptTree")
  users       User[]

  @@unique([contractorId, parentId, name])
  @@index([contractorId])
  @@map("departments")
}

// 미디어 자산 (D4 — provider 추상화)
model MediaAsset {
  id          BigInt    @id @default(autoincrement())
  ownerType   String    @map("owner_type") @db.VarChar(20)   // 'user_photo'|'user_signature'|'leave_signature'
  ownerId     BigInt    @map("owner_id")                      // 논리적 소유자 (User.id 등)
  provider    String    @db.VarChar(20)                       // 'data_url' | 's3' | 'minio'
  mimeType    String    @map("mime_type") @db.VarChar(60)
  sizeBytes   Int       @map("size_bytes")
  contentRef  String    @map("content_ref") @db.Text          // data URL 또는 S3 key
  sha256      String    @db.Char(64)                          // 무결성 검증
  createdAt   DateTime  @default(now()) @map("created_at")
  createdBy   BigInt?   @map("created_by")

  signatures      Signature[]      @relation("SignatureAsset")
  userPhotoOwner  User[]           @relation("UserPhotoAsset")

  @@index([ownerType, ownerId])
  @@index([sha256])
  @@map("media_assets")
}

// 서명 (D3 — 이력 보존)
model Signature {
  id            BigInt    @id @default(autoincrement())
  userId        BigInt    @map("user_id")
  assetId       BigInt    @map("asset_id")
  signatureRef  String    @map("signature_ref") @db.Char(16)   // sha256[:16] — 외부 audit 참조용
  activatedAt   DateTime  @default(now()) @map("activated_at")
  deactivatedAt DateTime? @map("deactivated_at")
  createdBy     BigInt?   @map("created_by")

  user           User             @relation("UserSignatures", fields: [userId], references: [id])
  asset          MediaAsset       @relation("SignatureAsset", fields: [assetId], references: [id])
  activeForUser  User?            @relation("UserActiveSignature")
  approvalEvents ApprovalEvent[]

  @@index([userId])
  @@index([signatureRef])
  @@map("signatures")
}

// 결재 이벤트 (D5 — 도메인 액션과 결재 분리)
model ApprovalEvent {
  id            BigInt    @id @default(autoincrement())
  actorId       BigInt    @map("actor_id")                      // 결재자 User.id
  signatureId   BigInt?   @map("signature_id")                  // 사용된 서명 (없을 수 있음)
  resourceType  String    @map("resource_type") @db.VarChar(30) // 'leave_request'|'leave_balance'|'user_create'|'user_disable'
  resourceId    String    @map("resource_id") @db.VarChar(30)
  action        String    @db.VarChar(30)                       // 'APPROVE'|'REJECT'|'GRANT'|'CREATE'|'DISABLE'
  comment       String?   @db.Text
  signatureRef  String?   @map("signature_ref") @db.Char(16)    // 즉시 검색 인덱스
  ipAddress     String?   @map("ip_address") @db.VarChar(45)
  createdAt     DateTime  @default(now()) @map("created_at")

  actor         User       @relation("ApprovalActor", fields: [actorId], references: [id])
  signature     Signature? @relation(fields: [signatureId], references: [id])

  @@index([resourceType, resourceId])
  @@index([actorId])
  @@index([signatureRef])
  @@map("approval_events")
}
```

### 2.2 User 변경

```prisma
model User {
  // 기존 필드 유지 ...

  // 신규 FK
  positionId         BigInt?    @map("position_id")
  departmentId       BigInt?    @map("department_id")
  profilePhotoId     BigInt?    @map("profile_photo_id")          // MediaAsset.id
  activeSignatureId  BigInt?    @unique @map("active_signature_id") // Signature.id

  position           Position?     @relation(fields: [positionId], references: [id])
  department         Department?   @relation(fields: [departmentId], references: [id])
  profilePhoto       MediaAsset?   @relation("UserPhotoAsset", fields: [profilePhotoId], references: [id])
  activeSignature    Signature?    @relation("UserActiveSignature", fields: [activeSignatureId], references: [id])
  signatures         Signature[]   @relation("UserSignatures")
  approvalEvents     ApprovalEvent[] @relation("ApprovalActor")
}
```

### 2.3 LeaveRequest 변경

```prisma
model LeaveRequest {
  // 기존 필드 유지 ...
  approvalEventId    BigInt?    @unique @map("approval_event_id")
  approvalEvent      ApprovalEvent? @relation(...)  // 별도 alias 필요 시
}
```
*결재 이벤트 1:1 — 승인/반려 시 ApprovalEvent 생성 후 LeaveRequest.approvalEventId에 연결*

### 2.4 시드 데이터 (Position 12종)

| code | label | category | sortOrder |
|---|---|---|---|
| CEO | 대표 | OFFICE | 10 |
| EXEC | 임원 | OFFICE | 20 |
| DIRECTOR | 본부장 | OFFICE | 30 |
| HEAD | 실장 | OFFICE | 40 |
| TEAM_LEAD | 팀장 | OFFICE | 50 |
| STAFF | 사원 | OFFICE | 60 |
| DRIVER | 운전원 | FIELD | 110 |
| COLLECTOR | 수거원 | FIELD | 120 |
| RAPID | 기동반 | FIELD | 130 |
| STREET_CLEAN | 가로청소 | FIELD | 140 |
| ALLEY_CLEAN | 골목청소 | FIELD | 150 |
| OTHER | 기타 | OTHER | 999 |

### 2.5 마이그레이션 전략 (무손실)
1. 신규 4테이블 + User 4 FK + LeaveRequest 1 FK 추가 (모두 NULLABLE)
2. Position 시드 → 별도 스크립트 `prisma/seeds/positions.ts`
3. 기존 User 행: positionId=NULL, departmentId=NULL → 정상 동작 (UI에서 "미지정" 표기)
4. 기존 audit_logs: 그대로 (ApprovalEvent는 신규 결재부터 적용, 기존 USER_UPDATE 로그는 보존)

---

## 3. Module Architecture

```
lib/
├── positions.ts          # Position 마스터 read-through 캐시 + 시드 보장
├── signatures.ts         # NEW — sha256, signatureRef 계산, Signature CRUD
├── media-assets.ts       # NEW — data URL 검증/저장, sizeBytes 계산
├── approvals.ts          # NEW — recordApproval(actor, resource, action, signature?) 통합 헬퍼
├── users.ts              # 기존 + Position/Department helper
└── ...

components/
├── SignaturePad.tsx      # NEW — TBM canvas 추출 + 재서명/지우기/저장
├── ProfilePhotoUploader.tsx  # NEW — 파일 → data URL + 클라이언트 리사이즈 + 500KB 검증
└── ApprovalSignatureModal.tsx # NEW — 저장된 서명 자동 노출 / 즉석 등록
```

---

## 4. API Contract

| Method | Path | Body | Resp | Notes |
|---|---|---|---|---|
| GET | `/api/positions` | - | `{positions: [{id,code,label,category,sortOrder}]}` | 캐시 적용 |
| GET | `/api/departments?contractorId=` | - | `{departments: [{id,name,parentId,...}]}` | 본인 가시범위만 |
| POST | `/api/departments` | `{name, parentId?, contractorId}` | `{ok, id}` | 관리자만 |
| POST | `/api/users` | 기존+ `{positionCode?, departmentId?, profilePhoto?, signature?}` | 기존 | profilePhoto/signature는 즉시 MediaAsset+Signature 생성 |
| PATCH | `/api/users/[id]` | 기존+ `{positionCode?, departmentId?, profilePhoto?, signature?}` | `{ok, changedFields, profilePhotoChanged, signatureChanged}` | raw 노출 X |
| GET | `/api/users/[id]` | - | 기존+ `{position, department, profilePhotoUrl, activeSignatureRef}` | profilePhoto는 URL 변환 |
| POST | `/api/users/[id]/signature` | `{signature}` | `{ok, signatureRef}` | 자가 등록(WORKER 본인) |
| PATCH | `/api/leave-requests/[id]` | `{action, signature?, useStoredSignature?}` | 기존+ `{signatureRef, approvalEventId}` | APPROVE 시 서명 필수 |
| POST | `/api/users/[id]/leave-balance` | 기존+ `{signature?}` | 기존+ `{approvalEventId?}` | 서명 옵셔널 |
| GET | `/api/leave-requests/[id]/signature` | - | `{signatureUrl, ref, signedBy, signedAt}` | 결재 인증서 보기 |

### 4.1 데이터 흐름 — 휴가 승인 시나리오

```
[UI] 승인 버튼 클릭
  → ApprovalSignatureModal 오픈
  → User.activeSignatureId 있으면 자동 로드 (체크박스 'use stored')
  → 또는 즉석 SignaturePad 캔버스 작성
  → PATCH /api/leave-requests/[id] {action:'APPROVE', signature:'data:image/png;base64,...'}

[Server]
  1. 세션 + canManageUsers 권한 확인
  2. signature 길이 검증 (≤200KB)
  3. sha256 → signatureRef 생성
  4. 기존 활성 서명과 일치하면 동일 Signature 재사용, 아니면 신규 Signature+MediaAsset 생성
  5. ApprovalEvent 생성 {actor, signatureId, resourceType:'leave_request', resourceId, action:'APPROVE', signatureRef, ipAddress}
  6. LeaveRequest.update({approvalEventId, status:'APPROVED', approvedBy})
  7. ANNUAL이면 잔여 차감 트랜잭션
  8. AuditLog 추가 (기존) + metadata.approvalEventId, metadata.signatureRef
  → return {ok, status:'APPROVED', signatureRef, approvalEventId}
```

---

## 5. UI Spec

### 5.1 등록 모달 (CreateUserModal)
```
┌────────── 신규 사용자 등록 ─────────────┐
│ 아이디* | 비밀번호*                     │
│ 이름*   | 권한*                         │
│ ─────── 직무 ───────                    │
│ 직책 [드롭다운: OFFICE/FIELD 그룹화]    │
│ 부서 [텍스트 입력 + 자동완성 기존부서]  │
│ 사번  | 전화                           │
│ 생년월일 | 입사일                       │
│ 주소                                   │
│ ─────── 자료 등록 ───────               │
│ 프로필 사진  [파일 선택] [미리보기]    │
│              ☑ 개인정보 수집 동의 (PII) │
│ 서명         [SignaturePad 200×100]    │
│              [지우기] [재서명]          │
│ ─────────────────────────────────       │
│              [취소] [등록]              │
└────────────────────────────────────────┘
```

### 5.2 인적사항 폼 (ProfileEditor)
- "직무" 섹션 신설: 직책 드롭다운, 부서 입력
- "프로필" 섹션 신설: 사진 미리보기 + 변경, 서명 미리보기 + 재등록(SignaturePad)
- 변경 이력 audit에 `position`, `department`, `profilePhotoChanged`, `signatureChanged` 기록 (raw 미저장)

### 5.3 휴가 승인 모달 (ApprovalSignatureModal)
```
┌────── 휴가 승인 ──────┐
│ 신청자: 홍길동(E0123) │
│ 유형: 연차            │
│ 기간: 2026-05-01~03   │
│ 사유: 가족여행        │
│ ─────────────────     │
│ 잔여: 12일 → 승인 후 9일 │
│ ─────────────────     │
│ ☑ 저장된 서명 사용    │
│ ┌─────────────────┐   │
│ │ [서명 미리보기]   │   │
│ └─────────────────┘   │
│  또는 [재서명] (캔버스 펼침) │
│              [취소][승인 + 서명]│
└──────────────────────┘
```

### 5.4 사용자 리스트 (RegisterTab)
- 행 좌측에 사진 썸네일 40px (없으면 이름 첫 글자 아바타)
- 직책 뱃지 (OFFICE=blue, FIELD=emerald, OTHER=slate)

### 5.5 휴가 신청 내역 (LeaveTab)
- 결재 완료 행에 결재자 서명 60px 인라인 + signatureRef 첫 8자 mono로 표시
- 클릭 시 `/api/leave-requests/[id]/signature` 호출하여 풀사이즈 모달

---

## 6. RBAC

| 액션 | SUPER | MUNI | CONTRACTOR_ADMIN | INTERNAL_ADMIN | WORKER |
|---|:-:|:-:|:-:|:-:|:-:|
| Position 조회 | ○ | ○ | ○ | ○ | ○ |
| Department CRUD | ○ | ✗(R-O) | ○(본인업체) | ○(본인업체) | ✗ |
| User position/department 변경 | ○ | ✗ | ○(본인업체) | ○(본인업체) | ✗ |
| 본인 사진/서명 자가 등록 | ○ | ○ | ○ | ○ | ○(본인만) |
| 휴가 APPROVE + 서명 | ○ | ✗ | ○(본인업체) | ○(본인업체) | ✗ |
| ApprovalEvent 조회 | ○ | ○(본인지자체) | ○(본인업체) | ○(본인업체) | ○(본인 관련만) |

---

## 7. Security & Integrity

- **사진 zod**: `z.string().regex(/^data:image\/(png|jpe?g);base64,/).max(700_000)` (500KB 원본 + base64 1.33배)
- **서명 zod**: `z.string().regex(/^data:image\/png;base64,/).max(280_000)` (200KB 한도)
- **sha256**: `crypto.createHash('sha256').update(b64).digest('hex')` — Server 전용
- **signatureRef 인덱스**: 결재 후 변조 의심 시 `WHERE approval_events.signature_ref != sha256(leave_requests.approver_signature[:16])` 쿼리 1초 안에 검출
- **PII 동의**: 사진 등록 모달에 동의 체크박스, 미체크 시 disabled (FE) + Server에서 `confirmedPII: true` 검증
- **audit 슬림화**: TRACKED_FIELDS에서 profilePhoto/signature 제외, `profilePhotoChanged: true|false`만 metadata에

---

## 8. Test Plan

### L1 (API)
| 시나리오 | 기대 |
|---|---|
| GET /api/positions (인증된 임의 사용자) | 200, 12개 항목 |
| POST /api/users {positionCode:'TEAM_LEAD'} | 201, DB User.positionId 채움 |
| POST /api/users {profilePhoto: 522KB} | 400, issues.profilePhoto |
| POST /api/users {signature: invalid base64} | 400 |
| PATCH /api/leave-requests/N {action:'APPROVE', no signature} | 400 signature_required |
| PATCH /api/leave-requests/N {action:'APPROVE', signature:'data:image/png;base64,...'} | 200, signatureRef 16자 |
| GET /api/leave-requests/N/signature | 200, ref 일치 |
| WORKER가 다른 사용자 PATCH 시도 | 403 |

### L2 (UI)
- 등록 모달: 직책 드롭다운 12개, OFFICE/FIELD optgroup 분리
- 사진 업로드: 600KB 파일 → 클라이언트 리사이즈 → 500KB 미만 통과
- 서명 캔버스: 그리기 → 지우기 → 재서명 → 저장 시 data URL 200KB 미만
- 휴가 APPROVE 모달: 저장된 서명 체크박스 ON 시 자동 채움, 즉시 승인

### L3 (E2E)
- 신규 워커 등록 → 사진/서명 동시 등록 → 휴가 신청 → 관리자 APPROVE (저장된 서명) → 신청 내역에 서명 썸네일 노출 → API/api/leave-requests/N/signature → ref 검증

---

## 9. Migration Steps

1. `prisma/schema.prisma` 4 신규 모델 + User 4 FK + LeaveRequest 1 FK
2. `npx prisma db push --skip-generate`
3. `npx prisma generate`
4. `prisma/seeds/positions.ts` 실행 (npx tsx)
5. `lib/positions.ts`, `lib/signatures.ts`, `lib/media-assets.ts`, `lib/approvals.ts` 작성
6. `components/SignaturePad.tsx` 추출 (기존 TBM 컴포넌트 위치 식별 후 일반화)
7. `components/ProfilePhotoUploader.tsx` 작성 (canvas resize 로직)
8. API 9개 라우트 추가/수정
9. UI 5곳 수정 (등록 모달, 인적사항, 사용자 리스트, 휴가 승인, 휴가 내역)
10. 회귀 테스트: 기존 사용자 6명 무손실 + L1 시나리오 8개 통과

---

## 10. Risks & Mitigations

| ID | 리스크 | 완화 |
|---|---|---|
| R1 | Position label 변경 시 보고서 일관성 | code 불변, label 변경은 신규 Position row + 기존 deactivate 권장 |
| R2 | DB 비대 — MediaAsset 크기 합산 테이블 모니터링 필요 | `SELECT SUM(size_bytes) FROM media_assets` 운영 대시보드 + 600KB 평균 가이드 |
| R3 | 서명 위변조 | signatureRef sha256 검증 쿼리 + ApprovalEvent immutable (DELETE 권한 미부여) |
| R4 | PII 동의 미수집 | confirmedPII 서버측 검증, audit metadata.consentAt 기록 |
| R5 | Signature 이력 폭증(10회/일×500명=일 5천행) | 동일 sha256 재등록 시 기존 row 재활성화(activatedAt 갱신, deactivatedAt=null) |

---

## 11. Implementation Guide

### 11.1 의존성
신규 패키지 0. Node `crypto` 표준.

### 11.2 코드 컨벤션
- `// Design Ref: §2.1 — Position 마스터 (D1)`
- `// Plan SC2 — 사진 500KB 제한`
- `// Plan SC4 — signatureRef sha256 검증`

### 11.3 Session Guide (Module Map)

| 모듈 | 파일 | 의존 | 시간 |
|---|---|---|---|
| **module-1: Schema + Seed** | schema.prisma, prisma/seeds/positions.ts | - | 30m |
| **module-2: Server Lib** | lib/{positions,signatures,media-assets,approvals}.ts | module-1 | 40m |
| **module-3: API Routes** | app/api/{positions,departments,users,leave-requests,users/[id]/signature}/* | module-2 | 60m |
| **module-4: SignaturePad + Uploader** | components/{SignaturePad,ProfilePhotoUploader,ApprovalSignatureModal}.tsx | - | 45m |
| **module-5: UI Integration** | app/(admin)/users/_users-client.tsx (등록/인적사항/리스트/휴가) | module-3, module-4 | 60m |
| **module-6: Verify** | curl + pages SSR | all | 30m |

**권장 분할**: 1세션에 module-1+2+3 (schema → API), 2세션에 module-4+5+6 (UI + 검증). 또는 한 번에 진행 가능.

---

## 12. Open Questions (Design 단계 잔여)

- Department 트리 깊이 제한? — MVP: 2단계(본부→팀)로 자유롭게, 강제 X
- 사진 Default 아바타: 이름 첫 글자 + position.category 색? — 채택
- 휴가 반려도 서명 필요? — 선택사항, 즉석 옵션 제공 (저장 안 함)
