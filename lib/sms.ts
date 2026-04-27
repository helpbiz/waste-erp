/**
 * SMS Provider 추상화
 *  - SIMULATION (default) — audit_log only
 *  - SOLAPI (Solapi/Coolsms 한국 SMS API) — 실 발송
 *
 * 환경변수:
 *  SMS_PROVIDER=simulation|solapi
 *  SOLAPI_API_KEY=...
 *  SOLAPI_API_SECRET=...
 *  SMS_FROM=01012345678  (발신번호)
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

export function getSmsProvider(): SmsProvider {
  const p = (process.env.SMS_PROVIDER ?? 'simulation').toLowerCase();
  if (p === 'solapi') return new SolapiProvider();
  if (p === 'webhook') return new WebhookProvider();
  return new SimulationProvider();
}
