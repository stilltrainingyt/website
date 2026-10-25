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
    { name: 'reference', testMatch: 'visual/pages.spec.ts', timeout: 240_000, retries: 3, use: { browserName: 'chromium', target: 'reference' } },
    { name: 'selfcheck', testMatch: 'visual/selfcheck.spec.ts', retries: 3, use: { browserName: 'chromium', target: 'reference' } },
    { name: 'speed', testMatch: 'speed/*.spec.ts', use: { browserName: 'chromium', target: 'reference' } },
  ],
});
