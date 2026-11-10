import fs from 'node:fs';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, VIEWS, PAPERS, urlFor, open, designPage, standIn, type View, type PageName } from '../targets';

// The page turn caught halfway (step 4): the site turning from writing to projects against the
// design file making the same turn, both held at the same instant, at every width in both
// papers. The design's own writing and projects contents stand in for the site's empty pages so
// there is something to see turning; they are the pages the site's scripts already draw in full
// (the others wait for script sections that return with their pages, tests/visual/port.ts).
// Both are drawn live in the same browser and must match pixel for pixel, first at rest, then
// halfway through the turn.

const FROM: PageName = 'writing';
const TO: PageName = 'projects';
// Into the turn: the leaving page (.6s) halfway over, the arriving one (.75s) still coming up.
const MID = 300;

const editionOf = (view: View) => (view.width >= 900 ? 'desktop' : 'pocket');
const entry = (view: View) => `${editionOf(view) === 'desktop' ? '.tabs' : '.dock'} [data-route="${TO}"]`;

async function still(page: Page): Promise<Buffer> {
  const shoot = () => page.screenshot({ animations: 'allow', caret: 'hide', scale: 'css' });
  let shot = await shoot();
  for (let i = 0; i < 10; i++) {
    const next = await shoot();
    if (next.equals(shot)) return next;
    shot = next;
  }
  throw new Error('The screen never held still for two shots in a row');
}

type Capture = { rest: Buffer; turn: Buffer; turning: unknown };

async function capture(page: Page, url: string, view: View): Promise<Capture> {
  await open(page, url);
  const rest = await still(page);
  // The page's own clock stands still from here: the timers that end the turn and the frames
  // that drive the scroll effects run only when the test says.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 500);
  await page.evaluate((selector) => (document.querySelector(selector) as HTMLElement).click(), entry(view));
  // The site fetches the next page first. Polled from here, as the page's own timers stand still.
  for (let tries = 0; !(await page.evaluate(() => !!document.querySelector('.page.arriving'))); tries++) {
    if (tries > 200) throw new Error('the turn never started');
    await new Promise((done) => setTimeout(done, 10));
  }
  // Every animation held at the same instant, then three frames of the scroll effects.
  await page.evaluate(async (t) => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
    await document.fonts.ready;
  }, MID);
  await page.clock.runFor(48);
  const turning = await page.evaluate(async () => {
    await document.fonts.ready;
    // Anything the scroll effects started in those frames, held at its start.
    for (const a of document.getAnimations()) if (a.playState === 'running') { a.pause(); a.currentTime = 0; }
    return {
      pages: [...document.querySelectorAll<HTMLElement>('[data-page]')].filter((p) => !p.hidden).map((p) => `${p.dataset.page} ${p.className}`),
      held: document.getAnimations().map((a) => (a as CSSAnimation).animationName).filter((n) => n === 'turnout' || n === 'turnin').sort(),
    };
  });
  return { rest, turn: await still(page), turning };
}

async function keep(testInfo: TestInfo, name: string, shot: Buffer): Promise<void> {
  const file = testInfo.outputPath(`${name}.png`);
  fs.writeFileSync(file, shot);
  await testInfo.attach(name, { path: file, contentType: 'image/png' });
}

for (const view of VIEWS) {
  for (const paper of PAPERS) {
    test.describe(`turn ${view.name} ${paper}`, () => {
      test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile, colorScheme: paper });

      test(`${FROM} to ${TO}, halfway`, async ({ context, page, target }, testInfo) => {
        test.skip(target !== 'site', 'The site against the design');
        // Two pages loaded and settled, four shots each held still: over 30 s while the shell's
        // screenshots run beside it.
        test.setTimeout(120_000);
        const edition = editionOf(view);
        await standIn(context, `/${FROM}/`, designPage(edition, FROM));
        await standIn(context, `/${TO}/`, designPage(edition, TO));
        await page.clock.install();

        const site = await capture(page, urlFor('site', view, FROM), view);
        await page.clock.resume();
        const design = await capture(page, urlFor('reference', view, FROM), view);
        for (const [name, got] of [['site', site], ['design', design]] as const) {
          await keep(testInfo, `${name}-at-rest`, got.rest);
          await keep(testInfo, `${name}-mid-turn`, got.turn);
        }

        expect(site.rest.equals(design.rest), `the site's ${FROM} page at rest matches the design's, so the turn compares like with like`).toBe(true);
        // Both caught in the middle of the turn, both pages on screen.
        for (const got of [site, design]) {
          expect(got.turning).toEqual({ pages: [`${FROM} page leaving`, `${TO} page arriving`], held: ['turnin', 'turnout'] });
        }
        expect(site.turn.equals(design.turn), 'the site\'s turn matches the design\'s, pixel for pixel').toBe(true);
      });
    });
  }
}
