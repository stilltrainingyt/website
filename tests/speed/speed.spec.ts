import fs from 'node:fs';
import path from 'node:path';
import type { CDPSession } from '@playwright/test';
import { test, expect, VIEWS, urlFor, settle } from '../targets';

// Scroll the home page top to bottom in 8 seconds, then turn one page, at three
// CPU slowdowns, and report how hard the main thread worked. The budgets in
// CLAUDE.md are enforced against the built site; for the design files the
// numbers are the starting point every later step is measured against.
const RATES = [1, 4, 6];
const SCROLL_MS = 8000;
const EDITIONS = [VIEWS[0], VIEWS[2]];

type Row = {
  edition: string;
  rate: number;
  busyPerSecond: number;
  longTasks: number;
  longestTask: number;
  p95Frame: number;
  turnMs: number;
  turnLongTasks: number;
};

async function busyMs(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')!.value * 1000;
}

test('home scroll and one page turn', async ({ browser, target }) => {
  test.setTimeout(10 * 60_000);
  const rows: Row[] = [];

  for (const view of EDITIONS) {
    for (const rate of RATES) {
      const context = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        isMobile: view.mobile,
        hasTouch: view.mobile,
        colorScheme: 'light',
      });
      const page = await context.newPage();
      await page.goto(urlFor(target, view, 'home'));
      await settle(page);
      await page.evaluate(() => {
        const w = window as unknown as { longTasks: number[] };
        w.longTasks = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) w.longTasks.push(entry.duration);
        }).observe({ type: 'longtask' });
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });

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

      // One page turn: back to the top, then the Episodes tab, timed until the turn's timers end.
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.waitForTimeout(500);
      await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks.splice(0));
      const turn0 = await busyMs(cdp);
      await page.evaluate(async () => {
        const link = [...document.querySelectorAll<HTMLElement>(
          '.tabs [data-route="episodes"], .pnav [data-route="episodes"], .dock [data-route="episodes"]',
        )].find((el) => el.offsetParent !== null);
        if (!link) throw new Error('No visible Episodes link to turn the page with');
        link.click();
        await new Promise((done) => setTimeout(done, 1000));
      });
      const turn1 = await busyMs(cdp);
      const turnLong = await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks.splice(0));
      expect(await page.evaluate(() => location.hash)).toBe('#episodes');

      rows.push({
        edition: view.name,
        rate,
        busyPerSecond: (busy1 - busy0) / scroll.seconds,
        longTasks: scrollLong.length,
        longestTask: Math.max(0, ...scrollLong),
        p95Frame: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        turnMs: turn1 - turn0,
        turnLongTasks: turnLong.length,
      });
      await context.close();
    }
  }

  const f = (n: number) => n.toFixed(n < 100 ? 1 : 0);
  const table = [
    '| Edition | CPU | Main thread busy per second of scroll (ms) | Long tasks while scrolling | Longest (ms) | Slowest 5% of frames (ms) | Page turn main-thread work (ms) | Long tasks in the turn |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.edition} | ${r.rate}× | ${f(r.busyPerSecond)} | ${r.longTasks} | ${f(r.longestTask)} | ${f(r.p95Frame)} | ${f(r.turnMs)} | ${r.turnLongTasks} |`),
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
      expect.soft(r.longTasks, `${r.edition}: long tasks while scrolling at 4×`).toBe(0);
      expect.soft(r.turnMs, `${r.edition}: page turn main-thread work at 4×`).toBeLessThan(200);
    }
  }
});
