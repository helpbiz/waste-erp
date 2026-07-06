---
template: plan
version: 1.3
feature: dealer-channel
date: 2026-07-06
author: 4365won@gmail.com
project: waste-erp (Clean ERP)
version: 0.1.0-alpha
---

# 딜러 채널(리드 게이트키핑 + 영업 데모 샌드박스) — Planning Document

> **Summary**: 공비랩 딜러 영업망 확장을 위해 "리드 등록 → SUPER_ADMIN 승인" 게이트키핑 모델과, 딜러가 예비고객에게 셀프발급 즉시 시연 가능한 데모 샌드박스를 추가한다. 기존 4개 role(MUNI_ADMIN/CONTRACTOR_ADMIN/INTERNAL_ADMIN/WORKER) 정의·권한·UI는 무수정.
>
> **Project**: waste-erp (Clean ERP)
> **Version**: 0.1.0-alpha
> **Author**: 4365won@gmail.com
> **Date**: 2026-07-06
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 지금까지 SUPER_ADMIN(1인 개발자) 혼자 신규 지자체/위탁업체를 등록해왔다. 공비랩이 딜러 영업망을 구축하면서 이 병목이 심화되는데, 딜러에게 회사 생성 권한을 직접 주면 보안(무제한 생성·계정 오남용)과 온보딩(비전문가에게 다단계 생성 플로우 노출) 리스크가 크다. 동시에 딜러는 예비고객에게 실제 데이터 입력·출력(리포트)까지 보여줄 데모 환경이 없다. |
| **Solution** | ① **게이트키핑 모델**: DEALER role 신설(리드 등록만 가능) + Lead 모델 + SUPER_ADMIN 승인 시 기존 지자체/위탁업체 생성 API 체인 재사용. ② **데모 샌드박스**: 딜러가 셀프발급하는 격리된 데모 Municipality/Contractor(`isDemo` 플래그, CONTRACTOR_ADMIN 스코프, SUPER_ADMIN 아님) + 사전 시딩 샘플데이터 + 제한적 자유입력 + 주기적 wipe/reseed. |
| **Function/UX Effect** | 딜러는 리드 등록 폼과 "데모 즉시 발급" 버튼만 가짐. 승인된 리드는 자동으로 실계정 프로비저닝 초안이 채워짐. 데모는 승인 대기 없이 바로 발급되어 영업 미팅 공백이 없다. |
| **Core Value** | 영업 확장(딜러 채널)과 보안(SUPER_ADMIN 전용 자원 생성권 보존)을 동시에 만족 — 기존 RBAC·스코핑 로직 무수정, 순수 additive 변경. |

---

## Context Anchor

> Auto-propagated to Design/Do documents.

| Key | Value |
|-----|-------|
| **WHY** | 딜러 채널 확장 시 SUPER_ADMIN 병목 해소 + 영업 시연 지원이 필요하나, 회사 생성권을 직접 위임하면 보안·온보딩 리스크가 큼 |
| **WHO** | DEALER(신규, 리드 등록·데모 발급만) / SUPER_ADMIN(승인·최종 프로비저닝) / 그 외 4개 role은 영향 없음 |
| **RISK** | (R1) 데모 계정이 SUPER_ADMIN 랭크를 갖게 되면 전체 데이터 무필터 노출 (R2) 데모 자유입력에 실제 개인정보(민원인 실명·전화번호) 유입 (R3) 딜러 리드 남발로 SUPER_ADMIN 승인 큐 폭주 (R4) 데모 정리(cleanup) 시 FK 위반으로 고아 레코드 |
| **SUCCESS** | SC-1 기존 4개 role 정의·권한·UI 회귀 0건 (SC-2) 딜러 계정으로 실제 프로덕션 지자체/위탁업체 데이터 접근 0건 (SC-3) 데모 테넌트 자동 정리 100% (SC-4) 리드 승인 시 기존 생성 체인 재사용, 신규 트랜잭션 로직 원자성 확보 |
| **SCOPE** | DEALER role + Lead 모델 + Contractor.dealerId + DealerCommission(컬럼만) + 데모 프로비저닝/정리 API 2종. **제외**: 기존 4개 role 변경, 커미션 자동정산 UI, 딜러 셀프 회원가입, SUPER_ADMIN 콘솔 물리적 분리(별도 트리거 발생 시 후속 Plan) |

