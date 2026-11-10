import type { Locator, Page } from '@playwright/test';
import { test, expect, VIEWS, urlFor, serveFixtures, editionOf, type View } from '../targets';

// What the home page does (step 5), pressed and dragged on the design-sample site
// (tests/fixtures) at every width: the four-page pad, the track cards, the loose notes, the
// by-hand playground, the cabinet's folders and Echo, each as the design's scripts run them.
// Then the same on a home page a turn places, and on one turned back in while the old one is
// still turning out.

const other = (view: View) => (editionOf(view) === 'desktop' ? 'pocket' : 'desktop');
const navOf = (view: View) => (editionOf(view) === 'desktop' ? '.tabs' : '.dock');
const frames = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

// The page a turn ends on: one page, at its address, done turning.
async function turned(page: Page, address: string, name: string): Promise<void> {
  await page.waitForFunction(([to, n]) => {
    const pages = document.querySelectorAll<HTMLElement>('[data-page]');
    return location.pathname === to && pages.length === 1 && pages[0].dataset.page === n && !document.querySelector('.page.arriving, .page.leaving');
  }, [address, name]);
}

const style = (el: Locator, name: string) => el.evaluate((e, n) => (e as HTMLElement).style.getPropertyValue(n), name);

// Waits until nothing around a part is moving: no transition or finite animation running on the
// part or any element holding it (a card still turning over, a card easing into its tilt).
const still = (part: Locator) => part.evaluate(async (el) => {
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const moving = document.getAnimations().filter((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    return a.playState === 'running' && target instanceof Element && target.contains(el) && Number.isFinite(Number(a.effect!.getComputedTiming().endTime));
  });
  await Promise.all(moving.map((a) => a.finished.catch(() => undefined)));
});

// Puts the pointer on a part the way a person does: waits for it to come to rest, moves there,
// lets the page answer (a desktop card tilts toward the pointer, the scroll effects lift a leaf),
// and aims again until the part stops moving. Playwright's own click measures once and presses
// where the part was, which on a tilting or turning card can land beside a small button, on the
// design's own files as well. `fx`, `fy` say where on the part, as fractions of its width and
// height. On a tilted desktop card turned over, the design file too has small spots on the back's
// button where a press reaches the card instead (PARKING_LOT.md), so if the pointer is not over
// the part it tries a little above, below, left and right, as a person presses again; and fails
// if none of those is over the part either.
async function aim(page: Page, part: Locator, fx = 0.5, fy = 0.5): Promise<{ x: number; y: number }> {
  // In the middle of the screen, clear of the pocket's dock, and of the rail, where the pocket's
  // cards snap to.
  await part.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  await expect(part).toBeVisible();
  const spots = [[fx, fy], [fx, fy - 0.2], [fx, fy + 0.2], [fx - 0.15, fy], [fx + 0.15, fy]];
  for (const [sx, sy] of spots) {
    let at: { x: number; y: number } | null = null;
    for (let tries = 0; tries < 10; tries++) {
      await still(part);
      const box = (await part.boundingBox())!;
      const next = { x: Math.round(box.x + box.width * sx), y: Math.round(box.y + box.height * sy) };
      if (at && next.x === at.x && next.y === at.y) break;
      at = next;
      await page.mouse.move(at.x, at.y, { steps: 3 });
    }
    await still(part);
    if (await part.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), at!)) return at!;
  }
  throw new Error(`The pointer found no spot on ${part} that reaches it.`);
}

async function press(page: Page, part: Locator): Promise<void> {
  await aim(page, part);
  await page.mouse.down();
  await page.mouse.up();
}

async function padTurns(page: Page): Promise<void> {
  const num = page.locator('#pgNum');
  const next = page.locator('#pgNext');
  const back = page.locator('#pgBack');
  const pages = page.locator('#pad .pg');
  const turnedOver = () => pages.evaluateAll((ps) => ps.map((p) => p.classList.contains('turned')));
  const open = () => pages.evaluateAll((ps) => ps.map((p) => !p.hasAttribute('inert')));
  await expect(num).toHaveText('Page 1 of 4');
  await expect(back).toBeDisabled();
  expect(await open()).toEqual([true, false, false, false]);
  for (let n = 2; n <= 4; n++) {
    await next.click();
    await expect(num).toHaveText(`Page ${n} of 4`);
  }
  await expect(next).toBeDisabled();
  expect(await turnedOver()).toEqual([true, true, true, false]);
  expect(await open()).toEqual([false, false, false, true]);
  await back.click();
  await expect(num).toHaveText('Page 3 of 4');
  await expect(next).toBeEnabled();
  expect(await turnedOver()).toEqual([true, true, false, false]);
}

