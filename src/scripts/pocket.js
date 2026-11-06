/* The pocket edition's script from design-reference/pocket.html, run only below 900 px
   wide. It differs from the design only as tests/visual/port.ts lists: the allowed changes and
   lines left out until the page they need arrives. The page router comes over in step 4. */
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
  themeBtns.forEach(function(b){b.addEventListener("click",function(){var n=isDark()?"light":"dark"; root.setAttribute("data-theme",n); save("st-theme",n); themePaint();});});

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
      var c=(r.top+r.height/2-vh/2)/vh; el.style.setProperty("--c",(c<-1?-1:c>1?1:c).toFixed(3));
    }
    if(!reduce){
      wire.style.setProperty("--wire",(-((y*0.3)%32)).toFixed(1));
    }
  }
  function ask(){if(!queued){queued=true;requestAnimationFrame(run);}}
  window.addEventListener("scroll",ask,{passive:true}); window.addEventListener("resize",ask,{passive:true}); run();

  /* track cards */
  var rail=$("rail"), cards=all(".flipcard",rail), dots=all("#dots i");
  cards.forEach(function(card){
    var front=card.querySelector(".front"), back=card.querySelector(".back"); back.setAttribute("inert","");
    all("[data-flip]",card).forEach(function(b){b.addEventListener("click",function(){
      var f=card.classList.toggle("flipped");
      if(f){front.setAttribute("inert","");back.removeAttribute("inert");} else {back.setAttribute("inert","");front.removeAttribute("inert");}
    });});
  });

  /* folders */
  all(".folder").forEach(function(f){var d=$(f.getAttribute("aria-controls")), hint=f.querySelector(".f-hint");
    all(".sheet",d).forEach(function(s,i){s.style.setProperty("--n",String(i));});
    f.addEventListener("click",function(){var open=!f.classList.contains("open"); f.classList.toggle("open",open); f.setAttribute("aria-expanded",open?"true":"false");
      d.hidden=!open; hint.textContent=open?"Close":"Open";});});

})();
}
