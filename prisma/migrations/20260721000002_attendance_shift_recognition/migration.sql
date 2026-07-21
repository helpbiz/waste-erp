-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "is_early_leave" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_late" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shift_policy_id" BIGINT;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_policy_id_fkey" FOREIGN KEY ("shift_policy_id") REFERENCES "shift_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

