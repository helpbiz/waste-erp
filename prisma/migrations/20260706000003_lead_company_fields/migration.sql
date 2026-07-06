-- dealer-channel 승인플로우 간소화(2026-07-06) — 딜러가 리드 등록/보강 시점에 입력하는
-- 회사정보 7필드. adminPassword는 의도적으로 제외(백도어 방지, 승인 시 자동생성).
-- worker_zones 관련 드리프트는 이전 마이그레이션들과 동일하게 무관한 기존 이슈로 제외.

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "admin_name" VARCHAR(50),
ADD COLUMN     "admin_username" VARCHAR(50),
ADD COLUMN     "contractor_business_no" VARCHAR(20),
ADD COLUMN     "contractor_name" VARCHAR(100),
ADD COLUMN     "municipality_code" VARCHAR(20),
ADD COLUMN     "municipality_name" VARCHAR(100),
ADD COLUMN     "municipality_region" VARCHAR(50);