async function cardsTurn(page: Page, view: View): Promise<void> {
  const cards = page.locator('.flipcard');
  expect(await cards.count()).toBe(3);
  for (let i = 0; i < 3; i++) {
    const card = cards.nth(i);
    await press(page, card.locator('.front [data-flip]'));
    await expect(card).toHaveClass(/\bflipped\b/);
    expect(await card.locator('.front').getAttribute('inert')).toBe('');
    expect(await card.locator('.back').getAttribute('inert')).toBe(null);
    // The design's script then focuses the other face's button, but that face only shows at the
    // half-turn (0.36 s), so focus goes nowhere, on the design files too (PARKING_LOT.md).
    await press(page, card.locator('.back [data-flip]'));
    await expect(card).not.toHaveClass(/\bflipped\b/);
    expect(await card.locator('.front').getAttribute('inert')).toBe(null);
    expect(await card.locator('.back').getAttribute('inert')).toBe('');
  }
  if (editionOf(view) === 'pocket') {
    // The dots under the rail follow the card in the middle of it as the rail scrolls.
    const on = () => page.locator('#dots i').evaluateAll((ds) => ds.findIndex((d) => d.classList.contains('on')));
    for (const i of [2, 1, 0]) {
      await cards.nth(i).evaluate((c) => c.scrollIntoView({ inline: 'center', block: 'nearest' }));
      await expect.poll(on, { message: `the dot for card ${i}` }).toBe(i);
    }
  }
}

async function foldersOpen(page: Page): Promise<void> {
  for (const [folder, sheets] of [['.folder.a', 4], ['.folder.b', 6]] as const) {
    const f = page.locator(folder);
    const drawer = page.locator(`#${await f.getAttribute('aria-controls')}`);
    await expect(drawer).toBeHidden();
    await f.click();
    await expect(f).toHaveAttribute('aria-expanded', 'true');
    await expect(f.locator('.f-hint')).toHaveText('Close');
    await expect(drawer).toBeVisible();
    expect(await drawer.locator('.sheet').evaluateAll((ss) => ss.map((s) => (s as HTMLElement).style.getPropertyValue('--n'))))
      .toEqual(Array.from({ length: sheets }, (_, n) => String(n)));
    await f.click();
    await expect(f).toHaveAttribute('aria-expanded', 'false');
    await expect(f.locator('.f-hint')).toHaveText('Open');
    await expect(drawer).toBeHidden();
  }
}

async function echoCounts(page: Page): Promise<void> {
  const count = page.locator('#epCount');
  await expect(count).toHaveText('Episode 001');
  // Pressed once: one more episode, and Echo goes round.
  expect(await page.locator('#echoBtn').evaluate((b) => { (b as HTMLElement).click(); return b.classList.contains('go'); })).toBe(true);
  await expect(count).toHaveText('Episode 002');
  await page.locator('#echoBtn').click();
  await expect(count).toHaveText('Episode 003');
  expect(await page.evaluate(() => localStorage.getItem('st-ep'))).toBe('3');
}

