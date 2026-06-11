/**
 * P3-8: 구조화 로거 — JSON 출력 (외부 의존성 없음)
 *
 * 운영: Docker 로그 수집기(Loki/CloudWatch)가 JSON 파싱 가능.
 * 교체: 이 파일의 write() 내부만 pino/winston으로 교체하면 호출부 불변.
 * Sentry 연동: @sentry/nextjs 설치 후 write()에 captureException 추가 가능.
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type LogContext = Record<string, unknown>;

const LEVEL_NUM: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function activeLevel(): number {
  const lvl = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')).toLowerCase() as LogLevel;
  return LEVEL_NUM[lvl] ?? 2;
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  return { message: String(err) };
}

function write(level: LogLevel, msg: string, ctx?: LogContext, err?: unknown): void {
  if (LEVEL_NUM[level] > activeLevel()) return;

  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  };
  if (err !== undefined) entry.err = serializeError(err);

  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  error(msg: string, ctx?: LogContext, err?: unknown) { write('error', msg, ctx, err); },
  warn(msg: string, ctx?: LogContext) { write('warn', msg, ctx); },
  info(msg: string, ctx?: LogContext) { write('info', msg, ctx); },
  debug(msg: string, ctx?: LogContext) { write('debug', msg, ctx); },
};
