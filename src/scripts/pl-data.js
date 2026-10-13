/* =====================================================================
   HERO NETWORK · shared data and the 2D twin engine
   One layout feeds both the 3D hero and its SVG twin, so the two
   always match. Coordinates are scene units: x right, z toward the
   viewer, y up. Ground at y = 0; the core sits on a 0.15 plinth.
   ===================================================================== */
(function (W) {
  "use strict";
  var PL = W.PL = {};
  /* the defender colour: a warm pale amber beside ember */
  PL.DEF = "#E8C9A0"; PL.DEF_RGB = "232,201,160";

  /* ---------- zones */
  PL.ZONES = [
    { id: "core", label: "Core", r: 2.7 },
    { id: "corporate", label: "Corporate", r: 5.0 },
    { id: "edge", label: "Edge", r: 7.5 }
  ];
  PL.PLINTH = { r: 2.7, h: 0.15 };
  function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  PL.groundY = function (x, z) { return Math.hypot(x, z) < PL.PLINTH.r ? PL.PLINTH.h : 0; };
  PL.pathGround = function (x, z) { return PL.PLINTH.h * smooth(PL.PLINTH.r + 0.12, PL.PLINTH.r - 0.06, Math.hypot(x, z)); };

  /* ---------- machines. w = width (x), d = depth (z), h = height */
  var B = { w: 1.0, d: 0.62 };
  PL.MACHINES = [
    { id: "mail", label: "Mail gateway", x: -5.4, z: 2.6, w: B.w, d: B.d, h: 0.32, type: "server", zone: "edge" },
    { id: "vpn", label: "VPN", x: 0.7, z: 6.0, w: B.w, d: B.d, h: 0.18, type: "base", zone: "edge", deco: 1 },
    { id: "pubweb", label: "Public web app", x: 5.6, z: 2.0, w: B.w, d: B.d, h: 0.32, type: "server", zone: "edge", deco: 1 },
    { id: "laptops", label: "Employee laptops", x: -4.0, z: -1.5, type: "laptops", zone: "corporate" },
    { id: "wiki", label: "Wiki server", x: -1.4, z: -3.9, w: B.w, d: B.d, h: 0.32, type: "server", zone: "corporate" },
    { id: "files", label: "File share", x: 3.4, z: 3.0, w: B.w, d: B.d, h: 0.18, type: "base", zone: "corporate", deco: 1 },
    { id: "intweb", label: "Internal web app", x: 3.6, z: -2.0, w: B.w, d: B.d, h: 0.32, type: "server", zone: "corporate" },
    { id: "build", label: "Build server", x: 1.35, z: -1.05, w: B.w, d: B.d, h: 0.32, type: "server", zone: "core" },
    { id: "backup", label: "Backup server", x: 1.35, z: 1.05, w: B.w, d: B.d, h: 0.32, type: "server", zone: "core" },
    { id: "hyper", label: "Hypervisor", x: -1.35, z: 1.05, w: B.w, d: B.d, h: 0.32, type: "server", zone: "core" },
    { id: "dc", label: "Domain controller", x: -1.35, z: -1.05, w: B.w, d: B.d, h: 0.32, type: "server", zone: "core" },
    { id: "store", label: "Data store", x: 0, z: 0, w: 0.8, d: 0.8, h: 0.55, type: "store", zone: "core" },
    { id: "dns", label: "DNS", x: -2.8, z: 6.0, w: B.w, d: B.d, h: 0.18, type: "base", zone: "edge", deco: 1 },
    { id: "api", label: "API gateway", x: 6.0, z: -2.6, w: B.w, d: B.d, h: 0.32, type: "server", zone: "edge", deco: 1 },
    { id: "partner", label: "Partner link", x: -6.3, z: -2.4, w: B.w, d: B.d, h: 0.18, type: "base", zone: "edge", deco: 1 },
    { id: "remote", label: "Remote access", x: 3.9, z: 5.4, w: B.w, d: B.d, h: 0.18, type: "base", zone: "edge", deco: 1 },
    { id: "print", label: "Print server", x: -3.6, z: 2.5, w: B.w, d: B.d, h: 0.18, type: "base", zone: "corporate", deco: 1 },
    { id: "hr", label: "HR system", x: 0.6, z: -4.1, w: B.w, d: B.d, h: 0.32, type: "server", zone: "corporate", deco: 1 }
  ];
  PL.M = {}; PL.MACHINES.forEach(function (m) { PL.M[m.id] = m; m.y = PL.groundY(m.x, m.z); });
  /* laptops: a tight cluster of 7 thin slabs, 4 in front, 3 behind */
  PL.LAPTOPS = [];
  (function () {
    var L = PL.M.laptops, rows = [[-0.93, -0.31, 0.31, 0.93], [-0.62, 0, 0.62]];
    rows.forEach(function (r, ri) { r.forEach(function (ox, k) { PL.LAPTOPS.push({ x: L.x + ox, z: L.z + (ri === 0 ? 0.25 : -0.25), w: 0.5, d: 0.34, h: 0.04, half: ri === 1 && k === 1 ? 0 : (ri === 1 ? 1 : 0) }); }); });
    L.w = 2.36; L.d = 0.84; L.h = 0.04;
  })();

  /* ---------- the ten stages of the illustrated attack. 01 to 05 play out; 06 to 10 are what happens if it isn't stopped */
  var IF = "If it isn't stopped";
  PL.STAGES = [
    { n: "Looks around from outside", d: "Maps the company from the outside, noting which systems are exposed and who uses them.", tag: "Day 0", m: null },
    { n: "Gets in through email", d: "Slips in through the mail gateway and starts collecting passwords.", tag: "Day 1", m: "mail" },
    { n: "Steals saved passwords", d: "Pulls saved passwords and login sessions out of employees' browsers.", tag: "Day 4", m: "laptops" },
    { n: "Breaks into the wiki", d: "Breaks into the internal wiki and reads it for more ways in.", tag: "Day 11", m: "wiki" },
    { n: "Takes over the web app", d: "Exploits an internal web app and gives itself admin rights.", tag: "Day 23", m: "intweb" },
    { n: "Picks apart the build server", d: "Reverse-engineers software on the build server to reach protected data.", tag: IF, m: "build" },
    { n: "Leaves hidden ways back in", d: "Plants hidden access that survives a clean-up.", tag: IF, m: "backup" },
    { n: "Takes the servers", d: "Takes over the servers the business runs on.", tag: IF, m: "hyper" },
    { n: "Controls the whole network", d: "Takes control of the whole network, security tools included.", tag: IF, m: "dc" },
    { n: "Locks everything for ransom", d: "Encrypts the systems and demands payment to unlock them.", tag: IF, m: "store" }
  ];
  PL.STAGES.forEach(function (s, i) { s.i = i; if (s.m) PL.M[s.m].stage = i; });
  PL.RINGS = [{ m: "intweb", after: 4 }]; /* the attack is stopped at stage 05 */

  /* ---------- the Attack Line route (hand-authored to run beside cables, never through blocks) */
  var ANCH = [[-8.6, 4.6], [-5.4, 3.09], [-4.0, -0.9], [-1.4, -3.39], [3.6, -1.49], [1.35, -0.54], [1.35, 1.56], [-1.35, 1.56], [-1.35, -0.54], [0, 0.6]];
  var WAY = [
    [-8.6, 4.6], [-6.8, 4.6], [-6.8, 3.09], [-5.4, 3.09],             /* 01 → 02 */
    [-2.7, 3.09], [-2.7, -0.9], [-4.0, -0.9],                         /* → 03 */
    [-2.7, -0.9], [-2.7, -3.39], [-1.4, -3.39],                       /* → 04 */
    [2.6, -3.39], [2.6, -1.49], [3.6, -1.49],                         /* → 05 */
    [3.6, -0.54], [1.35, -0.54],                                      /* → 06 */
    [2.05, -0.54], [2.05, 1.56], [1.35, 1.56],                        /* → 07 */
    [-1.35, 1.56],                                                    /* → 08 */
    [-2.05, 1.56], [-2.05, -0.54], [-1.35, -0.54],                    /* → 09 */
    [-0.7, -0.54], [-0.7, 0.6], [0, 0.6]                              /* → 10 */
  ];

  /* rounded orthogonal polyline, resampled at a fixed step */
  PL.rounded = function (pts, rad, step) {
    var out = [];
    function push(x, z) { var l = out[out.length - 1]; if (!l || Math.hypot(l[0] - x, l[1] - z) > 1e-6) out.push([x, z]); }
    push(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], b = pts[i], c = pts[i + 1];
      var l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      var r = Math.min(rad, l1 / 2, l2 / 2);
      var p = [b[0] + (a[0] - b[0]) / l1 * r, b[1] + (a[1] - b[1]) / l1 * r], q = [b[0] + (c[0] - b[0]) / l2 * r, b[1] + (c[1] - b[1]) / l2 * r];
      push(p[0], p[1]);
      for (var k = 1; k <= 8; k++) { var t = k / 8, u = 1 - t; push(u * u * p[0] + 2 * u * t * b[0] + t * t * q[0], u * u * p[1] + 2 * u * t * b[1] + t * t * q[1]); }
    }
    push(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    if (!step) return out;
    var res = [out[0]], acc = 0;
    for (var j = 1; j < out.length; j++) {
      var s = out[j - 1], e = out[j], L = Math.hypot(e[0] - s[0], e[1] - s[1]), d = step - acc;
      while (d <= L) { res.push([s[0] + (e[0] - s[0]) * d / L, s[1] + (e[1] - s[1]) * d / L]); d += step; }
      acc = L - (d - step);
    }
    res.push(out[out.length - 1]);
    return res;
  };

  /* the attack route: one clean inward spiral. From recon outside the edge, the agent sweeps clockwise around the core,
     each stage a little closer: mail (edge) → laptops and wiki (corporate) → the internal web app, where it is contained.
     Radius eases between stages so the line never doubles back. After stage 05 the original cable route runs into the core. */
  (function () {
    var flat = [], step = 0.04;
    function polar(p) { return [Math.atan2(p[0], p[1]), Math.hypot(p[0], p[1])]; }
    var SP = [ANCH[0], ANCH[1], ANCH[2], ANCH[3], ANCH[4]], DIP = [0, 0.35, 0.2, 0.32];
    for (var k = 0; k < 4; k++) {
      var a = polar(SP[k]), b = polar(SP[k + 1]), a0 = a[0], a1 = b[0];
      while (a1 > a0 + 0.2) a1 -= Math.PI * 2;                /* clockwise; a small straight-in step is allowed */
      var arc = Math.abs(a1 - a0) * (a[1] + b[1]) / 2 + Math.abs(b[1] - a[1]), n = Math.max(12, Math.ceil(arc / step));
      for (var i = k === 0 ? 0 : 1; i <= n; i++) {
        var s = i / n, e = s * s * (3 - 2 * s), ang = a0 + (a1 - a0) * (k === 0 ? e : s), rr = a[1] + (b[1] - a[1]) * e - DIP[k] * Math.sin(Math.PI * s);
        flat.push([Math.sin(ang) * rr, Math.cos(ang) * rr]);
      }
    }
    var rest = PL.rounded(WAY.slice(12), 0.28, step); rest.shift(); flat = flat.concat(rest);
    var idx = [];
    ANCH.forEach(function (a) { var bi = 0, bd = 1e9; flat.forEach(function (p, i) { var d = Math.hypot(p[0] - a[0], p[1] - a[1]); if (d < bd && (idx.length === 0 || i > idx[idx.length - 1])) { bd = d; bi = i; } }); idx.push(bi); });
    var pts = flat.map(function (p) { return [p[0], PL.pathGround(p[0], p[1]) + 0.03, p[1]]; });
    /* a single low leap where the agent crosses the edge ring from outside */
    for (var q = idx[0]; q <= idx[1]; q++) pts[q][1] += 0.3 * Math.pow(Math.max(0, Math.sin(Math.PI * (q - idx[0]) / (idx[1] - idx[0]))), 1.4);
    var len = [0]; for (var m = 1; m < pts.length; m++) len.push(len[m - 1] + Math.hypot(pts[m][0] - pts[m - 1][0], pts[m][1] - pts[m - 1][1], pts[m][2] - pts[m - 1][2]));
    PL.PATH = pts; PL.PATH_LEN = len; PL.PATH_TOTAL = len[len.length - 1];
    PL.STAGE_IDX = idx; PL.STAGE_U = idx.map(function (i) { return len[i] / PL.PATH_TOTAL; });
  })();
  PL.pathAt = function (u) {
    var L = u * PL.PATH_TOTAL, len = PL.PATH_LEN, lo = 0, hi = len.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (len[m] < L) lo = m; else hi = m; }
    var a = PL.PATH[lo], b = PL.PATH[hi], t = len[hi] > len[lo] ? (L - len[lo]) / (len[hi] - len[lo]) : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };

  /* ---------- cables on the ground: attack-route legs plus quiet extra runs */
  PL.CABLES = [
    WAY.slice(3, 7), WAY.slice(6, 10), WAY.slice(9, 13), WAY.slice(12, 15), WAY.slice(14, 18), WAY.slice(17, 19), WAY.slice(18, 22),
    [[0.7, 5.69], [0.7, 4.2], [3.4, 4.2], [3.4, 3.31]],
    [[5.6, 1.69], [5.6, -1.49], [4.1, -1.49]],
    [[3.4, 2.69], [3.4, 2.3], [2.2, 2.3], [2.2, 1.56], [1.85, 1.56]],
    [[-5.4, 2.29], [-5.4, 0.2], [-4.0, 0.2], [-4.0, -0.9]],
    [[0.85, -1.05], [0.2, -1.05], [0.2, -0.4]], [[0.85, 1.05], [0.2, 1.05], [0.2, 0.4]],
    [[-0.85, 1.05], [-0.2, 1.05], [-0.2, 0.4]], [[-0.85, -1.05], [-0.2, -1.05], [-0.2, -0.4]],
    [[-1.4, -4.21], [-1.4, -4.6], [1.0, -4.6], [1.0, -2.2], [1.35, -2.2], [1.35, -1.36]]
  ].map(function (w) { return PL.rounded(w, 0.12, 0.05).map(function (p) { return [p[0], PL.groundY(p[0], p[1]) + 0.006, p[1]]; }); });

  /* =====================================================================
     Camera maths shared by 3D and 2D (vertical fov, spherical orbit)
     ===================================================================== */
  PL.camPos = function (c) {
    var az = c.az * Math.PI / 180, el = c.el * Math.PI / 180, t = c.target || [0, 0, 0];
    return [t[0] + c.dist * Math.cos(el) * Math.sin(az), t[1] + c.dist * Math.sin(el), t[2] + c.dist * Math.cos(el) * Math.cos(az)];
  };
  PL.projector = function (c, Wd, Ht) {
    var p = PL.camPos(c), t = c.target || [0, 0, 0];
    var f = norm(sub(t, p)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), k = (Ht / 2) / Math.tan(c.fov * Math.PI / 360), ox = (c.offX || 0) * Wd, oy = (c.offY || 0) * Ht;
    function pr(q) { var d = sub(q, p), z = dot(d, f); return [Wd / 2 + ox + dot(d, r) / z * k, Ht / 2 - oy - dot(d, u) / z * k, z]; }
    pr.pos = p; return pr;
  };
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  PL.vec = { sub: sub, dot: dot, cross: cross, norm: norm };

  /* hero camera, shared: long lens, 36° elevation, core right of centre on wide screens.
     Stage 05 (the internal web app, where the attack is contained) sits near the centre of the picture. */
  PL.heroCam = function (w, h) {
    var a = w / h, mob = a < 0.9;
    var az = W.__AZ != null ? +W.__AZ : 115, M5 = PL.M.intweb;
    return { az: az, el: 36, fov: 30, dist: mob ? 22 : (a > 1.6 ? 15.5 : 17.5), target: [M5.x * 0.78, 0.55, M5.z * 0.78], offX: a > 1.15 ? (a > 1.9 ? 0.25 : 0.23) : 0, offY: a > 1.15 ? 0.06 : 0 };
  };

  /* =====================================================================
     2D TWIN ENGINE · axonometric SVG in the same projection
     ===================================================================== */
  var C = { top: "#1D1D1D", left: "#131313", right: "#0F0F0F", infra: "rgba(220,220,220,.35)", infraLo: "rgba(220,220,220,.16)", line: "rgba(220,220,220,.11)", attack: "#E5484D", core: "#FF7A70", head: "#FFC7C0", defend: "#56CF8E", fg3: "#808080", fg2: "#A8A8A8" };
  PL.C2 = C;
  function f1(n) { return Math.round(n * 10) / 10; }
  function pts(arr) { return arr.map(function (p) { return f1(p[0]) + "," + f1(p[1]); }).join(" "); }
  PL.svgPts = pts;

  /* one block as three shaded faces, in camera space (painter's order handled by caller) */
  function blockSVG(pr, b, opt) {
    opt = opt || {};
    var x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y0 = b.y || 0, y1 = y0 + b.h + (opt.lift || 0), y0l = y0 + (opt.lift || 0);
    var cp = pr.pos, s = "";
    var top = [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].map(pr);
    var fz = cp[2] > z1 ? [[x0, y0l, z1], [x1, y0l, z1], [x1, y1, z1], [x0, y1, z1]] : [[x1, y0l, z0], [x0, y0l, z0], [x0, y1, z0], [x1, y1, z0]];
    var fx = cp[0] > x1 ? [[x1, y0l, z1], [x1, y0l, z0], [x1, y1, z0], [x1, y1, z1]] : [[x0, y0l, z0], [x0, y0l, z1], [x0, y1, z1], [x0, y1, z0]];
    var hot = opt.hot ? 1 : 0;
    s += '<polygon points="' + pts(fz.map(pr)) + '" fill="' + C.left + '"/>';
    s += '<polygon points="' + pts(fx.map(pr)) + '" fill="' + C.right + '"/>';
    s += '<polygon points="' + pts(top) + '" fill="' + C.top + '"/>';
    /* machined panel line on the top face */
    var ins = 0.03, it = [[x0 + ins, y1, z0 + ins], [x1 - ins, y1, z0 + ins], [x1 - ins, y1, z1 - ins], [x0 + ins, y1, z1 - ins]].map(pr);
    if (b.w > 0.3) s += '<polygon points="' + pts(it) + '" fill="none" stroke="' + C.line + '" stroke-width=".6"/>';
    /* top-edge highlight */
    s += '<polygon points="' + pts(top) + '" fill="none" stroke="' + (hot ? C.attack : C.infra) + '" stroke-width="' + (hot ? 1 : .75) + '" stroke-opacity="' + (hot ? .9 : 1) + '"/>';
    /* rack seams + LEDs on the front (+z) face of servers */
    if ((b.type === "server" || b.type === "store") && cp[2] > z1) {
      var n = b.type === "store" ? 0 : 3;
      for (var i = 1; i <= n; i++) { var yy = y0l + (y1 - y0l) * i / (n + 1); s += '<polyline points="' + pts([[x0 + 0.05, yy, z1], [x1 - 0.05, yy, z1]].map(pr)) + '" stroke="' + C.line + '" stroke-width=".6" fill="none"/>'; }
      if (b.type === "server") for (var l = 0; l < 5; l++) { var lp = pr([x1 - 0.12 - l * 0.055, y0l + (y1 - y0l) * 0.78, z1 + 0.001]); s += '<circle cx="' + f1(lp[0]) + '" cy="' + f1(lp[1]) + '" r=".9" fill="' + (hot && l % 2 === 0 ? C.attack : "rgba(" + PL.DEF_RGB + ",.3)") + '"/>'; }
    }
    /* data store: vertical flutes across the two visible faces */
    if (b.type === "store") {
      for (var g = 1; g < 6; g++) {
        var xx = x0 + b.w * g / 6; if (cp[2] > z1) s += '<polyline points="' + pts([[xx, y0l + 0.02, z1], [xx, y1 - 0.02, z1]].map(pr)) + '" stroke="rgba(220,220,220,.13)" stroke-width=".6"/>';
        var zz = z0 + b.d * g / 6; if (cp[0] > x1) s += '<polyline points="' + pts([[x1, y0l + 0.02, zz], [x1, y1 - 0.02, zz]].map(pr)) + '" stroke="rgba(220,220,220,.1)" stroke-width=".6"/>';
      }
    }
    return s;
  }
  function shadowSVG(pr, b) {
    var g = 0.12, y = (b.y || 0) + 0.001, q = [[b.x - b.w / 2 - g, y, b.z - b.d / 2 - g], [b.x + b.w / 2 + g, y, b.z - b.d / 2 - g], [b.x + b.w / 2 + g, y, b.z + b.d / 2 + g], [b.x - b.w / 2 - g, y, b.z + b.d / 2 + g]].map(pr);
    return '<polygon points="' + pts(q) + '" fill="#000" fill-opacity=".35" filter="url(#tw-soft)"/>';
  }
  function circle3(cx, cz, r, y, n) { var a = []; for (var i = 0; i <= (n || 72); i++) { var t = i / (n || 72) * Math.PI * 2; a.push([cx + Math.sin(t) * r, y, cz + Math.cos(t) * r]); } return a; }
  PL.circle3 = circle3;

  /* the network itself: ground, zones, plinth, cables, blocks */
  PL.twinNetwork = function (pr, o) {
    o = o || {};
    var s = "", mob = o.mobile, R = o.reach == null ? -1 : o.reach;
    /* ground grid, fading radially. Each 1-unit segment gets its own opacity, but segments are grouped into
       12 opacity steps and drawn as one <path> per step: the same picture with ~12 elements instead of ~1,000 */
    var STEPS = 12, AMAX = 0.16, bucket = [];
    for (var g = -11; g <= 11; g++) {
      var major = g % 5 === 0;
      for (var k = -11; k < 11; k++) {
        var segs = [[[g, 0, k], [g, 0, k + 1]], [[k, 0, g], [k + 1, 0, g]]];
        segs.forEach(function (sg) {
          var mx = (sg[0][0] + sg[1][0]) / 2, mz = (sg[0][2] + sg[1][2]) / 2, rr = Math.hypot(mx, mz), a = Math.max(0, 1 - rr / 11); if (a < 0.03) return;
          a = a * a * (major ? 0.16 : 0.08);
          var b = Math.min(STEPS - 1, Math.round(a / AMAX * (STEPS - 1))), p0 = pr(sg[0]), p1 = pr(sg[1]);
          (bucket[b] || (bucket[b] = [])).push("M" + f1(p0[0]) + " " + f1(p0[1]) + "L" + f1(p1[0]) + " " + f1(p1[1]));
        });
      }
    }
    bucket.forEach(function (d, b) { if (d && b) s += '<path d="' + d.join("") + '" stroke="#DCDCDC" stroke-opacity="' + (b / (STEPS - 1) * AMAX).toFixed(3) + '" stroke-width=".6" fill="none"/>'; });
    /* zone rings, dashed */
    PL.ZONES.forEach(function (zn) { s += '<polyline points="' + pts(circle3(0, 0, zn.r, zn.id === "core" ? 0 : 0.001, 160).map(pr)) + '" fill="none" stroke="rgba(220,220,220,.2)" stroke-width=".7" stroke-dasharray="3 5"/>'; });
    /* core plinth: top disc + visible front band */
    var top = circle3(0, 0, PL.PLINTH.r, PL.PLINTH.h, 120), bot = circle3(0, 0, PL.PLINTH.r, 0, 120);
    s += '<polygon points="' + pts(bot.map(pr)) + '" fill="#000" fill-opacity=".4" filter="url(#tw-soft)"/>';
    var band = []; for (var i = 0; i <= 120; i++) { var p = top[i]; if (p[0] * pr.pos[0] + p[2] * pr.pos[2] > 0) band.push(i); }
    if (band.length) { var a1 = band.map(function (i) { return pr(top[i]); }), a2 = band.slice().reverse().map(function (i) { return pr(bot[i]); }); s += '<polygon points="' + pts(a1.concat(a2)) + '" fill="#0D0D0D"/>'; }
    s += '<polygon points="' + pts(top.map(pr)) + '" fill="#0C0C0C" stroke="rgba(220,220,220,.22)" stroke-width=".75"/>';
    /* cables */
    PL.CABLES.forEach(function (cb) { s += '<polyline points="' + pts(cb.map(pr)) + '" fill="none" stroke="rgba(220,220,220,.22)" stroke-width=".75" vector-effect="non-scaling-stroke"/>'; });
    /* blocks, far to near */
    var blocks = [];
    PL.MACHINES.forEach(function (m) {
      if (m.type === "laptops") PL.LAPTOPS.forEach(function (l) { if (mob && l.half) return; blocks.push({ x: l.x, z: l.z, y: 0, w: l.w, d: l.d, h: l.h, type: "laptop", hot: m.stage != null && m.stage <= R }); });
      else { if (mob && m.deco && m.id !== "vpn") return; blocks.push({ x: m.x, z: m.z, y: m.y, w: m.w, d: m.d, h: m.h, type: m.type, hot: m.stage != null && m.stage <= R }); }
    });
    (o.extra || []).forEach(function (b) { blocks.push(b); });
    blocks.forEach(function (b) { b.dz = pr([b.x, b.y || 0, b.z])[2]; });
    blocks.sort(function (a, b) { return b.dz - a.dz; });
    blocks.forEach(function (b) { s += shadowSVG(pr, b); });
    blocks.forEach(function (b) { s += blockSVG(pr, b, { hot: b.hot }); });
    return s;
  };
  PL.blockSVG = blockSVG; PL.shadowSVG = shadowSVG;

  PL.twinDefs = function () {
    return '<defs><filter id="tw-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>' +
      '<filter id="tw-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>' +
      '<radialGradient id="tw-head"><stop offset="0" stop-color="#FFC7C0"/><stop offset=".35" stop-color="#E5484D" stop-opacity=".55"/><stop offset="1" stop-color="#E5484D" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="tw-pool"><stop offset="0" stop-color="#E5484D" stop-opacity=".22"/><stop offset="1" stop-color="#E5484D" stop-opacity="0"/></radialGradient></defs>';
  };

  /* the Attack Line in 2D: core + glow + round head, up to arc fraction u */
  PL.twinAttack = function (pr, u, cls) {
    var n = PL.PATH.length, last = 0; for (var i = 0; i < n; i++) if (PL.PATH_LEN[i] / PL.PATH_TOTAL <= u) last = i;
    var p = PL.PATH.slice(0, last + 1).map(pr), hp = pr(PL.pathAt(u)); p.push(hp);
    var d = pts(p);
    return '<g class="' + (cls || "tw-atk") + '"><polyline points="' + d + '" fill="none" stroke="#E5484D" stroke-opacity=".4" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#tw-glow)"/>' +
      '<polyline points="' + d + '" fill="none" stroke="#FF7A70" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle class="tw-head" cx="' + f1(hp[0]) + '" cy="' + f1(hp[1]) + '" r="11" fill="url(#tw-head)"/><circle cx="' + f1(hp[0]) + '" cy="' + f1(hp[1]) + '" r="2.4" fill="#FFC7C0"/></g>';
  };
  PL.twinRings = function (pr) {
    var s = "";
    PL.RINGS.forEach(function (r) {
      var m = PL.M[r.m], y = PL.groundY(m.x, m.z) + 0.004;
      s += '<polyline points="' + pts(circle3(m.x, m.z, 0.82, y, 96).map(pr)) + '" fill="none" stroke="' + PL.DEF + '" stroke-width="1.2"/>';
      s += '<polyline points="' + pts(circle3(m.x, m.z, 0.98, y, 96).map(pr)) + '" fill="none" stroke="' + PL.DEF + '" stroke-opacity=".5" stroke-width=".9" stroke-dasharray="4 4"/>';
    });
    return s;
  };

  /* full hero twin (poster frame and static tier) */
  PL.heroTwin = function (svg, reach) {
    var r = svg.getBoundingClientRect(), Wd = Math.max(320, r.width), Ht = Math.max(240, r.height);
    var cam = PL.heroCam(Wd, Ht), pr = PL.projector(cam, Wd, Ht), mob = Wd < 700, R = reach == null ? 9 : reach;
    var s = PL.twinDefs() + PL.twinNetwork(pr, { mobile: mob, reach: R }) + PL.twinRings(pr) + PL.twinAttack(pr, PL.STAGE_U[R]);
    /* pool of ember light under the last reached machine */
    var lm = PL.M[PL.STAGES[R].m || "mail"], lp = pr([lm.x, lm.y, lm.z]);
    s = s.replace('<g class="tw-atk">', '<ellipse cx="' + f1(lp[0]) + '" cy="' + f1(lp[1]) + '" rx="70" ry="28" fill="url(#tw-pool)"/><g class="tw-atk">');
    svg.setAttribute("viewBox", "0 0 " + Math.round(Wd) + " " + Math.round(Ht));
    svg.innerHTML = s;
    return { pr: pr, W: Wd, H: Ht };
  };
})(window);
