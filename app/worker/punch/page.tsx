import { readSession } from '@/lib/auth';
import { getTodayAttendance } from '@/lib/attendance';
import PunchClient from './_punch-client';

export const dynamic = 'force-dynamic';

export default async function PunchPage() {
  const session = (await readSession())!;
  const att = await getTodayAttendance(session);
  const me = att.isWorker ? att.me : null;

  const initial = {
    checkInTime: me?.checkInTime?.toISOString() ?? null,
    checkOutTime: me?.checkOutTime?.toISOString() ?? null,
    zoneName: me?.zone?.zoneName ?? null,
  };

  return <PunchClient initial={initial} workerName={session.name} />;
}
