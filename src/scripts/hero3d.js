/* =====================================================================
   HERO NETWORK · 3D module (three.js r160, loaded after first paint)
   One scene, one material set, one render pipeline.
   Pipeline: RenderPass → UnrealBloom (only ember and bone exceed the
   threshold) → SMAA/FXAA → OutputPass → vignette + dither.
   three.js is imported from npm and split into its own chunk by Vite,
   so it only downloads when the hero is about to play.
   ===================================================================== */
const PL = window.PL;
let T, A = {};
const D = document;
const live = PL.live;
const EASE = (t) => { t = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - t, 3.2); };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
/* blending happens in linear light; convert a design opacity (as seen on screen) to the linear alpha that gives it */
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linA = (a, fg, bg) => { fg = fg || 236 / 255; bg = bg || 10 / 255; const target = s2l(bg + a * (fg - bg)); return (target - s2l(bg)) / (s2l(fg) - s2l(bg)); };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/* ---------------------------------------------------------------------
   Boot: wait for first paint, then load three and its official addons
   --------------------------------------------------------------------- */
async function boot() {
  if (!PL.webgl) return;
  await new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 900 }) : setTimeout(r, 300)));
  /* the real WebGL2 check (moved here from page load), with the test context released at once */
  try { const gl = D.createElement("canvas").getContext("webgl2"); if (!gl) throw 0; const lose = gl.getExtension("WEBGL_lose_context"); lose && lose.loseContext(); }
  catch (e) { PL.webgl = false; PL.no3D && PL.no3D(); return; }
  try {
    T = await import("three");
    const m = await Promise.all([
      import("three/examples/jsm/postprocessing/EffectComposer.js"), import("three/examples/jsm/postprocessing/RenderPass.js"),
      import("three/examples/jsm/postprocessing/UnrealBloomPass.js"), import("three/examples/jsm/postprocessing/SMAAPass.js"),
      import("three/examples/jsm/postprocessing/OutputPass.js"), import("three/examples/jsm/postprocessing/ShaderPass.js"),
      import("three/examples/jsm/environments/RoomEnvironment.js"), import("three/examples/jsm/geometries/RoundedBoxGeometry.js"),
      import("three/examples/jsm/utils/BufferGeometryUtils.js"), import("three/examples/jsm/shaders/FXAAShader.js")
    ]);
    Object.assign(A, m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9]);
  } catch (e) { console.warn("3D unavailable, keeping the 2D figures", e); return; }
  /* tone mapping: identity below 0.6, a soft filmic shoulder above, so the page colours and the
     brand ember stay exact while bloom highlights roll off */
  T.ShaderChunk.tonemapping_pars_fragment = T.ShaderChunk.tonemapping_pars_fragment.replace(
    "vec3 CustomToneMapping( vec3 color ) { return color; }",
    "vec3 CustomToneMapping( vec3 color ) { color *= toneMappingExposure; vec3 x = max( color - 0.6, 0.0 ); return min( color, 0.6 + x / ( 1.0 + x / 0.4 ) ); }");
  Tier.init();
  Kit.init();
  Manager.init();
}

/* ---------------------------------------------------------------------
   Quality tiers: one per session, stepping down silently if frames run long
   --------------------------------------------------------------------- */
const Tier = {
  name: "high",
  init() {
    const mob = PL.mobile();
    let t = mob ? "low" : "high";
    try { const c = D.createElement("canvas").getContext("webgl2"); const ext = c && c.getExtension("WEBGL_debug_renderer_info"); const r = ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ""; if (!mob && /swiftshader|llvmpipe|mali|adreno/i.test(r)) t = "medium"; } catch (e) {}
    try { const s = sessionStorage.getItem("pl-tier"); if (s) t = s; } catch (e) {}
    const q = /[?&]tier=(high|medium|low)/.exec(location.search); if (q) t = q[1];
    this.name = t;
  },
  /* render resolution. Phones run the "low" tier but have 2x-3x screens: at 1x the scene was stretched and looked
     blurry on iPhones, so phones render at up to 2x (phoneDpr), stepping down to 1.5x and 1x if frames run slow */
  phoneDpr: 2,
  get dpr() { const d = window.devicePixelRatio || 1; if (this.name === "low" && PL.mobile()) return Math.min(d, this.phoneDpr); return Math.min(d, this.name === "high" ? 1.5 : this.name === "medium" ? 1.25 : 1); },
  get shadows() { return this.name !== "low"; },
  get bloomScale() { return this.name === "high" ? 1 : this.name === "medium" ? 0.75 : 0.5; },
  get smaa() { return this.name !== "low"; },
  get drift() { return this.name !== "low" && !PL.mobile(); },
  slow: 0, acc: 0,
  sample(dt) { /* average frame time over 2 s; above 24 ms, step down once */
    this.acc += dt; this.slow = this.slow * 0.95 + dt * 0.05;
    if (this.acc > 2 && this.slow > 0.024 && this.name !== "low") {
      this.name = this.name === "high" ? "medium" : "low"; this.acc = 0;
      try { sessionStorage.setItem("pl-tier", this.name); } catch (e) {}
      Manager.retier();
    } else if (this.acc > 2 && this.slow > 0.04 && this.name === "low" && PL.mobile() && this.phoneDpr > 1) {
      /* a phone under 25 fps: lower the resolution a step (2x → 1.5x → 1x) without rebuilding the scene */
      this.phoneDpr = Math.max(1, this.phoneDpr - 0.5); this.acc = 0;
      const st = Manager.it && Manager.it.stage; if (st) st.resize();
    }
  }
};

/* ---------------------------------------------------------------------
   Kit: shared materials, geometries, textures and shaders (the "world")
   --------------------------------------------------------------------- */
const COL = {};
const Kit = {
  init() {
    COL.ink = new T.Color("#111111"); COL.ink2 = new T.Color("#1A1A1A");
    /* the hero is the only 3D scene: a red attack and a green protective dome */
    COL.attack = new T.Color("#E5484D"); COL.core = new T.Color("#FF7A70"); COL.head = new T.Color("#FFC7C0");
    COL.defend = new T.Color("#56CF8E"); COL.infra = new T.Color("#DCDCDC"); COL.fg = new T.Color("#EEEEEE");
    COL.idle = new T.Color("#CCCCCC"); COL.model = new T.Color("#C8C8C8");
    this.graphite = new T.MeshStandardMaterial({ color: "#171717", roughness: 0.82, metalness: 0.08, envMapIntensity: 0.25 });
    this.graphiteTop = new T.MeshStandardMaterial({ color: "#1D1D1D", roughness: 0.78, metalness: 0.08, envMapIntensity: 0.25 });
    this.plinth = new T.MeshStandardMaterial({ color: "#101010", roughness: 0.9, metalness: 0.05, envMapIntensity: 0.25 });
    this.lineInfra = new T.LineBasicMaterial({ color: COL.infra, transparent: true, opacity: linA(0.24), depthWrite: false });
    this.lineFaint = new T.LineBasicMaterial({ color: COL.infra, transparent: true, opacity: linA(0.09), depthWrite: false });
    this.cable = new T.MeshBasicMaterial({ color: COL.infra, transparent: true, opacity: linA(0.13), depthWrite: false });
    this.shadowTex = this.makeShadowTex();
    this.glowTex = this.makeGlowTex();
    this.poolTex = this.makeGlowTex(true);
    this.box = {};
  },
  boxGeo(w, h, d) { const k = [w, h, d].map((v) => v.toFixed(3)).join("_"); if (!this.box[k]) this.box[k] = new A.RoundedBoxGeometry(w, h, d, 2, Math.min(0.015, h / 3)); return this.box[k]; },
  makeShadowTex() { /* a soft rounded-rectangle contact shadow (shadowBlur works everywhere, ctx.filter does not) */
    const c = D.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d");
    x.shadowColor = "rgba(0,0,0,1)"; x.shadowBlur = 22; x.shadowOffsetX = 400; x.fillStyle = "#000";
    x.beginPath(); x.roundRect ? x.roundRect(30 - 400, 30, 68, 68, 8) : x.rect(30 - 400, 30, 68, 68); x.fill();
    const t = new T.CanvasTexture(c); t.colorSpace = T.NoColorSpace; return t;
  },
  makeGlowTex(soft) {
    const c = D.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    if (soft) { g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.5, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)"); }
    else { g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.18, "rgba(255,255,255,.55)"); g.addColorStop(0.45, "rgba(255,255,255,.12)"); g.addColorStop(1, "rgba(255,255,255,0)"); }
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(c); return t;
  },
  /* ground: anti-aliased 1-px grid (fwidth), fading radially into the page colour */
  ground(bg, R, size) {
    const m = new T.ShaderMaterial({
      uniforms: { uBg: { value: bg.clone() }, uLine: { value: COL.infra.clone() }, uR: { value: R }, uA1: { value: linA(0.05) }, uA5: { value: linA(0.09) } },
      vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
      fragmentShader: "uniform vec3 uBg; uniform vec3 uLine; uniform float uR, uA1, uA5; varying vec3 vW;\n" +
        "float gl(vec2 p, float s){ vec2 q = p / s; vec2 g = abs(fract(q - .5) - .5) / max(fwidth(q), 1e-4); return 1. - min(min(g.x, g.y), 1.); }\n" +
        "void main(){ vec2 p = vW.xz; float f = 1. - smoothstep(uR * .2, uR, length(p)); float a = (gl(p, 1.) * uA1 + gl(p, 5.) * uA5) * f; gl_FragColor = vec4(mix(uBg, uLine, a), 1.); }",
      depthWrite: true
    });
    const g = new T.Mesh(new T.PlaneGeometry(size || 80, size || 80), m); g.rotation.x = -Math.PI / 2; return g;
  },
  /* the Attack Line shader: travelled part at 40%, the last 1.2 units at full, nothing ahead of the head */
  attackMat(glow) {
    return new T.ShaderMaterial({
      uniforms: { uHead: { value: 0 }, uTrail: { value: 0.05 }, uFade: { value: 1 }, uBase: { value: 0.4 }, uHotC: { value: COL.head.clone().multiplyScalar(glow ? 1.4 : 3.2) }, uHotK: { value: 0 }, uColor: { value: (glow ? COL.attack : COL.core).clone().multiplyScalar(glow ? 1 : 2.4) }, uAlpha: { value: glow ? 0.35 : 1 } },
      vertexShader: "varying float vU; varying vec3 vN; varying vec3 vV; void main(){ vU = uv.x; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform float uHead, uTrail, uFade, uBase, uAlpha, uHotK; uniform vec3 uColor, uHotC; varying float vU; varying vec3 vN; varying vec3 vV;\n" +
        "void main(){ if (vU > uHead) discard; float k = smoothstep(uHead - uTrail, uHead, vU); float a = mix(uBase, 1., k) * uFade * uAlpha;" +
        (glow ? " float r = abs(dot(normalize(vN), normalize(vV))); a *= pow(r, 2.);" : "") +
        " vec3 col = mix(uColor, uHotC, smoothstep(uHead - uTrail * .3, uHead, vU) * uHotK); gl_FragColor = vec4(col * a, 1.); }",
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
  },
  tubeLine(points, segs, r1, r2) { /* core + glow tube along a polyline, sharing the attack shader */
    const vs = []; points.forEach((p) => { const v = p.isVector3 ? p.clone() : new T.Vector3(p[0], p[1], p[2]); if (!vs.length || vs[vs.length - 1].distanceTo(v) > 1e-4) vs.push(v); });
    const curve = new T.CatmullRomCurve3(vs, false, "centripetal");
    const g = new T.Group(), core = new T.Mesh(new T.TubeGeometry(curve, segs, r1 || 0.008, 8, false), this.attackMat(false)), glow = new T.Mesh(new T.TubeGeometry(curve, Math.ceil(segs / 2), r2 || 0.04, 10, false), this.attackMat(true));
    glow.renderOrder = 5; core.renderOrder = 6; g.add(glow, core); g.userData = { curve, core, glow, len: curve.getLength() };
    g.setHead = (u) => { core.material.uniforms.uHead.value = u; glow.material.uniforms.uHead.value = u; };
    g.setFade = (f) => { core.material.uniforms.uFade.value = f; glow.material.uniforms.uFade.value = f; };
    g.setTrail = (units) => { const t = units / g.userData.len; core.material.uniforms.uTrail.value = t; glow.material.uniforms.uTrail.value = t; };
    g.setBase = (b) => { core.material.uniforms.uBase.value = b; glow.material.uniforms.uBase.value = b; };
    g.setHot = (k) => { core.material.uniforms.uHotK.value = k; glow.material.uniforms.uHotK.value = k; };
    return g;
  },
  sprite(color, size, add) { const m = new T.SpriteMaterial({ map: this.glowTex, color: color, transparent: true, depthWrite: false, blending: add === false ? T.NormalBlending : T.AdditiveBlending }); const s = new T.Sprite(m); s.scale.setScalar(size); return s; },
  ring(r0, r1, color, k, seg) { const m = new T.Mesh(new T.RingGeometry(r0, r1, seg || 96), new T.MeshBasicMaterial({ color: color.clone().multiplyScalar(k || 1), transparent: true, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; return m; },
  dashedRing(r0, r1, n, color, k) { const parts = []; for (let i = 0; i < n; i++) parts.push(new T.RingGeometry(r0, r1, 6, 1, (i / n) * Math.PI * 2, (Math.PI * 2 / n) * 0.55)); const g = A.mergeGeometries(parts); const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: color.clone().multiplyScalar(k || 1), transparent: true, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; return m; },
  /* light shaft: an open cone, brightest where it faces the camera, fading at both ends */
  beam(r0, r1, h, col, a) {
    const m = new T.ShaderMaterial({ uniforms: { uC: { value: col.clone() }, uA: { value: a } },
      vertexShader: "varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform vec3 uC; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.8); float y = vUv.y; float v = smoothstep(0., .3, y) * (1. - smoothstep(.7, 1., y)) * mix(1., .4, y); float a = f * v * uA; gl_FragColor = vec4(uC * a, a); }",
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const b = new T.Mesh(new T.CylinderGeometry(r0, r1, h, 48, 1, true), m); b.position.y = h / 2; b.renderOrder = 8; return b;
  },
  circleLine(r, y, mat, n) { const p = []; for (let i = 0; i <= (n || 160); i++) { const t = (i / (n || 160)) * Math.PI * 2; p.push(new T.Vector3(Math.sin(t) * r, y, Math.cos(t) * r)); } const l = new T.Line(new T.BufferGeometry().setFromPoints(p), mat); if (mat.isLineDashedMaterial) l.computeLineDistances(); return l; }
};

/* Life: small things that keep moving, on one clock */
const Life = {
  glow: [], last: -1,
  tick(now) {
    if (now === this.last) return; this.last = now; const t = now / 1000;
    const k = 0.72 + 0.38 * (0.5 + 0.5 * Math.sin(t * 1.15)); this.glow.forEach((m) => m.color.copy(COL.model).multiplyScalar(k));
    if (HW.tex && HW.tex.term) HW.tex.term.offset.y = Math.floor(t * 2.2) / 11; /* one line every 0.45 s, a stepped scroll like a real log */
  }
};
/* LED field: one instanced mesh for every LED in a scene */
function LedField(scene, machines) {
  const all = []; machines.forEach((mc) => mc.leds.forEach((p, li) => all.push({ p, mc, li, per: 0.9 + Math.random() * 0.7, ph: Math.random() * 6.28 })));
  if (!all.length) return { update() {} };
  const geo = new T.SphereGeometry(0.011, 8, 6);
  const mesh = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ toneMapped: true }), all.length);
  const mtx = new T.Matrix4(), c = new T.Color();
  all.forEach((L, i) => { mtx.makeTranslation(L.p.x, L.p.y, L.p.z); mesh.setMatrixAt(i, mtx); mesh.setColorAt(i, c.copy(COL.idle).multiplyScalar(0.07)); });
  scene.add(mesh);
  return {
    mesh,
    update(t) {
      all.forEach((L, i) => {
        const y = L.p.y + (L.mc.lift || 0); mtx.makeTranslation(L.p.x, y, L.p.z); mesh.setMatrixAt(i, mtx);
        const lk = L.mc.ledK || 1;
        if (L.mc.ledMode === "attack") { const on = Math.sin((t / L.per) * 6.283 + L.ph) > -0.1; c.copy(COL.attack).multiplyScalar(on ? 3.2 * lk : 0.25); }
        else if (L.mc.ledMode === "defend") c.copy(COL.defend).multiplyScalar(1.6 * lk);
        else { const b = Math.max(0, Math.sin((t / L.per) * 2.3 + L.ph * 3.1)); c.copy(COL.idle).multiplyScalar(0.06 + 1.1 * Math.pow(b, 30)); } /* idle drive lights blip now and then, like a real rack */
        mesh.setColorAt(i, c);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    }
  };
}
function cablesMesh(list, r) {
  const geos = list.map((pts) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2])), false, "centripetal"), Math.max(8, pts.length * 2), r || 0.006, 4, false));
  /* sockets: the cable rises 0.04 into each machine */
  list.forEach((pts) => { [pts[0], pts[pts.length - 1]].forEach((p) => { const s = new T.CylinderGeometry(0.014, 0.014, 0.04, 8); s.translate(p[0], p[1] + 0.02, p[2]); geos.push(s); }); });
  const m = new T.Mesh(A.mergeGeometries(geos.map((g) => g.index ? g.toNonIndexed() : g)), Kit.cable); m.renderOrder = 2; return m;
}

