# 2026-05-02 세션 작업 기록

> CleanERP 운영 — 공지 음성 알림(TTS), 기동반 자동배정, AI 인근 워커 추천, 회사별 기능 권한(엔타이틀먼트) 도입.

---

## Executive Summary

| 영역 | 변경 | 결과 |
|---|---|---|
| 워커 민원 처리 UI | InboxPanel + WORKER 가시범위 OR 확장 | 기동반이 자기 배정 민원을 보고 처리 시작/도착/완료/반려 |
| 라벨 정리 | 등록 폼 라벨 정정 | "처리 내용" → "신고 내용" (등록 ≠ 처리 명확화) |
| 공지 음성 알림 | TTS + 남/여 voice 설정 | reporter role 기반 메시지 자동 분기 + localStorage 선호 |
| 민원 음성 알림 | ComplaintBanner 신규 | 30s 폴링 + 첫 fetch 음소거 + 신규 감지 시 사운드+진동+TTS |
| 자동 배정 | lib/complaint-assign.ts | 기동반 우선 + 부하·거리·zone 점수로 best 1명 자동 배정 |
| AI 인근 추천 | 주소 인식 + 거리 계산 | 동(洞)→AdminDong→zone 매칭 / 출퇴근 GPS Haversine ≤2km |
| 회사별 기능 권한 | ContractorFeature + UI | 슈퍼관리자가 회사마다 기능 ON/OFF |

---

## 1. 워커 민원 처리 UI (InboxPanel)

### 문제
- 기동반에 배정된 민원을 워커가 못 보던 버그.
- `/worker/complaint` 가 등록(POST) 전용. 처리 액션 부재.

### 진단
- `lib/complaints.ts complaintWhere(WORKER)` 가 `reportedBy = self` 만 노출.
- 기동반은 본인이 신고한 게 아니라 배정된 민원을 처리 → 항상 빈 목록.

### 수정
1. **lib/complaints.ts** — WORKER scope OR 확장
   ```ts
   if (session.role === 'WORKER') {
     return {
       OR: [
         { reportedBy: BigInt(session.userId) },
         { assignedTo: BigInt(session.userId) },
       ],
     };
   }
   ```
2. **app/worker/complaint/_complaint-client.tsx** — 탭 구조 도입
   - `tab: 'inbox' | 'register'` state
   - 📥 내 민원 / ✏ 신규 등록 토글
   - InboxPanel — 활성/완료/전체 필터, 처리 시작/도착 확인/처리 완료/반려 액션
   - CompleteModal — 처리 메모 + 반려 사유(필수)

### 라벨 정정
- 등록 폼의 "처리 내용 (선택)" → "신고 내용 (선택)" (Section label + placeholder)
- InboxPanel CompleteModal 의 "처리 내용" 은 실제 처리 메모이므로 유지

### Commits
- `55dfbf8` feat(worker): 기동반 민원처리 UI — InboxPanel + 가시범위 버그 수정
- `df3d5c1` fix(worker): 민원 등록 탭 라벨 '처리 내용' → '신고 내용'

---

## 2. 공지 / 민원 음성 알림 (TTS)

### 요구사항
- 신규 공지 도착 시 진동만 → 음성 안내 추가:
  - "회사에서 공지사항이 도착했습니다." / "지자체에서 공지사항이 도착했습니다."
- 신규 민원 접수 시:
  - "회사에서 새로운 민원이 접수되었습니다." / "지자체에서 새로운 민원이 접수되었습니다."
- 사용자가 설정에서 남/여 voice 선택 가능

### 설계 결정
- **Web Speech API (SpeechSynthesis)** 채택
  - 브라우저 native, 외부 TTS 서비스/API 키 불필요
  - 한국어 voice 시스템 의존(Android Google TTS, iOS Yuna 등)
  - voice 미지원 환경에서도 pitch 보정으로 톤 차이 흉내(여성 1.15 / 남성 0.85)
- 사전 생성 audio 파일은 사용 안 함 — 시스템에 한국어 TTS 엔진이 없을 때 espeak 등 fallback 부재(Korean unsupported)

### 구현
1. **lib/voice-settings.ts** (신규)
   - `loadVoiceSettings()/saveVoiceSettings()` — localStorage `cleanerp:voice-settings:v1`
   - `enabled / gender(male|female) / voiceURI`
   - `pickVoice(settings)` — 명시 voiceURI 우선, gender 추정 매칭, fallback first ko voice
   - `speakAnnouncement(authorRole, settings)` / `speakComplaintArrival(reporterRole, settings)`
   - `announcementSpeechText()` / `complaintSpeechText()` — role 기반 메시지 분기

