// Design Ref: §3.4 — table.columns + footer.totals
import type { ReportTableSpec, ReportColumnSpec, ReportData, ReportSpec } from '../spec-types';

export function ReportTable({
  spec,
  data,
  rootSpec,
}: {
  spec: ReportTableSpec;
  data: ReportData;
  rootSpec: ReportSpec;
}) {
  return (
    <section className="report-table">
      <table>
        <thead>
          <tr>
            {spec.columns.map((c, i) => (
              <th key={i} style={{ width: c.width, textAlign: c.align ?? 'left' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 && (
            <tr>
              <td colSpan={spec.columns.length} className="report-table__empty">
                반입 데이터가 없습니다.
              </td>
            </tr>
          )}
          {data.rows.map((row, ri) => (
            <tr key={ri}>
              {spec.columns.map((c, ci) => (
                <td key={ci} style={{ textAlign: c.align ?? 'left' }}>
                  {renderCell(c, row, ri, rootSpec)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {spec.footer && (
          <tfoot>
            <tr>
              <td
                colSpan={spec.columns.findIndex((c) => isTotalColumn(c, spec)) || 1}
                className="report-table__footer-label"
              >
                {spec.footer.label}
              </td>
              {spec.columns.map((c, ci) => {
                if (!isTotalColumn(c, spec)) {
                  /* 첫 번째 합계 컬럼 이전엔 colSpan에 포함된 상태 */
                  const totalIdx = spec.columns.findIndex((c2) => isTotalColumn(c2, spec));
                  if (ci < totalIdx) return null;
                  return <td key={ci}>&nbsp;</td>;
                }
                /* 합계 표시 */
                const total = spec.footer?.totals?.find((t) => t.field === c.field);
                if (!total) return <td key={ci}>&nbsp;</td>;
                const value = computeTotal(c.field!, total.agg, data);
                return (
                  <td key={ci} style={{ textAlign: c.align ?? 'left' }}>
                    {fmtByCol(c, value)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </section>
  );
}

function isTotalColumn(c: ReportColumnSpec, table: ReportTableSpec): boolean {
  return !!(c.field && table.footer?.totals?.some((t) => t.field === c.field));
}

function computeTotal(
  field: string,
  agg: 'sum' | 'count' | 'avg',
  data: ReportData,
): number {
  if (field === 'weightTon') {
    if (agg === 'sum') return data.totals.weightTon;
    if (agg === 'count') return data.rows.length;
    if (agg === 'avg' && data.rows.length > 0) {
      return data.totals.weightTon / data.rows.length;
    }
  }
  return 0;
}

function renderCell(
  c: ReportColumnSpec,
  row: ReportData['rows'][number],
  rowIndex: number,
  rootSpec: ReportSpec,
): string {
  if (c.type === 'rowNumber') return String(rowIndex + 1);
  const raw = c.field ? readField(c.field, row) : '';
  if (raw == null || raw === '') return c.fallback ?? '';
  /* labelMap (e.g. summary.labels) 적용 */
  if (c.labelMap) {
    const map = readLabelMap(c.labelMap, rootSpec);
    if (map && typeof raw === 'string' && raw in map) return map[raw];
  }
  return fmtByCol(c, raw);
}

function readField(path: string, row: ReportData['rows'][number]): unknown {
  const map: Record<string, keyof ReportData['rows'][number]> = {
    'vehicle.plateNumber': 'vehiclePlate',
    intakeTime: 'intakeTime',
    'facility.name': 'facilityName',
    'disposal_site.name': 'disposalSiteName',
    materialCategory: 'materialCategory',
    weightTon: 'weightTon',
    note: 'note',
  };
  const key = map[path];
  return key ? row[key] : undefined;
}

function readLabelMap(
  path: string,
  rootSpec: ReportSpec,
): Record<string, string> | null {
  if (path === 'summary.labels') return rootSpec.summary?.labels ?? null;
  return null;
}

function fmtByCol(c: ReportColumnSpec, value: unknown): string {
  if (c.format === '0.000' && typeof value === 'number') {
    return value.toFixed(3);
  }
  return value == null ? '' : String(value);
}
