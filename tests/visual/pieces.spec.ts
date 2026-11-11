import fs from 'node:fs';
import path from 'node:path';
import { test, expect, VIEWS, PAPERS, open, scrollTo, stableShot, fixtureOrigin } from '../targets';

// The new pieces you approved in step 7, drawn on the review pages of the pieces sample site
// (tests/fixtures/pieces): each at 390 and 1440 px in both papers, from a screen starting just
// above it to one that shows its end. The screens go to test-results/pieces/ for you to look at;
// there are no baselines to compare them with, since the design has none of these pieces, so a
// page that uses a piece holds it in its own screenshot tests. Each piece must fit the width: no
// page may scroll sideways.

const PIECES = [
  { piece: 'highlights', page: 'writing' },
  { piece: 'highlights', page: 'episodes' },
  { piece: 'sort', page: 'writing' },
  { piece: 'search', page: 'writing' },
  { piece: 'transcript', page: 'episode', open: true },
  { piece: 'licence', page: 'article' },
  { piece: 'slip', page: 'subscribe' },
  { piece: 'fallback', page: 'episode' },
  { piece: 'taphint', page: 'episode' },
  { piece: 'linkedin', page: 'subscribe' },
] as const;

const OUT = path.resolve('test-results', 'pieces');
// How much of the page above a piece its first screen shows, past the frame's top edge.
const ABOVE = 200;

for (const view of VIEWS.filter((v) => v.width === 390 || v.width === 1440)) {
  for (const paper of PAPERS) {
    test.describe(`${view.name} ${paper}`, () => {
      test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile, colorScheme: paper });

      for (const p of PIECES) {
        const name = `${p.piece}-${p.page}`;
        test(name, async ({ page }) => {
          await open(page, `${fixtureOrigin('pieces')}/pieces/${p.page}/`);
          const piece = page.locator(`[data-piece="${p.piece}"]`);
          await expect(piece).toHaveCount(1);
          if ('open' in p) {
            await piece.locator('summary').click();
            await expect(piece.locator('details')).toHaveAttribute('open', '');
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth), 'the page scrolls sideways').toBeLessThanOrEqual(view.width);

          const { top, bottom } = await piece.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top + scrollY, bottom: r.bottom + scrollY };
          });
          const dir = path.join(OUT, name);
          fs.mkdirSync(dir, { recursive: true });
          let y = Math.max(0, top - ABOVE);
          for (let screen = 1; screen <= 6; screen++) {
            await scrollTo(page, y);
            const at = await page.evaluate(() => scrollY);
            fs.writeFileSync(path.join(dir, `${view.name}-${paper}-${screen}.png`), await stableShot(page));
            if (at + view.height >= bottom + 24 || at + view.height >= (await page.evaluate(() => document.documentElement.scrollHeight))) break;
            y = at + view.height - ABOVE;
          }
        });
      }
    });
  }
}
