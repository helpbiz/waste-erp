-- 지자체 모드 그룹 데모(MUNI_ADMIN 매직링크) 전용 토큰 컬럼 (worker_zones 기존 drift는 제외)
ALTER TABLE "municipalities" ADD COLUMN "demo_access_token" TEXT;
CREATE UNIQUE INDEX "municipalities_demo_access_token_key" ON "municipalities"("demo_access_token");
