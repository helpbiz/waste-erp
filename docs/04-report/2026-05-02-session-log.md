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
| 회귀 수정 | /worker/complaint 기본 탭 'inbox' → 'register' | 첫 진입 시 지도 즉시 표시 |
| 글로벌 알림 마운트 | AnnouncementBanner+ComplaintBanner → root layout | shell 외부 화면(/noc 등)도 자동 팝업 |
| 공지 audience 정책 | role-based 옵션 + MUNI 작성권 + OWNER audience 추가 | 회사는 [관리자/근로자/전체], 지자체는 [회사대표/회사+관리자/전체] |
| AI 인근 추천 정밀화 | Announcement.targetUserId per-user targeting | 인근 워커 N명 개별 알림 → 진짜 인근만 수신 |
| 요금제 패키지 | TRIAL/BASIC/STANDARD/PRO 4-tier + 일괄 적용 | 슈퍼관리자가 회사에 패키지 1클릭 적용 |
| 게이트 점진 적용 | 4개 페이지/API 차단 + 친화 안내 페이지 | recommendedRoute / vehicleTracking / costCalculation / attendanceGps |
| 클라이언트 게이트 | sidebar 메뉴 동적 필터 + /api/me/features | feature OFF 시 메뉴 자체 미노출 |
| WebPush 인프라 | WebPushSubscription + SW push handler + subscriber | 백그라운드 푸시 수신 가능 (VAPID 키 설정 후 활성) |
| inbox 카운트 뱃지 | /worker/complaint 탭에 활성 N건 뱃지 | RAPID 워커 본인 배정건 즉시 인지 |

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

## 5. 회귀 진단 및 수정 — /worker/complaint 지도 비표시

### 사용자 신고
> "민원 관련 지도가 안 올라와"

### 진단
- §1 InboxPanel 도입 시 `/worker/complaint` 기본 탭을 `'inbox'` 로 두었음.
- inbox 탭은 자기 배정 민원 목록 — 지도 없음.
- 첫 진입 시 사용자가 등록 폼(+지도)이 안 보이는 것을 "지도 비표시" 회귀로 인식.

### 검증 (지도 자체는 정상)
- `LocationPickerMap` (CartoDB Positron CDN) 코드·CSP·타일 호출 모두 OK
- `curl https://a.basemaps.cartocdn.com/light_all/16/...` → 200, PNG 정상 응답
- `next.config.js` CSP `img-src` 에 `*.basemaps.cartocdn.com` 이미 허용됨
- `ResizeFix` (100/300/600/1000ms 다단계 invalidateSize) 정상 동작

### 수정
```ts
// app/worker/complaint/_complaint-client.tsx
- const [tab, setTab] = useState<'inbox' | 'register'>('inbox');
+ const [tab, setTab] = useState<'inbox' | 'register'>('register');
```

### 결정 근거
- 일반 워커의 주 행동은 등록(신고) — 지도 즉시 가시 우선.
- RAPID(기동반) 워커는 `📥 내 민원` 탭을 명시 클릭하여 배정 목록 확인.
- 자동화된 해결은 부하: 둘 다 보여주려면 split view 가 필요한데 모바일 ≤ 5인치 폭 제약.

### Commit
- `23b5f40` fix(worker): /worker/complaint 기본 탭 → 'register' (지도 즉시 가시)

---

## 6.1 글로벌 알림 마운트 — 모든 화면에서 자동 팝업

### 사용자 요구사항
> "공지사항이 도착하면 앱이나 웹 어떤 화면을 보고있던 자동으로 팝업 노출"

### 변경
- `components/GlobalNotifications.tsx` (신규) — `AnnouncementBanner` + `ComplaintBanner` wrapper
- `app/layout.tsx` — `<GlobalNotifications />` 추가 (root level mount)
- `app/(admin)/_admin-shell.tsx` / `app/worker/_layout-shell.tsx` — 중복 마운트 제거

### 효과
- shell 외부 화면(`/noc`, `/citizen`, `/intro`, `/reset`) 에서도 동일 팝업 노출
- 비로그인 화면(`/login`) 은 `/api/announcements` 401 → silent no-op
- 폴링 1회 통합 (이전: admin/worker shell 마운트 + 페이지 전환 시 재마운트)

### Commit
- `f59c340` feat(notifications): 공지/민원 자동 팝업 — 모든 화면 글로벌 마운트

---

## 6.2 공지 audience 정책 — 작성자 role 기반

