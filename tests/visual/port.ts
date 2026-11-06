import { designHtml, styleBlocks, tokenBlocks, type Edition } from './materials';

// The design's CSS and scripts as the site carries them (src/styles, src/scripts), and the
// complete list of what differs from design-reference/. port.spec.ts checks the site's
// files against exactly this; nothing else may differ.

// The edition switch: the desktop edition from 900 px, the pocket edition below.
export const DESKTOP_FROM = '(min-width:900px)';

// ---------------------------------------------------------------------------
// CSS

// Each design file's three token blocks live in src/styles/tokens.css (step 2), and the
// reduced-motion blocks come out (CLAUDE.md, allowed change 1). Everything else is as written.
export function reducedMotionBlocks(css: string): string[] {
  const found: string[] = [];
  for (const m of css.matchAll(/@media \(prefers-reduced-motion:reduce\)\{/g)) {
    let depth = 0;
    for (let i = m.index; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) {
        found.push(css.slice(m.index, i + 1));
        break;
      }
    }
  }
  return found;
}

export function portedCss(edition: Edition): string {
  let css = styleBlocks(designHtml(edition)).design;
  for (const block of [...tokenBlocks(css), ...reducedMotionBlocks(css)]) {
    if (css.split(block).length !== 2) throw new Error(`${edition}: a block to remove is not there exactly once`);
    css = css.replace(block, '');
  }
  return css;
}

// The export wrapper's own small stylesheet, the same in both files.
export const wrapperCss = (): string => styleBlocks(designHtml('desktop')).wrapper;

// ---------------------------------------------------------------------------
// Scripts

