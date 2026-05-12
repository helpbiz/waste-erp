/**
 * SMS Provider 추상화
 *  - SIMULATION (default) — audit_log only
 *  - SOLAPI — Solapi SMS 실 발송
 *  - KAKAO  — Solapi 카카오 알림톡 (SMS 자동 fallback 포함)
 *  - WEBHOOK — 외부 HTTP 엔드포인트
 *
 * 환경변수:
 *  SMS_PROVIDER=simulation|solapi|kakao|webhook
 *  SOLAPI_API_KEY=...
 *  SOLAPI_API_SECRET=...
 *  SMS_FROM=01012345678          (발신번호)
 *  KAKAO_CHANNEL_ID=KA01PF...    (카카오채널 pfId — kakao 전용)
 *  KAKAO_TEMPLATE_CODE=KA01TP... (알림톡 템플릿 코드 — kakao 전용)
 */
import { createHmac, randomBytes } from 'crypto';

export type SmsRecipient = {
  type: '119' | 'MANAGER' | 'WORKER' | 'CONTRACTOR' | 'OTHER';
  name: string;
  phone: string | null;
};

export type SmsResult = {
  provider: string;
  sent: number;
  failed: number;
  details: Array<{ recipientType: string; recipientName: string; ok: boolean; messageId?: string; error?: string }>;
};

export interface SmsProvider {
  name: string;
  send(recipients: SmsRecipient[], message: string): Promise<SmsResult>;
}

class SimulationProvider implements SmsProvider {
  name = 'SIMULATION';
  async send(recipients: SmsRecipient[], _message: string): Promise<SmsResult> {
    return {
      provider: this.name,
      sent: recipients.length,
      failed: 0,
      details: recipients.map((r) => ({
        recipientType: r.type,
        recipientName: r.name,
        ok: true,
        messageId: 'sim-' + randomBytes(4).toString('hex'),
      })),
    };
  }
}

class SolapiProvider implements SmsProvider {
  name = 'SOLAPI';
  async send(recipients: SmsRecipient[], message: string): Promise<SmsResult> {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const from = process.env.SMS_FROM;
    if (!apiKey || !apiSecret || !from) {
      throw new Error('Solapi credentials missing (SOLAPI_API_KEY/SECRET, SMS_FROM)');
    }

    const phoneTargets = recipients.filter((r) => r.phone);
    if (phoneTargets.length === 0) {
      return { provider: this.name, sent: 0, failed: 0, details: [] };
    }

    /* Solapi v4 group send */
    const date = new Date().toISOString();
    const salt = randomBytes(8).toString('hex');
    const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex');
    const auth = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    const messages = phoneTargets.map((r) => ({
      from,
      to: (r.phone ?? '').replace(/-/g, ''),
      text: message,
    }));

    try {
      const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(10000),
      });
      const data = (await res.json().catch(() => ({}))) as { groupId?: string; successCount?: number; failedCount?: number };
      return {
        provider: this.name,
        sent: data.successCount ?? phoneTargets.length,
        failed: data.failedCount ?? 0,
        details: phoneTargets.map((r) => ({
          recipientType: r.type,
          recipientName: r.name,
          ok: res.ok,
          messageId: data.groupId,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        })),
      };
    } catch (e) {
      return {
        provider: this.name,
        sent: 0,
        failed: phoneTargets.length,
        details: phoneTargets.map((r) => ({
          recipientType: r.type,
          recipientName: r.name,
          ok: false,
          error: e instanceof Error ? e.message : 'unknown',
        })),
      };
    }
  }
}

/**
 * Webhook Provider — 임의 HTTP endpoint로 POST 발송
 *  - Slack/Discord/MS Teams incoming webhook
 *  - 자체 백엔드 라우팅 서버 (push notification, 카카오 alimtalk 등)
 *  - SMS_WEBHOOK_URL=https://hooks.slack.com/services/.../...
 */
