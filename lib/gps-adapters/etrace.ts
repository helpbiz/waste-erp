/**
 * ETRACE GPS 어댑터
 * SEQ 기반 증분 Pull — pos_last_seq.jsp + pos_json.jsp
 *
 * 좌표 주의:
 *  - LAT/LON 필드는 정수 절사값(37, 126)으로 사용 불가
 *  - X_COORD/Y_COORD 필드가 한국 TM 투영 좌표 (EPSG:5186 계열)
 *  - xYToWgs84()로 WGS84 변환
 *
 * 상태 관리:
 *  - persistentPositions: contractorId별 차량 최신 위치를 서버 메모리에 누적 유지
 *    (캐시 만료 후 재조회해도 이전 차량 위치 유지)
 *  - lastFetchAt: API 과호출 방지용 쓰로틀
 */

const ETRACE_LAST_SEQ_PATH = '/pos_last_seq.jsp';
const ETRACE_POS_JSON_PATH = '/pos_json.jsp';

/* 처음 조회할 때 최신 SEQ에서 얼마나 뒤로 볼지 */
const INITIAL_SEQ_LOOKBACK = 1000;

/* 2점 선형 회귀로 도출한 TM → WGS84 변환 계수
 * Ref 1: 서울 용산구 이촌로 X=307765, Y=548205 → 37.5231°N 126.9677°E
 * Ref 2: 창원 성산구  (copyroute 예제) X=462104, Y=291601 → 35.2215°N 128.6801°E
 * 한반도 내 오차 ≈ 100m 수준 */
const TM_A = 8.9701e-6;   // Y → lat 스케일 (°/m)
const TM_B = 32.6080;     // lat 오프셋 (°)
const TM_C = 1.1094e-5;   // X → lng 스케일 (°/m)
const TM_D = 123.5528;    // lng 오프셋 (°)

function xYToWgs84(x: number, y: number): { lat: number; lng: number } {
  return {
    lat: Math.round((y * TM_A + TM_B) * 1e6) / 1e6,
    lng: Math.round((x * TM_C + TM_D) * 1e6) / 1e6,
  };
}

interface EtraceRawPosition {
  SEQ: number;
  VEH_PLATES: string;
  LAT: number;
  LON: number;
  X_COORD?: number;
  Y_COORD?: number;
  DIRECTION: number;
  SPEED: number;
  GPS_TIME: string;   // YYYYMMDDHHMMSS
  LOCATION?: string;
}

export interface NormalizedPosition {
  vehicleNo: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  gpsTime: string | null;
  location: string | null;
}

interface PerContractorState {
  positions: Map<string, NormalizedPosition>;   // vehicleNo → 최신 위치 (누적)
  lastSeq: number;
  lastFetchAt: number;
}

/* 서버 메모리 상태 — contractorId string → 상태 */
const _state = new Map<string, PerContractorState>();

function gpsTimeToIso(t: string): string | null {
  if (!t || t.length < 14) return null;
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}+09:00`;
}

async function etracePost(baseUrl: string, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`ETRACE HTTP ${res.status} on ${path}`);
  return res.json();
}

function normalizePosition(raw: EtraceRawPosition): NormalizedPosition | null {
  /* LAT/LON이 정수이면 X_COORD/Y_COORD로 변환 */
  let lat: number, lng: number;
  const latIsInt = Number.isInteger(raw.LAT);
  const lonIsInt = Number.isInteger(raw.LON);

  if ((latIsInt || lonIsInt) && raw.X_COORD != null && raw.Y_COORD != null) {
    const wgs = xYToWgs84(raw.X_COORD, raw.Y_COORD);
    lat = wgs.lat;
    lng = wgs.lng;
  } else if (!latIsInt && !lonIsInt) {
    lat = raw.LAT;
    lng = raw.LON;
  } else {
    return null;   // 유효 좌표 없음
  }

  /* 한반도 범위 외 제외 (변환 오류 방어) */
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) return null;

  return {
    vehicleNo: raw.VEH_PLATES,
    lat,
    lng,
    speed: Math.round(raw.SPEED ?? 0),
    heading: raw.DIRECTION ?? 0,
    gpsTime: gpsTimeToIso(raw.GPS_TIME),
    location: raw.LOCATION ?? null,
  };
}

export interface EtraceResult {
  positions: Map<string, NormalizedPosition>;
  lastSeq: number;
  newLastSeq: number;
}

export async function fetchEtracePositions(opts: {
  baseUrl: string;
  apiKey: string;
  lastSeq: number | null;        // DB에 저장된 마지막 SEQ
  contractorId: string;
  throttleMs?: number;           // 최소 API 호출 간격 (기본 refreshSec * 1000)
}): Promise<EtraceResult> {
  const { baseUrl, apiKey, contractorId, throttleMs = 5_000 } = opts;
  const base = baseUrl.replace(/\/$/, '');

  const current = _state.get(contractorId);

  /* 쓰로틀: 마지막 API 호출로부터 throttleMs 미만이면 누적 캐시 반환 */
  if (current && Date.now() - current.lastFetchAt < throttleMs) {
    return { positions: current.positions, lastSeq: current.lastSeq, newLastSeq: current.lastSeq };
  }

  /* Step 1: ETRACE 최신 SEQ 조회 */
  const seqData = await etracePost(base, ETRACE_LAST_SEQ_PATH, { key: apiKey }) as { msg: string; output?: { SEQ: number } };
  if (seqData.msg !== 'ok' || !seqData.output?.SEQ) {
    throw new Error('ETRACE pos_last_seq 응답 오류');
  }
  const latestSeq: number = seqData.output.SEQ;

  /* Step 2: 조회 시작 SEQ 결정
   * - in-memory 상태 있음 → 마지막 처리 SEQ 이후 (증분)
   * - in-memory 없음 (첫 조회 또는 재시작 후) → lookback으로 차량 전체 위치 복구 */
  const baseSeq = current?.lastSeq ?? opts.lastSeq;
  const fromSeq = current ? (baseSeq ?? latestSeq - INITIAL_SEQ_LOOKBACK) : latestSeq - INITIAL_SEQ_LOOKBACK;

  const posData = await etracePost(base, ETRACE_POS_JSON_PATH, {
    key: apiKey,
    input: { SEQ: fromSeq },
  }) as { msg: string; positions?: EtraceRawPosition[] };

  if (posData.msg !== 'ok') throw new Error('ETRACE pos_json 응답 오류');

  const rawList: EtraceRawPosition[] = posData.positions ?? [];

  /* Step 3: 기존 누적 위치에 새 데이터 병합 (차량별 최신 SEQ 우선) */
  const merged = new Map<string, NormalizedPosition>(current?.positions ?? []);
  const seqTracker = new Map<string, number>();
  let newLastSeq = baseSeq ?? fromSeq;

  for (const raw of rawList) {
    const prev = seqTracker.get(raw.VEH_PLATES) ?? -1;
    if (raw.SEQ > prev) {
      seqTracker.set(raw.VEH_PLATES, raw.SEQ);
      const normalized = normalizePosition(raw);
      if (normalized) merged.set(raw.VEH_PLATES, normalized);
    }
    if (raw.SEQ > newLastSeq) newLastSeq = raw.SEQ;
  }

  _state.set(contractorId, {
    positions: merged,
    lastSeq: newLastSeq,
    lastFetchAt: Date.now(),
  });

  return { positions: merged, lastSeq: baseSeq ?? fromSeq, newLastSeq };
}
