/* The edition switch. Each edition's script runs once, when the page loads, for the edition its
   width shows (desktop.js, pocket.js). When the width crosses 900 px the page loads again, so the
   other edition's script runs. */
window.matchMedia("(min-width:900px)").addEventListener("change",function(){location.reload();});