// Each edition's scripts in the design's order, without the page router (the same in both
// files; step 4 ports it).
export function designScripts(edition: Edition): string {
  return [...designHtml(edition).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((js) => !js.includes('window.stGo='))
    .join('');
}

export type Change = { edition: Edition; from: string; to: string; times: number; why: string };

const REDUCE = 'var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;';

// Every changed line. `times` is how often `from` occurs in the edition's scripts.
export const SCRIPT_CHANGES: Change[] = [
  { edition: 'desktop', from: REDUCE, to: 'var reduce=false;', times: 2, why: 'allowed change 1: reduce is always off' },
  { edition: 'desktop', from: '  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;\n', to: '', times: 1, why: 'allowed change 1: the scroll effects no longer stop for reduced motion' },
  { edition: 'desktop', from: 'behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"', to: 'behavior:"smooth"', times: 1, why: 'allowed change 1: folders always scroll smoothly' },
  { edition: 'desktop', from: '  var deck=document.getElementById("deck"),', to: '  var frame=document.querySelector(".frame");\n  var deck=document.getElementById("deck"),', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { edition: 'desktop', from: 'root.style.setProperty("--sp",', to: 'frame.style.setProperty("--sp",', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { edition: 'desktop', from: 'try{var s=localStorage.getItem("st-theme");', to: 'try{var s=JSON.parse(localStorage.getItem("st-theme"));', times: 1, why: 'paper choice kept in pocket\'s format (your decision, step 3)' },
  { edition: 'desktop', from: 'try{localStorage.setItem("st-theme",next);}', to: 'try{localStorage.setItem("st-theme",JSON.stringify(next));}', times: 1, why: 'paper choice kept in pocket\'s format (your decision, step 3)' },
  { edition: 'pocket', from: REDUCE, to: 'var reduce=false;', times: 1, why: 'allowed change 1: reduce is always off' },
  { edition: 'pocket', from: '  var leaves=all("[data-leaf]"), cover=$("cover"), echoWrap=$("echoWrap"), wire=$("wire"), queued=false;\n', to: '  var leaves=all("[data-leaf]"), cover=$("cover"), echoWrap=$("echoWrap"), wire=$("wire"), queued=false;\n  var frame=document.querySelector(".frame");\n', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { edition: 'pocket', from: 'root.style.setProperty("--sp",', to: 'frame.style.setProperty("--sp",', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
];

export function changedScripts(edition: Edition): string {
  let js = designScripts(edition);
  for (const c of SCRIPT_CHANGES.filter((x) => x.edition === edition)) {
    const times = js.split(c.from).length - 1;
    if (times !== c.times) throw new Error(`${edition}: expected ${c.times} of ${JSON.stringify(c.from)}, found ${times}`);
    js = js.split(c.from).join(c.to);
  }
  return js;
}

// Lines that need parts of a page, left out while the pages are empty. Each returns with
// the page named in `needs`. A `section` is a whole titled section of the design's script,
// from its title to the next title or the end of its script; otherwise `lines` lines from
// the line starting with `from`.
export type Omission = { edition: Edition; needs: string } & ({ section: string } | { from: string; lines: number });

export const OMITTED: Omission[] = [
  { edition: 'desktop', needs: 'home', from: 'wrap.addEventListener("pointermove",function(ev){', lines: 11 },
  { edition: 'desktop', needs: 'home', section: '/* ---- the tear ---- */' },
  { edition: 'desktop', needs: 'home', section: '/* ---- the slip itself ---- */' },
  { edition: 'desktop', needs: 'home', section: '/* ---- Echo: one more episode ---- */' },
  { edition: 'desktop', needs: 'home', section: '/* ---- the pad: four pages, turned over the top ---- */' },
  { edition: 'desktop', needs: 'home', section: '/* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */' },
  { edition: 'desktop', needs: 'home', section: '/* ---- the log: filter by track, stamp what you want to watch ---- */' },
  { edition: 'desktop', needs: 'home', section: '/* ---- tape the slip back on ---- */' },
  { edition: 'desktop', needs: 'home', from: 'var d=deck.getBoundingClientRect();', lines: 4 },
  { edition: 'pocket', needs: 'home', from: 'var cr=cover.getBoundingClientRect();', lines: 1 },
  { edition: 'pocket', needs: 'about', from: 'var stamp=$("stamp");', lines: 3 },
  { edition: 'pocket', needs: 'home', section: '/* Echo */' },
  { edition: 'pocket', needs: 'home', section: '/* pad */' },
  { edition: 'pocket', needs: 'home', section: '/* loose note */' },
  { edition: 'pocket', needs: 'home', from: 'rail.addEventListener("scroll",function(){', lines: 5 },
  { edition: 'pocket', needs: 'home', section: '/* by hand: loss = (weight - 3) squared */' },
  { edition: 'pocket', needs: 'home', section: '/* log */' },
  { edition: 'pocket', needs: 'home', section: '/* the slip: pull down, or press, to tear */' },
];

const TITLE = /^ {2}\/\*.*\*\/$/;
const END = '})();';

export function omit(js: string, omissions: Omission[]): { kept: string; left: string[] } {
  const lines = js.split('\n');
  const drop = new Set<number>();
  for (const o of omissions) {
    const key = 'section' in o ? o.section : o.from;
    const at = lines.flatMap((l, i) => ('section' in o ? l.trim() === key : l.trim().startsWith(key)) ? [i] : []);
    if (at.length !== 1) throw new Error(`${o.edition}: expected one line for ${JSON.stringify(key)}, found ${at.length}`);
    let end = at[0] + ('section' in o ? 1 : o.lines);
    if ('section' in o) while (end < lines.length && !TITLE.test(lines[end]) && lines[end] !== END) end++;
    for (let i = at[0]; i < end; i++) {
      if (drop.has(i)) throw new Error(`${o.edition}: omissions overlap at ${JSON.stringify(lines[i])}`);
      drop.add(i);
    }
  }
  return { kept: lines.filter((_, i) => !drop.has(i)).join('\n'), left: lines.filter((_, i) => drop.has(i)) };
}

// The edition's script as the site carries it, between the edition switch's two lines.
export const EDITION_OPEN: Record<Edition, string> = {
  desktop: `if(window.matchMedia("${DESKTOP_FROM}").matches){`,
  pocket: `if(!window.matchMedia("${DESKTOP_FROM}").matches){`,
};

export function portedScript(edition: Edition): string {
  const { kept } = omit(changedScripts(edition), OMITTED.filter((o) => o.edition === edition));
  return `${EDITION_OPEN[edition]}${kept}}\n`;
}

// A file as the site carries it: an opening comment, then the code.
export function withoutHeader(text: string): string {
  const m = /^\/\*[\s\S]*?\*\/\n/.exec(text);
  if (!m) throw new Error('expected the file to open with a /* comment */');
  return text.slice(m[0].length);
}
