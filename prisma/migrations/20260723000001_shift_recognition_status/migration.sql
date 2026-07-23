-- CreateEnum
CREATE TYPE "RecognitionStatus" AS ENUM ('EARLY', 'NORMAL', 'LATE', 'DELAYED');

-- DropIndex
DROP INDEX "shift_policies_contractor_id_department_id_worker_id_shift__key";

-- AlterTable
ALTER TABLE "attendance_records" DROP COLUMN "is_early_leave",
DROP COLUMN "is_late",
ADD COLUMN     "check_in_status" "RecognitionStatus",
ADD COLUMN     "check_out_status" "RecognitionStatus";

-- AlterTable
ALTER TABLE "shift_policies" ADD COLUMN     "day_of_week_override" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "shift_policies_contractor_id_department_id_worker_id_shift__key" ON "shift_policies"("contractor_id", "department_id", "worker_id", "shift_type", "day_of_week_override");

