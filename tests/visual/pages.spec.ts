import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, PAGES, VIEWS, PAPERS, urlFor, open, scrollStops, scrollTo, restless } from '../targets';

// Every page, at every width, in both papers, one screen at a time from top to
// bottom. `npm run baselines` renders the design files into baselines;
// `npm run test:visual` compares against them.
//
// Chrome does not always draw the same page the same way: on a few screens the
// edges of some letters come out slightly differently from one load to the next,
// although every style and position on the page is identical. So a baseline is
// every distinct rendering three loads of the design file produced, and a screen
// passes only when it matches one of them pixel for pixel. A changed page matches
// none of them. Screens with more than one rendering are named in the report.

const LOADS = 3;
const SHOT_OPTIONS = { animations: 'disabled', caret: 'hide', scale: 'css' } as const;

const mask = (page: Page) => [page.locator('[data-restless]')];

// Like toHaveScreenshot: shoot until two shots in a row match.
async function stableShot(page: Page): Promise<Buffer> {
  let last = await page.screenshot({ ...SHOT_OPTIONS, mask: mask(page) });
  for (let i = 0; i < 10; i++) {
    const next = await page.screenshot({ ...SHOT_OPTIONS, mask: mask(page) });
    if (next.equals(last)) return next;
    last = next;
  }
  throw new Error('The screen never held still for two shots in a row');
}

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

// The first rendering is the name toHaveScreenshot uses; others get ~2, ~3.
function variantFiles(primary: string): string[] {
  const dir = path.dirname(primary);
  const stem = path.basename(primary, '.png');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f === `${stem}.png` || (f.startsWith(`${stem}~`) && f.endsWith('.png')))
    .map((f) => path.join(dir, f));
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
              const primary = file(i);
              fs.mkdirSync(path.dirname(primary), { recursive: true });
              variantFiles(primary).forEach((f) => fs.unlinkSync(f));
              distinct.forEach((d, k) => fs.writeFileSync(k === 0 ? primary : primary.replace(/\.png$/, `~${k + 1}.png`), d.shot));
              if (distinct.length > 1) {
                testInfo.annotations.push({ type: 'renderings', description: `${name(i)}: ${distinct.length} (${distinct.map((d) => d.seen).join('/')} of ${LOADS} loads)` });
              }
            }
            return;
          }

          await capture(page, url, async (i, shot) => {
            const accepted = variantFiles(file(i)).map((f) => fs.readFileSync(f));
            if (accepted.some((a) => a.equals(shot))) return;
            // No rendering matches: compare with the main one, which fails and saves the difference.
            await expect.soft(page).toHaveScreenshot(name(i), { mask: mask(page) });
          });
        });
      }
    });
  }
}
