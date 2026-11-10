/* The pocket edition's script from design-reference/pocket.html, run only below 900 px
   wide. It differs from the design only as tests/visual/port.ts lists: the allowed changes
   (among them the speed change: each leaf's --c written onto the parts that read it), each
   page's parts found again in every page a turn places (router.js), and lines left out until
   the page they need arrives. */
if(!window.matchMedia("(min-width:900px)").matches){
(function(){
  "use strict";
  var root=document.documentElement;
  var reduce=false;
  function $(id){return document.getElementById(id);}
  function all(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));}
  function load(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
  function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function clamp(v){return v<0?0:v>1?1:v;}
  function ease(t){return 1-Math.pow(1-t,3);}

  /* theme */
  var themeBtns=all("[data-theme-toggle]");
  function isDark(){var a=root.getAttribute("data-theme"); if(a==="dark")return true; if(a==="light")return false;
    return !!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);}
  function themePaint(){var d=isDark(); themeBtns.forEach(function(b){b.textContent=d?"Light paper":"Dark paper"; b.setAttribute("aria-pressed",d?"true":"false");});}
  var st=load("st-theme",null); if(st==="dark"||st==="light")root.setAttribute("data-theme",st);
  themePaint();
  function themeParts(themeBtns){
  themeBtns.forEach(function(b){b.addEventListener("click",function(){var n=isDark()?"light":"dark"; root.setAttribute("data-theme",n); save("st-theme",n); themePaint();});});
  }
  themeParts(themeBtns); window.addEventListener("st:placed",function(e){themeBtns=all("[data-theme-toggle]"); themeParts(all("[data-theme-toggle]",e.detail)); themePaint();});

  /* dock and jump links */
  var dockBtns=all(".dock button"), dockIds=dockBtns.map(function(b){return b.getAttribute("data-go");});
  document.addEventListener("click",function(e){
    var t=e.target.closest("[data-go]"); if(!t)return;
    var el=$(t.getAttribute("data-go")); if(!el)return; e.preventDefault();
    el.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
  });

  /* scroll-linked motion */
  var leaves=all("[data-leaf]"), cover=$("cover"), echoWrap=$("echoWrap"), wire=$("wire"), queued=false;
  var frame=document.querySelector(".frame");
  /* speed (allowed change 4): a leaf's --c goes onto the parts that read it */
  var readsC=new WeakMap();
  function putC(leaf,v){
    var parts=readsC.get(leaf);
    if(!parts){parts=leaf.querySelectorAll(".washi"); readsC.set(leaf,parts);}
    for(var k=0;k<parts.length;k++)parts[k].style.setProperty("--c",v);
  }
  function run(){
    queued=false;
    var vh=window.innerHeight, y=window.scrollY||0, max=Math.max(1,root.scrollHeight-vh);
    frame.style.setProperty("--sp",clamp(y/max).toFixed(4));
    var cur=dockIds[0];
    for(var i=0;i<leaves.length;i++){
      var el=leaves[i], r=el.getBoundingClientRect();
      if(r.top<vh*0.45&&dockIds.indexOf(el.id)>=0)cur=el.id;
      if(reduce)continue;
      if(r.top>vh+200){el.style.setProperty("--p","0");continue;}
      if(r.bottom<-200)continue;
      el.style.setProperty("--p",(i===0?1:ease(clamp((vh-r.top)/(vh*0.5)))).toFixed(3));
      var c=(r.top+r.height/2-vh/2)/vh; putC(el,(c<-1?-1:c>1?1:c).toFixed(3));
    }
    if(!reduce){
      wire.style.setProperty("--wire",(-((y*0.3)%32)).toFixed(1));
      if(cover){
      var cr=cover.getBoundingClientRect(); echoWrap.style.setProperty("--s",clamp(-cr.top/Math.max(1,cr.height)).toFixed(3));
      }
    }
  }
  window.addEventListener("st:placed",function(e){var c=e.detail.querySelector("#cover"); if(c){cover=c; echoWrap=e.detail.querySelector("#echoWrap");}});
  function ask(){if(!queued){queued=true;requestAnimationFrame(run);}}
  window.addEventListener("scroll",ask,{passive:true}); window.addEventListener("resize",ask,{passive:true}); run();
  window.addEventListener("st:placed",function(){leaves=all("[data-leaf]");run();});

  /* Echo */
  function echoParts(scope){
  var $=function(id){return scope.querySelector("#"+id);};
  if(!$("echoBtn"))return;
  var echoBtn=$("echoBtn"), ep=$("epCount"), epN=load("st-ep",1); if(typeof epN!=="number")epN=1;
  function epPaint(){ep.textContent="Episode "+("00"+epN).slice(-3);} epPaint();
  echoBtn.addEventListener("click",function(){epN=epN>=999?1:epN+1; save("st-ep",epN); epPaint();
    if(reduce)return; echoBtn.classList.remove("go"); void echoBtn.offsetWidth; echoBtn.classList.add("go");});
  echoBtn.addEventListener("animationend",function(){echoBtn.classList.remove("go");});
  }
  echoParts(document); window.addEventListener("st:placed",function(e){echoParts(e.detail);});

  /* pad */
  function padParts(scope){
  var $=function(id){return scope.querySelector("#"+id);}, all=function(s,c){return Array.prototype.slice.call((c||scope).querySelectorAll(s));};
  if(!$("pad"))return;
  var pages=all("#pad .pg"), at=0, pgBack=$("pgBack"), pgNext=$("pgNext"), pgNum=$("pgNum");
  pages.forEach(function(p,i){p.style.zIndex=String(pages.length-i);});
  function padPaint(){pages.forEach(function(p,i){p.classList.toggle("turned",i<at); if(i===at)p.removeAttribute("inert"); else p.setAttribute("inert","");});
    pgBack.disabled=at===0; pgNext.disabled=at===pages.length-1; pgNum.textContent="Page "+(at+1)+" of "+pages.length;}
  pgNext.addEventListener("click",function(){if(at<pages.length-1){at++;padPaint();}});
  pgBack.addEventListener("click",function(){if(at>0){at--;padPaint();}});
  padPaint();
  }
  padParts(document); window.addEventListener("st:placed",function(e){padParts(e.detail);});

  /* loose note */
  function noteParts(scope){
  var $=function(id){return scope.querySelector("#"+id);};
  if(!$("note"))return;
  (function(el){var x=0,y=0,sx=0,sy=0,on=false;
    function put(){el.style.setProperty("--dx",x+"px");el.style.setProperty("--dy",y+"px");}
    el.addEventListener("pointerdown",function(e){on=true;sx=e.clientX-x;sy=e.clientY-y;el.classList.add("held");try{el.setPointerCapture(e.pointerId);}catch(_){}});
    el.addEventListener("pointermove",function(e){if(!on)return;x=Math.max(-40,Math.min(160,e.clientX-sx));y=Math.max(-260,Math.min(120,e.clientY-sy));put();});
    function drop(){on=false;el.classList.remove("held");}
    el.addEventListener("pointerup",drop);el.addEventListener("pointercancel",drop);
    el.addEventListener("dblclick",function(){x=0;y=0;put();});
    el.addEventListener("keydown",function(e){var d={ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16]}[e.key];
      if(d){e.preventDefault();x+=d[0];y+=d[1];put();} else if(e.key==="Escape"){x=0;y=0;put();}});
  })($("note"));
  }
  noteParts(document); window.addEventListener("st:placed",function(e){noteParts(e.detail);});

  /* track cards */
  var rail=$("rail"), cards=all(".flipcard",rail), dots=all("#dots i");
  function cardParts(cards){
  cards.forEach(function(card){
    var front=card.querySelector(".front"), back=card.querySelector(".back"); back.setAttribute("inert","");
    all("[data-flip]",card).forEach(function(b){b.addEventListener("click",function(){
      var f=card.classList.toggle("flipped");
      if(f){front.setAttribute("inert","");back.removeAttribute("inert");} else {back.setAttribute("inert","");front.removeAttribute("inert");}
    });});
  });
  }
  cardParts(cards); window.addEventListener("st:placed",function(e){cardParts(all(".flipcard",e.detail.querySelector("#rail")||e.detail));});
  function railParts(rail,cards,dots){
  if(!rail)return;
  rail.addEventListener("scroll",function(){
    var mid=rail.getBoundingClientRect().left+rail.clientWidth/2, best=0, bd=1e9;
    cards.forEach(function(c,i){var r=c.getBoundingClientRect(), d=Math.abs(r.left+r.width/2-mid); if(d<bd){bd=d;best=i;}});
    dots.forEach(function(d,i){d.classList.toggle("on",i===best);});
  },{passive:true});
  }
  railParts(rail,cards,dots); window.addEventListener("st:placed",function(e){var r=e.detail.querySelector("#rail"); if(r)railParts(r,all(".flipcard",r),all("#dots i",e.detail));});

  /* by hand: loss = (weight - 3) squared */
  function handParts(scope){
  var $=function(id){return scope.querySelector("#"+id);};
  if(!$("gd"))return;
  var cv=$("gd"), ctx=cv.getContext("2d"), lr=$("lr"), lrOut=$("lrOut"), stepBtn=$("stepBtn"), say=$("gdSay"), work=$("workBody"), workHead=$("workHead");
  var LO=-2, HI=8, TOP=27, BEST=3, START=7.5, w=START, shown=START, trail=[], n=0, W=0, H=0, raf=0, dragging=false, EMPTY=work.innerHTML;
  function loss(v){return (v-BEST)*(v-BEST);} function slope(v){return 2*(v-BEST);}
  function px(v){return 14+(v-LO)/(HI-LO)*(W-28);} function py(l){return H-32-(Math.min(l,TOP)/TOP)*(H-32-16);}
  function tok(k){return getComputedStyle(root).getPropertyValue(k).trim();}
  function f2(v){return (Math.abs(v)<0.005?0:v).toFixed(2);}
  function size(){var d=Math.min(window.devicePixelRatio||1,2); W=Math.max(200,cv.clientWidth); H=cv.clientHeight||240;
    cv.width=Math.round(W*d); cv.height=Math.round(H*d); ctx.setTransform(d,0,0,d,0,0); draw();}
  function draw(){
    var ink=tok("--ink"), faint=tok("--ink-3"), acc=tok("--accent"), soft=tok("--accent-soft"), leaf=tok("--leaf");
    ctx.clearRect(0,0,W,H); ctx.font='11px "IBM Plex Mono", ui-monospace, monospace'; ctx.fillStyle=faint;
    ctx.strokeStyle=faint; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(14,py(0)); ctx.lineTo(W-14,py(0)); ctx.stroke();
    ctx.textAlign="left"; ctx.fillText("↑ how wrong",14,13);
    for(var t=LO;t<=HI;t+=2){ctx.textAlign="center";ctx.fillText(String(t),px(t),py(0)+15);}
    ctx.textAlign="right"; ctx.fillText("weight →",W-14,H-4);
    ctx.setLineDash([4,5]); ctx.beginPath(); ctx.moveTo(px(BEST),py(0)); ctx.lineTo(px(BEST),py(TOP*0.3)); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign="center"; ctx.fillText("lowest point",px(BEST),py(TOP*0.3)-6);
    ctx.strokeStyle=ink; ctx.lineWidth=3; ctx.lineJoin="round"; ctx.beginPath();
    for(var i=0;i<=100;i++){var v=LO+(HI-LO)*i/100; if(i)ctx.lineTo(px(v),py(loss(v))); else ctx.moveTo(px(v),py(loss(v)));} ctx.stroke();
    var m=trail.length;
    for(var k=0;k<m;k++){var a=trail[k], b=k+1<m?trail[k+1]:shown; ctx.globalAlpha=0.25+0.6*(k+1)/m; ctx.strokeStyle=soft; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(px(a),py(loss(a))); ctx.lineTo(px(Math.max(LO,Math.min(HI,b))),py(loss(b))); ctx.stroke();
      ctx.fillStyle=soft; ctx.beginPath(); ctx.arc(px(a),py(loss(a)),4.5,0,6.283); ctx.fill();}
    ctx.globalAlpha=1;
    var off=shown<LO||shown>HI, cx=px(Math.max(LO,Math.min(HI,shown))), cy=py(loss(shown));
    if(!off){var s=slope(shown), dx=0.9; ctx.strokeStyle=acc; ctx.lineWidth=2; ctx.setLineDash([7,5]); ctx.beginPath();
      ctx.moveTo(px(shown-dx),py(loss(shown)-s*dx)); ctx.lineTo(px(shown+dx),py(loss(shown)+s*dx)); ctx.stroke(); ctx.setLineDash([]);}
    ctx.fillStyle=acc; ctx.strokeStyle=ink; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(cx,cy,off?8:13,0,6.283); ctx.fill(); ctx.stroke();
    ctx.fillStyle=leaf; ctx.beginPath(); ctx.arc(cx-4,cy-4,2.6,0,6.283); ctx.fill();
    if(off){ctx.fillStyle=ink; ctx.textAlign=shown<LO?"left":"right"; ctx.fillText(shown<LO?"← off the page":"off the page →",shown<LO?cx+14:cx-14,cy+18);}
  }
  function glide(to){cancelAnimationFrame(raf); if(reduce){shown=to;draw();return;}
    var from=shown, t0=performance.now(); (function tick(now){var t=Math.min(1,(now-t0)/380); shown=from+(to-from)*ease(t); draw(); if(t<1)raf=requestAnimationFrame(tick);})(t0);}
  function reset(to,keepMsg){cancelAnimationFrame(raf); w=shown=to; trail=[]; n=0; stepBtn.disabled=false; work.innerHTML=EMPTY; workHead.textContent="The last step, worked out";
    if(!keepMsg)say.textContent="The dot starts at weight "+f2(to)+". Each step moves it against the slope."; draw();}
  function rate(){return Math.round(parseFloat(lr.value)*100)/100;}
  lr.addEventListener("input",function(){lrOut.textContent=rate().toFixed(2);});
  function wr(k,v){return '<div class="wr"><dt>'+k+'</dt><dd>'+v+'</dd></div>';}
  stepBtn.addEventListener("click",function(){
    var a=w, s=slope(a), d=rate()*s, b=a-d; n++; trail.push(a); if(trail.length>14)trail.shift(); w=b; glide(b);
    workHead.textContent="Step "+n+", worked out";
    work.innerHTML=wr("Weight before the step",f2(a))+wr("Slope of the curve at that weight",f2(s))+wr("Step size × slope (how far to move)",rate().toFixed(2)+" × "+f2(s)+" = "+f2(d))
      +wr("Weight after the step",f2(a)+" − "+f2(d)+" = "+f2(b))+wr("How wrong the model is now",f2(loss(b)));
    var da=Math.abs(a-BEST), db=Math.abs(b-BEST), m;
    if(b<LO||b>HI){m="Off the page. Each step lands further out than the last. Start over with a smaller step size."; stepBtn.disabled=true;}
    else if(db<0.01){m="Settled at the bottom after "+n+(n===1?" step.":" steps.");}
    else if(Math.abs(db-da)<1e-6){m="Same distance, other side. At this step size it bounces between two points forever.";}
    else if(db>da){m="That step landed further from the bottom than it started. The step size is too big.";}
    else if((a-BEST)*(b-BEST)<0){m="Overshot the bottom but ended closer. It will settle, zig-zagging.";}
    else{m="Closer. The curve is flatter here, so the next step will be smaller.";}
    say.textContent=m;
  });
  $("resetBtn").addEventListener("click",function(){reset(START);});
  function fromPointer(e){var r=cv.getBoundingClientRect(), v=LO+((e.clientX-r.left)/r.width*W-14)/(W-28)*(HI-LO); return Math.max(LO+0.2,Math.min(HI-0.2,v));}
  cv.addEventListener("pointerdown",function(e){dragging=true;try{cv.setPointerCapture(e.pointerId);}catch(_){ } reset(fromPointer(e));});
  cv.addEventListener("pointermove",function(e){if(dragging)reset(fromPointer(e));});
  function up(){dragging=false;} cv.addEventListener("pointerup",up); cv.addEventListener("pointercancel",up);
  if(window.ResizeObserver){new ResizeObserver(size).observe(cv);} else {window.addEventListener("resize",size);}
  new MutationObserver(draw).observe(root,{attributes:true,attributeFilter:["data-theme"]});
  if(window.matchMedia){try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){draw();themePaint();});}catch(e){}}
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(draw);}
  size();
  }
  handParts(document); window.addEventListener("st:placed",function(e){handParts(e.detail);});

  /* folders */
  function folderParts(scope){
  all(".folder",scope).forEach(function(f){var d=scope.querySelector("#"+f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");
    all(".sheet",d).forEach(function(s,i){s.style.setProperty("--n",String(i));});
    f.addEventListener("click",function(){var open=!f.classList.contains("open"); f.classList.toggle("open",open); f.setAttribute("aria-expanded",open?"true":"false");
      d.hidden=!open; hint.textContent=open?"Close":"Open";});});
  }
  folderParts(document); window.addEventListener("st:placed",function(e){folderParts(e.detail);});

})();
}
