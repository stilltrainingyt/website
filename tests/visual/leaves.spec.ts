import fs from 'node:fs';
import path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, VIEWS, PAPERS, SAMPLE_CHANGES, urlFor, sampleUrl, fixtureOrigin, open, scrollTo, restless, renderings, matchesARendering, stableShot, type PageName, type View } from '../targets';
import type { FixtureSite } from '../fixtures/sites';

// Pages a sample site draws only in part (step 8), compared leaf by leaf: each leaf from the
// screen where its top sits just under the window's top to the screen where its bottom sits
// clear of pocket's dock, each screen cut to the leaf. The frame's progress bar is left out, as
// it measures the whole page.
//
// A leaf the design draws is compared with the design's own, from baselines the reference
// project makes from the design files, three loads each, as pages.spec.ts makes the pages'.
// A new leaf, which the design does not draw, is compared with the screens you approved (your
// decision, step 8), committed in tests/visual/approved/<platform>/, every rendering
// they were seen in. `--update-snapshots=all` on the fixtures project draws the new leaves
// afresh into test-results/approval/ for you to look at; only your approval copies them over.

// A leaf's screens are named by its id, or by `name` where one page draws the same leaf twice.
interface Leaf { site: FixtureSite; page: PageName; address: string; leaf: string; name?: string }

// The design's episode page with the sample video it was drawn from: its player leaf. The
// design's article page with the sample article it was drawn from (step 9), compared with the
// design page as its samples are (SAMPLE_CHANGES in targets.ts).
const DESIGN_LEAVES: Leaf[] = [
  { site: 'episode', page: 'episode', address: '/episodes/gradient-descent-by-hand/', leaf: 'episode-player' },
  { site: 'article', page: 'article', address: '/writing/gradient-descent-by-hand/', leaf: 'article-body' },
];
// The episode page's notes, with the transcript; the episodes page's picks and full archive,
// filled with the step 7 sample videos (step 8). The writing page's shelf, filled with the
// step 7 sample articles, and as the site launches, empty (step 9). At 390 and 1440 px.
const NEW_LEAVES: Leaf[] = [
  { site: 'episode', page: 'episode', address: '/episodes/gradient-descent-by-hand/', leaf: 'episode-notes' },
  { site: 'pieces', page: 'episodes', address: '/episodes/', leaf: 'ep-picks' },
  { site: 'pieces', page: 'episodes', address: '/episodes/', leaf: 'ep-archive' },
  { site: 'pieces', page: 'writing', address: '/writing/', leaf: 'writing-index' },
  { site: 'writing-empty', page: 'writing', address: '/writing/', leaf: 'writing-index', name: 'writing-empty' },
];
const NEW_VIEWS = VIEWS.filter((v) => v.width === 390 || v.width === 1440);

const APPROVED = path.resolve('tests', 'visual', 'approved', process.platform);
const CANDIDATES = path.resolve('test-results', 'approval');
const LOADS = 3;
const NO_PROGRESS = '.frame .prog{visibility:hidden}';
// How far below the window's top a leaf's first screen starts it, and how far above the
// window's bottom its last screen ends it: past the frame's top edge, and past pocket's dock.
const ABOVE = 40, BELOW = 140;

// One load of a page, one stable screenshot per screen of the leaf, each handed over while the
// page is still showing that screen. Stops are measured from the page's layout, which the
// desktop deck's tilts do not move.
async function leafCapture(page: Page, url: string, leaf: string, onShot?: (i: number, shot: Buffer) => Promise<void>): Promise<Buffer[]> {
  await open(page, url);
  const box = page.locator(`#${leaf}`);
  await expect(box, `${url} has one #${leaf}`).toHaveCount(1);
  const stops = await box.evaluate((el, [above, below]) => {
    let top = 0;
    for (let at: HTMLElement | null = el as HTMLElement; at; at = at.offsetParent as HTMLElement | null) top += at.offsetTop;
    const vh = window.innerHeight, max = Math.max(0, document.documentElement.scrollHeight - vh);
    const bottom = top + (el as HTMLElement).offsetHeight;
    const ys: number[] = [];
    for (let y = top - above; y + vh < bottom + below; y += vh) ys.push(y);
    ys.push(Math.max(top - above, bottom + below - vh));
    return [...new Set(ys.map((y) => Math.min(Math.max(0, Math.round(y)), max)))];
  }, [ABOVE, BELOW]);
  const shots: Buffer[] = [];
  for (const y of stops) {
    await scrollTo(page, y);
    const moving = await restless(page);
    if (moving.length) test.info().annotations.push({ type: 'masked', description: `${leaf} screen ${shots.length + 1}: ${moving.join(', ')} keeps re-animating` });
    const shot = await stableShot(page, { clip: await clipOf(page, leaf), style: NO_PROGRESS });
    await onShot?.(shots.length, shot);
    shots.push(shot);
  }
  return shots;
}