2. **components/VoiceSettingsModal.tsx** (신규)
   - ON/OFF 토글
   - 👩 여성 / 👨 남성 카드 토글
   - 시스템 한국어 voice 명시 선택(옵션, 자동 감지된 voice 목록)
   - ▶ 미리듣기 4종 (공지·민원 × 회사·지자체)

3. **API 응답 보강**
   - `GET /api/announcements`: `authorRole` 추가 (User.role)
   - `GET /api/complaints`: `reporter.role` 추가

4. **components/AnnouncementBanner.tsx**
   - 신규 공지 감지 시 `speakAnnouncement(top.authorRole, settings)`
   - 첫 fetch + 미확인 공지 있을 때 1.2초 후 speak (사용자 인터랙션 직후 발화 보장)
   - 팝업 헤더에 `🔊 음성` 버튼 → VoiceSettingsModal

5. **components/ComplaintBanner.tsx** (신규)
   - 30s 폴링 `/api/complaints?limit=30`
   - 첫 fetch 학습 단계 음소거(기존 항목 모두 seen)
   - 신규 ID 감지 시 사운드 + 진동(150-80-150) + TTS + OS Notification
   - admin shell + worker shell 양쪽에 마운트

6. **app/(admin)/announcements/_announcements-client.tsx**
   - 헤더에 `🔊 음성 설정` 버튼 추가

### 모바일 발화 제약
- iOS Safari 등은 첫 발화가 사용자 클릭 후에만 동작
- 첫 mount 시 1.2초 지연 + 미리듣기는 항상 클릭 컨텍스트 → 안전

### Commits
- `dc423f7` feat(announcements): TTS 음성 알림 + 남/여 설정
- `27c62c8` feat(complaint): 신규 민원 TTS + 기동반 자동배정 + AI 인근 워커 broadcast

---

## 3. 기동반 자동 배정 + AI 인근 워커 추천

### 요구사항
- 민원이 접수되면 자동으로 기동반 작업자에게 배정
- AI 가 주소를 인식해서 인근 작업자에게도 전달

### 알고리즘 설계
**Phase A — Primary 배정**
1. 같은 contractor 의 ACTIVE WORKER 후보 수집 (`include position.code`)
2. RAPID(기동반) pool 우선 → 비어 있으면 일반 WORKER fallback
3. 점수 = `activeLoad × 10 + distanceKm × 5 - (zone 일치 ? 8 : 0)`
   - distance 모를 때 +10 페널티
4. 최저 score 1 명 → `assignedTo` + `status='ASSIGNED'`

**Phase B — AI 인근 추천**
- 위경도 있으면: 최근 30일 `AttendanceRecord.checkInLat/Lng` → Haversine 거리
- 주소만 있으면: `(\S+동)` 정규식 → `AdminDong.dongName` 매칭 → `zoneId`
- 두 조건(`distance ≤ 2km` OR `zone 일치`) 합집합 → primary 제외, 거리 ASC top5
- audience='WORKER' contractor 한정 Announcement 1건 자동 생성 (6시간 expire)
  - body 에 주 배정자 + AI 추천 워커 명단·거리
  - 기존 AnnouncementBanner 가 자동 픽업 → TTS·진동·팝업

### 데이터 의존성 (knwon limitations)
- **AttendanceRecord.checkInLat/Lng**: 출퇴근 GPS 미수집 contractor → distance 미계산, score 패널티만
- **AdminDong.dongName**: 행정동 마스터 비어 있는 contractor → zone 매칭 불가
- Best-effort 설계 — autoAssign 실패 시 RECEIVED 유지(관리자 수동 배정)

### 구현
- **lib/complaint-assign.ts** (신규) — `autoAssignComplaint()`
- **app/api/complaints POST** — `create()` 직후 best-effort 호출, 응답 `assignment` 메타 포함
- 응답 status: 자동 배정 성공 시 `'ASSIGNED'` 반환 (DB 와 동기)

---

## 4. 회사별 기능 권한 (ContractorFeature)

> 사용자 요청: "별도 슈퍼관리자가 회사마다 기능을 선택사항을 부여할 수 있도록 하자"

### 동기
SaaS 다중 테넌트 구조에서 contractor 별로 활성/비활성할 기능이 점차 늘어남:
- 공지사항 시스템 자체
- 음성 알림(TTS)
- 자동 배정
- AI 인근 추천
- 추천 경로(기동반 전용)
- 차량 실시간 위치, 원가 계산 등

기능별 ON/OFF 를 슈퍼관리자가 회사마다 설정할 수 있어야 영업 단계의 패키지화·요금제 차등이 가능.