/* ---------------------------------------------------------------------
   HARDWARE KIT · detailed miniature machines for the hero network.
   Every machine is built from small parts merged per material, so a
   detailed rack costs about as much to draw as a plain block.
   --------------------------------------------------------------------- */
const HW = {
  init() {
    if (this.ready) return; this.ready = true;
    this.chassis = new T.MeshStandardMaterial({ color: "#181818", roughness: 0.62, metalness: 0.35, envMapIntensity: 0.55 });
    this.bezel = new T.MeshStandardMaterial({ color: "#0C0C0C", roughness: 0.5, metalness: 0.4, envMapIntensity: 0.5 });
    this.panel = new T.MeshStandardMaterial({ color: "#252525", roughness: 0.7, metalness: 0.25, envMapIntensity: 0.5 });
    this.metal = new T.MeshStandardMaterial({ color: "#505050", roughness: 0.32, metalness: 0.85, envMapIntensity: 0.9 });
    this.paper = new T.MeshStandardMaterial({ color: "#333333", roughness: 0.9, metalness: 0, envMapIntensity: 0.3 });
    this.tex = {};
    /* route skin: gunmetal with brushed-steel trim, for the machines the attack passes through */
    this.steel = {
      chassis: new T.MeshPhysicalMaterial({ color: "#303030", roughness: 0.42, metalness: 0.6, envMapIntensity: 0.85, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
      bezel: new T.MeshPhysicalMaterial({ color: "#0C0C0C", roughness: 0.3, metalness: 0.4, envMapIntensity: 0.7, clearcoat: 0.4, clearcoatRoughness: 0.3 }),
      panel: new T.MeshStandardMaterial({ color: "#464646", roughness: 0.5, metalness: 0.55, envMapIntensity: 0.7 }),
      metal: new T.MeshStandardMaterial({ color: "#9E9E9E", roughness: 0.32, metalness: 1, envMapIntensity: 1.1 }),
      paper: new T.MeshStandardMaterial({ color: "#808080", roughness: 0.8, metalness: 0.1, envMapIntensity: 0.6 })
    };
    this.graphite = {
      chassis: new T.MeshPhysicalMaterial({ color: "#242424", roughness: 0.34, metalness: 0.55, envMapIntensity: 1.0, clearcoat: 0.5, clearcoatRoughness: 0.2 }),
      bezel: new T.MeshPhysicalMaterial({ color: "#0A0A0A", roughness: 0.2, metalness: 0.3, envMapIntensity: 0.9, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
      panel: new T.MeshStandardMaterial({ color: "#424242", roughness: 0.45, metalness: 0.6, envMapIntensity: 0.9 }),
      metal: new T.MeshStandardMaterial({ color: "#979797", roughness: 0.3, metalness: 1, envMapIntensity: 1.1 }),
      paper: new T.MeshStandardMaterial({ color: "#656565", roughness: 0.8, metalness: 0.1 })
    };
  },
  /* screen textures: drawn once in white and grey, tinted by the material colour */
  screenTex(kind) {
    if (this.tex[kind]) return this.tex[kind];
    const W2 = 256, H2 = kind === "laptop" ? 160 : 176, c = D.createElement("canvas"); c.width = W2; c.height = H2; const x = c.getContext("2d");
    x.fillStyle = "#121212"; x.fillRect(0, 0, W2, H2);
    const line = (y, w, a, h) => { x.fillStyle = "rgba(255,255,255," + a + ")"; x.fillRect(14, y, w, h || 5); };
    if (kind === "web") { /* browser: chrome bar, nav, hero block, cards */
      x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(0, 0, W2, 22); [0, 1, 2].forEach((i) => { x.fillStyle = "rgba(255,255,255,.45)"; x.beginPath(); x.arc(12 + i * 11, 11, 3.2, 0, 7); x.fill(); });
      x.fillStyle = "rgba(255,255,255,.22)"; x.fillRect(52, 6, 150, 10);
      line(36, 70, 0.75, 7); line(50, 160, 0.3); line(60, 130, 0.3);
      for (let i = 0; i < 3; i++) { x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; x.strokeRect(14 + i * 78, 80, 68, 50); x.fillStyle = "rgba(255,255,255,.5)"; x.fillRect(22 + i * 78, 90, 30, 5); x.fillStyle = "rgba(255,255,255,.22)"; x.fillRect(22 + i * 78, 102, 50, 4); x.fillRect(22 + i * 78, 110, 40, 4); }
      x.fillStyle = "rgba(255,255,255,.6)"; x.fillRect(14, 144, 54, 16);
    } else if (kind === "wiki") { /* document: title, paragraphs, sidebar */
      x.fillStyle = "rgba(255,255,255,.12)"; x.fillRect(0, 0, 62, H2);
      for (let i = 0; i < 9; i++) { x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(10, 16 + i * 16, 36 - (i % 3) * 8, 5); }
      x.fillStyle = "rgba(255,255,255,.8)"; x.fillRect(78, 18, 110, 9);
      for (let i = 0; i < 9; i++) { x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(78, 40 + i * 14, 160 - (i % 4) * 22, 5); }
    } else if (kind === "mail") { /* inbox: rows with sender and subject */
      x.fillStyle = "rgba(255,255,255,.14)"; x.fillRect(0, 0, W2, 22); x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(12, 8, 40, 6);
      for (let i = 0; i < 7; i++) { const y = 32 + i * 20; x.fillStyle = "rgba(255,255,255," + (i === 1 ? 0.75 : 0.38) + ")"; x.fillRect(12, y, 48, 5); x.fillStyle = "rgba(255,255,255,.22)"; x.fillRect(70, y, 150 - (i % 3) * 30, 5); x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(0, y + 12, W2, 1); }
    } else if (kind === "term") { /* terminal: eleven prompt lines on a 16 px pitch, so the texture tiles and can scroll */
      for (let i = 0; i < 11; i++) { const w = 40 + ((i * 53) % 170); x.fillStyle = "rgba(255,255,255," + (i % 4 === 0 ? 0.7 : 0.32) + ")"; x.fillRect(12, 6 + i * 16, 6, 5); x.fillRect(24, 6 + i * 16, w, 5); if (i % 5 === 2) { x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(24 + w + 8, 6 + i * 16, 18, 5); } }
    } else { /* laptop desktop: two windows, a dock */
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 2; x.strokeRect(20, 18, 130, 84); x.strokeRect(110, 50, 128, 80);
      x.fillStyle = "rgba(255,255,255,.18)"; x.fillRect(20, 18, 130, 12); x.fillRect(110, 50, 128, 12);
      for (let i = 0; i < 4; i++) { x.fillStyle = "rgba(255,255,255,.28)"; x.fillRect(120, 72 + i * 12, 90 - i * 12, 4); }
      x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(70, 142, 116, 10);
    }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; if (kind === "term") t.wrapS = t.wrapT = T.RepeatWrapping; this.tex[kind] = t; return t;
  }
};

/* a parts list: boxes, rounded boxes and cylinders in machine-local space, merged per material at the end */
function Parts() {
  const L = { chassis: [], bezel: [], panel: [], metal: [], paper: [], accent: [], screen: [], lines: [], glow: [] };
  const add = (k, g) => { L[k].push(g.index ? g.toNonIndexed() : g); return g; };
  return {
    L,
    box(k, w, h, d, x, y, z) { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); return add(k, g); },
    rbox(k, w, h, d, x, y, z, r) { const g = new A.RoundedBoxGeometry(w, h, d, 2, Math.min(r || 0.012, h / 3, w / 3, d / 3)); g.translate(x, y, z); return add(k, g); },
    cyl(k, r, h, x, y, z, seg, axis) { const g = new T.CylinderGeometry(r, r, h, seg || 24); if (axis === "x") g.rotateZ(Math.PI / 2); if (axis === "z") g.rotateX(Math.PI / 2); g.translate(x, y, z); return add(k, g); },
    seg(...p) { L.lines.push(...p); }
  };
}
function strip(g) { /* keep only position and normal so every part merges */ const n = new T.BufferGeometry(); n.setAttribute("position", g.getAttribute("position")); n.setAttribute("normal", g.getAttribute("normal")); return n; }

/* drive-bay face: rows of caddies with a pull tab and a status light, on one face of a unit */
function bayFace(P, face, hw, hd, y0, y1, n, leds, origin) {
  const along = face[0] === "x" ? hd * 2 : hw * 2, sgn = face[1] === "+" ? 1 : -1, depth = face[0] === "x" ? hw : hd;
  const pad = 0.035, bw = (along - pad * 2) / n, bh = y1 - y0 - 0.02, yc = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) {
    const c = -along / 2 + pad + bw * (i + 0.5);
    const put = (k, w, h, dd, off, yy) => (face[0] === "x" ? P.box(k, dd, h, w, sgn * (depth + off), yy, c) : P.box(k, w, h, dd, c, yy, sgn * (depth + off)));
    put("bezel", bw - 0.008, bh, 0.006, 0.002, yc);
    put("panel", bw * 0.62, 0.006, 0.006, 0.006, yc - bh * 0.3);
    if (leds && i % 2 === 0) { const p = face[0] === "x" ? new T.Vector3(sgn * (depth + 0.012), yc + bh * 0.3, c + bw * 0.3) : new T.Vector3(c + bw * 0.3, yc + bh * 0.3, sgn * (depth + 0.012)); leds.push(p.add(origin)); }
  }
}
/* vent slats on a face */
function ventFace(P, face, hw, hd, y0, y1, n) {
  const along = face[0] === "x" ? hd * 2 : hw * 2, sgn = face[1] === "+" ? 1 : -1, depth = face[0] === "x" ? hw : hd;
  for (let i = 0; i < n; i++) { const y = y0 + ((y1 - y0) * (i + 0.5)) / n; if (face[0] === "x") P.box("bezel", 0.004, 0.006, along * 0.7, sgn * (depth + 0.001), y, 0); else P.box("bezel", along * 0.7, 0.006, 0.004, 0, y, sgn * (depth + 0.001)); }
}

/* one rack unit: chassis, front ears, bays on the two long faces, vents on the ends, a top seam */
function rackUnit(P, w, d, y, h, bays, leds, origin) {
  const hw = w / 2, hd = d / 2;
  P.rbox("chassis", w, h, d, 0, y + h / 2, 0, 0.01);
  P.box("panel", w - 0.04, 0.003, d - 0.04, 0, y + h + 0.0015, 0);
  bayFace(P, "z-", hw, hd, y + 0.012, y + h - 0.012, bays, leds, origin);
  bayFace(P, "x+", hw, hd, y + 0.012, y + h - 0.012, Math.max(3, Math.round(bays * d / w)), leds, origin);
  ventFace(P, "x-", hw, hd, y + 0.02, y + h - 0.02, 3); ventFace(P, "z+", hw, hd, y + 0.02, y + h - 0.02, 3);
  P.box("metal", 0.012, h - 0.01, 0.03, hw + 0.006, y + h / 2, -hd + 0.03); P.box("metal", 0.012, h - 0.01, 0.03, hw + 0.006, y + h / 2, hd - 0.03);
  /* status light strip, brushed top edge, handle bar and rear cable bundle */
  P.box("accent", w * 0.3, 0.006, 0.004, -hw + w * 0.2, y + h - 0.022, -hd - 0.011);
  P.box("accent", 0.004, 0.006, d * 0.26, hw + 0.013, y + h - 0.022, -hd + d * 0.24);
  P.box("metal", w - 0.02, 0.005, 0.007, 0, y + h + 0.0025, -hd + 0.0035); P.box("metal", 0.007, 0.005, d - 0.02, hw - 0.0035, y + h + 0.0025, 0);
  P.box("metal", w * 0.22, 0.008, 0.008, hw - w * 0.18, y + h * 0.5, -hd - 0.016);
  for (let k = 0; k < 3; k++) P.cyl("bezel", 0.007, h - 0.02, -hw + 0.05 + k * 0.018, y + h / 2, hd + 0.012, 6);
}
/* a framed screen standing on a machine, facing the camera side */
function screenOn(P, kind, w, h, x, y, z, rotY, list) {
  const g = new T.PlaneGeometry(w, h); g.rotateY(rotY); g.translate(x, y, z); list.push({ g, kind });
  const back = new T.BoxGeometry(w + 0.03, h + 0.03, 0.014); back.rotateY(rotY); const nx = Math.sin(rotY) * -0.009, nz = Math.cos(rotY) * -0.009; back.translate(x + nx, y, z + nz); P.L.bezel.push(back.toNonIndexed());
}

/* the machine itself */
function Hardware(scene, m, opt) {
  HW.init(); opt = opt || {};
  const g = new T.Group(), y0 = m.y || 0, P = Parts(), leds = [], screens = [], origin = new T.Vector3(m.x, y0, m.z);
  const id = m.id || "", type = m.type, w = m.w || 1, d = m.d || 0.6;
  const faceY = opt.faceY != null ? opt.faceY : 2.0; /* screens turn toward the hero camera */
  let H = m.h || 0.3;
  if (type === "server") {
    const units = id === "hyper" ? 1 : (opt.units || 3), uh = id === "hyper" ? 0.4 : 0.135; H = units * (uh + 0.012);
    if (id === "hyper") { /* blade chassis: one tall enclosure, vertical blades */
      P.rbox("chassis", w, uh, d, 0, uh / 2, 0, 0.012);
      for (let i = 0; i < 14; i++) { const z = -d / 2 + 0.05 + i * ((d - 0.1) / 13); P.box("bezel", 0.006, uh - 0.05, 0.026, w / 2 + 0.002, uh / 2, z); P.box("metal", 0.008, 0.012, 0.02, w / 2 + 0.006, uh - 0.05, z); if (i % 3 === 0) leds.push(new T.Vector3(w / 2 + 0.012, uh - 0.08, z).add(origin)); }
      for (let i = 0; i < 18; i++) { const x = -w / 2 + 0.06 + i * ((w - 0.12) / 17); P.box("bezel", 0.03, uh - 0.05, 0.006, x, uh / 2, -d / 2 - 0.002); if (i % 4 === 0) leds.push(new T.Vector3(x, uh - 0.08, -d / 2 - 0.012).add(origin)); }
      P.box("panel", w - 0.05, 0.003, d - 0.05, 0, uh + 0.0015, 0);
    } else for (let u = 0; u < units; u++) rackUnit(P, w, d, u * (uh + 0.012), uh, 8, leds, origin);
    /* identity on top */
    if (id === "mail") { /* envelope plate and a mail slot */
      const ty = H + 0.004; P.box("panel", 0.34, 0.006, 0.22, 0.05, ty, 0); P.seg(-0.12, ty + 0.005, -0.11, 0.05, ty + 0.005, 0, 0.05, ty + 0.005, 0, 0.22, ty + 0.005, -0.11, -0.12, ty + 0.005, -0.11, 0.22, ty + 0.005, -0.11, -0.12, ty + 0.005, 0.11, 0.22, ty + 0.005, 0.11, -0.12, ty + 0.005, -0.11, -0.12, ty + 0.005, 0.11, 0.22, ty + 0.005, -0.11, 0.22, ty + 0.005, 0.11);
      screenOn(P, "mail", 0.42, 0.26, -0.22, H + 0.17, 0.02, faceY, screens);
    } else if (id === "wiki") { /* a fan of pages and the wiki on screen */
      for (let i = 0; i < 4; i++) { const pg = new T.BoxGeometry(0.2, 0.004, 0.27); pg.rotateY(0.2 - i * 0.14); pg.translate(0.24 + i * 0.012, H + 0.004 + i * 0.008, -0.02 + i * 0.02); P.L.paper.push(pg.toNonIndexed()); }
      screenOn(P, "wiki", 0.42, 0.28, -0.18, H + 0.18, 0, faceY, screens);
    } else if (id === "intweb" || id === "pubweb" || id === "api" || id === "hr") { /* the web app: a monitor on an arm */
      const big = id === "intweb", sw = big ? 0.86 : 0.44, sh = big ? 0.52 : 0.28;
      P.cyl("metal", 0.014, 0.12, 0, H + 0.06, 0, 10); P.box("metal", big ? 0.22 : 0.14, 0.012, big ? 0.14 : 0.09, 0, H + 0.006, 0);
      screenOn(P, id === "hr" || id === "api" ? "term" : "web", sw, sh, 0, H + 0.12 + sh / 2, 0, faceY, screens);
    } else if (id === "build") { /* build server: a conveyor of packaged builds */
      P.box("metal", w * 0.86, 0.01, 0.12, 0, H + 0.006, 0);
      for (let i = 0; i < 4; i++) P.rbox(i === 3 ? "accent" : "panel", 0.12, 0.08, 0.1, -0.3 + i * 0.2, H + 0.052, 0, 0.008);
      screenOn(P, "term", 0.3, 0.2, 0.0, H + 0.24, -0.18, faceY, screens);
    } else if (id === "backup") { /* tape library: reels on top */
      for (let i = 0; i < 3; i++) { P.cyl("metal", 0.075, 0.02, -0.28 + i * 0.28, H + 0.012, 0, 28); P.cyl("bezel", 0.03, 0.022, -0.28 + i * 0.28, H + 0.013, 0, 16); }
      P.box("accent", w * 0.8, 0.004, 0.012, 0, H + 0.003, 0.2);
    } else if (id === "dc") { /* domain controller: a key plate */
      P.cyl("metal", 0.05, 0.02, -0.12, H + 0.012, 0, 24); P.box("metal", 0.26, 0.02, 0.04, 0.06, H + 0.012, 0); P.box("metal", 0.03, 0.02, 0.06, 0.16, H + 0.012, 0.04);
      screenOn(P, "term", 0.3, 0.2, 0.25, H + 0.18, 0, faceY, screens);
    } else if (id === "hyper") {
      for (let i = 0; i < 3; i++) P.rbox("panel", 0.22, 0.05, 0.36, -0.3 + i * 0.3, H + 0.027, 0, 0.008);
    }
  } else if (type === "store") { /* the data store: a drum of stacked platters */
    const r = Math.min(w, d) * 0.48; H = 0.62;
    for (let i = 0; i < 4; i++) { P.cyl("chassis", r, 0.13, 0, 0.07 + i * 0.15, 0, 48); P.cyl("accent", r + 0.004, 0.008, 0, 0.142 + i * 0.15, 0, 48); }
    P.cyl("panel", r - 0.04, 0.01, 0, 0.62, 0, 48); P.cyl("metal", 0.05, 0.02, 0, 0.635, 0, 20);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; leds.push(new T.Vector3(Math.cos(a) * (r + 0.01), 0.5, Math.sin(a) * (r + 0.01)).add(origin)); }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, rib = new T.BoxGeometry(0.012, 0.58, 0.02); rib.rotateY(-a); rib.translate(Math.cos(a) * (r + 0.006), 0.34, Math.sin(a) * (r + 0.006)); P.L.metal.push(rib.toNonIndexed()); }
  } else if (type === "laptop") { /* one open laptop: base, keyboard, hinge, lid with screen */
    const lw = w * 0.92, ld = d * 0.86; H = 0.2;
    P.rbox("chassis", lw, 0.018, ld, 0, 0.009, 0, 0.006);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) P.box("bezel", lw * 0.085, 0.003, ld * 0.09, -lw * 0.4 + c * lw * 0.1, 0.019, -ld * 0.3 + r * ld * 0.12);
    P.box("bezel", lw * 0.3, 0.003, ld * 0.16, 0, 0.019, ld * 0.3);
    const lid = new T.BoxGeometry(lw, ld * 0.92, 0.012); lid.translate(0, ld * 0.46, 0); lid.rotateX(-1.25); lid.translate(0, 0.02, -ld / 2); P.L.chassis.push(lid.toNonIndexed());
    const sg = new T.PlaneGeometry(lw * 0.88, ld * 0.78); sg.translate(0, ld * 0.46, 0.007); sg.rotateX(-1.25); sg.translate(0, 0.02, -ld / 2); screens.push({ g: sg, kind: "laptop" });
  } else { /* network appliances */
    H = 0.14; const hw = w / 2, hd = d / 2;
    if (id === "files") { /* NAS: four drive slots */
      P.rbox("chassis", w * 0.6, 0.3, d, 0, 0.15, 0, 0.012); H = 0.3;
      for (let i = 0; i < 4; i++) { P.box("bezel", 0.006, 0.05, d - 0.1, w * 0.3 + 0.002, 0.06 + i * 0.06, 0); leds.push(new T.Vector3(w * 0.3 + 0.01, 0.06 + i * 0.06, d / 2 - 0.08).add(origin)); }
    } else if (id === "print") { /* printer: body, paper tray, output sheet */
      P.rbox("chassis", w * 0.7, 0.16, d * 0.8, 0, 0.08, 0, 0.012); P.box("panel", w * 0.5, 0.01, d * 0.5, 0.08, 0.165, 0); P.box("paper", w * 0.36, 0.004, d * 0.4, 0.1, 0.175, 0.02); H = 0.18;
    } else { /* switch or router: port rows and status lights; antennas on VPN and remote access */
      P.rbox("chassis", w, 0.1, d, 0, 0.05, 0, 0.01); P.box("panel", w - 0.04, 0.003, d - 0.04, 0, 0.1015, 0);
      for (let i = 0; i < 12; i++) { const z = -hd + 0.06 + i * ((d - 0.12) / 11); P.box("bezel", 0.006, 0.026, 0.03, hw + 0.002, 0.045, z); if (i % 3 === 0) leds.push(new T.Vector3(hw + 0.01, 0.075, z).add(origin)); }
      for (let i = 0; i < 16; i++) { const x = -hw + 0.06 + i * ((w - 0.12) / 15); P.box("bezel", 0.034, 0.026, 0.006, x, 0.045, -hd - 0.002); }
      P.box("accent", 0.004, 0.006, d * 0.62, hw + 0.006, 0.088, 0); P.box("metal", w - 0.02, 0.005, 0.007, 0, 0.1025, -hd + 0.0035);
      if (id === "vpn" || id === "remote" || id === "partner") for (let i = 0; i < 2; i++) { P.cyl("metal", 0.008, 0.22, -hw + 0.1 + i * (w - 0.2), 0.21, -hd + 0.08, 8); P.cyl("bezel", 0.014, 0.02, -hw + 0.1 + i * (w - 0.2), 0.11, -hd + 0.08, 10); }
      if (id === "dns") for (let i = 0; i < 3; i++) P.cyl("accent", 0.03 + i * 0.03, 0.003, 0.25, 0.104, 0.05, 32);
    }
  }
  /* merge per material */
  const parts = [];
  ["chassis", "bezel", "panel", "metal", "paper"].forEach((k) => { if (!P.L[k].length) return; const mesh = new T.Mesh(A.mergeGeometries(P.L[k].map(strip)), (opt.skin || HW)[k]); mesh.castShadow = Tier.shadows; g.add(mesh); parts.push(mesh); });
  const accentMat = new T.MeshBasicMaterial({ color: COL.idle.clone().multiplyScalar(0.3) });
  if (P.L.accent.length) g.add(new T.Mesh(A.mergeGeometries(P.L.accent.map(strip)), accentMat));
  let glowMat = null; if (P.L.glow.length) { glowMat = new T.MeshBasicMaterial({ color: COL.model.clone() }); g.add(new T.Mesh(A.mergeGeometries(P.L.glow.map(strip)), glowMat)); Life.glow.push(glowMat); }
  /* each screen throws a soft pool of its own light onto the surface below it */
  const spillMats = Tier.name === "low" ? [] : screens.map((s) => { s.g.computeBoundingBox(); const bb = s.g.boundingBox, sw = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z, 0.2);
    const mat = new T.MeshBasicMaterial({ map: Kit.poolTex, color: COL.idle.clone().multiplyScalar(0.13), transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const sp = new T.Mesh(new T.PlaneGeometry(sw * 1.7, sw * 1.2).rotateX(-Math.PI / 2), mat); sp.position.set((bb.min.x + bb.max.x) / 2, type === "laptop" ? 0.021 : type === "desk" ? 0.376 : H + 0.005, (bb.min.z + bb.max.z) / 2); sp.renderOrder = 3; g.add(sp); return mat; });
  const screenMats = screens.map((s) => { const mat = new T.MeshBasicMaterial({ map: HW.screenTex(s.kind), color: COL.idle.clone().multiplyScalar(0.72), side: T.DoubleSide }); const ms = new T.Mesh(s.g, mat); g.add(ms); return mat; });
  /* line work: top outline plus any glyph lines */
  const hw = w / 2, hd = d / 2, ht = H + 0.002;
  const e = [-hw, ht, -hd, hw, ht, -hd, hw, ht, -hd, hw, ht, hd, hw, ht, hd, -hw, ht, hd, -hw, ht, hd, -hw, ht, -hd];
  const edgeMat = Kit.lineInfra.clone(); edgeMat.opacity = linA(0.16);
  const edge = new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(type === "store" || type === "laptop" ? [] : e, 3)), edgeMat); g.add(edge);
  if (P.L.lines.length) g.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(P.L.lines, 3)), accentMat.clone()));
  /* picking box and a soft contact shadow */
  const pick = new T.Mesh(Kit.boxGeo(w, Math.max(0.1, H), d), new T.MeshBasicMaterial({ visible: false })); pick.position.y = H / 2; g.add(pick);
  const sh = new T.Mesh(new T.PlaneGeometry(w * 1.9 + 0.3, d * 1.9 + 0.3), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false, alphaMap: Kit.shadowTex }));
  sh.rotation.x = -Math.PI / 2; sh.position.set(m.x, y0 + 0.002, m.z); sh.renderOrder = 1; scene.add(sh);
  g.position.set(m.x, y0, m.z); scene.add(g);
  const api = { m, g, body: pick, edge, edgeMat, eA: linA(0.16), leds, sh, lift: 0, liftT: 0, hot: 0, hotT: 0, safe: 0, safeT: 0, hover: 0, hoverT: 0, base: y0, accentMat, screenMats, spillMats, glowMat, H, parts };
  pick.userData.machine = api;
  return api;
}
/* a cluster of open laptops behaves as one machine */
function LaptopCluster(scene, m, laps) {
  const g = new T.Group(); scene.add(g);
  const parts = laps.map((l) => Hardware(g, { x: l.x - m.x, z: l.z - m.z, w: l.w, d: l.d + 0.12, h: 0.2, type: "laptop", y: 0 }));
  g.position.set(m.x, m.y || 0, m.z);
  const edgeMat = parts[0].edgeMat;
  const api = { m, g, body: null, edge: null, edgeMat, eA: linA(0.16), leds: [], parts, lift: 0, liftT: 0, hot: 0, hotT: 0, safe: 0, safeT: 0, hover: 0, hoverT: 0, base: m.y || 0, H: 0.2,
    accentMat: null, screenMats: parts.reduce((a, p) => a.concat(p.screenMats), []), spillMats: parts.reduce((a, p) => a.concat(p.spillMats), []) };
  parts.forEach((p) => { p.body.userData.machine = api; });
  return api;
}
/* colour state for detailed machines: screens and accents go ember when taken, bone when protected */
function tintHardware(mc, dt) {
  mc.safe = lerp(mc.safe || 0, mc.safeT || 0, 1 - Math.pow(0.001, dt / 0.6));
  const c = HW._c || (HW._c = new T.Color()), s = HW._s || (HW._s = new T.Color());
  c.copy(COL.idle).multiplyScalar(0.72).lerp(s.copy(COL.attack).multiplyScalar(1.3), mc.hot).lerp(s.copy(COL.defend).multiplyScalar(1.05), mc.safe * (1 - mc.hot));
  (mc.screenMats || []).forEach((m2) => m2.color.copy(c));
  (mc.spillMats || []).forEach((m2) => m2.color.copy(c).multiplyScalar(0.13 + 0.12 * mc.hot));
  if (mc.accentMat) { const ak = mc.accK || 1; mc.accentMat.color.copy(COL.idle).multiplyScalar(0.3 * ak).lerp(s.copy(COL.attack).multiplyScalar(2.2 * ak), mc.hot).lerp(s.copy(COL.defend).multiplyScalar(1.3 * ak), mc.safe * (1 - mc.hot)); }
}

