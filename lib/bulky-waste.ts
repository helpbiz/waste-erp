/**
 * 대형폐기물 import 핵심 로직 — 빼기 fetch → Complaint 자동 생성
 *  - 중복 방지: complaint.description에 [PPAEGI:externalId] tag 매칭
 *  - 매일 03시 import / 17시 resolve (수거 완료 처리)
 */
import { prisma } from './db';
import { decryptField } from './crypto';
import { fetchPickupRequests, testLogin, type PickupRequest } from './ppaegi';

export type ImportResult = {
  ok: boolean;
  fetched: number;
  created: number;
  skipped: number;
  error?: string;
};

export type ResolveResult = {
  ok: boolean;
  resolved: number;
  error?: string;
};

const PPAEGI_TAG_RE = /\[PPAEGI:([A-F0-9]+)\]/;

export async function runBulkyImport(
  configId: bigint,
  triggeredBy: bigint | null,
  triggerType: 'cron' | 'manual'
): Promise<ImportResult> {
  const config = await prisma.bulkyWasteConfig.findUnique({ where: { id: configId } });
  if (!config) return { ok: false, fetched: 0, created: 0, skipped: 0, error: 'config_not_found' };
  if (!config.ppaegiUsername || !config.ppaegiPasswordEnc) {
    return logFail(config.id, triggeredBy, triggerType, '빼기 인증 정보 미등록');
  }

  const password = await decryptField(config.ppaegiPasswordEnc);
  if (!password) return logFail(config.id, triggeredBy, triggerType, '비밀번호 복호화 실패');

  /* 로그인 */
  const login = await testLogin({ username: config.ppaegiUsername, password });
  await prisma.bulkyWasteConfig.update({
    where: { id: config.id },
    data: { lastLoginAt: new Date(), lastLoginOk: login.ok, lastLoginMessage: login.message },
  });
  if (!login.ok || !login.session) {
    return logFail(config.id, triggeredBy, triggerType, '로그인 실패: ' + login.message);
  }

  /* 신청 목록 fetch */
  const adminDongCodes = (config.adminDongCodes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let fetched: PickupRequest[];
  try {
    fetched = await fetchPickupRequests({ session: login.session, adminDongCodes });
  } catch (e) {
    return logFail(config.id, triggeredBy, triggerType, 'fetch 오류: ' + (e instanceof Error ? e.message : 'unknown'));
  }

  /* 중복 검사 — 최근 7일 내 동일 externalId */
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recent = await prisma.complaint.findMany({
    where: { type: 'BULKY_WASTE', contractorId: config.contractorId, reportedAt: { gte: since } },
    select: { description: true },
  });
  const seen = new Set<string>();
  for (const c of recent) {
    const m = c.description?.match(PPAEGI_TAG_RE);
    if (m) seen.add(m[1]);
  }

  let created = 0, skipped = 0;
  for (const r of fetched) {
    if (seen.has(r.externalId)) { skipped++; continue; }
    await prisma.complaint.create({
      data: {
        contractorId: config.contractorId,
        reportedBy: null, // 외부 시스템 자동 import
        citizenName: r.citizenName,
        citizenPhone: r.citizenPhone.replace(/-/g, ''),
        complainantPhone: r.citizenPhone.replace(/-/g, ''),
        type: 'BULKY_WASTE',
        description: `[PPAEGI:${r.externalId}] ${r.itemName} ${r.quantity}개${r.sizeNote ? ` (${r.sizeNote})` : ''} · 희망수거일 ${r.pickupDate} · 수수료 ${r.feePaid ? '납부' : '미납'}`,
        locationAddress: r.addressFull,
        status: 'RECEIVED',
        reportedAt: new Date(r.reportedAt),
      },
    });
    created++;
  }

  await prisma.bulkyWasteConfig.update({
    where: { id: config.id },
    data: { lastImportAt: new Date(), lastImportCount: created },
  });
  await prisma.bulkyWasteImport.create({
    data: {
      configId: config.id,
      triggerType,
      resultStatus: 'ok',
      fetched: fetched.length,
      created,
      resolved: 0,
      triggeredBy,
    },
  });

  return { ok: true, fetched: fetched.length, created, skipped };
}

export async function runBulkyResolve(
  configId: bigint,
  triggeredBy: bigint | null,
  triggerType: 'cron' | 'manual'
): Promise<ResolveResult> {
  const config = await prisma.bulkyWasteConfig.findUnique({ where: { id: configId } });
  if (!config) return { ok: false, resolved: 0, error: 'config_not_found' };

  /* 시안: 오늘 수거일이 지난 RECEIVED/ASSIGNED/IN_PROGRESS BULKY_WASTE → COMPLETED */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targets = await prisma.complaint.findMany({
    where: {
      contractorId: config.contractorId,
      type: 'BULKY_WASTE',
      status: { in: ['RECEIVED', 'ASSIGNED', 'IN_PROGRESS'] },
      reportedAt: { lte: today },
    },
    select: { id: true },
  });

  for (const t of targets) {
    await prisma.complaint.update({
      where: { id: t.id },
      data: {
        status: 'COMPLETED',
        resolveNote: '[PPAEGI 자동 처리] 빼기 수거일 도래 → 자동 완료',
        resolvedAt: new Date(),
      },
    });
  }

  await prisma.bulkyWasteConfig.update({
    where: { id: config.id },
    data: { lastResolveAt: new Date(), lastResolveCount: targets.length },
  });
  await prisma.bulkyWasteImport.create({
    data: {
      configId: config.id,
      triggerType,
      resultStatus: 'ok',
      fetched: 0,
      created: 0,
      resolved: targets.length,
      triggeredBy,
    },
  });

  return { ok: true, resolved: targets.length };
}

async function logFail(
  configId: bigint, triggeredBy: bigint | null, triggerType: 'cron' | 'manual', errorMessage: string
): Promise<ImportResult> {
  await prisma.bulkyWasteImport.create({
    data: {
      configId, triggerType, resultStatus: 'failed',
      fetched: 0, created: 0, resolved: 0,
      errorMessage, triggeredBy,
    },
  });
  return { ok: false, fetched: 0, created: 0, skipped: 0, error: errorMessage };
}
