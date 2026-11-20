/* The episode page's player (the site's own code, step 8, with src/styles/player.css). The
   design draws a dark box with a play button. On the site the box is a cover, the video's
   YouTube thumbnail under the design's button, and the button is an ordinary link to the video
   on YouTube, so the page works without scripts. With them, a click on the cover puts YouTube's
   privacy-enhanced player (youtube-nocookie.com) in the box, playing with sound from the start,
   and lifts the page above the paper grain. A chapter or transcript stamp (.chap) starts the
   player at its time, or jumps it there once it is in. Clicking a video's card elsewhere on
   the site opens its page and starts it.
   The player is heard as YouTube's own iframe API hears it, by messages. Any error, or no ready
   signal within 10 seconds, swaps the box for the "Watch on YouTube" box waiting in its
   template; ready but still not playing 3 seconds later shows the tap hint under it. Each page
   is set up at load and when a turn places it ("st:placed", router.js). */
(function(){
  "use strict";
  var EMBED="https://www.youtube-nocookie.com", GIVE_UP=10000, HOLD=3000, KNOCK=250;
  var root=document.documentElement, players=[], wanted=null;
  function secs(t){var p=t.split(":");return (+p[0])*60+(+p[1]);}
  function playerParts(scope){
    var box=scope.querySelector("[data-player]"); if(!box)return;
    var stack=box.parentNode, fallback=stack.querySelector("template[data-fallback]"), hint=stack.querySelector("[data-taphint]");
    var me={box:box,frame:null}, ready=false, playing=false, queued=null, timers=[], knocking=null;
    function later(fn,ms){timers.push(setTimeout(fn,ms));}
    function quiet(){timers.forEach(clearTimeout); timers=[]; clearInterval(knocking);}
    function post(message){me.frame.contentWindow.postMessage(JSON.stringify(message),EMBED);}
    function command(func,args){post({event:"command",func:func,args:args||[],id:1,channel:"widget"});}
    function fail(){
      quiet(); hint.hidden=true; root.removeAttribute("data-video"); me.frame=null;
      if(box.isConnected)box.replaceWith(fallback.content.cloneNode(true));
    }
    function play(){
      if(playing)return;
      playing=true; hint.hidden=true;
    }
    me.hear=function(data){
      var m; try{m=typeof data==="string"?JSON.parse(data):data;}catch(err){return;}
      if(!m||typeof m!=="object")return;
      if(m.event==="onReady"&&!ready){
        ready=true; quiet();
        if(queued!==null){command("seekTo",[queued,true]); command("playVideo"); queued=null;}
        later(function(){if(!playing)hint.hidden=false;},HOLD);
      }
      else if(m.event==="onError")fail();
      else if(m.event==="onStateChange"&&m.info===1)play();
      else if((m.event==="infoDelivery"||m.event==="initialDelivery")&&m.info&&m.info.playerState===1)play();
    };
    me.start=function(at){
      if(!box.isConnected)return;
      if(me.frame){
        if(ready){command("seekTo",[at,true]); command("playVideo");} else queued=at;
        return;
      }
      var f=document.createElement("iframe");
      f.title=box.getAttribute("data-title");
      f.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.setAttribute("allowfullscreen","");
      f.referrerPolicy="strict-origin-when-cross-origin";
      f.src=EMBED+"/embed/"+box.getAttribute("data-player")+"?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin="+
        encodeURIComponent(location.origin)+(at>0?"&start="+at:"");
      f.addEventListener("load",function(){
        if(ready||me.frame!==f)return;
        // A page turned out before the player answered takes the player with it: stop knocking.
        var knock=function(){if(!f.isConnected){quiet();return;} post({event:"listening",id:1,channel:"widget"});};
        knock(); clearInterval(knocking); knocking=setInterval(knock,KNOCK);
      });
      me.frame=f; box.appendChild(f); box.setAttribute("data-started",""); root.setAttribute("data-video","");
      f.focus({preventScroll:true});
      later(function(){if(!ready)fail();},GIVE_UP);
    };
    box.addEventListener("click",function(e){
      if(me.frame||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;
      e.preventDefault(); me.start(0);
    });
    Array.prototype.forEach.call(scope.querySelectorAll(".chap"),function(c){
      c.addEventListener("click",function(){me.start(secs(c.getAttribute("data-t")));});
    });
    players=players.filter(function(p){return p.box.isConnected;}); players.push(me);
  }
  window.addEventListener("message",function(e){
    players.forEach(function(p){if(p.frame&&e.source===p.frame.contentWindow)p.hear(e.data);});
  });
  // A click on a video's card turns to its page (router.js); the turn's end starts it.
  document.addEventListener("click",function(e){
    var a=e.target.closest('a[data-route="episode"]'), href=a&&a.getAttribute("href");
    wanted=href&&href.charAt(0)==="/"?new URL(href,location.href).pathname:null;
  },true);
  window.addEventListener("st:turned",function(e){
    root.removeAttribute("data-video");
    var go=wanted&&wanted===e.detail.address; wanted=null;
    if(!go)return;
    var shown=players.filter(function(p){return p.box.isConnected;}).pop();
    if(shown)shown.start(0);
  });
  playerParts(document); window.addEventListener("st:placed",function(e){playerParts(e.detail);});
})();
