import { prisma } from '@/lib/db';
import DetailClient, { type Detail } from './_detail-client';

export const dynamic = 'force-dynamic';

export default async function CitizenComplaintDetail({ params }: { params: { id: string } }) {
  let id: bigint;
  try { id = BigInt(params.id); } catch { return <div className="p-6 text-center text-sm font-bold">잘못된 민원번호</div>; }

  const c = await prisma.complaint.findUnique({ where: { id } });
  if (!c || !c.citizenPhone) {
    return <div className="p-6 text-center text-sm font-bold text-ink-muted">민원을 찾을 수 없습니다.</div>;
  }

  const detail: Detail = {
    id: c.id.toString(),
    type: c.type,
    status: c.status,
    reportedAt: c.reportedAt.toISOString(),
    description: c.description,
    locationAddress: c.locationAddress,
    locationLat: c.locationLat ? Number(c.locationLat) : null,
    locationLng: c.locationLng ? Number(c.locationLng) : null,
    urgentTag: c.urgentTag,
    isUrgent: c.isUrgent,
    requestImage: c.requestImage,
    completionImage: c.completionImage,
    arrivalEta: c.arrivalEta?.toISOString() ?? null,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    resolveNote: c.resolveNote,
    satisfactionScore: c.satisfactionScore,
    satisfactionComment: c.satisfactionComment,
    satisfactionAt: c.satisfactionAt?.toISOString() ?? null,
    flaggedAsCandidate: c.flaggedAsCandidate,
    citizenPhone: c.citizenPhone,
  };

  return <DetailClient detail={detail} />;
}
