import type { Page } from '@playwright/test';
import { test, expect, VIEWS, serveFixtures, fixtureOrigin, editionOf, type View } from '../targets';

// What the projects, about, subscribe and torn-out pages do (step 10), on the home sample site
// (tests/fixtures/home) and, as the site launches with no project files, the launch site.
//
// The subscribe slip tears off at its button and tapes back on, as the design's scripts run it
// less the form lines (your decision, step 10), on a page loaded directly and on one a turn
// places, and the four links under it are the ones site.json gives. The projects page lists
// every project file in its group, in order; with none, the design's empty line. The torn-out
// page turns back to the cover. The about page's "Dark paper" control turns the paper.

const ORIGIN = fixtureOrigin('home');
const LAUNCH = fixtureOrigin('launch');
const navOf = (view: View) => (editionOf(view) === 'desktop' ? '.tabs' : '.dock');

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return errors;
}

// The page a turn ends on: one page, at its address, done turning.
async function turned(page: Page, address: string, name: string): Promise<void> {
  await page.waitForFunction(([to, n]) => {
    const pages = document.querySelectorAll<HTMLElement>('[data-page]');
    return location.pathname === to && pages.length === 1 && pages[0].dataset.page === n && !document.querySelector('.page.arriving, .page.leaving');
  }, [address, name]);
}

// Whether a link, brought to the middle of the window, is the thing a press at its middle lands
// on, not covered by the slip.
const pressable = (page: Page, href: string) => page.locator(`#tearbox .under a[href="${href}"]`).evaluate((a) => {
  a.scrollIntoView({ block: 'center' });
  const r = a.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && a.contains(hit);
});

// On the desktop the design copies the coupon, ids and all, into the two halves that tear, so
// the button is the coupon's own.
const TEAR = '#coupon #tearBtn';
const SLIP = ['https://www.youtube.com/@StillTraining_ai', '/rss.xml', 'https://github.com/stilltrainingyt', 'https://www.linkedin.com/in/pratyush-p-1226b532b/'];

async function tearAndTape(page: Page, view: View): Promise<void> {
  const box = page.locator('#tearbox');
  await expect(box.locator('.under a')).toHaveCount(4);
  expect(await box.locator('.under a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(SLIP);
  await expect(box.locator('form, input')).toHaveCount(0);
  await expect(box).not.toHaveClass(/torn/);
  expect(await pressable(page, SLIP[0]), 'the slip covers its links before it is torn').toBe(false);

  await page.locator(TEAR).click();
  await expect(box).toHaveClass(/torn/);
  await expect.poll(() => pressable(page, SLIP[0]), { message: 'the links can be pressed once the slip is torn' }).toBe(true);
  for (const href of SLIP) expect(await pressable(page, href), href).toBe(true);

  // "Tape it back" puts the slip on again. (The design's desktop script then focuses the first
  // #tearBtn, a hidden copy in a torn half, so focus stays put, as in the design file.)
  await page.locator('#tapeBtn').click();
  await expect(box).not.toHaveClass(/torn|arming/);
  await expect.poll(() => pressable(page, SLIP[0])).toBe(false);

  // And it tears again.
  await page.locator(TEAR).click();
  await expect(box).toHaveClass(/torn/);
}

for (const view of VIEWS.filter((v) => v.width === 390 || v.width === 1440)) {
  test.describe(view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
    test.beforeEach(async ({ context }) => { await serveFixtures(context); });

    test('the slip tears off to its four links and tapes back on', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${ORIGIN}/subscribe/`);
      await tearAndTape(page, view);
      expect(errors).toEqual([]);
    });

    test('on a subscribe page a turn places, the slip tears and tapes once per press', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${ORIGIN}/`);
      await page.locator(`${navOf(view)} [data-route="subscribe"]`).click();
      await turned(page, '/subscribe/', 'subscribe');
      await tearAndTape(page, view);
      // The elsewhere rows: YouTube, GitHub and LinkedIn, each opening in a new tab.
      const rows = page.locator('#sub-elsewhere a.linkrow');
      expect(await rows.evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.getAttribute('target')]))).toEqual(
        [SLIP[0], SLIP[2], SLIP[3]].map((href) => [href, '_blank']));
      expect(errors).toEqual([]);
    });

    test('the projects page lists every file in its group, in order', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${ORIGIN}/projects/`);
      const index = page.locator('#projects-index');
      await expect(index.locator('.lede')).toHaveText('Eleven files. Some are finished, some are still open on the desk.');
      await expect(index.locator('.empty')).toHaveCount(0);
      const groups = await index.locator('.pgroup').evaluateAll((gs) => gs.map((g) => ({
        eyebrow: g.querySelector('.eyebrow')!.textContent,
        titles: [...g.querySelectorAll('h3')].map((h) => h.textContent),
        alt: [...g.querySelectorAll('.pfile')].every((f) => f.classList.contains('alt')),
      })));
      expect(groups).toEqual([
        { eyebrow: 'Tools and apps · 5', titles: ['ContextCore', 'NexusLink Engine', 'ANN Setu', 'SIH25028', 'The Engine'], alt: false },
        { eyebrow: 'Research and reproductions · 4', titles: ['Cross-script transformer study', 'SliceGPT, reproduced', 'A small language model', 'Saral AI'], alt: true },
        { eyebrow: 'Coursework and hackathons · 2', titles: ['Model efficiency analysis', 'Dhanvantari'], alt: false },
      ]);
      await expect(index.locator('a.linkrow')).toHaveAttribute('href', 'https://github.com/06pratyush');
      expect(errors).toEqual([]);
    });

    test('with no project files, the projects page shows its empty line', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(`${LAUNCH}/projects/`);
      const index = page.locator('#projects-index');
      await expect(index.locator('.lede')).toHaveText('No files yet. Each one goes on the desk as it is started.');
      await expect(index.locator('.empty')).toHaveText('Nothing filed on this shelf yet.');
      await expect(index.locator('.pgroup, .pfile')).toHaveCount(0);
      await expect(index.locator('a.linkrow')).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('the torn-out page turns back to the cover', async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(`${ORIGIN}/no-such-page/`);
      expect(response?.status()).toBe(404);
      await expect(page.locator('#missing-leaf')).toBeVisible();
      await page.locator('#missing-leaf a.btn').click();
      await turned(page, '/', 'home');
      expect(errors).toEqual([]);
    });

    if (editionOf(view) === 'pocket') {
      test('the about page\'s "Dark paper" control turns the paper', async ({ page }) => {
        const errors = watchErrors(page);
        await page.goto(`${ORIGIN}/about/`);
        const btn = page.locator('#about-me [data-theme-toggle]');
        const dark = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        const before = await dark();
        await btn.click();
        await expect(btn).toHaveAttribute('aria-pressed', before === 'dark' ? 'false' : 'true');
        expect(await dark()).not.toBe(before);
        expect(errors).toEqual([]);
      });
    }
  });
}