### 모델
```prisma
model ContractorFeature {
  id           BigInt   @id @default(autoincrement())
  contractorId BigInt   @map("contractor_id")
  featureKey   String   @map("feature_key") @db.VarChar(50)
  enabled      Boolean  @default(true)
  config       Json?
  updatedAt    DateTime @updatedAt @map("updated_at")
  updatedBy    BigInt?  @map("updated_by")
  createdAt    DateTime @default(now()) @map("created_at")

  contractor   Contractor @relation(fields: [contractorId], references: [id])
  @@unique([contractorId, featureKey])
}
```

### 기능 카탈로그 (lib/features.ts)
| key | 라벨 | 기본값 | 영향 |
|---|---|---|---|
| `announcements` | 공지사항 시스템 | ON | POST/GET /api/announcements 사용 |
| `voiceTts` | 음성 알림(TTS) | ON | Announcement/Complaint Banner 발화 |
| `complaintAutoAssign` | 민원 자동 배정 | ON | autoAssignComplaint 실행 |
| `aiNearbyDispatch` | AI 인근 워커 추천 | ON | 인근 broadcast Announcement 생성 |
| `recommendedRoute` | 기동반 추천 경로 | ON | /worker/route 메뉴 표시 |
| `costCalculation` | 원가 계산 | ON | /admin/cost 등 |
| `vehicleTracking` | 차량 실시간 위치 | ON | /live-vehicles |
| `attendanceGps` | 출퇴근 GPS | ON | check-in 위치 검증 |

기본값: 마이그레이션 시점 기존 contractor 는 row 미생성 → `hasFeature()` 가 카탈로그 기본값(true) 반환 → 기존 동작 보존.

### API
- `GET  /api/super-admin/contractor-features?contractorId=` — 회사별 현재 상태(미생성 row 는 default 기준 채워서 반환)
- `PATCH /api/super-admin/contractor-features` — body: `{ contractorId, featureKey, enabled }` upsert

### UI
- 슈퍼관리자 콘솔 신규 탭: `🎛 회사별 기능 권한`
- 좌측 회사 리스트(검색) → 우측 기능 매트릭스(체크박스) → 즉시 저장
- 비활성 기능: 라벨 회색 + 변경 시점 + 변경자 표시
- 현장 즉시 적용(서버 측 hasFeature 체크 통과)

### 게이트 적용 (1차 — 신규/금번 추가 기능)
- `POST /api/announcements` → `announcements` 비활성 시 403
- `POST /api/complaints` (자동 배정 단계) → `complaintAutoAssign` 비활성 시 skip
- 자동 배정 내부 → `aiNearbyDispatch` 비활성 시 broadcast Announcement 미생성

### 게이트 미적용 (점진 도입 예정)
- `recommendedRoute`, `vehicleTracking`, `attendanceGps`, `costCalculation` 등은 후속 PR 에서 점진 적용

---

## 5. 운영 메모

### Service Worker 캐시
- v50 (2026-05-02 announcement-role-clarify)
- v51 (worker-inbox)
- v52 (worker-report-label)
- v53 (announcement-voice-tts)
- v54 (complaint-tts-autoassign)
- v55 (contractor-features) — 본 세션 마지막

### 배포 플로우 (변동 없음)
```bash
git add -A && git commit -m "..." && git push origin main
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app
```

### 다음 세션 후보
1. 회사별 기능 게이트 점진 적용 (recommendedRoute, vehicleTracking 등)
2. 클라이언트 사이드 기능 게이트 — `/api/me/features` 엔드포인트로 sidebar 메뉴 항목 자체 숨김
3. ContractorFeature 변경 audit 로그
4. 슈퍼관리자 콘솔 — 회사별 기능 일괄 복사(template) 기능
5. 기능 비활성 시 사용자 친화적 안내 페이지(403 대신)

---

## 6. Files Touched (본 세션 누적)

```
lib/complaints.ts                                        +6  -2
lib/voice-settings.ts                                    NEW
lib/complaint-assign.ts                                  NEW
lib/features.ts                                          NEW
components/AnnouncementBanner.tsx                        +18 -3
components/VoiceSettingsModal.tsx                        NEW
components/ComplaintBanner.tsx                           NEW
app/worker/complaint/_complaint-client.tsx               +259 -3
app/api/announcements/route.ts                           +2
app/api/complaints/route.ts                              +20 -2
app/api/super-admin/contractor-features/route.ts         NEW
app/(admin)/announcements/_announcements-client.tsx      +12
app/(admin)/super-admin/_super-admin-client.tsx          +N
app/(admin)/_admin-shell.tsx                             +3
app/worker/_layout-shell.tsx                             +3
prisma/schema.prisma                                     +18
public/sw.js                                             v50→v55
docs/04-report/2026-05-02-session-log.md                 NEW (this file)
```
