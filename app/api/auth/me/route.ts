import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { canMutate } from '@/lib/rbac';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      id: session.userId,
      name: session.name,
      role: session.role,
      contractorId: session.contractorId,
      municipalityId: session.municipalityId,
      canMutate: canMutate(session.role),
    },
  });
}