/* ---------------------------------------------------------------------
   Stage: one canvas, one renderer, one composer. Scenes extend it.
   --------------------------------------------------------------------- */
class Stage {
  constructor(el, o) {
    this.el = el; this.o = o; this.bg = o.bg || COL.ink2;
    this.canvas = D.createElement("canvas"); this.canvas.setAttribute("aria-hidden", "true"); el.appendChild(this.canvas);
    const R = (this.R = new T.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: "high-performance", stencil: false }));
    R.outputColorSpace = T.SRGBColorSpace; R.toneMapping = T.CustomToneMapping; R.toneMappingExposure = 1;
    R.setPixelRatio(this.pr); R.setClearColor(this.bg, 1);
    R.shadowMap.enabled = Tier.shadows; R.shadowMap.type = T.PCFSoftShadowMap;
    this.scene = new T.Scene(); this.scene.background = this.bg.clone(); this.scene.fog = new T.FogExp2(this.bg, o.fog || 0.012);
    const pm = new T.PMREMGenerator(R); this.env = pm.fromScene(new A.RoomEnvironment(), 0.04).texture; this.scene.environment = this.env; pm.dispose();
    this.cam = new T.PerspectiveCamera(o.fov || 30, 1, 0.1, 200);
    this.camS = { az: 0, el: 30, dist: 15, tx: 0, ty: 0, tz: 0 }; this.camT = Object.assign({}, this.camS);
    this.drag = { on: false, ax: 0, ay: 0, vx: 0, vy: 0, x0: 0, y0: 0 }; this.drift = { x: 0, y: 0, tx: 0, ty: 0 };
    this.lights();
    if (o.dust !== false) this.addDust();
    this.overlay = el.querySelector(o.overlay || "nothing") || null;
    this.pick = []; this.labels = []; this.hovered = null;
    this.t = 0; this.visible = false; this.running = false; this.needs = true;
    this.buildComposer();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.bindPointer();
    this.resize();
  }
  lights() {
    this.key = new T.DirectionalLight("#E4E4E4", 1.25); this.rim = new T.DirectionalLight("#E6E6E6", 0.38);
    this.fill = new T.HemisphereLight(0x333333, 0x050505, 0.55); this.scene.add(this.fill);
    this.scene.add(this.key, this.key.target, this.rim, this.rim.target);
    if (Tier.shadows) { const k = this.key; k.castShadow = true; k.shadow.mapSize.set(Tier.name === "high" ? 4096 : 2048, Tier.name === "high" ? 4096 : 2048); k.shadow.bias = -0.0004; k.shadow.normalBias = 0.02; k.shadow.radius = 4; const s = this.o.shadowR || 9; Object.assign(k.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 }); }
  }
  get pr() { return Math.min(this.o.dprMax || 2, Math.max(Tier.dpr, this.o.dprMin || 0)); }
  /* atmosphere: fine motes drifting up through the light */
  addDust() {
    const n = Math.round((Tier.name === "high" ? 560 : Tier.name === "medium" ? 320 : 150) * (this.o.dustK == null ? 1 : this.o.dustK)), R = (this.o.shadowR || 9) * 1.05, H = 3.4;
    const pos = new Float32Array(n * 3), ph = new Float32Array(n); let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R; pos[i * 3] = Math.sin(a) * r; pos[i * 3 + 1] = rnd() * H; pos[i * 3 + 2] = Math.cos(a) * r; ph[i] = rnd(); }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("aPh", new T.BufferAttribute(ph, 1));
    this.dustM = new T.ShaderMaterial({ uniforms: { uT: { value: 0 }, uH: { value: H }, uC: { value: COL.infra.clone().multiplyScalar(0.5) }, uS: { value: 36 * Tier.dpr } },
      vertexShader: "attribute float aPh; uniform float uT, uH, uS; varying float vA; void main(){ vec3 p = position; float y = mod(p.y + uT * (0.04 + 0.06 * aPh), uH); p.y = y + 0.05; p.x += sin(uT * 0.21 + aPh * 6.283) * 0.3; p.z += cos(uT * 0.17 + aPh * 4.1) * 0.3; vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = uS * (0.4 + aPh) / max(1., -mv.z); float f = y / uH; vA = smoothstep(0., .2, f) * (1. - smoothstep(.55, 1., f)) * (0.3 + 0.7 * fract(aPh * 7.31)); }",
      fragmentShader: "uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(uC * a, a); }",
      transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const p = new T.Points(g, this.dustM); p.frustumCulled = false; p.renderOrder = 9; this.scene.add(p); this.dust = p;
  }
  placeLights(az) { /* key from the top-left of frame, rim from behind-right */
    const a = ((az - 55) * Math.PI) / 180, e = (55 * Math.PI) / 180, r = 20;
    this.key.position.set(Math.sin(a) * Math.cos(e) * r, Math.sin(e) * r, Math.cos(a) * Math.cos(e) * r);
    const b = ((az + 150) * Math.PI) / 180; this.rim.position.set(Math.sin(b) * 14, 6, Math.cos(b) * 14);
  }
  shadowCatcher(size) { if (!Tier.shadows) return; const p = new T.Mesh(new T.PlaneGeometry(size, size), new T.ShadowMaterial({ opacity: 0.4 })); p.rotation.x = -Math.PI / 2; p.position.y = 0.001; p.receiveShadow = true; this.scene.add(p); return p; }
  buildComposer() {
    const R = this.R; if (this.composer) this.composer.dispose();
    const C = (this.composer = new A.EffectComposer(R));
    C.addPass(new A.RenderPass(this.scene, this.cam));
    this.bloom = new A.UnrealBloomPass(new T.Vector2(256, 256), 0.55, 0.4, 0.82); C.addPass(this.bloom);
    if (Tier.smaa) { this.aa = new A.SMAAPass(256, 256); C.addPass(this.aa); } else { this.aa = new A.ShaderPass(A.FXAAShader); C.addPass(this.aa); }
    C.addPass(new A.OutputPass());
    /* vignette + dither, applied after the sRGB conversion so the grain stays below one code value step */
    this.fin = new A.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uV: { value: this.o.vignette == null ? 0.22 : this.o.vignette } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
      fragmentShader: "uniform sampler2D tDiffuse; uniform float uT, uV; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uT) * 43758.5453); }\n" +
        "void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; float v = 1. - uV * smoothstep(.25, .85, length(d * vec2(1.2, 1.))); c.rgb *= v; c.rgb += (h(gl_FragCoord.xy) - .5) * (2.5 / 255.); gl_FragColor = c; }"
    });
    C.addPass(this.fin);
  }
  resize() {
    const r = this.el.getBoundingClientRect(); const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    this.W = w; this.H = h; this.R.setPixelRatio(this.pr); this.R.setSize(w, h, false); this.composer.setPixelRatio(this.pr); this.composer.setSize(w, h);
    const bs = Tier.bloomScale; this.bloom.resolution.set(w * bs, h * bs); if (this.aa.setSize) this.aa.setSize(w * this.pr, h * this.pr);
    if (this.aa.material && this.aa.material.uniforms && this.aa.material.uniforms.resolution) this.aa.material.uniforms.resolution.value.set(1 / (w * this.pr), 1 / (h * this.pr));
    this.cam.aspect = w / h; this.onResize && this.onResize(w, h); this.cam.updateProjectionMatrix(); this.needs = true;
  }
  /* camera: spherical target + drag offset + cursor drift */
  applyCam(dt) {
    const s = this.camS, t = this.camT, k = 1 - Math.pow(1 - (this.camLerp || 0.08), dt * 60);
    if (this.camSpring) { /* a critically damped spring eases in as well as out */
      const w = this.camSpring, v = this.camV || (this.camV = {}), h = Math.min(dt, 0.034);
      for (const key in t) { const vv = v[key] || 0, a = w * w * (t[key] - s[key]) - 2 * w * vv; v[key] = vv + a * h; s[key] += v[key] * h; }
    } else for (const key in t) s[key] = lerp(s[key], t[key], k);
    const d = this.drag; if (!d.on) { const K = 120, C = 22; d.vx += (-K * d.ax - C * d.vx) * dt; d.vy += (-K * d.ay - C * d.vy) * dt; d.ax += d.vx * dt; d.ay += d.vy * dt; }
    const f = this.drift; f.x = lerp(f.x, f.tx, 1 - Math.pow(0.94, dt * 60)); f.y = lerp(f.y, f.ty, 1 - Math.pow(0.94, dt * 60));
    const az = ((s.az + d.ax + f.x) * Math.PI) / 180, el = (clamp(s.el + d.ay + f.y, 8, 50) * Math.PI) / 180;
    this.cam.position.set(s.tx + s.dist * Math.cos(el) * Math.sin(az), s.ty + s.dist * Math.sin(el), s.tz + s.dist * Math.cos(el) * Math.cos(az));
    this.cam.lookAt(s.tx, s.ty, s.tz);
    this.placeLights(s.az + d.ax + f.x);
    return Math.abs(s.az - t.az) + Math.abs(s.dist - t.dist) + Math.abs(s.el - t.el) + Math.abs(d.ax) + Math.abs(d.ay) + Math.abs(f.x - f.tx) > 0.01;
  }
  bindPointer() {
    const c = this.canvas, ray = new T.Raycaster(), v = new T.Vector2();
    const hit = (e) => { const r = c.getBoundingClientRect(); v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v, this.cam); const h = ray.intersectObjects(this.pick, false); return h[0] ? h[0].object : null; };
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      if (Tier.drift && this.o.drift !== false && e.pointerType === "mouse") { this.drift.tx = ((e.clientX - r.left) / r.width - 0.5) * -6 * (this.o.driftK || 1); this.drift.ty = ((e.clientY - r.top) / r.height - 0.5) * 3 * (this.o.driftK || 1); }
      const d = this.drag;
      if (d.on) { d.ax = clamp(d.ax0 - (e.clientX - d.x0) * 0.25, -20, 20); d.ay = clamp(d.ay0 + (e.clientY - d.y0) * 0.18, -20, 14); d.moved = d.moved || Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) > 4; this.needs = true; if (d.moved) return; }
      if (e.pointerType !== "mouse") return;
      this.setHover(hit(e), e.clientX, e.clientY);
    });
    c.addEventListener("pointerleave", () => { this.drift.tx = this.drift.ty = 0; if (!this.drag.on) this.setHover(null); });
    if (this.o.drag !== false) {
      c.style.cursor = "grab"; c.style.touchAction = "pan-y";
      c.addEventListener("pointerdown", (e) => { const d = this.drag; d.on = true; d.moved = false; d.x0 = e.clientX; d.y0 = e.clientY; d.ax0 = d.ax; d.ay0 = d.ay; d.vx = d.vy = 0; if (e.pointerType === "mouse") { c.setPointerCapture(e.pointerId); c.style.cursor = "grabbing"; } });
      const up = (e) => { const d = this.drag; if (!d.on) return; d.on = false; c.style.cursor = "grab"; if (!d.moved) { const o = hit(e); this.setHover(o, e.clientX, e.clientY); if (!o) PL.tip.hide(); } };
      c.addEventListener("pointerup", up); c.addEventListener("pointercancel", () => { this.drag.on = false; });
    } else c.addEventListener("click", (e) => { const o = hit(e); this.setHover(o, e.clientX, e.clientY); if (!o) PL.tip.hide(); });
  }
  setHover(o, x, y) {
    const mc = o ? o.userData.machine || o.userData.hover : null;
    if (this.hovered && this.hovered !== mc) { this.hovered.hoverT = 0; }
    this.hovered = mc;
    if (mc) { mc.hoverT = 1; const info = this.describe(mc); if (info) PL.tip.show(x, y, info); this.canvas.style.cursor = this.o.drag !== false ? "grab" : "pointer"; this.onHover && this.onHover(mc); }
    else { PL.tip.hide(); this.onHover && this.onHover(null); }
    this.needs = true;
  }
  describe() { return null; }
  /* machine animation: lift on hover, edge brightens, ember when compromised */
  animMachines(list, dt) {
    let busy = false; const c = new T.Color();
    list.forEach((mc) => {
      const kh = 1 - Math.pow(0.001, dt / 0.22); mc.hover = lerp(mc.hover, mc.hoverT, kh); mc.hot = lerp(mc.hot, mc.hotT, 1 - Math.pow(0.001, dt / 0.3));
      mc.lift = 0.03 * EASE(mc.hover); mc.g.position.y = mc.base + mc.lift;
      c.copy(COL.infra).lerp(COL.attack.clone().multiplyScalar(1.6), mc.hot); mc.edgeMat.color.copy(c); mc.edgeMat.opacity = lerp(mc.eA || linA(0.24), linA(0.6), mc.hover) * (1 - mc.hot) + mc.hot * 0.95;
      if (Math.abs(mc.hover - mc.hoverT) > 0.002 || Math.abs(mc.hot - mc.hotT) > 0.002) busy = true;
    });
    return busy;
  }
  project(p, out) { const v = (this._pv || (this._pv = new T.Vector3())).copy(p).project(this.cam); out = out || {}; out.x = ((v.x + 1) / 2) * this.W; out.y = ((1 - v.y) / 2) * this.H; out.z = v.z; return out; }
  /* overlay labels with a simple collision pass: higher priority wins, the rest hide */
  label(text, cls, prio) { const e = D.createElement("span"); e.className = "lbl " + (cls || ""); e.innerHTML = text; (this.overlay || this.el).appendChild(e); const L = { e, prio: prio || 0, want: false, p: new T.Vector3(), w: 0 }; this.labels.push(L); return L; }
  layoutLabels() {
    const boxes = []; const ordered = this.labels.slice().sort((a, b) => b.prio - a.prio);
    ordered.forEach((L) => {
      if (!L.want) { L.e.classList.remove("on"); return; }
      let s = this.project(L.p);
      if (L.box) { const c = this._lc || (this._lc = new T.Vector3()); let best = null; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const q = this.project(c.set(L.p.x + sx * L.box.w / 2, L.p.y, L.p.z + sz * L.box.d / 2), {}); if (!best || q.y < best.y) best = q; } s = { x: best.x, y: best.y - 4, z: best.z }; }
      if (s.z > 1 || s.x < -40 || s.x > this.W + 40 || (s.y < 10 && !L.e.classList.contains("lbl--focus")) || s.y > this.H + 10) { L.e.classList.remove("on"); return; }
      if (!L.w) L.w = L.e.offsetWidth + 6;
      const zone = L.e.classList.contains("lbl--zone"), pin = L.e.classList.contains("lbl--pin"), bx = zone ? [s.x - L.w / 2, s.y - 9, s.x + L.w / 2, s.y + 9] : pin ? [s.x - L.w / 2, s.y - 70, s.x + L.w / 2, s.y] : [s.x, s.y - 38, s.x + L.w, s.y - 18];
      if (L.e.classList.contains("lbl--focus")) { /* the focus tag centres over its stage and never leaves the picture */
        const hx = Math.min(this.W - 8 - L.w / 2, Math.max(8 + L.w / 2, s.x)), ty = Math.max(L.e.offsetHeight + 8 + (this.gapY || 0), s.y);
        L.e.style.transform = "translate(" + Math.round(hx) + "px," + Math.round(ty) + "px) translate(-50%, -100%)"; boxes.push([hx - L.w / 2, ty - 30, hx + L.w / 2, ty]); L.e.classList.add("on"); return; }
      if (pin) { /* a sign standing on its building, centred over the roof */
        let hx = Math.min(this.W - 8 - L.w / 2, Math.max(8 + L.w / 2, s.x));
        for (const b of boxes) { const l = hx - L.w / 2, r = hx + L.w / 2; if (r > b[0] && l < b[2] && s.y > b[1] && s.y - 70 < b[3]) { hx = s.x >= (b[0] + b[2]) / 2 ? b[2] + 10 + L.w / 2 : b[0] - 10 - L.w / 2; } }
        hx = Math.min(this.W - 8 - L.w / 2, Math.max(8 + L.w / 2, hx)); bx[0] = hx - L.w / 2; bx[2] = hx + L.w / 2;
        L.e.style.setProperty("--pin", Math.min(L.w - 14, Math.max(12, s.x - hx + L.w / 2 - 3)).toFixed(0) + "px");
        L.e.style.transform = "translate(" + Math.round(hx) + "px," + Math.round(s.y) + "px) translate(-50%, -100%)"; L.e.style.textAlign = "center"; boxes.push(bx); L.e.classList.add("on"); return; }
      if (bx[2] > this.W - 8 && !zone) { L.e.style.transform = "translate(" + Math.round(s.x) + "px," + Math.round(s.y) + "px) translate(-100%, -100%)"; L.e.style.textAlign = "right"; L.e.classList.add("is-flip"); bx[0] -= L.w; bx[2] -= L.w; }
      else { L.e.classList.remove("is-flip"); L.e.style.textAlign = ""; L.e.style.transform = "translate(" + Math.round(s.x) + "px," + Math.round(s.y) + "px)" + (zone ? " translate(-50%,-50%)" : " translate(-1px, -100%)"); }
      const clash = boxes.some((b) => !(bx[2] < b[0] || bx[0] > b[2] || bx[3] < b[1] || bx[1] > b[3]));
      if (clash && !L.force) { L.e.classList.remove("on"); return; }
      boxes.push(bx); L.e.classList.add("on");
    });
  }
  start() { if (this.running || this.frozen) return; this.running = true; if (this.onShow) this.onShow(); this.last = performance.now(); this.R.setAnimationLoop((t) => this.loop(t)); }
  stop() { this.running = false; this.R.setAnimationLoop(null); }
  /* after the story the hero idles at 30 fps or less; on phones it renders once more and then stops, keeping the last frame */
  renderOnce() { this.applyCam(0); this.composer.render(0); }
  loop(now) {
    if (this.fpsCap && now - this.last < 1000 / this.fpsCap - 2) return;
    const dt = clamp((now - this.last) / 1000, 0, 0.05); this.last = now;
    if (this.freezeAfter != null) { this.freezeAfter -= dt; if (this.freezeAfter <= 0) { this.update(0.016); this.applyCam(0.5); this.composer.render(0); this.layoutLabels(); this.frozen = true; this.stop(); return; } }
    const u = this.update(dt), c = this.applyCam(dt), moving = u || c || this.needs;
    if (this.dustM) this.dustM.uniforms.uT.value += dt; Life.tick(now);
    if (moving || this.always) { this.fin.uniforms.uT.value = (now % 1000) / 1000; this.composer.render(dt); this.needs = false; if (!this.fpsCap) Tier.sample(dt); }
    this.layoutLabels();
  }
  update() { return false; }
  dispose() {
    this.stop(); this.ro.disconnect(); this.labels.forEach((L) => L.e.remove()); this.labels = [];
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (HW.ready && [HW.chassis, HW.bezel, HW.panel, HW.metal, HW.paper].concat(Object.values(HW.steel), Object.values(HW.graphite)).includes(m)) return; if (m !== Kit.graphite && m !== Kit.graphiteTop && m !== Kit.lineInfra && m !== Kit.lineFaint && m !== Kit.cable && m !== Kit.plinth) m.dispose(); }); } });
    Kit.box = {}; this.env.dispose(); this.composer.dispose(); this.R.dispose(); this.R.forceContextLoss(); this.canvas.remove();
  }
}

