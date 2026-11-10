import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect, VIEWS, SHELL_PAGES, ADDRESSES, SITE_ORIGIN, SITE_DIR, urlFor, designPage, standIn, type View, type PageName } from '../targets';

// The page router (step 4), driven by automated clicks. Every page has its own address: a
// click on an entry fetches the next page's file, places its page next to the current one,
// plays the design's leaving and arriving turns on the design's timing, then updates the
// address bar. Back and Forward replay the turn; any failure loads the address normally; a
// visitor arriving at any address sees that page directly. After each turn the page that left
// is gone, with any video player in it, the turn is announced once (for the comments and the
// visit count to come), and the placed page's scroll effects and other parts work.

const ROUTES = ['home', 'episodes', 'writing', 'projects', 'about', 'subscribe'] as const;
type Route = (typeof ROUTES)[number];
const editionOf = (view: View) => (view.width >= 900 ? 'desktop' : 'pocket');
// The entries a visitor can press at this width.
const navsOf = (view: View) => (editionOf(view) === 'desktop' ? ['.tabs', '.pnav'] : ['.dock']);
const entry = (view: View, route: string, nav = navsOf(view)[0]) => `${nav} [data-route="${route}"]`;
const titleIn = (file: string) => /<title>([^<]*)<\/title>/.exec(fs.readFileSync(path.join(SITE_DIR, file), 'utf8'))![1].replace('&middot;', '·');
const titleOf = (address: string) => titleIn(path.join(address, 'index.html'));

// `task` numbers the scripts that ran: changes made by one script share it.
type Event = { t: number; task: number; what: string; page?: string; detail?: unknown };

// Everything that happens to the pages, at the moment it happens: each change of a page's class
// or hidden state in the document, each page placed (with whether it was hidden then) and
// removed, and each announced turn. Class and hidden changes are caught as they are made rather
// than by a MutationObserver, which reports only once the script making them has finished (the
// design's show() goes on to measure the page after starting the leaving turn, which would make
// its 620 ms look shorter).
async function record(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const journal: Event[] = [];
    (window as unknown as { journal: Event[] }).journal = journal;
    let task = 0, running = false;
    const taskNow = () => {
      if (!running) { running = true; task++; queueMicrotask(() => { running = false; }); }
      return task;
    };
    const note = (what: string, page?: string, detail?: unknown) => journal.push({ t: performance.now(), task: taskNow(), what, page, detail });
    const isPage = (n: unknown): n is HTMLElement => n instanceof HTMLElement && n.dataset.page !== undefined;

    const owner = new WeakMap<DOMTokenList, Element>();
    const classList = Object.getOwnPropertyDescriptor(Element.prototype, 'classList')!;
    Object.defineProperty(Element.prototype, 'classList', { ...classList, get(this: Element) { const list = classList.get!.call(this); owner.set(list, this); return list; } });
    for (const m of ['add', 'remove', 'toggle'] as const) {
      const f = DOMTokenList.prototype[m] as (...a: unknown[]) => unknown;
      (DOMTokenList.prototype as unknown as Record<string, unknown>)[m] = function (this: DOMTokenList, ...a: unknown[]) {
        const el = owner.get(this), before = el?.className;
        const r = f.apply(this, a);
        if (isPage(el) && el.isConnected && el.className !== before) note(`class ${el.className}`, el.dataset.page);
        return r;
      };
    }
    const hidden = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden')!;
    Object.defineProperty(HTMLElement.prototype, 'hidden', { ...hidden, set(this: HTMLElement, v: unknown) {
      const before = hidden.get!.call(this);
      hidden.set!.call(this, v);
      if (isPage(this) && this.isConnected && hidden.get!.call(this) !== before) note(`hidden ${hidden.get!.call(this)}`, this.dataset.page);
    } });

    addEventListener('st:placed', (e) => { const p = (e as CustomEvent).detail as HTMLElement; note('placed', p.dataset.page, { hidden: p.hidden }); });
    new MutationObserver((records) => {
      for (const r of records) r.removedNodes.forEach((n) => { if (isPage(n)) note('removed', n.dataset.page); });
    }).observe(document, { subtree: true, childList: true });
    addEventListener('st:turned', (e) => note('turned', undefined, (e as CustomEvent).detail));
  });
}
const journal = (page: Page) => page.evaluate(() => (window as unknown as { journal: Event[] }).journal.splice(0));

// The class changes in order.
const classSteps = (events: Event[]) => events.filter((e) => e.what.startsWith('class ')).map((e) => `${e.page} ${e.what}`);

