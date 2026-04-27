import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { getTodayAttendance } from '@/lib/attendance';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const data = await getTodayAttendance(session);
  if (data.isWorker) {
    return NextResponse.json({
      role: session.role,
      record: data.me
        ? {
            id: data.me.id.toString(),
            workerName: data.me.worker.name,
            zoneName: data.me.zone?.zoneName ?? null,
            checkInTime: data.me.checkInTime?.toISOString() ?? null,
            checkOutTime: data.me.checkOutTime?.toISOString() ?? null,
            workType: data.me.workType,
            status: data.me.status,
          }
        : null,
    });
  }
  return NextResponse.json({
    role: session.role,
    summary: data.summary,
    records: data.cards,
  });
}
