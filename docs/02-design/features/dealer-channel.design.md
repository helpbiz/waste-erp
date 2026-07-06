# 딜러 채널(리드 게이트키핑 + 영업 데모 샌드박스) Design Document

> **Summary**: Option B(클린 아키텍처) — `lib/services/dealer/` 서비스 계층에 원자적 프로비저닝 코어(ProvisioningService)를 두고, 리드 승인과 데모 발급이 이 코어를 공유한다.
>
> **Project**: waste-erp (Clean ERP)
> **Version**: 0.1.0-alpha
> **Author**: 4365won@gmail.com
> **Date**: 2026-07-06
> **Status**: Draft
> **Planning Doc**: [dealer-channel.plan.md](../01-plan/features/dealer-channel.plan.md)

---

## Context Anchor

> Copied from Plan document.

| Key | Value |
|-----|-------|
| **WHY** | 딜러 채널 확장 시 SUPER_ADMIN 병목 해소 + 영업 시연 지원이 필요하나, 회사 생성권을 직접 위임하면 보안·온보딩 리스크가 큼 |
| **WHO** | DEALER(신규, 리드 등록·데모 발급만) / SUPER_ADMIN(승인·최종 프로비저닝) / 그 외 4개 role은 영향 없음 |
| **RISK** | (R1) 데모 계정이 SUPER_ADMIN 랭크를 갖게 되면 전체 데이터 무필터 노출 (R2) 데모 자유입력에 실제 개인정보 유입 (R3) 딜러 리드 남발로 승인 큐 폭주 (R4) 데모 정리 시 FK 위반으로 고아 레코드 |
| **SUCCESS** | SC-1 기존 4개 role 회귀 0건 (SC-2) 딜러 계정으로 실 프로덕션 데이터 접근 0건 (SC-3) 데모 자동 정리 100% (SC-4) 리드 승인·데모 발급 모두 원자성 확보 |
| **SCOPE** | DEALER role + Lead 모델 + Contractor.dealerId + DealerCommission(컬럼만) + 데모 프로비저닝/정리. 제외: 기존 4개 role 변경, 커미션 자동정산 UI, 딜러 셀프 회원가입, SUPER_ADMIN 콘솔 물리적 분리 |

---

## 1. Overview

### 1.1 Design Goals
- 리드 승인(실계정 생성)과 데모 발급(격리 계정 생성)이 **동일한 원자적 코어**를 공유해 Plan Q2("승인 체인 트랜잭션화 여부")를 해소한다.
- 기존 4개 role·RBAC 랭크·스코핑 헬퍼(`lib/scopes.ts`)는 단 한 줄도 수정하지 않는다.
- FK cascade가 설정되지 않은 현재 스키마 제약 하에서, 생성과 삭제(cleanup) 양쪽이 **동일한 테이블 순서 상수**를 참조해 정합성을 보장한다.

### 1.2 Design Principles
- Single Responsibility: 라우트는 인증/파싱만, 비즈니스 로직은 서비스 계층에 위치
- 원자성 우선: 다단계 생성/삭제는 반드시 `prisma.$transaction`
- 격리는 새로 만들지 않는다: 기존 `contractorId`/`municipalityId` 기반 세션 스코핑을 그대로 재사용, 데모는 오직 role(CONTRACTOR_ADMIN, SUPER_ADMIN 아님)로만 격리

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | 기존 순차 API 그대로 재사용 | `lib/services/dealer/` 서비스 계층 신설 | 리스크 큰 두 곳만 트랜잭션화 |
| **New Files** | 2-3 | 6-8 | 3-4 |
| **Modified Files** | 2 | 3 | 3 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Medium | High | High |
| **Effort** | Low | High | Medium |
| **Risk** | Medium (고아 레코드 방치) | Low | Low |

**Selected**: **Option B** — **Rationale**: 사용자 선택. 리드 승인과 데모 발급이 구조적으로 "같은 일(지자체+위탁업체+관리자 계정 생성)을 실계정이냐 데모냐만 다르게" 하는 것이므로, 공유 서비스 계층으로 추상화하면 Plan의 Open Question(승인 체인 원자성)도 자연히 해소되고 향후 세 번째 프로비저닝 경로(예: 셀프 온보딩)가 생겨도 서비스 재사용만으로 확장 가능하다.

