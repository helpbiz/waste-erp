/**
 * 베타 onboarding 시드 — 2 지자체 + 2 위탁업체 + 행정동 + 차고지 + 처리시설 + 권한정책 + 4 사용자
 *
 * 시나리오:
 *   강남구  ─→  (주)한국청소서비스      ─→  관리자(company1) + 작업자(worker1a, worker1b)
 *   파주시  ─→  (주)파주환경            ─→  관리자(company2) + 작업자(worker2a)
 *
 * 모니터링:
 *   강남구 지자체 담당  →  muni1 (MUNI_ADMIN, GET-only)
 *   파주시 지자체 담당  →  muni2 (MUNI_ADMIN, GET-only)
 *
 * 슈퍼관리자: super (기존 시드 그대로)
 *
 * 실행:
 *   npx tsx prisma/seeds/beta-onboarding.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SEED_PWD = process.env.SEED_PASSWORD ?? 'changeme1234!';

const MUNIS = [
  {
    code: '11680',
    name: '서울특별시 강남구',
    region: '서울특별시',
    contractor: {
      companyName: '(주)한국청소서비스',
      businessNo: '123-45-67890',
      ceoName: '김대표',
      phoneMain: '02-1234-5678',
      emailMain: 'contact@kcs.co.kr',
      garage: { address: '서울특별시 강남구 역삼동 차고지', lat: 37.4979, lng: 127.0473 },
    },
    facilities: [
      { type: 'RECYCLING_CENTER', name: '강남구 자원순환센터', address: '서울특별시 강남구 일원동 ...' },
      { type: 'INCINERATOR',      name: '서울 자원회수시설',   address: '서울특별시 노원구 ...' },
      { type: 'OUTSOURCED',       name: '한강 위탁처리장',     address: '경기도 광주시 ...' },
    ],
    muniAdminUser: { username: 'muni1', name: '강남구 환경과' },
    contractorUsers: [
      { username: 'company1', role: 'CONTRACTOR_ADMIN', name: '강남업체 관리자' },
      { username: 'worker1a', role: 'WORKER',           name: '강남 작업자A' },
      { username: 'worker1b', role: 'WORKER',           name: '강남 작업자B' },
    ],
  },
  {
    code: '41280',
    name: '경기도 파주시',
    region: '경기도',
    contractor: {
      companyName: '(주)파주환경',
      businessNo: '234-56-78901',
      ceoName: '이대표',
      phoneMain: '031-987-6543',
      emailMain: 'contact@pajuenv.co.kr',
      garage: { address: '경기도 파주시 문발로 차고지', lat: 37.7170, lng: 126.7366 },
    },
    facilities: [
      { type: 'RECYCLING_CENTER', name: '파주 자원순환센터',  address: '경기도 파주시 문발동 ...' },
      { type: 'LANDFILL',         name: '수도권매립지',       address: '인천광역시 서구 ...' },
    ],
    muniAdminUser: { username: 'muni2', name: '파주시 환경과' },
    contractorUsers: [
      { username: 'company2', role: 'CONTRACTOR_ADMIN', name: '파주업체 관리자' },
      { username: 'worker2a', role: 'WORKER',           name: '파주 작업자A' },
    ],
  },
] as const;

const ALL_SCREENS = [
  'dashboard', 'users', 'attendance', 'complaints', 'safety',
  'health', 'vehicles', 'live-vehicles', 'performance', 'reports', 'bulky-waste',
];
const ALL_REPORTS = [
  'attendance', 'leave', 'complaints', 'vehicles', 'waste',
  'intake', 'safety', 'hr', 'f02',
];

async function main() {
  console.log('🌱 베타 onboarding 시드 시작...');
  const hash = await bcrypt.hash(SEED_PWD, 12);

  for (const m of MUNIS) {
    /* 1. 지자체 */
    const muni = await prisma.municipality.upsert({
      where: { code: m.code },
      update: { name: m.name, region: m.region, status: 'ACTIVE' },
      create: { code: m.code, name: m.name, region: m.region, status: 'ACTIVE' },
    });
    console.log(`  ✓ Muni: ${muni.name}`);

    /* 2. 위탁업체 */
    const contractor = await prisma.contractor.upsert({
      where: { businessNo: m.contractor.businessNo },
      update: {
        companyName: m.contractor.companyName,
        ceoName: m.contractor.ceoName,
        phoneMain: m.contractor.phoneMain,
        emailMain: m.contractor.emailMain,
        garageAddress: m.contractor.garage.address,
        garageLat: m.contractor.garage.lat,
        garageLng: m.contractor.garage.lng,
        status: 'ACTIVE',
      },
      create: {
        municipalityId: muni.id,
        companyName: m.contractor.companyName,
        businessNo: m.contractor.businessNo,
        contractStart: new Date('2026-01-01'),
        contractEnd: new Date('2026-12-31'),
        status: 'ACTIVE',
        ceoName: m.contractor.ceoName,
        phoneMain: m.contractor.phoneMain,
        emailMain: m.contractor.emailMain,
        garageAddress: m.contractor.garage.address,
        garageLat: m.contractor.garage.lat,
        garageLng: m.contractor.garage.lng,
      },
    });
    console.log(`    ✓ Contractor: ${contractor.companyName}`);

    /* 3. 처리시설 (지자체 단위) */
    for (const f of m.facilities) {
      await prisma.wasteTreatmentFacility.upsert({
        where: { municipalityId_type_name: { municipalityId: muni.id, type: f.type, name: f.name } },
        update: { address: f.address, active: true },
        create: { municipalityId: muni.id, type: f.type, name: f.name, address: f.address, active: true },
      });
    }
    console.log(`    ✓ Facilities: ${m.facilities.length}곳`);

    /* 4. 청소구역 (위탁업체 1개 기본) */
    await prisma.cleaningZone.upsert({
      where: { id: BigInt(`${muni.id}001`) },
      update: {},
      create: {
        id: BigInt(`${muni.id}001`),
        contractorId: contractor.id,
        zoneName: `${m.name.split(' ').pop()} 일반구역`,
        zoneCode: `${m.code}-GEN-01`,
        zoneType: 'GENERAL',
        areaKm2: 10.0,
      },
    });

    /* 5. 권한 정책 (지자체 → 산하 업체) — super 계정의 id를 updatedBy 로 사용 */
    const superUser = await prisma.user.findUnique({ where: { username: 'super' }, select: { id: true } });
    if (superUser) {
      await prisma.muniAccessPolicy.upsert({
        where: { municipalityId: muni.id },
        update: {
          allowedScreens: ALL_SCREENS.join(','),
          allowedReports: ALL_REPORTS.join(','),
          exportEnabled: true,
          bulkExportEnabled: true,
          updatedBy: superUser.id,
        },
        create: {
          municipalityId: muni.id,
          allowedScreens: ALL_SCREENS.join(','),
          allowedReports: ALL_REPORTS.join(','),
          exportEnabled: true,
          bulkExportEnabled: true,
          updatedBy: superUser.id,
        },
      });
      console.log(`    ✓ MuniAccessPolicy: 모든 화면·보고서 허용`);
    } else {
      console.log(`    ⚠ super 계정 없음 — MuniAccessPolicy 시드 스킵 (npm run db:seed 먼저 실행)`);
    }

    /* 6. MUNI_ADMIN 지자체 모니터링 계정 */
    await prisma.user.upsert({
      where: { username: m.muniAdminUser.username },
      update: { status: 'ACTIVE', privacyConsentAt: new Date() },
      create: {
        username: m.muniAdminUser.username,
        passwordHash: hash,
        role: 'MUNI_ADMIN',
        name: m.muniAdminUser.name,
        municipalityId: muni.id,
        contractorId: null,
        status: 'ACTIVE',
        privacyConsentAt: new Date(),
      },
    });
    console.log(`    ✓ MUNI_ADMIN: ${m.muniAdminUser.username}`);

    /* 7. 위탁업체 사용자 (관리자 + 작업자) */
    for (const u of m.contractorUsers) {
      await prisma.user.upsert({
        where: { username: u.username },
        update: { status: 'ACTIVE', privacyConsentAt: new Date() },
        create: {
          username: u.username,
          passwordHash: hash,
          role: u.role as 'CONTRACTOR_ADMIN' | 'WORKER',
          name: u.name,
          contractorId: contractor.id,
          status: 'ACTIVE',
          privacyConsentAt: new Date(),
        },
      });
    }
    console.log(`    ✓ Contractor users: ${m.contractorUsers.length}명`);

    /* 8. 기동반(RAPID) 직책 부여 — worker1a 만 (route 탭 데모) */
    const rapid = await prisma.position.findUnique({ where: { code: 'RAPID' } });
    if (rapid && m.contractorUsers[1]) {
      await prisma.user.updateMany({
        where: { username: m.contractorUsers[1].username },
        data: { positionId: rapid.id },
      });
      console.log(`    ✓ RAPID position → ${m.contractorUsers[1].username}`);
    }

    /* 9. F-02 ReportTemplate (위탁업체별) — facility-by-municipality 후 muniId 옵션 가능 */
    const f02SpecRaw = (await import('node:fs')).readFileSync(
      new URL('./report-templates/F-02.json', import.meta.url),
      'utf-8',
    );
    const f02Spec = JSON.parse(f02SpecRaw);
    const existingF02 = await prisma.reportTemplate.findFirst({
      where: { contractorId: contractor.id, municipalityId: null, code: 'F-02', version: 1 },
    });
    if (!existingF02) {
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
      console.log(`    ✓ F-02 ReportTemplate`);
    }
  }

  /* dealer-channel Design §8.5 Seed Data Requirements — e2e/dealer-channel.spec.ts 용 DEALER 계정 */
  await prisma.user.upsert({
    where: { username: 'dealer1' },
    update: { status: 'ACTIVE', privacyConsentAt: new Date() },
    create: {
      username: 'dealer1',
      passwordHash: hash,
      role: 'DEALER',
      name: 'E2E 테스트 딜러',
      contractorId: null,
      municipalityId: null,
      status: 'ACTIVE',
      privacyConsentAt: new Date(),
    },
  });
  console.log('  ✓ DEALER: dealer1');

  console.log('\n✅ 베타 onboarding 시드 완료');
  console.log('───────────────────────────────────────');
  console.log('로그인 계정 (비밀번호: changeme1234!)');
  console.log('  • super       — 슈퍼관리자 (전체 모니터링)');
  console.log('  • muni1       — 강남구 환경과 (read-only)');
  console.log('  • muni2       — 파주시 환경과 (read-only)');
  console.log('  • company1    — (주)한국청소서비스 관리자');
  console.log('  • company2    — (주)파주환경 관리자');
  console.log('  • worker1a/b  — 강남 작업자 (1a 는 기동반)');
  console.log('  • worker2a    — 파주 작업자');
  console.log('  • dealer1     — 딜러(dealer-channel Design §8.5, e2e 테스트용)');
}

main()
  .catch((e) => {
    console.error('Seed 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
