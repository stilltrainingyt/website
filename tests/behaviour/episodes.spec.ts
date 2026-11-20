import type { Frame, Page } from '@playwright/test';
import { test, expect, VIEWS, serveFixtures, standInYouTube, fixtureOrigin } from '../targets';

// What the episodes pages do (step 8), on the episode sample site (tests/fixtures/episode): the
// step 7 sample videos published, one written as the design's episode page draws it, and the
// home samples' planned episodes on the board.
//
// The board filters by track and keeps a queue in the browser. The archive filters by track,
// mode and topic together and sorts four ways. A video's card opens its page and starts it.
// On the episode page, the cover plays the video in the box with sound, the page lifted above
// the paper grain and the design's overlays gone; chapters and transcript stamps start or jump
// the player; any error, or no ready signal within 10 seconds, swaps in the "Watch on YouTube"
// box; ready but held, the tap hint shows 3 seconds on; with scripts off the play button is a
// plain link to the video on YouTube.
//
// YouTube is never reached: a stand-in at the embed's address speaks its player's message
// protocol, as the real one does to YouTube's own iframe API. It plays at once ("play"),
// stays ready but held ("hold"), reports an error ("error"), or cannot be reached at all
// ("unreachable"). It paints itself pure green, so a screenshot shows whether the grain is over it.

type Mode = 'play' | 'hold' | 'error' | 'unreachable';
const ORIGIN = fixtureOrigin('episode');
const EPISODE = `${ORIGIN}/episodes/gradient-descent-by-hand/`;
const EPISODES = `${ORIGIN}/episodes/`;
const WATCH = 'https://www.youtube.com/watch?v=sampleVid01';
const GREEN = '#00ff00';

const embed = (mode: Mode) => `<!doctype html><html><body style="margin:0;background:${GREEN}"><script>
var mode=${JSON.stringify(mode)}; window.got=[];
function send(m){m.id=1;m.channel="widget";parent.postMessage(JSON.stringify(m),"*");}
addEventListener("message",function(e){
  var m; try{m=JSON.parse(e.data);}catch(x){return;}
  got.push(m);
  if(m.event!=="listening"||window.answered)return;
  window.answered=true;
  if(mode==="error"){send({event:"onReady",info:null}); send({event:"onError",info:150}); return;}
  send({event:"initialDelivery",info:{playerState:-1}}); send({event:"onReady",info:null});
  if(mode==="play")setTimeout(function(){send({event:"onStateChange",info:1}); send({event:"infoDelivery",info:{playerState:1}});},50);
});
</script></body></html>`;

async function standInPlayer(page: Page, mode: Mode): Promise<void> {
  await page.route('https://www.youtube-nocookie.com/embed/**', (route) => (mode === 'unreachable'
    ? route.abort()
    : route.fulfill({ contentType: 'text/html; charset=utf-8', body: embed(mode) })));
}