> 이하 상세 설계는 Option B 기준.

### 2.1 Component Diagram

```
┌──────────────────┐     ┌───────────────────────────┐     ┌─────────────┐
│  Dealer 클라이언트  │────▶│ app/api/dealer/*          │────▶│             │
│ (리드 등록/데모 발급) │     │ app/api/super-admin/leads │     │             │
└──────────────────┘     │ app/api/cron/demo-cleanup │     │  PostgreSQL │
┌──────────────────┐     └─────────────┬─────────────┘     │  (Prisma)   │
│ SUPER_ADMIN 콘솔   │────▶(승인 액션)────┘                    │             │
│ (리드 승인 탭)      │                                       │             │
└──────────────────┘                   │                    │             │
                                        ▼                    │             │
                          ┌──────────────────────────┐       │             │
                          │ lib/services/dealer/      │──────▶             │
                          │  - ProvisioningService     │       └─────────────┘
                          │  - LeadService              │
                          │  - DemoLifecycleService     │
                          └──────────────────────────┘
```

### 2.2 Data Flow

**리드→승인 플로우**
```
DEALER: POST /api/dealer/leads → LeadService.create() → Lead(PENDING)
SUPER_ADMIN: PATCH /api/super-admin/leads/[id]/approve
  → LeadService.approve() → ProvisioningService.provision({isDemo:false, dealerId})
  → 단일 트랜잭션: Municipality + Contractor(dealerId 스탬프) + User(CONTRACTOR_ADMIN) + MuniPolicy 생성
  → Lead.status = APPROVED
```

**데모 발급 플로우**
```
DEALER: POST /api/dealer/demo-provision
  → 쿼터 체크(딜러당 활성 데모 상한)
  → ProvisioningService.provision({isDemo:true, dealerId})
  → 단일 트랜잭션: Municipality(isDemo) + Contractor(isDemo, demoExpiresAt=+14d) + User(CONTRACTOR_ADMIN) + MuniPolicy 생성
  → DemoLifecycleService.seed() 로 3~6개월 샘플 데이터 시딩
```

