-- 출퇴근 위치 제한 출근/퇴근 개별화 — 전부 additive. 기존 컬럼(require_location/lat/lng/radius_meters/location_label) 삭제·변경 없음.
-- 기존 규칙은 출근·퇴근 공용이었으므로 backfill 시 동일 값을 양쪽에 복제한다.

-- AlterTable
ALTER TABLE "punch_restrictions"
  ADD COLUMN "require_location_check_in" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "check_in_lat" DECIMAL(10,7),
  ADD COLUMN "check_in_lng" DECIMAL(11,7),
  ADD COLUMN "check_in_radius_meters" INTEGER,
  ADD COLUMN "check_in_location_label" VARCHAR(100),
  ADD COLUMN "require_location_check_out" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "check_out_lat" DECIMAL(10,7),
  ADD COLUMN "check_out_lng" DECIMAL(11,7),
  ADD COLUMN "check_out_radius_meters" INTEGER,
  ADD COLUMN "check_out_location_label" VARCHAR(100);

-- Backfill
UPDATE "punch_restrictions" SET
  "require_location_check_in" = "require_location",
  "check_in_lat" = "lat",
  "check_in_lng" = "lng",
  "check_in_radius_meters" = "radius_meters",
  "check_in_location_label" = "location_label",
  "require_location_check_out" = "require_location",
  "check_out_lat" = "lat",
  "check_out_lng" = "lng",
  "check_out_radius_meters" = "radius_meters",
  "check_out_location_label" = "location_label";
