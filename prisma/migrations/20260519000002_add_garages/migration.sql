CREATE TABLE "garages" (
  "id"            BIGSERIAL PRIMARY KEY,
  "contractor_id" BIGINT NOT NULL REFERENCES "contractors"("id") ON DELETE CASCADE,
  "name"          VARCHAR(50),
  "address"       VARCHAR(255) NOT NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "garages_contractor_id_idx" ON "garages"("contractor_id");
