# 📈 SLA 자동 측정 + 월간 리포트 발송 명세서

> **목표**: 가용성·응답·복구 SLA를 자동 측정하고 월간 리포트를 자동 발송. 위반 시 자동 크레딧 적용.
> **참조**: 서비스_개설_절차.md 부록 B "요금제 + SLA"
> **상태**: 명세 단계
> **우선순위**: 🟡 Medium (정식 운영 + 다수 위탁업체 도입 후 필수)

---

## 1. 목적

| 항목 | 내용 |
|---|---|
| Why | 약속한 SLA 이행 증빙 + 신뢰 확보 + 위반 시 자동 보상 |
| Who | 위탁업체(월간 리포트 수신) + 운영팀(SLA 추적) |
| What | 헬스체크·장애·응답 자동 측정 → 월간 PDF 리포트 → 자동 크레딧 |
| Success | **SLA 위반 0건** (목표) / **위반 시 자동 크레딧** 적용 |

---

## 2. SLA 정의 (재확인)

| 등급 | 가용성 | 1차 응답(P0) | 복구(P0) | 위반 시 보상 |
|---|---|---|---|---|
| Standard | 99.5% (월 다운 3.6h) | 1시간 | 4시간 | 다음 달 10% 할인 |
| Pro | 99.9% (월 다운 43m) | 30분 | 2시간 | 다음 달 25% 할인 |
| Enterprise | 99.95% (월 다운 21m) | 15분 | 1시간 | 다음 달 50% 할인 |

---

## 3. 측정 데이터 수집

### 3.1 헬스체크 데이터 (가용성 측정)

```prisma
model HealthCheckLog {
  id          BigInt   @id @default(autoincrement())
  checkedAt   DateTime @default(now())
  endpoint    String   @db.VarChar(100)  // /api/health, /api/citizen, etc.
  statusCode  Int
  responseMs  Int                        // 응답 시간 (ms)
  region      String?  @db.VarChar(20)   // 측정 지역 (외부 모니터링 시)
  source      String   @db.VarChar(20)   // INTERNAL / UPTIMEROBOT / SENTRY
  
  @@index([checkedAt, statusCode])
  @@map("health_check_logs")
}
```

수집 방법:
1. **내부 cron** (1분 간격) — 자체 헬스체크
2. **UptimeRobot 웹훅** — 외부 시점 측정
3. **Sentry** (옵션) — 5xx 에러 발생 시

### 3.2 장애 인시던트 (응답·복구 측정)

```prisma
model Incident {
  id              BigInt    @id @default(autoincrement())
  incidentNo      String    @unique @db.VarChar(20)  // INC-2026-0042
  
  detectedAt      DateTime  // 자동 감지 시각
  notifiedAt      DateTime? // 운영팀 인지 시각 (Slack 클릭 등)
  acknowledgedAt  DateTime? // 1차 응답 (담당자 배정)
  resolvedAt      DateTime? // 복구 완료
  
  severity        IncidentSeverity  // P0 / P1 / P2 / P3
  rootCause       String?   @db.Text
  affectedScope   String?   @db.VarChar(255)  // 영향 범위 (예: "전체 서비스" / "민원 모듈")
  affectedContractorIds BigInt[]  // 영향받은 위탁업체
  
  postmortem      String?   @db.Text  // 사후 보고서
  
  createdAt       DateTime  @default(now())
  
  @@map("incidents")
}

enum IncidentSeverity {
  P0  // Critical: 전체 서비스 다운
  P1  // High: 주요 모듈 다운
  P2  // Medium: 일부 기능 오류
  P3  // Low: UI 개선·문의
}
```

### 3.3 SLA 월간 집계

```prisma
model SlaMonthlyReport {
  id              BigInt   @id @default(autoincrement())
  contractorId    BigInt   @map("contractor_id")
  yearMonth       String   @db.VarChar(7)   // 2026-04
  
  // 가용성
  totalSeconds        Int   // 한 달 초 (30일 = 2,592,000)
  downtimeSeconds     Int   // 다운타임 (sum)
  availabilityPct     Decimal  @db.Decimal(5, 3)  // 99.872
  slaTarget           Decimal  @db.Decimal(5, 3)  // 99.500
  isViolated          Boolean
  
  // 응답·복구 (인시던트 평균)
  avgFirstResponseMin Int?
  avgResolutionMin    Int?
  p0Count             Int   @default(0)
  p1Count             Int   @default(0)
  p2Count             Int   @default(0)
  p3Count             Int   @default(0)
  
  // 크레딧
  creditPct           Int   @default(0)  // 0 / 10 / 25 / 50
  creditAppliedAt     DateTime?
  
  // 발송
  reportUrl           String?  @db.Text  // PDF S3 URL
  sentAt              DateTime?
  sentTo              String?  @db.VarChar(255)
  
  generatedAt         DateTime @default(now())
  
  @@unique([contractorId, yearMonth])
  @@map("sla_monthly_reports")
}
```

