/**
 * HealthRecord 암복호화 래퍼 (async — KMS 호출 가능)
 */
import type { HealthRecord } from '@prisma/client';
import { encryptField, encryptNumber, decryptField, decryptNumber } from '@/lib/crypto';
import { logger } from '@/lib/logger';

export type HealthRecordPlain = {
  lastCheckupDate: string | null;
  bloodPressureSys: number | null;
  bloodPressureDia: number | null;
  heartRate: number | null;
  bloodSugar: number | null;
  visionLeft: number | null;
  visionRight: number | null;
  hearingLeft: string | null;
  hearingRight: string | null;
  bloodType: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  emergencyContact: string | null;
  notes: string | null;
};

export async function decryptHealthRecord(r: HealthRecord | null): Promise<HealthRecordPlain | null> {
  if (!r) return null;
  try {
    const [
      bps, bpd, hr, bs, vl, vr,
      hl, hrr, bt, al, cc, ec, nt,
    ] = await Promise.all([
      decryptNumber(r.bloodPressureSys),
      decryptNumber(r.bloodPressureDia),
      decryptNumber(r.heartRate),
      decryptNumber(r.bloodSugar),
      decryptNumber(r.visionLeft),
      decryptNumber(r.visionRight),
      decryptField(r.hearingLeft),
      decryptField(r.hearingRight),
      decryptField(r.bloodType),
      decryptField(r.allergies),
      decryptField(r.chronicConditions),
      decryptField(r.emergencyContact),
      decryptField(r.notes),
    ]);
    return {
      lastCheckupDate: r.lastCheckupDate ? r.lastCheckupDate.toISOString().slice(0, 10) : null,
      bloodPressureSys: bps,
      bloodPressureDia: bpd,
      heartRate: hr,
      bloodSugar: bs,
      visionLeft: vl,
      visionRight: vr,
      hearingLeft: hl,
      hearingRight: hrr,
      bloodType: bt,
      allergies: al,
      chronicConditions: cc,
      emergencyContact: ec,
      notes: nt,
    };
  } catch (e) {
    logger.warn('health_decrypt_fail', { workerId: r.workerId?.toString(), err: String(e) });
    return null;
  }
}

export type HealthRecordWriteInput = Partial<HealthRecordPlain>;

export type EncryptedHealthInput = {
  lastCheckupDate?: Date | null;
  bloodPressureSys?: string | null;
  bloodPressureDia?: string | null;
  heartRate?: string | null;
  bloodSugar?: string | null;
  visionLeft?: string | null;
  visionRight?: string | null;
  hearingLeft?: string | null;
  hearingRight?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  emergencyContact?: string | null;
  notes?: string | null;
};

export async function encryptHealthRecordInput(input: HealthRecordWriteInput): Promise<EncryptedHealthInput> {
  const out: EncryptedHealthInput = {};
  if ('lastCheckupDate' in input) out.lastCheckupDate = input.lastCheckupDate ? new Date(input.lastCheckupDate) : null;
  if ('bloodPressureSys' in input) out.bloodPressureSys = await encryptNumber(input.bloodPressureSys);
  if ('bloodPressureDia' in input) out.bloodPressureDia = await encryptNumber(input.bloodPressureDia);
  if ('heartRate' in input) out.heartRate = await encryptNumber(input.heartRate);
  if ('bloodSugar' in input) out.bloodSugar = await encryptNumber(input.bloodSugar);
  if ('visionLeft' in input) out.visionLeft = await encryptNumber(input.visionLeft);
  if ('visionRight' in input) out.visionRight = await encryptNumber(input.visionRight);
  if ('hearingLeft' in input) out.hearingLeft = await encryptField(input.hearingLeft);
  if ('hearingRight' in input) out.hearingRight = await encryptField(input.hearingRight);
  if ('bloodType' in input) out.bloodType = await encryptField(input.bloodType);
  if ('allergies' in input) out.allergies = await encryptField(input.allergies);
  if ('chronicConditions' in input) out.chronicConditions = await encryptField(input.chronicConditions);
  if ('emergencyContact' in input) out.emergencyContact = await encryptField(input.emergencyContact);
  if ('notes' in input) out.notes = await encryptField(input.notes);
  return out;
}
