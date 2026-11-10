import { test as base, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { designHtml, materialPage, PUBLIC_DIR, TOKENS_CSS, type Edition } from './visual/materials';

// The nine pages of the design files, by their data-page names.
export const PAGES = [
  'home', 'episodes', 'episode', 'writing', 'article',
  'projects', 'about', 'subscribe', 'missing',
] as const;
export type PageName = (typeof PAGES)[number];

// The pocket edition at a phone width; the desktop edition at both ends of its range.
export const VIEWS = [
  { name: 'pocket-390', file: 'pocket.html', width: 390, height: 844, mobile: true },
  { name: 'desktop-900', file: 'desktop.html', width: 900, height: 900, mobile: false },
  { name: 'desktop-1440', file: 'desktop.html', width: 1440, height: 900, mobile: false },
] as const;
export type View = (typeof VIEWS)[number];

export const PAPERS = ['light', 'dark'] as const;
export type Paper = (typeof PAPERS)[number];

// What is under test: the design files themselves; the design files drawn with the
// project's own materials (tokens.css, public/fonts, public/images) in place of their own;
// or the built site.
export type Target = 'reference' | 'materials' | 'site';

export const MATERIALS_ORIGIN = 'http://materials.test';
export const SITE_ORIGIN = 'http://site.test';
export const SITE_DIR = path.resolve('dist');

// The site's address for each design page. Episode and article pages get theirs from the
// content files; any address the site does not have shows the missing page.
export const ADDRESSES: Partial<Record<PageName, string>> = {
  home: '/', episodes: '/episodes/', writing: '/writing/', projects: '/projects/',
  about: '/about/', subscribe: '/subscribe/', missing: '/torn-out/',
};

// The pages with an address of their own while they are empty (step 3).
export const SHELL_PAGES: PageName[] = ['home', 'episodes', 'writing', 'projects', 'about', 'subscribe', 'missing'];

export function urlFor(target: Target, view: View, pageName: PageName): string {
  if (target === 'reference') {
    const file = path.resolve('design-reference', view.file);
    return `${pathToFileURL(file).href}#${pageName}`;
  }
  if (target === 'materials') return `${MATERIALS_ORIGIN}/${view.file}#${pageName}`;
  const address = ADDRESSES[pageName];
  if (!address) throw new Error(`The site has no ${pageName} page until its content arrives.`);
  return `${SITE_ORIGIN}${address}`;
}

// Serves the materials target: each design file with its Google Fonts link, token blocks and
// Echo images swapped for the project's (see materialPage), and the project's files at the
// addresses the site will use. Google Fonts is cut off, so nothing can come from there.
export async function serveMaterials(context: BrowserContext): Promise<void> {
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  await context.route(`${MATERIALS_ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    const page = /^\/(desktop|pocket)\.html$/.exec(pathname);
    if (page) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: materialPage(designHtml(page[1] as Edition)) });
    if (pathname === '/styles/tokens.css') return route.fulfill({ path: TOKENS_CSS, contentType: 'text/css; charset=utf-8' });
    const file = path.join(PUBLIC_DIR, decodeURIComponent(pathname));
    if (file.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
    return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
  });
}

// Serves the built site (dist/, from `astro build`) the way Cloudflare does: an address ending
// in / is its folder's index.html, and an address with no file gets 404.html with a 404 status.
export async function serveSite(context: BrowserContext): Promise<void> {
  if (!fs.existsSync(path.join(SITE_DIR, 'index.html'))) throw new Error('No built site in dist/: run `npm run build` first.');
  await context.route(`${SITE_ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    const file = path.join(SITE_DIR, decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : '');
    if (file.startsWith(SITE_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
    return route.fulfill({ status: 404, path: path.join(SITE_DIR, '404.html') });
  });
}

// A design page's contents as written: the inside of its <div class="page" data-page="…">.
export function designPage(edition: Edition, name: PageName): string {
  const html = designHtml(edition);
  const open = new RegExp(`<div class="page" data-page="${name}"[^>]*>`).exec(html);
  if (!open) throw new Error(`${edition}: no ${name} page`);
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = open.index + open[0].length;
  for (let depth = 1, m; (m = tags.exec(html));) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(open.index + open[0].length, m.index);
  }
  throw new Error(`${edition}: the ${name} page never closes`);
}

// Until each page's content arrives, a test can stand the design's own contents in for a
// site page: the built file at `address`, its empty page filled with `contents`. Registered
// after serveSite, so it answers first.
export async function standIn(context: BrowserContext, address: string, contents: string): Promise<void> {
  const file = path.join(SITE_DIR, address, address.endsWith('/') ? 'index.html' : '');
  const built = fs.readFileSync(file, 'utf8');
  const empty = /(<div class="page" data-page="[a-z]+">)(<\/div>)/;
  if (!empty.test(built)) throw new Error(`${address}: no empty page to fill`);
  const body = built.replace(empty, (_, open, close) => `${open}${contents}${close}`);
  await context.route(`${SITE_ORIGIN}${address}`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body }));
}

