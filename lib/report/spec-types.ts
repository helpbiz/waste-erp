// Design Ref: §3.4 — spec JSON 스키마
// Plan SC: F-02 첫 reference, 후속 양식(F-07/F-09) 재사용 전제.

export type ReportPageSpec = {
  format: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margin: string; // "10mm"
};

export type ReportHeaderLeft =
  | { type: 'logo'; src: string; width?: number }
  | { type: 'text'; text: string };

export type ReportHeaderMeta = { label: string; value: string };

export type ReportHeaderSpec = {
  left?: ReportHeaderLeft;
  title: string;
  meta?: ReportHeaderMeta[];
};

export type ReportSummarySpec = {
  type: 'cards';
  groupBy: string;                                 // "materialCategory"
  metric: { field: string; agg: 'sum' | 'count' | 'avg'; unit?: string };
  labels?: Record<string, string>;                 // enum → 한글 라벨
};

export type ReportColumnSpec = {
  label: string;
  type?: 'rowNumber';
  field?: string;                                  // dot-path: "vehicle.plateNumber"
  fallback?: string;
  format?: string;                                 // "0.000"
  align?: 'left' | 'right' | 'center';
  width?: string;                                  // "12%" | "120px"
  labelMap?: string;                               // "summary.labels"
};

export type ReportTableSpec = {
  source: 'RecyclingCenterIntake';                 // v1: 단일 소스. 후속에서 union 확장
  filter?: Record<string, string>;                 // { intakeDate: "{{date}}" }
  orderBy?: Record<string, 'asc' | 'desc'>[];
  include?: Record<string, boolean>;               // { vehicle: true, facility: true }
  columns: ReportColumnSpec[];
  footer?: {
    label: string;
    totals?: { field: string; agg: 'sum' | 'count' | 'avg' }[];
  };
};

export type ReportFooterSignature = { label: string; width?: number };
export type ReportFooterMeta = { label: string; value: string };
export type ReportFooterSpec = {
  signatures?: ReportFooterSignature[];
  metadata?: ReportFooterMeta[];
};

export type ReportSpec = {
  page: ReportPageSpec;
  header: ReportHeaderSpec;
  summary?: ReportSummarySpec;
  table: ReportTableSpec;
  footer?: ReportFooterSpec;
};

/* ─────────────────────────  Resolved Data  ───────────────────────── */
// data-resolver.ts 출력 = html-renderer 입력

export type ReportData = {
  header: {
    contractor: { id: string; companyName: string; businessNo: string; logoUrl: string | null };
    municipality: { id: string; name: string; code: string } | null;
    date: string; // YYYY-MM-DD
  };
  summary: { category: string; label: string; totalTon: number }[];
  rows: Array<{
    no: number;
    vehiclePlate: string | null;
    intakeTime: string;       // HH:mm
    facilityName: string | null;
    materialCategory: string;
    weightTon: number;
    note: string | null;
  }>;
  totals: { weightTon: number };
  meta: {
    generatedAt: string;      // ISO
    generatedBy: { id: string; name: string };
  };
};

export type ReportContext = {
  date: string;               // YYYY-MM-DD
  contractorId: string;       // session contractor or override
  user: { id: string; name: string };
};
