/* =====================================================================
   Page behaviour (no 3D here): motion, the hero stage card, the hero twin,
   tooltips, nav, reveal and the request-access form. The 3D module plugs
   into the same PL hooks and events.
   ===================================================================== */
(function (W, D) {
  "use strict";
  var PL = W.PL, html = D.documentElement;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || D).querySelectorAll(s)); }
  function emit(n, d) { W.dispatchEvent(new CustomEvent(n, { detail: d })); }
  function onView(el, fn, th, margin) { if (!el) return; if (!("IntersectionObserver" in W)) { fn(true); return; } var io = new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting, e); }); }, { threshold: th || 0, rootMargin: margin || "0px" }); io.observe(el); return io; }
  PL.onView = onView; PL.emit = emit;

  /* ---------- motion follows the reader's system setting (prefers-reduced-motion); there is no on-page switch */
  var mq = W.matchMedia ? W.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  PL.motion = !mq.matches;
  html.classList.toggle("no-motion", !PL.motion);
  if (mq.addEventListener) mq.addEventListener("change", function (e) { PL.motion = !e.matches; html.classList.toggle("no-motion", !PL.motion); emit("pl:motion", PL.motion); });

  /* ---------- WebGL support, and what counts as a phone: under 768 px, or a touch screen under 1024 px */
  /* a cheap feature test at load: creating a real WebGL context here cost ~1 s of main thread before first paint.
     hero3d.js makes the real check once the page has painted, and calls PL.no3D() if it fails */
  PL.webgl = !!W.WebGL2RenderingContext;
  PL.mobile = function () { return W.innerWidth < 768 || !!(W.matchMedia && W.matchMedia("(pointer: coarse)").matches && W.innerWidth < 1024); };

  /* ---------- shared tooltip */
  var tip = $("[data-tip]"), tn = $("[data-tip-n]"), tt = $("[data-tip-t]"), td = $("[data-tip-d]"), tipT = 0;
  PL.tip = {
    show: function (x, y, o) {
      clearTimeout(tipT); tn.textContent = o.n || ""; tn.className = "tip__n mono" + (o.def ? " def" : ""); tt.textContent = o.t || ""; td.textContent = o.d || "";
      tip.hidden = false; var r = tip.getBoundingClientRect(), vw = W.innerWidth;
      var lx = Math.min(vw - r.width - 12, Math.max(12, x + 14)), ly = y - r.height - 14; if (ly < 70) ly = y + 18;
      tip.style.transform = ""; tip.style.left = lx + "px"; tip.style.top = ly + "px";
      requestAnimationFrame(function () { tip.classList.add("on"); });
    },
    hide: function () { tip.classList.remove("on"); clearTimeout(tipT); tipT = setTimeout(function () { tip.hidden = true; }, 130); }
  };
  W.addEventListener("scroll", function () { PL.tip.hide(); }, { passive: true });

  /* ---------- the stage card
     While the attack plays, the 3D scene calls PL.hud(k) for 01 to 05 and PL.hudStop() at the stop.
     Once the dome settles it fires "pl:settled"; the card then steps through all ten stages, 5 s each.
     Hover or focus pauses it; it resumes 2 s after the pointer leaves. A click shows that stage and pauses 8 s.
     After the settle a click never rewinds the scene: it only lights the matching machine ("pl:light"). */
  var hnext = $("[data-hud-next-sec]"), hud = $("[data-hud]"), hn = $("[data-hud-n]"), htag = $("[data-hud-tag]"), hname = $("[data-hud-name]"), hd = $("[data-hud-d]"), bar = $("[data-hud-bar]"), hlive = $("[data-hud-live]");
  var STOP = 4, N = PL.STAGES.length, pad = function (i) { return (i < 9 ? "0" : "") + (i + 1); };
  PL.STAGES.forEach(function (s, i) { var b = D.createElement("button"); b.type = "button"; b.className = "seg seg--" + (i < STOP ? "atk" : i === STOP ? "stop" : "if"); b.setAttribute("aria-label", "Stage " + pad(i) + ", " + s.tag + ": " + s.n); b.dataset.k = i; bar.appendChild(b); });
  var segs = $$("button", bar), cur = 0, settled = false, auto = 0, holdUntil = 0, hovering = false, resumeT = 0;
  function paint(k, mode) { /* mode: "play" while the attack runs, "stop" for the summary, "tour" after the settle */
    var s = PL.STAGES[k], stop = mode === "stop";
    hud.dataset.zone = stop ? "stop" : k < STOP ? "atk" : k === STOP ? "atk" : "if";
    hud.classList.toggle("is-stopped", stop); hud.classList.toggle("is-tour", mode === "tour");
    hn.innerHTML = (stop ? "05" : pad(k)) + "<small>/10</small>";
    htag.textContent = stop ? "Day 23" : s.tag; htag.className = "hud__tag mono" + (!stop && k > STOP ? " hud__tag--if" : "");
    hname.textContent = stop ? "Stopped at stage 05" : s.n;
    hd.textContent = stop ? "The attack took five quiet steps over 23 days before it was stopped." : s.d;
    segs.forEach(function (b, i) {
      b.classList.toggle("cur", stop ? i === STOP : i === k);
      b.classList.toggle("on", mode === "play" ? i <= k : true); /* during the attack the bar fills as it goes; afterwards it shows the whole map */
    });
    hud.classList.toggle("is-mapped", mode !== "play");
    hud.classList.toggle("is-running", mode === "tour" && settled && PL.motion && !hovering && Date.now() >= holdUntil);
    /* the graphic marks the stage the card shows; while the attack plays, the moving agent is the marker */
    light(mode === "play" ? -1 : stop ? STOP : k);
    /* the last stage points on to the rest of the page */
    if (hnext) hnext.hidden = !(mode === "tour" && k === N - 1);
  }
  var lit = null, userLight = false; function light(k) { if (k === lit) return; lit = k; emit("pl:light", { k: k, user: userLight }); userLight = false; }
  function announce(k) { if (!hlive) return; var s = PL.STAGES[k]; hlive.textContent = "Stage " + pad(k) + " of 10, " + s.tag + ". " + s.n + ". " + s.d; }
  PL.hud = function (k) { if (settled) return; cur = k; paint(k, "play"); };
  PL.hudStop = function () { cur = STOP; paint(STOP, "stop"); };
  function tick() { if (!settled || hovering || Date.now() < holdUntil) return; cur = (cur + 1) % N; paint(cur, "tour"); }
  function startTour() { if (auto || !PL.motion) return; auto = setInterval(tick, 5000); }
  function settle() { if (settled) return; settled = true; html.classList.add("hero-tour"); setTimeout(function () { if (!PL.motion) return; cur = 0; paint(0, "tour"); startTour(); }, 2000); }
  W.addEventListener("pl:settled", settle);
  function pick(k, user) {
    k = (k + N) % N; cur = k; holdUntil = Date.now() + 8000; userLight = !!user; paint(k, settled || !PL.motion ? "tour" : "play"); if (user) announce(k);
    if (settled || !PL.live.hero || k > STOP) { paint(k, "tour"); return; } /* paint() lights the machine */
    emit("pl:jump", k); /* before the settle, 01 to 05 still replay the attack from that stage */
  }
  segs.forEach(function (b) { b.addEventListener("click", function () { pick(+b.dataset.k, true); }); });
  var prev = $("[data-hud-prev]"), next = $("[data-hud-next]");
  if (prev) prev.addEventListener("click", function () { pick(cur - 1, true); });
  if (next) next.addEventListener("click", function () { pick(cur + 1, true); });
  hud.addEventListener("mouseenter", function () { hovering = true; hud.classList.remove("is-running"); clearTimeout(resumeT); });
  hud.addEventListener("mouseleave", function () { clearTimeout(resumeT); resumeT = setTimeout(function () { hovering = false; }, 2000); });
  hud.addEventListener("focusin", function () { hovering = true; hud.classList.remove("is-running"); clearTimeout(resumeT); });
  hud.addEventListener("focusout", function () { clearTimeout(resumeT); resumeT = setTimeout(function () { hovering = false; }, 2000); });
  /* screen readers: the whole story once, in order */
  var sr = $("[data-hero-sr]"); sr.innerHTML = PL.STAGES.map(function (s, i) { return "<li>Stage " + pad(i) + ", " + s.tag + ": " + s.n + ". " + s.d + "</li>"; }).join("") + "<li>The attack is stopped at stage 05.</li>";

  /* ---------- the hero twin (shown before 3D loads, and as the static figure with reduced motion or no WebGL) */
  PL.live = {};
  function heroTwin() { var svg = $('[data-twin="hero"]'); if (!svg) return; var g = PL.heroTwin(svg, STOP); placeHeroHits(g); }
  /* focusable stage targets over the picture, so tooltips work by tap and keyboard too */
  var hitWrap = D.createElement("div"); hitWrap.className = "hero__hits"; hitWrap.style.cssText = "position:absolute;inset:0;pointer-events:none"; $(".hero__stage").appendChild(hitWrap);
  PL.STAGES.forEach(function (s, i) {
    var b = D.createElement("button"); b.type = "button"; b.className = "stage-hit"; b.tabIndex = -1; b.setAttribute("aria-label", "Stage " + pad(i) + ", " + s.tag + ": " + s.n + ". " + s.d); b.dataset.k = i;
    function show() { var r = b.getBoundingClientRect(); PL.tip.show(r.left + r.width / 2, r.top + r.height / 2, { n: pad(i) + " / 10 · " + s.tag, t: s.n, d: s.d, def: i > STOP }); }
    b.addEventListener("mouseenter", show); b.addEventListener("focus", show); b.addEventListener("click", show);
    b.addEventListener("mouseleave", PL.tip.hide); b.addEventListener("blur", PL.tip.hide);
    hitWrap.appendChild(b);
  });
  PL.heroHits = $$(".stage-hit", hitWrap);
  function stagePoint(i) { var s = PL.STAGES[i]; if (!s.m) { var p = PL.PATH[PL.STAGE_IDX[0]]; return [p[0], p[1], p[2]]; } var m = PL.M[s.m]; return [m.x, m.y + (m.h || 0.04), m.z]; }
  PL.stagePoint = stagePoint;
  function placeHeroHits(g) { if (PL.live.hero) return; PL.heroHits.forEach(function (b, i) { var p = g.pr(stagePoint(i)); b.style.left = p[0] + "px"; b.style.top = p[1] + "px"; }); }
  function drawTwins() { heroTwin(); if (PL.tileTwin) $$("[data-tile]").forEach(function (s) { PL.tileTwin(s, s.dataset.tile); }); }
  PL.drawTwins = drawTwins;

  /* ---------- nav: mark the section in view */
  (function () { var links = $$(".nav__links a"); if (!links.length || !("IntersectionObserver" in W)) return; var map = {};
    links.forEach(function (a) { var h = a.getAttribute("href"); if (h.length < 2) return; var id = h.slice(1), el = D.getElementById(id); if (el) map[id] = a; });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && map[e.target.id]) { links.forEach(function (a) { a.classList.remove("is-cur"); }); map[e.target.id].classList.add("is-cur"); } }); }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { io.observe(D.getElementById(id)); }); })();
  /* About us and Careers are listed but not built yet: the links stay in place and say so */
  $$("[data-soon]").forEach(function (a) { a.setAttribute("aria-disabled", "true"); a.setAttribute("title", "Coming soon");
    a.addEventListener("click", function (e) { e.preventDefault(); a.classList.add("is-soon"); setTimeout(function () { a.classList.remove("is-soon"); }, 1400); }); });

  /* ---------- reveal: once, 12px rise, staggered within a group */
  $$(".rv").forEach(function (el) { el.style.setProperty("--rd", (Array.prototype.indexOf.call(el.parentNode.children, el) * 60) + "ms"); });
  if ("IntersectionObserver" in W) { var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } }); }, { threshold: .15 }); $$(".rv").forEach(function (el) { rio.observe(el); }); } else $$(".rv").forEach(function (el) { el.classList.add("in"); });

  /* ---------- nav, menu, mobile bar */
  var nav = $("[data-nav]"), menuB = $("[data-menu]"), mm = $("[data-mmenu]"), mbar = $("[data-mbar]"), heroEl = $(".hero"), briefEl = $("#briefing");
  /* the menu button and mobile menu are optional (the header may have no links); skip them when they are not on the page */
  if (menuB && mm) {
    menuB.addEventListener("click", function () { var o = menuB.getAttribute("aria-expanded") !== "true"; menuB.setAttribute("aria-expanded", o ? "true" : "false"); menuB.setAttribute("aria-label", o ? "Close menu" : "Open menu"); mm.hidden = !o; });
    $$("a", mm).forEach(function (a) { a.addEventListener("click", function () { if (!a.hasAttribute("data-soon")) menuB.click(); }); });
    D.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuB.getAttribute("aria-expanded") === "true") { menuB.click(); menuB.focus(); } });
  }
  var heroOut = false, briefIn = false;
  if (mbar) {
    onView(heroEl, function (v) { heroOut = !v; mbar.classList.toggle("on", heroOut && !briefIn); }, 0.05);
    onView(briefEl, function (v) { briefIn = v; mbar.classList.toggle("on", heroOut && !briefIn); }, 0.1);
  }
  var ticking = false;
  function onScroll() { ticking = false; nav.classList.toggle("is-scrolled", W.scrollY > 8); }
  W.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- request-access form
     Validates, then posts JSON to the Google Apps Script endpoint (data-endpoint), which adds a row to the
     Google Sheet and emails the team. With no endpoint configured it opens a pre-filled email instead. */
  var form = $("[data-form]"), st = $("#f-status"), sendBtn = $('[type="submit"]', form), endpoint = form.dataset.endpoint, sending = false;
  function status(text, cls) { st.className = "form__st" + (cls ? " " + cls : ""); st.textContent = text; }
  form.addEventListener("submit", function (e) {
    e.preventDefault(); if (sending) return; status(""); var miss = [], bad = false;
    $$("[required]", form).forEach(function (f) {
      var empty = !f.value.trim(), mal = !empty && f.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value);
      f.setAttribute("aria-invalid", empty || mal ? "true" : "false");
      if (empty) miss.push($('label[for="' + f.id + '"]', form).textContent.trim().toLowerCase()); if (mal) bad = true;
    });
    if (miss.length || bad) { status((miss.length ? "Please add your " + (miss.length > 1 ? miss.slice(0, -1).join(", ") + " and " + miss[miss.length - 1] : miss[0]) + "." : "") + (bad ? " Please check your work email." : "")); $('[aria-invalid="true"]', form).focus(); return; }
    var f = function (n) { return form.elements[n].value.trim(); };
    var data = { name: f("name"), email: f("email"), org: f("org"), role: f("role"), need: f("need"), website: f("website"), page: location.href };
    var done = function () { showDone(data); form.reset(); (W.dataLayer = W.dataLayer || []).push({ event: "generate_lead", form: "request_access", role: data.role }); };
    if (data.website) { done(); return; } /* spam trap filled: drop quietly */

    if (!endpoint) { /* no endpoint yet: open a pre-filled email, as in the prototype */
      var body = "Name: " + data.name + "\nWork email: " + data.email + "\nOrganisation: " + data.org + "\nRole: " + data.role + "\n\nWhat I would need to see first:\n" + data.need;
      location.href = "mailto:" + form.dataset.to + "?subject=" + encodeURIComponent("Access request: " + data.org) + "&body=" + encodeURIComponent(body);
      status("Thank you. Your email app has the request ready to send.", "ok");
      return;
    }
    sending = true; sendBtn.disabled = true; status("Sending your request…", "is-pending");
    /* text/plain keeps this a "simple" request, so the browser sends it to Apps Script without a CORS preflight */
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); })
      .then(function (res) { if (!res || !res.ok) throw new Error((res && res.error) || "failed"); done(); })
      .catch(function () { status("That didn't send. Please try again, or email " + form.dataset.to + "."); })
      .then(function () { sending = false; sendBtn.disabled = false; });
  });
  /* success state: the form gives way to a confirmation card; "Send another request" brings the form back */
  var doneEl = $("[data-form-done]");
  function showDone(d) {
    status("");
    $("[data-done-name]", doneEl).textContent = d.name; $("[data-done-email]", doneEl).textContent = d.email;
    $("[data-done-org]", doneEl).textContent = d.org; $("[data-done-role]", doneEl).textContent = d.role;
    form.hidden = true; doneEl.hidden = false; doneEl.classList.remove("is-in");
    void doneEl.offsetWidth; doneEl.classList.add("is-in"); /* restart the draw-in */
    $("[data-done-title]", doneEl).focus({ preventScroll: true });
    var r = doneEl.getBoundingClientRect(); if (r.top < 80 || r.top > W.innerHeight * 0.6) doneEl.scrollIntoView({ behavior: PL.motion ? "smooth" : "auto", block: "center" });
  }
  $("[data-done-again]", doneEl).addEventListener("click", function () { doneEl.hidden = true; doneEl.classList.remove("is-in"); form.hidden = false; form.elements.name.focus(); });
  $$("input, select, textarea", form).forEach(function (f) { f.addEventListener("input", function () { if (f.getAttribute("aria-invalid") === "true") f.setAttribute("aria-invalid", "false"); }); });

  /* ---------- first paint. With motion and 3D, the card starts at stage 01 and follows the attack.
     Without them (reduced motion or no WebGL) it rests on the stop summary; with motion but no 3D it still tours after a moment. */
  if (PL.motion && PL.webgl) { PL.hud(0); setTimeout(function () { if (!PL.live.hero && !settled) { PL.hudStop(); settle(); } }, 6000); } /* safety: the 3D never started */
  else { PL.hudStop(); if (PL.motion) setTimeout(settle, 1200); }
  /* the 3D module calls this if the real WebGL check fails: same result as having no WebGL from the start */
  PL.no3D = function () { if (!PL.live.hero && !settled) { PL.hudStop(); if (PL.motion) setTimeout(settle, 1200); } };
  function stillNote() { var fi = $(".hud__fine"); if (!fi) return; if (!PL.motion) { fi.textContent = "Animations are off in your browser, so this shows the end of the attack. Use the arrows to step through all ten stages."; hud.classList.add("is-still-note"); } else { fi.textContent = "This is one example of how an AI attack can unfold."; hud.classList.remove("is-still-note"); } }
  stillNote(); W.addEventListener("pl:motion", stillNote);
  drawTwins();
  var rt = 0; W.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(drawTwins, 120); });
  W.addEventListener("pl:motion", function () { if (!PL.motion) { clearInterval(auto); auto = 0; PL.hudStop(); } else if (settled) startTour(); });
  PL.settle = settle;
  onScroll();
})(window, document);
