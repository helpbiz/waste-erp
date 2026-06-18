import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { decryptField } from '@/lib/crypto';
import ProfileClient from './_profile-client';

export const dynamic = 'force-dynamic';

export default async function WorkerProfilePage() {
  const session = (await readSession())!;
  const id = BigInt(session.userId);

  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      position: true,
      department: true,
      profilePhoto: { select: { contentRef: true } },
      activeSignature: { include: { asset: { select: { contentRef: true } } } },
    },
  });
  if (!u) throw new Error('not_found');

  const [address, bankAccount, emergencyContact, emergencyPhone] = await Promise.all([
    decryptField(u.address).catch(() => null),
    decryptField(u.bankAccount).catch(() => null),
    decryptField(u.emergencyContact).catch(() => null),
    decryptField(u.emergencyPhone).catch(() => null),
  ]);

  return (
    <ProfileClient
      user={{
        id: u.id.toString(),
        name: u.name,
        employeeNo: u.employeeNo,
        phone: u.phone,
        birthDate: u.birthDate?.toISOString().slice(0, 10) ?? null,
        hireDate: u.hireDate?.toISOString().slice(0, 10) ?? null,
        address,
        bankName: u.bankName,
        bankAccount,
        emergencyContact,
        emergencyPhone,
        positionLabel: u.position?.label ?? null,
        positionCategory: u.position?.category ?? null,
        departmentName: u.department?.name ?? null,
        profilePhotoUrl: u.profilePhoto?.contentRef ?? null,
        activeSignatureRef: u.activeSignature?.signatureRef ?? null,
        activeSignatureUrl: u.activeSignature?.asset.contentRef ?? null,
      }}
    />
  );
}
