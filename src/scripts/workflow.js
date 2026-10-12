/* The defender's job as one timeline. A light runs along the rail; each step plays its scene as the light reaches it.
   The attack marker sits between discovery and triage, because that is the moment the job changes from proactive to reactive. */
(function (W, D) {
  "use strict";
  var root = D.querySelector("[data-wf]"); if (!root) return;
  var PL = W.PL || {}, cards = [].slice.call(root.querySelectorAll("[data-wf-c]")), pulse = root.querySelector("[data-wf-pulse]"), lit = root.querySelector("[data-wf-lit]"), atk = root.querySelector("[data-wf-atk]");
  var k = -1, timer = 0, hold = 0, STEP = 2800;
  var nodes = [].slice.call(root.querySelectorAll("[data-wf-n]"));
  /* each marker sits at the exact centre of its card, gutters included */
  function pos(i) { return "calc((100% - 3 * var(--gut)) / 8 + " + i + " * ((100% - 3 * var(--gut)) / 4 + var(--gut)))"; }
  function set(i) {
    k = i; cards.forEach(function (c, j) { c.classList.toggle("is-on", j === i); c.classList.toggle("is-past", j < i); });
    if (pulse) pulse.style.left = pos(i); if (lit) lit.style.width = pos(i);
    nodes.forEach(function (nd, j) { nd.classList.toggle("is-cur", j === i); nd.classList.toggle("is-lit", j < i); });
    if (atk) { atk.classList.toggle("is-hit", i === 1); root.classList.toggle("is-reactive", i >= 1); }
  }
  function tick() { if (Date.now() < hold) return; set((k + 1) % cards.length); }
  function start() { if (timer || PL.motion === false) return; set(0); timer = setInterval(tick, STEP); }
  function stop() { clearInterval(timer); timer = 0; }
  cards.forEach(function (c, i) { c.addEventListener("mouseenter", function () { hold = Date.now() + 5000; set(i); }); c.addEventListener("click", function () { hold = Date.now() + 6000; set(i); }); });
  function still() { stop(); root.classList.add("is-still"); cards.forEach(function (c) { c.classList.add("is-on"); }); nodes.forEach(function (nd) { nd.classList.add("is-lit"); }); if (pulse) pulse.style.left = "100%"; if (lit) lit.style.width = "100%"; }
  new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { if (PL.motion === false) still(); else start(); } else stop(); }); }, { threshold: 0.35 }).observe(root);
  W.addEventListener("pl:motion", function () { if (PL.motion === false) still(); else { root.classList.remove("is-still"); start(); } });
})(window, document);
