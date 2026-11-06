/* The desktop edition's scripts from design-reference/desktop.html, in the design's order,
   run only from 900 px wide. They differ from the design only as tests/visual/port.ts lists:
   the allowed changes, the paper choice saved in pocket's format, each page's parts found
   again in every page a turn places (router.js), and lines left out until the page they need
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
      el.style.setProperty("--c",c.toFixed(3));
    }
  }
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
    var d=document.getElementById(f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");
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
