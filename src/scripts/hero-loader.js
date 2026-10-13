/* Loads the 3D hero (hero3d.js + three.js) straight away, as in the prototype. It is a separate chunk so the
   rest of the page's script stays small; hero3d.js itself waits for the browser to be idle after first paint
   before it fetches three.js and builds the scene. */
(function (W) {
  "use strict";
  var PL = W.PL; if (!PL || !PL.webgl || !PL.motion) return;
  PL.loading3D = true; /* while true, page.js's 6 s safety waits instead of switching the card to its tour */
  import("./hero3d.js").catch(function (err) { console.warn("3D hero did not load, keeping the 2D figure", err); PL.loading3D = false; PL.no3D && PL.no3D(); });
})(window);
