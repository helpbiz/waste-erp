-- TBM 다중 등록권한자/1일 최대5회/서명대상 프리셋 — 전부 additive. 기존 tbm_sessions/tbm_signatures 컬럼·데이터 변경 없음.

-- CreateTable
CREATE TABLE "tbm_schedules" (
    "id" BIGSERIAL NOT NULL,
    "contractor_id" BIGINT NOT NULL,
    "label" VARCHAR(30) NOT NULL,
    "time_of_day" VARCHAR(5) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbm_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbm_schedules_contractor_id_label_key" ON "tbm_schedules"("contractor_id", "label");

-- AddForeignKey
ALTER TABLE "tbm_schedules" ADD CONSTRAINT "tbm_schedules_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: tbm_sessions.schedule_id (nullable — 기존 세션은 미지정 유지)
ALTER TABLE "tbm_sessions" ADD COLUMN "schedule_id" BIGINT;
ALTER TABLE "tbm_sessions" ADD CONSTRAINT "tbm_sessions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "tbm_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "tbm_manager_audiences" (
    "id" BIGSERIAL NOT NULL,
    "manager_id" BIGINT NOT NULL,
    "worker_id" BIGINT NOT NULL,

    CONSTRAINT "tbm_manager_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbm_manager_audiences_manager_id_worker_id_key" ON "tbm_manager_audiences"("manager_id", "worker_id");
CREATE INDEX "tbm_manager_audiences_worker_id_idx" ON "tbm_manager_audiences"("worker_id");

-- AddForeignKey
ALTER TABLE "tbm_manager_audiences" ADD CONSTRAINT "tbm_manager_audiences_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tbm_manager_audiences" ADD CONSTRAINT "tbm_manager_audiences_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "tbm_session_audiences" (
    "id" BIGSERIAL NOT NULL,
    "session_id" BIGINT NOT NULL,
    "worker_id" BIGINT NOT NULL,

    CONSTRAINT "tbm_session_audiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tbm_session_audiences_session_id_worker_id_key" ON "tbm_session_audiences"("session_id", "worker_id");
CREATE INDEX "tbm_session_audiences_worker_id_idx" ON "tbm_session_audiences"("worker_id");

-- AddForeignKey
ALTER TABLE "tbm_session_audiences" ADD CONSTRAINT "tbm_session_audiences_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tbm_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tbm_session_audiences" ADD CONSTRAINT "tbm_session_audiences_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
