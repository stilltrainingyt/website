import { test as base, type BrowserContext, type Page, type PageScreenshotOptions } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { designHtml, materialPage, PUBLIC_DIR, TOKENS_CSS, type Edition } from './visual/materials';
import { FIXTURE_PAGES, FIXTURE_SITES, fixtureDist, type FixtureSite } from './fixtures/sites';

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
// the built site; or the site built from the design's own samples (tests/fixtures).
export type Target = 'reference' | 'materials' | 'site' | 'fixture';

export const MATERIALS_ORIGIN = 'http://materials.test';
export const SITE_ORIGIN = 'http://site.test';
export const SITE_DIR = path.resolve('dist');
// Each design-sample site at an address of its own.
export const fixtureOrigin = (site: FixtureSite): string => `http://${site}.fixture.test`;
export const editionOf = (view: View): Edition => (view.file === 'pocket.html' ? 'pocket' : 'desktop');

// The site's address for each design page. Episode and article pages get theirs from the
// content files; any address the site does not have shows the missing page.
export const ADDRESSES: Partial<Record<PageName, string>> = {
  home: '/', episodes: '/episodes/', writing: '/writing/', projects: '/projects/',
  about: '/about/', subscribe: '/subscribe/', missing: '/torn-out/',
};

// The pages with an address of their own (step 3), and those still empty until their own step
// brought its content (home in step 5, episodes in step 8, writing in step 9, the rest in step 10).
export const SHELL_PAGES: PageName[] = ['home', 'episodes', 'writing', 'projects', 'about', 'subscribe', 'missing'];
export const EMPTY_PAGES: PageName[] = [];

