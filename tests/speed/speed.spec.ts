import fs from 'node:fs';
import path from 'node:path';
import type { CDPSession, Page } from '@playwright/test';
import { test, expect, VIEWS, urlFor, settle, serveSite } from '../targets';

// Load the home page, scroll it top to bottom in 8 seconds, turn one page, then press one
// control, at three CPU slowdowns, and report how hard the main thread worked. The budgets
// in CLAUDE.md are enforced against the built site at 4×; for the design files the numbers
// are the starting point every later step is measured against.
//
// While the site's pages are empty (step 3) its home page cannot scroll, so the test gives
// the empty page ten screens of height and scrolls the journal around it. On the site the page
// turn (step 4) goes to the episodes page's own address: its file is fetched and its page
// placed, and all of that counts as the turn's work.
const RATES = [1, 4, 6];
const SCROLL_MS = 8000;
const EDITIONS = [VIEWS[0], VIEWS[2]];

type Row = {
  edition: string;
  rate: number;
  lcp: number;
  cls: number;
  busyPerSecond: number;
  longTasks: number;
  longestTask: number;
  p95Frame: number;
  turnMs: number | null;
  turnLongTasks: number | null;
  control: string;
  inp: number;
  padded: boolean;
};

async function busyMs(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')!.value * 1000;
}

// The page's largest contentful paint and layout shift so far.
async function loadMetrics(page: Page): Promise<{ lcp: number; cls: number }> {
  return page.evaluate(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    await document.fonts.ready;
    await new Promise((done) => setTimeout(done, 500));
    const entries = (type: string) => new Promise<PerformanceEntry[]>((done) => {
      new PerformanceObserver((list, observer) => { observer.disconnect(); done(list.getEntries()); }).observe({ type, buffered: true });
      setTimeout(() => done([]), 1000);
    });
    const lcp = await entries('largest-contentful-paint');
    const shifts = await entries('layout-shift') as (PerformanceEntry & { value: number; hadRecentInput: boolean })[];
    return {
      lcp: lcp.length ? lcp[lcp.length - 1].startTime : NaN,
      cls: shifts.filter((s) => !s.hadRecentInput).reduce((sum, s) => sum + s.value, 0),
    };
  });
}

