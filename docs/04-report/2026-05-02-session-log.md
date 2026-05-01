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
- v59 (ai-nearby-per-user-targeting) — 본 세션 마지막

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

---

## 9. Files Touched (본 세션 누적)

```
lib/complaints.ts                                        WORKER OR(reportedBy, assignedTo)
lib/voice-settings.ts                                    NEW — TTS 설정/발화 helper
lib/complaint-assign.ts                                  NEW — 자동배정+AI 인근 추천
lib/features.ts                                          NEW — 카탈로그+hasFeature
components/AnnouncementBanner.tsx                        TTS 트리거 + 🔊 음성 버튼
components/VoiceSettingsModal.tsx                        NEW — voice 선호 UI
components/ComplaintBanner.tsx                           NEW — 폴링+TTS+OS 알림
app/worker/complaint/_complaint-client.tsx               +259/-3 — InboxPanel + 탭 + 라벨
app/api/announcements/route.ts                           authorRole + announcements 게이트
app/api/complaints/route.ts                              reporter.role + 자동배정 호출+게이트
app/api/super-admin/contractor-features/route.ts         NEW — 기능 GET/PATCH
app/(admin)/announcements/_announcements-client.tsx      🔊 음성 설정 버튼
app/(admin)/super-admin/_super-admin-client.tsx          features 탭 등록
app/(admin)/super-admin/_features-tab.tsx                NEW — 매트릭스 UI
app/(admin)/_admin-shell.tsx                             ComplaintBanner 마운트
app/worker/_layout-shell.tsx                             ComplaintBanner 마운트
prisma/schema.prisma                                     ContractorFeature 모델 + relation
public/sw.js                                             v50 → v56 (cache bust 7회)
docs/04-report/2026-05-02-session-log.md                 NEW (this file)
```

### 누적 통계 (본 세션 6 commit)
- 14 신규 파일 (라이브러리 4, 컴포넌트 3, API 2, UI 1, 문서 1, 마이그레이션 1, 기타 2)
- 6 기존 파일 수정
- 총 ~1,140 lines added (대부분 InboxPanel + features matrix UI + 세션 로그)
- prisma db push 1회 (ContractorFeature 테이블 생성)
- docker compose rebuild 6회 (각 commit 직후 자동 재배포)