---

## 4. 가용성 자동 측정

### 4.1 내부 헬스체크 cron (1분 간격)

```typescript
// app/api/cron/health-recorder/route.ts

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  
  const start = Date.now();
  const endpoints = ['/api/health', '/api/citizen', '/api/auth/me'];
  const results = [];
  
  for (const ep of endpoints) {
    const t0 = Date.now();
    try {
      const r = await fetch(`http://localhost:3000${ep}`);
      results.push({ endpoint: ep, statusCode: r.status, responseMs: Date.now() - t0 });
    } catch (e) {
      results.push({ endpoint: ep, statusCode: 0, responseMs: Date.now() - t0 });
    }
  }
  
  await prisma.healthCheckLog.createMany({
    data: results.map((r) => ({ ...r, source: 'INTERNAL', checkedAt: new Date() })),
  });
  
  return NextResponse.json({ ok: true, durationMs: Date.now() - start, results });
}
```

cron 등록 (외부 호출):
```bash
* * * * * curl -H "Authorization: Bearer ${CRON_SECRET}" https://wci.helpbiz.kr/api/cron/health-recorder
```

### 4.2 UptimeRobot 웹훅 통합

UptimeRobot에서 `Down` 이벤트 발생 시:
```
POST https://wci.helpbiz.kr/api/webhooks/uptimerobot
{ monitorURL, monitorFriendlyName, alertType, alertDateTime, ... }
```

→ `Incident` 자동 생성 (severity=P0) + Slack 알림

### 4.3 가용성 계산 로직

```typescript
// lib/sla.ts