### 사용자 요구사항
> "위탁업체가 작성할 때는 관리자, 근로자, 전체만 대상으로 하고 지자체관리자는
>  공지대상에서 절대로 제외하자. 지자체관리자가 작성할 때에는 회사, 회사+관리자,
>  작업자 포함 전체로 구분해서 사용할 수 있도록 하자."

### audience 카탈로그 확장
| Value | Label | Visible to |
|---|---|---|
| `ALL` | 전체 (작업자 포함) | 누구나 |
| `OWNER` | 회사 대표만 | CONTRACTOR_ADMIN |
| `ADMIN` | 회사 + 관리자 | CONTRACTOR_ADMIN + INTERNAL_ADMIN |
| `WORKER` | 근로자만 | WORKER |
| `MUNI` | 지자체 담당자 | MUNI_ADMIN |

`OWNER` 신규 추가. 기존 ALL/ADMIN/WORKER/MUNI 유지.

### 작성자 role 별 선택 가능 audience (UI 드롭다운)
| 작성자 role | 옵션 |
|---|---|
| SUPER_ADMIN | ALL, OWNER, ADMIN, WORKER, MUNI |
| CONTRACTOR_ADMIN | ADMIN, WORKER, ALL ⚠ **MUNI 제외** |
| INTERNAL_ADMIN | ADMIN, WORKER, ALL ⚠ **MUNI 제외** |
| MUNI_ADMIN | OWNER, ADMIN, ALL |

### 뷰어 role 별 가시 audience
| 뷰어 role | 보이는 audience |
|---|---|
| SUPER_ADMIN | 전체 |
| CONTRACTOR_ADMIN | ALL, OWNER, ADMIN |
| INTERNAL_ADMIN | ALL, ADMIN |
| WORKER | ALL, WORKER |
| MUNI_ADMIN | ALL, MUNI |

### 신규 권한
- **MUNI_ADMIN 의 공지 작성 허용** (이전: GET-only)
- middleware `isReadOnlyExempt` 에 `/api/announcements` POST/PATCH/DELETE 추가
- POST 시 `contractorId = null`, `municipalityId = session.muni` → 산하 회사 broadcast

### 가시성 스코프 — 지자체 broadcast
GET 필터 확장:
```ts
where.AND = [{
  OR: [
    { contractorId: null, municipalityId: null },                  // 시스템(SUPER)
    { contractorId: cId },                                          // 본인 회사
    { contractorId: null, municipalityId: userMuniId },            // 본인 지자체 broadcast
  ],
}];
```

`userMuniId` 해상도: `session.municipalityId` 우선 → 없으면 `Contractor.municipalityId` 조회 (CONTRACTOR/INTERNAL/WORKER 의 muni 추정).

### 구현
- **lib/announcement-audience.ts** (신규)
  - `audienceOptionsForCreator(role)` / `isAudienceAllowedFor(role, audience)`
  - `visibleAudiencesForViewer(role)` / `AUDIENCE_LABEL`
- **app/api/announcements/route.ts**
  - zod enum 확장(OWNER 추가)
  - `POSTER_ROLES` 에 MUNI_ADMIN 포함
  - audience 정책 서버 측 강제 (400 audience_not_allowed)
  - GET 가시성 + 지자체 broadcast scope
- **app/api/announcements/[id]/route.ts**
  - PATCH: audience 정책 강제 + MUNI_ADMIN canManage 분기
- **app/(admin)/announcements/_announcements-client.tsx**
  - CreateModal 에 `role` prop 추가
  - audience 드롭다운 동적 옵션 (`audienceOptionsForCreator`)
  - 헤더 안내 메시지 role 별 분기
- **app/(admin)/announcements/page.tsx**
  - POSTERS 에 MUNI_ADMIN 추가 (페이지 접근 허용)
- **app/(admin)/layout.tsx**
  - MUNI_ADMIN 사이드바에 📢 공지사항 메뉴 노출
- **middleware.ts**
  - `isReadOnlyExempt` 에 `/api/announcements` mutate 허용
  - POST/PATCH/DELETE 모두 화이트리스트

---

## 6.3 AI 인근 추천 정밀화 — per-user targeting

### 사용자 요청
> RESUME_NOTE 다음 우선 처리 후보 #4 — AI 인근 추천 정밀화 (per-user targeting)

