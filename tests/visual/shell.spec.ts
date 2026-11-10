import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, VIEWS, PAPERS, EMPTY_PAGES, urlFor, open, settle, renderings, matchesARendering, stableShot, type Target } from '../targets';

// Step 3's journal around the pages still empty, at every width, in both papers. The baselines are the
// design files themselves: each page loaded as it is, its scripts run, then its contents
// removed (`npm run baselines:shell`). The site's empty pages must match one of the
// renderings pixel for pixel, as in pages.spec.ts.

const LOADS = 3;

async function capture(page: Page, target: Target, url: string): Promise<Buffer> {
  await open(page, url);
  if (target !== 'site') {
    await page.evaluate(() => {
      const shown = [...document.querySelectorAll('[data-page]')].filter((p) => !(p as HTMLElement).hidden);
      if (shown.length !== 1) throw new Error(`expected one page showing, found ${shown.length}`);
      shown[0].replaceChildren();
    });
    await settle(page);
  }
  return stableShot(page);
}

for (const view of VIEWS) {
  for (const paper of PAPERS) {
    test.describe(`shell ${view.name} ${paper}`, () => {
      test.use({
        viewport: { width: view.width, height: view.height },
        isMobile: view.mobile,
        hasTouch: view.mobile,
        colorScheme: paper,
      });

      for (const pageName of EMPTY_PAGES) {
        test(pageName, async ({ page, target }, testInfo) => {
          const url = urlFor(target, view, pageName);
          const name = `shell/${view.name}/${paper}/${pageName}.png`;
          const file = testInfo.snapshotPath(name, { kind: 'screenshot' });

          if (testInfo.config.updateSnapshots === 'all') {
            if (target !== 'reference') throw new Error('Baselines are made from the design files only');
            const distinct: { shot: Buffer; seen: number }[] = [];
            for (let l = 0; l < LOADS; l++) {
              const shot = await capture(page, target, url);
              const known = distinct.find((d) => d.shot.equals(shot));
              if (known) known.seen++;
              else distinct.push({ shot, seen: 1 });
            }
            distinct.sort((a, b) => b.seen - a.seen);
            // Add the renderings earlier baseline runs have not seen.
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const known = renderings(file).map((f) => fs.readFileSync(f));
            for (const d of distinct) {
              if (known.some((k) => k.equals(d.shot))) continue;
              fs.writeFileSync(known.length === 0 ? file : file.replace(/\.png$/, `~${known.length + 1}.png`), d.shot);
              known.push(d.shot);
            }
            if (known.length > 1) {
              testInfo.annotations.push({ type: 'renderings', description: `${name}: ${known.length} known, this run saw ${distinct.length} (${distinct.map((d) => d.seen).join('/')} of ${LOADS} loads)` });
            }
            return;
          }

          const shot = await capture(page, target, url);
          if (matchesARendering(file, shot)) return;
          // No rendering matches: compare with the main one, which fails and saves the difference.
          await expect(page).toHaveScreenshot(name);
        });
      }
    });
  }
}
