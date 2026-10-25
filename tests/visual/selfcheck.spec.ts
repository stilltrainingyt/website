import fs from 'node:fs';
import { test, expect, VIEWS, urlFor, open, settle, restless, matchesARendering, masks, stableShot, type PageName, type Paper } from '../targets';

// Proves the screenshot comparison catches small changes: each change below is
// made to a design page in the browser, and comparing it with that page's
// baseline must fail. Run after the baselines exist (npm run baselines).
const CHANGES: { name: string; apply: () => void }[] = [
  {
    name: 'a heading moved 1 px to the right',
    apply: () => {
      const h = document.querySelector<HTMLElement>('[data-page]:not([hidden]) :is(h1, h2)')!;
      h.style.translate = '1px 0';
    },
  },
  {
    name: 'a heading colour changed by 1 in the red channel',
    apply: () => {
      const h = document.querySelector<HTMLElement>('[data-page]:not([hidden]) :is(h1, h2)')!;
      const [r, g, b] = getComputedStyle(h).color.match(/\d+/g)!.map(Number);
      h.style.color = `rgb(${r < 255 ? r + 1 : r - 1}, ${g}, ${b})`;
    },
  },
  {
    name: 'one letter of a paragraph changed',
    apply: () => {
      const p = [...document.querySelectorAll<HTMLElement>('[data-page]:not([hidden]) p')]
        .find((el) => el.getBoundingClientRect().top < innerHeight && /[a-z]/.test(el.textContent ?? ''))!;
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = node.textContent ?? '';
        const i = t.search(/[a-z]/);
        if (i >= 0) {
          node.textContent = t.slice(0, i) + (t[i] === 'e' ? 'o' : 'e') + t.slice(i + 1);
          break;
        }
      }
    },
  },
];

const CASES: { view: (typeof VIEWS)[number]; paper: Paper; pageName: PageName }[] = [
  { view: VIEWS[0], paper: 'dark', pageName: 'home' },
  { view: VIEWS[2], paper: 'light', pageName: 'article' },
];

for (const { view, paper, pageName } of CASES) {
  test.describe(`${view.name} ${paper} ${pageName}`, () => {
    test.use({
      viewport: { width: view.width, height: view.height },
      isMobile: view.mobile,
      hasTouch: view.mobile,
      colorScheme: paper,
    });

    const shot = `${view.name}/${paper}/${pageName}/01.png`;
    const baseline = () => test.info().snapshotPath(shot, { kind: 'screenshot' });

    test.beforeEach(async () => {
      expect(fs.existsSync(baseline()), `No baseline at ${baseline()}; run npm run baselines first`).toBe(true);
    });

    test('unchanged page matches its baseline', async ({ page, target }) => {
      await open(page, urlFor(target, view, pageName));
      await restless(page);
      if (!matchesARendering(baseline(), await stableShot(page))) {
        await expect(page).toHaveScreenshot(shot, { mask: masks(page) });
      }
    });

    for (const change of CHANGES) {
      test(`catches ${change.name}`, async ({ page, target }) => {
        await open(page, urlFor(target, view, pageName));
        await page.evaluate(change.apply);
        await settle(page);
        await restless(page);
        expect(matchesARendering(baseline(), await stableShot(page)), `The comparison missed: ${change.name}`).toBe(false);
      });
    }
  });
}
