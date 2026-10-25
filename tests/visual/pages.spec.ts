import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, PAGES, VIEWS, PAPERS, urlFor, open, scrollStops, scrollTo, restless, renderings, matchesARendering, masks, stableShot } from '../targets';

// Every page, at every width, in both papers, one screen at a time from top to
// bottom. `npm run baselines` renders the design files into baselines;
// `npm run test:visual` compares against them.
//
// A baseline keeps every distinct rendering the design file has produced, three
// loads per baseline run, added up across runs (see renderings() in targets.ts),
// and a screen passes only when it matches one of them pixel for pixel; a
// changed page matches none of them. Screens with more than one rendering are
// named in the report.

const LOADS = 3;

// One load of the page, one stable screenshot per screen, each handed over while
// the page is still showing that screen.
async function capture(page: Page, url: string, onShot?: (i: number, shot: Buffer) => Promise<void>): Promise<Buffer[]> {
  await open(page, url);
  const shots: Buffer[] = [];
  for (const y of await scrollStops(page)) {
    await scrollTo(page, y);
    const moving = await restless(page);
    if (moving.length) {
      test.info().annotations.push({ type: 'masked', description: `screen ${shots.length + 1}: ${moving.join(', ')} keeps re-animating` });
    }
    const shot = await stableShot(page);
    await onShot?.(shots.length, shot);
    shots.push(shot);
  }
  return shots;
}

for (const view of VIEWS) {
  for (const paper of PAPERS) {
    test.describe(`${view.name} ${paper}`, () => {
      test.use({
        viewport: { width: view.width, height: view.height },
        isMobile: view.mobile,
        hasTouch: view.mobile,
        colorScheme: paper,
      });

      for (const pageName of PAGES) {
        test(pageName, async ({ page, target }, testInfo) => {
          const url = urlFor(target, view, pageName);
          const name = (i: number) => `${view.name}/${paper}/${pageName}/${String(i + 1).padStart(2, '0')}.png`;
          const file = (i: number) => testInfo.snapshotPath(name(i), { kind: 'screenshot' });

          if (testInfo.config.updateSnapshots === 'all') {
            const loads: Buffer[][] = [];
            for (let l = 0; l < LOADS; l++) loads.push(await capture(page, url));
            expect(new Set(loads.map((l) => l.length)).size, 'Every load has the same number of screens').toBe(1);
            for (let i = 0; i < loads[0].length; i++) {
              const distinct: { shot: Buffer; seen: number }[] = [];
              for (const load of loads) {
                const known = distinct.find((d) => d.shot.equals(load[i]));
                if (known) known.seen++;
                else distinct.push({ shot: load[i], seen: 1 });
              }
              distinct.sort((a, b) => b.seen - a.seen);
              // Add the renderings earlier baseline runs have not seen (baselines-setup.ts
              // starts over when the design files change).
              const primary = file(i);
              fs.mkdirSync(path.dirname(primary), { recursive: true });
              const known = renderings(primary).map((f) => fs.readFileSync(f));
              for (const d of distinct) {
                if (known.some((k) => k.equals(d.shot))) continue;
                fs.writeFileSync(known.length === 0 ? primary : primary.replace(/\.png$/, `~${known.length + 1}.png`), d.shot);
                known.push(d.shot);
              }
              if (known.length > 1) {
                testInfo.annotations.push({ type: 'renderings', description: `${name(i)}: ${known.length} known, this run saw ${distinct.length} (${distinct.map((d) => d.seen).join('/')} of ${LOADS} loads)` });
              }
            }
            return;
          }

          await capture(page, url, async (i, shot) => {
            if (matchesARendering(file(i), shot)) return;
            // No rendering matches: compare with the main one, which fails and saves the difference.
            await expect.soft(page).toHaveScreenshot(name(i), { mask: masks(page) });
          });
        });
      }
    });
  }
}
