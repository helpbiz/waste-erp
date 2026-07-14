-- 반입입력 성상 마스터 신설 — additive. 기존 recycling_center_intake.material_category 컬럼은 변경 없음(자유 문자열 유지).
-- 기존 하드코딩 4종(일반/음식물/재활용/폐목재)을 계약업체별로 backfill 하여 하위호환 유지.

-- CreateTable
CREATE TABLE "intake_material_categories" (
    "id" BIGSERIAL NOT NULL,
    "contractor_id" BIGINT NOT NULL,
    "label" VARCHAR(20) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_material_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intake_material_categories_contractor_id_label_key" ON "intake_material_categories"("contractor_id", "label");

-- AddForeignKey
ALTER TABLE "intake_material_categories" ADD CONSTRAINT "intake_material_categories_contractor_id_fkey" FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: 기존 하드코딩 4종 성상을 계약업체별로 삽입 (이후 신규 반입입력은 이 label 값을 그대로 materialCategory 로 저장).
-- 과거 저장된 영문 코드(GENERAL/FOOD/RECYCLING/WOOD) 값은 그대로 유지되며, 표시용 레거시 매핑은 앱 코드에서 처리한다.
INSERT INTO "intake_material_categories" ("contractor_id", "label", "sort_order", "is_active")
SELECT c.id, v.label, v.sort_order, true
FROM "contractors" c
CROSS JOIN (VALUES
  ('일반', 0),
  ('음식물', 1),
  ('재활용', 2),
  ('폐목재', 3)
) AS v(label, sort_order)
ON CONFLICT ("contractor_id", "label") DO NOTHING;