/* =====================================================================
   HERO · "The attack, stopped"
   The AI agent climbs five stages with eased legs, leaving a quiet signal at each.
   At stage 05 a ring closes around the web app, a dome rises over the core,
   the attack makes one push against it and is held off. Then the scene idles.
   ===================================================================== */
const STOP = 4; /* stage 05 */
const W_emit = (n, d) => window.dispatchEvent(new CustomEvent(n, { detail: d }));
class Hero extends Stage {
  constructor(el) {
    super(el, { bg: COL.ink, fov: 30, overlay: ".hero__stage", vignette: 0.22, shadowR: 10, fog: 0.008, drag: false, dust: false }); /* no drag-to-orbit; a tap shows the tooltip */
    const S = this.scene, mob = PL.mobile(); this.mob = mob;
    this.bloom.strength = Tier.name === "low" ? 0.25 : 0.35; /* calmer glow */
    S.add(Kit.ground(COL.ink, 14, 90)); this.shadowCatcher(30);
    const dash = new T.LineDashedMaterial({ color: COL.infra, transparent: true, opacity: linA(0.18), dashSize: 0.12, gapSize: 0.2, depthWrite: false });
    PL.ZONES.forEach((z) => S.add(Kit.circleLine(z.r, z.id === "core" ? PL.PLINTH.h + 0.003 : 0.003, dash)));
    /* the core plinth: stepped edge, a brushed rim and floor tiles */
    const pl = new T.Mesh(new T.CylinderGeometry(PL.PLINTH.r, PL.PLINTH.r + 0.02, PL.PLINTH.h, 128), Kit.plinth); pl.position.y = PL.PLINTH.h / 2; pl.receiveShadow = true; pl.castShadow = Tier.shadows; S.add(pl);
    const rim = new T.Mesh(new T.TorusGeometry(PL.PLINTH.r + 0.005, 0.008, 6, 160), new T.MeshStandardMaterial({ color: "#505050", roughness: 0.35, metalness: 0.85 })); rim.rotation.x = Math.PI / 2; rim.position.y = PL.PLINTH.h; S.add(rim);
    const tiles = []; for (let x = -2.4; x <= 2.41; x += 0.6) for (let z = -2.4; z <= 2.41; z += 0.6) if (Math.hypot(x, z) < PL.PLINTH.r - 0.25) tiles.push(x - 0.29, PL.PLINTH.h + 0.002, z, x + 0.29, PL.PLINTH.h + 0.002, z, x, PL.PLINTH.h + 0.002, z - 0.29, x, PL.PLINTH.h + 0.002, z + 0.29);
    S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(tiles, 3)), Kit.lineFaint));
    const psh = new T.Mesh(new T.PlaneGeometry(PL.PLINTH.r * 2.6, PL.PLINTH.r * 2.6), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, alphaMap: Kit.poolTex, depthWrite: false })); psh.rotation.x = -Math.PI / 2; psh.position.y = 0.0015; S.add(psh);
    S.add(cablesMesh(PL.CABLES));
    /* a soft light pool under the network, so the core reads as the lit centre of the frame */
    { const lp = new T.Mesh(new T.PlaneGeometry(13, 13), new T.MeshBasicMaterial({ map: Kit.poolTex, color: COL.infra.clone().multiplyScalar(0.07), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); lp.rotation.x = -Math.PI / 2; lp.position.y = 0.003; S.add(lp);
      S.add(Kit.beam(0.7, 3.0, 6.5, COL.infra.clone().multiplyScalar(0.05), 1)); }

    /* ---------- surroundings: the world beyond the edge ring is surveyed, not empty ---------- */
    {
      const lineMat = (a) => new T.LineBasicMaterial({ color: COL.infra, transparent: true, opacity: linA(a * 0.65), depthWrite: false });
      /* topographic contours */
      for (let i = 0; i < (mob ? 8 : 16); i++) {
        const rr = 8.5 + i * (mob ? 1.7 : 0.85), pts = [], n = 220, fade = 1 - i / 17;
        for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; const q = rr * (1 + 0.045 * Math.sin(3 * a + i * 0.7) + 0.028 * Math.sin(7 * a - i * 1.3) + 0.014 * Math.sin(13 * a + i)); pts.push(new T.Vector3(Math.sin(a) * q, 0.004, Math.cos(a) * q)); }
        S.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), lineMat((i % 4 === 0 ? 0.13 : 0.07) * fade)));
      }
      /* survey ring: 120 ticks, longer every 30 degrees, a fine inner hairline */
      const tk = []; for (let k = 0; k < 120; k++) { const a = (k / 120) * Math.PI * 2, L = k % 10 === 0 ? 0.42 : k % 5 === 0 ? 0.24 : 0.12, r0 = 7.95; tk.push(Math.sin(a) * r0, 0.004, Math.cos(a) * r0, Math.sin(a) * (r0 + L), 0.004, Math.cos(a) * (r0 + L)); }
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(tk, 3)), lineMat(0.2)));
      S.add(Kit.circleLine(7.95, 0.004, lineMat(0.12), 240));
      /* uplinks: every edge machine sends a dashed line out to the internet, ending in a small terminal */
      const up = [], ends = [];
      PL.MACHINES.filter((m) => m.zone === "edge").forEach((m) => { const a = Math.atan2(m.x, m.z), r0 = Math.hypot(m.x, m.z) + 0.6, r1 = 12.5 + (Math.abs(Math.sin(a * 3)) * 2.5); for (let s = r0; s < r1; s += 0.34) up.push(Math.sin(a) * s, 0.005, Math.cos(a) * s, Math.sin(a) * Math.min(r1, s + 0.18), 0.005, Math.cos(a) * Math.min(r1, s + 0.18)); ends.push([Math.sin(a) * r1, Math.cos(a) * r1, a]); });
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(up, 3)), lineMat(0.16)));
      const term = []; ends.forEach(([x, z, a]) => { const s = 0.14, c = Math.cos(a), sn = Math.sin(a); const cr = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([u, v]) => [x + u * c + v * sn, z - u * sn + v * c]); for (let k = 0; k < 4; k++) term.push(cr[k][0], 0.006, cr[k][1], cr[(k + 1) % 4][0], 0.006, cr[(k + 1) % 4][1]); });
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(term, 3)), lineMat(0.3)));
      this.uplinkEnds = ends.map(([x, z]) => { const s = Kit.sprite(COL.infra.clone().multiplyScalar(0.6), 0.22); s.position.set(x, 0.03, z); s.material.opacity = 0.4; S.add(s); return s; });
      /* survey crosses on a 2-unit lattice, and a fine dot field, both fading with distance */
      const cr = []; for (let x = -18; x <= 18; x += 2) for (let z = -18; z <= 18; z += 2) { const d = Math.hypot(x, z); if (d < 8.6 || d > 17) continue; const s = 0.09; cr.push(x - s, 0.004, z, x + s, 0.004, z, x, 0.004, z - s, x, 0.004, z + s); }
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(cr, 3)), lineMat(0.2)));
      const dots = []; let sd = 11; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
      for (let i = 0; i < (mob ? 700 : 1400); i++) { const a = rnd() * Math.PI * 2, d = 8.2 + Math.pow(rnd(), 0.8) * 11; dots.push(Math.sin(a) * d, 0.006, Math.cos(a) * d); }
      S.add(new T.Points(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(dots, 3)), new T.PointsMaterial({ color: COL.infra, size: 1.6, sizeAttenuation: false, transparent: true, opacity: linA(0.12), depthWrite: false })));
      [5.0, 7.5].forEach((rz) => S.add(Kit.circleLine(rz - 0.06, 0.003, lineMat(0.06), 200)));
    }
    /* data packets running quietly along the cables (the network is alive before the attack) */
    this.packets = PL.CABLES.map((c, i) => { const s = Kit.sprite(COL.infra.clone().multiplyScalar(0.5), 0.12); s.material.opacity = 0.5; S.add(s); return { s, c, ph: i * 0.37, sp: 0.18 + (i % 4) * 0.05 }; });
    /* machines: detailed hardware */
    this.ms = []; this.byId = {}; const ROUTE = ["mail", "laptops", "wiki", "intweb"], PED = 0.1; HW.init();
    PL.MACHINES.forEach((m) => {
      if (mob && m.deco && m.id !== "vpn" && m.id !== "files") return;
      const route = ROUTE.includes(m.id), mm = route && m.type !== "laptops" ? Object.assign({}, m, { y: (m.y || 0) + PED, w: 1.42, d: 0.88 }) : m;
      const mc = m.type === "laptops" ? LaptopCluster(S, Object.assign({}, m, { y: (m.y || 0) + PED }), (mob ? PL.LAPTOPS.filter((l) => !l.half) : PL.LAPTOPS).map((l) => Object.assign({}, l, { y: PED }))) : Hardware(S, mm, route ? { skin: HW.steel, units: 4 } : undefined);
      if (route) { mc.route = true; mc.H = (mc.H || 0.2) + PED; mc.ledK = 0.45; mc.accK = 0.4; if (m.type !== "laptops") mc.leds = mc.leds.filter((_, li) => li % 3 === 0); }
      if (mc.parts && m.type === "laptops") mc.parts.forEach((p) => { p.g.rotation.y = 1.9; });
      this.ms.push(mc); this.byId[m.id] = mc;
      if (mc.body) this.pick.push(mc.body); if (m.type === "laptops") mc.parts.forEach((p) => this.pick.push(p.body));
      mc.lab = this.label((m.stage != null ? "<b></b>" : "") + m.label, "", m.stage != null ? 2 : 0);
      mc.lab.p.set(m.x, (m.y || 0) + (mc.H || 0.3), m.z); mc.lab.box = { w: m.w || 1, d: m.d || 0.6 };
    });
    this.leds = LedField(S, this.ms);
    /* pedestals: each machine on the attack route stands on a stepped plinth with a lit stage plate and a ground halo */
    {
      const pedMat = new T.MeshStandardMaterial({ color: "#1A1A1A", roughness: 0.78, metalness: 0.25, envMapIntensity: 0.45 });
      const trimMat = new T.MeshStandardMaterial({ color: "#848484", roughness: 0.35, metalness: 1, envMapIntensity: 0.9 });
      const plateTex = (txt) => { const c = D.createElement("canvas"); c.width = 256; c.height = 96; const x = c.getContext("2d"); x.fillStyle = "#0C0C0C"; x.fillRect(0, 0, 256, 96); x.strokeStyle = "rgba(230,230,230,.5)"; x.lineWidth = 3; x.strokeRect(4, 4, 248, 88); x.fillStyle = "#E6E6E6"; x.font = "500 54px 'DM Mono', ui-monospace, monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt, 128, 52); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
      this.peds = [];
      ["mail", "laptops", "wiki", "intweb"].forEach((id) => {
        const m = PL.M[id], mc = this.byId[id]; if (!m || !mc) return;
        const y = m.y || 0, w2 = (id === "laptops" ? m.w : 1.42) + 0.5, d2 = (id === "laptops" ? m.d : 0.88) + 0.5, g = new T.Group(); g.position.set(m.x, y, m.z); S.add(g);
        const P2 = Parts(); P2.rbox("chassis", w2, PED * 0.55, d2, 0, PED * 0.275, 0, 0.02); P2.rbox("chassis", w2 - 0.16, PED * 0.45, d2 - 0.16, 0, PED * 0.55 + PED * 0.225, 0, 0.015);
        const base = new T.Mesh(A.mergeGeometries(P2.L.chassis.map(strip)), pedMat); base.castShadow = Tier.shadows; base.receiveShadow = true; g.add(base);
        [[w2 / 2, 0], [-w2 / 2, 0]].forEach(([x]) => { const tb = new T.Mesh(new T.BoxGeometry(0.012, 0.012, d2 - 0.04), trimMat); tb.position.set(x, PED * 0.55, 0); g.add(tb); });
        [[d2 / 2], [-d2 / 2]].forEach(([z]) => { const tb = new T.Mesh(new T.BoxGeometry(w2 - 0.04, 0.012, 0.012), trimMat); tb.position.set(0, PED * 0.55, z); g.add(tb); });
        const st = PL.STAGES.findIndex((s2) => s2.m === id), plate = new T.Mesh(new T.PlaneGeometry(0.34, 0.1), new T.MeshBasicMaterial({ map: plateTex(String(st + 1).padStart(2, "0")), color: COL.idle.clone().multiplyScalar(0.55) }));
        plate.rotation.y = Math.PI / 2; plate.position.set(w2 / 2 + 0.003, PED * 0.3, d2 * 0.18); g.add(plate);
        const halo = new T.Mesh(new T.RingGeometry(0, 1, 4).rotateZ(Math.PI / 4), new T.MeshBasicMaterial({ color: COL.defend.clone().multiplyScalar(0.5), transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide })); halo.rotation.x = -Math.PI / 2; halo.scale.set((w2 + 0.4) / 1.414, (d2 + 0.4) / 1.414, 1); halo.position.y = 0.004; g.add(halo);
        const edge = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(w2 + 0.3, d2 + 0.3).rotateX(-Math.PI / 2)), new T.LineBasicMaterial({ color: COL.defend, transparent: true, opacity: 0.25, depthWrite: false })); edge.position.y = 0.006; g.add(edge);
        /* roof kit on the route machines: a light strip round the top edge, two vent units, an antenna with a tip light */
        let strip2 = null, tip = null;
        if (id !== "laptops") {
          const H0 = mc.H - PED, W3 = 1.42, D3 = 0.88, sm = new T.MeshBasicMaterial({ color: COL.idle.clone().multiplyScalar(0.4) });
          const sg = []; [[0, D3 / 2 + 0.004, W3, 0.012], [0, -D3 / 2 - 0.004, W3, 0.012]].forEach(([x, z, w3]) => { const b3 = new T.BoxGeometry(w3, 0.012, 0.01); b3.translate(x, H0 - 0.008, z); sg.push(b3); });
          [[W3 / 2 + 0.004], [-W3 / 2 - 0.004]].forEach(([x]) => { const b3 = new T.BoxGeometry(0.01, 0.012, D3); b3.translate(x, H0 - 0.008, 0); sg.push(b3); });
          strip2 = new T.Mesh(A.mergeGeometries(sg), sm); mc.g.add(strip2);
          const rk = Parts(); rk.rbox("panel", 0.22, 0.07, 0.18, -0.44, H0 + 0.035, 0.22, 0.01); rk.rbox("panel", 0.22, 0.07, 0.18, -0.44, H0 + 0.035, -0.04, 0.01);
          for (let i = 0; i < 2; i++) rk.cyl("bezel", 0.06, 0.012, -0.44, H0 + 0.075, 0.22 - i * 0.26, 18);
          rk.cyl("metal", 0.007, 0.36, 0.56, H0 + 0.18, -0.3, 8); rk.box("metal", 0.08, 0.012, 0.08, 0.56, H0 + 0.006, -0.3);
          ["panel", "bezel", "metal"].forEach((k2) => { if (rk.L[k2].length) mc.g.add(new T.Mesh(A.mergeGeometries(rk.L[k2].map(strip)), HW.steel[k2])); });
          tip = Kit.sprite(COL.idle.clone().multiplyScalar(0.6), 0.16); tip.position.set(0.56, H0 + 0.37, -0.3); mc.g.add(tip);
          mc.edgeMat.opacity = linA(0.3); mc.eA = linA(0.3);
          /* architecture: corner columns, a cornice with a recessed parapet, floor plates between units, side louvres */
          { const ar = Parts(), hw3 = W3 / 2, hd3 = D3 / 2;
            [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => ar.box("metal", 0.05, H0 + 0.02, 0.05, sx * (hw3 + 0.012), (H0 + 0.02) / 2, sz * (hd3 + 0.012)));
            for (let u = 1; u < 4; u++) { const yy = u * 0.147 - 0.006; ar.box("chassis", W3 + 0.03, 0.014, D3 + 0.03, 0, yy, 0); }
            ar.box("chassis", W3 + 0.09, 0.03, D3 + 0.09, 0, H0 + 0.015, 0); ar.box("panel", W3 - 0.08, 0.03, D3 - 0.08, 0, H0 + 0.04, 0);
            for (let k = 0; k < 7; k++) ar.box("bezel", 0.012, H0 - 0.08, 0.01, -hw3 + 0.18 + k * ((W3 - 0.36) / 6), H0 / 2, hd3 + 0.018);
            ["metal", "chassis", "panel", "bezel"].forEach((k2) => { if (ar.L[k2].length) { const mm2 = new T.Mesh(A.mergeGeometries(ar.L[k2].map(strip)), HW.steel[k2]); mm2.castShadow = Tier.shadows; mm2.position.y = PED; mc.g.add(mm2); } }); }
        }
        this.peds.push({ id, st, mc, halo, edge, plate, strip2, tip });
      });
    }

    /* ---------- finish inside the network: pads under every machine, rulers on the zone rings, quiet appliances ---------- */
    {
      const lm = (a) => new T.LineBasicMaterial({ color: COL.infra, transparent: true, opacity: linA(a), depthWrite: false });
      const pads = [], marks = [];
      const padMat = new T.MeshStandardMaterial({ color: "#121212", roughness: 0.85, metalness: 0.15 });
      const EXTRA = [{ id: "ups", x: -6.2, z: -4.4, w: 0.8, d: 0.5 }, { id: "sw2", x: 5.2, z: -5.2, w: 0.9, d: 0.55 }, { id: "cool", x: -1.9, z: 4.6, w: 0.8, d: 0.5 }, { id: "sw3", x: 6.6, z: 4.3, w: 0.9, d: 0.55 }, { id: "cam", x: -6.6, z: 0.6, w: 0.7, d: 0.45 }, { id: "sw4", x: 2.4, z: -6.4, w: 0.9, d: 0.55 }];
      if (!mob) EXTRA.forEach((m) => { m.type = "base"; m.y = 0; const mc = Hardware(S, m); mc.edgeMat.opacity = linA(0.1); });
      PL.MACHINES.concat(mob ? [] : EXTRA).forEach((m) => {
        if (m.type === "laptops" || ROUTE.includes(m.id) || (mob && m.deco && m.id !== "vpn" && m.id !== "files")) return;
        const y = (m.y || 0) + 0.003, pw = (m.w || 1) + 0.34, pd = (m.d || 0.6) + 0.34, g2 = new T.BoxGeometry(pw, 0.006, pd); g2.translate(m.x, y, m.z); pads.push(g2);
        const hx = pw / 2, hz = pd / 2, L = 0.1, yy = y + 0.004;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => { const cx = m.x + sx * hx, cz = m.z + sz * hz; marks.push(cx, yy, cz, cx - sx * L, yy, cz, cx, yy, cz, cx, yy, cz - sz * L); });
      });
      const pm = new T.Mesh(A.mergeGeometries(pads.map((g2) => strip(g2.toNonIndexed()))), padMat); pm.receiveShadow = true; S.add(pm);
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(marks, 3)), lm(0.32)));
      /* rulers: fine ticks along the inside of the corporate and edge rings */
      const tk = []; [[5.0, 160], [7.5, 220]].forEach(([rz, n]) => { for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, L = k % 10 === 0 ? 0.22 : 0.09; tk.push(Math.sin(a) * rz, 0.004, Math.cos(a) * rz, Math.sin(a) * (rz - L), 0.004, Math.cos(a) * (rz - L)); } });
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(tk, 3)), lm(0.12)));
      /* direction chevrons along the cables, pointing the way traffic flows */
      const ch = []; PL.CABLES.forEach((c) => { for (let i = 6; i < c.length - 3; i += 9) { const a = c[i], b = c[i + 1], dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, s = 0.05, y = a[1] + 0.002; ch.push(a[0] - ux * s + uz * s, y, a[2] - uz * s - ux * s, a[0], y, a[2], a[0], y, a[2], a[0] - ux * s - uz * s, y, a[2] - uz * s + ux * s); } });
      S.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(ch, 3)), lm(0.2)));
    }
    /* the Attack Line, only as far as stage 05 */
    this.line = Kit.tubeLine(PL.PATH.slice(0, PL.STAGE_IDX[STOP] + 1), 1400, 0.0135, 0.075); this.line.setTrail(2.0); this.line.setHot(1); S.add(this.line);
    this.line.userData.glow.material.uniforms.uAlpha.value = 0.42;
    /* the line's light on the ground, a wide soft ember wash that follows it */
    this.lineGlow = Kit.tubeLine(PL.PATH.slice(0, PL.STAGE_IDX[STOP] + 1).map((p) => [p[0], PL.groundY(p[0], p[2]) + 0.012, p[2]]), 700, 0.001, 0.2); this.lineGlow.userData.core.visible = false;
    this.lineGlow.userData.glow.material.uniforms.uAlpha.value = 0.08; this.lineGlow.userData.glow.scale.y = 0.08; this.lineGlow.userData.glow.position.y = 0.012; this.lineGlow.setTrail(2.4); S.add(this.lineGlow);
    this.uEnd = PL.STAGE_U[STOP];
    /* the agent's planned route on into the core, as a faint dashed ghost: what the attack would have done */
    { const gp = PL.PATH.slice(PL.STAGE_IDX[STOP]).map((p) => new T.Vector3(p[0], p[1] + 0.004, p[2])); this.ghost = new T.Line(new T.BufferGeometry().setFromPoints(gp), new T.LineDashedMaterial({ color: COL.attack, transparent: true, opacity: 0, dashSize: 0.08, gapSize: 0.1, depthWrite: false })); this.ghost.computeLineDistances(); S.add(this.ghost); }
    this.head = new T.Group(); const hs = Kit.sprite(COL.head.clone().multiplyScalar(1.4), 0.42), hc = new T.Mesh(new T.SphereGeometry(0.03, 20, 14), new T.MeshBasicMaterial({ color: COL.head.clone().multiplyScalar(3.2) })), hh = Kit.sprite(COL.attack.clone().multiplyScalar(0.9), 1.05); hh.material.opacity = 0.35; this.head.add(hs, hc, hh); S.add(this.head);
    this.scan = new T.Mesh(new T.RingGeometry(8.1, 8.16, 64, 1, 0, 1.1), new T.MeshBasicMaterial({ color: COL.attack.clone().multiplyScalar(1.4), transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); this.scan.rotation.x = -Math.PI / 2; this.scan.position.y = 0.01; S.add(this.scan);
    /* stage arrivals: an impact ring and an ember pool */
    this.impacts = PL.STAGES.map(() => { const r = Kit.ring(0.97, 1, COL.attack, 1.6, 96); r.visible = false; S.add(r); return r; });
    this.pools = PL.STAGES.map(() => { const p = new T.Mesh(new T.PlaneGeometry(2.4, 2.4), new T.MeshBasicMaterial({ map: Kit.poolTex, color: COL.attack, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); p.rotation.x = -Math.PI / 2; S.add(p); return p; });
    /* stage 05: the containment ring that closes on the web app */
    const M5 = PL.M[PL.STAGES[STOP].m]; this.p5 = new T.Vector3(M5.x, PL.groundY(M5.x, M5.z), M5.z);
    this.contain = new T.Group(); this.contain.position.copy(this.p5).setY(this.p5.y + 0.008);
    this.cA = Kit.ring(0.92, 0.94, COL.defend, 1.4, 160); this.cB = Kit.dashedRing(1.06, 1.075, 36, COL.defend, 1.2); this.cA.material.opacity = 0; this.cB.material.opacity = 0; this.cB.visible = false;
    this.contain.add(this.cA, this.cB); S.add(this.contain);
    this.cPool = new T.Mesh(new T.PlaneGeometry(3.2, 3.2), new T.MeshBasicMaterial({ map: Kit.poolTex, color: COL.defend, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); this.cPool.rotation.x = -Math.PI / 2; this.cPool.position.copy(this.p5).setY(this.p5.y + 0.004); S.add(this.cPool);
    /* the burst: one ring that crosses the whole world from stage 05 */
    this.burst = [0].map(() => { const r = Kit.ring(0.985, 1, COL.defend, 1.5, 192); r.visible = false; r.position.copy(this.p5).setY(this.p5.y + 0.012); S.add(r); return r; });
    /* after the burst: a protected ring around the core (stages 06 to 10) */
    this.shield = Kit.dashedRing(PL.PLINTH.r + 0.18, PL.PLINTH.r + 0.2, 72, COL.defend, 1.1); this.shield.position.y = 0.006; this.shield.material.opacity = 0; this.shield.visible = false; S.add(this.shield);
    this.shield2 = Kit.ring(PL.PLINTH.r + 0.06, PL.PLINTH.r + 0.068, COL.defend, 1, 192); this.shield2.position.y = 0.006; this.shield2.material.opacity = 0; S.add(this.shield2);

    /* ---------- the dome: once stage 05 is contained, a shield rises over the core ---------- */
    {
      const R0 = PL.PLINTH.r + 0.22, SY = 0.72, y0 = PL.PLINTH.h; this.domeR = R0; this.domeSY = SY;
      this.dome = new T.Group(); this.dome.position.y = y0; S.add(this.dome);
      this.clip = new T.Plane(new T.Vector3(0, -1, 0), y0); this.R.localClippingEnabled = true;
      /* glass shell: a fresnel rim, faint panel bands, and an impact wave from the side the attack came from */
      this.shellMat = new T.ShaderMaterial({
        uniforms: { uCol: { value: COL.defend.clone() }, uWarm: { value: new T.Color("#A6E8C2") }, uA: { value: 0 }, uH: { value: -1 }, uImp: { value: new T.Vector3() }, uImpR: { value: 0 }, uImpA: { value: 0 }, uT: { value: 0 } },
        vertexShader: "varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vL = position; vec4 mv = viewMatrix * w; vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }",
        fragmentShader: "uniform vec3 uCol, uWarm, uImp; uniform float uA, uH, uImpR, uImpA, uT; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vL;\n" +
          "void main(){ if (vW.y > uH) discard; float f = 1. - abs(dot(normalize(vN), normalize(vV))); float rim = pow(f, 2.4);\n" +
          " float lat = asin(clamp(normalize(vL).y, -1., 1.)); float lon = atan(vL.z, vL.x);\n" +
          " float band = (smoothstep(.965, 1., abs(cos(lat * 18.))) * .2 + smoothstep(.975, 1., abs(cos(lon * 12.))) * .12) * smoothstep(1.45, 1.1, lat);\n" +
          " float edge = smoothstep(.12, 0., uH - vW.y) * step(vW.y, uH);\n" +
          " float d = distance(vW, uImp); float wave = smoothstep(.35, 0., abs(d - uImpR)) * uImpA; float hot = smoothstep(1.4, 0., d) * uImpA;\n" +
          " vec3 c = mix(uCol, uWarm, .35 * (1. - rim)); float a = uA * (.05 + .55 * rim + .25 * band) * (1. - .7 * smoothstep(1.2, 1.55, lat)) + edge * .9 + wave * .9 + hot * .1;\n" +
          " gl_FragColor = vec4(c * a * (1. + wave * 1.5 + edge * 1.2), 1.); }",
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide
      });
      const hemi = new T.SphereGeometry(R0, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2);
      this.shell = new T.Mesh(hemi, this.shellMat); this.shell.scale.y = SY; this.shell.renderOrder = 8; this.dome.add(this.shell);
      /* wire: latitude rings and meridians */
      const wl = [], LAT = 7, LON = 24;
      for (let i = 1; i <= LAT; i++) { const t = (i / (LAT + 1)) * Math.PI / 2, rr = R0 * Math.cos(t), yy = R0 * Math.sin(t) * SY; for (let k = 0; k < 96; k++) { const a0 = (k / 96) * Math.PI * 2, a1 = ((k + 1) / 96) * Math.PI * 2; wl.push(Math.cos(a0) * rr, yy, Math.sin(a0) * rr, Math.cos(a1) * rr, yy, Math.sin(a1) * rr); } }
      for (let j = 0; j < LON; j++) { const a = (j / LON) * Math.PI * 2; for (let k = 0; k < 22; k++) { const t0 = (k / 24) * Math.PI / 2, t1 = ((k + 1) / 24) * Math.PI / 2; if (j % 2 && k > 17) continue; wl.push(Math.cos(a) * R0 * Math.cos(t0), R0 * Math.sin(t0) * SY, Math.sin(a) * R0 * Math.cos(t0), Math.cos(a) * R0 * Math.cos(t1), R0 * Math.sin(t1) * SY, Math.sin(a) * R0 * Math.cos(t1)); } }
      this.wireMat = new T.LineBasicMaterial({ color: COL.defend.clone().multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [this.clip] });
      this.dome.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(wl, 3)), this.wireMat));
      /* outer geodesic panels, slightly larger and fainter, so the dome reads as a built structure */
      const ico = new T.EdgesGeometry(new T.IcosahedronGeometry(R0 * 1.035, 3)), ip = ico.getAttribute("position").array, keep = [];
      for (let i = 0; i < ip.length; i += 6) if (ip[i + 1] > -0.02 && ip[i + 4] > -0.02) keep.push(ip[i], ip[i + 1] * SY, ip[i + 2], ip[i + 3], ip[i + 4] * SY, ip[i + 5]);
      this.geoMat = new T.LineBasicMaterial({ color: COL.infra, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [this.clip] });
      this.dome.add(new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(keep, 3)), this.geoMat));
      /* base: a brushed collar and the rising scan ring */
      this.collar = new T.Mesh(new T.TorusGeometry(R0, 0.03, 8, 192), new T.MeshStandardMaterial({ color: "#5C5C5C", roughness: 0.3, metalness: 0.9, transparent: true, opacity: 0 })); this.collar.rotation.x = Math.PI / 2; this.dome.add(this.collar);
      this.scanRing = Kit.ring(0.992, 1, COL.defend, 2.2, 192); this.scanRing.material.opacity = 0; S.add(this.scanRing);
      /* the impact point: where the attack's direction meets the dome */
      const dir = new T.Vector3(this.p5.x, 0, this.p5.z).normalize();
      const onDome = (ang, v) => { const c = Math.cos(ang), sn = Math.sin(ang), dx = dir.x * c - dir.z * sn, dz = dir.x * sn + dir.z * c, h = Math.sqrt(1 - v * v) * 1.004; return new T.Vector3(dx * R0 * h, y0 + R0 * SY * v * 1.004, dz * R0 * h); };
      this.impP = onDome(0, 0.4); this.impP2 = onDome(0.32, 0.62);
      /* the push: one try from stage 05 up to the shell; it stops at the surface and lights it */
      const from = this.p5.clone().setY(this.p5.y + 0.55);
      this.thrusts = [[this.impP, 0]].map(([to, i]) => {
        const m1 = from.clone().lerp(to, 0.45); m1.y += 0.55 + i * 0.25;
        const L = Kit.tubeLine([from, from.clone().lerp(m1, 0.5).setY(from.y + 0.35 + i * 0.12), m1, m1.clone().lerp(to, 0.6).setY(to.y + 0.12), to], 260, 0.0115, 0.065); L.setTrail(0.7); L.setHot(1); L.setHead(0); S.add(L);
        const flare = Kit.sprite(COL.core.clone().multiplyScalar(1.25), 0.5); flare.position.copy(to); flare.material.opacity = 0; S.add(flare);
        const n = to.clone().sub(new T.Vector3(0, y0, 0)); n.y /= SY * SY; n.normalize();
        const ring = new T.Mesh(new T.RingGeometry(0.965, 1, 64), new T.MeshBasicMaterial({ color: COL.defend.clone().multiplyScalar(1.5), transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending })); ring.position.copy(to); ring.lookAt(to.clone().add(n)); S.add(ring);
        const hex = new T.Mesh(new T.RingGeometry(0.98, 1, 6), ring.material.clone()); hex.position.copy(to); hex.quaternion.copy(ring.quaternion); S.add(hex);
        return { L, flare, ring, hex, to, at: 1.95, travel: 0.75, k: 1 };
      });
      this.impSpark = Kit.sprite(COL.defend.clone().multiplyScalar(1.3), 0.6); this.impSpark.position.copy(this.impP); this.impSpark.material.opacity = 0; S.add(this.impSpark);
    }

    /* ---------- a long, chained attack: days pass, the agent plants backdoors, calls home,
       and every step leaves a weak signal. At stage 05 the signals are linked into one chain. ---------- */
    {
      this.DAYS = [0, 1, 4, 11, 23];
      /* the attacker's own server, outside the company */
      const a0 = -0.52, rC = 9.0;
      this.c2 = Hardware(S, { id: "api", type: "server", x: Math.sin(a0) * rC, z: Math.cos(a0) * rC, w: 0.9, d: 0.56, y: 0 }, { faceY: 1.0 });
      padsUnder(S, [{ x: this.c2.m.x, z: this.c2.m.z, w: 0.9, d: 0.56 }], 0);
      { const up2 = [], ax = Math.sin(a0), az2 = Math.cos(a0); for (let r = rC + 0.6; r < rC + 4; r += 0.3) up2.push(ax * r, 0.006, az2 * r, ax * (r + 0.16), 0.006, az2 * (r + 0.16)); segs(S, up2, lineM(0.22, COL.attack)); }
      this.c2Pool = new T.Mesh(new T.PlaneGeometry(2.2, 2.2), new T.MeshBasicMaterial({ map: Kit.poolTex, color: COL.attack, transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending })); this.c2Pool.rotation.x = -Math.PI / 2; this.c2Pool.position.set(this.c2.m.x, 0.005, this.c2.m.z); S.add(this.c2Pool);
      this.c2.hotT = 1; this.c2Top = new T.Vector3(this.c2.m.x, this.c2.H + 0.05, this.c2.m.z);
      this.c2Ring = Kit.dashedRing(0.78, 0.79, 28, COL.attack, 1.3); this.c2Ring.position.set(this.c2.m.x, 0.01, this.c2.m.z); this.c2Ring.material.opacity = 0.5; S.add(this.c2Ring);
      this.c2Lab = this.label("Attacker's server", "lbl--c2", 3); this.c2Lab.p.copy(this.c2Top);
      /* backdoors and beacons at stages 02, 03 and 04; signals at 01 to 05 */
      const top = (i) => { const s = PL.STAGES[i]; if (!s.m) { const p = PL.PATH[PL.STAGE_IDX[0]]; return new T.Vector3(p[0], p[1], p[2]); } const mc = this.byId[s.m], m = PL.M[s.m]; return new T.Vector3(m.x, (m.y || 0) + (mc ? mc.H : 0.3), m.z); };
      this.implants = [1, 2, 3].map((i) => {
        const p = top(i).add(new T.Vector3(0, 0.16, 0)), g = new T.Mesh(new T.OctahedronGeometry(0.055, 0), new T.MeshBasicMaterial({ color: COL.attack.clone().multiplyScalar(2.4), transparent: true, opacity: 0 })); g.position.copy(p); S.add(g);
        const glow = Kit.sprite(COL.attack.clone().multiplyScalar(1.4), 0.5); glow.position.copy(p); glow.material.opacity = 0; S.add(glow);
        const mid = p.clone().lerp(this.c2Top, 0.5); mid.y += 0.75 + i * 0.12;
        const beacon = Kit.tubeLine([p, p.clone().lerp(mid, 0.5).setY(p.y + 0.55), mid, mid.clone().lerp(this.c2Top, 0.5).setY(this.c2Top.y + 0.5), this.c2Top], 220, 0.006, 0.034); beacon.setTrail(0.9); beacon.setBase(0.1); beacon.setHead(0); S.add(beacon);
        return { i, g, glow, beacon, ph: i * 0.7 };
      });
      /* weak signals: one small marker per step, each on its own too faint to act on */
      this.sigP = [0, 1, 2, 3, 4].map((i) => top(i).add(new T.Vector3(0, 0.55, 0)));
      this.sigs = this.sigP.map((p) => { const s = Kit.sprite(COL.defend.clone().multiplyScalar(1.4), 0.32); s.position.copy(p); s.material.opacity = 0; S.add(s); const d = new T.Mesh(new T.OctahedronGeometry(0.035, 0), new T.MeshBasicMaterial({ color: COL.defend.clone().multiplyScalar(1.6), transparent: true, opacity: 0 })); d.position.copy(p); S.add(d); return { s, d }; });
      /* the link drawn through them */
      const chain = []; this.sigP.forEach((p, i) => { if (i) { const a = this.sigP[i - 1], m2 = a.clone().lerp(p, 0.5); m2.y += 0.45; chain.push(a.clone().lerp(m2, 0.5).setY((a.y + m2.y) / 2 + 0.12), m2); } chain.push(p.clone()); });
      this.link = Kit.tubeLine(chain, 500, 0.008, 0.045); [this.link.userData.core, this.link.userData.glow].forEach((o, i) => o.material.uniforms.uColor.value.copy(COL.defend).multiplyScalar(i ? 0.8 : 1.9)); this.link.setBase(1); this.link.setTrail(0.02); this.link.setHead(0); S.add(this.link);
      /* the agent's clock rides with it */
      this.headLab = this.label("AI agent · <b>Day 00</b>", "lbl--head", 7); this.headLab.force = true;
    }
    this.stageL = PL.STAGES.map((s, i) => { if (!s.m) { const L = this.label("<b>01</b>Recon", "", 2); const p = PL.PATH[PL.STAGE_IDX[0]]; L.p.set(p[0], p[1], p[2]); return L; } const L = this.byId[s.m] ? this.byId[s.m].lab : null; if (L) L.e.querySelector("b").textContent = (i < 9 ? "0" : "") + (i + 1); return L; });
    /* focus: when the card shows a stage, the scene marks the same place: a glow on the ground, a breathing ring,
       a ring that pulses outward, a thin beam and the stage name.
       Red for 01 to 04, green for 05 (where it is stopped), warm white for 06 to 10 (what would have happened). */
    {
      this.stageTop = (i) => { const s2 = PL.STAGES[i]; if (!s2.m) { const p = PL.PATH[PL.STAGE_IDX[0]]; return new T.Vector3(p[0], p[1], p[2]); } const mc = this.byId[s2.m], m = PL.M[s2.m]; return new T.Vector3(m.x, (m.y || 0) + (mc ? mc.H : 0.3), m.z); };
      const F = this.focus = { k: null, a: 0, col: COL.attack.clone() };
      F.pool = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: Kit.poolTex, color: COL.attack.clone(), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); F.pool.rotation.x = -Math.PI / 2; S.add(F.pool);
      F.ring = Kit.ring(0.9, 1, COL.attack, 1.4, 96); F.ring.material.opacity = 0; S.add(F.ring);
      F.wave = Kit.ring(0.94, 1, COL.attack, 1.2, 96); F.wave.material.opacity = 0; S.add(F.wave);
      F.beam = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 1, 8, 1, true), new T.MeshBasicMaterial({ color: COL.attack.clone(), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); S.add(F.beam);
      F.lab = this.label("", "lbl--focus", 9); F.lab.force = true;
      F.set = (k) => {
        F.k = k; if (k == null || k < 0) { F.k = null; return; }
        const c = k < STOP ? COL.attack : k === STOP ? COL.defend : COL.idle; F.col.copy(c);
        [F.pool, F.ring, F.wave, F.beam].forEach((o) => o.material.color.copy(c).multiplyScalar(o === F.pool ? 1.1 : 2.2));
        const top = this.stageTop(k), base = PL.STAGES[k].m ? PL.M[PL.STAGES[k].m] : { x: top.x, z: top.z, y: 0 }, gy = (base.y || 0) + 0.012;
        F.pool.position.set(base.x, gy - 0.006, base.z); F.ring.position.set(base.x, gy, base.z); F.wave.position.set(base.x, gy + 0.002, base.z);
        F.beam.scale.y = 1.1; F.beam.position.set(top.x, top.y + 0.55, top.z);
        F.lab.p.set(top.x, top.y + 1.12, top.z); F.lab.e.className = "lbl lbl--focus lbl--focus-" + (k < STOP ? "atk" : k === STOP ? "stop" : "if"); F.lab.w = 0;
        F.lab.e.innerHTML = "<b>" + (k < 9 ? "0" : "") + (k + 1) + "</b>" + PL.STAGES[k].n; F.t0 = this.t;
        /* the stretch of the attack path that leads into this stage lights up and draws in */
        if (F.seg) { S.remove(F.seg); F.seg.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); F.seg = null; }
        const I = PL.STAGE_IDX, i1 = I[k], i0 = k ? I[k - 1] : Math.max(0, i1 - 40), pts = PL.PATH.slice(i0, i1 + 1);
        if (pts.length > 2) { const sg = F.seg = Kit.tubeLine(pts.map((q) => [q[0], q[1] + 0.006, q[2]]), 260, 0.016, 0.085);
          [sg.userData.core, sg.userData.glow].forEach((o, j) => { const u = o.material.uniforms; if (u.uColor) u.uColor.value.copy(c).multiplyScalar(j ? 0.9 : 2.2); });
          sg.setBase(1); sg.setTrail(0.02); sg.setHot(k < STOP ? 1 : 0); sg.setHead(0); sg.setFade(0); S.add(sg); }
      };
    }
    /* timeline: legs eased in and out, a short dwell at each stage; about 9 s to stage 05 */
    const U = PL.STAGE_U, start = 0.7, dwell = 0.55, travel = 4.3; this.TA = []; this.TL = []; let t = start;
    const span = U[STOP] - U[0];
    for (let k = 0; k <= STOP; k++) { if (k > 0) { const leg = Math.max(0.7, (travel * (U[k] - U[k - 1])) / span); this.TL.push([t, leg]); t += leg; } this.TA.push(t); t += dwell; }
    this.T5 = this.TA[STOP]; this.Tl = this.T5 + 0.1; this.Tc = this.T5 + 1.05; this.Tb = this.T5 + 1.95;
    this.k = -99; this.pause = 0; this.always = true; this.camLerp = 0.06;
    this.hits = PL.heroHits; this.sp = {}; this.burstDone = false;
    this.start0 = [-0.4, 0, 0.2]; window.__hero = this;
    /* no intro: the copy is on the left from the first frame, so the camera starts at its final right offset */
    this.navGap = () => { /* the picture runs up under the floating nav; this is how many pixels of it the nav covers */ const nav = D.querySelector(".nav"); if (!nav || PL.mobile()) return 0; const top = this.canvas.getBoundingClientRect().top + scrollY; return Math.max(0, nav.offsetHeight - top); };
    this.fit = () => { /* frame the network below the nav as large as it fits. First slide the picture down into free space
         at the bottom (above the stage card); only if that is not enough, step the camera back. */
      const B = this.base; if (!B || !this.c2Top || !this.stageTop) return;
      const sc = this.cam.clone(), v = new T.Vector3(), top = (this.gapY || 0) + 18, W = this.W, H = this.H;
      const hud = D.querySelector("[data-hud]"), cr = this.canvas.getBoundingClientRect(), hr = hud ? hud.getBoundingClientRect() : null;
      const floor = hr && hr.top > cr.top && hr.top < cr.bottom ? hr.top - cr.top - 10 : H - 16;
      const view = (shift) => { if (sc.view) { sc.setViewOffset(W, H, sc.view.offsetX, this.H * ((this.base && this.base.offY) || 0) - (this.gapY || 0) * 0.5 - shift, W, H); } else sc.setViewOffset(W, H, 0, -shift, W, H); sc.updateProjectionMatrix(); };
      const ys = (pts) => pts.map((p) => { v.copy(p).project(sc); return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, z: v.z }; });
      const need = (el, dist, tg, hi, lo) => { for (let m = 1; m < 2.4; m += 0.02) { const az = (B.az * Math.PI) / 180, e2 = (el * Math.PI) / 180, d = dist * m;
          sc.position.set(tg[0] + d * Math.cos(e2) * Math.sin(az), tg[1] + d * Math.sin(e2), tg[2] + d * Math.cos(e2) * Math.cos(az)); sc.lookAt(tg[0], tg[1], tg[2]); sc.updateMatrixWorld();
          view(0); const a = ys(hi), b2 = ys(lo); if (a.some((q) => q.z >= 1 || q.x > W - 24)) continue;
          const sh = Math.max(0, top - Math.min(...a.map((q) => q.y))), room = floor - Math.max(...b2.map((q) => q.y));
          if (sh <= room) return { m, sh }; } return { m: 2.4, sh: 0 }; };
      const lift = (p, h) => p.clone().add(new T.Vector3(0, h, 0)), c2 = lift(this.c2Top, 0.35);
      const hiS = [c2].concat([0, 1, 2, 3, 4].map((i) => lift(this.stageTop(i), 0.25))), hiA = [c2].concat(PL.STAGES.map((_, i) => lift(this.stageTop(i), 0.45)));
      const M5b = PL.M[PL.STAGES[STOP].m], lo = [new T.Vector3(M5b.x, 0, M5b.z)]; /* stage 05 must stay above the card */
      const S0 = need(B.el + 1, B.dist * 1.1, this.start0, hiS, lo), E = need(B.el, B.dist, B.target, hiS, lo), O = need(B.el, B.dist, B.target, hiA, lo);
      this.fitM = { s: S0.m, e: E.m, o: Math.max(E.m, O.m), ss: S0.sh, se: E.sh, so: O.m > E.m ? O.sh : Math.max(E.sh, O.sh) };
    };
    this.setOff = () => { const c = this.base; if (!c) return; const ox = c.offX || 0, oy = c.offY || 0, gy = (this.gapY || 0) * 0.5, sh = this.shiftS || 0; this.cam.setViewOffset(this.W, this.H, -this.W * ox, this.H * oy - gy - sh, this.W, this.H); this.cam.updateProjectionMatrix(); };
    this.applyOff = () => { const c = this.base; if (!c) return; this.gapY = this.navGap(); this.setOff(); this.fit(); };
    this.onResize = (w, h) => { const c = PL.heroCam(w, h); this.base = c; if (!this.inited) { Object.assign(this.camT, { az: c.az, el: c.el + 1, dist: c.dist * 1.1, tx: this.start0[0], ty: 0, tz: this.start0[2] }); Object.assign(this.camS, this.camT); this.inited = true; } this.applyOff(); };
    this.resize();
    if (PL._heroT0) { this.t = PL._heroT0; } /* a quality rebuild picks up where it was, instead of replaying */
    /* before the settle, the card can replay 01 to 05; after it, the card only lights the matching machine */
    addEventListener("pl:jump", (e) => { if (this.settled) return; const k = Math.min(STOP, e.detail); this.t = k === STOP ? this.T5 - 0.001 : this.TA[k] + 0.001; this.k = -1; this.pause = 0; });
    addEventListener("pl:light", (e) => { const d = e.detail, k = typeof d === "object" && d ? d.k : d, user = !!(d && d.user); this.lightK = k; this.lightT = this.t; this.focus.set(k); if (this.frozen && !user) { this.focus.t0 = this.t - 1; this.focus.a = 1; this.focus.cw = 1; this.update(0.016); this.applyCam(1); this.layoutLabels(); this.composer.render(0); } else if (this.frozen) { this.frozen = false; this.freezeAfter = 2.4; this.start(); } else if (this.mob && this.freezeAfter != null && this.freezeAfter < 2.4) this.freezeAfter = 2.4; });
  }
  describe(mc) {
    const m = mc.m, s = m.stage != null ? PL.STAGES[m.stage] : null;
    if (!s) return { n: m.label, t: "Not on this attack's route", d: "" };
    return { n: (s.i < 9 ? "0" : "") + (s.i + 1) + " / 10 · " + s.tag, t: s.n, d: s.d, def: s.i > STOP };
  }
  headU(t) { /* eased position along the route */
    const U = PL.STAGE_U; if (t < this.TA[0]) return U[0];
    for (let k = 0; k < this.TL.length; k++) { const [a, len] = this.TL[k]; if (t < a) return U[k]; if (t < a + len) { const f = (t - a) / len, e = f * f * f * (f * (f * 6 - 15) + 10); return lerp(U[k], U[k + 1], e); } }
    return U[STOP];
  }
  update(dt) {
    if (this.pause > 0) this.pause -= dt; else this.t += dt;
    const t = this.t, TA = this.TA;
    let k = -1; for (let i = 0; i <= STOP; i++) if (t >= TA[i]) k = i;
    const u = this.headU(t), hp = PL.pathAt(u);
    const cq = smooth(this.Tc, this.Tc + 0.9, t), bq = t - this.Tb;
    /* the line: full ember while it climbs; once contained it cools to a dim trace */
    this.line.setHead(t < TA[0] ? 0 : u / this.uEnd); this.line.setFade(1 - 0.5 * cq); this.line.setBase(0.5 - 0.22 * cq); this.line.setHot(1 - cq); this.lineGlow.setHead(t < TA[0] ? 0 : u / this.uEnd); this.lineGlow.setFade(1 - 0.75 * cq); this.lineGlow.setBase(0.45);
    this.head.position.set(hp[0], hp[1], hp[2]); this.head.visible = t >= TA[0] && cq < 1;
    this.head.children[0].material.opacity = (0.75 + 0.25 * Math.sin(t * 6)) * (1 - cq); this.head.children[0].scale.setScalar(0.45 * (1 + 0.3 * smooth(this.T5 - 0.2, this.Tc, t) * (1 - cq)));
    const sc = (t - 0.4) / 1.2; this.scan.material.opacity = sc > 0 && sc < 1 ? Math.sin(sc * Math.PI) * 0.55 : 0; this.scan.rotation.z = -1.4 + sc * 1.6;
    /* HUD */
    if (k !== this.k) { this.k = k; if (t < this.Tc) PL.hud(Math.max(0, k), false); }
    if (t >= this.Tc && !this.hudStopped) { this.hudStopped = true; PL.hudStop && PL.hudStop(); }
    /* settled: the dome is up and the push has been held off. The card starts its tour; the scene idles */
    if (bq > 3.6 && !this.settled) { this.settled = true; PL._heroT0 = this.t; W_emit("pl:settled"); this.fpsCap = 30; if (this.mob) this.freezeAfter = 0.6; }
    if (t < this.Tc) this.hudStopped = false;
    /* machines: taken ones glow ember; at containment stage 05 cools; after the burst 06 to 10 turn defended */
    this.ms.forEach((mc) => {
      const st = mc.m.stage, taken = st != null && st <= k;
      mc.hotT = taken ? (st === STOP ? 1 - cq : 1 - 0.65 * cq) : 0; mc.ledMode = taken && cq < 0.5 ? "attack" : st != null && st >= STOP && bq > 0 ? "defend" : null;
      mc.safeT = st != null && ((st === STOP && cq > 0.5) || (st > STOP && bq > 0.4)) ? 1 : 0;
      tintHardware(mc, dt); if (mc.parts && mc.m.type === "laptops") mc.parts.forEach((p) => { p.hot = mc.hot; p.safe = mc.safe; tintHardware(p, 0); });
    });
    if (this.peds) this.peds.forEach((pd) => { const taken = pd.st <= k, hot = taken ? (pd.st === STOP ? 1 - cq : 1 - 0.6 * cq) : 0, safe = pd.st === STOP && cq > 0.5 ? 1 : 0;
      pd.edge.material.color.copy(COL.idle).lerp(COL.defend, safe).lerp(COL.attack, hot); pd.edge.material.opacity = 0.18 + 0.25 * hot + 0.15 * safe; pd.halo.material.color.copy(COL.idle).multiplyScalar(0.4).lerp(COL.defend.clone().multiplyScalar(0.7), safe).lerp(COL.attack.clone().multiplyScalar(0.8), hot); pd.halo.material.opacity = 0.06 + 0.07 * hot + 0.04 * safe;
      pd.plate.material.color.copy(COL.idle).multiplyScalar(0.55).lerp(COL.defend.clone().multiplyScalar(0.9), safe).lerp(COL.attack.clone().multiplyScalar(0.8), hot * 0.85);
      if (pd.strip2) { pd.strip2.material.color.copy(COL.idle).multiplyScalar(0.4).lerp(COL.defend.clone().multiplyScalar(0.8), safe).lerp(COL.attack.clone().multiplyScalar(0.8), hot); pd.tip.material.color.copy(COL.idle).multiplyScalar(0.5).lerp(COL.attack.clone().multiplyScalar(0.7), hot); pd.tip.material.opacity = 0.25 + 0.25 * Math.max(0, Math.sin(t * 2.4 + pd.st)); } });
    PL.STAGES.forEach((s, i) => {
      const a = t - TA[i], ir = this.impacts[i], pool = this.pools[i];
      if (i > STOP) { ir.visible = false; pool.material.opacity = 0; return; }
      const p = s.m ? PL.M[s.m] : { x: PL.PATH[PL.STAGE_IDX[0]][0], z: PL.PATH[PL.STAGE_IDX[0]][2], y: 0 };
      ir.position.set(p.x, (p.y || 0) + 0.01, p.z); pool.position.set(p.x, (p.y || 0) + 0.004, p.z);
      if (a > 0 && a < 0.8) { ir.visible = true; const e = EASE(a / 0.8); ir.scale.setScalar(0.05 + 0.75 * e); ir.material.opacity = 0.3 * (1 - e); } else ir.visible = false;
      /* after the settle a card click lights this stage's pool for a moment (stages 01 to 05) */
      const lit = this.lightK === i && this.lightT != null ? Math.max(0, 1 - (t - this.lightT) / 1.8) : 0;
      pool.material.opacity = (a > 0 ? Math.min(0.1, (a / 0.5) * 0.1) * (1 - 0.8 * cq) : 0) + 0.22 * Math.sin(Math.PI * Math.min(1, (1 - lit))) * (lit > 0 ? 1 : 0);
    });
    /* containment: the ring closes from wide to tight around stage 05, then breathes */
    const cs = 2.4 - 1.4 * EASE(cq); this.contain.scale.setScalar(cs); this.cA.material.opacity = 0.5 * cq; this.cB.material.opacity = (0.28 + 0.12 * Math.sin(t * 2.2)) * cq; this.cB.rotation.z += 0.12 * dt;
    this.cPool.material.opacity = 0.07 * cq;
    /* one soft ring leaves stage 05 as the dome starts to rise */
    this.burst.forEach((r) => { const f = bq / 2.6; if (f > 0 && f < 1) { r.visible = true; const e = 1 - Math.pow(1 - f, 3); r.scale.setScalar(0.4 + 9 * e); r.material.opacity = 0.3 * (1 - f); } else r.visible = false; });
    const sq = smooth(0.5, 1.8, bq); this.shield.material.opacity = (0.3 + 0.15 * Math.sin(t * 1.6)) * sq; this.shield.rotation.z -= 0.05 * dt; this.shield2.material.opacity = 0.5 * sq;

    /* long horizon: the day clock, backdoors calling home, weak signals and the link */
    {
      const D5 = this.DAYS; let day = 0;
      if (k >= 0) { day = D5[k]; for (let q = 0; q < this.TL.length; q++) { const [a, len] = this.TL[q]; if (t > a && t < a + len) { const f = (t - a) / len; day = lerp(D5[q], D5[q + 1], f * f * (3 - 2 * f)); } } }
      if (t >= this.T5) day = D5[STOP];
      const dS = String(Math.floor(day)).padStart(2, "0"); if (this._day !== dS) { this._day = dS; this.headLab.e.innerHTML = "AI agent · <b>Day " + dS + "</b>"; }
      this.headLab.p.set(hp[0], hp[1] + 0.42, hp[2]); this.headLab.want = t >= TA[0] && cq < 0.4;
      const cut = smooth(this.Tc, this.Tc + 0.6, t);
      this.implants.forEach((I) => {
        const a = t - TA[I.i] - 0.15, on = a > 0 ? Math.min(1, a / 0.3) : 0;
        I.g.material.opacity = on * (1 - 0.5 * cut); I.g.rotation.y += dt * 1.6; I.g.material.color.copy(cut > 0.5 ? COL.defend : COL.attack).multiplyScalar(cut > 0.5 ? 1.2 : 2.4);
        I.glow.material.opacity = on * 0.25 * (1 - cut) * (0.7 + 0.3 * Math.sin(t * 5 + I.ph));
        const bt = a - 0.2; if (bt > 0 && cut < 1) { const f = (bt % 1.7) / 1.1; I.beacon.setHead(Math.min(1, f)); I.beacon.setFade((f < 1 ? 1 : 0.6) * (1 - cut)); } else { I.beacon.setFade(1 - cut); if (bt <= 0) I.beacon.setHead(0); }
      });
      this.sigs.forEach((s, i) => { const a = t - TA[i] - 0.3, on = a > 0 ? Math.min(1, a / 0.4) : 0, lit = smooth(this.Tl + i * 0.16, this.Tl + i * 0.16 + 0.2, t);
        s.s.material.opacity = 0.5 * on * (0.35 + 0.65 * lit) * (1 - 0.6 * smooth(0.8, 2, bq)); s.s.scale.setScalar(0.18 + 0.1 * lit); s.d.material.opacity = on * (0.5 + 0.5 * lit) * (1 - 0.5 * smooth(0.8, 2, bq)); s.d.rotation.y += dt; });
      const lq = clamp((t - this.Tl) / 0.85, 0, 1); this.link.setHead(EASE(lq)); this.link.setFade(lq > 0 ? 1 - 0.6 * smooth(0.6, 2.2, bq) : 0);
      tintHardware(this.c2, dt); this.c2.hotT = 1 - 0.7 * cut; this.c2Ring.material.opacity = 0.55 * (1 - 0.7 * cut); this.c2Ring.rotation.z -= dt * 0.2; this.c2Pool.material.opacity = 0.18 * (1 - 0.8 * cut) * (0.8 + 0.2 * Math.sin(t * 3));
      const c2s = cut > 0.5 ? "cut" : "on"; if (this._c2s !== c2s) { this._c2s = c2s; this.c2Lab.e.innerHTML = c2s === "cut" ? "Attacker's server · <b>cut off</b>" : "Attacker's server"; this.c2Lab.w = 0; }
      this.c2Lab.want = t > TA[0] + 0.4 && bq < 1.2 && !PL.mobile();
    }
    this.ghost.material.opacity = linA(0.32) * smooth(TA[1], TA[2], t) * (1 - smooth(0, 1.2, bq));
    /* the dome: rises over the core as the burst leaves stage 05, takes the hit, then holds and breathes */
    {
      const dq = smooth(0.15, 1.75, bq), Hd = this.domeR * this.domeSY, y0 = PL.PLINTH.h, hNow = y0 - 0.02 + (Hd + 0.06) * (dq * dq * (3 - 2 * dq));
      this.clip.constant = hNow; const U2 = this.shellMat.uniforms; U2.uH.value = hNow; U2.uA.value = 0.4 * smooth(0.1, 0.6, bq) * (0.92 + 0.08 * Math.sin(t * 1.4)); U2.uT.value = t;
      this.wireMat.opacity = 0.21 * smooth(0.1, 0.5, bq); this.geoMat.opacity = linA(0.14) * smooth(0.6, 1.6, bq); this.collar.material.opacity = smooth(0, 0.4, bq);
      const sy = hNow - y0, rr = sy > 0 && sy < Hd ? this.domeR * Math.sqrt(Math.max(0, 1 - Math.pow(sy / Hd, 2))) : 0;
      this.scanRing.visible = dq > 0 && dq < 1 && rr > 0.05; this.scanRing.position.y = hNow; this.scanRing.scale.setScalar(Math.max(0.01, rr)); this.scanRing.material.opacity = 0.9 * Math.sin(Math.PI * dq);
      /* the push: the line runs from stage 05 to the shell, touches, flares, and is held off */
      let ia = 0; this.impSpark.material.opacity = 0;
      this.thrusts.forEach((th) => {
        const a = bq - th.at, hitT = th.travel, f = clamp(a / hitT, 0, 1), after = a - hitT;
        const head = a <= 0 ? 0 : after < 0 ? EASE(f) : Math.max(0.78, 1 - 0.22 * EASE(clamp(after / 0.5, 0, 1)));
        th.L.setHead(head); th.L.setFade(a <= 0 ? 0 : (after < 0.4 ? 1 : Math.max(0.12, 1 - (after - 0.4) / 1.4)) * th.k); th.L.setBase(0.35); th.L.setHot(after < 0.6 ? 1 : 0);
        const g = after > 0 ? Math.exp(-after * 2.4) : 0;
        th.flare.material.opacity = 0.7 * g * th.k * (0.88 + 0.12 * Math.sin(t * 40)); th.flare.scale.setScalar((0.3 + 0.3 * (1 - g)) * th.k);
        const rq = after > 0 ? clamp(after / 1.1, 0, 1) : 0; th.ring.visible = rq > 0 && rq < 1; th.ring.scale.setScalar(0.05 + 0.75 * EASE(rq)); th.ring.material.opacity = 0.5 * (1 - rq) * (1 - rq) * th.k;
        th.hex.visible = after > 0 && after < 1.6; th.hex.scale.setScalar(0.22 + 0.12 * EASE(clamp(after / 0.4, 0, 1))); th.hex.material.opacity = 0.7 * Math.exp(-after * 1.8) * th.k;
        if (after > 0 && after < 1.8) { U2.uImp.value.copy(th.to); U2.uImpR.value = after * 2.0; U2.uImpA.value = Math.max(0, 1 - after / 1.8) * th.k; ia = 1; }
      });
      if (!ia) U2.uImpA.value = 0;
      if (this.uplinkEnds) this.uplinkEnds.forEach((s2, i) => { s2.material.opacity = 0.25 + 0.2 * Math.sin(t * 1.3 + i * 1.7); });
    }
    /* packets: quiet traffic on every cable */
    this.packets.forEach((P2) => { const n = P2.c.length, f = ((t * P2.sp + P2.ph) % 1), p = P2.c[Math.min(n - 1, Math.floor(f * n))]; P2.s.position.set(p[0], p[1] + 0.02, p[2]); P2.s.material.opacity = 0.35 * Math.sin(f * Math.PI); });
    {
      const F = this.focus, on = F.k != null; F.a = lerp(F.a, on ? 1 : 0, 1 - Math.pow(0.001, dt / 0.35));
      const ft = on ? t - (F.t0 || 0) : 0, w = (ft % 1.8) / 1.8, intro = on ? EASE(clamp(ft / 0.6, 0, 1)) : 1;
      F.pool.material.opacity = 0.55 * F.a * (0.85 + 0.15 * Math.sin(t * 2.4));
      F.ring.scale.setScalar(0.62 + 0.6 * (1 - intro)); F.ring.material.opacity = F.a * intro;
      F.wave.scale.setScalar(0.62 + 0.8 * EASE(w)); F.wave.material.opacity = 0.7 * F.a * (1 - w);
      F.beam.material.opacity = 0.8 * F.a * intro; F.lab.want = on && F.a > 0.2;
      if (F.seg) { F.seg.setHead(EASE(clamp(ft / 0.9, 0, 1))); F.seg.setFade(F.a); }
      this.ms.forEach((mc) => { if (mc === this.hovered) return; mc.hoverT = on && mc.m.stage === F.k ? 1 : 0; });
    }
    if (this.settled) { this.drift.tx = 0; this.drift.ty = 0; } /* the picture holds still after the dome closes */
    this.animMachines(this.ms, dt); this.leds.update(t);
    /* labels: the stage card names the stage; the scene stays clean */
    this.ms.forEach((mc) => { const st = mc.m.stage; mc.lab.want = false; mc.lab.e.classList.toggle("hot", st === k && cq < 0.5); mc.lab.e.classList.toggle("lbl--ring", st != null && st >= STOP && cq >= 0.5); mc.lab.prio = st === k ? 5 : 2; });
    this.stageL[0].want = false;
    /* camera: one continuous dolly, wide on the whole network, then a smooth push-in that ends with stage 05 near the centre */
    const prog = clamp((t - TA[0]) / (this.T5 - TA[0]), 0, 1);
    if (this.base) {
      const p2 = clamp((prog - 0.62) / 0.38, 0, 1), e = 0.15 * prog + 0.85 * p2 * p2 * p2 * (p2 * (p2 * 6 - 15) + 10), B = this.base, s0 = this.start0;
      this.camT.dist = lerp(B.dist * 1.1, B.dist, e); this.camT.el = lerp(B.el + 1, B.el, e); this.camT.az = B.az;
      this.camT.tx = lerp(s0[0], B.target[0], e); this.camT.ty = lerp(s0[1], B.target[1], e); this.camT.tz = lerp(s0[2], B.target[2], e);
      /* the dolly is scaled so the attacker's server and every stage stay below the nav;
         after the dome closes the camera eases out once to show the whole network, then holds still */
      const fm = this.fitM || { s: 1, e: 1, o: 1 };
      const SM = 1.12; this.camT.dist = lerp(B.dist * 1.1 * fm.s, B.dist * fm.e, e) * SM; let shT = lerp(fm.ss || 0, fm.se || 0, e);
      if (this.settled) { const q = this.outQ = Math.min(1, (this.outQ || 0) + dt / 2.2), qe = q * q * (3 - 2 * q); this.camT.dist = lerp(B.dist * fm.e * SM, B.dist * fm.o, qe); shT = lerp(fm.se || 0, fm.so || 0, qe); }
      this.shiftS = lerp(this.shiftS == null ? shT : this.shiftS, shT, 1 - Math.pow(1 - (this.camLerp || 0.08), dt * 60)); this.setOff();
    }
    if (this.hits) this.hits.forEach((b, i) => { const p = PL.stagePoint(i); const s = this.project(this.sp[i] || (this.sp[i] = new T.Vector3()).set(p[0], p[1], p[2])); b.style.left = s.x + "px"; b.style.top = s.y + "px"; });
    return true;
  }
}

