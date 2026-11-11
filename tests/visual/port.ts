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
  for (const change of CSS_CHANGES.filter((c) => c.edition === edition)) {
    if (css.split(change.from).length !== 2) throw new Error(`${edition}: "${change.from}" is not in the CSS exactly once`);
    css = css.replace(change.from, change.to);
  }
  return css + speedCss(edition);
}

// Rules given a second selector, each your decision. Pocket styles a text field only inside the
// torn slip (.under input); its search box (step 7) is a .field form, as the desktop's slip form
// is, and takes the same declarations. No value changes, and no page drawn before step 7 has a
// .field, so every screenshot stays as it was.
export const CSS_CHANGES: { edition: Edition; from: string; to: string; why: string }[] = [
  { edition: 'pocket', from: '.under input{', to: '.under input,.field input{', why: 'your decision, step 7: pocket\'s search field drawn as its slip field' },
  { edition: 'pocket', from: '.under input:focus-visible{', to: '.under input:focus-visible,.field input:focus-visible{', why: 'your decision, step 7: and focused as it' },
];

// Speed (CLAUDE.md, allowed change 4, step 5). The scroll effects write these values on every
// frame of a scroll, each onto the one element that reads it: the leaf's tilt (--lx, --lz), the
// binding's wire (--wire) and Echo's drift (--s). A custom property inherits unless declared
// otherwise, so each write restyled everything inside that element as well. Declared
// non-inherited, a write restyles only the element. Each starts from the fallback every var()
// in the CSS gives it, so nothing draws differently. Measured on the home page at 4x CPU
// slowdown, desktop 1440 px, with the change to --c below: long tasks while scrolling 22-47 to
// 1-6, main-thread work 598-724 to 300-342 ms per second of scrolling.
export const SPEED_PROPERTIES: Record<Edition, { name: string; syntax: string; initial: string }[]> = {
  desktop: [
    { name: '--lx', syntax: '<angle>', initial: '0deg' },
    { name: '--lz', syntax: '<length>', initial: '0px' },
    { name: '--wire', syntax: '<number>', initial: '0' },
    { name: '--s', syntax: '<number>', initial: '0' },
  ],
  pocket: [
    { name: '--wire', syntax: '<number>', initial: '0' },
    { name: '--s', syntax: '<number>', initial: '0' },
  ],
};

export const speedCss = (edition: Edition): string => '\n/* speed (allowed change 4): set on every frame of a scroll and read only where set */\n'
  + SPEED_PROPERTIES[edition].map((p) => `@property ${p.name}{syntax:"${p.syntax}"; inherits:false; initial-value:${p.initial}}\n`).join('');

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

// The home page's sections (step 5): the lines that open and close each one's function, and the
// scroll effects' lines that move the home page's parts.
const FIND = '  var $=function(id){return scope.querySelector("#"+id);};\n';
const FIND_ALL = '  var $=function(id){return scope.querySelector("#"+id);}, all=function(s,c){return Array.prototype.slice.call((c||scope).querySelectorAll(s));};\n';
const opens = (name: string, key: string, find = FIND) => `  function ${name}(scope){\n${find}  if(!$("${key}"))return;\n`;
const closes = (name: string) => `  }\n  ${name}(document); window.addEventListener("st:placed",function(e){${name}(e.detail);});\n`;
const ECHO = { desktop: '  /* ---- Echo: one more episode ---- */\n', pocket: '  /* Echo */\n' };
const ECHO_END = '  echoBtn.addEventListener("animationend",function(){echoBtn.classList.remove("go");});\n';
const DECK = '    var d=deck.getBoundingClientRect();\n    deck.style.setProperty("--pd",ease(clamp((vh-d.top)/(vh*0.42))).toFixed(3));\n'
  + '    var cr=cover.getBoundingClientRect();\n    echo.style.setProperty("--s",clamp(-cr.top/Math.max(1,cr.height)).toFixed(3));\n';
const COVER = '      var cr=cover.getBoundingClientRect(); echoWrap.style.setProperty("--s",clamp(-cr.top/Math.max(1,cr.height)).toFixed(3));\n';

