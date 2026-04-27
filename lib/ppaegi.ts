/**
 * 빼기(bbegi.com) 앱 연동 — Mock Provider
 *
 * 로그인 URL: https://bbegi.com/login
 * 시안 단계: 실제 빼기 API/스크래핑은 비공개이므로 시뮬레이션.
 * Phase 2: 실제 HTTP 클라이언트 + 세션 쿠키 + HTML 파싱 통합.
 *
 * 사용 흐름:
 *   1) testLogin(creds) → 로그인 성공 여부 + 메시지
 *   2) fetchPickupRequests({ session, adminDongCodes, since? }) → 신청 목록
 *
 * 환경변수:
 *   PPAEGI_API_BASE  — 실서비스 API 베이스 URL (Phase 2)
 *   PPAEGI_LOGIN_URL — 기본값 https://bbegi.com/login
 */
export const PPAEGI_LOGIN_URL = process.env.PPAEGI_LOGIN_URL ?? 'https://bbegi.com/login';
import { createHash } from 'crypto';

export type PpaegiCreds = { username: string; password: string };

export type PpaegiLoginResult = {
  ok: boolean;
  message: string;
  session?: string;       // 로그인 토큰/쿠키
  loggedInAt: string;
};

export type PickupRequest = {
  externalId: string;     // 빼기 시스템의 신청번호
  itemName: string;       // 폐기물 품목 (예: 침대, 냉장고)
  quantity: number;
  sizeNote: string | null;
  pickupDate: string;     // YYYY-MM-DD (희망 수거일)
  adminDongCode: string;
  addressFull: string;
  citizenName: string;
  citizenPhone: string;
  feePaid: boolean;
  reportedAt: string;     // ISO
};

/**
 * 로그인 테스트
 * 시안: username 'test', password 6자 이상이면 성공
 * 운영: POST https://api.ppaegi.com/login (가정)
 */
export async function testLogin(creds: PpaegiCreds): Promise<PpaegiLoginResult> {
  const now = new Date().toISOString();
  /* 환경변수 PPAEGI_API_BASE 있으면 실제 호출 (Phase 2) */
  if (process.env.PPAEGI_API_BASE) {
    /* 실제 호출 자리 — 현재는 mock로 fallthrough */
  }

  if (!creds.username || creds.username.trim().length < 3) {
    return { ok: false, message: '아이디는 3자 이상', loggedInAt: now };
  }
  if (!creds.password || creds.password.length < 6) {
    return { ok: false, message: '비밀번호는 6자 이상', loggedInAt: now };
  }
  /* 시안 — 80% 확률 성공 (테스트 안정성을 위해 항상 성공으로 처리) */
  const session = createHash('sha256').update(creds.username + ':' + Date.now()).digest('hex').slice(0, 32);
  return { ok: true, message: `로그인 성공 (시안 모드 — Phase 2 실 빼기 API 통합)`, session, loggedInAt: now };
}

/**
 * 신청 목록 가져오기 — 시뮬: 행정동 코드별 5~12건 랜덤 생성
 */
export async function fetchPickupRequests(params: {
  session: string;
  adminDongCodes: string[];
  since?: Date;
}): Promise<PickupRequest[]> {
  if (process.env.PPAEGI_API_BASE) {
    /* 실제 호출 자리 (Phase 2) */
  }
  const items: PickupRequest[] = [];
  const items_pool = [
    { name: '침대 (싱글)', size: '120x200cm' },
    { name: '냉장고 (양문형)', size: '180L 이상' },
    { name: '쇼파 (3인용)', size: '2.1m' },
    { name: '책상', size: '1.4m' },
    { name: '의자', size: null },
    { name: '책장', size: '180cm 5단' },
    { name: '세탁기', size: '15kg' },
    { name: '에어컨', size: '벽걸이' },
    { name: '매트리스', size: '퀸' },
    { name: '식탁', size: '4인용' },
  ];
  const dongs = params.adminDongCodes.length > 0 ? params.adminDongCodes : ['1168010100', '1168010200'];
  const today = new Date();

  for (const dong of dongs) {
    const count = 5 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const item = items_pool[Math.floor(Math.random() * items_pool.length)];
      const pickup = new Date(today);
      pickup.setDate(today.getDate() + 1);
      const externalId = createHash('sha256')
        .update(`${dong}:${i}:${today.toISOString().slice(0, 10)}`)
        .digest('hex')
        .slice(0, 12)
        .toUpperCase();
      items.push({
        externalId,
        itemName: item.name,
        quantity: 1 + Math.floor(Math.random() * 3),
        sizeNote: item.size,
        pickupDate: pickup.toISOString().slice(0, 10),
        adminDongCode: dong,
        addressFull: `[${dong}] 서울시 강남구 ${dong.slice(-3)}번지 ${100 + i}`,
        citizenName: ['김민수', '이서연', '박지훈', '최지우', '정도윤'][Math.floor(Math.random() * 5)],
        citizenPhone: `010-${String(1000 + Math.floor(Math.random() * 9000))}-${String(1000 + Math.floor(Math.random() * 9000))}`,
        feePaid: Math.random() > 0.2,
        reportedAt: new Date(today.getTime() - Math.random() * 12 * 3600 * 1000).toISOString(),
      });
    }
  }
  return items;
}
