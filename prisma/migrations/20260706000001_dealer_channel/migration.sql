-- dealer-channel Design §3.1 — 전부 additive. 기존 테이블/컬럼/enum 값 삭제·변경 없음.
-- worker_zones 관련 드리프트(스키마 파일 vs 실제 프로덕션 DB의 사전 존재하던 차이)는
-- 이번 작업 범위와 무관하여 의도적으로 제외함(별도 확인 필요 — 세션 요약 참고).

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DEALER';

-- AlterTable
ALTER TABLE "contractors" ADD COLUMN     "dealer_id" BIGINT,
ADD COLUMN     "demo_expires_at" TIMESTAMP(3),
ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "municipalities" ADD COLUMN     "demo_expires_at" TIMESTAMP(3),
ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "leads" (
    "id" BIGSERIAL NOT NULL,
    "dealer_id" BIGINT NOT NULL,
    "prospect_name" VARCHAR(100) NOT NULL,
    "prospect_contact" VARCHAR(50),
    "referral_code" VARCHAR(30) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" BIGINT,
    "contractor_id" BIGINT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_commissions" (
    "id" BIGSERIAL NOT NULL,
    "dealer_id" BIGINT NOT NULL,
    "contractor_id" BIGINT NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_referral_code_key" ON "leads"("referral_code");

-- CreateIndex
CREATE INDEX "leads_dealer_id_status_idx" ON "leads"("dealer_id", "status");

-- CreateIndex
CREATE INDEX "dealer_commissions_dealer_id_idx" ON "dealer_commissions"("dealer_id");

-- CreateIndex
CREATE INDEX "contractors_dealer_id_idx" ON "contractors"("dealer_id");

-- CreateIndex
CREATE INDEX "contractors_is_demo_demo_expires_at_idx" ON "contractors"("is_demo", "demo_expires_at");

-- CreateIndex
CREATE INDEX "municipalities_is_demo_demo_expires_at_idx" ON "municipalities"("is_demo", "demo_expires_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_commissions" ADD CONSTRAINT "dealer_commissions_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_commissions" ADD CONSTRAINT "dealer_commissions_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
