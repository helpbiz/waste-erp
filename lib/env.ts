// 운영 환경 변수 검증 — 배포 전 필수 값 누락 시 부팅 실패
// Plan SC: deploy-readiness P0-1 — JWT_SECRET fallback 제거
import { z } from 'zod';

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  DATABASE_URL: z.string().min(10),

  /* JWT 서명 비밀키 — 32자 이상 강제. 운영에서 미설정 시 부팅 실패 (이전 fallback 제거) */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),

  /* KMS 로컬 키 — 32자 이상 (HealthRecord 등 PII 암호화) */
  KMS_LOCAL_KEY: z.string().min(32, 'KMS_LOCAL_KEY must be at least 32 chars'),
  KMS_PROVIDER: z.enum(['local', 'aws', 'vault']).default('local'),

  /* 쿠키 secure 강제 — production 에서 false 설정 시 경고 (E2E http localhost 만 허용) */
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),

  CRON_SECRET: z.string().min(8).optional(),
  SMS_PROVIDER: z.enum(['simulation', 'solapi', 'aws-sns']).default('simulation'),
  WEATHER_PROVIDER: z.string().optional(),
});

export type AppEnv = z.infer<typeof Schema>;

let _cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (_cached) return _cached;
  const parsed = Schema.safeParse(process.env);
  if (!parsed.success) {
    /* 부팅 실패 — 누락/형식 오류 명확히 표기 */
    const errors = parsed.error.flatten().fieldErrors;
    const summary = Object.entries(errors)
      .map(([k, v]) => `  - ${k}: ${(v ?? []).join(', ')}`)
      .join('\n');
    throw new Error(`[env] 운영 필수 환경변수 누락/오류:\n${summary}`);
  }
  /* prod 추가 검증 — secure 쿠키 강제 권고 */
  if (parsed.data.NODE_ENV === 'production' && parsed.data.COOKIE_SECURE === 'false') {
    console.warn('[env] WARNING: COOKIE_SECURE=false in production — only safe behind HTTPS-terminating reverse proxy');
  }
  _cached = parsed.data;
  return _cached;
}
