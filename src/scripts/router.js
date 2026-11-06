/* The design's page router from design-reference/ (the same script in both files), shared by
   both editions. It differs from the design only as tests/visual/port.ts lists: allowed
   change 1, and the episode chapters and writing shelves left out until their pages arrive. */

(function(){
  "use strict";
  var reduce=false;
  var pages={}, current=null, pendingThen=null;
  Array.prototype.forEach.call(document.querySelectorAll("[data-page]"),function(p){pages[p.getAttribute("data-page")]=p;});
  var navs=Array.prototype.slice.call(document.querySelectorAll(".tabs [data-route],.pnav [data-route],.dock [data-route]"));
  var GROUP={episode:"episodes",article:"writing",missing:""};
  function paint(name){var g=GROUP.hasOwnProperty(name)?GROUP[name]:name;
    navs.forEach(function(n){n.setAttribute("aria-current",n.getAttribute("data-route")===g?"true":"false");});}
  function jump(id){var el=document.getElementById(id); if(el)el.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});}
  function show(name,then){
    if(!pages[name])name="missing";
    if(name===current){ if(then)jump(then); return; }
    var inn=pages[name], out=current?pages[current]:null;
    window.scrollTo(0,0);
    inn.hidden=false;
    if(out){
      if(reduce){out.hidden=true;}
      else{
        out.classList.add("leaving");
        setTimeout(function(){out.hidden=true; out.classList.remove("leaving");},620);
        inn.classList.remove("arriving"); void inn.offsetWidth; inn.classList.add("arriving");
        setTimeout(function(){inn.classList.remove("arriving");},780);
      }
    }
    current=name; paint(name);
    window.dispatchEvent(new Event("scroll")); requestAnimationFrame(function(){window.dispatchEvent(new Event("resize"));});
    if(then)setTimeout(function(){jump(then);},reduce?0:480);
  }
  function go(route,then){
    if((location.hash||"").slice(1)===route){show(route,then);return;}
    pendingThen=then||null; location.hash=route;
  }
  window.stGo=function(r){go(r);};
  document.addEventListener("click",function(e){
    var t=e.target.closest("[data-route]"); if(!t)return;
    e.preventDefault(); go(t.getAttribute("data-route"),t.getAttribute("data-then"));
  });
  window.addEventListener("hashchange",function(){var r=(location.hash||"").slice(1)||"home"; var th=pendingThen; pendingThen=null;
    if(!pages[r]&&document.getElementById(r)&&pages.home.contains(document.getElementById(r))){show("home",r);return;}
    show(r,th);});
  Object.keys(pages).forEach(function(k){pages[k].hidden=true;});
  var start=(location.hash||"").slice(1);
  if(!start)show("home");
  else if(pages[start])show(start);
  else if(document.getElementById(start)&&pages.home.contains(document.getElementById(start)))show("home",start);
  else show("missing");

})();
