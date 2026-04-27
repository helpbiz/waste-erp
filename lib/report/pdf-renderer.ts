// Design Ref: §2.1 lib/report/pdf-renderer — Puppeteer 인스턴스 풀
// Plan SC: 5초 내 PDF 생성. 한글 폰트는 OS 폰트 + html-renderer @font에 의존.

import puppeteer, { type Browser } from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;

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
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => undefined);
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