### 이전 동작의 한계
- `lib/complaint-assign.ts` 가 인근 워커 후보를 찾았지만 알림은 `audience='WORKER'` + 회사 한정 broadcast 1건으로 생성
- 회사 전체 워커가 알림을 받음 → 실제 거리/zone 매칭과 무관하게 "인근 추천이 무의미"

### 구현
**스키마**
- `Announcement.targetUserId BigInt?` 추가 (`@map("target_user_id")`, index)
- `null` = 일반 broadcast(기존 동작), 값있음 = per-user targeting
- `prisma db push` 적용 완료

**autoAssignComplaint 변경**
- broadcast 1건 → 인근 워커 N명 각각에게 `targetUserId` 지정 1건씩
- 본인 거리(`(당신과 약 X.Xkm)`)가 제목에 표시됨
- 6시간 expire 동일

**API GET 필터**
```ts
where.AND.push({
  OR: [
    { targetUserId: null },                    // broadcast
    { targetUserId: BigInt(session.userId) },  // 본인 targeted
  ],
});
```

### 효과
- **인근 워커만 알림 수신** — 거리 ≤ 2km OR zone 일치 워커 top5 (primary 제외)
- 다른 워커는 자기에게 targeted 된 게 없으면 안 보임
- AnnouncementBanner 의 자동 팝업·TTS·진동은 그대로 적용

### 권한
- per-user 알림은 시스템 자동 생성 → WORKER 가 직접 수정/삭제 불가 (`canManage()`)
- 워커는 dismiss 만 가능 (localStorage `cleanerp:dismissed-announcements:v2`)
- SUPER_ADMIN 은 전체 관리 가능 (장애·검증 시)

### Limitations / Future
- TTS 메시지는 일반 공지와 동일("회사에서 공지사항이 도착했습니다") — 향후 dispatch 전용 메시지 추가 가능
- per-user 알림 audit log 없음 (announcement 레코드 자체가 trail)
- targetUserId IN [...] (다중 타깃 1행) 미지원 — 현재는 워커당 1행 N건 생성

---

## 6.4 요금제 패키지 — 슈퍼관리자 1클릭 적용

### 사용자 요청
> RESUME_NOTE 다음 우선 처리 후보 #3 — 요금제 패키지(template) 기능

### 카탈로그 (4-tier)

| Package | 활성 기능 (8개 중) | 용도 |
|---|---|---|
| 🆓 **TRIAL** | announcements, voiceTts (2) | 신규 도입사 1개월 평가 |
| 🟢 **BASIC** | + complaintAutoAssign, attendanceGps, costCalculation (5) | 소규모 — 민원 자동·근태·원가 |
| 🔵 **STANDARD** | + recommendedRoute, vehicleTracking (7) | 중형 — 운영 자동화 |
| ⭐ **PRO** | + aiNearbyDispatch (8 전체) | 전체 기능 |

### 구현
- **lib/feature-packages.ts** (신규)
  - `FEATURE_PACKAGES[]` — 4 패키지 정의 (label, description, features map)
  - `getPackage(key)` / `detectPackage(features)` — 현재 상태 ↔ 패키지 자동 매핑
- **API**
  - `POST /api/super-admin/contractor-features/apply-package` — 일괄 적용 + 단일 audit
  - `GET /api/super-admin/contractor-features` — `currentPackage` 자동 감지 응답
- **UI** (`_features-tab.tsx`)
  - 회사 리스트 카드: `📦 PACKAGE_KEY` 또는 `🛠 커스텀` 뱃지
  - 우측 패널 상단: 4개 패키지 카드 grid + "✓ 적용" 버튼
  - 현재 적용 패키지는 비활성 + ring 표시
  - 적용 시 confirm 다이얼로그 (덮어쓰기 경고)

### 동작
1. 회사 선택 → 우측 상단 패키지 카드 4개 표시
2. 패키지 클릭 → confirm → POST `/apply-package`
3. 8개 feature 모두 upsert (true/false 명시) + audit log 1건
4. 즉시 detail/list 재조회 → UI 갱신

### 향후 확장
- 신규 위탁업체 개설 마법사 마지막 단계에 패키지 선택 통합
- DB 기반 커스텀 패키지(`FeaturePackage` 모델) — 슈퍼관리자가 패키지 자체를 만들고 수정
- 결제 모델 연동 (현재는 `monthlyHint` 영업 표기만)
- 패키지 history (`ContractorPackageHistory`) — 적용 이력 추적

---

