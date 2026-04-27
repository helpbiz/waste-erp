// Design Ref: §8.3, Plan Risk #4 — 첫 도입은 critical-only로 시작 (serious는 후속 PDCA)
// Plan SC: FR-09 (점진 강화 정책)
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_PAGES } from './helpers/pages';

// a11y-serious-fix: critical(완료) → serious(이번) 점진 강화
const BLOCKING_IMPACTS = ['critical', 'serious'] as const;

for (const path of ADMIN_PAGES) {
  test(`a11y critical 위반 0건 ${path}`, async ({ page }, info) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact && (BLOCKING_IMPACTS as readonly string[]).includes(v.impact),
    );
    const warnings = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'moderate',
    );

    if (warnings.length > 0) {
      const summary = warnings
        .map((v) => `  · [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
        .join('\n');
      console.log(`\n[${info.project.name}] ${path} a11y warnings (non-blocking):\n${summary}`);
    }

    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes, first: ${v.nodes[0]?.target.join(' > ')})`)
        .join('\n');
      console.log(`\n[${info.project.name}] ${path} a11y CRITICAL:\n${summary}`);
    }

    expect(blocking, `[${info.project.name}] ${path} critical axe 위반 발생`).toHaveLength(0);
  });
}
