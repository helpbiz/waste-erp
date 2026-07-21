-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('DAY', 'NIGHT', 'DAWN');

-- CreateTable
CREATE TABLE "shift_policies" (
    "id" BIGSERIAL NOT NULL,
    "contractor_id" BIGINT NOT NULL,
    "department_id" BIGINT,
    "worker_id" BIGINT,
    "shift_type" "ShiftType" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "check_in_recognize_from" VARCHAR(5),
    "check_in_recognize_until" VARCHAR(5),
    "check_out_recognize_from" VARCHAR(5),
    "check_out_recognize_until" VARCHAR(5),
    "check_out_next_day" BOOLEAN NOT NULL DEFAULT false,
    "off_days" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_policies_contractor_id_active_idx" ON "shift_policies"("contractor_id", "active");

-- CreateIndex
CREATE INDEX "shift_policies_contractor_id_worker_id_idx" ON "shift_policies"("contractor_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "shift_policies_contractor_id_department_id_worker_id_shift__key" ON "shift_policies"("contractor_id", "department_id", "worker_id", "shift_type");

-- AddForeignKey
ALTER TABLE "shift_policies" ADD CONSTRAINT "shift_policies_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_policies" ADD CONSTRAINT "shift_policies_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_policies" ADD CONSTRAINT "shift_policies_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_policies" ADD CONSTRAINT "shift_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

