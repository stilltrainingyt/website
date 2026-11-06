import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// The raw materials of step 2, read back out of the design files: their token blocks,
// every other value they use, their fonts and Echo's two images. materials.spec.ts checks
// src/styles/tokens.css and public/ against these; the materials target (targets.ts)
// renders the design pages with the project's own copies swapped in.

export const EDITIONS = ['desktop', 'pocket'] as const;
export type Edition = (typeof EDITIONS)[number];

export const TOKENS_CSS = path.resolve('src/styles/tokens.css');
export const PUBLIC_DIR = path.resolve('public');

export function designHtml(edition: Edition): string {
  return fs.readFileSync(path.resolve('design-reference', `${edition}.html`), 'utf8');
}

// Each design file has two <style> blocks: the export wrapper's, then the design's own.
export function styleBlocks(html: string): { wrapper: string; design: string } {
  const blocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  if (blocks.length !== 2) throw new Error(`expected 2 <style> blocks, found ${blocks.length}`);
  return { wrapper: blocks[0], design: blocks[1] };
}

// The three blocks that hold the design's tokens, found by how each one opens.
const TOKEN_BLOCK_OPENINGS = [
  /:root\{\s*\n\s*--paper:/,
  /@media \(prefers-color-scheme:dark\)\{:root:not\(\[data-theme="light"\]\)\{/,
  /:root\[data-theme="dark"\]\{\s*\n\s*--paper:/,
];

function blockEnd(css: string, start: number): number {
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return i + 1;
  }
  throw new Error('unclosed block');
}

export function tokenBlocks(css: string): string[] {
  return TOKEN_BLOCK_OPENINGS.map((opening) => {
    const m = opening.exec(css);
    if (!m) throw new Error(`token block not found: ${opening}`);
    return css.slice(m.index, blockEnd(css, m.index));
  });
}

// Custom properties set in a block, as written.
export function customProperties(block: string): Map<string, string> {
  return new Map([...block.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+?)\s*(?=;|\})/g)].map((m) => [m[1], m[2]]));
}

// ---------------------------------------------------------------------------
// Reading CSS

export type Declaration = { prop: string; value: string; media: string[]; where: string };

