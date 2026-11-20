import type { Page } from '@playwright/test';
import { test, expect, VIEWS, serveFixtures, fixtureOrigin } from '../targets';

// What the writing pages do (step 9), on the article sample site (tests/fixtures/article): the
// home and step 7 sample articles published, one written as the design's article page draws it.
//
// The shelf filters by subject (the design's chips and its own script), by track and mode, and
// sorts four ways; the filters apply together whichever was pressed last, and the empty line
// shows when nothing is left. As the site launches, with no articles, the shelf is the design's
// leaf with its empty line, and its chips keep it. An article's card turns to its page, and
// "Watch the episode" turns to the video's page and starts it. YouTube is never reached: a blank
// page stands in at the embed's address.

const ORIGIN = fixtureOrigin('article');
const WRITING = `${ORIGIN}/writing/`;
const ARTICLE = `${ORIGIN}/writing/gradient-descent-by-hand/`;
const EPISODE = `${ORIGIN}/episodes/gradient-descent-by-hand/`;
const EMPTY = `${fixtureOrigin('writing-empty')}/writing/`;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`); });
  return errors;
}

const ITEMS = '#writing-index #alist .aitem';
const shown = (page: Page) => page.locator(ITEMS).evaluateAll((els) => els.filter((el) => !(el as HTMLElement).hidden).map((el) => el.querySelector('h3')!.textContent!.trim()));

for (const view of VIEWS.filter((v) => v.width === 390 || v.width === 1440)) {
  test.describe(view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
    test.beforeEach(async ({ context }) => { await serveFixtures(context); });

    test('the shelf filters by subject, track and mode together, and sorts four ways', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(WRITING);
      const shelf = page.locator('#writing-index');
      const empty = shelf.locator('#aempty');
      const chip = (id: string) => shelf.locator(`button[data-cat-filter="${id}"]`);
      const track = (id: string) => shelf.locator(`button[data-shelf="${id}"]`);
      const newest = ['Gradient descent, by hand', 'Reproducing SliceGPT on one laptop', 'Why tokenizers break arithmetic',
        'The sequence-model lineage, 2014 to now', 'A capable model on a Raspberry Pi'];
      expect(await shown(page)).toEqual(newest);
      await expect(empty).toBeHidden();
      await expect(chip('all')).toHaveAttribute('aria-pressed', 'true');
      await expect(shelf.locator('[data-sort="newest"]')).toHaveAttribute('aria-pressed', 'true');

      // The design's chips, as its own script filters them: a subject with no articles empties
      // the shelf.
      await chip('research').click();
      expect(await shown(page)).toEqual([]);
      await expect(empty).toBeVisible();
      await expect(chip('research')).toHaveAttribute('aria-pressed', 'true');
      await chip('tech').click();
      expect(await shown(page)).toEqual(['A capable model on a Raspberry Pi']);
      await expect(empty).toBeHidden();

      // The track row keeps the subject, and the subject keeps the track: on a chip the design's
      // script shows every article of that subject again, and the track then hides the rest.
      await track('foundations').click();
      expect(await shown(page)).toEqual([]);
      await expect(empty).toBeVisible();
      await chip('ai').click();
      expect(await shown(page)).toEqual(['Gradient descent, by hand', 'Why tokenizers break arithmetic']);
      await expect(empty).toBeHidden();
      await track('e3').click();
      expect(await shown(page)).toEqual(['Reproducing SliceGPT on one laptop', 'The sequence-model lineage, 2014 to now']);
      await track('e3:exploration').click();
      expect(await shown(page)).toEqual(['The sequence-model lineage, 2014 to now']);
      await chip('all').click();
      expect(await shown(page)).toEqual(['The sequence-model lineage, 2014 to now']);
      await track('e3:experiment').click();
      expect(await shown(page)).toEqual(['Reproducing SliceGPT on one laptop', 'A capable model on a Raspberry Pi']);
      await track('all').click();
      expect(await shown(page)).toEqual(newest);
      await expect(shelf.locator('[data-shelf][aria-pressed="true"]')).toHaveAttribute('data-shelf', 'all');
      await expect(chip('all')).toHaveAttribute('aria-pressed', 'true');

      await shelf.locator('[data-sort="oldest"]').click();
      expect(await shown(page)).toEqual([...newest].reverse());
      await shelf.locator('[data-sort="az"]').click();
      expect(await shown(page)).toEqual([...newest].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      // Topics in taxonomy.json's order, newest first within each: the AI articles, then Tech.
      await shelf.locator('[data-sort="topic"]').click();
      expect(await shown(page)).toEqual(newest);
      await expect(shelf.locator('[data-sort][aria-pressed="true"]')).toHaveAttribute('data-sort', 'topic');
      expect(errors).toEqual([]);
    });

    test('with no articles, the shelf is the design\'s leaf with its empty line', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(EMPTY);
      const shelf = page.locator('#writing-index');
      await expect(shelf.locator('.aitem')).toHaveCount(0);
      await expect(shelf.locator('#aempty')).toBeVisible();
      await expect(shelf.locator('#aempty')).toHaveText('Nothing filed on this shelf yet.');
      // Only the design's chips: no highlights, track row or sort control.
      await expect(shelf.locator('[data-shelf], [data-sort], .alist:not(#alist)')).toHaveCount(0);
      await expect(shelf.locator('[data-cat-filter]')).toHaveCount(10);
      await shelf.locator('[data-cat-filter="ai"]').click();
      await expect(shelf.locator('#aempty')).toBeVisible();
      await shelf.locator('[data-cat-filter="all"]').click();
      await expect(shelf.locator('#aempty')).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('an article\'s card turns to its page, and "Watch the episode" turns to the video and starts it', async ({ page }) => {
      const errors = watchErrors(page);
      await page.route('https://www.youtube-nocookie.com/embed/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>stand-in</title>' }));
      await page.goto(WRITING);
      await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });
      await page.locator(ITEMS, { hasText: 'Gradient descent, by hand' }).click();
      await expect(page).toHaveURL(ARTICLE);
      const body = page.locator('#article-body');
      await expect(body.locator('h2.arttitle')).toHaveText('Gradient descent, by hand');
      await expect(body.locator('p.dropcap')).toHaveCount(1);
      await expect(body.locator('.stepcard')).toHaveCount(3);
      expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed), 'turned, not reloaded').toBe(true);

      await body.getByRole('link', { name: /Watch the episode/ }).click();
      await expect(page).toHaveURL(EPISODE);
      const frame = page.locator('#player iframe');
      await expect(frame).toHaveCount(1);
      const src = new URL((await frame.getAttribute('src'))!);
      expect(src.origin + src.pathname).toBe('https://www.youtube-nocookie.com/embed/sampleVid01');
      expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed), 'turned, not reloaded').toBe(true);

      // Back to the article, and its link back to the shelf.
      await page.goBack();
      await expect(page).toHaveURL(ARTICLE);
      await expect(page.locator('#player')).toHaveCount(0, { timeout: 2000 });
      await page.locator('#article-body a.mini', { hasText: 'All writing' }).click();
      await expect(page).toHaveURL(WRITING);
      await expect(page.locator(ITEMS)).toHaveCount(5);
      expect(errors).toEqual([]);
    });
  });
}