// The pages in the document, the page shown, the lit entries, the address and the history.
const state = (page: Page) => page.evaluate(() => ({
  address: location.pathname,
  hash: location.hash,
  title: document.title,
  pages: [...document.querySelectorAll<HTMLElement>('[data-page]')].map((p) => p.dataset.page),
  shown: [...document.querySelectorAll<HTMLElement>('[data-page]')].filter((p) => !p.hidden).map((p) => p.dataset.page),
  lit: [...new Set([...document.querySelectorAll('.tabs [aria-current="true"], .pnav [aria-current="true"], .dock [aria-current="true"]')].map((e) => e.getAttribute('data-route')))],
  history: history.length,
}));

// Wait until the turn to `address` is over: the address is there, its page is the only one and
// has settled. (Back and Forward change the address before the turn starts, so the address
// alone says nothing.)
const nameAt = (address: string) => Object.entries(ADDRESSES).find(([, a]) => a === address)?.[0] ?? 'missing';
async function turned(page: Page, address: string): Promise<void> {
  await page.waitForFunction(([to, name]) => {
    const pages = document.querySelectorAll<HTMLElement>('[data-page]');
    return location.pathname === to && pages.length === 1 && pages[0].dataset.page === name && !document.querySelector('.page.arriving, .page.leaving');
  }, [address, nameAt(address)]);
}

// A mark on the window, gone only if the page loads again.
const mark = (page: Page) => page.evaluate(() => { (window as unknown as { mark: number }).mark = 1; });
const marked = (page: Page) => page.evaluate(() => (window as unknown as { mark?: number }).mark === 1);

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return errors;
}

// The design's timing, from its show(): the page leaving hides at 620 ms, the arriving page
// settles at 780 ms. Timers in a test browser run a little late, never early.
type Timeline = { together: boolean; leftHidden: number; settled: number; leftRemoved?: number };
function timeline(events: Event[], from: string, to: string): Timeline {
  const find = (page: string, what: string) => {
    const e = events.find((x) => x.page === page && x.what === what);
    if (!e) throw new Error(`no "${what}" on ${page} in ${JSON.stringify(events)}`);
    return e;
  };
  const at = (page: string, what: string) => find(page, what).t;
  const leaving = find(from, 'class page leaving');
  const t0 = leaving.t;
  const removed = events.find((x) => x.page === from && x.what === 'removed');
  return {
    together: find(to, 'class page arriving').task === leaving.task,
    leftHidden: at(from, 'hidden true') - t0,
    settled: events.filter((x) => x.page === to && x.what === 'class page').pop()!.t - t0,
    ...(removed ? { leftRemoved: removed.t - t0 } : {}),
  };
}

// The next fetch of `address` fails: no connection, an error status, or a plain answer with no
// page in it (as a Cloudflare branch preview gives for an address it does not have). A normal
// page load of the address still works.
async function failFetch(context: BrowserContext, address: string, answer: 'abort' | number | string): Promise<void> {
  await context.route(`${SITE_ORIGIN}${address}`, (route) => {
    if (route.request().resourceType() !== 'fetch') return route.fallback();
    if (answer === 'abort') return route.abort();
    if (typeof answer === 'number') return route.fulfill({ status: answer, contentType: 'text/plain', body: 'Server error' });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: answer });
  });
}