/* =====================================================================
   Shared finish: survey ground and equipment pads
   ===================================================================== */
const lineM = (a, col) => new T.LineBasicMaterial({ color: col || COL.infra, transparent: true, opacity: linA(a), depthWrite: false });
const segs = (S, arr, mat) => { const l = new T.LineSegments(new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(arr, 3)), mat); S.add(l); return l; };
/* a pad with corner marks under each footprint */
function padsUnder(S, list, y) {
  const pads = [], marks = [];
  list.forEach((m) => { const yy = (m.y != null ? m.y : y || 0) + 0.003, pw = (m.w || 1) + 0.3, pd = (m.d || 0.6) + 0.3, g = new T.BoxGeometry(pw, 0.006, pd); g.translate(m.x, yy, m.z); pads.push(strip(g.toNonIndexed()));
    const hx = pw / 2, hz = pd / 2, L = 0.09, y2 = yy + 0.004; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => { const cx = m.x + sx * hx, cz = m.z + sz * hz; marks.push(cx, y2, cz, cx - sx * L, y2, cz, cx, y2, cz, cx, y2, cz - sz * L); }); });
  const pm = new T.Mesh(A.mergeGeometries(pads), new T.MeshStandardMaterial({ color: "#121212", roughness: 0.85, metalness: 0.15 })); pm.receiveShadow = true; S.add(pm);
  segs(S, marks, lineM(0.3));
}
/* ---------------------------------------------------------------------
   Manager: one scene, the hero. Built when it nears the screen, rendered only while it is
   on screen and the tab is visible, rebuilt once if the quality tier steps down.
   --------------------------------------------------------------------- */
