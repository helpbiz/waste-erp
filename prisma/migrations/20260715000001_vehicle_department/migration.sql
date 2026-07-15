-- 차량별 부서 등록(설정) 기능 — additive. 기존 vehicles 데이터 변경 없음(전부 NULL로 시작).

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "department_id" BIGINT;

-- CreateIndex
CREATE INDEX "vehicles_department_id_idx" ON "vehicles"("department_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
