// Design Ref: §2.1 lib/report/pdf-renderer — Puppeteer 인스턴스 풀
// Plan SC: 5초 내 PDF 생성. 한글 폰트는 OS 폰트 + html-renderer @font에 의존.

import puppeteer, { type Browser } from 'puppeteer-core';
import { logger } from '@/lib/logger';

let browserPromise: Promise<Browser> | null = null;

/* P0-7: PDF 동시 생성 제한 — OOM 크래시 방지 (최대 2건) */
const PDF_CONCURRENCY = 2;
let _active = 0;
const _waiters: Array<() => void> = [];
function _acquire(): Promise<void> {
  if (_active < PDF_CONCURRENCY) { _active++; return Promise.resolve(); }
  return new Promise((resolve) => _waiters.push(resolve));
}
function _release(): void {
  const next = _waiters.shift();
  if (next) { next(); } else { _active--; }
}

function findExecutablePath(): string {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  /* 일반적인 Linux 경로 (Alpine: /usr/bin/chromium-browser, Debian/Ubuntu: /usr/bin/google-chrome) */
  if (process.platform === 'linux') {
    const fs = require('fs') as typeof import('fs');
    const candidates = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return p;
      } catch {
        /* ignore */
      }
    }
  }
  /* Dev fallback: Playwright bundled Chromium */
  const home = process.env.HOME || '';
  if (home) {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    try {
      const pwDir = path.join(home, '.cache', 'ms-playwright');
      if (fs.existsSync(pwDir)) {
        const versions = fs
          .readdirSync(pwDir)
          .filter((d) => d.startsWith('chromium-'))
          .sort()
          .reverse();
        for (const v of versions) {
          const candidate = path.join(pwDir, v, 'chrome-linux64', 'chrome');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch {
      /* ignore */
    }
  }
  throw new Error(
    'chromium_not_found: set PUPPETEER_EXECUTABLE_PATH or install chromium (apk add chromium)',
  );
}

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: findExecutablePath(),
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      })
      .then((browser) => {
        /* P0-7: 크래시·연결 끊김 감지 → 싱글턴 초기화 (다음 요청 시 재시동) */
        browser.on('disconnected', () => {
          logger.error('Puppeteer browser disconnected — will relaunch on next PDF request');
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        logger.error('Puppeteer launch failed', {}, err);
        throw err;
      });
  }
  return browserPromise;
}

export interface PdfOptions {
  landscape?: boolean;
  margin?: string;
}

export function checkChromiumPath(): { ok: boolean; path?: string; error?: string } {
  try {
    const p = findExecutablePath();
    return { ok: true, path: p };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function renderPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
  const { landscape = true, margin = '10mm' } = options;
  /* P0-7: 동시 PDF 생성 2건 이하 제한 */
  await _acquire();
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      /* P0-7: 30초 타임아웃 — 무한 대기 방지 */
      const pdf = await page.pdf({
        format: 'A4',
        landscape,
        printBackground: true,
        margin: { top: margin, right: margin, bottom: margin, left: margin },
        timeout: 30000,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    _release();
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch {
      /* ignore */
    } finally {
      browserPromise = null;
    }
  }
}