const Manager = {
  it: null,
  init() {
    const el = D.querySelector('[data-scene="hero"]'); if (!el) return;
    const it = (this.it = { el, stage: null, near: false, vis: false });
    new IntersectionObserver((es) => es.forEach((e) => { it.near = e.isIntersecting; this.sync(); }), { rootMargin: "100% 0px 100% 0px" }).observe(el);
    new IntersectionObserver((es) => es.forEach((e) => { it.vis = e.isIntersecting; this.sync(); }), { rootMargin: "40px 0px" }).observe(el);
    D.addEventListener("visibilitychange", () => this.sync());
    addEventListener("pl:motion", (e) => { this.kill(); if (e.detail) this.sync(); else PL.drawTwins(); });
  },
  sync() {
    const it = this.it; if (!it || !PL.motion) return;
    if (it.near && !it.stage) {
      try { it.stage = new Hero(it.el); live.hero = true; PL._hero = it.stage; it.el.classList.add("is-live"); } catch (err) { console.warn("3D hero failed", err); it.stage = null; live.hero = false; return; }
    }
    if (it.stage) { if (it.vis && !D.hidden) it.stage.start(); else it.stage.stop(); }
  },
  kill() { const it = this.it; if (!it || !it.stage) return; it.stage.dispose(); it.stage = null; live.hero = false; it.el.classList.remove("is-live"); PL.drawTwins(); },
  retier() { const it = this.it; if (it && it.stage) PL._heroT0 = it.stage.t; this.kill(); this.sync(); } /* the rebuilt scene resumes where it was */
};

window.__PLM = Manager;
boot();
