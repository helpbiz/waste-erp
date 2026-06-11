-- P3-1: monthly_attendance_summary isFinalized + yearMonth 복합 인덱스
-- payslips/prefill, attendance/finalize 등에서 isFinalized=true 필터링 성능 개선
CREATE INDEX "monthly_attendance_summary_is_finalized_year_month_idx"
  ON "monthly_attendance_summary"("is_finalized", "year_month");

-- P3-2: vehicle_logs driver_id 단독 인덱스
-- 운전자별 운행일지 조회 성능 개선
CREATE INDEX "vehicle_logs_driver_id_idx"
  ON "vehicle_logs"("driver_id");
