import type { Page } from '@playwright/test';
import { test, expect, VIEWS, SHELL_PAGES, EMPTY_PAGES, urlFor, type View, type PageName } from '../targets';

// What the journal does around its pages (step 3): each address shows its own page with its
// entry lit, each edition keeps only its own parts (the other's are removed at load, step 5) and
// runs only its own script, the paper switch, the wire binding, the scroll progress, and full
// motion for every visitor.

// The desktop's paper switch is the frame's .toggle; the pocket home has its own #themeBtn.
const PARTS = {
  desktop: ['a.skip[href="#premise"]', '.bind', '.tabs', '#themeBtn.toggle', '.pnav'],
  pocket: ['a.skip[href="#why"]', '.wire', '.dock'],
};
const editionOf = (view: View) => (view.width >= 900 ? 'desktop' : 'pocket');
const entryOf = (p: PageName) => (p === 'missing' ? null : p);

// Errors the page reports: script errors and console errors.
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

const display = (page: Page, selector: string) => page.locator(selector).evaluate((el) => getComputedStyle(el).display);
const frames = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('st-theme'));

for (const view of VIEWS) {
  test.describe(view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
    const edition = editionOf(view);
    const other = edition === 'desktop' ? 'pocket' : 'desktop';

    test('each address shows its own page, its entry lit, and only its edition\'s parts', async ({ page, target }) => {
      const errors = watchErrors(page);
      for (const name of SHELL_PAGES) {
        const response = await page.goto(urlFor(target, view, name));
        expect(response?.status(), name).toBe(name === 'missing' ? 404 : 200);
        expect(await page.locator('[data-page]').evaluateAll((ps) => ps.map((p) => p.getAttribute('data-page')))).toEqual([name]);
        // The home page has its contents (step 5); the others are empty until theirs arrive.
        if (EMPTY_PAGES.includes(name)) expect(await page.locator('[data-page]').evaluate((p) => p.childElementCount), name).toBe(0);
        const navs = edition === 'desktop' ? ['.tabs', '.pnav'] : ['.dock'];
        for (const nav of navs) {
          expect(await page.locator(`${nav} [aria-current="true"]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-route'))), `${name}: ${nav}`)
            .toEqual(entryOf(name) ? [entryOf(name)] : []);
          expect(await page.locator(`${nav} [data-route]`).count()).toBe(6);
        }
        for (const part of PARTS[other]) expect(await page.locator(part).count(), `${name}: ${other}'s ${part}`).toBe(0);
        for (const part of PARTS[edition]) {
          // The desktop's own CSS shows the binding only from 1080 px.
          const hidden = part === '.bind' && view.width < 1080;
          expect(await display(page, part) === 'none', `${name}: ${edition}'s ${part}`).toBe(hidden);
        }
      }
      // The browser reports the missing page's 404 status; nothing else may go wrong.
      expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
    });

    test('only this edition\'s script runs', async ({ page, target }) => {
      await page.goto(urlFor(target, view, 'home'));
      const rings = await page.locator('#bind span').count();
      if (edition === 'desktop') expect(rings).toBe(Math.ceil(view.height / 34) + 3);
      else expect(rings).toBe(0);
    });

    test('scrolling moves the progress bar, written on the frame, and the wire', async ({ page, target }) => {
      await page.goto(urlFor(target, view, 'about'));
      // An empty page cannot scroll; give it height for this test only.
      await page.evaluate(() => { (document.querySelector('.page') as HTMLElement).style.height = '5000px'; });
      const y = await page.evaluate(() => {
        const half = Math.round((document.documentElement.scrollHeight - innerHeight) / 2);
        scrollTo(0, half);
        return half;
      });
      await frames(page);
      const state = await page.evaluate(() => {
        const frame = document.querySelector('.frame') as HTMLElement;
        const prog = frame.querySelector('.prog')!.getBoundingClientRect();
        return {
          sp: frame.style.getPropertyValue('--sp'),
          onRoot: document.documentElement.style.getPropertyValue('--sp'),
          max: document.documentElement.scrollHeight - innerHeight,
          y: scrollY,
          progWidth: prog.width,
          frameWidth: frame.clientWidth,
          wire: (document.getElementById(innerWidth >= 900 ? 'bind' : 'wire') as HTMLElement).style.getPropertyValue('--wire'),
        };
      });
      expect(state.y).toBe(y);
      expect(state.sp).toBe((y / state.max).toFixed(4));
      expect(state.onRoot).toBe('');
      // Desktop: the bar spans the frame less 10 px each side; pocket: the frame's inside.
      const full = edition === 'desktop' ? state.frameWidth - 20 : state.frameWidth;
      expect(state.progWidth).toBeCloseTo(full * (y / state.max), 0);
      const wire = edition === 'desktop' ? -((y * 0.35) % 34) : -((y * 0.3) % 32);
      expect(state.wire).toBe(wire.toFixed(1));
    });

    test('motion stays on for visitors who ask for less (allowed change 1)', async ({ page, target }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(urlFor(target, view, 'about'));
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      // The page turn's arriving animation keeps its full length.
      expect(await page.locator('.page').evaluate((p) => { p.classList.add('arriving'); return getComputedStyle(p).animationDuration; })).toBe('0.75s');
      // So do the margin tabs' slide and colour change.
      if (edition === 'desktop') expect(await page.locator('.tab').first().evaluate((t) => getComputedStyle(t).transitionDuration)).toBe('0.18s, 0.18s');
      // The scroll effects still run.
      await page.evaluate(() => { (document.querySelector('.page') as HTMLElement).style.height = '5000px'; scrollTo(0, 400); });
      await frames(page);
      expect(await page.locator('.frame').evaluate((f) => (f as HTMLElement).style.getPropertyValue('--sp'))).not.toBe('0.0000');
    });
  });
}

test.describe('the paper switch', () => {
  const desktop = VIEWS[2];
  test.use({ viewport: { width: desktop.width, height: desktop.height }, colorScheme: 'light' });

  test('turns the paper, says which one it offers, and remembers the choice in pocket\'s format', async ({ page, target }) => {
    const errors = watchErrors(page);
    await page.goto(urlFor(target, desktop, 'about'));
    const btn = page.locator('#themeBtn');
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await expect(btn).toHaveText('Dark paper');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(await theme()).toBe(null);

    await btn.click();
    expect(await theme()).toBe('dark');
    await expect(btn).toHaveText('Light paper');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(await stored(page)).toBe('"dark"');

    await page.reload();
    expect(await theme()).toBe('dark');
    await expect(btn).toHaveText('Light paper');

    await btn.click();
    expect(await theme()).toBe('light');
    await expect(btn).toHaveText('Dark paper');
    expect(await stored(page)).toBe('"light"');
    expect(errors).toEqual([]);
  });

  test('follows the system\'s dark paper until the visitor chooses', async ({ page, target }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(urlFor(target, desktop, 'home'));
    await expect(page.locator('#themeBtn')).toHaveText('Light paper');
    await expect(page.locator('#themeBtn')).toHaveAttribute('aria-pressed', 'true');
  });

  test('a choice saved in the design\'s old desktop format is ignored without an error', async ({ page, target }) => {
    const errors = watchErrors(page);
    await page.goto(urlFor(target, desktop, 'home'));
    await page.evaluate(() => localStorage.setItem('st-theme', 'dark'));
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(null);
    await expect(page.locator('#themeBtn')).toHaveText('Dark paper');
    expect(errors).toEqual([]);
  });
});

test.describe('the 900 px edition switch', () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test('crossing 900 px loads the page again, carrying the paper choice; resizing within an edition does not', async ({ page, target }) => {
    const errors = watchErrors(page);
    await page.goto(urlFor(target, VIEWS[2], 'writing'));
    await page.locator('#themeBtn').click();
    const mark = () => page.evaluate(() => { (window as unknown as { mark: number }).mark = 1; });
    const marked = () => page.evaluate(() => (window as unknown as { mark?: number }).mark === 1);
    const resize = async (width: number, reloads: boolean) => {
      const loaded = reloads ? page.waitForEvent('load') : null;
      await page.setViewportSize({ width, height: 900 });
      await loaded;
      await frames(page);
    };

    await mark();
    await resize(1440, false);
    expect(await marked(), 'still the same page').toBe(true);

    await resize(899, true);
    expect(await marked(), 'loaded again').toBe(false);
    expect(await display(page, '.dock')).toBe('flex');
    expect(await page.locator('.tabs').count(), 'the desktop\'s parts were removed').toBe(0);
    expect(await page.locator('#bind span').count(), 'the desktop script did not run').toBe(0);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), 'pocket read the choice').toBe('dark');

    await mark();
    await resize(600, false);
    expect(await marked(), 'still the same page').toBe(true);

    await resize(900, true);
    expect(await marked(), 'loaded again').toBe(false);
    expect(await display(page, '.tabs')).toBe('flex');
    expect(await page.locator('#bind span').count()).toBe(Math.ceil(900 / 34) + 3);
    await expect(page.locator('#themeBtn')).toHaveText('Light paper');
    expect(errors).toEqual([]);
  });

  test('the binding redraws its rings when the window changes height', async ({ page, target }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlFor(target, VIEWS[2], 'home'));
    const tops = () => page.locator('#bind span').evaluateAll((s) => s.map((e) => (e as HTMLElement).style.top));
    expect(await tops()).toEqual(Array.from({ length: 30 }, (_, i) => `${i * 34 - 24}px`));
    await page.setViewportSize({ width: 1440, height: 600 });
    await frames(page);
    expect(await tops()).toEqual(Array.from({ length: Math.ceil(600 / 34) + 3 }, (_, i) => `${i * 34 - 24}px`));
  });
});
