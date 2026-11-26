/* =====================================================================
   ABOUT PAGE BEHAVIOUR · ported from the review file "About · Prescera Labs" (round 9, 22 Oct 2026).
   Vanilla JS, no libraries. Loaded by src/pages/about.astro only.
   One isometric projection draws every figure (hero core, why cards, approach, belief cards), so they read as one family.
   Reduced motion (html.no-motion, set in BaseLayout) gets still frames.
   ===================================================================== */
(function (W, D) {
  "use strict";
  var html = D.documentElement;
  var motion = function () { return !html.classList.contains("no-motion"); };
  var mq = W.matchMedia ? W.matchMedia("(prefers-reduced-motion: reduce)") : null;
  if (mq && mq.addEventListener) mq.addEventListener("change", function (e) { html.classList.toggle("no-motion", e.matches); });
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  function onView(el, fn, th) { if (!el) return; if (!("IntersectionObserver" in W)) { fn(true); return; } new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting); }); }, { threshold: th || 0 }).observe(el); }
  var NS = "http://www.w3.org/2000/svg";
  function el(tag, a, parent) { var n = D.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); if (parent) parent.appendChild(n); return n; }
  function f1(n) { return Math.round(n * 10) / 10; }
  function pts(a) { return a.map(function (p) { return f1(p[0]) + "," + f1(p[1]); }).join(" "); }
  function dPath(a) { return "M" + a.map(function (p) { return f1(p[0]) + " " + f1(p[1]); }).join("L"); }
  function ease(t) { t = Math.max(0, Math.min(1, t)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function iso(s, cx, cy) { return function (x, z, y) { return [cx + (x - z) * 0.8660 * s, cy + (x + z) * 0.5 * s - (y || 0) * s]; }; }
  function ellAt(P, s, x, z, r, y, attrs) { var c = P(x, z, y); return '<ellipse cx="' + f1(c[0]) + '" cy="' + f1(c[1]) + '" rx="' + f1(1.2247 * r * s) + '" ry="' + f1(0.7071 * r * s) + '" ' + (attrs || "") + "/>"; }
  function box(P, x, z, w, d, h, y0, cls, id) {
    var x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y0 + h;
    return '<g class="mc ' + (cls || "") + '"' + (id ? ' id="' + id + '"' : "") + '>' +
      '<polygon class="mc__z" points="' + pts([P(x0, z1, y0), P(x1, z1, y0), P(x1, z1, y1), P(x0, z1, y1)]) + '"/>' +
      '<polygon class="mc__x" points="' + pts([P(x1, z0, y0), P(x1, z1, y0), P(x1, z1, y1), P(x1, z0, y1)]) + '"/>' +
      '<polygon class="mc__t" points="' + pts([P(x0, z0, y1), P(x1, z0, y1), P(x1, z1, y1), P(x0, z1, y1)]) + '"/></g>';
  }
  function polyLen(a) { var c = [0]; for (var i = 1; i < a.length; i++) c.push(c[i - 1] + Math.hypot(a[i][0] - a[i - 1][0], a[i][1] - a[i - 1][1])); return c; }
  function at(a, c, L) { if (L <= 0) return a[0]; for (var i = 1; i < a.length; i++) if (c[i] >= L) { var t = (L - c[i - 1]) / (c[i] - c[i - 1] || 1); return [a[i - 1][0] + (a[i][0] - a[i - 1][0]) * t, a[i - 1][1] + (a[i][1] - a[i - 1][1]) * t]; } return a[a.length - 1]; }
  function sub(a, c, l0, l1) { l0 = Math.max(0, l0); var out = [at(a, c, l0)]; for (var i = 1; i < a.length; i++) if (c[i] > l0 && c[i] < l1) out.push(a[i]); out.push(at(a, c, l1)); return out; }

  /* =====================================================================
     THE MODEL CORE · hero (live) and closing (at rest)
     Zones as on the homepage network: core 2.7, corporate 5.0, edge 7.5 (scene units).
     ===================================================================== */
  function coreScene(svg, rest) {
    var s = rest ? 30 : 31, cx = 320, cy = rest ? 290 : 322, P = iso(s, cx, cy), o = "", sid = rest ? "r" : "h";
    o += '<defs>' +
      '<radialGradient id="' + sid + 'glow"><stop offset="0" stop-color="#C9CED3" stop-opacity=".22"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + sid + 'sig"><stop offset="0" stop-color="#FFD2AE"/><stop offset=".35" stop-color="#E8703A" stop-opacity=".5"/><stop offset="1" stop-color="#E8703A" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + sid + 'def"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".35" stop-color="#C9CED3" stop-opacity=".45"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + sid + 'beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#C9CED3" stop-opacity=".16"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="' + sid + 'fadeG" cx=".5" cy=".5" r=".5"><stop offset=".25" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>' +
      '<mask id="' + sid + 'fade" maskUnits="userSpaceOnUse" x="-100" y="-100" width="840" height="760"><rect x="-100" y="-100" width="840" height="760" fill="#000"/>' + ellAt(P, s, 0, 0, 9.2, 0, 'fill="url(#' + sid + 'fadeG)"') + '</mask></defs>';
    /* ground grid, fading toward the edge */
    var g = "";
    for (var i = -10; i <= 10; i++) { var a = P(i, -10), b = P(i, 10), c = P(-10, i), d = P(10, i), maj = i % 5 === 0;
      g += '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '" stroke-opacity="' + (maj ? .1 : .05) + '"/>' +
           '<line x1="' + f1(c[0]) + '" y1="' + f1(c[1]) + '" x2="' + f1(d[0]) + '" y2="' + f1(d[1]) + '" stroke-opacity="' + (maj ? .1 : .05) + '"/>'; }
    o += '<g mask="url(#' + sid + 'fade)" stroke="#DCDCDC" stroke-width=".6">' + g + '</g>';
    /* zone rings and a survey ring of ticks */
    o += ellAt(P, s, 0, 0, 7.5, 0, 'fill="none" stroke="rgba(220,220,220,.2)" stroke-width=".8" stroke-dasharray="3 5"');
    o += ellAt(P, s, 0, 0, 5.0, 0, 'fill="none" stroke="rgba(220,220,220,.2)" stroke-width=".8" stroke-dasharray="3 5"');
    var tk = ""; for (var k = 0; k < 96; k++) { var an = k / 96 * Math.PI * 2, L = k % 8 === 0 ? .42 : .18, p0 = P(Math.sin(an) * 8.1, Math.cos(an) * 8.1), p1 = P(Math.sin(an) * (8.1 + L), Math.cos(an) * (8.1 + L)); tk += "M" + f1(p0[0]) + " " + f1(p0[1]) + "L" + f1(p1[0]) + " " + f1(p1[1]); }
    o += '<path d="' + tk + '" stroke="rgba(220,220,220,.16)" stroke-width=".8" fill="none"/>';
    /* machines: six on the corporate ring, nine on the edge (fewer at rest) */
    var mids = [], edges = [], nM = 6, nE = rest ? 7 : 9;
    for (var m = 0; m < nM; m++) { var am = (m / nM) * Math.PI * 2 + .3; mids.push({ x: Math.sin(am) * 4.05, z: Math.cos(am) * 4.05, a: am, i: m }); }
    for (var e = 0; e < nE; e++) { var ae = (e / nE) * Math.PI * 2 + .05; edges.push({ x: Math.sin(ae) * 6.35, z: Math.cos(ae) * 6.35, a: ae, i: e }); }
    edges.forEach(function (E) { var best = mids[0], bd = 9; mids.forEach(function (M) { var dd = Math.abs(Math.atan2(Math.sin(E.a - M.a), Math.cos(E.a - M.a))); if (dd < bd) { bd = dd; best = M; } }); E.mid = best; });
    /* cables on the ground */
    var cab = "";
    edges.forEach(function (E) { var a1 = P(E.x, E.z), b1 = P(E.mid.x, E.mid.z); cab += "M" + f1(a1[0]) + " " + f1(a1[1]) + "L" + f1(b1[0]) + " " + f1(b1[1]); });
    mids.forEach(function (M) { var a1 = P(M.x, M.z), r = 2.7 / 4.05, b1 = P(M.x * r, M.z * r, .15); cab += "M" + f1(a1[0]) + " " + f1(a1[1]) + "L" + f1(b1[0]) + " " + f1(b1[1]); });
    o += '<path d="' + cab + '" stroke="rgba(220,220,220,.2)" stroke-width=".8" fill="none"/>';
    /* the core plinth */
    o += ellAt(P, s, 0, 0, 2.7, 0, 'fill="#0C0C0C"') + ellAt(P, s, 0, 0, 2.7, .15, 'fill="#101010" stroke="rgba(220,220,220,.24)" stroke-width=".8"');
    o += ellAt(P, s, 0, 0, 2.2, .15, 'fill="url(#' + sid + 'glow)"');
    if (rest) { o += ellAt(P, s, 0, 0, 2.3, .16, 'class="pulse" fill="none" stroke="#C9CED3" stroke-width="1"') + ellAt(P, s, 0, 0, 2.3, .16, 'class="pulse pulse--2" fill="none" stroke="#C9CED3" stroke-width="1"'); }
    /* machines and the model stack, back to front */
    var items = [];
    mids.forEach(function (M) { items.push({ k: M.x + M.z, s: box(P, M.x, M.z, .9, .56, .3, 0, "", sid + "m" + M.i) }); });
    edges.forEach(function (E) { items.push({ k: E.x + E.z, s: box(P, E.x, E.z, .9, .56, .22, 0, "", sid + "e" + E.i) }); });
    var stack = "", SL = 6; for (var q = 0; q < SL; q++) stack += box(P, 0, 0, 1.75, 1.75, .1, .2 + q * .32, "slab", sid + "s" + q);
    var top = P(0, 0, .2 + (SL - 1) * .32 + .1), beamH = 4.2 * s;
    var beam = '<rect x="' + f1(top[0] - 20) + '" y="' + f1(top[1] - beamH) + '" width="40" height="' + f1(beamH) + '" fill="url(#' + sid + 'beam)"/>';
    items.push({ k: 0, s: stack + beam });
    items.sort(function (a, b) { return a.k - b.k; });
    o += items.map(function (it) { return it.s; }).join("");
    o += '<g data-sig></g>';
    svg.innerHTML = o;
    /* the label over the model: placed as a percentage of the drawing, so it scales with it */
    /* the label: a chip up and to the left of the stack, joined to the top layer's left corner by a leader line */
    var lbl = svg.parentNode.querySelector("[data-core-lbl]"), an = P(-.875, .875, .2 + (SL - 1) * .32 + .1), lx = an[0] - 14, ly = an[1] - 108;
    svg.querySelector("[data-sig]").insertAdjacentHTML("beforebegin", '<g fill="none" stroke="rgba(201,206,211,.55)" stroke-width="1"><path d="M' + f1(an[0]) + ' ' + f1(an[1]) + 'V' + f1(ly) + 'H' + f1(lx) + '"/></g><circle cx="' + f1(an[0]) + '" cy="' + f1(an[1]) + '" r="2.4" fill="#E9ECEE"/>');
    if (lbl) { lbl.style.top = ((ly - 70) / 440 * 100) + "%";
      /* on narrow screens keep the chip inside the drawing; it then sits over the leader, which runs out from under it */
      var fit = function () { var fw = svg.parentNode.clientWidth || 640, want = lx / 640 * fw, cw = lbl.offsetWidth || 180; lbl.style.left = Math.max(want, cw + 4) + "px"; };
      fit(); W.addEventListener("resize", fit); if (D.fonts && D.fonts.ready) D.fonts.ready.then(fit); }
    return { P: P, s: s, edges: edges, mids: mids, sid: sid, slabs: $$(".slab .mc__t", svg), layer: svg.querySelector("[data-sig]"), svg: svg };
  }

  /* hero: an attack signal climbs in from an edge machine to the model; the model lights, layer by layer,
     and sends a response back out to the machine on the signal's way in, which is ringed in silver */
  function heroLive(sc) {
    var P = sc.P, s = sc.s, layer = sc.layer, sigs = [], t = 0, next = .5, last = -1, raf = 0, prevT = 0, running = false, hits = [];
    function route(E) {
      var M = E.mid, r = 2.7 / 4.05;
      return [P(E.x, E.z, .02), P(M.x, M.z, .02), P(M.x * r, M.z * r, .17)];
    }
    function back(E) { var M = E.mid, r = 2.7 / 4.05, a = P(M.x * r, M.z * r, .17), b = P(M.x, M.z, .3), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 14]; return [a, mid, b]; }
    function spawn() {
      var i; do { i = Math.floor(Math.random() * sc.edges.length); } while (i === last && sc.edges.length > 1); last = i;
      var E = sc.edges[i], a = route(E), c = polyLen(a), b = back(E), cb = polyLen(b);
      var g = el("g", {}, layer);
      var o = { E: E, a: a, c: c, b: b, cb: cb, t0: t, g: g, mcE: D.getElementById(sc.sid + "e" + E.i), mcM: D.getElementById(sc.sid + "m" + E.mid.i),
        trace: el("polyline", { fill: "none", stroke: "#E8703A", "stroke-width": "1.2", "stroke-opacity": "0", "stroke-linecap": "round", "stroke-linejoin": "round" }, g),
        tg: el("polyline", { fill: "none", stroke: "#E8703A", "stroke-width": "6", "stroke-opacity": ".22", "stroke-linecap": "round", "stroke-linejoin": "round" }, g),
        tl: el("polyline", { fill: "none", stroke: "#FF9F6E", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" }, g),
        hg: el("circle", { r: "10", fill: "url(#" + sc.sid + "sig)" }, g), hd: el("circle", { r: "2.4", fill: "#FFD2AE" }, g),
        rl: el("polyline", { fill: "none", stroke: "#C9CED3", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round", opacity: "0" }, g),
        rg: el("circle", { r: "10", fill: "url(#" + sc.sid + "def)", opacity: "0" }, g),
        ring: el("ellipse", { fill: "none", stroke: "#C9CED3", "stroke-width": "1.2", opacity: "0" }, g), hit: false };
      sigs.push(o);
    }
    var T1 = 2.2, GAP = .25, T2 = .9, T3 = 1.6;
    function step(o) {
      var a = t - o.t0;
      if (a < T1) {
        var L = ease(a / T1) * o.c[o.c.length - 1], h = at(o.a, o.c, L);
        o.tl.setAttribute("points", pts(sub(o.a, o.c, L - 26, L))); o.tg.setAttribute("points", pts(sub(o.a, o.c, L - 80, L)));
        o.hg.setAttribute("cx", h[0]); o.hg.setAttribute("cy", h[1]); o.hd.setAttribute("cx", h[0]); o.hd.setAttribute("cy", h[1]);
        if (o.mcE) o.mcE.classList.toggle("is-atk", a > .05 && a < 1.2);
        return false;
      }
      if (!o.hit) { o.hit = true; hits.push(t); o.trace.setAttribute("points", pts(o.a)); [o.tl, o.tg, o.hg, o.hd].forEach(function (n) { n.setAttribute("opacity", "0"); }); }
      o.trace.setAttribute("stroke-opacity", Math.max(0, .4 * (1 - (a - T1) / 5)).toFixed(3));
      var b = a - T1 - GAP;
      if (b > 0 && b < T2) {
        var Lb = ease(b / T2) * o.cb[o.cb.length - 1], hb = at(o.b, o.cb, Lb);
        o.rl.setAttribute("opacity", "1"); o.rl.setAttribute("points", pts(sub(o.b, o.cb, Lb - 34, Lb))); o.rg.setAttribute("opacity", "1"); o.rg.setAttribute("cx", hb[0]); o.rg.setAttribute("cy", hb[1]);
      } else if (b >= T2) { o.rl.setAttribute("opacity", "0"); o.rg.setAttribute("opacity", "0"); }
      var c = b - T2;
      if (c > 0) {
        var q = Math.min(1, c / T3), cp = P(o.E.mid.x, o.E.mid.z, .01), r = .7 + .55 * ease(q);
        o.ring.setAttribute("cx", cp[0]); o.ring.setAttribute("cy", cp[1]); o.ring.setAttribute("rx", 1.2247 * r * s); o.ring.setAttribute("ry", .7071 * r * s); o.ring.setAttribute("opacity", (.9 * (1 - q)).toFixed(3));
        if (o.mcM) o.mcM.classList.toggle("is-def", c < T3 + 1.4);
      }
      return a > T1 + GAP + T2 + T3 + 3.4;
    }
    function frame(now) {
      var dt = Math.min(.05, (now - (prevT || now)) / 1000); prevT = now; t += dt;
      if (t > next && sigs.length < 3) { spawn(); next = t + 1.6 + Math.random() * .7; }
      sigs = sigs.filter(function (o) { var done = step(o); if (done) { o.g.remove(); if (o.mcM) o.mcM.classList.remove("is-def"); } return !done; });
      hits = hits.filter(function (h) { return t - h < 2; });
      sc.slabs.forEach(function (p, i) { var lit = 0; hits.forEach(function (h) { var x = t - h - (sc.slabs.length - 1 - i) * .08; if (x > 0 && x < .7) lit = Math.max(lit, Math.sin(Math.PI * x / .7)); }); p.style.fillOpacity = (.05 + .32 * lit).toFixed(3); p.style.strokeOpacity = (.55 + .45 * lit).toFixed(3); });
      raf = requestAnimationFrame(frame);
    }
    return {
      start: function () { if (running || !motion()) return; running = true; prevT = 0; raf = requestAnimationFrame(frame); },
      stop: function () { running = false; cancelAnimationFrame(raf); }
    };
  }
  /* reduced motion: the same story as one still frame */
  function heroStill(sc) {
    var P = sc.P, s = sc.s, layer = sc.layer;
    [1, 5].forEach(function (i, n) { var E = sc.edges[i], M = E.mid, r = 2.7 / 4.05, a = [P(E.x, E.z, .02), P(M.x, M.z, .02), P(M.x * r, M.z * r, .17), P(0, 0, .17)];
      el("polyline", { points: pts(a), fill: "none", stroke: "#E8703A", "stroke-width": "1.4", "stroke-opacity": n ? ".45" : ".7", "stroke-linejoin": "round" }, layer);
      if (n) { var cp = P(M.x, M.z, .01); el("ellipse", { cx: cp[0], cy: cp[1], rx: 1.2247 * 1.05 * s, ry: .7071 * 1.05 * s, fill: "none", stroke: "#C9CED3", "stroke-width": "1.2" }, layer); var mc = D.getElementById(sc.sid + "m" + M.i); if (mc) mc.classList.add("is-def"); } });
    sc.slabs.forEach(function (p) { p.style.fillOpacity = ".16"; });
  }
  var heroSvg = $('[data-core="hero"] svg'), hero = heroSvg && coreScene(heroSvg, false), heroA = null;
  if (!hero) { /* no hero on this page */ } else if (motion()) { heroA = heroLive(hero); onView($(".ahero"), function (v) { if (v && !D.hidden) heroA.start(); else heroA.stop(); }); D.addEventListener("visibilitychange", function () { if (D.hidden) heroA.stop(); else heroA.start(); }); }
  else heroStill(hero);
  var restSvg = $('[data-core="rest"] svg'); if (restSvg) coreScene(restSvg, true);

  /* =====================================================================
     WHY · three drawings, one per card, in the same projection as the hero.
     0 many attacks reach the network · 1 a general model stops some, the rest pass its gaps · 2 a model built for defence holds all.
     Each path carries a travelling pulse that lands with a flash (motion only). Labels are HTML, placed from the drawing.
     ===================================================================== */
  function whyArt(svg, mode) {
    var wide = mode > 0, VW = wide ? 460 : 600, VH = wide ? 320 : 430, s = wide ? 21 : 27, cx = wide ? 262 : 300, cy = wide ? 168 : 214;
    var P = iso(s, cx, cy), id = "wa" + mode, o = "", live = motion();
    svg.setAttribute("viewBox", "0 0 " + VW + " " + VH); svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    o += '<defs><filter id="' + id + 'b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.2"/></filter>' +
      '<radialGradient id="' + id + 'n"><stop offset="0" stop-color="#FFE2CC"/><stop offset=".3" stop-color="#FF8A4C" stop-opacity=".7"/><stop offset="1" stop-color="#E8703A" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'w"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".9"/><stop offset=".35" stop-color="#C9CED3" stop-opacity=".35"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="' + id + 'fg" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>' +
      '<mask id="' + id + 'f" maskUnits="userSpaceOnUse" x="-200" y="-200" width="' + (VW + 400) + '" height="' + (VH + 400) + '"><rect x="-200" y="-200" width="' + (VW + 400) + '" height="' + (VH + 400) + '" fill="#000"/>' + ellAt(P, s, 0, 0, 10, 0, 'fill="url(#' + id + 'fg)"') + '</mask></defs>';
    /* ground grid and vertical survey ticks */
    var g = ""; for (var i = -11; i <= 11; i++) { var a = P(i, -11), b = P(i, 11), c = P(-11, i), d = P(11, i); g += '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) + '"/><line x1="' + f1(c[0]) + '" y1="' + f1(c[1]) + '" x2="' + f1(d[0]) + '" y2="' + f1(d[1]) + '"/>'; }
    o += '<g mask="url(#' + id + 'f)" stroke="#DCDCDC" stroke-opacity=".06" stroke-width=".6">' + g + '</g>';
    var vt = ""; [-6, -3, 3, 6].forEach(function (q) { var a = P(q, -7), b = P(q, -7, 3.2); vt += "M" + f1(a[0]) + " " + f1(a[1]) + "V" + f1(b[1]); a = P(-7, q); b = P(-7, q, 3.2); vt += "M" + f1(a[0]) + " " + f1(a[1]) + "V" + f1(b[1]); });
    if (mode === 0) o += '<path d="' + vt + '" stroke="rgba(232,112,58,.14)" stroke-width=".8" stroke-dasharray="2 4" fill="none" mask="url(#' + id + 'f)"/>';
    /* the network: five machines on a dark plinth */
    var cubes = [[0, -1.05], [-1.05, 0], [0, 0], [1.05, 0], [0, 1.05]];
    o += ellAt(P, s, 0, 0, 2.3, 0, 'fill="#0B0B0B" stroke="rgba(220,220,220,.1)" stroke-width=".8" stroke-dasharray="2 3"');
    var RG = 3.7, RS = 3.5, R0 = wide ? 9 : 10.5, N = wide ? 8 : 11, paths = [];
    for (var k = 0; k < N; k++) {
      var an = k / N * Math.PI * 2 + .35 + (k % 3) * .05, sg = k % 2 ? 1 : -1, tgt = cubes[(k * 2) % 5];
      var S = [Math.sin(an) * R0, Math.cos(an) * R0], E = [tgt[0] * .9 + Math.sin(an) * .7, tgt[1] * .9 + Math.cos(an) * .7];
      var stop = mode === 2 ? RS : (mode === 1 && k % 2 === 0 ? RG : 0);
      var dx = E[0] - S[0], dz = E[1] - S[1], ln = Math.hypot(dx, dz), nx = -dz / ln, nz = dx / ln, gw = [];
      for (var j2 = 0; j2 <= 48; j2++) { var t = j2 / 48, bend = 1.4 * sg * Math.sin(Math.PI * t), x = S[0] + dx * t + nx * bend, z = S[1] + dz * t + nz * bend; if (stop && Math.hypot(x, z) < stop) { var r1 = Math.hypot(x, z), pv = gw[gw.length - 1], r0 = Math.hypot(pv[0], pv[1]), u = (r0 - stop) / (r0 - r1); gw.push([pv[0] + (x - pv[0]) * u, pv[1] + (z - pv[1]) * u]); break; } gw.push([x, z]); }
      var pw = gw.map(function (q) { return P(q[0], q[1], .02); }), cross = 0;
      for (var j3 = 0; j3 < gw.length; j3++) if (Math.hypot(gw[j3][0], gw[j3][1]) < RG) { cross = Math.atan2(gw[j3][0], gw[j3][1]); break; }
      paths.push({ d: dPath(pw), pts: pw, end: pw[pw.length - 1], held: !!stop, tgt: (k * 2) % 5, cross: cross });
    }
    /* rings */
    if (mode === 1) {
      /* a broken ring: gaps exactly where the passing paths cross it */
      var arcs = "", run = [];
      for (var q = 0; q <= 260; q++) { var aq = q / 260 * Math.PI * 2,
        gap = paths.some(function (p) { return !p.held && Math.abs(Math.atan2(Math.sin(aq - p.cross), Math.cos(aq - p.cross))) < .22; });
        if (!gap) run.push(P(Math.sin(aq) * RG, Math.cos(aq) * RG, .02)); if ((gap || q === 260) && run.length > 1) { arcs += dPath(run); run = []; } else if (gap) run = []; }
      o += '<path d="' + arcs + '" fill="none" stroke="rgba(235,235,235,.75)" stroke-width="1.3" stroke-dasharray="5 4"/>';
    }
    if (mode === 2) {
      o += ellAt(P, s, 0, 0, RS + .55, .02, 'fill="none" stroke="rgba(201,206,211,.22)" stroke-width="1"');
      o += ellAt(P, s, 0, 0, RS + .4, 0, 'fill="url(#' + id + 'w)" opacity=".25"');
      o += ellAt(P, s, 0, 0, RS, .02, 'fill="none" stroke="#F2F3F4" stroke-width="1.7"');
      o += ellAt(P, s, 0, 0, RS - .9, .02, 'fill="none" stroke="rgba(220,220,220,.25)" stroke-width=".8" stroke-dasharray="3 4"');
      var tk = ""; for (var t2 = 0; t2 < 40; t2++) { var at2 = t2 / 40 * Math.PI * 2, L = t2 % 5 === 0 ? .32 : .16, a0 = P(Math.sin(at2) * RS, Math.cos(at2) * RS, .02), a1 = P(Math.sin(at2) * (RS + L), Math.cos(at2) * (RS + L), .02); tk += "M" + f1(a0[0]) + " " + f1(a0[1]) + "L" + f1(a1[0]) + " " + f1(a1[1]); }
      o += '<path d="' + tk + '" stroke="rgba(242,243,244,.75)" stroke-width="1" fill="none"/>';
    }
    /* attack paths: soft glow, core line, two nodes */
    /* state colours: orange = an attack that reaches the network; grey = an attack that was stopped */
    var glow = "", core = "", held = "", nodes = "";
    paths.forEach(function (p) {
      if (p.held) { held += '<path d="' + p.d + '"/>'; return; }
      glow += '<path d="' + p.d + '"/>'; core += '<path d="' + p.d + '"/>';
      [.32, .62].forEach(function (f) { var q = p.pts[Math.round(f * (p.pts.length - 1))]; nodes += '<circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="7" fill="url(#' + id + 'n)"/><circle cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="2.2" fill="#FFB27A"/>'; });
    });
    o += '<g fill="none" stroke="#E8703A" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round" mask="url(#' + id + 'f)">' + held + '</g>';
    o += '<g class="wa-glow" mask="url(#' + id + 'f)"><g fill="none" stroke="#E8703A" stroke-width="7" stroke-opacity=".35" filter="url(#' + id + 'b)">' + glow + '</g></g>';
    o += '<g fill="none" stroke="#FF8A4C" stroke-width="1.4" stroke-linecap="round" mask="url(#' + id + 'f)">' + core + '</g><g mask="url(#' + id + 'f)">' + nodes + '</g>';
    /* contact points */
    paths.forEach(function (p) { var e = p.end;
      if (p.held && mode === 1) o += '<circle cx="' + f1(e[0]) + '" cy="' + f1(e[1]) + '" r="4.6" fill="#121212" stroke="#F2F3F4" stroke-width="1.4"/><path d="M' + f1(e[0] - 2.2) + ' ' + f1(e[1] - 2.2) + 'l4.4 4.4m0 -4.4l-4.4 4.4" stroke="#F2F3F4" stroke-width="1.2"/>';
      if (p.held && mode === 2) o += '<circle cx="' + f1(e[0]) + '" cy="' + f1(e[1]) + '" r="12" fill="url(#' + id + 'w)"/><circle cx="' + f1(e[0]) + '" cy="' + f1(e[1]) + '" r="3.4" fill="#FFFFFF"/>'; });
    /* machines, back to front: orange when an attack reaches them, silver when the ring holds */
    var hit = {}; paths.forEach(function (p) { if (!p.held) hit[p.tgt] = 1; });
    o += cubes.map(function (c, i4) { var cls = mode === 2 ? "is-def" : ""; return { k: c[0] + c[1], s: box(P, c[0], c[1], .78, .78, .5, 0, cls) }; }).sort(function (a, b) { return a.k - b.k; }).map(function (x) { return x.s; }).join("");
    /* travelling pulses, landing with a flash */
    if (live) paths.forEach(function (p, i5) { var dur = (2.6 + (i5 % 4) * .35).toFixed(2) + "s", beg = (i5 * .42).toFixed(2) + "s", e = p.end;
      o += '<circle r="2.4" fill="' + (p.held ? '#F4AE84' : '#FFB27A') + '" opacity="0"><set attributeName="opacity" to="1" begin="' + beg + '"/><animateMotion dur="' + dur + '" begin="' + beg + '" repeatCount="indefinite" path="' + p.d + '" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".45 0 .7 1"/></circle>';
      o += '<circle cx="' + f1(e[0]) + '" cy="' + f1(e[1]) + '" r="3" fill="none" stroke="' + (p.held ? "#FFFFFF" : "#FF8A4C") + '" stroke-width="1.2" opacity="0">' +
        '<animate attributeName="r" values="3;3;14" keyTimes="0;.9;1" dur="' + dur + '" begin="' + beg + '" repeatCount="indefinite"/>' +
        '<animate attributeName="opacity" values="0;0;.9;0" keyTimes="0;.88;.92;1" dur="' + dur + '" begin="' + beg + '" repeatCount="indefinite"/></circle>'; });
    /* label anchor and leader */
    var la = mode === 0 ? P(0, 0, 2.6) : P(-(mode === 1 ? RG : RS) * .7071, -(mode === 1 ? RG : RS) * .7071, 0);
    var lb = mode === 0 ? P(0, -1.05, .55) : la, top = [la[0], la[1] - (mode === 0 ? 0 : 34)];
    o += '<path d="M' + f1(top[0]) + ' ' + f1(top[1]) + 'V' + f1(lb[1]) + '" stroke="rgba(242,243,244,.6)" stroke-width="1"/>';
    svg.innerHTML = o;
    return top;
  }
  (function () {
    var arts = $$("[data-wa]");
    function place() {
      arts.forEach(function (sv) { var lbl = sv.parentNode.querySelector("[data-alb]"); if (!lbl || !sv.__top) return; var m = sv.getScreenCTM(), box2 = sv.parentNode.getBoundingClientRect(); if (!m) return;
        var pt = sv.createSVGPoint(); pt.x = sv.__top[0]; pt.y = sv.__top[1]; var q = pt.matrixTransform(m); lbl.style.left = (q.x - box2.left) + "px"; lbl.style.top = (q.y - box2.top) + "px"; });
    }
    arts.forEach(function (sv) { sv.__top = whyArt(sv, +sv.dataset.wa); });
    place(); W.addEventListener("resize", place); if (D.fonts && D.fonts.ready) D.fonts.ready.then(place); W.addEventListener("load", place);
  })();

  /* =====================================================================
     APPROACH · the wide drawing, and three zone crops of it for phones
     ===================================================================== */
  function apScene(svg, mode) {
    var id = "ap" + mode, P = iso(38, 600, 232), o = "";
    var rowsY = [70, 130, 190, 250], inY = [186, 194, 202, 210], outY = [80, 140, 200, 260];
    o += '<defs><linearGradient id="' + id + 'g" gradientUnits="userSpaceOnUse" x1="380" y1="0" x2="540" y2="0"><stop offset="0" stop-color="#E8703A"/><stop offset="1" stop-color="#C9CED3"/></linearGradient>' +
      '<radialGradient id="' + id + 'glow"><stop offset="0" stop-color="#C9CED3" stop-opacity=".2"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></radialGradient></defs>';
    /* A: recorded attacks, four stepped paths through small nodes, joined by lateral moves */
    var A = '<g class="ap-z ap-zA">';
    A += '<path d="M150 70V130M230 190V250M310 130V190" stroke="rgba(232,112,58,.45)" stroke-width="1" stroke-dasharray="3 4" fill="none"/>';
    rowsY.forEach(function (y, i) { var d = "M30 " + y + "H330C430 " + y + " 440 " + inY[i] + " 524 " + inY[i];
      A += '<path id="' + id + 'a' + i + '" class="ap-pg" stroke="url(#' + id + 'g)" d="' + d + '"/><path class="ap-p" stroke="url(#' + id + 'g)" d="' + d + '"/>';
      [70, 150, 230, 310].forEach(function (x, j) { var hot = (i + j) % 3 === 0; A += '<circle cx="' + x + '" cy="' + y + '" r="' + (hot ? 4 : 3.2) + '" fill="' + (hot ? "#E8703A" : "#141414") + '" stroke="' + (hot ? "#FFB27A" : "rgba(232,112,58,.7)") + '" stroke-width="1.1"/>'; });
      A += '<path d="M30 ' + (y - 6) + 'V' + (y + 6) + '" stroke="rgba(220,220,220,.35)" stroke-width="1"/>'; });
    A += "</g>";
    /* B: the model, six layers on a soft glow */
    var B = '<g class="ap-z ap-zB">' + ellAt(P, 38, 0, 0, 2.2, 0, 'fill="url(#' + id + 'glow)"') + ellAt(P, 38, 0, 0, 2.05, 0, 'fill="none" stroke="rgba(220,220,220,.18)" stroke-dasharray="3 4"');
    for (var q = 0; q < 6; q++) B += box(P, 0, 0, 2.2, 2.2, .09, q * .3, "slab");
    B += "</g>";
    /* C: four lines out to the defender's work */
    var C = '<g class="ap-z ap-zC">';
    outY.forEach(function (y, i) { var d = "M676 " + inY[i] + "C800 " + inY[i] + " 830 " + y + " 930 " + y + "H1056";
      C += '<path id="' + id + 'c' + i + '" class="ap-pg" stroke="#C9CED3" d="' + d + '"/><path class="ap-p" stroke="rgba(201,206,211,.75)" d="' + d + '"/>' +
        '<rect x="1056" y="' + (y - 5) + '" width="10" height="10" fill="#141414" stroke="#C9CED3" stroke-width="1.2"/>'; });
    if (mode === "C") ["Discovery", "Triage", "Containment", "Remediation"].forEach(function (w, i) { C += '<text x="1080" y="' + (outY[i] + 9) + '" font-family="Hanken Grotesk, sans-serif" font-size="27" fill="#EEEEEE">' + w + "</text>"; });
    C += "</g>";
    var pulses = "";
    if (mode === "full" && motion()) {
      [0, 1, 2, 3].forEach(function (i) { pulses += '<circle r="2.6" fill="#FFD2AE"><animateMotion dur="3.4s" begin="' + (i * .85) + 's" repeatCount="indefinite"><mpath href="#' + id + 'a' + i + '"/></animateMotion></circle>' +
        '<circle r="2.4" fill="#FFFFFF"><animateMotion dur="2.6s" begin="' + (i * .65 + .4) + 's" repeatCount="indefinite"><mpath href="#' + id + 'c' + i + '"/></animateMotion></circle>'; });
    }
    svg.innerHTML = o + A + C + B + pulses;
    var vb = { full: "0 0 1200 320", A: "0 40 560 250", B: "440 40 320 250", C: "680 40 600 250" }[mode];
    svg.setAttribute("viewBox", vb);
  }
  if ($("[data-apsvg]")) apScene($("[data-apsvg]"), "full");
  $$("[data-apmini]").forEach(function (s2) { apScene(s2, s2.dataset.apmini); });


  /* ---------- principle card drawings: one idea each, orange for the signal, grey for everything else.
     Each runs a small loop by default (flowing dots, a flowing wave, a travelling token); hover makes it brighter. */
  (function () {
    var live = motion(), C = {};
    var DEF = function (id) { return '<defs><filter id="' + id + 'b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>' +
      '<radialGradient id="' + id + 'g"><stop offset="0" stop-color="#FF8A4C" stop-opacity=".55"/><stop offset="1" stop-color="#E8703A" stop-opacity="0"/></radialGradient>' +
      '<marker id="' + id + 'a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L8 4L0 8z" fill="rgba(220,220,220,.6)"/></marker></defs>'; };
    function rnd(n) { var x = Math.sin(n * 91.7) * 43758.5453; return x - Math.floor(x); }

    /* 1 Specialised over general: mixed signals are drawn through one narrow filter; only the relevant ones come out, into a focused set */
    (function () { var o = DEF("p1"), i, kinds = ["sq", "sqO", "ring", "dot", "dotO"];
      for (i = 0; i < 30; i++) { var x = 10 + rnd(i) * 108, y = 18 + rnd(i + 50) * 134, k = kinds[Math.floor(rnd(i + 9) * 5)];
        if (k === "sq") o += '<rect x="' + f1(x - 3.5) + '" y="' + f1(y - 3.5) + '" width="7" height="7" fill="#3A3A3A"/>';
        if (k === "sqO") o += '<rect x="' + f1(x - 3.5) + '" y="' + f1(y - 3.5) + '" width="7" height="7" fill="#E8703A"/>';
        if (k === "ring") o += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="4" fill="none" stroke="rgba(220,220,220,.4)" stroke-width="1"/>';
        if (k === "dot") o += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="2" fill="rgba(220,220,220,.45)"/>';
        if (k === "dotO") o += '<circle cx="' + f1(x) + '" cy="' + f1(y) + '" r="2.6" fill="#E8703A"/>'; }
      var ys = [24, 46, 66, 86, 106, 126, 146], curves = "";
      ys.forEach(function (y, n) { var ye = 68 + n * 5.5; curves += '<path id="p1c' + n + '" d="M' + (70 + (n % 3) * 18) + ' ' + y + 'C150 ' + y + ' 160 ' + ye + ' 196 ' + ye + '"/>'; });
      o += '<g fill="none" stroke="rgba(220,220,220,.32)" stroke-width=".9">' + curves + '</g>';
      o += '<polygon points="186,40 206,24 206,132 186,148" fill="#1A1A1A" stroke="rgba(220,220,220,.45)" stroke-width="1"/>';
      o += '<g class="pc-glow"><rect x="190" y="62" width="12" height="46" fill="#C9CED3" opacity=".35" filter="url(#p1b)"/></g><path d="M196 64V106" stroke="#E9ECEE" stroke-width="1.6"/>';
      [72, 85, 98].forEach(function (y) { o += '<path d="M210 ' + y + 'H240" stroke="rgba(220,220,220,.55)" stroke-width="1" marker-end="url(#p1a)"/>'; });
      o += '<defs><radialGradient id="p1s"><stop offset="0" stop-color="#C9CED3" stop-opacity=".35"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></radialGradient></defs><circle cx="278" cy="85" r="44" fill="url(#p1s)" class="pc-glow"/><circle class="pc-ring" cx="278" cy="85" r="32" fill="none" stroke="rgba(201,206,211,.8)" stroke-width="1.2" stroke-dasharray="3 3.5"/>';
      [[268, 75], [282, 75], [268, 89], [282, 89]].forEach(function (q) { o += '<rect x="' + (q[0] - 5) + '" y="' + (q[1] - 5) + '" width="13" height="13" rx="1.5" fill="#C9CED3"/>'; });
      if (live) [0, 2, 4, 6, 1].forEach(function (n, m) { o += '<circle r="2.4" fill="#FF9F6E" opacity="0"><animateMotion dur="2.8s" begin="' + (m * .55) + 's" repeatCount="indefinite"><mpath href="#p1c' + n + '"/></animateMotion><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="2.8s" begin="' + (m * .55) + 's" repeatCount="indefinite"/></circle>'; });
      C[1] = o; })();

    /* 2 Research starts from real attacks: a real attack as a sequence of stages (orange);
       the model learns each stage (silver rings) and a silver token follows the same path, step for step */
    (function () { var o = DEF("p2"), st = [[22, 132], [72, 132], [100, 100], [150, 100], [178, 68], [228, 68], [256, 38], [300, 38]];
      var grid = ""; for (var y = 30; y <= 150; y += 30) grid += "M10 " + y + "H310"; o += '<path d="' + grid + '" stroke="rgba(220,220,220,.07)" stroke-width="1"/>';
      var dA = "M" + st.map(function (q) { return q[0] + " " + q[1]; }).join("L"), dL = dA;
      o += '<path class="pc-glow" d="' + dA + '" fill="none" stroke="#E8703A" stroke-width="7" stroke-opacity=".3" filter="url(#p2b)"/><path d="' + dA + '" fill="none" stroke="#FF8A4C" stroke-width="1.6" stroke-linejoin="round"/>';
      o += '<path id="p2l" d="' + dL + '" fill="none" stroke="rgba(233,236,238,.9)" stroke-width="1.2" stroke-dasharray="3 6" stroke-linejoin="round"/>';
      [0, 2, 4, 6].forEach(function (n, m) { var q = st[n]; o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="7" fill="none" stroke="rgba(201,206,211,.7)" stroke-width="1"/><circle class="pc-st" style="--i:' + m + '" cx="' + q[0] + '" cy="' + q[1] + '" r="3.6" fill="#FF8A4C"/>'; });
      [1, 3, 5, 7].forEach(function (n) { var q = st[n]; o += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="2.4" fill="#121212" stroke="#FF8A4C" stroke-width="1.2"/>'; });
      if (live) o += '<circle r="3" fill="#FFFFFF"><animateMotion dur="3.2s" repeatCount="indefinite"><mpath href="#p2l"/></animateMotion><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.9;1" dur="3.2s" repeatCount="indefinite"/></circle>';
      C[2] = o; })();

    /* 3 Automation inside your rules: inside a dashed boundary, a token passes a check against the rules, a decision, and lands as an approved action */
    (function () { var o = DEF("p3");
      o += '<rect x="10" y="14" width="300" height="144" rx="8" fill="rgba(220,220,220,.015)" stroke="rgba(220,220,220,.3)" stroke-dasharray="4 4"/>';
      o += '<rect x="28" y="74" width="24" height="24" rx="3" fill="#1C1C1C" stroke="rgba(220,220,220,.45)"/>';
      o += '<path d="M52 86H128M172 86H204M220 86H250" stroke="rgba(220,220,220,.5)" stroke-width="1"/><path d="M240 86H252" stroke="rgba(220,220,220,.5)" marker-end="url(#p3a)"/>';
      o += '<circle cx="92" cy="86" r="4" fill="#121212" stroke="rgba(220,220,220,.6)"/>';
      o += '<rect x="128" y="46" width="44" height="80" rx="3" fill="rgba(201,206,211,.06)" stroke="rgba(201,206,211,.75)" stroke-width="1"/>';
      [[64, 1], [86, 0], [108, 1]].forEach(function (r) { o += (r[1] ? '<circle cx="139" cy="' + r[0] + '" r="2.8" fill="#C9CED3"/>' : '<circle cx="139" cy="' + r[0] + '" r="3.4" fill="#121212" stroke="#EEEEEE" stroke-width="1"/>') + '<path d="M146 ' + r[0] + 'H164" stroke="rgba(201,206,211,.5)" stroke-width="1"/>'; });
      o += '<path d="M212 78L220 86L212 94L204 86Z" fill="#121212" stroke="rgba(220,220,220,.6)"/><path d="M212 76V60" stroke="rgba(220,220,220,.4)" stroke-dasharray="2 3"/><circle cx="212" cy="44" r="5" fill="none" stroke="#EEEEEE" stroke-width="1.2"/><path d="M203 58c0-6 4-9 9-9s9 3 9 9" fill="none" stroke="#EEEEEE" stroke-width="1.2"/>';
      o += '<defs><radialGradient id="p3s"><stop offset="0" stop-color="#C9CED3" stop-opacity=".35"/><stop offset="1" stop-color="#C9CED3" stop-opacity="0"/></radialGradient></defs><circle cx="272" cy="86" r="26" fill="url(#p3s)" class="pc-glow"/><rect x="258" y="72" width="28" height="28" rx="4" fill="rgba(201,206,211,.14)" stroke="#C9CED3" stroke-width="1.4"/><path d="M265 86L270 91L279 80" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      if (live) o += '<path id="p3t" d="M40 86H270" fill="none"/><circle r="3" fill="#FFFFFF"><animateMotion dur="4.2s" repeatCount="indefinite" keyPoints="0;.4;.4;1;1" keyTimes="0;.3;.45;.85;1" calcMode="linear"><mpath href="#p3t"/></animateMotion><animate attributeName="opacity" values="0;1;1;1;0" keyTimes="0;.06;.45;.82;.86" dur="4.2s" repeatCount="indefinite"/></circle>' +
        '<rect x="258" y="72" width="28" height="28" rx="4" fill="none" stroke="#FFFFFF" stroke-width="1.4" opacity="0"><animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.84;.88;1" dur="4.2s" repeatCount="indefinite"/></rect>';
      C[3] = o; })();
    $$("[data-pc]").forEach(function (sv) { sv.innerHTML = C[sv.dataset.pc]; });
  })();

  /* ---------- reveal (page.js does this on the homepage) */
  $$(".rv").forEach(function (n) { n.style.setProperty("--rd", (Array.prototype.indexOf.call(n.parentNode.children, n) * 60) + "ms"); });
  if ("IntersectionObserver" in W) { var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } }); }, { threshold: .15 }); $$(".rv").forEach(function (n) { rio.observe(n); }); }
  else $$(".rv").forEach(function (n) { n.classList.add("in"); });

  /* ---------- drawings with SMIL motion run only while on screen (less repaint under the glass nav) */
  if ("IntersectionObserver" in W) {
    var svgIO = new IntersectionObserver(function (es) { es.forEach(function (e) { var sv = e.target; if (!sv.pauseAnimations) return; if (e.isIntersecting && motion()) sv.unpauseAnimations(); else sv.pauseAnimations(); }); });
    setTimeout(function () { $$("svg").forEach(function (sv) { if (sv.querySelector("animate, animateMotion, set")) svgIO.observe(sv); }); }, 400);
  }

  /* ---------- nav scrolled state, and the mobile "Request access" bar (shown once the hero has gone, hidden over the closing CTA) */
  var nav = $("[data-nav]"), mbar = $("[data-mbar]"), heroOut = false, ctaIn = false, ticking = false;
  function bar() { if (mbar) mbar.classList.toggle("on", heroOut && !ctaIn); }
  onView($(".ahero"), function (v) { heroOut = !v; bar(); }, .05);
  onView($(".cta"), function (v) { ctaIn = v; bar(); }, .1);
  function onScroll() { ticking = false; if (nav) nav.classList.toggle("is-scrolled", W.scrollY > 8); }
  W.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* ---------- careers form: validate, then post to the request-access endpoint (or open a pre-filled email) */
  $$("[data-hf]").forEach(function (f) {
    var done = D.getElementById(f.getAttribute("data-hf-done")), st = $(".hf__st", f), btn = $('[type="submit"]', f), sending = false;
    function val(i) {
      var v = (i.value || "").trim(),
        ok = !!v && (i.type !== "email" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) && (i.type !== "url" || /^https?:\/\/\S+\.\S+/.test(v));
      i.setAttribute("aria-invalid", ok ? "false" : "true");
      return ok;
    }
    $$("[required]", f).forEach(function (i) {
      var re = function () { if (i.getAttribute("aria-invalid") === "true") val(i); };
      i.addEventListener("input", re); i.addEventListener("change", re);
    });
    function showDone() {
      if (!done) return;
      $$("[data-done]", done).forEach(function (o) { var k = o.getAttribute("data-done"), n = f.elements[k], v = n ? (n.value || "").trim() : ""; if (k === "name") v = v.split(/\s+/)[0]; o.textContent = v || "Not given"; });
      f.hidden = true; done.hidden = false; done.classList.remove("is-in"); void done.offsetWidth; done.classList.add("is-in");
      var t = $("[tabindex]", done); if (t) t.focus({ preventScroll: true });
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault(); if (sending) return;
      var hp = $(".hf__hp input", f); if (hp && hp.value) { showDone(); return; } /* spam trap: drop quietly */
      var bad = $$("[required]", f).filter(function (i) { return !val(i); }), em = $("input[type=email]", f), ln = $("input[type=url]", f);
      if (bad.length) {
        st.textContent = bad.length > 1 ? "Please fill in the highlighted fields."
          : bad[0] === em && em.value.trim() ? "Please check your email."
          : bad[0] === ln && ln.value.trim() ? "Please add a full link, starting with https://"
          : "Please fill in the highlighted field.";
        bad[0].focus(); return;
      }
      st.textContent = "";
      var g = function (n) { return (f.elements[n].value || "").trim(); };
      var note = "Link: " + g("link") + (g("note") ? "\n\n" + g("note") : "");
      /* mapped onto the request-access handler's fields, so the existing Apps Script accepts it unchanged */
      var data = { name: g("name"), email: g("email"), org: "Careers · " + g("area"), role: "Other", need: note, website: "", page: location.href };
      var ok = function () { showDone(); (W.dataLayer = W.dataLayer || []).push({ event: "generate_lead", form: "careers", area: g("area") }); };
      var endpoint = f.dataset.endpoint;
      if (!endpoint) {
        var body = "Name: " + data.name + "\nEmail: " + data.email + "\nArea of work: " + g("area") + "\n" + note;
        location.href = "mailto:" + f.dataset.to + "?subject=" + encodeURIComponent("Careers: " + g("area") + " · " + data.name) + "&body=" + encodeURIComponent(body);
        ok(); return;
      }
      sending = true; btn.disabled = true; st.textContent = "Sending…";
      /* text/plain keeps this a "simple" request, so Apps Script gets it without a CORS preflight */
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json(); })
        .then(function (res) { if (!res || !res.ok) throw new Error("failed"); st.textContent = ""; ok(); })
        .catch(function () { st.textContent = "That didn't send. Please try again, or email " + f.dataset.to + "."; })
        .then(function () { sending = false; btn.disabled = false; });
    });
    var again = done && $("[data-hf-again]", done);
    if (again) again.addEventListener("click", function () {
      f.reset(); $$("[aria-invalid]", f).forEach(function (i) { i.removeAttribute("aria-invalid"); });
      done.hidden = true; f.hidden = false; var first = $("input:not([type=hidden])", f); if (first) first.focus();
    });
  });

  /* ---------- "Back to top" in the footer */
  $$('a[href="#top"]').forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); W.scrollTo({ top: 0, behavior: motion() ? "smooth" : "auto" }); }); });
  /* ---------- founder cards: "focus pull" bio (hover the photo; tap on touch; Enter/Space; Esc closes) */
  var pps = $$("[data-pp]");
  if (pps.length) {
    var canHover = W.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var escH = function (w) { return w.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    $$("[data-pp-text]").forEach(function (p) {
      var src = p.textContent.trim().replace(/\s+/g, " ");
      p.setAttribute("aria-label", src);
      p.innerHTML = src.split(" ").map(function (w, i) { return '<span class="pp__w" aria-hidden="true" style="--i:' + i + '">' + escH(w) + "</span>"; }).join(" ");
      p.classList.add("is-split");
    });
    var ppOpen = function (c, open) {
      if (c.classList.contains("is-open") === open) return;
      c.classList.toggle("is-open", open);
      var t = $("[data-pp-trigger]", c); if (t) t.setAttribute("aria-expanded", open ? "true" : "false");
    };
    var ppCloseOthers = function (except) { pps.forEach(function (c) { if (c !== except) ppOpen(c, false); }); };
    var sizeScan = function () { pps.forEach(function (c) { var ph = $(".pp__ph", c); if (ph) ph.style.setProperty("--h", ph.clientHeight + "px"); }); };
    sizeScan(); W.addEventListener("resize", sizeScan);
    pps.forEach(function (c) {
      var t = $("[data-pp-trigger]", c); if (!t) return;
      if (canHover) {
        t.addEventListener("pointerenter", function () { ppCloseOthers(c); ppOpen(c, true); });
        t.addEventListener("pointerleave", function () { ppOpen(c, false); });
      }
      t.addEventListener("click", function (e) {
        e.stopPropagation(); if (canHover) return; /* hover already opened it */
        var open = !c.classList.contains("is-open"); ppCloseOthers(c); ppOpen(c, open);
      });
      t.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault(); var open = !c.classList.contains("is-open"); ppCloseOthers(c); ppOpen(c, open);
      });
    });
    D.addEventListener("click", function (e) { if (!e.target.closest("[data-pp]")) ppCloseOthers(null); });
    D.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      pps.forEach(function (c) { if (c.classList.contains("is-open")) { ppOpen(c, false); if (c.contains(D.activeElement)) { var t = $("[data-pp-trigger]", c); if (t) t.focus(); } } });
    });
  }
})(window, document);