// Data URIs hold images, not values; they are cut out before reading.
const withoutDataUris = (css: string) => css.replace(/url\(\s*(["']?)data:[\s\S]*?\1\s*\)/g, 'url(data)');

export function declarations(css: string, where: string): Declaration[] {
  const src = withoutDataUris(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const out: Declaration[] = [];
  const preludes: string[] = [];
  let buf = '';
  let quote = '';
  let parens = 0;
  for (const ch of src) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '(') parens++;
    if (ch === ')') parens--;
    if (parens > 0) { buf += ch; continue; }
    if (ch === '{') { preludes.push(buf.trim()); buf = ''; continue; }
    if (ch === ';' || ch === '}') {
      const text = buf.trim();
      buf = '';
      const colon = text.indexOf(':');
      if (colon > 0) {
        out.push({
          prop: text.slice(0, colon).trim().toLowerCase(),
          value: text.slice(colon + 1).trim().replace(/\s*!important$/, ''),
          media: preludes.filter((p) => p.startsWith('@media')).map((p) => p.slice(6).trim()),
          where,
        });
      }
      if (ch === '}') preludes.pop();
      continue;
    }
    buf += ch;
  }
  return out;
}

export function mediaConditions(css: string): string[] {
  return [...withoutDataUris(css.replace(/\/\*[\s\S]*?\*\//g, '')).matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim());
}

const decodeEntities = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function inlineStyles(html: string): Declaration[] {
  return [...html.matchAll(/\sstyle="([^"]*)"/g)].flatMap((m) => declarations(`x{${decodeEntities(m[1])}}`, 'inline style'));
}

export function scripts(html: string): string {
  return [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
}

// ---------------------------------------------------------------------------
// Sorting values into the catalogue's kinds

export const KINDS = [
  'colour', 'font-stack', 'font-size', 'line-height', 'letter-spacing', 'font-weight', 'font-feature',
  'spacing', 'size', 'radius', 'shadow', 'breakpoint', 'canvas',
] as const;
export type Kind = (typeof KINDS)[number];
export type Catalogue = Record<Kind, Set<string>>;

const SPACING = new Set(['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-block', 'margin-inline',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'padding-block', 'padding-inline',
  'gap', 'row-gap', 'column-gap', 'scroll-padding-top', 'scroll-margin-top']);
// Values that are motion, stacking, clipping or the scripts' running state rather than
// colour, font, size, spacing, shadow or breakpoint. Colours inside them still count.
export const OUT_OF_SCOPE = new Set(['transform', 'translate', 'rotate', 'scale', 'perspective', 'perspective-origin',
  'transform-origin', 'transform-style', 'backface-visibility', '-webkit-backface-visibility', 'animation', 'animation-delay',
  'animation-duration', 'transition', 'transition-duration', 'z-index', 'opacity', 'clip-path', 'order',
  '-webkit-text-size-adjust', 'mix-blend-mode']);
const COLOUR_NAMES = new Set(['transparent', 'black', 'white', 'red', 'green', 'blue', 'gray', 'grey', 'silver', 'maroon',
  'purple', 'fuchsia', 'lime', 'olive', 'yellow', 'navy', 'teal', 'aqua', 'orange']);
const LENGTH = /^-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem|%|vw|vh|vmin|vmax|svh|dvh|lvh|ch|ex|fr)?$/;

export function colours(value: string): string[] {
  const text = withoutStrings(value);
  const found = [...text.matchAll(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/g)].map((m) => m[0]);
  for (const word of text.match(/[a-zA-Z-]+/g) ?? []) if (COLOUR_NAMES.has(word.toLowerCase())) found.push(word);
  return found;
}

// Quoted text (generated content, grid area names, font names) holds no values.
const withoutStrings = (value: string) => value.replace(/"[^"]*"|'[^']*'/g, ' ');

// The lengths in a value, as written: colours, names and var() references are dropped, a
// var() fallback counts. A bare number counts only where it is a length (0) or a line
// height; elsewhere it is a count or a grid line, not a size.
function lengths(value: string, unitless = false): string[] {
  const bare = withoutStrings(value)
    .replace(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/g, ' ')
    .replace(/var\(\s*--[\w-]+\s*,?/g, ' ')
    .replace(/[a-zA-Z-]+\(/g, ' ');
  return bare.split(/[\s,()/]+/).filter((t) => LENGTH.test(t) && (unitless || /[a-z%]$/.test(t) || /^-?0$/.test(t)));
}

function topLevelTokens(value: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (buf) out.push(buf); buf = ''; } else buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

function splitTopLevelCommas(value: string): string[] {
  const out: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(buf.trim()); buf = ''; } else buf += ch;
  }
  out.push(buf.trim());
  return out;
}

export function emptyCatalogue(): Catalogue {
  return Object.fromEntries(KINDS.map((k) => [k, new Set<string>()])) as Catalogue;
}

export function addDeclaration(cat: Catalogue, d: Declaration): void {
  for (const c of colours(d.value)) cat.colour.add(c);
  const { prop, value } = d;
  if (prop.startsWith('--') || OUT_OF_SCOPE.has(prop)) return;
  if (prop === 'font') {
    const tokens = topLevelTokens(value);
    const i = tokens.findIndex((t) => /^(?:\d+\.?\d*|\.\d+)(px|em|rem|%)(\/.+)?$/.test(t));
    if (i < 0) return;
    for (const t of tokens.slice(0, i)) {
      if (/^\d+$/.test(t) || t === 'bold') cat['font-weight'].add(t);
      else if (t !== 'normal') cat['font-feature'].add(t);
    }
    const [size, lineHeight] = tokens[i].split('/');
    cat['font-size'].add(size);
    if (lineHeight) cat['line-height'].add(lineHeight);
    const family = tokens.slice(i + 1).join(' ');
    if (!family.startsWith('var(')) cat['font-stack'].add(family);
    return;
  }
  if (prop === 'font-family') { if (!value.startsWith('var(')) cat['font-stack'].add(value); return; }
  if (prop === 'font-size') { for (const l of lengths(value)) cat['font-size'].add(l); return; }
  if (prop === 'line-height') { for (const l of lengths(value, true)) cat['line-height'].add(l); return; }
  if (prop === 'letter-spacing') { for (const l of lengths(value)) cat['letter-spacing'].add(l); return; }
  if (prop === 'font-weight') { cat['font-weight'].add(value); return; }
  if (prop === 'font-style' || prop.startsWith('font-variant')) { cat['font-feature'].add(value); return; }
  if (prop === 'border-radius') { for (const l of lengths(value)) cat.radius.add(l); return; }
  if (prop === 'box-shadow' || prop === 'text-shadow') { if (value !== 'none') for (const s of splitTopLevelCommas(value)) cat.shadow.add(s); return; }
  if (prop === 'filter') { for (const m of value.matchAll(/drop-shadow\((?:[^()]|\([^()]*\))*\)/g)) cat.shadow.add(m[0]); return; }
  if (SPACING.has(prop)) { for (const l of lengths(value)) cat.spacing.add(l); return; }
  if (prop === 'flex') { for (const l of lengths(value)) if (/[a-z%]$/.test(l)) cat.size.add(l); return; }
  if (prop === 'aspect-ratio') { cat.size.add(value); return; }
  for (const l of lengths(value)) cat.size.add(l);
}

export function addMedia(cat: Catalogue, condition: string): void {
  for (const m of condition.matchAll(/\((?:min|max)-(?:width|height)\s*:\s*([^)]+)\)/g)) cat.breakpoint.add(m[1].trim());
}

// What the design's scripts draw on the loss curve's canvas with.
export function addCanvas(cat: Catalogue, js: string): void {
  for (const m of js.matchAll(/\.font\s*=\s*'([^']+)'/g)) cat.canvas.add(m[1]);
  for (const m of js.matchAll(/lineWidth\s*=\s*([\d.]+)/g)) cat.canvas.add(m[1]);
  for (const m of js.matchAll(/setLineDash\((\[[\d.,\s]+\])\)/g)) if (m[1] !== '[]') cat.canvas.add(m[1].replace(/\s/g, ''));
  for (const m of js.matchAll(/\.arc\([^,]+,[^,]+,([^,]+),/g)) {
    for (const r of m[1].split(/[?:]/)) if (/^\s*[\d.]+\s*$/.test(r)) cat.canvas.add(r.trim());
  }
  for (const m of js.matchAll(/clientHeight\s*\|\|\s*([\d.]+)/g)) cat.canvas.add(m[1]);
}

// Every value the design files use, by kind. The token blocks are left out: tokens.css
// carries them whole.
export function designCatalogue(): Catalogue {
  const cat = emptyCatalogue();
  for (const edition of EDITIONS) {
    const html = designHtml(edition);
    const { wrapper, design } = styleBlocks(html);
    let rest = design;
    for (const block of tokenBlocks(design)) rest = rest.replace(block, '');
    for (const d of [...declarations(wrapper, 'export wrapper'), ...declarations(rest, edition), ...inlineStyles(html)]) addDeclaration(cat, d);
    for (const c of [...mediaConditions(wrapper), ...mediaConditions(rest)]) addMedia(cat, c);
    for (const m of html.matchAll(/\s(?:fill|stroke|stop-color|color)="([^"]+)"/g)) for (const c of colours(m[1])) cat.colour.add(c);
    // Sizes set as attributes: Echo's images and the paperclip drawing.
    for (const m of html.matchAll(/<[a-z]+\s[^>]*>/g)) for (const a of m[0].replace(/src="[^"]*"/, '').matchAll(/\s(?:width|height|stroke-width)="([^"]+)"/g)) cat.size.add(a[1]);
    addCanvas(cat, scripts(html));
  }
  return cat;
}

// The catalogue as tokens.css writes it: one custom property per value, named by kind.
export const PREFIX: Record<Kind, string> = {
  colour: '--colour-', 'font-stack': '--font-stack-', 'font-size': '--font-size-', 'line-height': '--line-height-',
  'letter-spacing': '--letter-spacing-', 'font-weight': '--font-weight-', 'font-feature': '--font-feature-',
  spacing: '--space-', size: '--size-', radius: '--radius-', shadow: '--shadow-', breakpoint: '--breakpoint-', canvas: '--canvas-',
};

export function tokensCatalogue(css: string): Catalogue {
  const cat = emptyCatalogue();
  const start = css.indexOf('/* @catalogue');
  if (start < 0) throw new Error('tokens.css has no catalogue');
  for (const [name, value] of customProperties(css.slice(start))) {
    const kind = KINDS.find((k) => name.startsWith(PREFIX[k]));
    if (!kind) throw new Error(`catalogue property of no known kind: ${name}`);
    cat[kind].add(value);
  }
  return cat;
}

// ---------------------------------------------------------------------------
// The design pages with the project's materials swapped in (the materials target)

export const GOOGLE_FONTS_LINKS = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;700&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;600&family=Architects+Daughter&display=swap">';

// Echo's two images, served as the design's own PNG bytes. A lossless WebP holds the same
// pixels, but Chrome's WebP decoder rounds Echo's soft edges differently when it draws them
// (ASSUMPTIONS.md, step 2), so only the same file draws the same.
export const ECHO_IMAGES = { lt: 'images/echo-light.png', dk: 'images/echo-dark.png' } as const;

const ECHO_SRC = (kind: 'lt' | 'dk') => new RegExp(`(<img class="echo ${kind}"[^>]*?src=")data:image/png;base64,([^"]+)(")`);

export function echoPng(html: string, kind: 'lt' | 'dk'): Buffer {
  const m = ECHO_SRC(kind).exec(html);
  if (!m) throw new Error(`Echo's ${kind} image not found`);
  return Buffer.from(m[2], 'base64');
}

// Each swap must find exactly what it replaces, or the page is not the design any more.
function swapOnce(html: string, find: string | RegExp, replace: (m: RegExpExecArray) => string): string {
  const re = typeof find === 'string' ? new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : new RegExp(find.source, 'g');
  const all = [...html.matchAll(re)];
  if (all.length !== 1) throw new Error(`expected one match for ${re}, found ${all.length}`);
  const m = all[0];
  return html.slice(0, m.index) + replace(m) + html.slice((m.index ?? 0) + m[0].length);
}

export function materialPage(html: string): string {
  let out = swapOnce(html, GOOGLE_FONTS_LINKS, () => '<link rel="stylesheet" href="/styles/tokens.css">');
  for (const block of tokenBlocks(styleBlocks(out).design)) out = swapOnce(out, block, () => '');
  for (const kind of ['lt', 'dk'] as const) out = swapOnce(out, ECHO_SRC(kind), (m) => `${m[1]}/${ECHO_IMAGES[kind]}${m[3]}`);
  return out;
}

// ---------------------------------------------------------------------------
// PNG decoding, kept independent of the browser: 8-bit RGBA or RGB, not interlaced.

export function decodePng(png: Buffer): { width: number; height: number; rgba: Buffer } {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8;
  let width = 0, height = 0, type = 0;
  const idat: Buffer[] = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const kind = png.toString('latin1', p + 4, p + 8);
    const data = png.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9];
      if (data[8] !== 8 || (type !== 6 && type !== 2) || data[12] !== 0) throw new Error('only 8-bit RGB(A), not interlaced');
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rows[y * stride + x - bpp] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rows[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      rows[y * stride + x] = v & 0xff;
    }
  }
  if (bpp === 4) return { width, height, rgba: rows };
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) { rows.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = 255; }
  return { width, height, rgba };
}
