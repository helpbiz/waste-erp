/**
 * 공지사항 관리 페이지 — 관리자(SUPER/CONTRACTOR/INTERNAL)만 접근.
 */
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { isAvacContractor, getAvacFacilities } from '@/lib/features';
import { prisma } from '@/lib/db';
import AnnouncementsClient from './_announcements-client';

export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const session = await readSession();
  if (!session) redirect('/login?next=/announcements');
  const POSTERS = ['SUPER_ADMIN', 'CONTRACTOR_ADMIN', 'INTERNAL_ADMIN', 'MUNI_ADMIN'];

  /* isNoticeManager 플래그가 있는 근로자도 접근 허용 */
  let isNoticeManager = false;
  if (!POSTERS.includes(session.role)) {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.userId) },
      select: { isNoticeManager: true },
    });
    isNoticeManager = user?.isNoticeManager ?? false;
    if (!isNoticeManager) redirect('/dashboard');
  }

  const contractorBigId = session.contractorId ? BigInt(session.contractorId) : null;
  const isAvac = contractorBigId ? await isAvacContractor(contractorBigId) : false;
  const facilities = isAvac && contractorBigId
    ? (await getAvacFacilities(contractorBigId)).map((f) => ({ id: f.id.toString(), name: f.name }))
    : [];

  return (
    <AnnouncementsClient
      session={{ name: session.name, role: session.role, isNoticeManager }}
      isAvac={isAvac}
      facilities={facilities}
    />
  );
}