## 6.5 회사별 기능 게이트 점진 적용 (서버·클라이언트)

### 사용자 요청
> RESUME_NOTE 다음 우선 처리 후보 #1 #2 — 게이트 점진 적용 + sidebar 메뉴 자체 숨김

### 서버 게이트 (lib/feature-guard.ts)
- `requireFeature(session, key, fallback?)` — 페이지 server component 진입 시 호출
- contractor 없는 사용자(SUPER/MUNI) 는 통과 (모니터링 권한 보존)
- 기능 OFF 면 `/feature-disabled?feature=KEY` 로 redirect

### 친화 안내 페이지
- `/feature-disabled` (신규) — feature key 받아 라벨/설명/문의 안내 카드
- middleware `isPublic` 에 추가 → 인증 흐름 안 끊고 표시

### 적용된 페이지/API
| 위치 | 게이트 키 | 동작 |
|---|---|---|
| `/worker/route` | recommendedRoute | OFF 시 안내 페이지 |
| `/(admin)/live-vehicles` | vehicleTracking | OFF 시 안내 페이지 |
| `/(admin)/payroll` | costCalculation | OFF 시 안내 페이지 |
| `POST /api/attendance/check-in` | attendanceGps | OFF 시 좌표 저장 skip (체크인은 허용) |
| `POST /api/attendance/check-out` | attendanceGps | 동일 |

### 클라이언트 게이트 (sidebar 메뉴 자체 숨김)
- `app/(admin)/layout.tsx` — `hasFeature` 호출 후 menu items 동적 조립
  - vehicleTracking OFF → "실시간 차량조회" 메뉴 미노출
  - announcements OFF → "공지사항" 메뉴 미노출
- `app/worker/layout.tsx` — recommendedRoute OFF 면 RAPID 워커도 추천경로 메뉴 숨김
- `/api/me/features` (신규) — 클라이언트가 본인 기능 상태 조회 가능

### SUPER/MUNI 특칙
- contractorId 없음 → 모든 게이트 자동 통과
- `/api/me/features` 도 모든 키 true 반환 → 모니터링 화면에서 메뉴 차단 안 됨

---

## 6.6 WebPush 인프라 (MVP-lite)

### 사용자 요청
> RESUME_NOTE #5 — WebPush API 풀스택 (백그라운드 푸시)

### 본 PR 범위 (인프라 준비)
- ✅ DB 모델: `WebPushSubscription` (userId × endpoint unique)
- ✅ API: `POST/DELETE /api/webpush/subscribe`
- ✅ 클라이언트: `components/PushSubscriber.tsx` — SW PushManager.subscribe + 서버 등록
- ✅ Service Worker: `push` + `notificationclick` 이벤트 핸들러 추가
- ⚠ 서버 측 발송: VAPID 키 + `web-push` npm 패키지 미설정 → 다음 PR