class WebhookProvider implements SmsProvider {
  name = 'WEBHOOK';
  async send(recipients: SmsRecipient[], message: string): Promise<SmsResult> {
    const url = process.env.SMS_WEBHOOK_URL;
    if (!url) throw new Error('SMS_WEBHOOK_URL not set');

    const requestId = randomBytes(8).toString('hex');
    const payload = {
      type: 'sms_dispatch',
      requestId,
      message,
      recipients: recipients.map((r) => ({ type: r.type, name: r.name, phone: r.phone })),
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const ok = res.ok;
      return {
        provider: this.name,
        sent: ok ? recipients.length : 0,
        failed: ok ? 0 : recipients.length,
        details: recipients.map((r) => ({
          recipientType: r.type,
          recipientName: r.name,
          ok,
          messageId: requestId,
          error: ok ? undefined : `HTTP ${res.status}`,
        })),
      };
    } catch (e) {
      return {
        provider: this.name,
        sent: 0,
        failed: recipients.length,
        details: recipients.map((r) => ({
          recipientType: r.type,
          recipientName: r.name,
          ok: false,
          error: e instanceof Error ? e.message : 'unknown',
        })),
      };
    }
  }
}

/**
 * 카카오 알림톡 Provider — Solapi 알림톡 API 사용
 *
 * 필수 환경변수:
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET, SMS_FROM
 *   KAKAO_CHANNEL_ID  — 카카오채널 pfId (예: KA01PF...)
 *   KAKAO_TEMPLATE_CODE — 등록된 알림톡 템플릿 코드 (예: KA01TP...)
 *
 * 템플릿 변수: #{message} 하나만 사용 (기상알림 본문 전체 매핑)
 * disableSms: false → 카카오 수신 불가 번호는 SMS 자동 fallback
 */
class KakaoAlimtalkProvider implements SmsProvider {
  name = 'KAKAO';
  async send(recipients: SmsRecipient[], message: string): Promise<SmsResult> {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const from = process.env.SMS_FROM;
    const pfId = process.env.KAKAO_CHANNEL_ID;
    const templateId = process.env.KAKAO_TEMPLATE_CODE;

    if (!apiKey || !apiSecret || !from) {
      throw new Error('Solapi credentials missing (SOLAPI_API_KEY/SECRET, SMS_FROM)');
    }
    if (!pfId || !templateId) {
      throw new Error('카카오 알림톡 설정 없음 (KAKAO_CHANNEL_ID, KAKAO_TEMPLATE_CODE)');
    }

    const phoneTargets = recipients.filter((r) => r.phone);
    if (phoneTargets.length === 0) {
      return { provider: this.name, sent: 0, failed: 0, details: [] };
    }

    const date = new Date().toISOString();
    const salt = randomBytes(8).toString('hex');
    const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex');
    const auth = `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;

    const messages = phoneTargets.map((r) => ({
      from,
      to: (r.phone ?? '').replace(/-/g, ''),
      kakaoOptions: {
        pfId,
        templateId,
        variables: { '#{message}': message },
        disableSms: false, /* 카카오 미설치·차단 수신자는 SMS fallback */
      },
    }));

    try {
      const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(10000),
      });
      const data = (await res.json().catch(() => ({}))) as { groupId?: string; successCount?: number; failedCount?: number };
      return {
        provider: this.name,
        sent: data.successCount ?? phoneTargets.length,
        failed: data.failedCount ?? 0,
        details: phoneTargets.map((r) => ({
          recipientType: r.type,
          recipientName: r.name,
          ok: res.ok,
          messageId: data.groupId,
          error: res.ok ? undefined : `HTTP ${res.status}`,
        })),
      };
    } catch (e) {
      return {
        provider: this.name,
        sent: 0,
        failed: phoneTargets.length,
        details: phoneTargets.map((r) => ({
          recipientType: r.type,
          recipientName: r.name,
          ok: false,
          error: e instanceof Error ? e.message : 'unknown',
        })),
      };
    }
  }
}

export function getSmsProvider(): SmsProvider {
  const p = (process.env.SMS_PROVIDER ?? 'simulation').toLowerCase();
  if (p === 'solapi') return new SolapiProvider();
  if (p === 'kakao')  return new KakaoAlimtalkProvider();
  if (p === 'webhook') return new WebhookProvider();
  return new SimulationProvider();
}