async function playgroundSteps(page: Page, view: View): Promise<void> {
  const say = page.locator('#gdSay');
  const step = page.locator('#stepBtn');
  const canvas = page.locator('#gd');
  const START = 'The dot starts at weight 7.50. Each step moves it against the slope.';
  const drawn = () => canvas.evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  await canvas.scrollIntoViewIfNeeded();
  await expect(say).toHaveText(START);
  expect(await canvas.evaluate((c) => (c as HTMLCanvasElement).width)).toBeGreaterThan(0);
  const before = await drawn();

  // One step at size 0.30 from 7.50: slope 9.00, move 2.70, to 4.80, loss 3.24.
  await step.click();
  await expect(say).toHaveText('Closer. The curve is flatter here, so the next step will be smaller.');
  if (editionOf(view) === 'desktop') {
    expect(await page.locator('#gdBody tr').evaluateAll((rs) => rs.map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent))))
      .toEqual([['1', '7.50', '9.00', '2.70', '4.80', '3.24']]);
  } else {
    await expect(page.locator('#workHead')).toHaveText('Step 1, worked out');
    expect(await page.locator('#workBody dd').allTextContents()).toEqual(['7.50', '9.00', '0.30 × 9.00 = 2.70', '7.50 − 2.70 = 4.80', '3.24']);
  }
  await expect.poll(drawn, { message: 'the dot moves on the curve' }).not.toBe(before);

  // At step size 1.10, from 4.80: slope 3.60, to 0.84, further from the bottom (3) than before.
  await page.locator('#lr').evaluate((r) => { (r as HTMLInputElement).value = '1.1'; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#lrOut')).toHaveText('1.10');
  await step.click();
  await expect(say).toHaveText('That step landed further from the bottom than it started. The step size is too big.');

  // From the start at 1.10 the first step lands at −2.40, off the page, and stepping stops.
  await page.locator('#resetBtn').click();
  await expect(say).toHaveText(START);
  await step.click();
  // The two editions word this one differently.
  await expect(say).toHaveText(`Off the page. Each step ${editionOf(view) === 'desktop' ? 'is landing' : 'lands'} further out than the last. Start over with a smaller step size.`);
  await expect(step).toBeDisabled();

  // Start over puts the dot back; pressing the curve puts it where it was pressed.
  await page.locator('#resetBtn').click();
  await expect(say).toHaveText(START);
  await expect(step).toBeEnabled();
  if (editionOf(view) === 'desktop') await expect(page.locator('#gdBody td')).toHaveText(/^No steps yet/);
  else await expect(page.locator('#workBody dt')).toHaveText(/^No steps yet/);
  await aim(page, canvas, 0.25, 0.5);
  await page.mouse.down();
  await page.mouse.up();
  // A quarter of the way across is left of the lowest point (3): between −2 and 2.
  await expect(say).toHaveText(/^The dot starts at weight -?[01]\.\d\d\. Each step moves it against the slope\.$/);
}

async function notesMove(page: Page, view: View): Promise<void> {
  const notes = page.locator(editionOf(view) === 'desktop' ? '[data-drag]' : '#note');
  expect(await notes.count()).toBe(editionOf(view) === 'desktop' ? 2 : 1);
  for (let i = 0; i < await notes.count(); i++) {
    const note = notes.nth(i);
    const { x, y } = await aim(page, note);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 24, { steps: 4 });
    await page.mouse.up();
    expect([await style(note, '--dx'), await style(note, '--dy')]).toEqual(['40px', '24px']);
    await note.dblclick();
    expect([await style(note, '--dx'), await style(note, '--dy')]).toEqual(['0px', '0px']);
    await note.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect([await style(note, '--dx'), await style(note, '--dy')]).toEqual(['16px', '32px']);
    await page.keyboard.press('Escape');
    expect([await style(note, '--dx'), await style(note, '--dy')]).toEqual(['0px', '0px']);
  }
}

// The parts the scroll effects move: the cover's Echo as the cover scrolls away, and on the
// desktop the deck of cards as it comes up the screen.
async function scrollEffects(page: Page, view: View): Promise<void> {
  await page.evaluate(() => scrollTo(0, 300));
  await frames(page);
  expect(Number(await style(page.locator('#echoWrap'), '--s'))).toBeGreaterThan(0);
  if (editionOf(view) === 'desktop') {
    await page.locator('#deck').evaluate((d) => scrollTo(0, d.getBoundingClientRect().top + scrollY - innerHeight * 0.8));
    await frames(page);
    const pd = Number(await style(page.locator('#deck'), '--pd'));
    expect(pd).toBeGreaterThan(0);
    expect(pd).toBeLessThan(1);
  }
  await page.evaluate(() => scrollTo(0, 0));
  await frames(page);
}

