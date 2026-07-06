# 🤝 딜러 계정 발급·활용 가이드

> 딜러 채널(리드 게이트키핑 + 영업 데모 샌드박스) 운영 가이드.
> 관련 문서: [Plan](../01-plan/features/dealer-channel.plan.md) · [Design](../02-design/features/dealer-channel.design.md)
> 배포 상태: 2026-07-06 프로덕션 라이브 배포 완료 (승인플로우 간소화 + 데모 매직링크 포함).

---

## 🎯 개요

공비랩 직원·딜러(대리점)가 잠재고객을 발굴하고 영업 시연을 할 수 있도록, 기존 4개 role(WORKER/INTERNAL_ADMIN/CONTRACTOR_ADMIN/MUNI_ADMIN)과 완전히 분리된 **DEALER** role을 신설했다.

| 역할 | 할 수 있는 일 | 할 수 없는 일 |
|---|---|---|
| **DEALER** | 리드(잠재고객) 등록·조회·보강, 데모 셀프발급(링크 공유 포함) | 실제 지자체/위탁업체 생성(SUPER_ADMIN 승인 필요), 다른 딜러의 리드 조회, 기존 4개 role 화면 접근 |
| **SUPER_ADMIN** | 딜러가 올린 리드 검토 후 원클릭 승인/반려(승인 시 실계정 자동 생성) | — |

**표준 영업 흐름**: ① 딜러가 `/dealer/demo`에서 데모를 즉시 발급받아 링크를 예비고객에게 공유(시스템 소개/체험) → ② 예비고객이 관심을 보이면 딜러가 `/dealer/leads`에서 리드 등록(처음엔 고객사명만, 회사정보는 몰라도 됨) → ③ 회사정보를 알게 되는 대로 리드 목록에서 "정보 입력"으로 보강 → ④ SUPER_ADMIN이 검토 후 승인확정(원클릭) → ⑤ 실계정 자동 생성.

---

## 1. 딜러 계정 발급 (SUPER_ADMIN만 가능)

셀프 가입 없음 — 기존 프로젝트 원칙("SUPER만 발급") 그대로 적용. SUPER_ADMIN 계정으로 로그인 후 API 호출:

```bash
curl -X POST https://www.cleanerp.kr/api/users \
  -H "Content-Type: application/json" \
  -H "Cookie: wciSession=<SUPER_ADMIN 세션 쿠키>" \
  -d '{
    "username": "dealer_hong",
    "password": "임시비밀번호12!",
    "name": "홍길동",
    "role": "DEALER",
    "dealerCompany": "OO대리점"
  }'
```

> - `username`은 이메일 형식도 허용된다(예: `hong@cleanerp.kr`).
> - `dealerCompany`는 선택 사항 — 순수 표시용 라벨일 뿐, 회사 단위로 쿼터·정산·조회 권한이 묶이지 않는다.
> - `contractorId`/`municipalityId`는 지정하지 않는다(딜러는 특정 조직에 소속되지 않음).
> - 발급 후 딜러 본인에게 아이디/초기 비밀번호를 안전한 채널로 전달하고, 최초 로그인 시 비밀번호 변경을 안내한다.
> - **비밀번호·시크릿 등을 사용자에게 전달하기 전에는 반드시 실제 로그인/검증까지 마친 뒤 전달할 것** — 스크립트 출력을 옮겨적다 오타가 나면 알아챌 방법이 없다(2026-07-06 실제 발생 사고).

로그인 성공 시 자동으로 `/dealer/leads`로 랜딩된다.

---

## 2. 딜러가 실제로 쓰는 방법

### 2.1 리드(잠재고객) 등록·보강 — `/dealer/leads`

**1단계 — 가벼운 최초 등록**: 예상 고객사명·연락처·메모만 입력해 리드 등록(회사정보는 몰라도 됨). 등록된 리드는 `PENDING` 상태로 SUPER_ADMIN 승인 대기열에 들어간다. 본인이 등록한 리드 목록과 승인 상태(대기/승인/반려)만 조회 가능(다른 딜러 리드는 안 보임).

**2단계 — 회사정보 보강(예비고객이 "테스트해보고 싶다"고 할 때)**: 등록 폼의 "+ 테스트 요청 받음 — 회사정보 지금 입력"을 펼치거나, 이미 등록된 PENDING 리드 목록에서 "정보 입력"을 눌러 아래 6개 필드를 입력한다.

| 필드 | 설명 |
|---|---|
| 지자체명 / 지자체 코드 / 광역(선택) | 고객사가 속한 지자체 정보 |
| 위탁업체명 / 사업자번호 | 고객사(위탁업체) 정보 |
| 관리자 아이디 / 관리자 이름 | 고객사 담당자 계정 정보 |

> **관리자 초기 비밀번호는 여기서도, 승인 화면에서도 입력하지 않는다** — 승인 시 시스템이 자동 생성해 SUPER_ADMIN에게 1회 표시한다(딜러가 고객 계정 비밀번호를 미리 아는 것을 원천 차단).

### 2.2 영업 데모 셀프발급 + 링크 공유 — `/dealer/demo`