// The stand-in player's frame, and the messages the page has sent it.
const playerFrame = (page: Page): Frame | undefined => page.frames().find((f) => f.url().startsWith('https://www.youtube-nocookie.com/embed/'));
async function heard(page: Page): Promise<{ event: string; func?: string; args?: unknown[] }[]> {
  const frame = playerFrame(page);
  // Until the stand-in's page has loaded into the frame, nothing has been heard.
  return (frame && await frame.evaluate(() => (window as unknown as { got?: { event: string }[] }).got).catch(() => undefined)) || [];
}
const commands = async (page: Page) => (await heard(page)).filter((m) => m.event === 'command').map((m) => [m.func, ...(m.args ?? [])]);

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`); });
  return errors;
}

const shown = (page: Page, selector: string) => page.locator(selector).evaluateAll((els) => els.filter((el) => !(el as HTMLElement).hidden).map((el) => el.querySelector('h3')!.textContent!.trim()));

for (const view of VIEWS.filter((v) => v.width === 390 || v.width === 1440)) {
  test.describe(view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });
    test.beforeEach(async ({ context }) => { await serveFixtures(context); });
    const desktop = view.width >= 900;

    test('the board filters by track and keeps a queue in this browser', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(EPISODES);
      const rows = desktop ? '#logTable tbody tr' : '#eps .ep';
      const visible = () => page.locator(rows).evaluateAll((els) => els.filter((el) => !(el as HTMLElement).hidden).map((el) => el.getAttribute('data-slate')));
      expect(await visible()).not.toContain('ST-002');
      const all = await visible();
      await page.locator('[data-filter="Course"]').click();
      const course = await visible();
      expect(course.length).toBeGreaterThan(0);
      expect(course.length).toBeLessThan(all.length);
      await page.locator('[data-filter="all"]').click();
      expect(await visible()).toEqual(all);

      await expect(page.locator('#qCount')).toHaveText('Nothing queued yet');
      await page.locator(rows).first().getByRole('button', { name: /Queue/ }).click();
      await expect(page.locator('#qCount')).toHaveText('1 episode in your queue');
      await expect(page.locator(rows).first().locator('.qstamp')).toHaveText('QUEUED');
      await page.reload();
      await expect(page.locator('#qCount')).toHaveText('1 episode in your queue');
      expect(await page.evaluate(() => localStorage.getItem('st-queue'))).toBe(JSON.stringify([all[0]]));
      expect(errors).toEqual([]);
    });

    test('the archive filters by track, mode and topic together, and sorts four ways', async ({ page }) => {
      const errors = watchErrors(page);
      await page.goto(EPISODES);
      const archive = page.locator('#ep-archive');
      const items = '#ep-archive .alist .aitem';
      const empty = archive.locator('[data-empty]');
      const newest = ['The training loop, end to end', 'SliceGPT, reproduced on one laptop', 'Gradient descent, by hand',
        'What a model actually stores', 'Linear algebra you actually use', 'Backpropagation without the chain-rule fear'];
      expect(await shown(page, items)).toEqual(newest);
      await expect(empty).toBeHidden();
      await expect(archive.locator('[data-sort="newest"]')).toHaveAttribute('aria-pressed', 'true');

      await archive.locator('button[data-shelf="foundations"]').click();
      expect(await shown(page, items)).toEqual(['Gradient descent, by hand', 'What a model actually stores', 'Backpropagation without the chain-rule fear']);
      await archive.locator('button[data-topic="research"]').click();
      expect(await shown(page, items)).toEqual([]);
      await expect(empty).toBeVisible();
      await archive.locator('button[data-shelf="e3"]').click();
      expect(await shown(page, items)).toEqual(['SliceGPT, reproduced on one laptop']);
      await expect(empty).toBeHidden();
      await archive.locator('button[data-shelf="e3:experiment"]').click();
      expect(await shown(page, items)).toEqual(['SliceGPT, reproduced on one laptop']);
      await archive.locator('button[data-shelf="e3:exploration"]').click();
      expect(await shown(page, items)).toEqual([]);
      await expect(empty).toBeVisible();
      await archive.locator('button[data-shelf="all"]').click();
      await archive.locator('button[data-topic="all"]').click();
      expect(await shown(page, items)).toEqual(newest);
      await expect(archive.locator('[data-shelf][aria-pressed="true"]')).toHaveAttribute('data-shelf', 'all');

      await archive.locator('[data-sort="oldest"]').click();
      expect(await shown(page, items)).toEqual([...newest].reverse());
      await archive.locator('[data-sort="az"]').click();
      expect(await shown(page, items)).toEqual([...newest].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })));
      // Topics in taxonomy.json's order, newest first within each: the AI episodes, then research.
      await archive.locator('[data-sort="topic"]').click();
      expect(await shown(page, items)).toEqual([...newest.filter((t) => !t.startsWith('SliceGPT')), 'SliceGPT, reproduced on one laptop']);
      await expect(archive.locator('[data-sort][aria-pressed="true"]')).toHaveAttribute('data-sort', 'topic');
      expect(errors).toEqual([]);
    });

    test('a video\'s card opens its page and starts it; history turns do not', async ({ page }) => {
      const errors = watchErrors(page);
      await standInPlayer(page, 'play');
      await page.goto(EPISODES);
      await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });
      await page.locator('#ep-archive .aitem', { hasText: 'Gradient descent, by hand' }).click();
      await expect(page).toHaveURL(EPISODE);
      await expect(page.locator('#player iframe')).toHaveCount(1);
      expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed), 'turned, not reloaded').toBe(true);
      await expect.poll(async () => (await heard(page)).some((m) => m.event === 'listening')).toBe(true);
      await expect(page.locator('html')).toHaveAttribute('data-video', '');

      await page.goBack();
      await expect(page).toHaveURL(EPISODES);
      await expect(page.locator('#player')).toHaveCount(0, { timeout: 2000 });
      await expect(page.locator('html')).not.toHaveAttribute('data-video', '');
      await page.goForward();
      await expect(page).toHaveURL(EPISODE);
      await expect(page.locator('#player .play')).toBeVisible();
      await expect(page.locator('#player iframe')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('the cover plays the video in the box, with sound, its overlays gone and above the grain', async ({ page }) => {
      const errors = watchErrors(page);
      await standInPlayer(page, 'play');
      await page.goto(EPISODE);
      const box = page.locator('#player');
      await expect(box.locator('img.thumb')).toHaveAttribute('src', 'https://i.ytimg.com/vi/sampleVid01/hqdefault.jpg');
      await expect(box.locator('a.play')).toHaveAttribute('href', WATCH);
      await expect(page.locator('html')).not.toHaveAttribute('data-video', '');
      await box.click();

      const frame = box.locator('iframe');
      await expect(frame).toHaveCount(1);
      const src = new URL((await frame.getAttribute('src'))!);
      expect(src.origin + src.pathname).toBe('https://www.youtube-nocookie.com/embed/sampleVid01');
      expect(Object.fromEntries(src.searchParams)).toEqual({ autoplay: '1', playsinline: '1', rel: '0', enablejsapi: '1', origin: ORIGIN });
      await expect(frame).toHaveAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
      await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      await expect(frame).toHaveAttribute('title', 'Gradient descent, by hand');
      await expect.poll(async () => (await heard(page)).some((m) => m.event === 'listening')).toBe(true);

      // The design's grid, play button, caption, timecode and progress bar give way.
      for (const part of ['.play', '.pcap', '.ptc', '.pbar', 'img.thumb']) await expect(box.locator(part)).toBeHidden();
      expect(await box.evaluate((el) => getComputedStyle(el, '::before').display)).toBe('none');

      // Lifted above the grain: the stand-in's green comes through untouched, and does not with
      // the lift taken off.
      await expect(page.locator('html')).toHaveAttribute('data-video', '');
      // The middle half of the player: the desktop's leaves tilt in 3D, so the player is drawn a
      // little out of square and the corners of its box are page, not video.
      const clip = await frame.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 4), y: Math.round(r.top + r.height / 4), width: Math.round(r.width / 2), height: Math.round(r.height / 2) };
      });
      const shot = () => page.screenshot({ clip, animations: 'disabled', caret: 'hide', scale: 'css' });
      const swatchPage = await page.context().newPage();
      await swatchPage.setContent(`<body style="margin:0"><div style="width:${clip.width}px;height:${clip.height}px;background:${GREEN}"></div></body>`);
      const swatch = await swatchPage.locator('div').screenshot({ animations: 'disabled', scale: 'css' });
      await swatchPage.close();
      const lifted = await shot();
      if (!lifted.equals(swatch)) await test.info().attach('lifted', { body: lifted, contentType: 'image/png' });
      expect(lifted.equals(swatch), 'the video shows through with no grain over it').toBe(true);
      await page.evaluate(() => document.documentElement.removeAttribute('data-video'));
      expect((await shot()).equals(swatch), 'without the lift, the grain tints it').toBe(false);
      await page.evaluate(() => document.documentElement.setAttribute('data-video', ''));

      await page.waitForTimeout(3500);
      await expect(page.locator('[data-taphint]')).toBeHidden();
      expect(errors).toEqual([]);
    });

    test('chapters and transcript stamps start the player at their time, or jump it there', async ({ page }) => {
      const errors = watchErrors(page);
      await standInPlayer(page, 'play');
      await page.goto(EPISODE);
      await page.locator('#chaps .chap', { hasText: 'The bowl' }).click();
      const frame = page.locator('#player iframe');
      await expect(frame).toHaveCount(1);
      expect(new URL((await frame.getAttribute('src'))!).searchParams.get('start')).toBe('130');
      await expect.poll(async () => (await heard(page)).some((m) => m.event === 'listening')).toBe(true);

      await page.locator('#chaps .chap', { hasText: 'Slope, by hand' }).click();
      await expect.poll(() => commands(page)).toEqual([['seekTo', 270, true], ['playVideo']]);
      await page.locator('#episode-notes summary').click();
      await page.locator('#episode-notes details .chap', { hasText: 'Three steps on paper' }).click();
      await expect.poll(() => commands(page)).toEqual([['seekTo', 270, true], ['playVideo'], ['seekTo', 460, true], ['playVideo']]);
      await expect(frame).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test('a player error swaps in the "Watch on YouTube" box', async ({ page }) => {
      await standInPlayer(page, 'error');
      await page.goto(EPISODE);
      await page.locator('#player').click();
      const fallback = page.locator('#episode-player .player');
      await expect(page.locator('#player')).toHaveCount(0, { timeout: 2000 });
      await expect(fallback).toHaveCount(1);
      await expect(fallback.locator('a.btn')).toHaveAttribute('href', WATCH);
      await expect(fallback.locator('a.btn')).toHaveAttribute('target', '_blank');
      await expect(fallback.locator('.pcap')).toHaveText('Can\'t play it here');
      await expect(page.locator('iframe')).toHaveCount(0);
      await expect(page.locator('[data-taphint]')).toBeHidden();
      await expect(page.locator('html')).not.toHaveAttribute('data-video', '');
      // A chapter now does nothing.
      await page.locator('#chaps .chap').first().click();
      await expect(page.locator('iframe')).toHaveCount(0);
    });

    test('no ready signal within 10 seconds swaps in the "Watch on YouTube" box', async ({ page }) => {
      test.setTimeout(30_000);
      await standInPlayer(page, 'unreachable');
      await page.goto(EPISODE);
      const start = Date.now();
      await page.locator('#player').click();
      await expect(page.locator('#player iframe')).toHaveCount(1);
      await page.waitForTimeout(8000);
      await expect(page.locator('#player iframe'), 'still waiting at 8 seconds').toHaveCount(1);
      await expect(page.locator('#episode-player .player a.btn')).toHaveAttribute('href', WATCH, { timeout: 4000 });
      expect(Date.now() - start).toBeGreaterThanOrEqual(10_000);
      await expect(page.locator('iframe')).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveAttribute('data-video', '');
    });

    test('ready but held, the tap hint shows 3 seconds on', async ({ page }) => {
      await standInPlayer(page, 'hold');
      await page.goto(EPISODE);
      await page.locator('#player').click();
      await expect.poll(async () => (await heard(page)).some((m) => m.event === 'listening')).toBe(true);
      const hint = page.locator('[data-taphint]');
      await page.waitForTimeout(2500);
      await expect(hint, 'not yet at 2.5 seconds').toBeHidden();
      await expect(hint).toBeVisible({ timeout: 1500 });
      await expect(hint.locator('.hand')).toHaveText('Tap the video to start. Still stuck?');
      await expect(hint.locator('a.mini')).toHaveAttribute('href', WATCH);
      await expect(page.locator('#player iframe'), 'the player stays').toHaveCount(1);
    });
  });
}

// The project's own context (targets.ts) always runs scripts, so this test makes its own.
test.describe('scripts off', () => {
  test('the play button is a plain link to the video on YouTube', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    await serveFixtures(context);
    await standInYouTube(context);
    const page = await context.newPage();
    await page.goto(EPISODE);
    const play = page.locator('[data-edition="desktop"] #player a.play');
    await expect(play).toBeVisible();
    await expect(play).toHaveAttribute('href', WATCH);
    await expect(play).toHaveAttribute('target', '_blank');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('[data-edition="desktop"] [data-taphint]')).toBeHidden();
    await expect(page.locator('[data-edition="desktop"] #player img.thumb')).toBeVisible();
    await context.close();
  });
});
