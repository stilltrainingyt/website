import fs from 'node:fs';
import path from 'node:path';
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

// The site's three scripts: each edition's own, and the page router both editions share.
export type Script = Edition | 'router';
export const SCRIPTS: Script[] = ['desktop', 'pocket', 'router'];

const scriptBlocks = (edition: Edition) => [...designHtml(edition).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const isRouter = (js: string) => js.includes('window.stGo=');

// Each edition's scripts in the design's order, without the page router; or the router, which
// is the last script of both files and the same in each.
export function designScripts(script: Script): string {
  if (script !== 'router') return scriptBlocks(script).filter((js) => !isRouter(js)).join('');
  const [desktop, pocket] = (['desktop', 'pocket'] as const).map((e) => scriptBlocks(e).filter(isRouter));
  if (desktop.length !== 1 || pocket.length !== 1 || desktop[0] !== pocket[0]) throw new Error('expected one page router, the same in both design files');
  return desktop[0];
}

export type Change = { script: Script; from: string; to: string; times: number; why: string };

const REDUCE = 'var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;';

// Step 4 (your decision): the router's page-showing code (paint, jump, show) stays as written,
// and the parts that turned pages by #hash give way to the site's addresses. The design's go
// function becomes the block between these two lines of src/scripts/router.js, the site's own
// code; its hashchange listener becomes a popstate listener, so Back and Forward replay the
// turn; and its start-up shows the file's own page, at the entry its address names.
export const ADDRESS_BLOCK = {
  open: "  /* ---- every page has its own address (the site's own code, step 4) ---- */\n",
  close: '  /* ---- end of the addresses ---- */\n',
};

export function addressBlock(): string {
  const js = fs.readFileSync(path.resolve('src/scripts/router.js'), 'utf8');
  const open = js.indexOf(ADDRESS_BLOCK.open);
  const close = js.indexOf(ADDRESS_BLOCK.close);
  if (open < 0 || close < open || js.indexOf(ADDRESS_BLOCK.open, open + 1) >= 0) throw new Error('router.js: expected one address block');
  return js.slice(open, close + ADDRESS_BLOCK.close.length);
}

const ROUTER_GO = `  function go(route,then){
    if((location.hash||"").slice(1)===route){show(route,then);return;}
    pendingThen=then||null; location.hash=route;
  }
`;
const ROUTER_HASHCHANGE = `  window.addEventListener("hashchange",function(){var r=(location.hash||"").slice(1)||"home"; var th=pendingThen; pendingThen=null;
    if(!pages[r]&&document.getElementById(r)&&pages.home.contains(document.getElementById(r))){show("home",r);return;}
    show(r,th);});
`;
const ROUTER_START = `  if(!start)show("home");
  else if(pages[start])show(start);
  else if(document.getElementById(start)&&pages.home.contains(document.getElementById(start)))show("home",start);
  else show("missing");
`;

// Every changed line. `times` is how often `from` occurs in the script.
export const SCRIPT_CHANGES: Change[] = [
  { script: 'desktop', from: REDUCE, to: 'var reduce=false;', times: 2, why: 'allowed change 1: reduce is always off' },
  { script: 'desktop', from: '  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;\n', to: '', times: 1, why: 'allowed change 1: the scroll effects no longer stop for reduced motion' },
  { script: 'desktop', from: 'behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"', to: 'behavior:"smooth"', times: 1, why: 'allowed change 1: folders always scroll smoothly' },
  { script: 'desktop', from: '  var deck=document.getElementById("deck"),', to: '  var frame=document.querySelector(".frame");\n  var deck=document.getElementById("deck"),', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { script: 'desktop', from: 'root.style.setProperty("--sp",', to: 'frame.style.setProperty("--sp",', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { script: 'desktop', from: 'try{var s=localStorage.getItem("st-theme");', to: 'try{var s=JSON.parse(localStorage.getItem("st-theme"));', times: 1, why: 'paper choice kept in pocket\'s format (your decision, step 3)' },
  { script: 'desktop', from: 'try{localStorage.setItem("st-theme",next);}', to: 'try{localStorage.setItem("st-theme",JSON.stringify(next));}', times: 1, why: 'paper choice kept in pocket\'s format (your decision, step 3)' },
  { script: 'pocket', from: REDUCE, to: 'var reduce=false;', times: 1, why: 'allowed change 1: reduce is always off' },
  { script: 'pocket', from: '  var leaves=all("[data-leaf]"), cover=$("cover"), echoWrap=$("echoWrap"), wire=$("wire"), queued=false;\n', to: '  var leaves=all("[data-leaf]"), cover=$("cover"), echoWrap=$("echoWrap"), wire=$("wire"), queued=false;\n  var frame=document.querySelector(".frame");\n', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { script: 'pocket', from: 'root.style.setProperty("--sp",', to: 'frame.style.setProperty("--sp",', times: 1, why: 'allowed change 2: the scroll value goes on the frame' },
  { script: 'router', from: REDUCE, to: 'var reduce=false;', times: 1, why: 'allowed change 1: reduce is always off' },
  { script: 'router', from: ROUTER_GO, to: addressBlock(), times: 1, why: 'every page has its own address (your decision, step 4): go fetches and places the next page, then turns to it' },
  { script: 'router', from: ROUTER_HASHCHANGE, to: '  window.addEventListener("popstate",function(){if(location.pathname!==shownAt)turn(location.pathname,null,false);});\n', times: 1, why: 'every page has its own address (your decision, step 4): Back and Forward replay the turn' },
  { script: 'router', from: ROUTER_START, to: '  show(Object.keys(pages)[0],start&&document.getElementById(start)?start:null);\n', times: 1, why: 'every page has its own address (your decision, step 4): a visitor arriving at any address sees that page directly' },
];

export function changedScripts(script: Script): string {
  let js = designScripts(script);
  for (const c of SCRIPT_CHANGES.filter((x) => x.script === script)) {
    const times = js.split(c.from).length - 1;
    if (times !== c.times) throw new Error(`${script}: expected ${c.times} of ${JSON.stringify(c.from)}, found ${times}`);
    js = js.split(c.from).join(c.to);
  }
  return js;
}

// Lines that need parts of a page, left out while the pages are empty. Each returns with
// the page named in `needs`. A `section` is a whole titled section of the design's script,
// from its title to the next title or the end of its script; otherwise `lines` lines from
// the line starting with `from`.
export type Omission = { script: Script; needs: string } & ({ section: string } | { from: string; lines: number });

export const OMITTED: Omission[] = [
  { script: 'desktop', needs: 'home', from: 'wrap.addEventListener("pointermove",function(ev){', lines: 11 },
  { script: 'desktop', needs: 'home', section: '/* ---- the tear ---- */' },
  { script: 'desktop', needs: 'home', section: '/* ---- the slip itself ---- */' },
  { script: 'desktop', needs: 'home', section: '/* ---- Echo: one more episode ---- */' },
  { script: 'desktop', needs: 'home', section: '/* ---- the pad: four pages, turned over the top ---- */' },
  { script: 'desktop', needs: 'home', section: '/* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */' },
  { script: 'desktop', needs: 'home', section: '/* ---- the log: filter by track, stamp what you want to watch ---- */' },
  { script: 'desktop', needs: 'home', section: '/* ---- tape the slip back on ---- */' },
  { script: 'desktop', needs: 'home', from: 'var d=deck.getBoundingClientRect();', lines: 4 },
  { script: 'pocket', needs: 'home', from: 'var cr=cover.getBoundingClientRect();', lines: 1 },
  { script: 'pocket', needs: 'about', from: 'var stamp=$("stamp");', lines: 3 },
  { script: 'pocket', needs: 'home', section: '/* Echo */' },
  { script: 'pocket', needs: 'home', section: '/* pad */' },
  { script: 'pocket', needs: 'home', section: '/* loose note */' },
  { script: 'pocket', needs: 'home', from: 'rail.addEventListener("scroll",function(){', lines: 5 },
  { script: 'pocket', needs: 'home', section: '/* by hand: loss = (weight - 3) squared */' },
  { script: 'pocket', needs: 'home', section: '/* log */' },
  { script: 'pocket', needs: 'home', section: '/* the slip: pull down, or press, to tear */' },
  { script: 'router', needs: 'episode', section: '/* episode chapters */' },
  { script: 'router', needs: 'writing', section: '/* writing shelves */' },
];

const TITLE = /^ {2}\/\*.*\*\/$/;
const END = '})();';

export function omit(js: string, omissions: Omission[]): { kept: string; left: string[] } {
  const lines = js.split('\n');
  const drop = new Set<number>();
  for (const o of omissions) {
    const key = 'section' in o ? o.section : o.from;
    const at = lines.flatMap((l, i) => ('section' in o ? l.trim() === key : l.trim().startsWith(key)) ? [i] : []);
    if (at.length !== 1) throw new Error(`${o.script}: expected one line for ${JSON.stringify(key)}, found ${at.length}`);
    let end = at[0] + ('section' in o ? 1 : o.lines);
    if ('section' in o) while (end < lines.length && !TITLE.test(lines[end]) && lines[end] !== END) end++;
    for (let i = at[0]; i < end; i++) {
      if (drop.has(i)) throw new Error(`${o.script}: omissions overlap at ${JSON.stringify(lines[i])}`);
      drop.add(i);
    }
  }
  return { kept: lines.filter((_, i) => !drop.has(i)).join('\n'), left: lines.filter((_, i) => drop.has(i)) };
}

// A script as the site carries it: each edition's between the edition switch's two lines, so it
// runs only at its own widths; the router, which both editions share, as it is.
export const EDITION_OPEN: Record<Edition, string> = {
  desktop: `if(window.matchMedia("${DESKTOP_FROM}").matches){`,
  pocket: `if(!window.matchMedia("${DESKTOP_FROM}").matches){`,
};

export function portedScript(script: Script): string {
  const { kept } = omit(changedScripts(script), OMITTED.filter((o) => o.script === script));
  return script === 'router' ? kept : `${EDITION_OPEN[script]}${kept}}\n`;
}

// A file as the site carries it: an opening comment, then the code.
export function withoutHeader(text: string): string {
  const m = /^\/\*[\s\S]*?\*\/\n/.exec(text);
  if (!m) throw new Error('expected the file to open with a /* comment */');
  return text.slice(m[0].length);
}
