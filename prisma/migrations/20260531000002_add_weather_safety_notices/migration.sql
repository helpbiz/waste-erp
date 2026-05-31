CREATE TABLE "weather_safety_notices" (
  "id"            BIGSERIAL PRIMARY KEY,
  "contractor_id" BIGINT NOT NULL REFERENCES "contractors"("id") ON DELETE CASCADE,
  "notice_date"   DATE NOT NULL,
  "alert_type"    VARCHAR(20) NOT NULL DEFAULT 'HEATWAVE',
  "title"         VARCHAR(100) NOT NULL,
  "content"       TEXT,
  "created_by"    BIGINT NOT NULL REFERENCES "users"("id"),
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "weather_safety_notices_contractor_date_idx" ON "weather_safety_notices"("contractor_id", "notice_date");

CREATE TABLE "weather_safety_photos" (
  "id"          BIGSERIAL PRIMARY KEY,
  "notice_id"   BIGINT NOT NULL REFERENCES "weather_safety_notices"("id") ON DELETE CASCADE,
  "worker_id"   BIGINT NOT NULL REFERENCES "users"("id"),
  "photo_data"  TEXT NOT NULL,
  "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("notice_id", "worker_id")
);
