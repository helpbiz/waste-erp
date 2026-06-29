-- 날씨공지 관리자 첨부 사진 컬럼 추가
ALTER TABLE "weather_safety_notices"
  ADD COLUMN IF NOT EXISTS "notice_photo" TEXT;

-- 체감온도 타입 변경: INTEGER → FLOAT (소수점 허용)
ALTER TABLE "weather_safety_photos"
  ALTER COLUMN "feels_like" TYPE FLOAT USING "feels_like"::FLOAT;
