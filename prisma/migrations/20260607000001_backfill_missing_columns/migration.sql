-- Backfill: 마이그레이션 파일에 누락된 컬럼들 (DB에는 이미 존재)
-- IF NOT EXISTS를 사용하여 이미 있는 컬럼은 스킵

-- users: 역할별 권한 플래그 (is_payroll_manager는 20260518000001에서 처리됨)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_notice_manager"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_tbm_manager"       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_complaint_manager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_facility_operator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rank_id"               BIGINT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contractor_position_id" BIGINT;

-- weather_safety_photos: 근로자 휴식 기록 상세 필드
ALTER TABLE "weather_safety_photos" ADD COLUMN IF NOT EXISTS "record_time"  VARCHAR(5);
ALTER TABLE "weather_safety_photos" ADD COLUMN IF NOT EXISTS "feels_like"   INTEGER;
ALTER TABLE "weather_safety_photos" ADD COLUMN IF NOT EXISTS "action_taken" TEXT;
ALTER TABLE "weather_safety_photos" ADD COLUMN IF NOT EXISTS "manager_name" VARCHAR(50);

-- vehicle_logs: 상태값 및 수정시각 (테이블 자체는 초기 스키마에서 생성됨)
ALTER TABLE "vehicle_logs" ADD COLUMN IF NOT EXISTS "status"     VARCHAR(20) NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "vehicle_logs" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