export async function calculateMonthlyAvailability(yearMonth: string): Promise<{
  totalMs: number;
  downMs: number;
  availabilityPct: number;
}> {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const totalMs = end.getTime() - start.getTime();
  
  // 1. 인시던트 기반 다운타임
  const incidents = await prisma.incident.findMany({
    where: {
      severity: { in: ['P0', 'P1'] },  // P0/P1만 가용성에 영향
      detectedAt: { gte: start, lt: end },
      resolvedAt: { not: null },
    },
  });
  
  let downMs = 0;
  for (const inc of incidents) {
    const dur = inc.resolvedAt!.getTime() - inc.detectedAt.getTime();
    // P1은 50% 가중치 (전체 다운 X)
    downMs += inc.severity === 'P0' ? dur : dur * 0.5;
  }
  
  // 2. 헬스체크 실패 보강 (cron 외부 측정 기준 더 정확)
  const checks = await prisma.healthCheckLog.findMany({
    where: {
      endpoint: '/api/health',
      checkedAt: { gte: start, lt: end },
    },
    orderBy: { checkedAt: 'asc' },
  });
  
  // 연속 5xx → 다운 인정
  let consecutiveFails = 0;
  let lastFailStart: Date | null = null;
  for (const c of checks) {
    if (c.statusCode === 0 || c.statusCode >= 500) {
      if (consecutiveFails === 0) lastFailStart = c.checkedAt;
      consecutiveFails++;
      if (consecutiveFails >= 3) {
        // 3회 연속 실패 → 다운 시작 시점부터 카운트
      }
    } else {
      if (consecutiveFails >= 3 && lastFailStart) {
        downMs += c.checkedAt.getTime() - lastFailStart.getTime();
      }
      consecutiveFails = 0;
      lastFailStart = null;
    }
  }
  
  return {
    totalMs,
    downMs,
    availabilityPct: ((totalMs - downMs) / totalMs) * 100,
  };
}
```

---

## 5. 월간 리포트 자동 생성

### 5.1 매월 1일 cron — 전월 리포트 생성

```typescript
// app/api/cron/sla-monthly-report/route.ts

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  
  // 전월
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
  
  // 가용성 (전체 시스템 — 모든 위탁업체 공통)
  const { availabilityPct, downMs } = await calculateMonthlyAvailability(yearMonth);
  
  // 활성 위탁업체 별 리포트 생성
  const contractors = await prisma.contractor.findMany({
    where: { status: 'ACTIVE' },
  });
  
  for (const c of contractors) {
    const slaTarget = c.contractType === 'PRO' ? 99.9 : c.contractType === 'ENTERPRISE' ? 99.95 : 99.5;
    const isViolated = availabilityPct < slaTarget;
    const creditPct = isViolated
      ? slaTarget === 99.95 ? 50 : slaTarget === 99.9 ? 25 : 10
      : 0;
    
    // 인시던트 통계
    const incidents = await prisma.incident.groupBy({
      by: ['severity'],
      where: {
        affectedContractorIds: { has: c.id },
        detectedAt: { gte: lastMonth, lt: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1) },
      },
      _count: { _all: true },
      _avg: { /* TODO: 응답·복구 시간 */ },
    });
    
    const counts = { P0: 0, P1: 0, P2: 0, P3: 0 };
    for (const i of incidents) counts[i.severity] = i._count._all;
    
    const report = await prisma.slaMonthlyReport.upsert({
      where: { contractorId_yearMonth: { contractorId: c.id, yearMonth } },
      create: {
        contractorId: c.id,
        yearMonth,
        totalSeconds: Math.floor(/* totalMs */ / 1000),
        downtimeSeconds: Math.floor(downMs / 1000),
        availabilityPct,
        slaTarget,
        isViolated,
        p0Count: counts.P0,
        p1Count: counts.P1,
        p2Count: counts.P2,
        p3Count: counts.P3,
        creditPct,
      },
      update: {},
    });
    
    // PDF 생성 + 이메일 발송
    const pdfUrl = await generateSlaReportPdf(report);
    await sendSlaReportEmail(c, report, pdfUrl);
    
    await prisma.slaMonthlyReport.update({
      where: { id: report.id },
      data: { reportUrl: pdfUrl, sentAt: new Date() },
    });
  }
  
  return NextResponse.json({ ok: true, processed: contractors.length, yearMonth });
}
```

cron 등록:
```json
{ "crons": [{ "path": "/api/cron/sla-monthly-report", "schedule": "0 1 1 * *" }] }
```

매월 1일 01:00 UTC = 10:00 KST 실행 → 전월 리포트 자동 발송.

### 5.2 PDF 리포트 템플릿

```
┌──────────────────────────────────────────────┐
│  [CleanERP 로고]    SLA 월간 리포트           │
│                                               │
│  대상: {{회사명}}                             │
│  기간: 2026년 4월 (2026-04-01 ~ 04-30)        │
│  발행: 2026-05-01                             │
├──────────────────────────────────────────────┤
│                                               │
│  ━━━ 가용성 (Availability) ━━━                │
│                                               │
│  실측 가용성:    99.872%  ✓ 목표 달성          │
│  계약 SLA:       99.500%                      │
│  ┌──────────────────────────────┐             │
│  │ ████████████████████░ 99.87%│ Bar 그래프  │
│  └──────────────────────────────┘             │
│                                               │
│  총 다운타임:    225분 (3시간 45분)            │
│  허용 다운타임:  216분 (3시간 36분)            │
│                                               │
│  ━━━ 인시던트 통계 ━━━                        │
│                                               │
│   심각도   |  발생  |  평균 응답  |  평균 복구 │
│   P0(Critical)  1  |   12분      |    45분    │
│   P1(High)      2  |   25분      |   2시간    │
│   P2(Medium)    4  |   2시간     |   1일      │
│   P3(Low)       8  |   8시간     |   3일      │
│                                               │
│  ━━━ 주요 인시던트 ━━━                        │
│                                               │
│  [INC-2026-0042] 2026-04-15 14:30~15:15 (45분)│
│   원인: 외부 OSRM 의존성 다운                  │
│   복구: Haversine fallback 자동 전환          │
│   영향: 추천경로 일시 직선 표시                │
│                                               │
│  ━━━ SLA 준수 결과 ━━━                        │
│                                               │
│  ✅ 가용성 목표 달성 (99.872% ≥ 99.5%)         │
│  ✅ P0 응답 시간 평균 12분 (목표 60분 이내)    │
│                                               │
│  → 크레딧 적용 없음 (목표 달성)                │
│                                               │
│  ━━━ 다음 달 계획 ━━━                         │
│                                               │
│  • 외부 의존성 fallback 강화                   │
│  • 자체 호스팅 OSRM 백업 환경 구축             │
│                                               │
├──────────────────────────────────────────────┤
│  CleanERP 운영팀                              │
│  cleanerp@helpbiz.kr / 1588-XXXX              │
└──────────────────────────────────────────────┘
```

---

## 6. 위반 시 자동 크레딧 적용

```typescript
// 다음 달 인보이스 생성 시 — billing 시스템 통합 (Phase B)

