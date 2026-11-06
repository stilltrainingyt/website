import fs from 'node:fs';
import path from 'node:path';
import { test, expect, MATERIALS_ORIGIN } from '../targets';
import {
  EDITIONS, KINDS, TOKENS_CSS, PUBLIC_DIR, ECHO_IMAGES, designHtml, styleBlocks, tokenBlocks, customProperties,
  designCatalogue, tokensCatalogue, echoPng, decodePng,
} from './materials';

// Step 2's raw materials, checked against the design files. The screenshots of every page
// drawn with these materials are compared with the baselines by pages.spec.ts in the same
// project (npm run test:materials).

const tokensCss = () => fs.readFileSync(TOKENS_CSS, 'utf8');

test.describe('tokens.css', () => {
  test('holds the design\'s three token blocks exactly as written', () => {
    const ours = tokenBlocks(tokensCss());
    const desktop = tokenBlocks(styleBlocks(designHtml('desktop')).design);
    expect(ours).toEqual(desktop);
    // Pocket's blocks set the same values, laid out differently and without --clip-hi.
    const pocket = tokenBlocks(styleBlocks(designHtml('pocket')).design);
    for (let i = 0; i < 3; i++) {
      const p = customProperties(pocket[i]);
      const d = customProperties(desktop[i]);
      expect([...p].filter(([k, v]) => d.get(k) !== v), `pocket block ${i + 1} values differing from desktop`).toEqual([]);
      expect([...d.keys()].filter((k) => !p.has(k))).toEqual(['--clip-hi']);
      expect(pocket[i].includes('color-scheme:dark')).toBe(desktop[i].includes('color-scheme:dark'));
    }
  });

  test('catalogues every other value the design uses, and nothing it does not', () => {
    const design = designCatalogue();
    const ours = tokensCatalogue(tokensCss());
    for (const kind of KINDS) {
      const missing = [...design[kind]].filter((v) => !ours[kind].has(v));
      const invented = [...ours[kind]].filter((v) => !design[kind].has(v));
      expect({ kind, missing, invented }).toEqual({ kind, missing: [], invented: [] });
    }
  });
});

test.describe('fonts', () => {
  const faces = () => [...tokensCss().matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => ({
    family: /font-family:\s*'([^']+)'/.exec(m[1])![1],
    url: /src:\s*url\(([^)]+)\)/.exec(m[1])![1],
  }));

  test('every file tokens.css names is in public/fonts, with its family\'s licence beside it', () => {
    const named = new Set(faces().map((f) => f.url));
    for (const url of named) expect(fs.existsSync(path.join(PUBLIC_DIR, url)), url).toBe(true);
    const onDisk = fs.readdirSync(path.join(PUBLIC_DIR, 'fonts'), { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile()).map((e) => '/' + path.relative(PUBLIC_DIR, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
    const licences = onDisk.filter((f) => /\/(OFL|LICENSE)\.txt$/.test(f));
    expect(onDisk.filter((f) => !named.has(f) && !licences.includes(f)), 'files nothing uses').toEqual([]);
    for (const dir of new Set([...named].map((u) => path.posix.dirname(u)))) {
      const licence = licences.find((l) => path.posix.dirname(l) === dir);
      expect(licence, `licence in ${dir}`).toBeTruthy();
      expect(fs.readFileSync(path.join(PUBLIC_DIR, licence!), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });

  test('only Plex reserves its name, and only IBM\'s own files carry it', () => {
    // A licence names its Reserved Font Names in the copyright lines above the licence text.
    const copyright = (dir: string) => {
      const text = fs.readFileSync(path.join(PUBLIC_DIR, 'fonts', dir, fs.readdirSync(path.join(PUBLIC_DIR, 'fonts', dir)).find((f) => f.endsWith('.txt'))!), 'utf8');
      const end = text.indexOf('This Font Software is licensed under the SIL Open Font License');
      expect(end, `${dir}: licence text`).toBeGreaterThan(0);
      return text.slice(0, end);
    };
    expect(copyright('fraunces')).not.toMatch(/Reserved Font Name/);
    expect(copyright('architects-daughter')).not.toMatch(/Reserved Font Name/);
    for (const dir of ['ibm-plex-sans', 'ibm-plex-mono']) expect(copyright(dir)).toContain('IBM Corp. with Reserved Font Name "Plex"');
    // Google's copies carry Google's file names; IBM's carry IBM's.
    for (const f of faces().filter((x) => x.family.startsWith('IBM Plex'))) expect(path.posix.basename(f.url)).toMatch(/^IBMPlex(SansVar|Mono)-/);
  });

  for (const edition of EDITIONS) {
    test(`${edition} draws its text only with the self-hosted fonts`, async ({ page }) => {
      const requested: string[] = [];
      page.on('request', (r) => requested.push(r.url()));
      await page.goto(`${MATERIALS_ORIGIN}/${edition}.html`);
      await page.evaluate(() => document.fonts.ready);
      expect(requested.filter((u) => /fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
      const fontUrls = requested.filter((u) => u.endsWith('.woff2'));
      expect(fontUrls.length).toBeGreaterThan(0);
      for (const u of fontUrls) expect(u.startsWith(`${MATERIALS_ORIGIN}/fonts/`), u).toBe(true);
      const failed = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight} ${f.style}`));
      expect(failed).toEqual([]);
    });
  }
});

test.describe('Echo', () => {
  test('both editions carry the same two PNGs', () => {
    for (const kind of ['lt', 'dk'] as const) expect(echoPng(designHtml('pocket'), kind).equals(echoPng(designHtml('desktop'), kind))).toBe(true);
  });

  // The same bytes: the same pixels, drawn by the same decoder, in every browser.
  for (const kind of ['lt', 'dk'] as const) {
    test(`${ECHO_IMAGES[kind]} is byte for byte the design's PNG`, () => {
      const served = fs.readFileSync(path.join(PUBLIC_DIR, ECHO_IMAGES[kind]));
      expect(served.equals(echoPng(designHtml('desktop'), kind))).toBe(true);
      const { width, height } = decodePng(served);
      expect([width, height], 'the size the <img> declares').toEqual([460, 325]);
    });
  }
});
