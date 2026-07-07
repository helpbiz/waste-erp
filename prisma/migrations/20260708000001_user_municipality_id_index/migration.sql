-- dealer-channel 지자체 모드 데모 확장 준비 — 데모 cleanup이 municipality_id+role로
-- MUNI_ADMIN 데모 계정을 조회하므로 인덱스 추가 (worker_zones 기존 drift는 제외).
CREATE INDEX "users_municipality_id_idx" ON "users"("municipality_id");