// 임시: 운영팀 알림 + 수동 처리
if (report.isViolated) {
  await sendSlackAlert({
    channel: '#sla-alert',
    text: `⚠️ SLA 위반 — ${contractor.companyName} ${yearMonth}: ${report.availabilityPct}% (목표 ${slaTarget}%)`,
    attachments: [{
      color: 'danger',
      fields: [
        { title: '크레딧 적용', value: `${report.creditPct}% 할인` },
        { title: '다음 달 인보이스', value: '자동 차감 필요' },
      ],
    }],
  });
}
```

---

## 7. 슈퍼관리자 대시보드 — SLA 탭 (`/super-admin/sla`)

### 7.1 메인 화면

```
┌──────────────────────────────────────────────┐
│ SLA 현황 (이번 달)                            │
│                                               │
│ ┌─────────────────────┬─────────────────────┐│
│ │ 실시간 가용성       │ 활성 인시던트       ││
│ │ 99.94%              │ 0건                 ││
│ │ ████████████████████│                     ││
│ └─────────────────────┴─────────────────────┘│
│                                               │
│ 위탁업체별 SLA (이번 달)                       │
│ ┌──────────────┬───────┬──────┬───────────┐  │
│ │ 회사명       │ SLA   │ 실측  │ 상태      │  │
│ │ A사 (강남)   │ 99.5% │99.94%│ ✅ 달성    │  │
│ │ B사 (부산)   │ 99.9% │99.92%│ ⚠️ 임박    │  │
│ │ C사 (제주)   │ 99.95%│99.91%│ ❌ 위반    │  │
│ └──────────────┴───────┴──────┴───────────┘  │
│                                               │
│ 인시던트 이력 (최근 30일)                     │
│ • INC-0042 P0 4/15 OSRM 다운 (45분)          │
│ • INC-0041 P1 4/10 DB 슬로우 (2시간)         │
│ ...                                           │
└──────────────────────────────────────────────┘
```

### 7.2 인시던트 등록 UI

운영팀이 장애 발생 시 즉시 등록 (수동 또는 자동 감지):

```
[+ 인시던트 등록]
  ↓
- 심각도: P0/P1/P2/P3
- 영향 범위: 전체 / 모듈 선택
- 영향 위탁업체: 다중 선택
- 감지 시각: (자동, 수정 가능)
- 사후 보고서 (옵션)
- [저장] → Slack 자동 알림
  ↓
- 응답 → "응답 처리" 버튼
- 복구 완료 → "복구 완료" 버튼
- 사후 보고 → "Postmortem 작성"
```

---

## 8. 이메일 발송

```typescript
// lib/mailer.ts

export async function sendSlaReportEmail(
  contractor: Contractor,
  report: SlaMonthlyReport,
  pdfUrl: string,
) {
  const subject = report.isViolated
    ? `[CleanERP] SLA 월간 리포트 — ${report.yearMonth} (⚠️ SLA 위반 안내)`
    : `[CleanERP] SLA 월간 리포트 — ${report.yearMonth} ✅`;
  
  await transporter.sendMail({
    from: '"CleanERP 운영팀" <ops@helpbiz.kr>',
    to: contractor.emailMain ?? '',
    cc: 'sla@helpbiz.kr',
    subject,
    html: `
      <p>안녕하세요. ${report.yearMonth}월 SLA 리포트를 첨부 드립니다.</p>
      <ul>
        <li>가용성: <strong>${report.availabilityPct.toFixed(3)}%</strong> (목표 ${report.slaTarget}%)</li>
        <li>다운타임: ${Math.floor(report.downtimeSeconds / 60)}분</li>
        <li>인시던트: P0 ${report.p0Count}건 / P1 ${report.p1Count}건</li>
        ${report.isViolated ? `<li><strong style="color:red">⚠️ SLA 위반 — 다음 달 ${report.creditPct}% 크레딧 적용</strong></li>` : ''}
      </ul>
      <p><a href="${pdfUrl}">상세 리포트 PDF</a></p>
    `,
    attachments: [{ path: pdfUrl }],
  });
}
```

---

## 9. 구현 순서 (Phase 1 — 5일)

| Day | 작업 |
|---|---|
| 1 | DB schema (HealthCheckLog, Incident, SlaMonthlyReport) |
| 2 | 헬스체크 cron + UptimeRobot 웹훅 |
| 3 | 가용성 계산 로직 + 인시던트 등록 UI |
| 4 | 월간 리포트 cron + PDF 생성 + 이메일 |
| 5 | 슈퍼관리자 SLA 탭 + 위반 시 Slack 알림 |

---

## 10. 향후 확장

- **자체 호스팅 모니터링** (Grafana + Loki)
- **Status 페이지** 공개 (`https://status.helpbiz.kr`)
- **인보이스 자동 차감** (billing 시스템)
- **위탁업체 셀프 서비스** — 본인 SLA 리포트 조회 (CONTRACTOR_ADMIN 권한)
- **SLA 협상** (월간 합의 이력 추적)