test('home load, scroll, one page turn and one control', async ({ browser, target }) => {
  test.setTimeout(10 * 60_000);
  const rows: Row[] = [];

  // A fresh browser's first page does not draw until its graphics have started, about 2 s
  // on this laptop, which no visitor's running browser waits for: load one page unmeasured.
  const warm = await browser.newContext();
  if (target === 'site') await serveSite(warm);
  const warmPage = await warm.newPage();
  await warmPage.goto(urlFor(target, EDITIONS[0], 'home'));
  await warmPage.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await warm.close();

  for (const view of EDITIONS) {
    for (const rate of RATES) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        isMobile: view.mobile,
        hasTouch: view.mobile,
        colorScheme: 'light',
      });
      if (target === 'site') await serveSite(context);
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });

      // The load, already slowed down.
      await page.goto(urlFor(target, view, 'home'));
      const load = await loadMetrics(page);
      await settle(page);
      const padded = await page.evaluate(() => {
        if (document.documentElement.scrollHeight - innerHeight >= innerHeight) return false;
        (document.querySelector('[data-page]') as HTMLElement).style.height = `${innerHeight * 10}px`;
        return true;
      });
      await page.evaluate(() => {
        const w = window as unknown as { longTasks: number[] };
        w.longTasks = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) w.longTasks.push(entry.duration);
        }).observe({ type: 'longtask' });
      });

      // The scroll: one step per frame, so every frame has scroll work to do.
      const busy0 = await busyMs(cdp);
      const scroll = await page.evaluate(async (ms) => {
        const max = document.documentElement.scrollHeight - innerHeight;
        const gaps: number[] = [];
        const t0 = performance.now();
        let last = t0;
        await new Promise<void>((done) => {
          const step = (now: number) => {
            gaps.push(now - last);
            last = now;
            const t = Math.min(1, (now - t0) / ms);
            scrollTo({ top: max * t, behavior: 'instant' });
            if (t < 1) requestAnimationFrame(step);
            else done();
          };
          requestAnimationFrame(step);
        });
        return { seconds: (performance.now() - t0) / 1000, gaps: gaps.slice(1) };
      }, SCROLL_MS);
      const busy1 = await busyMs(cdp);
      const scrollLong = await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks.splice(0));
      const sorted = [...scroll.gaps].sort((a, b) => a - b);

      // One page turn, where there is a router: back to the top, then the Episodes entry,
      // timed until the turn's timers end. The design turns at once; the site once the page's
      // file has come (announced by st:turned as the turn starts).
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(500);
      let turnMs: number | null = null;
      let turnLongTasks: number | null = null;
      if (await page.evaluate(() => 'stGo' in window)) {
        await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks.splice(0));
        const turn0 = await busyMs(cdp);
        await page.evaluate(async () => {
          const link = [...document.querySelectorAll<HTMLElement>(
            '.tabs [data-route="episodes"], .pnav [data-route="episodes"], .dock [data-route="episodes"]',
          )].find((el) => el.offsetParent !== null);
          if (!link) throw new Error('No visible Episodes link to turn the page with');
          const started = new Promise((done) => addEventListener('st:turned', done, { once: true }));
          link.click();
          if (!document.querySelector('.page.arriving')) await started;
          await new Promise((done) => setTimeout(done, 1000));
        });
        turnMs = (await busyMs(cdp)) - turn0;
        turnLongTasks = (await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks.splice(0))).length;
        const at = await page.evaluate(() => ({ address: location.pathname, hash: location.hash, pages: document.querySelectorAll('[data-page]').length }));
        if (target === 'site') expect(at).toEqual({ address: '/episodes/', hash: '', pages: 1 });
        else expect(at.hash).toBe('#episodes');
      }

      // One control pressed for real, timed from the press to the next paint (the page's
      // interaction to next paint): the paper switch, or else the first entry of the dock.
      const control = page.locator('#themeBtn, [data-theme-toggle], .dock button').filter({ visible: true }).first();
      const controlName = await control.evaluate((el) => (el.id ? `#${el.id}` : `${el.parentElement!.className} ${el.textContent}`));
      await control.scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        const w = window as unknown as { interactions: number[] };
        w.interactions = [];
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & { interactionId: number })[]) if (e.interactionId) w.interactions.push(e.duration);
        }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit);
      });
      await control.click();
      await page.waitForTimeout(1000);
      const interactions = await page.evaluate(() => (window as unknown as { interactions: number[] }).interactions);

      rows.push({
        edition: view.name,
        rate,
        lcp: load.lcp,
        cls: load.cls,
        busyPerSecond: (busy1 - busy0) / scroll.seconds,
        longTasks: scrollLong.length,
        longestTask: Math.max(0, ...scrollLong),
        p95Frame: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        turnMs,
        turnLongTasks,
        control: controlName,
        // Below 16 ms the browser does not report an interaction; 16 is the most it can be.
        inp: Math.max(16, ...interactions),
        padded,
      });
      await context.close();
    }
  }

  const f = (n: number | null) => (n === null ? 'no router yet' : n.toFixed(n < 100 ? 1 : 0));
  const table = [
    '| Edition | CPU | Largest paint (ms) | Layout shift | Main thread busy per second of scroll (ms) | Long tasks while scrolling | Longest (ms) | Slowest 5% of frames (ms) | Page turn main-thread work (ms) | Long tasks in the turn | Control pressed | Press to next paint (ms) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.edition}${r.padded ? ' (empty page, 10 screens tall)' : ''} | ${r.rate}× | ${f(r.lcp)} | ${r.cls.toFixed(3)} | ${f(r.busyPerSecond)} | ${r.longTasks} | ${f(r.longestTask)} | ${f(r.p95Frame)} | ${f(r.turnMs)} | ${r.turnLongTasks ?? '–'} | ${r.control} | ${r.inp <= 16 ? 'under 16' : f(r.inp)} |`),
  ].join('\n');
  const dir = path.join('tests', 'speed', 'results');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(dir, `${target}-${stamp}.json`), JSON.stringify(rows, null, 2));
  fs.writeFileSync(path.join(dir, `${target}-${stamp}.md`), `# Speed, ${target}, ${stamp}\n\n${table}\n`);
  console.log(`\n${table}\n`);
  await test.info().attach('speed.md', { body: table, contentType: 'text/markdown' });

  if (target === 'site') {
    for (const r of rows.filter((row) => row.rate === 4)) {
      expect.soft(r.lcp, `${r.edition}: largest contentful paint at 4×`).toBeLessThanOrEqual(2500);
      expect.soft(r.cls, `${r.edition}: layout shift at 4×`).toBeLessThanOrEqual(0.1);
      expect.soft(r.longTasks, `${r.edition}: long tasks while scrolling at 4×`).toBe(0);
      if (r.turnMs !== null) expect.soft(r.turnMs, `${r.edition}: page turn main-thread work at 4×`).toBeLessThan(200);
      expect.soft(r.inp, `${r.edition}: press to next paint at 4×`).toBeLessThanOrEqual(200);
    }
  }
});
