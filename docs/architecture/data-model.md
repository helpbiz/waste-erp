# 🗄 CleanERP 데이터 모델 (Prisma)

> 주요 테이블 + 관계 + 인덱스 요약. 단일 진실 소스는 `prisma/schema.prisma`.
> 마지막 갱신: 2026-05-02

---

## 🌳 다중 테넌트 트리

```
Municipality (지자체)
  └── Contractor (위탁업체) — soft-delete 30일
        ├── User (관리자/근로자)
        │     └── Position (직책 — RAPID = 기동반)
        │     └── Department (부서 트리)
        ├── CleaningZone
        │     └── AdminDong (행정동)
        ├── Vehicle / VehicleLog
        ├── AttendanceRecord
        ├── Complaint
        ├── SafetyReport / TbmSession / HealthRecord
        ├── WasteTreatmentRecord / RecyclingCenterIntake
        ├── ContractorFeature ⭐ (회사별 기능 권한)
        └── BulkyWasteConfig / LiveTrackingConfig / ApprovalPolicy
```

---

## 🔑 핵심 테이블

### `users` (User)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | BigInt PK | |
| contractorId | BigInt? | 회사 (CONTRACTOR/INTERNAL/WORKER) |
| municipalityId | BigInt? | MUNI_ADMIN 만 |
| username | unique | 로그인 ID |
| role | enum | SUPER_ADMIN / MUNI_ADMIN / CONTRACTOR_ADMIN / INTERNAL_ADMIN / WORKER |
| status | enum | ACTIVE / INACTIVE / PENDING |
| failedLoginAttempts / lockedUntil | | 계정 잠금 (5회/10분) |
| privacyConsentAt | DateTime? | 개인정보 동의 — 미진행 시 모든 화면 차단 |
| positionId | BigInt? | RAPID 등 직책 |

### `contractors` (Contractor)
| 컬럼 | 설명 |
|---|---|
| id, companyName, businessNo (unique), municipalityId | |
| ceoName, phoneMain, emailMain | 회사 정보 |
| garageAddress, garageLat, garageLng | 차고지 (추천경로 시작점) |
| deletedAt | soft-delete (30일 후 cron 정리) |

### `complaints` (Complaint)
| 컬럼 | 설명 |
|---|---|
| id, contractorId, reportedBy?, citizenPhone? | 신고자 식별 |
| type | enum: PICKUP_MISS / ILLEGAL_DUMP / ODOR_NOISE / BULKY_WASTE / OTHER |
| locationLat, locationLng, locationAddress, zoneId | 발생 위치 |
| status | enum: RECEIVED / ASSIGNED / IN_PROGRESS / COMPLETED / REJECTED |
| assignedTo, dueDate | 배정 |
| departedAt, arrivedAt, resolvedAt | KPI 트래킹 |
| satisfactionScore (1-5), satisfactionComment | 시민 평가 |
| photosBefore Json?, photosAfter Json?, requestImage, completionImage | 사진 |

### `announcements` (Announcement)
| 컬럼 | 설명 |
|---|---|
| id, title, body, severity (INFO/WARNING/CRITICAL) | |
| audience | ALL / OWNER / ADMIN / WORKER / MUNI |
| contractorId? | NULL = 시스템 또는 지자체 broadcast |
| municipalityId? | NULL = 회사 한정 또는 시스템 |
| **targetUserId?** | per-user targeting (AI 인근 추천) |
| pinned, publishedAt, expiresAt | |
| createdBy | 작성자 userId |

### `attendance_records` (AttendanceRecord)
| 컬럼 | 설명 |
|---|---|
| id, workerId, contractorId, workDate | unique(workerId, workDate) |
| checkInTime, checkOutTime | |
| checkInLat, checkInLng, checkOutLat, checkOutLng | attendanceGps OFF 시 NULL |
| zoneId, workType | |
| status | PENDING / APPROVED / REJECTED |

### `vehicles` (Vehicle) / `vehicle_logs` (VehicleLog)
- 차량 마스터 + 일별 운행일지 (driver/passenger1/passenger2 / mileage / fuel / waste / route)

### `cleaning_zones` (CleaningZone) + `admin_dongs` (AdminDong)
- 청소 구역 마스터 + 행정동 매핑 (AI 인근 추천에서 동명 → zoneId 추정)

---

## 🆕 본 세션 신규 테이블

### `contractor_features` (ContractorFeature)
| 컬럼 | 설명 |
|---|---|
| contractorId × featureKey | unique |
| enabled | boolean |
| config Json? | 향후 확장 |
| updatedBy, updatedAt, createdAt | |