// Open a page for screenshots. Chrome keeps the fractional pixel offset a 3D
// layer had when it was first drawn, and during loading that depends on when the
// fonts arrived: the desktop deck's text then lands a fraction of a pixel apart
// from one load to the next. The page stays invisible until it has settled, so
// every layer is first drawn with its final fonts in its final place.
export async function open(page: Page, url: string): Promise<void> {
  await page.addInitScript(() => {
    document.documentElement.style.visibility = 'hidden';
  });
  await page.goto(url);
  await settle(page);
}

export const test = base.extend<{ target: Target }>({
  target: ['reference', { option: true }],
  // A fresh browser for every test, so one page's browser crash or leftover
  // state cannot affect another page's screenshots.
  context: async ({ playwright, browserName, viewport, isMobile, hasTouch, colorScheme, target }, use) => {
    const browser = await playwright[browserName].launch();
    const context = await browser.newContext({ viewport, isMobile, hasTouch, colorScheme });
    if (target === 'materials') await serveMaterials(context);
    if (target === 'site') await serveSite(context);
    await use(context);
    await browser.close();
  },
});
export { expect } from '@playwright/test';

// The custom properties the designs' scroll handlers write (read from their scripts).
const SCROLL_VARS = ['--sp', '--wire', '--p', '--c', '--pd', '--s', '--lx', '--lz'];

// Wait until fonts, images and scroll effects have settled, and every animation
// those effects start (such as the stamp inking as it comes into view) has ended.
// The designs' scroll effects measure each sheet's position including the tilt
// they gave it last time, so where they come to rest depends on where they
// started (the desktop tilt can rest at 4.02deg or 4.03deg). Every capture
// therefore starts them from nothing and runs the page's own scroll handler
// until its styles stop changing. The page is invisible meanwhile, so Chrome
// paints each sheet once at its final tilt: a sheet repainted at several tilts
// in a row is drawn with different text smoothing.
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async (scrollVars) => {
    const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const styles = () => [...document.querySelectorAll<HTMLElement>('[style]')].map((el) => el.style.cssText).join('|');
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => undefined)));
    await frames();
    const root = document.documentElement;
    root.style.visibility = 'hidden';
    for (const el of document.querySelectorAll<HTMLElement>('[style]')) {
      for (const name of scrollVars) el.style.removeProperty(name);
    }
    let before = styles();
    for (let pass = 0; pass < 30; pass++) {
      window.dispatchEvent(new Event('scroll'));
      await frames();
      const after = styles();
      if (after === before) break;
      before = after;
    }
    root.style.removeProperty('visibility');
    await frames();
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
    await frames();
  }, SCROLL_VARS);
}

// Scroll positions one screen apart, ending exactly at the bottom of the page.
export async function scrollStops(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const max = Math.max(0, document.documentElement.scrollHeight - vh);
    const stops: number[] = [];
    for (let y = 0; y < max; y += vh) stops.push(y);
    stops.push(max);
    return stops;
  });
}

// Elements that start animating on their own while the page sits still. The design's
// stamp does this near the bottom of the about page: inking it moves it across the
// edge its observer watches, which inks it again. Such an element can never be
// captured the same way twice, so it is masked and reported instead of compared.
export async function restless(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    document.querySelectorAll('[data-restless]').forEach((el) => el.removeAttribute('data-restless'));
    const seen = new Set<Element>();
    const note = (e: Event) => seen.add(e.target as Element);
    document.addEventListener('animationstart', note, true);
    document.addEventListener('transitionstart', note, true);
    await new Promise((done) => setTimeout(done, 700));
    document.removeEventListener('animationstart', note, true);
    document.removeEventListener('transitionstart', note, true);
    return [...seen].map((el) => {
      el.setAttribute('data-restless', '');
      return [el.tagName.toLowerCase(), ...el.classList].join('.');
    });
  });
}

export async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await settle(page);
}

// Chrome on Windows does not always draw the same page the same way: on a few
// screens the edges of some letters come out slightly differently from one load
// to the next, although every style and position is identical. A baseline is
// therefore every distinct rendering its loads of the design file produced; the
// first is the file toHaveScreenshot uses, the others get ~2, ~3 and so on.
export function renderings(baseline: string): string[] {
  const dir = path.dirname(baseline);
  const stem = path.basename(baseline, '.png');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f === `${stem}.png` || (f.startsWith(`${stem}~`) && f.endsWith('.png')))
    .map((f) => path.join(dir, f));
}

export function matchesARendering(baseline: string, shot: Buffer): boolean {
  return renderings(baseline).some((f) => fs.readFileSync(f).equals(shot));
}

export const masks = (page: Page) => [page.locator('[data-restless]')];

// Like toHaveScreenshot: shoot until two shots in a row match.
export async function stableShot(page: Page): Promise<Buffer> {
  const shoot = () => page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css', mask: masks(page) });
  let last = await shoot();
  for (let i = 0; i < 10; i++) {
    const next = await shoot();
    if (next.equals(last)) return next;
    last = next;
  }
  throw new Error('The screen never held still for two shots in a row');
}