for (const view of VIEWS) {
  test.describe(view.name, () => {
    // Waiting for each card to come to rest before pressing it takes time: the longest test
    // turns the pad, six card faces, two folders, Echo, the playground and the notes.
    test.describe.configure({ timeout: 120_000 });
    test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
    test.beforeEach(async ({ context }) => { await serveFixtures(context); });
    const home = urlFor('fixture', view, 'home');

    test('holds only its own edition\'s parts, so every id names one element', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(home);
      expect(await page.locator(`[data-edition="${other(view)}"]`).count()).toBe(0);
      expect(await page.locator(`[data-edition="${editionOf(view)}"]`).count()).toBeGreaterThan(0);
      const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map((e) => e.id));
      expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
      expect(await page.locator(editionOf(view) === 'desktop' ? '#premise' : '#why').count()).toBe(1);
      expect(errors).toEqual([]);
    });

    test('the pad turns its four pages over and back', async ({ page }) => {
      await page.goto(home);
      await padTurns(page);
    });

    test('each track card turns over and back', async ({ page }) => {
      await page.goto(home);
      await cardsTurn(page, view);
      if (editionOf(view) === 'desktop') {
        // And tilts under the pointer.
        const card = page.locator('[data-tilt]').first();
        const box = (await card.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3);
        await expect.poll(() => card.evaluate((c) => (c as HTMLElement).style.transform)).toContain('rotateY(');
      }
    });

    test('the loose notes move with the pointer and the arrow keys, and go back', async ({ page }) => {
      await page.goto(home);
      await notesMove(page, view);
    });

    test('the playground walks the dot downhill, and starts over', async ({ page }) => {
      await page.goto(home);
      await playgroundSteps(page, view);
    });

    test('the folders open onto their sheets and close', async ({ page }) => {
      await page.goto(home);
      await foldersOpen(page);
    });

    test('Echo counts one more episode a press, and remembers it', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(home);
      await echoCounts(page);
      await page.reload();
      await expect(page.locator('#epCount')).toHaveText('Episode 003');
      if (editionOf(view) === 'desktop') {
        // Echo leans toward the pointer.
        const box = (await page.locator('#echoWrap').boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2);
        await expect.poll(() => style(page.locator('#echoLt'), '--ey')).not.toBe('0deg');
        expect(await style(page.locator('#echoLt'), '--ey')).not.toBe('');
      }
      await scrollEffects(page, view);
      expect(errors).toEqual([]);
    });

    test('a home page a turn places works the same', async ({ page }) => {
      const errors = watchErrors(page);
      // The sample site's own about page, empty as the site's is.
      await page.goto(new URL('/about/', home).href);
      await page.click(`${navOf(view)} [data-route="home"]`);
      await turned(page, '/', 'home');
      expect(await page.locator(`[data-edition="${other(view)}"]`).count()).toBe(0);
      await padTurns(page);
      await cardsTurn(page, view);
      await foldersOpen(page);
      await echoCounts(page);
      await playgroundSteps(page, view);
      await notesMove(page, view);
      await scrollEffects(page, view);
      expect(errors).toEqual([]);
    });

    test('a home page turned back in while the old one is still turning out gets its own parts', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(home);
      await page.click(`${navOf(view)} [data-route="about"]`);
      await page.waitForFunction(() => location.pathname === '/about/');
      // Straight back, before the home page that left has gone.
      expect(await page.locator('[data-page="home"]').count()).toBe(1);
      await page.click(`${navOf(view)} [data-route="home"]`);
      await turned(page, '/', 'home');
      await padTurns(page);
      await echoCounts(page);
      await foldersOpen(page);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('the live home page', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // The site's own content files hold no episodes, articles or projects yet: the cards keep their
  // fronts and backs with empty lists, and the folders open onto no sheets (your decision, step 5).
  test('keeps its cards and folders while the shelves are empty', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(urlFor('site', VIEWS[2], 'home'));
    expect(await page.locator('#deck .front h3').allTextContents()).toEqual(['Foundations', 'Course', 'E³']);
    expect(await page.locator('#deck .front li').count()).toBe(0);
    expect(await page.locator('#deck .back li').count()).toBe(9);
    expect(await page.locator('#files .f-meta').allTextContents()).toEqual(['0 inside', '0 inside']);
    await page.locator('.folder.a').click();
    await expect(page.locator('#drawer-articles')).toBeVisible();
    expect(await page.locator('.sheet').count()).toBe(0);
    expect(errors).toEqual([]);
  });
});
