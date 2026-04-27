import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import BulkyWasteClient from './_bulky-waste-client';

export const dynamic = 'force-dynamic';

export default async function BulkyWastePage() {
  const session = (await readSession())!;
  const contractorId = session.contractorId ? BigInt(session.contractorId) : null;

  const config = contractorId
    ? await prisma.bulkyWasteConfig.findUnique({ where: { contractorId } })
    : null;

  const recentImports = config
    ? await prisma.bulkyWasteImport.findMany({
        where: { configId: config.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    : [];

  /* 최근 BULKY_WASTE 민원 (자동 import 결과) */
  const recentComplaints = contractorId
    ? await prisma.complaint.findMany({
        where: { contractorId, type: 'BULKY_WASTE' },
        orderBy: { reportedAt: 'desc' },
        take: 30,
        select: {
          id: true, status: true, citizenName: true, citizenPhone: true,
          locationAddress: true, description: true, reportedAt: true, resolvedAt: true,
        },
      })
    : [];

  return (
    <BulkyWasteClient
      canManage={session.role !== 'WORKER' && session.role !== 'MUNI_ADMIN'}
      config={config ? {
        id: config.id.toString(),
        ppaegiUsername: config.ppaegiUsername,
        hasPassword: !!config.ppaegiPasswordEnc,
        lastLoginAt: config.lastLoginAt?.toISOString() ?? null,
        lastLoginOk: config.lastLoginOk,
        lastLoginMessage: config.lastLoginMessage,
        importTimeKst: config.importTimeKst,
        resolveTimeKst: config.resolveTimeKst,
        autoEnabled: config.autoEnabled,
        adminDongCodes: config.adminDongCodes,
        lastImportAt: config.lastImportAt?.toISOString() ?? null,
        lastImportCount: config.lastImportCount,
        lastResolveAt: config.lastResolveAt?.toISOString() ?? null,
        lastResolveCount: config.lastResolveCount,
      } : null}
      recentImports={recentImports.map((i) => ({
        id: i.id.toString(),
        triggerType: i.triggerType,
        resultStatus: i.resultStatus,
        fetched: i.fetched,
        created: i.created,
        resolved: i.resolved,
        errorMessage: i.errorMessage,
        createdAt: i.createdAt.toISOString(),
      }))}
      recentComplaints={recentComplaints.map((c) => ({
        id: c.id.toString(),
        status: c.status,
        citizenName: c.citizenName,
        citizenPhone: c.citizenPhone,
        locationAddress: c.locationAddress,
        description: c.description,
        reportedAt: c.reportedAt.toISOString(),
        resolvedAt: c.resolvedAt?.toISOString() ?? null,
      }))}
    />
  );
}