---

## 1. Background

### 1.1 도메인 컨텍스트
- waste-erp는 `SUPER_ADMIN(100) > MUNI_ADMIN(80) > CONTRACTOR_ADMIN(60) > INTERNAL_ADMIN(40) > WORKER(10)` 랭크의 RBAC을 가진 지자체 위탁 폐기물 ERP다(`lib/rbac.ts`).
- 신규 지자체(`Municipality`)/위탁업체(`Contractor`) 생성은 `POST /api/super-admin/municipalities`, `POST /api/contractors`로 **SUPER_ADMIN 전용**이며, 온보딩 마법사(`app/(admin)/super-admin/_onboarding-wizard.tsx`)가 계약생성→계정생성(`POST /api/users`)→정책생성(`POST /api/super-admin/muni-policies`) 순으로 **순차 API 호출**을 이어붙인다(원자적 트랜잭션 아님).
- 데이터 격리는 각 API route가 `session.contractorId`/`session.municipalityId` 기반 `where` 헬퍼(`lib/scopes.ts` 등)를 호출하는 방식에 100% 의존한다. **SUPER_ADMIN만 모든 헬퍼에서 무필터(`return {}`)** — 이 role만 격리를 우회한다.
- 딜러/리퍼럴/커미션 개념은 스키마·문서 어디에도 없다. `docs/specs/08_역할권한_설계서.md`(초안, 의사결정 7건 대기)에 "MUNI_ADMIN 셀프가입 불가, SUPER 발급"이 이미 명문화되어 있어 대리 생성 원칙과 일치한다.
- "정산"이라는 용어는 이미 지자체↔위탁업체 원가 정산을 가리키는 기존 도메인 개념이므로, 딜러 커미션은 별도 용어(`DealerCommission`)로 구분한다.

### 1.2 현재 한계
- SUPER_ADMIN(1인 개발자) 혼자 모든 신규 계약을 생성해야 하는 병목.
- 딜러가 예비고객에게 보여줄 데모 환경이 전무 — 실계정을 임시로 만들어 쓰거나 시연 자체가 불가능한 상태로 추정.
- Contractor에는 "누가 영업했는지" 추적 컬럼이 없다(Municipality에는 `createdBy` 존재).

---

## 2. Goals & Scope

### 2.1 Goals
1. SUPER_ADMIN의 "자원 생성 권한"은 보존하되, 리드 발굴·데모 시연은 딜러에게 위임
2. 기존 RBAC 랭크·스코핑 헬퍼·4개 role UI 무수정
3. 신규 스키마는 전부 additive(nullable FK, 신규 모델), enum 변경 없음(Role에 DEALER **추가**만 예외)

