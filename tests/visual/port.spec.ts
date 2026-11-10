import fs from 'node:fs';
import path from 'node:path';
import { test, expect, SITE_DIR } from '../targets';
import { EDITIONS } from './materials';
import {
  DESKTOP_FROM, OMITTED, SCRIPTS, SCRIPT_CHANGES, changedScripts, omit, portedCss, portedScript, withoutHeader, wrapperCss,
} from './port';

// The design's CSS and scripts as the site carries them, checked against design-reference/:
// nothing may differ beyond what tests/visual/port.ts lists. Then the built site (dist/) must
// serve those files byte for byte, each edition's stylesheet only at its own widths.

const src = (file: string) => fs.readFileSync(path.resolve('src', file), 'utf8');

test.describe('as written', () => {
  test('wrapper.css is the design\'s export-wrapper stylesheet', () => {
    expect(withoutHeader(src('styles/wrapper.css'))).toBe(`${wrapperCss()}\n`);
  });

  for (const edition of EDITIONS) {
    test(`${edition}.css is the design's stylesheet less its token and reduced-motion blocks`, () => {
      expect(withoutHeader(src(`styles/${edition}.css`))).toBe(portedCss(edition));
    });
  }

  for (const script of SCRIPTS) {
    test(`${script}.js is the design's ${script === 'router' ? 'page router' : 'scripts'} with only the listed changes and omissions`, () => {
      expect(withoutHeader(src(`scripts/${script}.js`))).toBe(portedScript(script));
      // Every line a change adds is there (the line it was anchored on may wait with its page).
      for (const c of SCRIPT_CHANGES.filter((x) => x.script === script && x.to)) {
        const before = c.from.split('\n');
        for (const line of c.to.split('\n').filter((l) => l && !before.includes(l))) expect(src(`scripts/${script}.js`), c.why).toContain(line);
      }
      const { left } = omit(changedScripts(script), OMITTED.filter((o) => o.script === script));
      for (const needs of new Set(OMITTED.filter((o) => o.script === script).map((o) => o.needs))) {
        const lines = omit(changedScripts(script), OMITTED.filter((o) => o.script === script && o.needs === needs)).left.length;
        test.info().annotations.push({ type: 'waiting', description: `${lines} of ${script}'s ${left.length} left-out lines return with the ${needs} page` });
      }
    });
  }

  test('nothing asks whether the visitor prefers reduced motion (allowed change 1)', () => {
    for (const file of ['styles/wrapper.css', 'styles/tokens.css', 'styles/desktop.css', 'styles/pocket.css', 'styles/edition.css', 'scripts/desktop.js', 'scripts/pocket.js', 'scripts/router.js', 'scripts/edition.js']) {
      expect(src(file), file).not.toMatch(/prefers-reduced-motion/);
    }
  });

  test('the scroll value is written on the frame, never the page (allowed change 2)', () => {
    for (const edition of EDITIONS) {
      const js = src(`scripts/${edition}.js`);
      expect(js).not.toContain('root.style.setProperty("--sp"');
      expect(js.match(/\.setProperty\("--sp"/g)).toHaveLength(1);
      expect(js).toContain('frame.style.setProperty("--sp"');
    }
  });

  test('edition.css only hides the other edition\'s parts', () => {
    expect(withoutHeader(src('styles/edition.css'))).toBe(
      `@media ${DESKTOP_FROM}{[data-edition="pocket"]{display:none}}\n`
      + `@media not all and ${DESKTOP_FROM}{[data-edition="desktop"]{display:none}}\n`,
    );
  });
});

test.describe('as built', () => {
  const html = () => fs.readFileSync(path.join(SITE_DIR, 'index.html'), 'utf8');
  const builtFile = (href: string) => fs.readFileSync(path.join(SITE_DIR, href));

  test('each stylesheet and script is served byte for byte as in src/', () => {
    const page = html();
    const links = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)"(?: media="([^"]+)")?>/g)].map((m) => ({ href: m[1], media: m[2] ?? '' }));
    const named = (stem: string) => links.find((l) => path.posix.basename(l.href).startsWith(`${stem}.`));
    expect(links).toHaveLength(3);
    expect(named('tokens')?.media).toBe('');
    expect(named('desktop')?.media).toBe(DESKTOP_FROM);
    expect(named('pocket')?.media).toBe(`not all and ${DESKTOP_FROM}`);
    for (const stem of ['tokens', 'desktop', 'pocket']) expect(builtFile(named(stem)!.href).equals(Buffer.from(src(`styles/${stem}.css`)))).toBe(true);

    const scripts = [...page.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
    expect(scripts.map((s) => path.posix.basename(s).split('.')[0])).toEqual(['desktop', 'pocket', 'router']);
    for (const s of scripts) expect(builtFile(s).equals(Buffer.from(src(`scripts/${path.posix.basename(s).split('.')[0]}.js`)))).toBe(true);

    // The two small files ride inside the page, unchanged.
    for (const inline of ['styles/wrapper.css', 'styles/edition.css', 'scripts/edition.js']) expect(page).toContain(src(inline));
  });

  test('every page links the same files', () => {
    const assets = (file: string) => [...fs.readFileSync(file, 'utf8').matchAll(/(?:href|src)="(\/_astro\/[^"]+)"/g)].map((m) => m[1]).join(' ');
    const pages = fs.readdirSync(SITE_DIR, { recursive: true, withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => path.join(e.parentPath, e.name));
    expect(pages).toHaveLength(7);
    for (const p of pages) expect(assets(p), p).toBe(assets(path.join(SITE_DIR, 'index.html')));
  });
});