### 활성화 방법 (다음 세션)
1. VAPID 키 발급 (e.g., `npx web-push generate-vapid-keys`)
2. `.env.prod` 에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` 추가
3. `npm i web-push`
4. `lib/webpush-send.ts` 작성 — `sendPushToUser(userId, payload)`
5. `autoAssignComplaint` 의 per-user announcement 생성 시점에 `sendPushToUser` 호출
6. `POST /api/announcements` 에서도 audience 매칭 사용자에게 push

### 현재 동작
- VAPID public key 미설정 → `PushSubscriber` early-return → 사용자 영향 없음
- 키 설정 후 자동 활성

---

## 6.7 inbox 활성 카운트 뱃지 (/worker/complaint)

### 사용자 요청
> RESUME_NOTE #6 — inbox 카운트(N) 뱃지

### 구현
- `/worker/complaint` mount 시 `/api/complaints?limit=50` 1회 fetch
- `ASSIGNED|IN_PROGRESS|RECEIVED` 상태 카운트 → state
- 📥 내 민원 탭 우측에 N 뱃지 (active 시 흰 배경, 비active 시 rose 배경)

### 효과
- RAPID 워커가 본인 배정 민원 N건이 있으면 한눈에 인지
- 자동 진입 분기는 보류 (사용자 진단 2026-05-02: 기본 register 가 더 적절 — 지도 즉시 가시)

---

## 7. 운영 메모

### Service Worker 캐시
- v50 (2026-05-02 announcement-role-clarify)
- v51 (worker-inbox)
- v52 (worker-report-label)
- v53 (announcement-voice-tts)
- v54 (complaint-tts-autoassign)
- v55 (contractor-features)
- v56 (worker-complaint-default-register)
- v57 (global-notifications-root)
- v58 (announcement-audience-policy)
- v59 (ai-nearby-per-user-targeting)
- v60 (feature-packages)
- v61 (gates-webpush-inbox-badge) — 본 세션 마지막

### 배포 플로우 (변동 없음)
```bash
git add -A && git commit -m "..." && git push origin main
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build app
```

### 다음 세션 후보
1. 회사별 기능 게이트 점진 적용 (recommendedRoute, vehicleTracking, costCalculation, attendanceGps)
2. 클라이언트 사이드 기능 게이트 — `/api/me/features` 엔드포인트로 sidebar 메뉴 항목 자체 숨김
3. ContractorFeature 변경 audit 로그 상세 페이지 (현재는 audit 테이블에만 기록)
4. 슈퍼관리자 콘솔 — 회사별 기능 일괄 복사(template / 요금제 패키지) 기능
5. 기능 비활성 시 사용자 친화적 안내 페이지(403 대신)
6. /worker/complaint 진입 시 inbox 카운트(N) 뱃지 — 본인 배정 민원 있으면 inbox 탭 자동 진입
7. AttendanceRecord GPS 미수집 contractor 의 AI 인근 추천 fallback 정책 (현재는 score 페널티만)
8. 인근 broadcast Announcement 의 audience 를 'WORKER' 가 아닌 per-user targeting 으로 정밀화
   (Announcement 모델에 `targetUserId` 필드 추가 필요)
9. WebPush API 풀스택 — 백그라운드(앱 닫힘)에서도 공지/민원 푸시 수신
10. 공지/민원 음성 발화 큐 처리 — 동시 다발 신규 발생 시 cancel() 후 마지막만 발화하는 현재 정책 검토

---

## 8. Commits (본 세션 시간순)

| # | SHA | 영역 | 요약 |
|---|---|---|---|
| 1 | `55dfbf8` | worker | feat(worker): 기동반 민원처리 UI — InboxPanel + 가시범위 버그 수정 |
| 2 | `df3d5c1` | worker | fix(worker): 민원 등록 탭 라벨 '처리 내용' → '신고 내용' |
| 3 | `dc423f7` | announcements | feat(announcements): TTS 음성 알림 + 남/여 설정 |
| 4 | `27c62c8` | complaint | feat(complaint): 신규 민원 TTS + 기동반 자동배정 + AI 인근 워커 broadcast |
| 5 | `6f903b9` | super-admin | feat(super-admin): 회사별 기능 권한(엔타이틀먼트) 시스템 + 세션 기록 |
| 6 | `23b5f40` | worker | fix(worker): /worker/complaint 기본 탭 → 'register' (지도 즉시 가시) |
| 7 | `37dd841` | docs | docs: 본 세션 종료 기록 — 세션 로그 + RESUME_NOTE 갱신 |
| 8 | `f59c340` | notifications | feat(notifications): 공지/민원 자동 팝업 — 모든 화면 글로벌 마운트 |
| 9 | `249d7fe` | announcements | feat(announcements): role 기반 audience 정책 + MUNI 작성권 + OWNER audience |
| 10 | `f8f4486` | docs | docs: 세션 로그 commit#9 SHA 채움 |
| 11 | `865dd69` | ai-dispatch | feat(complaint): AI 인근 추천 per-user targeting (Announcement.targetUserId) |
| 12 | `35257db` | docs | docs: 세션 로그 commit#11 SHA 채움 |
| 13 | `e0fdd5b` | packages | feat(super-admin): 요금제 패키지 4-tier + 1클릭 적용 |
| 14 | `d102e3b` | docs | docs: 세션 로그 commit#13 SHA 채움 |
| 15 | `7d11b04` | gates+webpush+inbox | feat: 회사별 기능 게이트 점진 적용 + WebPush 인프라 + inbox 뱃지 |

---

## 9. Files Touched (본 세션 누적 — 최종)

### 신규 파일 (Library)
```
lib/voice-settings.ts                  TTS 설정 + 발화 helper (Web Speech API)
lib/complaint-assign.ts                자동배정 + AI 인근 추천 알고리즘
lib/features.ts                        기능 카탈로그(8) + hasFeature/listContractorFeatures
lib/feature-packages.ts                요금제 패키지 4-tier (TRIAL/BASIC/STANDARD/PRO)
lib/feature-guard.ts                   페이지 server-side 게이트 (requireFeature)
lib/announcement-audience.ts           role 기반 audience 정책 (5 audiences × 4 roles)
```

### 신규 파일 (Component)
```
components/VoiceSettingsModal.tsx      voice 선호 UI (남/여 토글, 미리듣기 4종)
components/ComplaintBanner.tsx         신규 민원 폴링 + TTS + OS 알림
components/GlobalNotifications.tsx     root 마운트용 wrapper (Banner+Push)
components/PushSubscriber.tsx          WebPush 구독 등록 (SW PushManager)
```

### 신규 파일 (API)
```
app/api/super-admin/contractor-features/route.ts                GET/PATCH 회사별 기능
app/api/super-admin/contractor-features/apply-package/route.ts  POST 패키지 일괄 적용
app/api/me/features/route.ts                                    본인 contractor 기능 상태
app/api/webpush/subscribe/route.ts                              POST/DELETE WebPush 구독
```

### 신규 파일 (UI / Page)
```
app/(admin)/super-admin/_features-tab.tsx     회사 × 기능 매트릭스 + 패키지 grid
app/feature-disabled/page.tsx                 기능 비활성 친화 안내 페이지
```

### 수정된 기존 파일
```
lib/complaints.ts                              WORKER 가시범위 OR(reportedBy, assignedTo)
components/AnnouncementBanner.tsx              TTS 트리거 + 🔊 음성 버튼 + targetUserId
app/worker/complaint/_complaint-client.tsx     +259 — InboxPanel + 탭 + 라벨 + inbox 카운트 뱃지
app/api/announcements/route.ts                 authorRole + audience 정책 + targetUserId 필터
                                              + announcements feature gate
