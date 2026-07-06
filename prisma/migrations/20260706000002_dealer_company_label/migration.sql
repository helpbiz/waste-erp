-- dealer-channel Design §3.1 확장 — DEALER 표시용 라벨(순수 문자열, 그룹 권한/집계 없음).
-- worker_zones 관련 드리프트는 20260706000001_dealer_channel과 동일하게 무관한 기존 이슈로 제외.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dealer_company" VARCHAR(100);
