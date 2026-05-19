-- AdminDong 면적 필드 추가 (cost API 연동으로 자동 입력)
ALTER TABLE "admin_dongs" ADD COLUMN IF NOT EXISTS "area_km2" DECIMAL(10,4);