app/api/announcements/[id]/route.ts            audience 정책 + MUNI canManage 분기
app/api/complaints/route.ts                    reporter.role + autoAssign + complaintAutoAssign 게이트
app/api/attendance/check-in/route.ts           attendanceGps 게이트 (좌표 저장 skip)
app/api/attendance/check-out/route.ts          동일
app/(admin)/announcements/_announcements-client.tsx  role-based 옵션 + 🔊 음성 설정 버튼
app/(admin)/announcements/page.tsx             POSTERS 에 MUNI 추가
app/(admin)/super-admin/_super-admin-client.tsx 🎛 회사별 기능 권한 탭 등록
app/(admin)/_admin-shell.tsx                   GlobalNotifications 으로 이관(중복 마운트 제거)
app/(admin)/layout.tsx                         MUNI 메뉴 + sidebar 동적 필터(vehicleTracking/announcements)
app/(admin)/live-vehicles/page.tsx             vehicleTracking 게이트
app/(admin)/payroll/page.tsx                   costCalculation 게이트
app/worker/route/page.tsx                      recommendedRoute 게이트
app/worker/layout.tsx                          recommendedRoute OFF 시 RAPID 메뉴 숨김
app/worker/_layout-shell.tsx                   GlobalNotifications 으로 이관
app/layout.tsx                                 root level <GlobalNotifications /> 마운트
middleware.ts                                  MUNI mutate 화이트리스트 + /feature-disabled public
public/sw.js                                   v50 → v61 (12회 bust) + push/notificationclick handler
prisma/schema.prisma                           +ContractorFeature, +Announcement.targetUserId,
                                              +WebPushSubscription, +audience 'OWNER' 카탈로그 명시
docs/04-report/2026-05-02-session-log.md       본 문서
RESUME_NOTE.md                                 본 세션 결과 요약 + 다음 후보
```

### 누적 통계 (15 feature commits + 4 docs commits)
- **신규 파일 18**: lib 6 / component 4 / API 4 / UI page 2 / docs 1 (this) / RESUME 1
- **수정된 기존 파일 23**
- **총 ~3,500 lines** added (다수 feature 누적)
- **prisma db push 3회**:
  · ContractorFeature 테이블
  · Announcement.targetUserId 컬럼
  · WebPushSubscription 테이블
- **docker compose rebuild 14회** (commit 직후 자동 재배포)
- **SW 캐시 12회 bump**: v50 → v61

### Commit 매핑 (요약)
- 운영 6 commits + 9 feature commits + 4 docs commits = **19 commits**
- 모두 `main` 직접 푸시 (PR 우회 — `helpbiz` 조직 bypass rule)