### 2.2 In Scope
- [ ] **P1** `Role` enum에 `DEALER` 추가 + `MODULE_ACCESS`에 `lead.create`/`lead.read.own`/`demo.provision` 화이트리스트 항목만 추가
- [ ] **P2** `Lead` 모델 신설 (dealerId, referralCode, 잠재고객 정보, status: PENDING/APPROVED/REJECTED, createdAt)
- [ ] **P3** `Contractor.dealerId`(nullable FK) 추가 — `Municipality.createdBy` 패턴과 동일 스타일
- [ ] **P4** `DealerCommission` 모델 신설 — 컬럼만 정의(commissionRate, ledger), UI 없음, 기존 "정산" 용어와 분리
- [ ] **P5** 리드 승인 플로우: SUPER_ADMIN이 Lead를 승인하면 기존 생성 체인(municipalities→contractors→users→muni-policies)을 리드 데이터로 프리필해서 그대로 재사용
- [ ] **P6** 데모 프로비저닝: `POST /api/dealer/demo-provision` — 딜러 인증 세션으로 호출, 내부적으로 서버측 상승 권한(service-role)이 단일 `prisma.$transaction`으로 데모 `Municipality`+`Contractor`(`isDemo=true`, `demoExpiresAt`)+`CONTRACTOR_ADMIN` 계정을 원자적으로 생성. **딜러에게 SUPER_ADMIN 랭크는 절대 부여하지 않음**
- [ ] **P7** 데모 시딩: 3~6개월치 현실적 샘플 데이터(민원/근태/차량일지 등) 1회 작성 후 모든 데모 테넌트가 재사용
- [ ] **P8** 데모 정리: `POST /api/cron/demo-cleanup` — 기존 `/api/cron/gps-cleanup` 인증 패턴(`Authorization: Bearer $CRON_SECRET`, timingSafeEqual) 재사용, `isDemo=true AND demoExpiresAt < now()` 대상만 자식→부모 역순 `deleteMany`를 단일 트랜잭션으로 실행 (FK cascade 미설정 대응)
- [ ] **P9** 데모 세션 전용 처리: JWT에 `scope:"demo"` 클레임 + 짧은 TTL(30~60분, 기존 8h 대비), 데모 스코프에서 SMS/알림톡(`lib/sms.ts`) 실제 발송 no-op 처리

### 2.3 Out of Scope
| 항목 | 분류 | 근거 |
|------|------|------|
| 기존 4개 role(MUNI_ADMIN/CONTRACTOR_ADMIN/INTERNAL_ADMIN/WORKER) 정의·권한·UI 변경 | 절대 금지 | 사용자 명시적 제약 |
| 딜러 셀프 회원가입 | 제외 | 기존 "SUPER만 발급" 원칙 유지, DEALER 계정도 SUPER_ADMIN이 발급 |
| 커미션 자동 계산·지급 UI | Phase 2 | 이번 Plan은 컬럼 자리 예약까지만 |
| SUPER_ADMIN 콘솔 물리적 분리(별도 앱/도메인) | Phase 2+ | 딜러가 본인 정산을 직접 로그인해서 봐야 하는 시점에 트리거. 현재 `app/(admin)/super-admin/` route group 분리로 논리적 준비는 이미 충족됨 |
| `tenantPrisma`(`lib/prisma-tenant.ts`) 배선 | 별도 기술부채 | 현재 0곳에서 import되는 미배선 상태 확인됨 — 이번 Plan과 무관, 별도 트래킹 권장 |

---

## 3. Functional Requirements

| ID | 요구사항 | Priority |
|----|----------|----------|
| FR-01 | `Role` enum에 `DEALER` 추가. 기존 5개 값 순서·의미 무변경 | Must |
| FR-02 | `Lead` 모델: `id, dealerId(FK→User), prospectName, prospectContact, referralCode(unique), status(PENDING/APPROVED/REJECTED), memo, createdAt, reviewedAt, reviewedBy` | Must |
| FR-03 | `POST /api/dealer/leads` — DEALER 전용, 본인 dealerId로 Lead 생성 | Must |
| FR-04 | `GET /api/dealer/leads` — DEALER는 본인 리드만 조회(`where: {dealerId: session.userId}`) | Must |
| FR-05 | `PATCH /api/super-admin/leads/[id]/approve` — SUPER_ADMIN 전용. 승인 시 Lead 데이터로 기존 `/api/super-admin/municipalities`→`/api/contractors`→`/api/users`→`/api/super-admin/muni-policies` 체인을 서버측에서 순차 호출, 최종 `Contractor.dealerId = lead.dealerId` 스탬프 | Must |
| FR-06 | `Contractor.dealerId`(nullable FK, `Municipality.createdBy`와 동일 패턴) 추가 | Must |
| FR-07 | `DealerCommission` 모델(`id, dealerId, contractorId, commissionRate, ledgerEntries` — 컬럼만, API/UI 없음) | Should |
| FR-08 | `POST /api/dealer/demo-provision` — DEALER 전용. 단일 `prisma.$transaction`으로 데모 Municipality+Contractor(`isDemo=true`, `demoExpiresAt = now()+14d`)+CONTRACTOR_ADMIN 계정 생성. 딜러당 활성 데모 쿼터(예: 3개) 초과 시 409 | Must |
| FR-09 | 데모 테넌트는 사전 시딩 스크립트로 3~6개월치 샘플 데이터 자동 채움 (1회 작성, 모든 데모가 재사용) | Must |
| FR-10 | `POST /api/cron/demo-cleanup` — 기존 cron 인증 패턴 재사용, 만료 데모를 자식→부모 역순 `deleteMany` 단일 트랜잭션으로 하드 삭제, dryRun 옵션 지원 | Must |
| FR-11 | 데모 세션 JWT에 `scope:"demo"` 클레임 + TTL 30~60분 | Must |
| FR-12 | 데모 스코프(`isDemo=true` 테넌트)에서 SMS/알림톡 발송 함수는 실제 전송 대신 no-op + 로그만 기록 | Must |
| FR-13 | `MODULE_ACCESS`에 DEALER용 화이트리스트(`lead.create`, `lead.read.own`, `demo.provision`)만 추가 — 기존 4개 role 항목 무수정 | Must |