- **승인 절차 없이 즉시 발급** — 영업 미팅 잡아놓고 데모가 없는 상황을 막기 위한 설계
- 발급 시 자동으로: 격리된 데모 지자체+위탁업체 생성, 관리자 계정(아이디+임시 비밀번호 1회 화면 표시) 발급, **예비고객 공유 링크** 발급, 최근 60일치 근태·차량일지·민원 샘플 데이터 자동 시딩
- **예비고객에게는 아이디/비밀번호 대신 공유 링크를 그대로 전달**하면 된다 — 클릭만으로 데모 계정(`CONTRACTOR_ADMIN`)에 자동 로그인되어 비밀번호를 딜러가 전달할 필요 자체가 없다. 링크가 유출됐거나 재발급이 필요하면 "링크 재발급" 버튼으로 즉시 무효화 가능(기존 링크는 그 순간부터 작동 안 함).
- **딜러당 동시 활성 데모 3개 상한** (`DEALER_DEMO_QUOTA`, `lib/types/dealer.ts`)
- **14일 후 자동 만료·삭제** (`DEMO_TTL_DAYS`) — 정리 cron 등록 필요, §4 참고
- 발급된 계정 role은 항상 `CONTRACTOR_ADMIN`(SUPER_ADMIN 아님) — 실운영 데이터 접근 불가, 데모 테넌트 안에서만 동작
- 데모 세션(링크 접속 포함)은 45분 후 자동 로그아웃(실계정 8시간보다 짧음)
- 데모 테넌트에서는 SMS/알림톡이 실제로 발송되지 않음(no-op 처리) — 시연 중 실제 번호를 입력해도 외부로 나가지 않음

시연 팁: 미리 채워진 60일치 데이터 위에서 근태 입력·민원 등록 등을 직접 시연하면 리포트/엑셀 출력에 바로 반영되는 걸 보여줄 수 있다. 예비고객이 직접 링크로 접속해서 스스로 눌러보게 하면 더 설득력 있다.

---

## 3. SUPER_ADMIN — 리드 검토·승인/반려

super-admin 콘솔(`/super-admin`) → **"🤝 딜러 리드 승인"** 탭에서 PENDING 리드 목록 확인 후:

- **검토**: 딜러가 입력해둔 회사정보가 폼에 미리 채워진 상태로 열림. 필요하면 정정하고, 필수 항목(지자체명/코드, 위탁업체명/사업자번호, 관리자 아이디/이름)이 비어 있으면 승인 버튼이 비활성화된다.
- **승인확정**: 버튼 클릭 한 번 — 관리자 초기 비밀번호는 시스템이 자동 생성해서 승인 완료 화면에 1회 표시된다. 그 값을 고객에게 안전한 채널로 전달하면 된다.
- **반려**: 사유 없이 즉시 반려 처리(현재 버전은 사유 입력 UI 없음 — 필요 시 후속 개선)

API로 직접 호출할 때는 body가 전부 선택(override)이다 — 딜러 입력값을 그대로 쓰려면 빈 body만 보내면 된다:

```bash
# 딜러가 입력한 값 그대로 승인
curl -X PATCH https://www.cleanerp.kr/api/super-admin/leads/<leadId>/approve \
  -H "Content-Type: application/json" -H "Cookie: wciSession=<SUPER_ADMIN 세션>" -d '{}'

# 일부만 정정해서 승인 (예: 사업자번호 오타 수정)
curl -X PATCH https://www.cleanerp.kr/api/super-admin/leads/<leadId>/approve \
  -H "Content-Type: application/json" -H "Cookie: wciSession=<SUPER_ADMIN 세션>" \
  -d '{"contractorBusinessNo": "123-45-67890"}'
```

응답에 `adminUsername`/`adminPassword`(자동생성)가 담겨 있으니 그대로 고객에게 전달하면 된다.

---

## 4. 운영 — 데모 정리 cron (✅ 등록 완료, 2026-07-06)

`POST /api/cron/demo-cleanup`이 매일 04:00(KST)에 자동 실행되도록 이 서버의 crontab에 등록되어 있다(`crontab -l`로 확인 가능). 실행 로그는 `/tmp/wci-cron-logs/demo-cleanup.log`.

```
0 4 * * * curl -s -X POST -H "Authorization: Bearer $(grep -oP '^CRON_SECRET=\K.*' /home/user/my-pjt/wci-mvp/waste-erp/.env.prod)" http://localhost:3001/api/cron/demo-cleanup >> /tmp/wci-cron-logs/demo-cleanup.log 2>&1
```

> `CRON_SECRET`은 컨테이너가 실제로 읽는 `.env.prod`(⚠️ CLI에서 쓰는 `.env`와 값이 다름 — `docker-compose.yml`의 `env_file: .env.prod` 참고)에서 명령 실행 시점에 읽어온다. `crontab -l`/`ps aux`에 시크릿 평문이 노출되지 않도록 값을 직접 박지 않고 파일에서 읽는 방식을 사용한다.

등록 전 실제 프로덕션에서 검증 완료: 테스트로 만든 데모 1건을 강제 만료시킨 뒤 `dryRun` → 실제 정리 → Contractor/Municipality/자식 레코드/User 전부 삭제되고 고아 레코드 0건인 것까지 직접 확인함.

dryRun만 별도로 확인하고 싶으면:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://www.cleanerp.kr/api/cron/demo-cleanup -d '{"dryRun": true}'
```

---

## 5. 알려진 제약 (후속 개선 대상)

| 항목 | 현재 상태 |
|---|---|
| 딜러당 pending 리드 상한 | 없음(무제한 등록 가능) |
| 커미션 자동 정산 | `DealerCommission` 테이블만 존재, UI/자동계산 로직 없음 |
| 데모 시딩 범위 | 60일 × 근태·차량일지·민원 3개 모듈만(전 모듈·3~6개월 아님) |
| 데모 정리 cron | ✅ 등록 완료(매일 04:00 KST) — §4 참고 |
| 리드 반려 사유 입력 | UI 없음 |
| SUPER_ADMIN 리드 목록 필터 | PENDING만 조회(승인/반려 이력 조회 UI 없음, API는 `?status=` 파라미터로 가능) |
