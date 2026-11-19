/* The archives' filters and order (the site's own code, step 8). An archive ([data-archive])
   writes every item into the page, newest first, so search engines and visitors without scripts
   see them all; this only hides and reorders them in the visitor's browser. Its track row
   ([data-shelf]) keeps one track, or one of a track's modes ("e3:exploration"); its topic row
   ([data-topic]) keeps one topic; both apply together. Its sort control ([data-sort]) orders
   the items A to Z, by topic in taxonomy.json's order (newest first within each), newest or
   oldest. A pressed button is the choice shown, as the design's filters mark theirs; the empty
   line shows when nothing is left. Each archive is set up at load and in each page a turn places
   ("st:placed", router.js). */
(function(){
  "use strict";
  function archiveParts(scope){
    Array.prototype.forEach.call(scope.querySelectorAll("[data-archive]"),function(box){
      var list=box.querySelector(".alist"), empty=box.querySelector("[data-empty]");
      var items=Array.prototype.slice.call(list.querySelectorAll(".aitem"));
      var shelf="all", topic="all";
      var title=function(it){return it.querySelector("h3").textContent;};
      var date=function(it){return it.getAttribute("data-published");};
      var byTitle=function(a,b){return title(a).localeCompare(title(b),"en",{sensitivity:"base"});};
      var newest=function(a,b){return date(a)<date(b)?1:date(a)>date(b)?-1:byTitle(a,b);};
      var ORDERS={
        az:byTitle,
        topic:function(a,b){return (+a.getAttribute("data-topic-at"))-(+b.getAttribute("data-topic-at"))||newest(a,b);},
        newest:newest,
        oldest:function(a,b){return -newest(a,b);}
      };
      function filter(){
        var shown=0;
        items.forEach(function(it){
          var s=it.getAttribute("data-shelf");
          var on=(shelf==="all"||s===shelf||s.indexOf(shelf+":")===0)&&(topic==="all"||it.getAttribute("data-topic")===topic);
          it.hidden=!on; if(on)shown++;
        });
        empty.hidden=shown>0;
      }
      function press(buttons,b){buttons.forEach(function(o){o.setAttribute("aria-pressed",o===b?"true":"false");});}
      function group(attr,pick){
        var buttons=Array.prototype.slice.call(box.querySelectorAll("button["+attr+"]"));
        buttons.forEach(function(b){b.addEventListener("click",function(){press(buttons,b); pick(b.getAttribute(attr));});});
      }
      group("data-shelf",function(v){shelf=v; filter();});
      group("data-topic",function(v){topic=v; filter();});
      group("data-sort",function(v){items.slice().sort(ORDERS[v]).forEach(function(it){list.appendChild(it);});});
    });
  }
  archiveParts(document); window.addEventListener("st:placed",function(e){archiveParts(e.detail);});
})();