---

## 4. Non-Functional Requirements

| Category | 기준 | 측정 방법 |
|----------|------|-----------|
| Security | DEALER role은 어떤 경로로도 SUPER_ADMIN 전용 mutate(`municipality.manage`/`contractor.manage`)를 호출할 수 없음 | 역할별 접근 시도 테스트 |
| Security | 데모 테넌트 데이터가 실제 프로덕션 지자체/위탁업체 조회 결과에 노출되지 않음 (`isDemo=true` 제외 또는 별도 라벨) | 통계/리포트 쿼리 검증 |
| Security | 데모 세션 탈취 시에도 접근 범위가 해당 데모 Contractor로 제한됨 (SUPER_ADMIN 랭크 미부여 확인) | JWT 클레임 검사 |
| Data Integrity | 데모 정리 시 FK 위반 0건 (자식→부모 역순 삭제 순서를 공유 상수로 관리) | cleanup 트랜잭션 dryRun 검증 |
| Regression | 기존 4개 role의 기능·권한·UI 회귀 0건 | 기존 회귀 테스트 스위트(a11y/visual-regression/mobile-responsive/login-flow) 통과 |
| Performance | 데모 프로비저닝 API 응답 < 5초 | API 응답시간 측정 |

---

## 5. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 데모 계정이 실수로 SUPER_ADMIN 랭크를 받아 전체 데이터 무필터 노출 | High | Low | `demo-provision` 라우트에서 역할을 `CONTRACTOR_ADMIN`으로 하드코딩, SUPER_ADMIN 부여 코드 경로 자체를 만들지 않음 |
| 자유입력 데모에 실제 개인정보(민원인 실명·전화번호) 유입 | Medium | Medium | 주기적 wipe+reseed(기존 cron 패턴), 데모 스코프 SMS/알림톡 no-op 처리로 외부 유출 차단 |
| 딜러 리드 남발로 SUPER_ADMIN 승인 큐 폭주 | Medium | Medium | 딜러당 pending 리드 상한 설정(후속 Design 단계에서 수치 확정) |
| 데모 정리 시 FK cascade 미설정으로 고아 레코드/삭제 실패 | Medium | Medium | 자식→부모 역순 `deleteMany`를 단일 트랜잭션으로, 삭제 대상 테이블 목록을 공유 상수로 관리(프로비저닝·클린업 양쪽에서 참조) |
| 승인 체인이 순차 API 호출이라 중간 실패 시 고아 레코드(리드 승인 경로) | Medium | Low | 승인 라우트도 데모 프로비저닝과 동일하게 단일 트랜잭션으로 재작성 검토 (Design 단계 결정) |
| DEALER role 추가로 `Role` enum 변경 → Prisma 마이그레이션 필요 | Low | High(확정) | enum 값 추가는 기존 값 순서·의미 무변경이라 논브레이킹. 마이그레이션 사전 스테이징 검증 |