// Speed (CLAUDE.md, allowed change 4, step 5): each leaf's --c, which drifts its tape, rings,
// notes and other parts as it crosses the screen, is written onto those parts, the only ones
// that read it, instead of the whole leaf, so a scroll restyles them rather than everything on
// the leaf. The parts are the classes the edition's CSS reads var(--c) on (port.spec.ts checks
// the list against the CSS). The leaf keeps --p, which it reads itself.
export const C_READERS: Record<Edition, string> = {
  desktop: '.washi,.ring,.ribbon,.clipart,.pencil,.note,.scrapwrap,.pad,.plot',
  pocket: '.washi',
};
const RUN = '  function run(){\n    queued=false;\n';
const putC = (edition: Edition) => '  /* speed (allowed change 4): a leaf\'s --c goes onto the parts that read it */\n'
  + '  var readsC=new WeakMap();\n'
  + '  function putC(leaf,v){\n'
  + '    var parts=readsC.get(leaf);\n'
  + `    if(!parts){parts=leaf.querySelectorAll("${C_READERS[edition]}"); readsC.set(leaf,parts);}\n`
  + '    for(var k=0;k<parts.length;k++)parts[k].style.setProperty("--c",v);\n'
  + '  }\n';
const SPEED_WHY = 'allowed change 4: each leaf\'s --c goes onto the parts that read it, so a scroll restyles only them';

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
  // Step 4 (your decision): the design's scripts find each page's parts once, when the file
  // loads, so a page a turn places would be missed. Each section that finds a page's parts
  // becomes a function, run for the whole file at load and again, looking only inside it, for
  // each page placed ("st:placed", from router.js); the scroll effects find their leaves again.
  // The code inside each section stays as written.
  ...[
    ['  window.addEventListener("resize",function(){rings();onScroll();},{passive:true});\n  frame();\n',
      '  window.addEventListener("resize",function(){rings();onScroll();},{passive:true});\n  frame();\n  window.addEventListener("st:placed",function(){leaves=Array.prototype.slice.call(document.querySelectorAll("[data-leaf]"));frame();});\n'],
    ['    var tilts=Array.prototype.slice.call(document.querySelectorAll("[data-tilt]"));\n',
      '    function tiltParts(scope){\n    var tilts=Array.prototype.slice.call(scope.querySelectorAll("[data-tilt]"));\n'],
    ['    var wrap=document.getElementById("echoWrap");\n',
      '    }\n    tiltParts(document); window.addEventListener("st:placed",function(e){tiltParts(e.detail);});\n    var wrap=document.getElementById("echoWrap");\n'],
    ['  all("[data-drag]").forEach(function(el){\n',
      '  function dragParts(scope){\n  all("[data-drag]",scope).forEach(function(el){\n'],
    ['  });\n\n  /* ---- Echo: one more episode ---- */\n',
      '  });\n  }\n  dragParts(document); window.addEventListener("st:placed",function(e){dragParts(e.detail);});\n\n  /* ---- Echo: one more episode ---- */\n'],
    ['  all(".flipcard").forEach(function(card){\n',
      '  function cardParts(scope){\n  all(".flipcard",scope).forEach(function(card){\n'],
    ['  });\n\n  /* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */\n',
      '  });\n  }\n  cardParts(document); window.addEventListener("st:placed",function(e){cardParts(e.detail);});\n\n  /* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */\n'],
    ['  Array.prototype.forEach.call(document.querySelectorAll(".swatches .sw"),function(s,i){s.style.setProperty("--i",String(i+1));});\n',
      '  function swatchParts(scope){\n  Array.prototype.forEach.call(scope.querySelectorAll(".swatches .sw"),function(s,i){s.style.setProperty("--i",String(i+1));});\n  }\n  swatchParts(document); window.addEventListener("st:placed",function(e){swatchParts(e.detail);});\n'],
    ['  run();\n  if(stamp&&window.IntersectionObserver){\n',
      '  run();\n  window.addEventListener("st:placed",function(){leaves=Array.prototype.slice.call(document.querySelectorAll("[data-leaf]"));run();});\n  function stampParts(stamp){\n  if(stamp&&window.IntersectionObserver){\n'],
    ['    });},{threshold:0.9}).observe(stamp);\n  }\n})();\n',
      '    });},{threshold:0.9}).observe(stamp);\n  }\n  }\n  stampParts(stamp); window.addEventListener("st:placed",function(e){stampParts(e.detail.querySelector(".stamp"));});\n})();\n'],
    // Each folder's drawer is found in the folder's own page, as the home page's parts are
    // (step 5), so a page turned back in while its old copy is still turning out opens its own.
    ['  Array.prototype.forEach.call(document.querySelectorAll(".folder"),function(f){\n    var d=document.getElementById(f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");\n',
      '  function folderParts(scope){\n  Array.prototype.forEach.call(scope.querySelectorAll(".folder"),function(f){\n    var d=scope.querySelector("#"+f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");\n'],
    ['      if(open){requestAnimationFrame(function(){d.scrollIntoView({behavior:"smooth",block:"nearest"});});}\n    });\n  });\n',
      '      if(open){requestAnimationFrame(function(){d.scrollIntoView({behavior:"smooth",block:"nearest"});});}\n    });\n  });\n  }\n  folderParts(document); window.addEventListener("st:placed",function(e){folderParts(e.detail);});\n'],
  ].map(([from, to]): Change => ({ script: 'desktop', from, to, times: 1, why: 'pages a turn places get their parts too (your decision, step 4)' })),
  ...[
    ['  themeBtns.forEach(function(b){b.addEventListener("click",function(){var n=isDark()?"light":"dark"; root.setAttribute("data-theme",n); save("st-theme",n); themePaint();});});\n',
      '  function themeParts(themeBtns){\n  themeBtns.forEach(function(b){b.addEventListener("click",function(){var n=isDark()?"light":"dark"; root.setAttribute("data-theme",n); save("st-theme",n); themePaint();});});\n  }\n  themeParts(themeBtns); window.addEventListener("st:placed",function(e){themeBtns=all("[data-theme-toggle]"); themeParts(all("[data-theme-toggle]",e.detail)); themePaint();});\n'],
    ['  window.addEventListener("scroll",ask,{passive:true}); window.addEventListener("resize",ask,{passive:true}); run();\n',
      '  window.addEventListener("scroll",ask,{passive:true}); window.addEventListener("resize",ask,{passive:true}); run();\n  window.addEventListener("st:placed",function(){leaves=all("[data-leaf]");run();});\n'],
    ['  cards.forEach(function(card){\n',
      '  function cardParts(cards){\n  cards.forEach(function(card){\n'],
    ['    });});\n  });\n  rail.addEventListener("scroll",function(){\n',
      '    });});\n  });\n  }\n  cardParts(cards); window.addEventListener("st:placed",function(e){cardParts(all(".flipcard",e.detail.querySelector("#rail")||e.detail));});\n  rail.addEventListener("scroll",function(){\n'],
    ['  all(".folder").forEach(function(f){var d=$(f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");\n',
      '  function folderParts(scope){\n  all(".folder",scope).forEach(function(f){var d=scope.querySelector("#"+f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");\n'],
    ['      d.hidden=!open; hint.textContent=open?"Close":"Open";});});\n',
      '      d.hidden=!open; hint.textContent=open?"Close":"Open";});});\n  }\n  folderParts(document); window.addEventListener("st:placed",function(e){folderParts(e.detail);});\n'],
  ].map(([from, to]): Change => ({ script: 'pocket', from, to, times: 1, why: 'pages a turn places get their parts too (your decision, step 4)' })),
  // Step 5: the home page's sections come back the same way. Each section that finds the
  // page's parts by id becomes a function with its own $ (and all) that look only inside one
  // page, so a page turned back in while the old copy is still turning out gets its own parts.
  // It runs for the whole file at load and again for each page placed, and does nothing in a
  // page without its parts. The two parts the scroll effects move (the desktop deck, and Echo
  // as the cover scrolls away) are moved only while a home page is there, and found again in
  // each home page placed.
  ...[
    [ECHO.desktop, `${ECHO.desktop}${opens('echoParts', 'echoBtn')}`],
    [ECHO_END, `${ECHO_END}${closes('echoParts')}`],
    ['  /* ---- the pad: four pages, turned over the top ---- */\n', `  /* ---- the pad: four pages, turned over the top ---- */\n${opens('padParts', 'pad', FIND_ALL)}`],
    ['  padPaint();\n\n  /* ---- track cards turn over ---- */\n', `  padPaint();\n${closes('padParts')}\n  /* ---- track cards turn over ---- */\n`],
    ['  /* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */\n', `  /* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */\n${opens('handParts', 'gd')}`],
    ['  size();\n\n  /* ---- the log: filter by track, stamp what you want to watch ---- */\n', `  size();\n${closes('handParts')}\n  /* ---- the log: filter by track, stamp what you want to watch ---- */\n`],
    ['    var echoes=[document.getElementById("echoLt"),document.getElementById("echoDk")];\n',
      '    var echoes=[document.getElementById("echoLt"),document.getElementById("echoDk")];\n    function echoTiltParts(wrap,echoes){\n    if(!wrap)return;\n'],
    ['    wrap.addEventListener("pointerleave",function(){\n      echoes.forEach(function(im){im.style.setProperty("--ey","0deg");im.style.setProperty("--ex","0deg");});\n    });\n',
      '    wrap.addEventListener("pointerleave",function(){\n      echoes.forEach(function(im){im.style.setProperty("--ey","0deg");im.style.setProperty("--ex","0deg");});\n    });\n    }\n    echoTiltParts(wrap,echoes); window.addEventListener("st:placed",function(e){echoTiltParts(e.detail.querySelector("#echoWrap"),[e.detail.querySelector("#echoLt"),e.detail.querySelector("#echoDk")]);});\n'],
    [DECK, `    if(deck){\n${DECK}    }\n`],
    ['  function ask(){ if(!queued){queued=true;requestAnimationFrame(run);} }\n',
      '  window.addEventListener("st:placed",function(e){var d=e.detail.querySelector("#deck"); if(d){deck=d; cover=e.detail.querySelector("#cover"); echo=e.detail.querySelector("#echoWrap");}});\n  function ask(){ if(!queued){queued=true;requestAnimationFrame(run);} }\n'],
  ].map(([from, to]): Change => ({ script: 'desktop', from, to, times: 1, why: 'the home page\'s parts are found in each page that has them (step 5, as decided for pages in step 4)' })),
  ...[
    [ECHO.pocket, `${ECHO.pocket}${opens('echoParts', 'echoBtn')}`],
    [ECHO_END, `${ECHO_END}${closes('echoParts')}`],
    ['  /* pad */\n', `  /* pad */\n${opens('padParts', 'pad', FIND_ALL)}`],
    ['  padPaint();\n\n  /* loose note */\n', `  padPaint();\n${closes('padParts')}\n  /* loose note */\n`],
    ['  /* loose note */\n', `  /* loose note */\n${opens('noteParts', 'note')}`],
    ['  })($("note"));\n', `  })($("note"));\n${closes('noteParts')}`],
    ['  rail.addEventListener("scroll",function(){\n', '  function railParts(rail,cards,dots){\n  if(!rail)return;\n  rail.addEventListener("scroll",function(){\n'],
    ['    dots.forEach(function(d,i){d.classList.toggle("on",i===best);});\n  },{passive:true});\n',
      '    dots.forEach(function(d,i){d.classList.toggle("on",i===best);});\n  },{passive:true});\n  }\n  railParts(rail,cards,dots); window.addEventListener("st:placed",function(e){var r=e.detail.querySelector("#rail"); if(r)railParts(r,all(".flipcard",r),all("#dots i",e.detail));});\n'],
    ['  /* by hand: loss = (weight - 3) squared */\n', `  /* by hand: loss = (weight - 3) squared */\n${opens('handParts', 'gd')}`],
    ['  size();\n\n  /* log */\n', `  size();\n${closes('handParts')}\n  /* log */\n`],
    [COVER, `      if(cover){\n${COVER}      }\n`],
    ['  function ask(){if(!queued){queued=true;requestAnimationFrame(run);}}\n',
      '  window.addEventListener("st:placed",function(e){var c=e.detail.querySelector("#cover"); if(c){cover=c; echoWrap=e.detail.querySelector("#echoWrap");}});\n  function ask(){if(!queued){queued=true;requestAnimationFrame(run);}}\n'],
  ].map(([from, to]): Change => ({ script: 'pocket', from, to, times: 1, why: 'the home page\'s parts are found in each page that has them (step 5, as decided for pages in step 4)' })),
  { script: 'desktop', from: RUN, to: `${putC('desktop')}${RUN}`, times: 1, why: SPEED_WHY },
  { script: 'desktop', from: 'el.style.setProperty("--c",c.toFixed(3));', to: 'putC(el,c.toFixed(3));', times: 1, why: SPEED_WHY },
  { script: 'pocket', from: RUN, to: `${putC('pocket')}${RUN}`, times: 1, why: SPEED_WHY },
  { script: 'pocket', from: 'el.style.setProperty("--c",(c<-1?-1:c>1?1:c).toFixed(3));', to: 'putC(el,(c<-1?-1:c>1?1:c).toFixed(3));', times: 1, why: SPEED_WHY },
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
  { script: 'desktop', needs: 'subscribe', section: '/* ---- the tear ---- */' },
  { script: 'desktop', needs: 'subscribe', section: '/* ---- the slip itself ---- */' },
  { script: 'desktop', needs: 'episodes', section: '/* ---- the log: filter by track, stamp what you want to watch ---- */' },
  { script: 'desktop', needs: 'subscribe', section: '/* ---- tape the slip back on ---- */' },
  { script: 'pocket', needs: 'about', from: 'var stamp=$("stamp");', lines: 3 },
  { script: 'pocket', needs: 'episodes', section: '/* log */' },
  { script: 'pocket', needs: 'subscribe', section: '/* the slip: pull down, or press, to tear */' },
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