**카탈로그 기본**: row 미존재 → `lib/features.ts` 의 defaultEnabled (모두 true)
**onDelete: Cascade** — 회사 hard-delete 시 자동 정리

### `web_push_subscriptions` (WebPushSubscription)
| 컬럼 | 설명 |
|---|---|
| userId, endpoint (unique), p256dh, auth | |
| userAgent, lastUsedAt | |

한 사용자가 여러 디바이스/브라우저에서 구독 가능. endpoint 가 unique.

### `Announcement.targetUserId` 컬럼 추가
- AI 인근 추천 등 per-user targeting 알림에 사용
- NULL = 일반 broadcast (audience+scope 기반)

---

## 🛡 보안 / 컴플라이언스 컬럼

### PIPA (개인정보보호법)
- 모든 GPS 좌표 (`AttendanceRecord.checkIn/OutLat/Lng`, `Complaint.locationLat/Lng`) → **`lib/geo.ts roundCoord()` 로 ~10m 격자 라운딩 후 저장**
- `cron/gps-cleanup` 매일 — 90일 경과 GPS 좌표 NULL 처리

### Soft-Delete (Contractor)
- `deletedAt` 설정 시 휴지통 → 30일 후 cron 정리
- 슈퍼관리자 콘솔 `🗑 위탁업체 삭제·복구` 에서 복원 가능

### Audit Log (`audit_log`)
| 컬럼 | 설명 |
|---|---|
| actorId, actorRole | 행위자 |
| action | ANNOUNCEMENT_CREATE / CONTRACTOR_FEATURE_TOGGLE / CONTRACTOR_PACKAGE_APPLY / ATTENDANCE_CHECK_IN 등 |
| resourceType, resourceId | 대상 |
| contractorId, municipalityId | 다중 테넌트 forensic |
| metadata Json? | 자유 필드 |
| ipAddress, userAgent | request 정보 |

### Append-Only (`attendance_adjustments`)
- 운영 마이그레이션: `REVOKE UPDATE, DELETE ON attendance_adjustments FROM app_user;`
- prevHash/thisHash SHA-256 체인 무결성 (security-architect 권고)

---

## 🔗 주요 인덱스

```
@@index([municipalityId])                            contractors
@@index([contractorId])                              users / cleaning_zones / admin_dongs / ...
@@index([contractorId, workDate])                    attendance_records
@@index([publishedAt])                               announcements
@@index([audience, publishedAt])                     announcements
@@index([contractorId, publishedAt])                 announcements
@@index([targetUserId])                              announcements ← 본 세션 추가
@@index([contractorId])                              contractor_features
@@index([userId])                                    web_push_subscriptions
```

---

## 📋 enum 카탈로그

| Enum | 값 |
|---|---|
| Role | SUPER_ADMIN / MUNI_ADMIN / CONTRACTOR_ADMIN / INTERNAL_ADMIN / WORKER |
| UserStatus | ACTIVE / INACTIVE / PENDING |
| ComplaintType | PICKUP_MISS / ILLEGAL_DUMP / ODOR_NOISE / BULKY_WASTE / OTHER |
| ComplaintStatus | RECEIVED / ASSIGNED / IN_PROGRESS / COMPLETED / REJECTED |
| WorkType | NORMAL / OVERTIME / NIGHT / HOLIDAY |
| AttendanceStatus | PENDING / APPROVED / REJECTED |
| ZoneType | GENERAL / FOOD / RECYCLING / BULKY |
| VehicleType / VehicleStatus / VehicleLogStatus / CostStatus | (도메인별) |

---

## 🛠 마이그레이션 절차

본 프로젝트는 `prisma migrate` 미사용 → `prisma db push`.

### 일반 변경
```bash
# schema.prisma 수정 후
DATABASE_URL="postgresql://cleanerp:PASS@localhost:5434/cleanerp_prod?schema=public" \
  npx prisma db push --skip-generate --accept-data-loss
npx prisma generate
```

### 본 세션 누적 마이그레이션 (3회)
1. `ContractorFeature` 테이블 + `Contractor.features` relation
2. `Announcement.targetUserId` + index
3. `WebPushSubscription` 테이블

---

## 💡 변경 정책

- **컬럼 추가**: schema 수정 → `db push` → `architecture/data-model.md` 갱신 → session log
- **테이블 추가**: schema → `db push` → `architecture/feature-catalog.md` 에 모델 매핑 기록
- **enum 변경**: 기존 row 호환성 검토 후 `db push --accept-data-loss`