---

## 6. Dependencies

### 6.1 내부 선행 의존성
| 선행 항목 | 후행 항목 | 이유 |
|-----------|-----------|------|
| FR-01 (Role.DEALER 추가) | FR-03, FR-08 (딜러 전용 API) | 역할 없이는 인증/인가 불가 |
| FR-06 (Contractor.dealerId) | FR-05 (승인 시 스탬프) | 컬럼 없이는 귀속 불가 |
| FR-09 (데모 시딩 스크립트) | FR-08 (데모 프로비저닝) | 시딩 로직 없이는 빈 데모만 생성됨 |

### 6.2 외부 의존성
| 항목 | 현황 | 비고 |
|------|------|------|
| `/api/cron/gps-cleanup` 인증 패턴 | 기존 존재 | `Authorization: Bearer $CRON_SECRET` + timingSafeEqual — FR-10에 그대로 재사용 |
| 외부 스케줄러(K8s CronJob/GitHub Actions) | 기존 존재 | demo-cleanup 라우트 등록만 추가 |

### 6.3 회귀 테스트 영역
| 영역 | 검증 항목 |
|------|-----------|
| RBAC | 기존 4개 role 권한 매트릭스 전체 재검증 |
| 지자체/위탁업체 생성 | 기존 SUPER_ADMIN 온보딩 마법사 플로우 회귀 없음 |
| SMS/알림톡 | 실제(비데모) 테넌트에서 정상 발송 유지 확인 |

---

## 7. Architecture Decisions

### 7.1 Open Questions (Design 단계에서 확정)
| # | 질문 | 현재 방향 |
|---|------|-----------|
| Q1 | 딜러당 pending 리드 상한 수치 | Design에서 확정 (기본값 제안 필요) |
| Q2 | 승인 체인을 트랜잭션으로 재작성할지, 기존 순차 API 유지할지 | Design에서 결정 — 데모 프로비저닝과 일관성 위해 트랜잭션 권장 |
| Q3 | 데모 만료 기간(TTL) 기본값 | 제안 14일 — Design에서 확정 |
| Q4 | 데모 자유입력 범위(어떤 모듈까지 허용할지) | Design에서 모듈별 화이트리스트 확정 |

### 7.2 기술 결정
| 결정 항목 | 선택 | 근거 |
|-----------|------|------|
| Role 확장 방식 | enum에 `DEALER` 추가(additive) | 기존 랭크 체계·4개 role 무수정 |
| 데모 격리 방식 | `isDemo` 플래그 + 기존 contractorId/municipalityId FK 스코핑 재사용 | 신규 격리 메커니즘 불필요, 기존 130개 route의 세션 스코핑 그대로 적용 |
| 데모 발급 권한 | 딜러 셀프서비스(SUPER_ADMIN 승인 게이트 없음) | 실계정 발급과 다른 트랙 — 영업 속도 유지 |
| 데모 정리 | 기존 cron 패턴 재사용, pg_cron 미도입 | 이미 검증된 인프라 재사용, 신규 의존성 없음 |
| 커미션 정산 명명 | `DealerCommission` (기존 "정산"과 구분) | 지자체-위탁업체 원가정산과 용어 충돌 방지 |

---

## 8. Next Steps
1. [ ] Design 문서 작성 (`dealer-channel.design.md`) — Open Questions Q1~Q4 확정, ERD, API 상세 스펙
2. [ ] Prisma 마이그레이션 스테이징 검증
3. [ ] SUPER_ADMIN(1인 개발자) 리뷰·승인

---

## Version History
| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-07-06 | 최초 작성 — 에이전트 팀 상담(아키텍처/보안/영업전략) 종합 | 4365won@gmail.com |
