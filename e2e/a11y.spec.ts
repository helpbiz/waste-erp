// Design Ref: §8.3, Plan Risk #4 — 점진 강화 정책
// PDCA progress: critical(완료) → serious(완료) → moderate(현재)
// Plan SC: FR-09 (WCAG 2.1 AA + moderate threshold)
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_PAGES } from './helpers/pages';

const BLOCKING_IMPACTS = ['critical', 'serious', 'moderate'] as const;

for (const path of ADMIN_PAGES) {
  test(`a11y critical+serious+moderate 위반 0건 ${path}`, async ({ page }, info) => {
    await page.goto(path, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact && (BLOCKING_IMPACTS as readonly string[]).includes(v.impact),
    );
    const minorOnly = results.violations.filter((v) => v.impact === 'minor');

    if (minorOnly.length > 0) {
      const summary = minorOnly
        .map((v) => `  · [minor] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
        .join('\n');
      console.log(`\n[${info.project.name}] ${path} minor warnings (non-blocking):\n${summary}`);
    }

    if (blocking.length > 0) {
      const summary = blocking
        .map((v) => `  - [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes, first: ${v.nodes[0]?.target.join(' > ')})`)
        .join('\n');
      console.log(`\n[${info.project.name}] ${path} a11y BLOCKING:\n${summary}`);
    }

    expect(
      blocking,
      `[${info.project.name}] ${path} blocking axe 위반 (critical/serious/moderate) 발생`,
    ).toHaveLength(0);
  });
}
