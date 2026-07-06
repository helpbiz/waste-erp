-- 2026-07-06 예비고객 직접접속 매직링크 — 데모(isDemo=true) Contractor 전용 토큰 컬럼.
-- worker_zones 관련 드리프트는 이전 마이그레이션들과 동일하게 무관한 기존 이슈로 제외.

-- AlterTable
ALTER TABLE "contractors" ADD COLUMN     "demo_access_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contractors_demo_access_token_key" ON "contractors"("demo_access_token");
