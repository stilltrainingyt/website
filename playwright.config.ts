import { defineConfig } from '@playwright/test';
import type { Target } from './tests/targets';

export default defineConfig<{ target: Target }>({
  testDir: 'tests',
  // Baselines are rendered from design-reference/ on each machine, so they are
  // kept per platform and never committed (see ASSUMPTIONS.md).
  snapshotPathTemplate: '{testDir}/visual/baselines/{platform}/{arg}{ext}',
  // A missing baseline is a failure, never a silent new baseline.
  updateSnapshots: 'none',
  globalSetup: './tests/visual/baselines-setup.ts',
  reporter: [['list']],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      // Identical means identical: no colour tolerance, no differing pixels.
      threshold: 0,
      maxDiffPixels: 0,
    },
  },
  projects: [
    // Making baselines loads each page three times, so long pages need minutes.
    // Up to three retries, each loading the page afresh, in case it drew a rare
    // rendering the baseline loads missed. A changed page fails every load.
    { name: 'reference', testMatch: ['visual/pages.spec.ts', 'visual/shell.spec.ts'], timeout: 240_000, retries: 3, use: { browserName: 'chromium', target: 'reference' } },
    // The same screens drawn with the project's own tokens, fonts and images, compared with
    // the same baselines; plus the checks on those materials themselves.
    { name: 'materials', testMatch: ['visual/pages.spec.ts', 'visual/materials.spec.ts'], timeout: 240_000, retries: 3, use: { browserName: 'chromium', target: 'materials' } },
    { name: 'selfcheck', testMatch: 'visual/selfcheck.spec.ts', retries: 3, use: { browserName: 'chromium', target: 'reference' } },
    { name: 'speed', testMatch: 'speed/*.spec.ts', use: { browserName: 'chromium', target: 'reference' } },
    // The built site (npm run build first): its screens against the design's baselines, and its
    // page turn against the design's own, with the same retries for the rare second rendering;
    // what it does; and its speed budgets.
    { name: 'site', testMatch: ['visual/shell.spec.ts', 'visual/turn.spec.ts'], retries: 3, use: { browserName: 'chromium', target: 'site' } },
    // The design's samples as content files, built into sites of their own (tests/fixtures), and
    // their pages' screens against the design's baselines, with the same retries.
    { name: 'fixture-sites', testMatch: 'fixtures/build.setup.ts' },
    { name: 'fixtures', testMatch: 'visual/pages.spec.ts', dependencies: ['fixture-sites'], timeout: 240_000, retries: 3, use: { browserName: 'chromium', target: 'fixture' } },
    { name: 'behaviour', testMatch: ['behaviour/*.spec.ts', 'visual/port.spec.ts'], dependencies: ['fixture-sites'], use: { browserName: 'chromium', target: 'site' } },
    // The new pieces you approved in step 7, drawn on the review site's pages.
    { name: 'pieces', testMatch: 'visual/pieces.spec.ts', dependencies: ['fixture-sites'], use: { browserName: 'chromium', target: 'fixture' } },
    { name: 'site-speed', testMatch: 'speed/*.spec.ts', use: { browserName: 'chromium', target: 'site' } },
  ],
});
