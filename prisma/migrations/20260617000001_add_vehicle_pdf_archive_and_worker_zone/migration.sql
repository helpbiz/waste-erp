-- 차량일지 PDF 보관 이력 테이블
CREATE TABLE "vehicle_pdf_archives" (
  "id"            BIGSERIAL PRIMARY KEY,
  "contractor_id" BIGINT        NOT NULL,
  "log_date"      DATE          NOT NULL,
  "vehicle_id"    BIGINT,
  "vehicle_no"    VARCHAR(20),
  "file_path"     VARCHAR(500)  NOT NULL,
  "file_size"     INTEGER       NOT NULL,
  "page_count"    INTEGER       NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "created_by"    BIGINT        NOT NULL,
  CONSTRAINT "vehicle_pdf_archives_contractor_id_fkey"
    FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id"),
  CONSTRAINT "vehicle_pdf_archives_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
);
CREATE INDEX "vehicle_pdf_archives_contractor_id_log_date_idx"
  ON "vehicle_pdf_archives"("contractor_id", "log_date");

-- 작업자별 담당구역 지정 테이블 (No.6 — 0617)
CREATE TABLE "worker_zones" (
  "id"            BIGSERIAL PRIMARY KEY,
  "user_id"       BIGINT        NOT NULL,
  "contractor_id" BIGINT        NOT NULL,
  "zone_id"       BIGINT        NOT NULL,
  "dong_id"       BIGINT,
  "address_type"  VARCHAR(10),
  "address"       VARCHAR(200),
  "memo"          TEXT,
  "created_at"    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "worker_zones_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id"),
  CONSTRAINT "worker_zones_contractor_id_fkey"
    FOREIGN KEY ("contractor_id") REFERENCES "contractors"("id"),
  CONSTRAINT "worker_zones_zone_id_fkey"
    FOREIGN KEY ("zone_id") REFERENCES "cleaning_zones"("id"),
  CONSTRAINT "worker_zones_dong_id_fkey"
    FOREIGN KEY ("dong_id") REFERENCES "admin_dongs"("id")
);
CREATE UNIQUE INDEX "worker_zones_user_id_zone_id_dong_id_key"
  ON "worker_zones"("user_id", "zone_id", "dong_id");
CREATE INDEX "worker_zones_contractor_id_user_id_idx"
  ON "worker_zones"("contractor_id", "user_id");
