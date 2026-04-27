/**
 * 시드 데이터 — Phase 1A 검증용 최소셋
 * - 1 지자체 (서울특별시 강남구)
 * - 1 위탁업체 ((주)한국청소서비스)
 * - 5 Role 계정 (super / muni / contractor / internal / worker)
 *
 * 비밀번호는 SEED_PASSWORD 환경변수 (기본 'changeme1234!')
 * 운영 단계 진입 전 모든 시드 계정 비밀번호 강제 변경 필요.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { encryptHealthRecordInput } from '../lib/health';

const prisma = new PrismaClient();
const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

async function main() {
  console.log('🌱 Seeding waste-erp...');
  const hash = await bcrypt.hash(SEED_PWD, 12);
  const testHash = await bcrypt.hash('test', 12); // 개발용 빠른 로그인

  // 지자체
  const muni = await prisma.municipality.upsert({
    where: { code: '11680' }, // 강남구 행정코드
    update: {},
    create: {
      name: '서울특별시 강남구',
      code: '11680',
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Municipality:', muni.name);

  // 위탁업체
  const contractor = await prisma.contractor.upsert({
    where: { businessNo: '123-45-67890' },
    update: {},
    create: {
      municipalityId: muni.id,
      companyName: '(주)한국청소서비스',
      businessNo: '123-45-67890',
      contractStart: new Date('2026-01-01'),
      contractEnd: new Date('2026-12-31'),
      status: 'ACTIVE',
    },
  });
  console.log('  ✓ Contractor:', contractor.companyName);

  // 청소구역
  const zone = await prisma.cleaningZone.upsert({
    where: { id: 1n },
    update: {},
    create: {
      contractorId: contractor.id,
      zoneName: '강남구 동부 일반구역',
      zoneCode: 'GN-E-01',
      zoneType: 'GENERAL',
      areaKm2: 12.45,
    },
  });
  console.log('  ✓ Zone:', zone.zoneName);

  // 5 관리자 Role 계정 + 5명 근로자 (시안 5행과 동일 이름)
  const accounts = [
    { username: 'super',    role: 'SUPER_ADMIN'      as const, name: '슈퍼관리자', contractorId: null },
    { username: 'muni',     role: 'MUNI_ADMIN'       as const, name: '지자체관리자', contractorId: null },
    { username: 'company',  role: 'CONTRACTOR_ADMIN' as const, name: '업체관리자', contractorId: contractor.id },
    { username: 'manager',  role: 'INTERNAL_ADMIN'   as const, name: '김관리',     contractorId: contractor.id },
    { username: 'worker',   role: 'WORKER' as const, name: '이철수', contractorId: contractor.id },
    { username: 'worker2',  role: 'WORKER' as const, name: '박영희', contractorId: contractor.id },
    { username: 'worker3',  role: 'WORKER' as const, name: '최민준', contractorId: contractor.id },
    { username: 'worker4',  role: 'WORKER' as const, name: '정수연', contractorId: contractor.id },
    { username: 'worker5',  role: 'WORKER' as const, name: '김대호', contractorId: contractor.id },
  ];

  for (const acc of accounts) {
    await prisma.user.upsert({
      where: { username: acc.username },
      /* 개발/CI 빠른 진입 — 기존 사용자도 privacyConsentAt 채워서 middleware consent_required 회피 */
      update: { privacyConsentAt: new Date() },
      create: {
        username: acc.username,
        passwordHash: hash,
        role: acc.role,
        name: acc.name,
        contractorId: acc.contractorId,
        municipalityId: acc.role === 'MUNI_ADMIN' ? muni.id : null,
        status: 'ACTIVE',
        privacyConsentAt: new Date(), // E2E/CI 용 — 운영 진입 전 사용자가 직접 동의
      },
    });
    console.log(`  ✓ User: ${acc.username} (${acc.role}) — ${acc.name}`);
  }

  // 개발용 빠른 로그인: test / test (INTERNAL_ADMIN)
  // 운영 진입 전 반드시 삭제. 매 시드마다 비밀번호 강제 재설정 (update 블록)
  await prisma.user.upsert({
    where: { username: 'test' },
    update: { passwordHash: testHash, status: 'ACTIVE', privacyConsentAt: new Date() },
    create: {
      username: 'test',
      passwordHash: testHash,
      role: 'INTERNAL_ADMIN',
      name: '테스트관리자',
      contractorId: contractor.id,
      status: 'ACTIVE',
      // e2e 사용 — fresh seed 후에도 /consent redirect 없이 admin 페이지 접근
      privacyConsentAt: new Date(),
    },
  });
  console.log(`  ✓ User: test (INTERNAL_ADMIN) — 테스트관리자 [개발용]`);

  // 기동반(RAPID) 직책 1명 부여 — /worker/route 메뉴 노출 검증용
  // worker3(최민준)에게 적용 (position 시드 후 부착)
  const rapid = await prisma.position.findUnique({ where: { code: 'RAPID' } });
  if (rapid) {
    await prisma.user.updateMany({
      where: { username: 'worker3' },
      data: { positionId: rapid.id },
    });
    console.log(`  ✓ Position assigned: worker3 → RAPID (기동반)`);
  }

  // 오늘 근태 시드 (시안 5행 패턴과 동일하게 — 데모용)
  // 이철수 정상 / 박영희 지각 / 최민준 결근(레코드 없음) / 정수연 조기 / 김대호 정상
  const workers = await prisma.user.findMany({
    where: { role: 'WORKER', contractorId: contractor.id, status: 'ACTIVE' },
    orderBy: { id: 'asc' },
  });
  const byName = new Map(workers.map((w) => [w.name, w]));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const at = (h: number, m: number) => {
    const d = new Date(today);
    d.setUTCHours(h - 9, m, 0, 0); // KST → UTC
    return d;
  };
  const seedRecord = async (workerName: string, hh: number, mm: number, type: 'NORMAL' | 'EARLY' | 'EXTENDED') => {
    const w = byName.get(workerName);
    if (!w) return;
    await prisma.attendanceRecord.upsert({
      where: { workerId_workDate: { workerId: w.id, workDate: today } },
      update: { checkInTime: at(hh, mm), workType: type, status: 'PENDING' },
      create: {
        workerId: w.id,
        contractorId: contractor.id,
        workDate: today,
        checkInTime: at(hh, mm),
        checkInLat: 37.4979,  // 강남역 인근
        checkInLng: 127.0276,
        workType: type,
        zoneId: zone.id,
        status: type === 'EARLY' ? 'ADJUSTED' : 'PENDING',
      },
    });
  };
  await seedRecord('이철수', 8, 2, 'NORMAL');     // 정상
  await seedRecord('박영희', 8, 47, 'NORMAL');    // 지각 (08:30 이후 → isLate=true)
  // 최민준 — 레코드 없음 = 결근
  await seedRecord('정수연', 7, 55, 'EARLY');     // 조기출근
  await seedRecord('김대호', 8, 5, 'NORMAL');     // 정상
  console.log(`  ✓ Today attendance: 4 records (이철수/박영희/정수연/김대호) + 1 absent (최민준)`);

  // 민원 시드 (시안 mockup 4건과 동일 패턴)
  const cheolsu  = byName.get('이철수')!;
  const younghee = byName.get('박영희')!;
  const today1530 = new Date(Date.now() - 18 * 3600 * 1000); // 어제 16:30
  const today0815 = new Date(); today0815.setUTCHours(today0815.getUTCHours() - 1, 15, 0, 0);
  const today0740 = new Date(); today0740.setUTCHours(today0740.getUTCHours() - 1, 40, 0, 0);
  const yest1410  = new Date(Date.now() - 19 * 3600 * 1000);

  const complaints = [
    {
      type: 'PICKUP_MISS' as const, description: '수거 미비 - 역삼1동 123번지',
      locationAddress: '강남구 역삼1동 123번지', locationLat: 37.5009, locationLng: 127.0364,
      reportedBy: cheolsu.id, reportedAt: today0815,
      status: 'IN_PROGRESS' as const, dueDate: new Date(Date.now() - 24 * 3600 * 1000), // 어제 마감 = 초과
    },
    {
      type: 'ILLEGAL_DUMP' as const, description: '불법투기 - 개포동 456 앞',
      locationAddress: '강남구 개포2동 456 앞', locationLat: 37.4795, locationLng: 127.0541,
      reportedBy: younghee.id, reportedAt: today0740,
      status: 'IN_PROGRESS' as const, assignedTo: younghee.id,
      dueDate: new Date(Date.now() + 24 * 3600 * 1000),
    },
    {
      type: 'ODOR_NOISE' as const, description: '악취 민원 - 대치4동 수거함',
      locationAddress: '강남구 대치4동 수거함 인근', locationLat: 37.4946, locationLng: 127.0582,
      reportedBy: cheolsu.id, reportedAt: today1530,
      status: 'RECEIVED' as const, // 미배정
    },
    {
      type: 'PICKUP_MISS' as const, description: '수거 미비 - 논현1동 789',
      locationAddress: '강남구 논현1동 789', locationLat: 37.5108, locationLng: 127.0228,
      reportedBy: cheolsu.id, reportedAt: yest1410,
      status: 'COMPLETED' as const, assignedTo: cheolsu.id,
      resolvedAt: new Date(Date.now() - 16 * 3600 * 1000),
      resolveNote: '재수거 완료, 사진 첨부',
    },
  ];

  // 차량 시드 (시안 mockup 6대 + 새 차종 11종 일부 시연) — 운전자/시작일/초기주행거리 포함
  const opStart = new Date('2025-01-15T00:00:00Z');
  const vehicleSpecs = [
    { vehicleNo: '11가1234', vehicleType: 'COMPACTOR_REFUSE' as const, vehicleTon: '4.5t', capacityTon: 4.5, fuelType: 'DIESEL' as const, status: 'ACTIVE'      as const, driver: '이철수', initial: 12000 },
    { vehicleNo: '11나5678', vehicleType: 'COMPACTOR_REFUSE' as const, vehicleTon: '4.5t', capacityTon: 4.5, fuelType: 'DIESEL' as const, status: 'ACTIVE'      as const, driver: '박영희', initial: 8800  },
    { vehicleNo: '11다9012', vehicleType: 'ARM_ROLL'         as const, vehicleTon: '5t',   capacityTon: 5.0, fuelType: 'DIESEL' as const, status: 'MAINTENANCE' as const, driver: '최민준', initial: 23500 },
    { vehicleNo: '11라3456', vehicleType: 'PRESS_REFUSE'     as const, vehicleTon: '4.5t', capacityTon: 4.5, fuelType: 'DIESEL' as const, status: 'ACTIVE'      as const, driver: '김대호', initial: 14200 },
    { vehicleNo: '11마7890', vehicleType: 'GRAB_TRUCK'       as const, vehicleTon: '3t',   capacityTon: 3.0, fuelType: 'LPG'    as const, status: 'ACTIVE'      as const, driver: null,    initial: 5400  },
    { vehicleNo: '11바1357', vehicleType: 'DUMP_TRUCK'       as const, vehicleTon: '5t',   capacityTon: 5.0, fuelType: 'DIESEL' as const, status: 'ACTIVE'      as const, driver: '정수연', initial: 9300  },
  ];
  for (const v of vehicleSpecs) {
    const driverUser = v.driver ? byName.get(v.driver) : null;
    /* 시드 데모용 동승자 — 운전자 외 다른 워커 2명 자동 배정 */
    const otherWorkers = workers.filter((w) => w.name !== v.driver).slice(0, 2);
    const passenger1 = otherWorkers[0];
    const passenger2 = otherWorkers[1];
    const { driver, initial, ...rest } = v;
    void driver;
    await prisma.vehicle.upsert({
      where: { contractorId_vehicleNo: { contractorId: contractor.id, vehicleNo: v.vehicleNo } },
      update: {
        status: v.status,
        driverId: driverUser?.id ?? null,
        passenger1Id: passenger1?.id ?? null,
        passenger2Id: passenger2?.id ?? null,
        operationStartDate: opStart,
        initialMileage: initial,
        totalMileage: initial,
      },
      create: {
        contractorId: contractor.id,
        ...rest,
        yearManufactured: 2022,
        driverId: driverUser?.id ?? null,
        passenger1Id: passenger1?.id ?? null,
        passenger2Id: passenger2?.id ?? null,
        operationStartDate: opStart,
        initialMileage: initial,
        totalMileage: initial,
      },
    });
  }
  console.log(`  ✓ Vehicles: ${vehicleSpecs.length} (1 정비중) + 운전자·운행시작일·주행거리`);

  // 오늘 운행일지 — 4대 운행 (작성자: 시안 5명 근로자)
  const vehicles = await prisma.vehicle.findMany({ where: { contractorId: contractor.id }, orderBy: { vehicleNo: 'asc' } });
  const driverPlan = [
    { vno: '11가1234', driver: '이철수', start: 12000, end: 12085, fuel: 18.5, waste: 4200, trips: 6, route: '역삼1동 일반구역 6회 수거' },
    { vno: '11나5678', driver: '박영희', start: 8800,  end: 8867,  fuel: 14.2, waste: 3850, trips: 5, route: '개포2동 일반구역 5회 수거' },
    { vno: '11라3456', driver: '김대호', start: 14200, end: 14290, fuel: 19.0, waste: 4100, trips: 6, route: '논현1동 일반구역 6회 수거' },
    { vno: '11바1357', driver: '정수연', start: 9300,  end: 9358,  fuel: 12.8, waste: 3550, trips: 4, route: '삼성1동 일반구역 4회 수거' },
  ];
  await prisma.vehicleLog.deleteMany({ where: { vehicle: { contractorId: contractor.id }, logDate: today } });
  for (const p of driverPlan) {
    const v = vehicles.find((x) => x.vehicleNo === p.vno);
    const driver = byName.get(p.driver);
    if (!v || !driver) continue;
    await prisma.vehicleLog.create({
      data: {
        vehicleId: v.id,
        driverId: driver.id,
        logDate: today,
        zoneId: zone.id,
        startMileage: p.start,
        endMileage: p.end,
        fuelUsed: p.fuel,
        wasteWeightKg: p.waste,
        tripCount: p.trips,
        routeDetail: p.route,
        status: p.driver === '이철수' ? 'APPROVED' : p.driver === '박영희' ? 'SUBMITTED' : 'DRAFT',
      },
    });
  }
  console.log(`  ✓ Vehicle logs: 4 (1 승인, 1 제출, 2 작성중)`);

  // 승인된 로그의 주행거리 차이를 totalMileage에 누적
  const approvedLogs = await prisma.vehicleLog.findMany({
    where: { vehicle: { contractorId: contractor.id }, status: 'APPROVED' },
    select: { vehicleId: true, startMileage: true, endMileage: true },
  });
  for (const log of approvedLogs) {
    if (log.startMileage == null || log.endMileage == null) continue;
    const delta = log.endMileage - log.startMileage;
    if (delta <= 0) continue;
    await prisma.vehicle.update({
      where: { id: log.vehicleId },
      data: { totalMileage: { increment: delta } },
    });
  }

  // 산업안전보건 시드 (시안 패턴 — 일일점검 + 아차사고 + 재해)
  await prisma.safetyReport.deleteMany({ where: { contractorId: contractor.id } });
  const safCheolsu = byName.get('이철수');
  const safYounghee = byName.get('박영희');
  const safDaeho = byName.get('김대호');
  const safManager = await prisma.user.findUnique({ where: { username: 'manager' } });
  if (safCheolsu && safManager) {
    await prisma.safetyReport.create({
      data: {
        contractorId: contractor.id,
        reportedBy: safCheolsu.id,
        reportType: 'DAILY_CHECKLIST',
        severity: 'NONE',
        reportDate: today,
        checklistItems: [
          { key: 'helmet', label: '안전모 착용', ok: true },
          { key: 'vest', label: '안전조끼·반사조끼', ok: true },
          { key: 'glove', label: '안전장갑', ok: true },
          { key: 'shoes', label: '안전화', ok: true },
          { key: 'tire', label: '차량 타이어 점검', ok: true },
          { key: 'brake', label: '브레이크·등화 점검', ok: true },
          { key: 'lift', label: '리프트·압축장치', ok: true },
        ],
        allChecked: true,
        status: 'REVIEWED',
        reviewedBy: safManager.id,
        reviewedAt: new Date(),
        reviewNote: '점검 양호',
      },
    });
  }
  if (safYounghee) {
    await prisma.safetyReport.create({
      data: {
        contractorId: contractor.id,
        reportedBy: safYounghee.id,
        reportType: 'NEAR_MISS',
        severity: 'NONE',
        reportDate: today,
        occurredAt: new Date(Date.now() - 2 * 3600 * 1000),
        description: '개포2동 수거함 옆 보도블록이 깨져 있어 작업자 통행 시 발목 부상 위험. 즉시 보수 요청.',
        locationAddress: '강남구 개포2동 456 앞',
        locationLat: 37.4795, locationLng: 127.0541,
        status: 'SUBMITTED',
      },
    });
  }
  if (safDaeho) {
    const incidentAt = new Date(Date.now() - 4 * 3600 * 1000);
    await prisma.safetyReport.create({
      data: {
        contractorId: contractor.id,
        reportedBy: safDaeho.id,
        reportType: 'INCIDENT',
        severity: 'INJURY',
        reportDate: today,
        occurredAt: incidentAt,
        molDeadline: new Date(incidentAt.getTime() + 30 * 24 * 3600 * 1000),
        description: '논현1동 수거 작업 중 압축장치 점검 부주의로 손가락 타박상. 응급처치 후 병원 내원.',
        locationAddress: '강남구 논현1동 789',
        locationLat: 37.5108, locationLng: 127.0228,
        status: 'SUBMITTED',
      },
    });
  }
  console.log(`  ✓ Safety reports: 3 (1 검토완료, 1 아차사고, 1 부상-MOL 30일 기한)`);

  // TBM 시드 (오늘 세션 + 일부 서명)
  if (safManager) {
    await prisma.tbmSignature.deleteMany({ where: { session: { contractorId: contractor.id } } });
    await prisma.tbmSession.deleteMany({ where: { contractorId: contractor.id } });
    const tbmSession = await prisma.tbmSession.create({
      data: {
        contractorId: contractor.id,
        sessionDate: today,
        topic: '폭염 대비 수분 섭취 및 휴식 안전수칙',
        content: '1) 매 1시간마다 200ml 이상 수분 섭취\n2) 그늘 쉼터에서 10분 휴식\n3) 어지럼증·메스꺼움 발생 즉시 작업 중단 및 신고',
        createdBy: safManager.id,
      },
    });
    if (safCheolsu) {
      await prisma.tbmSignature.create({ data: { sessionId: tbmSession.id, workerId: safCheolsu.id } });
    }
    if (safYounghee) {
      await prisma.tbmSignature.create({ data: { sessionId: tbmSession.id, workerId: safYounghee.id } });
    }
    console.log(`  ✓ TBM session: 폭염 대비 + 2명 서명`);
  }

  // 건강기록 시드 (이철수 1건) — 모든 민감 필드 AES-256-GCM 암호화
  if (safCheolsu && safManager) {
    await prisma.healthRecord.deleteMany({ where: { contractorId: contractor.id } });
    const enc = await encryptHealthRecordInput({
      lastCheckupDate: '2026-03-15',
      bloodPressureSys: 128,
      bloodPressureDia: 82,
      heartRate: 72,
      bloodSugar: 95,
      visionLeft: 1.0,
      visionRight: 1.0,
      bloodType: 'O+',
      allergies: '페니실린',
      chronicConditions: null,
      emergencyContact: '배우자 010-1234-5678',
      notes: '연 1회 정기검진 양호',
    });
    await prisma.healthRecord.create({
      data: {
        workerId: safCheolsu.id,
        contractorId: contractor.id,
        ...enc,
        updatedBy: safManager.id,
      },
    });
    console.log(`  ✓ Health record: 이철수 1건 (AES-256-GCM 암호화)`);
  }

  // 기존 시드 민원 정리 후 재삽입
  await prisma.complaint.deleteMany({ where: { contractorId: contractor.id } });
  for (const c of complaints) {
    await prisma.complaint.create({
      data: {
        contractorId: contractor.id,
        zoneId: zone.id,
        ...c,
      },
    });
  }
  console.log(`  ✓ Complaints: 4 (1 초과, 1 처리중, 1 미배정, 1 완료)`);

  // Design Ref: §3.1.1 — 처리시설 마스터 시드 (지자체 단위, 4종 type별 1개씩)
  const facilities = [
    { type: 'RECYCLING_CENTER', name: '강남구 자원순환센터',  address: '서울특별시 강남구 일원동 ...' },
    { type: 'INCINERATOR',      name: '○○ 소각장',           address: '서울특별시 ○○구 ...'         },
    { type: 'OUTSOURCED',       name: '한강 위탁처리장',       address: '경기도 ○○시 ...'             },
    { type: 'LANDFILL',         name: '수도권 매립시설',       address: '인천광역시 ○○구 ...'         },
  ];
  for (const f of facilities) {
    await prisma.wasteTreatmentFacility.upsert({
      where: { municipalityId_type_name: { municipalityId: muni.id, type: f.type, name: f.name } },
      update: {},
      create: { municipalityId: muni.id, type: f.type, name: f.name, address: f.address, active: true },
    });
  }
  console.log(`  ✓ Facilities (지자체 단위): ${facilities.length} (소각장/위탁/매립/자원순환)`);

  // Design Ref: §3.1.3, §3.4 — F-02 일일 처리실적 일보 표준 ReportTemplate 시드
  // Note: municipalityId NULL 케이스는 Prisma upsert 복합키와 맞지 않아 findFirst 패턴 사용
  const f02SpecRaw = (await import('node:fs')).readFileSync(
    new URL('./seeds/report-templates/F-02.json', import.meta.url),
    'utf-8',
  );
  const f02Spec = JSON.parse(f02SpecRaw);
  const existingF02 = await prisma.reportTemplate.findFirst({
    where: { contractorId: contractor.id, municipalityId: null, code: 'F-02', version: 1 },
  });
  if (existingF02) {
    await prisma.reportTemplate.update({
      where: { id: existingF02.id },
      data: { spec: f02Spec, active: true },
    });
  } else {
    await prisma.reportTemplate.create({
      data: {
        contractorId: contractor.id,
        municipalityId: null,
        code: 'F-02',
        name: '일일 처리실적 일보',
        spec: f02Spec,
        outputFormats: 'pdf',
        version: 1,
        active: true,
      },
    });
  }
  console.log(`  ✓ ReportTemplate: F-02 일일 처리실적 일보 (표준 양식)`);

  console.log(`\n✅ Done. Login with: super / muni / company / manager / worker / worker2~5`);
  console.log(`   Password: ${SEED_PWD}`);
  console.log(`   ⚡ Quick test login: test / test (INTERNAL_ADMIN)\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