for (const view of VIEWS) {
  test.describe(view.name, () => {
    test.use({ viewport: { width: view.width, height: view.height }, isMobile: view.mobile, hasTouch: view.mobile });

    test('every entry turns to its own address, title and lit entry, adding one history step', async ({ page, target }) => {
      const errors = watchErrors(page);
      await record(page);
      await page.goto(urlFor(target, view, 'home'));
      for (const nav of navsOf(view)) {
        // From each page to the next, in the order of the entries, ending back home.
        for (const route of [...ROUTES.slice(1), 'home'] as Route[]) {
          const before = await state(page);
          await page.click(entry(view, route, nav));
          await turned(page, ADDRESSES[route]!);
          expect(await state(page), `${nav} ${route}`).toEqual({
            address: ADDRESSES[route], hash: '', title: titleOf(ADDRESSES[route]!), pages: [route], shown: [route], lit: [route], history: before.history + 1,
          });
          const events = await journal(page);
          expect(events.filter((e) => e.what === 'turned').map((e) => e.detail), `${nav} ${route}: announced once`).toEqual([{ page: route, address: ADDRESSES[route] }]);
        }
      }
      expect(errors).toEqual([]);
    });

    test('pressing the lit entry stays put: no fetch, no turn, no history', async ({ page, target }) => {
      await record(page);
      await page.goto(urlFor(target, view, 'writing'));
      const requests: string[] = [];
      page.on('request', (r) => { if (r.resourceType() === 'fetch') requests.push(r.url()); });
      const before = await state(page);
      await journal(page);
      await page.click(entry(view, 'writing'));
      await page.waitForTimeout(900);
      expect(await state(page)).toEqual(before);
      expect(await journal(page)).toEqual([]);
      expect(requests).toEqual([]);
    });

    test('a turn plays the design\'s leaving and arriving classes on the design\'s timing', async ({ page, target }) => {
      await record(page);
      const turn = async (url: string) => {
        await page.goto(url);
        await page.waitForTimeout(300);
        await journal(page);
        await page.click(entry(view, 'writing'));
        await page.waitForTimeout(1200);
        return journal(page);
      };
      const designEvents = await turn(urlFor('reference', view, 'episodes'));
      const design = timeline(designEvents, 'episodes', 'writing');
      const events = await turn(urlFor(target, view, 'episodes'));
      const site = timeline(events, 'episodes', 'writing');
      // The page is placed hidden, then shown as both turns start in the same moment, with the
      // same classes in the same order as the design's.
      expect(events.filter((e) => e.what !== 'turned').slice(0, 2).map((e) => `${e.page} ${e.what}`)).toEqual(['writing placed', 'writing hidden false']);
      expect(events.find((e) => e.what === 'placed')!.detail).toEqual({ hidden: true });
      expect(classSteps(events)).toEqual(['episodes class page leaving', 'writing class page arriving', 'episodes class page', 'writing class page']);
      expect(classSteps(events)).toEqual(classSteps(designEvents));
      for (const t of [design, site]) {
        expect(t.together).toBe(true);
        expect(t.leftHidden).toBeGreaterThanOrEqual(619);
        expect(t.settled).toBeGreaterThanOrEqual(779);
      }
      // Within a few frames of the design's own run.
      expect(Math.abs(site.leftHidden - design.leftHidden)).toBeLessThanOrEqual(50);
      expect(Math.abs(site.settled - design.settled)).toBeLessThanOrEqual(50);
      // The page that left goes as it hides.
      expect(site.leftRemoved! - site.leftHidden).toBeGreaterThanOrEqual(0);
      expect(site.leftRemoved! - site.leftHidden).toBeLessThanOrEqual(50);
      test.info().annotations.push({ type: 'timing', description: `design ${JSON.stringify(design)}; site ${JSON.stringify(site)} (ms from the leaving class)` });
    });

    test('Back and Forward replay the turn without adding history', async ({ page, target }) => {
      const errors = watchErrors(page);
      await record(page);
      await page.goto(urlFor(target, view, 'episodes'));
      await mark(page);
      await page.click(entry(view, 'writing'));
      await turned(page, '/writing/');
      await page.click(entry(view, 'about'));
      await turned(page, '/about/');
      const steps = (await state(page)).history;
      await journal(page);
      for (const [move, from, to] of [['back', 'about', 'writing'], ['back', 'writing', 'episodes'], ['forward', 'episodes', 'writing']] as const) {
        await (move === 'back' ? page.goBack() : page.goForward());
        await turned(page, ADDRESSES[to]!);
        expect(await state(page), `${move} to ${to}`).toEqual({ address: ADDRESSES[to], hash: '', title: titleOf(ADDRESSES[to]!), pages: [to], shown: [to], lit: [to], history: steps });
        const events = await journal(page);
        expect(classSteps(events), `${move} to ${to}`).toEqual([`${from} class page leaving`, `${to} class page arriving`, `${from} class page`, `${to} class page`]);
        expect(events.filter((e) => e.what === 'turned').map((e) => e.detail)).toEqual([{ page: to, address: ADDRESSES[to] }]);
      }
      expect(await marked(page), 'no page load').toBe(true);
      expect(errors).toEqual([]);
    });

    test('a visitor arriving at any address sees that page directly, with no turn and no other page', async ({ page, target }) => {
      await record(page);
      for (const name of SHELL_PAGES) {
        await page.goto(urlFor(target, view, name));
        await page.waitForTimeout(900);
        const events = await journal(page);
        expect(events.filter((e) => /leaving|arriving|removed|turned/.test(e.what)), name).toEqual([]);
        expect([...new Set(events.map((e) => e.page))], name).toEqual([name]);
        const s = await state(page);
        expect(s.pages, name).toEqual([name]);
        expect(s.shown, name).toEqual([name]);
        expect(await page.evaluate(() => scrollY), name).toBe(0);
      }
    });

    test('a turn to an address the site does not have shows the missing page there', async ({ page, target }) => {
      await page.goto(urlFor(target, view, 'about'));
      await mark(page);
      await page.evaluate(() => {
        const a = Object.assign(document.createElement('a'), { href: '/nowhere/' });
        a.dataset.route = 'nowhere';
        document.body.append(a);
        a.click();
      });
      await turned(page, '/nowhere/');
      expect(await state(page)).toMatchObject({ address: '/nowhere/', title: titleIn('404.html'), pages: ['missing'], shown: ['missing'], lit: [] });
      expect(await marked(page), 'no page load').toBe(true);
    });

    test('of two quick turns, the second wins', async ({ context, page, target }) => {
      await record(page);
      // The first page's file is slow to come.
      await context.route(`${SITE_ORIGIN}/writing/`, async (route) => {
        if (route.request().resourceType() === 'fetch') await new Promise((done) => setTimeout(done, 500));
        await route.fallback();
      });
      await page.goto(urlFor(target, view, 'episodes'));
      const steps = (await state(page)).history;
      await journal(page);
      await page.click(entry(view, 'writing'));
      await page.click(entry(view, 'about'));
      await turned(page, '/about/');
      await page.waitForTimeout(800);
      expect(await state(page)).toMatchObject({ address: '/about/', pages: ['about'], shown: ['about'], lit: ['about'], history: steps + 1 });
      expect((await journal(page)).filter((e) => e.page === 'writing')).toEqual([]);
    });

    for (const [failure, answer] of [
      ['no connection', 'abort'],
      ['an error status', 500],
      ['a file with no page in it', 'Not found'],
    ] as const) {
      test(`${failure} loads the address normally instead`, async ({ context, page, target }) => {
        await failFetch(context, '/writing/', answer);
        await page.goto(urlFor(target, view, 'episodes'));
        await mark(page);
        const loaded = page.waitForEvent('load');
        await page.click(entry(view, 'writing'));
        await loaded;
        expect(await marked(page), 'the page loaded again').toBe(false);
        expect(await state(page)).toMatchObject({ address: '/writing/', pages: ['writing'], shown: ['writing'], lit: ['writing'] });
      });
    }

    test('Back that cannot fetch its page loads it normally', async ({ context, page, target }) => {
      await page.goto(urlFor(target, view, 'episodes'));
      await page.click(entry(view, 'writing'));
      await turned(page, '/writing/');
      await failFetch(context, '/episodes/', 'abort');
      await mark(page);
      const loaded = page.waitForEvent('load');
      await page.goBack();
      await loaded;
      expect(await marked(page), 'the page loaded again').toBe(false);
      expect(await state(page)).toMatchObject({ address: '/episodes/', pages: ['episodes'], shown: ['episodes'] });
      // The step ahead belonged to the page before it loaded again, so Forward loads it.
      await page.goForward();
      await turned(page, '/writing/');
      expect(await state(page)).toMatchObject({ address: '/writing/', pages: ['writing'], shown: ['writing'] });
    });

    test('after a turn, the page that left is gone with its video player, and the turn is announced once', async ({ page, target }) => {
      await record(page);
      await page.goto(urlFor(target, view, 'episodes'));
      await page.evaluate(() => {
        const player = Object.assign(document.createElement('iframe'), { title: 'Video player', src: 'about:blank' });
        document.querySelector('[data-page="episodes"]')!.append(player);
      });
      await journal(page);
      await page.click(entry(view, 'writing'));
      await page.waitForFunction(() => document.querySelector('.page.leaving'));
      expect(await page.locator('iframe').count(), 'still turning out').toBe(1);
      await turned(page, '/writing/');
      expect(await page.locator('iframe').count()).toBe(0);
      expect(await page.locator('[data-page="episodes"]').count()).toBe(0);
      await page.waitForTimeout(500);
      expect((await journal(page)).filter((e) => e.what === 'turned').map((e) => e.detail)).toEqual([{ page: 'writing', address: '/writing/' }]);
    });

    if (editionOf(view) === 'desktop') {
      test('the number keys turn pages through the router', async ({ page, target }) => {
        await page.goto(urlFor(target, view, 'home'));
        for (const [key, route] of [['3', 'writing'], ['6', 'subscribe'], ['1', 'home']] as const) {
          await page.keyboard.press(key);
          await turned(page, ADDRESSES[route]!);
          expect(await state(page), `key ${key}`).toMatchObject({ address: ADDRESSES[route], pages: [route], lit: [route] });
        }
      });
    }

    test('a placed page gets its scroll effects and parts, and nothing is bound twice', async ({ context, page, target }) => {
      const edition = editionOf(view);
      const errors = watchErrors(page);
      // The design's home and about pages stand in for the writing page's content.
      await standIn(context, '/writing/', designPage(edition, 'home') + designPage(edition, 'about'));
      await page.goto(urlFor(target, view, 'episodes'));
      await page.click(entry(view, 'writing'));
      await turned(page, '/writing/');
      const placed = page.locator('[data-page="writing"]');

      // The scroll effects found the leaves: every leaf has its lift, those near the screen their tilt.
      const leaves = await placed.locator('[data-leaf]').evaluateAll((ls) => ls.map((l) => {
        const s = (l as HTMLElement).style;
        return { p: s.getPropertyValue('--p'), c: s.getPropertyValue('--c'), lx: s.getPropertyValue('--lx') };
      }));
      expect(leaves.length).toBe(8);
      for (const l of leaves) expect(l.p).not.toBe('');
      expect(leaves.filter((l) => l.c !== '').length).toBeGreaterThan(0);
      if (edition === 'desktop') for (const l of leaves) expect(l.lx).not.toBe('');
      // And they follow the scroll: the last leaf, far below, lifts as it comes up the screen.
      const last = placed.locator('[data-leaf]').last();
      const lift = () => last.evaluate((l) => (l as HTMLElement).style.getPropertyValue('--p'));
      expect(await lift()).toBe('0');
      await last.evaluate((l) => scrollTo(0, l.getBoundingClientRect().top + scrollY - innerHeight * 0.8));
      await expect.poll(lift).not.toBe('0');
      expect(Number(await lift())).toBeLessThan(1);
      await page.evaluate(() => scrollTo(0, 0));

      // Track cards turn over once per press.
      const card = placed.locator('.flipcard').first();
      await card.locator('.front [data-flip]').evaluate((b) => (b as HTMLElement).click());
      expect(await card.evaluate((c) => c.classList.contains('flipped'))).toBe(true);
      await card.locator('.back [data-flip]').evaluate((b) => (b as HTMLElement).click());
      expect(await card.evaluate((c) => c.classList.contains('flipped'))).toBe(false);

      // Folders open once per press.
      const folder = placed.locator('.folder').first();
      await folder.evaluate((f) => (f as HTMLElement).click());
      expect(await folder.getAttribute('aria-expanded')).toBe('true');
      expect(await page.locator(`#${await folder.getAttribute('aria-controls')}`).evaluate((d) => (d as HTMLElement).hidden)).toBe(false);

      if (edition === 'desktop') {
        // Cards tilt under the pointer.
        const tilt = placed.locator('[data-tilt]').first();
        await tilt.scrollIntoViewIfNeeded();
        const box = (await tilt.boundingBox())!;
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3);
        await expect.poll(() => tilt.evaluate((t) => (t as HTMLElement).style.transform)).toContain('rotateY(');
        // Loose things move with the arrow keys, 16 px a press.
        const loose = placed.locator('[data-drag]').first();
        await loose.evaluate((l) => l.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
        expect(await loose.evaluate((l) => (l as HTMLElement).style.getPropertyValue('--dx'))).toBe('16px');
        // The swatches are numbered.
        expect(await placed.locator('.swatches .sw').evaluateAll((s) => s.map((e) => (e as HTMLElement).style.getPropertyValue('--i'))))
          .toEqual(Array.from({ length: 10 }, (_, i) => String(i + 1)));
        // The stamp inks as it comes into view.
        await placed.locator('.stamp').evaluate((s) => s.scrollIntoView({ block: 'center' }));
        await expect.poll(() => placed.locator('.stamp').evaluate((s) => s.classList.contains('inked'))).toBe(true);
        // The paper switch, part of the journal, still turns the paper once per press.
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('#themeBtn').click();
        expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
      } else {
        // The paper switches on the placed page turn the paper once per press, and all of them say so.
        const toggles = placed.locator('[data-theme-toggle]');
        expect(await toggles.count()).toBe(2);
        await toggles.first().evaluate((b) => (b as HTMLElement).click());
        expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
        expect(await toggles.evaluateAll((ts) => ts.map((t) => t.textContent))).toEqual(['Light paper', 'Light paper']);
        await toggles.last().evaluate((b) => (b as HTMLElement).click());
        expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
      }
      expect(errors).toEqual([]);
    });
  });
}

// The addresses the router turns to are the ones the site builds and these tests visit.
test('the router\'s entries and the site\'s addresses agree', () => {
  const routerJs = fs.readFileSync(path.resolve('src/scripts/router.js'), 'utf8');
  expect(routerJs).toContain('function addressOf(route){return route==="home"?"/":"/"+route+"/";}');
  for (const route of ROUTES) expect(ADDRESSES[route as PageName]).toBe(route === 'home' ? '/' : `/${route}/`);
});
