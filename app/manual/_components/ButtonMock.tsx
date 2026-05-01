/** CTA 버튼 목업 — primary/secondary/disabled/danger/success 변형. */
export default function ButtonMock({
  label,
  variant = 'primary',
  fullWidth = true,
  highlighted = false,
}: {
  label: string;
  variant?: 'primary' | 'secondary' | 'disabled' | 'danger' | 'success';
  fullWidth?: boolean;
  /** true면 옆에 노란색 강조 링/번호로 매뉴얼 step과 연결 */
  highlighted?: boolean;
}) {
  return (
    <div
      className="mock-button"
      data-variant={variant}
      data-fullwidth={fullWidth}
      data-highlighted={highlighted}
    >
      {label}
    </div>
  );
}
