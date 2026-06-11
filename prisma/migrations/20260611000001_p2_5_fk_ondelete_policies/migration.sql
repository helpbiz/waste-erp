-- P2-5: FK onDelete 정책 명시
-- vehicle_gps_positions.vehicle_id: RESTRICT → CASCADE (차량 삭제 시 GPS 포지션 자동 삭제)
-- 그 외 nullable FK(vehicle.driver/passenger, dept.head, etc.)는 Prisma 기본값(SET NULL)이 DB와
-- 이미 일치하므로 constraint 재생성 없이 schema 선언만 추가.

ALTER TABLE "vehicle_gps_positions"
  DROP CONSTRAINT "vehicle_gps_positions_vehicle_id_fkey";

ALTER TABLE "vehicle_gps_positions"
  ADD CONSTRAINT "vehicle_gps_positions_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
