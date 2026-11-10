/* The edition switch. A page's HTML carries both editions' parts, each marked data-edition. The
   parts of the edition this width does not show are removed before any script runs, and from
   each page a turn places before the editions' scripts look inside it, so every id names one
   element (your decision, step 5). Each edition's script runs once, when the page loads, for the
   edition its width shows (desktop.js, pocket.js). When the width crosses 900 px the page loads
   again, so the other edition's parts and script come back. */
(function(){
  var other=window.matchMedia("(min-width:900px)").matches?"pocket":"desktop";
  function drop(scope){Array.prototype.forEach.call(scope.querySelectorAll('[data-edition="'+other+'"]'),function(el){el.remove();});}
  drop(document);
  window.addEventListener("st:placed",function(e){drop(e.detail);});
  window.matchMedia("(min-width:900px)").addEventListener("change",function(){location.reload();});
})();
