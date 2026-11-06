/* The design's page router from design-reference/ (the same script in both files), shared by
   both editions. Its page-showing code is as written; the parts that turned pages by #hash give
   way to the site's addresses (your decision, step 4): the block marked "every page has its own
   address" stands where the design's go function was, a popstate listener where its hashchange
   listener was, and the start-up shows this file's own page. tests/visual/port.ts lists every
   difference from the design, with allowed change 1 and the episode chapters and writing
   shelves left out until their pages arrive. */

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
  /* ---- every page has its own address (the site's own code, step 4) ---- */
  // A turn fetches the next page's file, places its page next to the current one, lets show()
  // above play the leaving and arriving turns, then updates the address bar. The page that left
  // goes once it has turned out, and any video player with it. Pages turned in announce
  // themselves ("st:placed") so the editions' scripts can find their parts, and every turn
  // announces itself once ("st:turned") for the comments and the visit count. Any failure
  // loads the address normally instead.
  var shownAt=location.pathname, turns=0;
  if("scrollRestoration" in history)history.scrollRestoration="manual";
  function addressOf(route){return route==="home"?"/":"/"+route+"/";}
  function go(route,then){turn(addressOf(route),then,true);}
  function turn(address,then,push){
    var n=++turns;
    if(address===shownAt){show(current,then);return;}
    fetch(address).then(function(r){
      if(!r.ok&&r.status!==404)throw new Error("status "+r.status);
      return r.text().then(function(html){return {html:html,address:new URL(r.url).pathname};});
    }).then(function(got){
      if(n!==turns)return;
      var doc=new DOMParser().parseFromString(got.html,"text/html"), found=doc.querySelector("[data-page]");
      var name=found&&found.getAttribute("data-page"), left=pages[current], leftName=current;
      if(!name||name===current)throw new Error("no other page at "+address);
      var page=document.importNode(found,true); page.hidden=true;
      left.after(page); pages[name]=page;
      window.dispatchEvent(new CustomEvent("st:placed",{detail:page}));
      show(name,then);
      document.title=doc.title;
      if(push)history.pushState(null,"",got.address);
      shownAt=got.address;
      setTimeout(function(){left.remove(); if(pages[leftName]===left)delete pages[leftName];},620);
      window.dispatchEvent(new CustomEvent("st:turned",{detail:{page:name,address:got.address}}));
    }).catch(function(){
      if(n!==turns)return;
      if(push)location.assign(address); else location.reload();
    });
  }
  /* ---- end of the addresses ---- */
  window.stGo=function(r){go(r);};
  document.addEventListener("click",function(e){
    var t=e.target.closest("[data-route]"); if(!t)return;
    e.preventDefault(); go(t.getAttribute("data-route"),t.getAttribute("data-then"));
  });
  window.addEventListener("popstate",function(){if(location.pathname!==shownAt)turn(location.pathname,null,false);});
  Object.keys(pages).forEach(function(k){pages[k].hidden=true;});
  var start=(location.hash||"").slice(1);
  show(Object.keys(pages)[0],start&&document.getElementById(start)?start:null);

})();
