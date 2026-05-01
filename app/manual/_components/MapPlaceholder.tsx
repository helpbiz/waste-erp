/** 지도 영역 목업 — 회색 배경 + 핀 + 라벨. 실제 Leaflet 대신 SVG 모방. */
export default function MapPlaceholder({
  pinX = '50%',
  pinY = '50%',
  label,
  height = 140,
}: {
  pinX?: string;
  pinY?: string;
  label?: string;
  height?: number;
}) {
  return (
    <div className="mock-map" style={{ height }}>
      {/* 격자 배경 */}
      <svg className="mock-map-grid" aria-hidden>
        <defs>
          <pattern id="mockgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#cbd5e1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mockgrid)" />
      </svg>
      <div className="mock-map-pin" style={{ left: pinX, top: pinY }} aria-hidden>
        <span className="mock-map-pin-dot" />
      </div>
      {label && <div className="mock-map-label">{label}</div>}
    </div>
  );
}
