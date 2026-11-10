/* The desktop edition's scripts from design-reference/desktop.html, in the design's order,
   run only from 900 px wide. They differ from the design only as tests/visual/port.ts lists:
   the allowed changes (among them the speed change: each leaf's --c written onto the parts
   that read it), the paper choice saved in pocket's format, each page's parts found again in
   every page a turn places (router.js), and lines left out until the page they need
   arrives. */
if(window.matchMedia("(min-width:900px)").matches){
(function(){
  "use strict";
  var root=document.documentElement;
  var reduce=false;

  /* ---- theme ---- */
  var btn=document.getElementById("themeBtn");
  function isDark(){
    var a=root.getAttribute("data-theme");
    if(a==="dark")return true; if(a==="light")return false;
    return !!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function paint(){
    var d=isDark();
    btn.textContent=d?"Light paper":"Dark paper";
    btn.setAttribute("aria-pressed",d?"true":"false");
  }
  try{var s=JSON.parse(localStorage.getItem("st-theme")); if(s==="dark"||s==="light")root.setAttribute("data-theme",s);}catch(e){}
  paint();
  btn.addEventListener("click",function(){
    var next=isDark()?"light":"dark";
    root.setAttribute("data-theme",next);
    try{localStorage.setItem("st-theme",JSON.stringify(next));}catch(e){}
    paint();
  });
  if(window.matchMedia){try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",paint);}catch(e){}}

  /* ---- wire binding ---- */
  var bind=document.getElementById("bind");
  function rings(){
    var n=Math.ceil(window.innerHeight/34)+3, h="";
    for(var i=0;i<n;i++)h+='<span style="top:'+(i*34-24)+'px"></span>';
    bind.innerHTML=h;
  }
  rings();

  /* ---- jump links and index tabs ---- */
  var ids=["cover","premise","tracks","byhand","log","files","tearoff","colophon"];
  document.addEventListener("click",function(e){
    var t=e.target.closest("[data-go]"); if(!t)return;
    var el=document.getElementById(t.getAttribute("data-go")); if(!el)return;
    e.preventDefault();
    el.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
  });
  var tabs=Array.prototype.slice.call(document.querySelectorAll(".tab"));

  /* ---- 3D: leaves lift as they reach reading height, cards and Echo follow the pointer ---- */
  var leaves=Array.prototype.slice.call(document.querySelectorAll("[data-leaf]"));
  var queued=false;
  function frame(){
    queued=false;
    var mid=window.innerHeight/2, near=1e9, cur=0;
    for(var i=0;i<leaves.length;i++){
      var el=leaves[i], r=el.getBoundingClientRect();
      var d=(r.top+r.height/2-mid)/window.innerHeight;
      if(d<-1.3||d>1.3){el.style.setProperty("--lx","0deg");el.style.setProperty("--lz","0px");continue;}
      var c=Math.max(-1,Math.min(1,d));
      el.style.setProperty("--lx",(c*7.5).toFixed(2)+"deg");
      el.style.setProperty("--lz",(-Math.abs(c)*64).toFixed(1)+"px");
      var ad=Math.abs(r.top-mid*0.55);
      if(ad<near){near=ad;cur=i;}
    }
  }
  function onScroll(){ if(!queued){queued=true;requestAnimationFrame(frame);} }
  if(!reduce){window.addEventListener("scroll",onScroll,{passive:true});}
  window.addEventListener("resize",function(){rings();onScroll();},{passive:true});
  frame();
  window.addEventListener("st:placed",function(){leaves=Array.prototype.slice.call(document.querySelectorAll("[data-leaf]"));frame();});

  if(!reduce){
    function tiltParts(scope){
    var tilts=Array.prototype.slice.call(scope.querySelectorAll("[data-tilt]"));
    tilts.forEach(function(card){
      card.addEventListener("pointermove",function(ev){
        var r=card.getBoundingClientRect();
        var x=(ev.clientX-r.left)/r.width-0.5, y=(ev.clientY-r.top)/r.height-0.5;
        card.style.transform="translate3d(0,0,34px) rotateY("+(x*13).toFixed(2)+"deg) rotateX("+(-y*13).toFixed(2)+"deg)";
      });
      card.addEventListener("pointerleave",function(){card.style.transform="translate3d(0,0,0)";});
    });
    }
    tiltParts(document); window.addEventListener("st:placed",function(e){tiltParts(e.detail);});
    var wrap=document.getElementById("echoWrap");
    var echoes=[document.getElementById("echoLt"),document.getElementById("echoDk")];
    function echoTiltParts(wrap,echoes){
    if(!wrap)return;
    wrap.addEventListener("pointermove",function(ev){
      var r=wrap.getBoundingClientRect();
      var x=(ev.clientX-r.left)/r.width-0.5, y=(ev.clientY-r.top)/r.height-0.5;
      echoes.forEach(function(im){
        im.style.setProperty("--ey",(x*26).toFixed(2)+"deg");
        im.style.setProperty("--ex",(-y*18).toFixed(2)+"deg");
      });
    });
    wrap.addEventListener("pointerleave",function(){
      echoes.forEach(function(im){im.style.setProperty("--ey","0deg");im.style.setProperty("--ex","0deg");});
    });
    }
    echoTiltParts(wrap,echoes); window.addEventListener("st:placed",function(e){echoTiltParts(e.detail.querySelector("#echoWrap"),[e.detail.querySelector("#echoLt"),e.detail.querySelector("#echoDk")]);});
  }

})();

(function(){
  "use strict";
  var root=document.documentElement;
  var reduce=false;
  function $(id){return document.getElementById(id);}
  function all(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));}
  function load(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

  /* ---- loose things: drag with a pointer, nudge with arrow keys, double-click to put back ---- */
  function dragParts(scope){
  all("[data-drag]",scope).forEach(function(el){
    var x=0,y=0,sx=0,sy=0,on=false;
    function put(){el.style.setProperty("--dx",x+"px");el.style.setProperty("--dy",y+"px");}
    el.addEventListener("pointerdown",function(e){
      on=true;sx=e.clientX-x;sy=e.clientY-y;el.classList.add("held");
      try{el.setPointerCapture(e.pointerId);}catch(_){}
    });
    el.addEventListener("pointermove",function(e){ if(!on)return; x=e.clientX-sx;y=e.clientY-sy;put(); });
    function drop(){on=false;el.classList.remove("held");}
    el.addEventListener("pointerup",drop); el.addEventListener("pointercancel",drop);
    el.addEventListener("dblclick",function(){x=0;y=0;put();});
    el.addEventListener("keydown",function(e){
      var d={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];
      if(d){e.preventDefault();x+=d[0];y+=d[1];put();}
      else if(e.key==="Escape"){x=0;y=0;put();}
    });
  });
  }
  dragParts(document); window.addEventListener("st:placed",function(e){dragParts(e.detail);});

  /* ---- Echo: one more episode ---- */
  function echoParts(scope){
  var $=function(id){return scope.querySelector("#"+id);};
  if(!$("echoBtn"))return;
  var echoBtn=$("echoBtn"), ep=$("epCount"), epN=load("st-ep",1);
  function epPaint(){ep.textContent="Episode "+("00"+epN).slice(-3);}
  epPaint();
  echoBtn.addEventListener("click",function(){
    epN=epN>=999?1:epN+1; save("st-ep",epN); epPaint();
    if(reduce)return;
    echoBtn.classList.remove("go"); void echoBtn.offsetWidth; echoBtn.classList.add("go");
  });
  echoBtn.addEventListener("animationend",function(){echoBtn.classList.remove("go");});
  }
  echoParts(document); window.addEventListener("st:placed",function(e){echoParts(e.detail);});

  /* ---- the pad: four pages, turned over the top ---- */
  function padParts(scope){
  var $=function(id){return scope.querySelector("#"+id);}, all=function(s,c){return Array.prototype.slice.call((c||scope).querySelectorAll(s));};
  if(!$("pad"))return;
  var pages=all("#pad .pg"), at=0, pgBack=$("pgBack"), pgNext=$("pgNext"), pgNum=$("pgNum");
  pages.forEach(function(p,i){p.style.zIndex=String(pages.length-i);});
  function padPaint(){
    pages.forEach(function(p,i){
      p.classList.toggle("turned",i<at);
      if(i===at)p.removeAttribute("inert"); else p.setAttribute("inert","");
    });
    pgBack.disabled=at===0; pgNext.disabled=at===pages.length-1;
    pgNum.textContent="Page "+(at+1)+" of "+pages.length;
  }
  pgNext.addEventListener("click",function(){ if(at<pages.length-1){at++;padPaint();} });
  pgBack.addEventListener("click",function(){ if(at>0){at--;padPaint();} });
  padPaint();
  }
  padParts(document); window.addEventListener("st:placed",function(e){padParts(e.detail);});

  /* ---- track cards turn over ---- */
  function cardParts(scope){
  all(".flipcard",scope).forEach(function(card){
    var front=card.querySelector(".front"), back=card.querySelector(".back");
    back.setAttribute("inert","");
    all("[data-flip]",card).forEach(function(b){
      b.addEventListener("click",function(){
        var f=card.classList.toggle("flipped");
        if(f){front.setAttribute("inert","");back.removeAttribute("inert");}
        else{back.setAttribute("inert","");front.removeAttribute("inert");}
        var t=(f?back:front).querySelector("[data-flip]"); if(t)t.focus({preventScroll:true});
      });
    });
  });
  }
  cardParts(document); window.addEventListener("st:placed",function(e){cardParts(e.detail);});

  /* ---- by hand: gradient descent on loss = (weight - 3) squared ---- */
  function handParts(scope){
  var $=function(id){return scope.querySelector("#"+id);};
  if(!$("gd"))return;
  var cv=$("gd"), ctx=cv.getContext("2d"), lr=$("lr"), lrOut=$("lrOut"),
      stepBtn=$("stepBtn"), resetBtn=$("resetBtn"), say=$("gdSay"), body=$("gdBody");
  var LO=-2, HI=8, TOP=27, BEST=3, START=7.5;
  var w=START, shown=START, trail=[], rows=[], n=0, W=0, H=0, raf=0, dragging=false;
  var EMPTY=body.innerHTML;
  function loss(v){return (v-BEST)*(v-BEST);}
  function slope(v){return 2*(v-BEST);}
  function px(v){return 18+(v-LO)/(HI-LO)*(W-36);}
  function py(l){return H-34-(Math.min(l,TOP)/TOP)*(H-34-16);}
  function tok(name){return getComputedStyle(root).getPropertyValue(name).trim();}
  function f2(v){return (Math.abs(v)<0.005?0:v).toFixed(2);}
  function size(){
    var r=cv.getBoundingClientRect(), d=Math.min(window.devicePixelRatio||1,2);
    W=Math.max(200,cv.clientWidth||r.width); H=cv.clientHeight||300;
    cv.width=Math.round(W*d); cv.height=Math.round(H*d); ctx.setTransform(d,0,0,d,0,0); draw();
  }
  function draw(){
    var ink=tok("--ink"), faint=tok("--ink-3"), acc=tok("--accent"), soft=tok("--accent-soft"), leaf=tok("--leaf");
    ctx.clearRect(0,0,W,H);
    ctx.font='11px "IBM Plex Mono", ui-monospace, monospace'; ctx.fillStyle=faint; ctx.textBaseline="alphabetic";
    // floor and labels
    ctx.strokeStyle=faint; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(18,py(0)); ctx.lineTo(W-18,py(0)); ctx.stroke();
    ctx.textAlign="right"; ctx.fillText("value of the weight →",W-18,H-10);
    ctx.textAlign="left"; ctx.fillText("↑ how wrong",18,14);
    for(var t=LO;t<=HI;t+=2){ctx.textAlign="center";ctx.fillText(String(t),px(t),py(0)+16);}
    // lowest point
    ctx.setLineDash([4,5]); ctx.beginPath(); ctx.moveTo(px(BEST),py(0)); ctx.lineTo(px(BEST),py(TOP*0.3)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign="center"; ctx.fillText("lowest point",px(BEST),py(TOP*0.3)-6);
    // the curve
    ctx.strokeStyle=ink; ctx.lineWidth=3; ctx.lineJoin="round"; ctx.beginPath();
    for(var i=0;i<=120;i++){var v=LO+(HI-LO)*i/120; if(i)ctx.lineTo(px(v),py(loss(v))); else ctx.moveTo(px(v),py(loss(v)));}
    ctx.stroke();
    // where it has been
    var m=trail.length;
    for(var k=0;k<m;k++){
      var a=trail[k], b=k+1<m?trail[k+1]:shown;
      ctx.globalAlpha=0.25+0.6*(k+1)/m; ctx.strokeStyle=soft; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(px(a),py(loss(a))); ctx.lineTo(px(Math.max(LO,Math.min(HI,b))),py(loss(b))); ctx.stroke();
      ctx.fillStyle=soft; ctx.beginPath(); ctx.arc(px(a),py(loss(a)),4.5,0,6.283); ctx.fill();
    }
    ctx.globalAlpha=1;
    var off=shown<LO||shown>HI, cx=px(Math.max(LO,Math.min(HI,shown))), cy=py(loss(shown));
    if(!off){ // the slope under the dot
      var s=slope(shown), dx=0.9;
      ctx.strokeStyle=acc; ctx.lineWidth=2; ctx.setLineDash([7,5]); ctx.beginPath();
      ctx.moveTo(px(shown-dx),py(loss(shown)-s*dx)); ctx.lineTo(px(shown+dx),py(loss(shown)+s*dx)); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle=acc; ctx.strokeStyle=ink; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(cx,cy,off?8:12,0,6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle=leaf; ctx.beginPath(); ctx.arc(cx-3.5,cy-3.5,2.6,0,6.283); ctx.fill();
    if(off){ctx.fillStyle=ink; ctx.textAlign=shown<LO?"left":"right"; ctx.fillText(shown<LO?"← off the page":"off the page →",shown<LO?cx+14:cx-14,cy+18);}
  }
  function glide(to){
    cancelAnimationFrame(raf);
    if(reduce){shown=to;draw();return;}
    var from=shown, t0=performance.now();
    (function tick(now){
      var t=Math.min(1,(now-t0)/380), e=1-Math.pow(1-t,3);
      shown=from+(to-from)*e; draw();
      if(t<1)raf=requestAnimationFrame(tick);
    })(t0);
  }
  function table(){
    if(!rows.length){body.innerHTML=EMPTY;return;}
    body.innerHTML=rows.slice(-6).map(function(r){
      return "<tr><td>"+r.n+"</td><td>"+f2(r.a)+"</td><td>"+f2(r.s)+"</td><td>"+f2(r.d)+"</td><td>"+f2(r.b)+"</td><td>"+f2(loss(r.b))+"</td></tr>";
    }).join("");
  }
  function reset(to,msg){
    cancelAnimationFrame(raf); w=shown=to; trail=[]; rows=[]; n=0; stepBtn.disabled=false; table();
    say.textContent=msg||("The dot starts at weight "+f2(to)+". Each step moves it against the slope."); draw();
  }
  function rate(){return Math.round(parseFloat(lr.value)*100)/100;}
  lr.addEventListener("input",function(){lrOut.textContent=rate().toFixed(2);});
  stepBtn.addEventListener("click",function(){
    var a=w, s=slope(a), d=rate()*s, b=a-d; n++;
    rows.push({n:n,a:a,s:s,d:d,b:b}); trail.push(a); if(trail.length>14)trail.shift();
    w=b; table(); glide(b);
    var da=Math.abs(a-BEST), db=Math.abs(b-BEST), m;
    if(b<LO||b>HI){m="Off the page. Each step is landing further out than the last. Start over with a smaller step size."; stepBtn.disabled=true;}
    else if(db<0.01){m="Settled at the bottom after "+n+(n===1?" step.":" steps."); }
    else if(Math.abs(db-da)<1e-6){m="Same distance, other side. At this step size it bounces between two points forever.";}
    else if(db>da){m="That step landed further from the bottom than it started. The step size is too big.";}
    else if((a-BEST)*(b-BEST)<0){m="Overshot the bottom but ended closer. It will settle, zig-zagging.";}
    else{m="Closer. The curve is flatter here, so the next step will be smaller.";}
    say.textContent=m;
  });
  resetBtn.addEventListener("click",function(){reset(START);});
  function fromPointer(e){
    var r=cv.getBoundingClientRect(), v=LO+((e.clientX-r.left)/r.width*W-18)/(W-36)*(HI-LO);
    return Math.max(LO+0.2,Math.min(HI-0.2,v));
  }
  cv.addEventListener("pointerdown",function(e){dragging=true;try{cv.setPointerCapture(e.pointerId);}catch(_){ } reset(fromPointer(e));});
  cv.addEventListener("pointermove",function(e){if(dragging)reset(fromPointer(e));});
  function up(){dragging=false;}
  cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  if(window.ResizeObserver){new ResizeObserver(size).observe(cv);} else {window.addEventListener("resize",size);}
  new MutationObserver(draw).observe(root,{attributes:true,attributeFilter:["data-theme"]});
  if(window.matchMedia){try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",draw);}catch(e){}}
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(draw);}
  size();
  }
  handParts(document); window.addEventListener("st:placed",function(e){handParts(e.detail);});

  /* ---- number keys jump between entries ---- */
  var ids=["cover","premise","tracks","byhand","log","files","tearoff","colophon"];
  document.addEventListener("keydown",function(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    var t=e.target; if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.isContentEditable))return;
    var i=parseInt(e.key,10); if(isNaN(i)||i<0||i>=ids.length||e.key.length!==1)return;
    var R=["home","home","episodes","writing","projects","about","subscribe"]; if(i<R.length&&window.stGo)window.stGo(R[i]);
  });
})();

(function(){
  "use strict";
  var root=document.documentElement;
  var leaves=Array.prototype.slice.call(document.querySelectorAll("[data-leaf]"));
  var frame=document.querySelector(".frame");
  var deck=document.getElementById("deck"), cover=document.getElementById("cover"),
      echo=document.getElementById("echoWrap"), bind=document.getElementById("bind"),
      stamp=document.querySelector(".stamp");
  function swatchParts(scope){
  Array.prototype.forEach.call(scope.querySelectorAll(".swatches .sw"),function(s,i){s.style.setProperty("--i",String(i+1));});
  }
  swatchParts(document); window.addEventListener("st:placed",function(e){swatchParts(e.detail);});
  function clamp(v){return v<0?0:v>1?1:v;}
  function ease(t){return 1-Math.pow(1-t,3);}
  var queued=false;
  /* speed (allowed change 4): a leaf's --c goes onto the parts that read it */
  var readsC=new WeakMap();
  function putC(leaf,v){
    var parts=readsC.get(leaf);
    if(!parts){parts=leaf.querySelectorAll(".washi,.ring,.ribbon,.clipart,.pencil,.note,.scrapwrap,.pad,.plot"); readsC.set(leaf,parts);}
    for(var k=0;k<parts.length;k++)parts[k].style.setProperty("--c",v);
  }
  function run(){
    queued=false;
    var vh=window.innerHeight, y=window.scrollY||window.pageYOffset||0;
    var max=Math.max(1,document.documentElement.scrollHeight-vh);
    frame.style.setProperty("--sp",clamp(y/max).toFixed(4));
    bind.style.setProperty("--wire",(-((y*0.35)%34)).toFixed(1));
    for(var i=0;i<leaves.length;i++){
      var el=leaves[i], r=el.getBoundingClientRect();
      if(r.bottom<-200||r.top>vh+200){ if(r.top>vh+200)el.style.setProperty("--p","0"); continue; }
      // the first leaf is already on the desk when the page opens
      var p=i===0?1:ease(clamp((vh-r.top)/(vh*0.62)));
      el.style.setProperty("--p",p.toFixed(3));
      var c=(r.top+r.height/2-vh/2)/vh; c=c<-1?-1:c>1?1:c;
      putC(el,c.toFixed(3));
    }
    if(deck){
    var d=deck.getBoundingClientRect();
    deck.style.setProperty("--pd",ease(clamp((vh-d.top)/(vh*0.42))).toFixed(3));
    var cr=cover.getBoundingClientRect();
    echo.style.setProperty("--s",clamp(-cr.top/Math.max(1,cr.height)).toFixed(3));
    }
  }
  window.addEventListener("st:placed",function(e){var d=e.detail.querySelector("#deck"); if(d){deck=d; cover=e.detail.querySelector("#cover"); echo=e.detail.querySelector("#echoWrap");}});
  function ask(){ if(!queued){queued=true;requestAnimationFrame(run);} }
  window.addEventListener("scroll",ask,{passive:true});
  window.addEventListener("resize",ask,{passive:true});
  run();
  window.addEventListener("st:placed",function(){leaves=Array.prototype.slice.call(document.querySelectorAll("[data-leaf]"));run();});
  function stampParts(stamp){
  if(stamp&&window.IntersectionObserver){
    new IntersectionObserver(function(es){es.forEach(function(e){
      if(e.isIntersecting){stamp.classList.remove("inked"); void stamp.offsetWidth; stamp.classList.add("inked");}
    });},{threshold:0.9}).observe(stamp);
  }
  }
  stampParts(stamp); window.addEventListener("st:placed",function(e){stampParts(e.detail.querySelector(".stamp"));});
})();

(function(){
  "use strict";
  function folderParts(scope){
  Array.prototype.forEach.call(scope.querySelectorAll(".folder"),function(f){
    var d=scope.querySelector("#"+f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");
    Array.prototype.forEach.call(d.querySelectorAll(".sheet"),function(s,i){s.style.setProperty("--n",String(i));});
    f.addEventListener("click",function(){
      var open=!f.classList.contains("open");
      f.classList.toggle("open",open); f.setAttribute("aria-expanded",open?"true":"false");
      d.hidden=!open; hint.textContent=open?"Close":"Open";
      if(open){requestAnimationFrame(function(){d.scrollIntoView({behavior:"smooth",block:"nearest"});});}
    });
  });
  }
  folderParts(document); window.addEventListener("st:placed",function(e){folderParts(e.detail);});
})();
}