**정리(cleanup) 플로우**
```
외부 스케줄러 → POST /api/cron/demo-cleanup (CRON_SECRET)
  → DemoLifecycleService.cleanupExpired()
  → isDemo=true AND demoExpiresAt < now() 대상, DEMO_TABLE_ORDER 역순 deleteMany, 단일 트랜잭션
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `app/api/dealer/*` | `lib/services/dealer/*` | 얇은 컨트롤러 — 인증/파싱만 |
| `ProvisioningService` | Prisma Client, `lib/demo/table-order.ts` | 원자적 생성 코어 (실계정/데모 공용) |
| `DemoLifecycleService` | `ProvisioningService`(seed), `lib/demo/table-order.ts` | 데모 시딩·정리 |
| `LeadService` | `ProvisioningService` | 승인 시 실계정 프로비저닝 위임 |
| `app/api/cron/demo-cleanup` | 기존 `lib/cron-auth.ts` | 기존 gps-cleanup과 동일 인증 패턴 재사용 |

---

## 3. Data Model

### 3.1 Prisma 스키마 변경

```prisma
enum Role {
  SUPER_ADMIN
  MUNI_ADMIN
  CONTRACTOR_ADMIN
  INTERNAL_ADMIN
  WORKER
  DEALER            // 신규 추가 — 기존 5개 값 순서·의미 무변경
}

enum LeadStatus {
  PENDING
  APPROVED
  REJECTED
}

model Lead {
  id              BigInt     @id @default(autoincrement())
  dealerId        BigInt     @map("dealer_id")
  dealer          User       @relation(fields: [dealerId], references: [id])
  prospectName    String     @map("prospect_name")
  prospectContact String?    @map("prospect_contact")
  referralCode    String     @unique @map("referral_code")
  status          LeadStatus @default(PENDING)
  memo            String?
  createdAt       DateTime   @default(now()) @map("created_at")
  reviewedAt      DateTime?  @map("reviewed_at")
  reviewedBy      BigInt?    @map("reviewed_by")
  contractorId    BigInt?    @map("contractor_id")  // 승인 후 생성된 Contractor 역참조

  @@index([dealerId, status])
  @@map("leads")
}

model DealerCommission {
  id             BigInt   @id @default(autoincrement())
  dealerId       BigInt   @map("dealer_id")
  contractorId   BigInt   @map("contractor_id")
  commissionRate Decimal  @default(0) @map("commission_rate")
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([dealerId])
  @@map("dealer_commissions")
}

// Contractor 모델에 추가
//   dealerId       BigInt?   @map("dealer_id")       — 누가 영업했는지 귀속
//   isDemo         Boolean   @default(false) @map("is_demo")
//   demoExpiresAt  DateTime? @map("demo_expires_at")
//   @@index([isDemo, demoExpiresAt])

// Municipality 모델에 추가
//   isDemo         Boolean   @default(false) @map("is_demo")
//   demoExpiresAt  DateTime? @map("demo_expires_at")
```

마이그레이션은 전부 additive(nullable 컬럼 + 신규 모델 + enum 값 추가)이며 기존 행에 영향 없음.

### 3.2 Entity Relationships

```
[User(role=DEALER)] 1 ──── N [Lead]
[Lead] ── (승인 시) ──▶ [Contractor(dealerId 스탬프)]
[Contractor] 1 ──── N [DealerCommission]
[Municipality] 1 ──── N [Contractor]   (기존 관계, 무변경)
```

### 3.3 `lib/demo/table-order.ts` (신규, 공유 상수)

```typescript
// 데모 Contractor 정리 시 자식→부모 역순 삭제 순서.
// ProvisioningService(시딩)와 DemoLifecycleService(정리) 양쪽이 이 상수를 참조한다.
// FK cascade가 설정되지 않은 모델들이므로 순서 누락 시 삭제 실패함 — 신규 모델 추가 시 이 배열도 갱신 필요.
export const DEMO_CHILD_TABLE_ORDER = [
  'complaint', 'attendanceRecord', 'vehicleLog', 'safetyReport',
  'leaveRequest', /* ...실제 Contractor 자식 모델 전수 조사 후 Do 단계에서 확정 */
] as const;
```

> **Do 단계 필수 작업**: `prisma/schema.prisma`에서 `Contractor`를 참조하는 모든 모델을 grep으로 전수 조사해 위 배열을 완성할 것. 누락 시 cleanup 트랜잭션이 FK 위반으로 실패한다.

---

## 4. API Specification

### 4.1 Endpoint List

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/dealer/leads | 리드 등록 | DEALER |
| GET | /api/dealer/leads | 본인 리드 목록 조회 | DEALER |
| PATCH | /api/super-admin/leads/:id/approve | 리드 승인 → 실계정 프로비저닝 | SUPER_ADMIN |
| PATCH | /api/super-admin/leads/:id/reject | 리드 반려 | SUPER_ADMIN |
| POST | /api/dealer/demo-provision | 데모 셀프발급 | DEALER |
| GET | /api/dealer/demo | 본인 활성 데모 목록 | DEALER |
| POST | /api/cron/demo-cleanup | 만료 데모 정리 (dryRun 지원) | CRON_SECRET |

### 4.2 Detailed Specification

#### `POST /api/dealer/leads`
**Request:**
```json
{ "prospectName": "string", "prospectContact": "string?", "memo": "string?" }
```
**Response (201):**
```json
{ "id": "string", "referralCode": "string", "status": "PENDING", "createdAt": "..." }
```
**Errors**: 400(validation), 401(unauthenticated), 403(role != DEALER)

#### `PATCH /api/super-admin/leads/:id/approve`
**Request:**
```json
{ "municipalityName": "string", "contractorName": "string", "contractorAdminAccount": {"loginId":"string","name":"string"} }
```
**Response (200):**
```json
{ "leadId": "string", "contractorId": "string", "municipalityId": "string" }
```
**Errors**: 400, 401, 403(role != SUPER_ADMIN), 404(lead not found), 409(lead already reviewed)

#### `POST /api/dealer/demo-provision`
**Request:** `{}`  (딜러 세션에서 dealerId 추출)
**Response (201):**
```json
{ "contractorId": "string", "municipalityId": "string", "loginUrl": "string", "expiresAt": "..." }
```
**Errors**: 401, 403(role != DEALER), 409(쿼터 초과)

#### `POST /api/cron/demo-cleanup`
**Request:** `{ "dryRun": "boolean?" }`
**Response (200):** `{ "deletedCount": "number", "dryRun": "boolean" }`
**Errors**: 401(잘못된 CRON_SECRET)

---

## 5. UI/UX Design

### 5.1 화면 목록
- `app/(dealer)/dealer/leads/page.tsx` — 리드 등록 폼 + 본인 리드 목록(상태 배지)
- `app/(dealer)/dealer/demo/page.tsx` — "데모 즉시 발급" 버튼 + 활성 데모 목록(만료일 표시)
- `app/(admin)/super-admin/_leads-tab.tsx` — 기존 super-admin 콘솔에 탭 추가, 승인/반려 액션

### 5.4 Page UI Checklist

#### 딜러 리드 페이지 (`/dealer/leads`)
- [ ] Form: 예상 고객사명(text), 연락처(text, optional), 메모(textarea, optional)
- [ ] Button: 리드 등록 제출
- [ ] List: 본인 리드 목록 — 상태 배지(PENDING/APPROVED/REJECTED, 색상 구분), 등록일, referralCode

#### 딜러 데모 페이지 (`/dealer/demo`)
- [ ] Button: "데모 즉시 발급" (쿼터 초과 시 disabled + 안내 문구)
- [ ] List: 활성 데모 카드 — 만료일 D-day 표시, 로그인 URL 복사 버튼

#### SUPER_ADMIN 리드 승인 탭
- [ ] List: PENDING 리드 목록 — 딜러명, 고객사명, 등록일
- [ ] Button: 승인 (모달 — 지자체명/위탁업체명/관리자 계정 입력 후 확정)
- [ ] Button: 반려 (사유 입력)

---

## 6. Error Handling

| Code | Message | Cause | Handling |
|------|---------|-------|----------|
| 400 | Invalid input | Zod validation 실패 | fieldErrors 응답 |
| 401 | Unauthorized | 세션 없음/CRON_SECRET 불일치 | 로그인 페이지 리다이렉트 or cron 401 |
| 403 | Forbidden | role 불일치 (예: DEALER가 아닌데 demo-provision 호출) | 에러 메시지 |
| 404 | Lead not found | 잘못된 리드 ID | 404 페이지 |
| 409 | Quota exceeded / already reviewed | 딜러 데모 쿼터 초과, 리드 중복 승인 시도 | 안내 메시지 |
| 500 | Internal error | 트랜잭션 실패 | 감사로그 기록 + 사용자에게 재시도 안내 |

---

## 7. Security Considerations

- [x] DEALER role은 `MODULE_ACCESS`에 `lead.create`/`lead.read.own`/`demo.provision`만 화이트리스트 — SUPER_ADMIN 전용 mutate(`municipality.manage`/`contractor.manage`) 접근 불가 확인 필요(테스트 §8.2 #5)
- [x] `demo-provision` 라우트는 데모 계정 role을 **`CONTRACTOR_ADMIN`으로 하드코딩** — SUPER_ADMIN 부여 코드 경로 자체를 만들지 않음
- [x] 데모 세션 JWT에 `scope:"demo"` 클레임 + TTL 30~60분(기존 8h 대비 단축) — `lib/auth.ts`의 `issueSession`에 데모 전용 분기 추가
- [x] 데모 스코프(`isDemo=true` 테넌트)에서 `lib/sms.ts` 발송 함수 호출 시 실제 전송 대신 no-op + 로그만 기록
- [x] `POST /api/cron/demo-cleanup`은 기존 `lib/cron-auth.ts` 패턴(timingSafeEqual) 재사용 — 신규 인증 로직 작성 금지
- [x] 기존 4개 role의 `MODULE_ACCESS`/랭크 항목은 이 Design 전체에서 수정하지 않음(회귀 테스트 §8.2 #6으로 검증)

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API Tests | `/api/dealer/*`, `/api/super-admin/leads/*`, `/api/cron/demo-cleanup` | curl/Playwright request | Do |
| L2: UI Action Tests | 리드 폼, 데모 발급 버튼, 승인 탭 | Playwright | Do |
| L3: E2E Scenario Tests | 리드→승인→로그인, 데모 발급→로그인→격리 확인 | Playwright | Do |

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | Test Description | Expected Status |
|---|----------|--------|-------------------|:--:|
| 1 | /api/dealer/leads | POST | DEALER가 유효한 리드 등록 | 201 |
| 2 | /api/dealer/leads | POST | WORKER가 호출(권한 없음) | 403 |
| 3 | /api/super-admin/leads/:id/approve | PATCH | SUPER_ADMIN이 승인 → Contractor.dealerId 스탬프 확인 | 200 |
| 4 | /api/super-admin/leads/:id/approve | PATCH | 이미 승인된 리드 재승인 시도 | 409 |
| 5 | /api/dealer/demo-provision | POST | DEALER 셀프발급, 반환된 계정으로 로그인 시 role=CONTRACTOR_ADMIN 확인 (**SUPER_ADMIN 아님을 명시 검증**) | 201 |
| 6 | /api/dealer/demo-provision | POST | 쿼터 초과 시도 | 409 |
| 7 | /api/cron/demo-cleanup | POST | dryRun=true, 삭제 없이 대상 카운트만 반환 | 200 |
| 8 | /api/cron/demo-cleanup | POST | 만료 데모 실제 삭제 후 FK 위반 0건 확인 | 200 |
| 9 | (회귀) /api/users | POST | 기존 4개 role 계정 생성 플로우 무변경 확인 | 201 |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected Result |
|---|------|--------|------------------|
| 1 | /dealer/leads | 리드 등록 폼 제출 | 목록에 PENDING 배지로 즉시 반영 |
| 2 | /dealer/demo | "데모 즉시 발급" 클릭 | 카드 목록에 만료일 D-14 표시 |
| 3 | super-admin 리드 탭 | 승인 모달에서 필드 채우고 확정 | Lead 상태 APPROVED로 변경, 목록에서 사라짐 |

### 8.4 L3: E2E Scenario Test Scenarios

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-------------------|
| 1 | 리드→실계정 전환 | 딜러 리드등록 → SUPER 승인 → 신규 CONTRACTOR_ADMIN 계정 로그인 | 로그인 성공, 본인 contractorId 스코프 데이터만 조회됨 |
| 2 | 데모 발급→격리 확인 | 딜러 데모발급 → 데모 계정 로그인 → 실 프로덕션 지자체 데이터 조회 시도 | 조회 결과 0건(격리 확인), role이 SUPER_ADMIN이 아님을 세션에서 확인 |
| 3 | 데모 자유입력→SMS 미발송 | 데모 테넌트에서 민원 등록(연락처 포함) | SMS 발송 로그에 "no-op(demo)" 기록, 실제 발송 API 호출 0건 |
| 4 | 데모 만료 정리 | demoExpiresAt을 과거로 설정 → cron 실행 | 해당 Contractor/Municipality/자식 레코드 전부 삭제, FK 에러 없음 |

### 8.5 Seed Data Requirements

| Entity | Minimum Count | Key Fields Required |
|--------|:------------:|---------------------|
| User(DEALER) | 2 | 서로 다른 dealerId로 격리 테스트 |
| Lead | 3 | PENDING/APPROVED/REJECTED 각 1건 |
| Contractor(isDemo=true) | 1 | demoExpiresAt 과거값(정리 테스트용) 1건 포함 |

---

## 9. Clean Architecture

### 9.1 Layer Structure

| Layer | Responsibility | Location |
|-------|---------------|----------|
| **Presentation** | 딜러/승인 UI | `app/(dealer)/dealer/*`, `app/(admin)/super-admin/_leads-tab.tsx` |
| **Application** | 서비스 계층 (본 Design의 핵심) | `lib/services/dealer/*.ts` |
| **Domain** | 타입·상수 | `lib/types/dealer.ts`, `lib/demo/table-order.ts` |
| **Infrastructure** | API 라우트(얇은 컨트롤러), Prisma | `app/api/dealer/*`, `app/api/super-admin/leads/*`, `app/api/cron/demo-cleanup`, `prisma/schema.prisma` |

### 9.2 Dependency Rules

```
Presentation ──→ (fetch) ──→ API Routes(Infrastructure) ──→ Application(Service) ──→ Domain
                                                                    │
                                                                    └──→ Prisma(Infrastructure)

Rule: API 라우트는 인증·파싱만, 비즈니스 로직은 반드시 lib/services/dealer/*를 호출
```

### 9.4 This Feature's Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `ProvisioningService` | Application | `lib/services/dealer/provisioning-service.ts` |
| `LeadService` | Application | `lib/services/dealer/lead-service.ts` |
| `DemoLifecycleService` | Application | `lib/services/dealer/demo-lifecycle-service.ts` |
| `DEMO_CHILD_TABLE_ORDER` | Domain | `lib/demo/table-order.ts` |
| Lead/DealerCommission 타입 | Domain | `lib/types/dealer.ts` |
| API 라우트 6종 | Infrastructure | `app/api/dealer/*`, `app/api/super-admin/leads/*`, `app/api/cron/demo-cleanup` |

---

## 10. Coding Convention Reference

| Item | Convention Applied |
|------|--------------------|
| Naming | 기존 프로젝트 컨벤션(camelCase 함수, PascalCase 서비스 클래스) 그대로 |
| 에러 처리 | 기존 `app/api/*` 라우트의 zod validation + `{error:{code,message}}` 포맷 재사용 |
| 트랜잭션 | `prisma.$transaction(async (tx) => {...})` — ProvisioningService/DemoLifecycleService 내부에서만 사용, 라우트에서 직접 호출 금지 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
prisma/schema.prisma                          (수정 — Role.DEALER, Lead, DealerCommission, Contractor/Municipality 필드 추가)
lib/demo/table-order.ts                       (신규)
lib/types/dealer.ts                            (신규)
lib/services/dealer/
  provisioning-service.ts                      (신규 — 원자적 생성 코어, 실계정/데모 공용)
  lead-service.ts                              (신규)
  demo-lifecycle-service.ts                    (신규 — 시딩+정리)
app/api/dealer/
  leads/route.ts                               (신규)
  demo-provision/route.ts                      (신규)
  demo/route.ts                                (신규)
app/api/super-admin/leads/
  [id]/approve/route.ts                        (신규)
  [id]/reject/route.ts                         (신규)
app/api/cron/demo-cleanup/route.ts             (신규 — 기존 gps-cleanup 인증 패턴 재사용)
app/(dealer)/dealer/leads/page.tsx             (신규)
app/(dealer)/dealer/demo/page.tsx              (신규)
app/(admin)/super-admin/_leads-tab.tsx         (신규)
lib/rbac.ts                                    (수정 — MODULE_ACCESS에 DEALER 화이트리스트 3항목만 추가)
lib/sms.ts                                     (수정 — isDemo 스코프 no-op 분기 추가)
lib/auth.ts                                    (수정 — 데모 세션 짧은 TTL 발급 분기 추가)
```

### 11.2 Implementation Order
1. [ ] Prisma 스키마 마이그레이션 (Module 1)
2. [ ] `lib/demo/table-order.ts` — Contractor 자식 모델 전수 조사 후 확정 (Module 1 선행)
3. [ ] `ProvisioningService` 구현 + 단위 테스트 (Module 2)
4. [ ] Lead API 3종 + `LeadService` (Module 3)
5. [ ] Demo API 3종 + `DemoLifecycleService` + 시딩 스크립트 (Module 4)
6. [ ] 딜러/승인 UI (Module 5)
7. [ ] L1-L3 테스트 작성 및 통과 (Module 6)

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| 스키마+테이블순서 상수 | `module-1` | Prisma 마이그레이션, table-order 전수조사 | 15-20 |
| ProvisioningService | `module-2` | 원자적 생성 코어(실계정/데모 공용) | 25-30 |
| Lead API+Service | `module-3` | 리드 등록/승인/반려 | 20-25 |
| Demo API+Service | `module-4` | 데모 발급/조회/정리 + 시딩 | 25-30 |
| 딜러/승인 UI | `module-5` | 3개 화면 | 25-30 |
| 테스트 | `module-6` | L1-L3 전체 | 20-25 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1,module-2` | 40-50 |
| Session 3 | Do | `--scope module-3,module-4` | 45-55 |
| Session 4 | Do | `--scope module-5` | 25-30 |
| Session 5 | Do + Check | `--scope module-6` + gap analysis | 40-50 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-07-06 | 최초 작성 — Option B(클린 아키텍처) 사용자 선택 반영 | 4365won@gmail.com |