export function urlFor(target: Target, view: View, pageName: PageName): string {
  if (target === 'reference') {
    const file = path.resolve('design-reference', view.file);
    return `${pathToFileURL(file).href}#${pageName}`;
  }
  if (target === 'materials') return `${MATERIALS_ORIGIN}/${view.file}#${pageName}`;
  const address = ADDRESSES[pageName];
  if (!address) throw new Error(`The site has no ${pageName} page until its content arrives.`);
  if (target === 'fixture') {
    const sites = FIXTURE_PAGES[pageName];
    if (!sites) throw new Error(`No design sample draws the ${pageName} page yet.`);
    return `${fixtureOrigin(sites[editionOf(view)])}${address}`;
  }
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

// Serves a built site the way Cloudflare does: an address ending in / is its folder's
// index.html, and an address with no file gets 404.html with a 404 status.
async function serveBuilt(context: BrowserContext, origin: string, dir: string, missing: string): Promise<void> {
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(missing);
  await context.route(`${origin}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    const file = path.join(dir, decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : '');
    if (file.startsWith(dir + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ path: file });
    return route.fulfill({ status: 404, path: path.join(dir, '404.html') });
  });
}

// The built site, dist/ (from `astro build`).
export async function serveSite(context: BrowserContext): Promise<void> {
  await serveBuilt(context, SITE_ORIGIN, SITE_DIR, 'No built site in dist/: run `npm run build` first.');
}

// The design-sample sites, built by the fixture-sites project (tests/fixtures/build.setup.ts).
export async function serveFixtures(context: BrowserContext): Promise<void> {
  for (const site of Object.keys(FIXTURE_SITES) as FixtureSite[]) {
    await serveBuilt(context, fixtureOrigin(site), fixtureDist(site), `The ${site} design sample is not built: run the fixture-sites project first.`);
  }
}

// Where a design sample cannot be written as content, its sample site is compared with the
// design page drawn with these changes, made as the test serves the file (your decision, step
// 8); design-reference/ itself is never changed. Their baselines sit beside the page's own,
// under "<page>-samples". The design's board links ST-002's title to the page it gives an
// episode still being cut; on the site an upcoming episode has no page, so its title is plain.
export const SAMPLES_ORIGIN = 'http://samples.test';
// The subscribe slip's underside in the design: from its opening tag to the end of its "Tape it
// back" row and its own closing tag.
function designSlip(edition: Edition): string {
  const html = designHtml(edition);
  const start = html.indexOf('<div class="under"');
  const tape = html.indexOf('Tape it back</button></div>', start);
  const end = html.indexOf('</div>', tape + 'Tape it back</button></div>'.length) + '</div>'.length;
  if (start < 0 || tape < 0 || html.indexOf('<div class="under"', start + 1) >= 0) throw new Error(`${edition}: expected one slip`);
  return html.slice(start, end);
}
// The slip's four links as the site draws them (SlipLinks.astro), with the step 7 words.
const SLIP_LINKS = (label: (text: string) => string) => [
  `<a class="btn" href="https://www.youtube.com/@StillTraining_ai" target="_blank" rel="noopener">${label('Subscribe on YouTube')}<span class="arrow">↗</span></a>`,
  `<a class="btn ghost" href="/rss.xml">${label('Follow by RSS')}<span class="arrow">→</span></a>`,
  `<a class="btn ghost" href="https://github.com/stilltrainingyt" target="_blank" rel="noopener">${label('Follow on GitHub')}<span class="arrow">↗</span></a>`,
  `<a class="btn ghost" href="https://www.linkedin.com/in/pratyush-p-1226b532b/" target="_blank" rel="noopener">${label('Connect on LinkedIn')}<span class="arrow">↗</span></a>`,
].join('');
const SLIP: Record<Edition, string> = {
  desktop: '<div class="under" id="under">\n    <p class="eyebrow">Torn · now pick a way in</p>\n    <h3 style="color:var(--ink-inv)">Every new episode, wherever you follow along</h3>\n'
    + '    <p style="color:var(--ink-inv); opacity:.86; font-size:16px">No newsletter and no digest. Follow the channel where you already read.</p>\n'
    + `    <div class="btnrow">\n      ${SLIP_LINKS((t) => `<span class="lbl">${t}</span>`)}\n    </div>\n    <div><button class="mini" id="tapeBtn" type="button">Tape it back</button></div>\n  </div>`,
  pocket: '<div class="under">\n    <p class="eyebrow">Torn · now pick a way in</p>\n    <h3>Every new episode, wherever you follow along</h3>\n'
    + `    <div class="stack" style="gap:12px">\n      ${SLIP_LINKS((t) => `<span>${t}</span>`)}\n    </div>\n    <div><button class="mini" id="tapeBtn" type="button">Tape it back</button></div>\n  </div>`,
};
const ELSEWHERE_ROWS = '<a class="linkrow" href="https://github.com/06pratyush" target="_blank" rel="noopener"><span>GitHub</span><span class="u">github.com/06pratyush &#8599;</span></a>\n'
  + '  <div class="linkrow off"><span>YouTube</span><span class="u">Still Training &middot; channel link goes here</span></div>\n'
  + '  <div class="linkrow off"><span>Website</span><span class="u">stilltraining.in</span></div>';
const LINK_ROWS = '<a class="linkrow" href="https://www.youtube.com/@StillTraining_ai" target="_blank" rel="noopener"><span>YouTube</span><span class="u">youtube.com/@StillTraining_ai &#8599;</span></a>'
  + '<a class="linkrow" href="https://github.com/stilltrainingyt" target="_blank" rel="noopener"><span>GitHub</span><span class="u">github.com/stilltrainingyt &#8599;</span></a>'
  + '<a class="linkrow" href="https://www.linkedin.com/in/pratyush-p-1226b532b/" target="_blank" rel="noopener"><span>LinkedIn</span><span class="u">linkedin.com/in/pratyush-p-1226b532b &#8599;</span></a>';

export const SAMPLE_CHANGES: Partial<Record<PageName, Record<Edition, { from: string; to: string }[]>>> = {
  episodes: {
    desktop: [{ from: '<td class="ttl"><a href="#episode" data-route="episode">Gradient descent, by hand</a></td>', to: '<td class="ttl">Gradient descent, by hand</td>' }],
    pocket: [{ from: '<h3><a href="#episode" data-route="episode">Gradient descent, by hand</a></h3>', to: '<h3>Gradient descent, by hand</h3>' }],
  },
  // Step 9's article page: its reading time worked out from the text (the sample's is 559
  // words, 2 minutes at 230 a minute); the date chip and hand note in place of the template's
  // "Sample article" row; no "Try it on the curve", the design sample's own link; and the
  // approved licence line in place of "Suggest an edit on GitHub" and its line.
  article: Object.fromEntries((['desktop', 'pocket'] as const).map((edition) => [edition, [
    { from: '<p class="eyebrow">AI &middot; Foundations &middot; 6 min read</p>\n  <h2 class="arttitle">', to: '<p class="eyebrow">AI &middot; Foundations &middot; 2 min read</p>\n  <h2 class="arttitle">' },
    { from: '<span class="chip open">Sample article</span><span class="hand">written for this template</span>', to: '<span class="chip open">Published 27 October 2026</span><span class="hand">updated 2 November 2026</span>' },
    { from: '<a class="btn" href="#home" data-route="home" data-then="byhand"><span class="lbl">Try it on the curve</span><span class="arrow">&#8594;</span></a>', to: '' },
    {
      from: '<p class="small" style="flex:1 1 220px; min-width:0">This article lives in a public repository. Found a mistake? Suggest a fix.</p>\n    <a class="mini" href="https://github.com/06pratyush" target="_blank" rel="noopener">Suggest an edit on GitHub</a>',
      to: '<p class="small" style="flex:1 1 220px; min-width:0">© 2026 Pratyush P · CC BY 4.0 · Credit: Pratyush P, Still Training, with a link to this page.</p>\n  <a class="mini" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener">Licence &#8599;</a>',
    },
  ]])) as Record<Edition, { from: string; to: string }[]>,
  // Step 10's subscribe page: under the slip, the four links you approved in step 7 in place of
  // the email form (the slip's height follows what is under it, so the design is drawn with them
  // to compare like with like); and the approved YouTube, GitHub and LinkedIn rows in place of
  // the design's GitHub row and its two placeholders.
  subscribe: {
    desktop: [
      { from: designSlip('desktop'), to: SLIP.desktop },
      { from: ELSEWHERE_ROWS, to: LINK_ROWS },
    ],
    pocket: [
      { from: designSlip('pocket'), to: SLIP.pocket },
      { from: ELSEWHERE_ROWS, to: LINK_ROWS },
    ],
  },
};

export const sampleUrl = (view: View, pageName: PageName): string => `${SAMPLES_ORIGIN}/${pageName}/${view.file}#${pageName}`;

export function sampleDesign(edition: Edition, pageName: PageName): string {
  let html = designHtml(edition);
  for (const change of SAMPLE_CHANGES[pageName]?.[edition] ?? []) {
    if (html.split(change.from).length !== 2) throw new Error(`${edition}: "${change.from}" is not in the design exactly once`);
    html = html.replace(change.from, change.to);
  }
  return html;
}

// Serves each design file as the sample changes for one page leave it, at
// SAMPLES_ORIGIN/<page>/<file>. Everything else it loads comes from where the file's own does.
export async function serveSamples(context: BrowserContext): Promise<void> {
  await context.route(`${SAMPLES_ORIGIN}/**`, (route) => {
    const m = /^\/([a-z]+)\/(desktop|pocket)\.html$/.exec(new URL(route.request().url()).pathname);
    if (!m || !SAMPLE_CHANGES[m[1] as PageName]) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' });
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: sampleDesign(m[2] as Edition, m[1] as PageName) });
  });
}

// No test reaches YouTube. Its thumbnails stand in as transparent images, so a cover draws as the
// design's player box, and its player is cut off unless a test stands one in (registered later,
// so it answers first).
export const THUMBNAIL = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"/>';
export async function standInYouTube(context: BrowserContext): Promise<void> {
  await context.route('https://i.ytimg.com/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: THUMBNAIL }));
  await context.route(/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//, (route) => route.abort());
}

// A design page's contents as written: the inside of its <div class="page" data-page="…">.
export function designPage(edition: Edition, name: PageName): string {
  const html = designHtml(edition);
  const inside = pageInside(html, name);
  if (!inside) throw new Error(`${edition}: no ${name} page, or it never closes`);
  return html.slice(...inside);
}

// Where a <div class="page" data-page="…"> (the named one, or the first) starts and ends inside.
function pageInside(html: string, name = '[a-z]+'): [number, number] | undefined {
  const open = new RegExp(`<div class="page" data-page="${name}"[^>]*>`).exec(html);
  if (!open) return undefined;
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = open.index + open[0].length;
  for (let depth = 1, m; (m = tags.exec(html));) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return [open.index + open[0].length, m.index];
  }
  return undefined;
}

// A test can stand the design's own contents in for a site page, so that it compares like with
// like: the built file at `address`, its page's contents (none, until that page's step) replaced
// with `contents`. Registered after serveSite, so it answers first.
export async function standIn(context: BrowserContext, address: string, contents: string): Promise<void> {
  const file = path.join(SITE_DIR, address, address.endsWith('/') ? 'index.html' : '');
  const built = fs.readFileSync(file, 'utf8');
  const inside = pageInside(built);
  if (!inside) throw new Error(`${address}: no page to fill`);
  const body = `${built.slice(0, inside[0])}${contents}${built.slice(inside[1])}`;
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
    // Firefox has no phone emulation; at 390 px it still draws the pocket edition, with touch.
    const context = await browser.newContext({ viewport, isMobile: browserName === 'firefox' ? undefined : isMobile, hasTouch, colorScheme });
    if (target === 'reference') await serveSamples(context);
    if (target === 'materials') await serveMaterials(context);
    if (target === 'site') await serveSite(context);
    if (target === 'fixture') await serveFixtures(context);
    if (target === 'site' || target === 'fixture') await standInYouTube(context);
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

// Like toHaveScreenshot: shoot until two shots in a row match. A shot can be cut to part of the
// window and drawn with a stylesheet of its own.
export async function stableShot(page: Page, more: Pick<PageScreenshotOptions, 'clip' | 'style'> = {}): Promise<Buffer> {
  const shoot = () => page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css', mask: masks(page), ...more });
  let last = await shoot();
  for (let i = 0; i < 10; i++) {
    const next = await shoot();
    if (next.equals(last)) return next;
    last = next;
  }
  throw new Error('The screen never held still for two shots in a row');
}
