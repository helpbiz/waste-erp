/** 상태 배지 목업 — info/warn/success/danger/neutral. */
export default function StatusChipMock({
  label,
  tone = 'info',
}: {
  label: string;
  tone?: 'info' | 'warn' | 'success' | 'danger' | 'neutral';
}) {
  return <span className="mock-chip" data-tone={tone}>{label}</span>;
}