// The part of the window the leaf covers, in whole pixels.
async function clipOf(page: Page, leaf: string) {
  return page.locator(`#${leaf}`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top));
    const right = Math.min(window.innerWidth, Math.ceil(r.right)), bottom = Math.min(window.innerHeight, Math.ceil(r.bottom));
    return { x, y, width: right - x, height: bottom - y };
  });
}

// Every distinct rendering of each screen over three loads, added to those already in `dir`.
async function makeScreens(page: Page, url: string, leaf: string, file: (i: number) => string, testInfo: TestInfo, label: (i: number) => string) {
  const loads: Buffer[][] = [];
  for (let l = 0; l < LOADS; l++) loads.push(await leafCapture(page, url, leaf));
  expect(new Set(loads.map((l) => l.length)).size, 'Every load has the same number of screens').toBe(1);
  for (let i = 0; i < loads[0].length; i++) {
    const primary = file(i);
    fs.mkdirSync(path.dirname(primary), { recursive: true });
    const known = renderings(primary).map((f) => fs.readFileSync(f));
    for (const load of loads) {
      if (known.some((k) => k.equals(load[i]))) continue;
      fs.writeFileSync(known.length === 0 ? primary : primary.replace(/\.png$/, `~${known.length + 1}.png`), load[i]);
      known.push(load[i]);
    }
    if (known.length > 1) testInfo.annotations.push({ type: 'renderings', description: `${label(i)}: ${known.length} known` });
  }
}

const screenName = (view: View, paper: string, leaf: string, i: number) => `${view.name}/${paper}/leaves/${leaf}/${String(i + 1).padStart(2, '0')}.png`;

for (const view of VIEWS) {
  for (const paper of PAPERS) {
    test.describe(`${view.name} ${paper}`, () => {
      test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile, colorScheme: paper });

      for (const l of DESIGN_LEAVES) {
        test(`${l.page} ${l.leaf}`, async ({ page, target }, testInfo) => {
          test.skip(target !== 'reference' && target !== 'fixture', 'The design files and their sample sites only');
          const design = SAMPLE_CHANGES[l.page] ? sampleUrl(view, l.page) : urlFor('reference', view, l.page);
          const url = target === 'reference' ? design : `${fixtureOrigin(l.site)}${l.address}`;
          const name = (i: number) => screenName(view, paper, l.leaf, i);
          const file = (i: number) => testInfo.snapshotPath(name(i), { kind: 'screenshot' });
          if (testInfo.config.updateSnapshots === 'all') {
            if (target !== 'reference') throw new Error('Baselines are made from the design files only');
            await makeScreens(page, url, l.leaf, file, testInfo, name);
            return;
          }
          await leafCapture(page, url, l.leaf, async (i, shot) => {
            if (matchesARendering(file(i), shot)) return;
            // No rendering matches: compare with the main one, which fails and saves the difference.
            await expect.soft(page).toHaveScreenshot(name(i), { clip: await clipOf(page, l.leaf), style: NO_PROGRESS });
          });
        });
      }

      for (const l of NEW_VIEWS.some((v) => v.name === view.name) ? NEW_LEAVES : []) {
        test(`${l.page} ${l.name ?? l.leaf} as approved`, async ({ page, target }, testInfo) => {
          test.skip(target !== 'fixture', 'Drawn on the sample sites only');
          const url = `${fixtureOrigin(l.site)}${l.address}`;
          const name = (i: number) => screenName(view, paper, l.name ?? l.leaf, i);
          if (testInfo.config.updateSnapshots === 'all') {
            await makeScreens(page, url, l.leaf, (i) => path.join(CANDIDATES, name(i)), testInfo, name);
            return;
          }
          const count = fs.existsSync(path.dirname(path.join(APPROVED, name(0))))
            ? fs.readdirSync(path.dirname(path.join(APPROVED, name(0)))).filter((f) => /^\d+\.png$/.test(f)).length : 0;
          expect(count, `approved screens of ${l.leaf} at ${view.name} ${paper}`).toBeGreaterThan(0);
          const shots = await leafCapture(page, url, l.leaf, async (i, shot) => {
            if (matchesARendering(path.join(APPROVED, name(i)), shot)) return;
            const actual = testInfo.outputPath(name(i).replaceAll('/', '-'));
            fs.writeFileSync(actual, shot);
            expect.soft(false, `${name(i)} matches no approved rendering; this run drew ${actual}`).toBe(true);
          });
          expect(shots.length, `${l.leaf} has as many screens as you approved`).toBe(count);
        });
      }
    });
  }
}
