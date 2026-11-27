// ENTRACTE ESTATE: one continuous 3D world, 13 camera stops. Plan -> walls -> interior -> tower -> district.
const N = 13;
const $ = s => document.querySelector(s);
const slides = [...document.querySelectorAll('.slide')];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eout = t => 1 - Math.pow(1 - t, 3);
const back = t => { const c = 1.5; return t <= 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
let cur = 0, navLock = 0;
const hashN = () => { const n = parseInt(location.hash.slice(1), 10); return n >= 1 && n <= N ? n - 1 : 0; };

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]static\b/.test(location.search);
const useFallback = reduced || !webglOK() || /[?&]fallback\b/.test(location.search);

// ---------------- shared chrome: text, progress, input ----------------
function fit() {
  for (const s of slides) {
    let k = 1; s.style.setProperty('--k', k);
    const wasOn = s.classList.contains('on'); s.style.visibility = 'hidden'; s.style.display = 'flex';
    while (s.scrollHeight > s.clientHeight + 2 && k > .55) { k -= .03; s.style.setProperty('--k', k.toFixed(2)); }
    s.style.visibility = ''; if (wasOn) s.classList.add('on');
  }
}
function showText(n, delay) {
  slides.forEach((s, i) => {
    if (i !== n) { s.classList.remove('on'); s.querySelectorAll('.r').forEach(e => e.style.transitionDelay = '0s'); }
  });
  clearTimeout(showText.t);
  showText.t = setTimeout(() => {
    const s = slides[n];
    s.querySelectorAll('.r').forEach((e, i) => e.style.transitionDelay = (i * .09).toFixed(2) + 's');
    s.classList.add('on');
  }, delay);
  $('#barfill').style.width = ((n + 1) / N * 100) + '%';
  $('#num').textContent = String(n + 1).padStart(2, '0') + ' / ' + N;
  if (location.hash !== '#' + (n + 1)) history.replaceState(null, '', '#' + (n + 1));
}
function bindInput(go) {
  let wheelQuietUntil = 0, acc = 0;
  addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    if (now < wheelQuietUntil) { wheelQuietUntil = Math.max(wheelQuietUntil, now + 220); return; }
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 28) { go(cur + Math.sign(acc)); acc = 0; wheelQuietUntil = now + 1000; }
  }, { passive: false });
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); if (!e.repeat) go(cur + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); if (!e.repeat) go(cur - 1); }
    else if (k === 'Home') go(0); else if (k === 'End') go(N - 1);
  });
  let tx = 0, ty = 0, tt = 0;
  addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = performance.now(); }, { passive: true });
  addEventListener('touchmove', e => { if (!e.target.closest('a')) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 36 || performance.now() - tt > 900) return; // taps go to the edge buttons
    go(cur + ((Math.abs(dy) > Math.abs(dx) ? -dy : -dx) > 0 ? 1 : -1));
  });
  $('#prev').addEventListener('click', () => go(cur - 1));
  $('#next').addEventListener('click', () => go(cur + 1));
  addEventListener('hashchange', () => { const n = hashN(); if (n !== cur) go(n, true); });
}

if (document.fonts) document.fonts.ready.then(() => fit());
if (useFallback) startFallback(); else startWorld().catch(err => { console.warn(err); startFallback(); });

function startFallback() {
  document.body.classList.add('fb');
  $('#gl').hidden = true; $('#fallback').hidden = false;
  const img = $('#fbimg');
  const go = (n) => {
    n = clamp(n, 0, N - 1); const now = performance.now();
    if (n === cur && img.src) return; if (now < navLock) return; navLock = now + 250;
    cur = n; img.src = `assets/shots/${String(n + 1).padStart(2, '0')}.png`; img.alt = `Слайд ${n + 1}`;
    showText(n, 0);
  };
  bindInput(go);
  cur = -1; go(hashN());
}

// ---------------- the world ----------------
async function startWorld() {
  const THREE = await import('three');
  const { mergeGeometries } = await import('three/addons/BufferGeometryUtils.js');
  const C = h => new THREE.Color(h);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]shot\b/.test(location.search) });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0A2560, 40, 120);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 900);

  // --- lights
  const hemi = new THREE.HemisphereLight(0xDCE6FF, 0x0A2560, 1.25);
  const sun = new THREE.DirectionalLight(0xFFFFFF, 2.4);
  sun.castShadow = true;
  const SM = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 4;
  scene.add(hemi, sun, sun.target);
  const lampA = new THREE.PointLight(0xFFB45A, 0, 9, 1.6), lampB = new THREE.PointLight(0xFFB45A, 0, 8, 1.6);
  lampA.position.set(-3.6, 1.9, -2.8); lampB.position.set(-1.6, 1.5, 1.4);

  // --- per-piece transform patch: every group is one draw call, pieces animate through a uniform array
  const groups = {};
  function makeGroup(name, n) { const g = { n, uT: { value: Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, 0)) } }; groups[name] = g; return g; }
  function patch(mat, g, extra) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uT = g.uT;
      if (extra) extra.uniforms(sh);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aI; attribute vec3 aP; uniform vec4 uT[${g.n}];`).replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec4 T = uT[int(aI + .5)];
  if (T.x <= 0.0${mat.userData.win ? ' || T.w < .5' : ''}) transformed = vec3(0., -9999., 0.);
  else transformed = vec3(aP.x + (transformed.x - aP.x) * T.x, aP.y + (transformed.y - aP.y) * T.y + T.z, aP.z + (transformed.z - aP.z) * T.x); }`);
      if (extra && extra.frag) sh.fragmentShader = extra.frag(sh.fragmentShader);
    };
    const key = mat.type + g.n + (mat.userData.win ? 'w' : '') + (extra ? 'x' : '');
    mat.customProgramCacheKey = () => key + Object.keys(groups).indexOf(Object.keys(groups).find(k => groups[k] === g));
    return mat;
  }
  function tag(geo, i, p, col) {
    geo.deleteAttribute('uv');
    const n = geo.attributes.position.count;
    geo.setAttribute('aI', new THREE.Float32BufferAttribute(new Float32Array(n).fill(i), 1));
    const pa = new Float32Array(n * 3); for (let k = 0; k < n; k++) { pa[k * 3] = p.x; pa[k * 3 + 1] = p.y; pa[k * 3 + 2] = p.z; }
    geo.setAttribute('aP', new THREE.Float32BufferAttribute(pa, 3));
    if (col) { const c = C(col), ca = new Float32Array(n * 3); for (let k = 0; k < n; k++) { ca[k * 3] = c.r; ca[k * 3 + 1] = c.g; ca[k * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.Float32BufferAttribute(ca, 3)); }
    return geo;
  }
  const depthFor = g => patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), g);
  function groupMesh(g, geos, mat, shadow = true) {
    const m = new THREE.Mesh(mergeGeometries(geos), patch(mat, g));
    m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true;
    if (shadow) m.customDepthMaterial = depthFor(g);
    return m;
  }
  function groupLines(g, geos, mat) { const l = new THREE.LineSegments(mergeGeometries(geos), patch(mat, g)); l.frustumCulled = false; return l; }
  function chamfer(w, h, d, b = .025) {
    b = Math.min(b, w / 3, h / 3, d / 3);
    const s = new THREE.Shape(), W = w / 2 - b, D = d / 2 - b;
    s.moveTo(-W, -D); s.lineTo(W, -D); s.lineTo(W, D); s.lineTo(-W, D); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, b, 0);
    return g;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0).toNonIndexed();
  const cyl = (rt, rb, h, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg, 1).translate(0, h / 2, 0).toNonIndexed();
  const edgeMat = (col, op) => new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, fog: true });

  // ---------- 1. sheet + plan ----------
  const world = new THREE.Group(); scene.add(world);
  const apt = new THREE.Group(); world.add(apt);
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0x123E94, roughness: 1, transparent: true });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(30, 21).rotateX(-Math.PI / 2), sheetMat);
  sheet.position.set(.6, -.02, .2); sheet.receiveShadow = true; world.add(sheet);
  const sheetLines = []; // frame, title block, faint grid
  const seg = (a, x1, z1, x2, z2, y = 0) => a.push(x1, y, z1, x2, y, z2);
  { const a = sheetLines, x0 = -13.9, x1 = 15.1, z0 = -9.8, z1 = 10.2;
    seg(a, x0, z0, x1, z0); seg(a, x1, z0, x1, z1); seg(a, x1, z1, x0, z1); seg(a, x0, z1, x0, z0);
    seg(a, 8.6, z1, 8.6, 7.4); seg(a, 8.6, 7.4, x1, 7.4); seg(a, 8.6, 8.8, x1, 8.8); seg(a, 11.8, 7.4, 11.8, z1);
    for (let x = -13; x <= 15; x += 2) seg(a, x, z0 - .35, x, z0 - .05);
  }
  const sheetLineMat = new THREE.LineBasicMaterial({ color: 0xFBFCFF, transparent: true, opacity: .55, fog: true });
  const sheetL = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sheetLines, 3)), sheetLineMat);
  sheetL.position.y = -.01; world.add(sheetL);

  const H = 2.8, T = .2;
  const WALLS = [[-6, -4.5, -4.6, -4.5], [-1.4, -4.5, 2.2, -4.5], [4.8, -4.5, 6, -4.5], [-6, 4.5, -4.4, 4.5], [-1.6, 4.5, 1.8, 4.5], [2.8, 4.5, 6, 4.5],
    [-6, -4.5, -6, -1.6], [-6, 1.6, -6, 4.5], [6, -4.5, 6, -3.4], [6, -1.2, 6, 4.5], [1, -4.5, 1, 1.6], [1, 2.8, 1, 4.5],
    [1, .6, 1.4, .6], [2.4, .6, 6, .6], [3.8, .6, 3.8, 1], [3.8, 1.9, 3.8, 4.5]];
  const PANES = [[-4.6, -4.5, -1.4, -4.5], [2.2, -4.5, 4.8, -4.5], [-4.4, 4.5, -1.6, 4.5], [-6, -1.6, -6, 1.6], [6, -3.4, 6, -1.2]];
  const gW = makeGroup('walls', WALLS.length + PANES.length);
  const wallGeos = [], wallEdges = [], paneGeos = [], wallMeta = [];
  [...WALLS, ...PANES].forEach(([x1, z1, x2, z2], i) => {
    const pane = i >= WALLS.length, hor = z1 === z2, len = Math.abs(hor ? x2 - x1 : z2 - z1) + (pane ? 0 : T);
    const th = pane ? .06 : T, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const g = new THREE.BoxGeometry(hor ? len : th, 1, hor ? th : len).translate(cx, .5, cz).toNonIndexed();
    const p = V(cx, 0, cz);
    (pane ? paneGeos : wallGeos).push(tag(g, i, p));
    wallEdges.push(tag(new THREE.EdgesGeometry(g), i, p));
    if (pane) { // two mullions
      for (const f of [.33, .66]) {
        const mx = hor ? x1 + (x2 - x1) * f : x1, mz = hor ? z1 : z1 + (z2 - z1) * f;
        wallEdges.push(tag(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([mx, 0, mz, mx, 1, mz], 3)), i, p));
      }
    }
    wallMeta.push({ d: clamp(((cx + 6) / 12) * .55 + ((cz + 4.5) / 9) * .45), pane });
  });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xF2F5FB, roughness: .92 });
  const walls = groupMesh(gW, wallGeos, wallMat);
  const paneMat = new THREE.MeshStandardMaterial({ color: 0xBFD3FF, roughness: .1, metalness: 0, transparent: true, opacity: .2, depthWrite: false });
  const panes = groupMesh(gW, paneGeos, paneMat, false);
  const wallEdgeMat = edgeMat(0x4D72C4, .75);
  const wallL = groupLines(gW, wallEdges, wallEdgeMat);
  apt.add(walls, panes, wallL);

  // floors per room (fade in under the rising walls)
  const ROOMS = [[-6, 1, -4.5, 4.5, 0xE7DDCD], [1, 6, -4.5, .6, 0xE7DDCD], [1, 3.8, .6, 4.5, 0xDCE3F0], [3.8, 6, .6, 4.5, 0xD3DDEE]];
  const floorGeo = mergeGeometries(ROOMS.map(([a, b, c, d, col]) => {
    const g = new THREE.PlaneGeometry(b - a, d - c).rotateX(-Math.PI / 2).translate((a + b) / 2, .004, (c + d) / 2).toNonIndexed();
    g.deleteAttribute('uv'); const cc = C(col), n = g.attributes.position.count, ca = [];
    for (let k = 0; k < n; k++) ca.push(cc.r, cc.g, cc.b);
    g.setAttribute('color', new THREE.Float32BufferAttribute(ca, 3)); return g;
  }));
  const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, transparent: true, opacity: 0 });
  const floor = new THREE.Mesh(floorGeo, floorMat); floor.receiveShadow = true; apt.add(floor);

  // plan drawing: wall outlines, glazing, door swings, furniture symbols, dimensions
  const plan = [];
  const rect = (a, b, c, d) => { seg(plan, a, c, b, c); seg(plan, b, c, b, d); seg(plan, b, d, a, d); seg(plan, a, d, a, c); };
  WALLS.forEach(([x1, z1, x2, z2]) => { const hor = z1 === z2; hor ? rect(Math.min(x1, x2) - T / 2, Math.max(x1, x2) + T / 2, z1 - T / 2, z1 + T / 2) : rect(x1 - T / 2, x1 + T / 2, Math.min(z1, z2) - T / 2, Math.max(z1, z2) + T / 2); });
  PANES.forEach(([x1, z1, x2, z2]) => { const hor = z1 === z2; for (const o of [-.05, .05]) hor ? seg(plan, x1, z1 + o, x2, z1 + o) : seg(plan, x1 + o, z1, x1 + o, z2); });
  const arc = (cx, cz, r, a0, a1, leafX, leafZ) => { const n = 10; for (let k = 0; k < n; k++) { const t0 = a0 + (a1 - a0) * k / n, t1 = a0 + (a1 - a0) * (k + 1) / n; seg(plan, cx + r * Math.cos(t0), cz + r * Math.sin(t0), cx + r * Math.cos(t1), cz + r * Math.sin(t1)); } seg(plan, cx, cz, leafX, leafZ); };
  arc(1, 1.6, 1.2, Math.PI / 2, Math.PI, 1, 2.8); arc(1.4, .6, 1, 0, -Math.PI / 2, 1.4, -.4); arc(3.8, 1.9, .9, -Math.PI / 2, -Math.PI, 2.9, 1.9); arc(2.8, 4.5, 1, Math.PI, Math.PI * 1.5, 2.8, 3.5);
  [[-4.2, -1.8, .85, 1.75], [-3.45, -2.55, 2.1, 2.9], [-4.5, -2.7, -3.25, -2.35], [.28, .9, -4.3, -.8], [-1.6, -.6, -3.7, -1.5], [3.6, 5.4, -1.6, .5], [1.1, 1.7, -4.3, -1.8], [4, 5.8, 3.65, 4.35], [-4.6, -1.4, 1.1, 3.7]].forEach(r => rect(...r));
  { const zD = -5.5; seg(plan, -6, zD, 6, zD); for (const x of [-6, -4.6, -1.4, 1, 2.2, 4.8, 6]) seg(plan, x, zD - .2, x, zD + .2);
    const xD = 7; seg(plan, xD, -4.5, xD, 4.5); for (const z of [-4.5, -3.4, -1.2, .6, 4.5]) seg(plan, xD - .2, z, xD + .2, z); }
  const planGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(plan, 3));
  const planMat = new THREE.LineBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .95, fog: true });
  const planL = new THREE.LineSegments(planGeo, planMat); planL.position.y = .03; apt.add(planL);
  const planVerts = plan.length / 3;

  // ---------- 2. furniture: base (kitchen, bedroom, bath, hall), living set A, living set B ----------
  function furnGroup(name, items) {
    const g = makeGroup(name, items.length), geos = [], glow = [], outl = [];
    items.forEach((it, i) => {
      const pv = V(it.x, 0, it.z);
      const put = (geo, col, x, y, z, ry = 0, rx = 0, isGlow = false) => {
        if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry);
        geo.translate(x, y, z); geo.rotateY(it.ry || 0); geo.translate(it.x, 0, it.z);
        if (isGlow) glow.push(tag(geo, i, pv, col)); else { geos.push(tag(geo, i, pv, col)); if (it.hl) outl.push(tag(new THREE.EdgesGeometry(geo, 25), i, pv)); }
      };
      it.make({ B: (w, h, d, x, y, z, col, ry, b) => put(chamfer(w, h, d, b), col, x, y, z, ry), K: (w, h, d, x, y, z, col, ry) => put(box(w, h, d), col, x, y, z, ry),
        Cy: (rt, rb, h, x, y, z, col, s) => put(cyl(rt, rb, h, s), col, x, y, z), Sp: (r, x, y, z, col) => put(new THREE.IcosahedronGeometry(r, 1), col, x, y, z),
        G: (r, x, y, z) => put(new THREE.SphereGeometry(r, 12, 8).toNonIndexed(), 0xFFD9A0, x, y, z, 0, 0, true),
        GC: (rt, rb, h, x, y, z) => put(cyl(rt, rb, h), 0xFFD9A0, x, y, z, 0, 0, true) });
    });
    const body = groupMesh(g, geos, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .72 }));
    const gl = glow.length ? groupMesh(g, glow, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), false) : null;
    const ol = outl.length ? groupLines(g, outl, edgeMat(0xFFB45A, 0)) : null;
    [body, gl, ol].forEach(o => o && apt.add(o));
    return { g, items, body, gl, ol };
  }
  const W1 = 0xF4F6FA, GR = 0x2B2F38;
  const chair = (B, x, z, ry, seat, frame) => { B(.46, .46, .46, x, 0, z, frame, ry, .02); B(.46, .08, .46, x, .42, z, seat, ry, .02);
    const bx = x + Math.sin(ry) * -.2, bz = z + Math.cos(ry) * -.2; B(.46, .42, .08, bx, .5, bz, seat, ry, .02); };
  const plant = (o, x, z, pot, leaf) => { o.Cy(.2, .16, .42, x, 0, z, pot); o.Sp(.36, x, .78, z, leaf); o.Sp(.26, x + .12, 1.08, z - .06, leaf); o.Sp(.22, x - .14, 1.0, z + .1, leaf); };
  const base = furnGroup('base', [
    { x: .59, z: -2.55, hl: 1, make: o => { o.B(.62, .86, 3.5, 0, 0, 0, W1); o.K(.66, .04, 3.54, 0, .86, 0, GR); o.B(.34, .72, 1.6, .14, 1.5, -.95, W1); o.B(.34, .72, 1.0, .14, 1.5, 1.25, W1);
      o.K(.4, .02, .5, 0, .9, .35, 0x9AA3B5); o.Cy(.012, .012, .3, -.2, .9, .35, 0xC9CED8, 8); } },
    { x: -1.1, z: -2.6, make: o => { o.B(1.0, .88, 2.2, 0, 0, 0, W1); o.K(1.08, .05, 2.28, 0, .88, 0, 0xD9C29E); for (const z of [-.6, .1]) { o.Cy(.2, .2, .06, -.8, .7, z, GR); o.Cy(.03, .03, .7, -.8, 0, z, GR, 8); } } },
    { x: 4.5, z: -.55, make: o => { o.B(1.9, .32, 2.1, 0, 0, 0, 0xD9C29E); o.B(1.8, .26, 2.0, 0, .32, -.02, W1, 0, .05); o.B(1.84, .12, 1.4, 0, .54, -.32, 0x9DB4EA, 0, .05);
      o.B(.6, .14, .34, -.42, .58, .78, W1, 0, .06); o.B(.6, .14, .34, .42, .58, .78, W1, 0, .06); o.B(2.0, 1.1, .1, 0, 0, 1.03, 0x8FA6D8); } },
    { x: 3.25, z: .2, make: o => { o.B(.44, .48, .4, 0, 0, 0, 0xD9C29E); o.Cy(.05, .08, .2, 0, .48, 0, GR); o.GC(.13, .16, .22, 0, .68, 0); } },
    { x: 5.75, z: .2, make: o => { o.B(.44, .48, .4, 0, 0, 0, 0xD9C29E); o.Cy(.05, .08, .2, 0, .48, 0, GR); o.GC(.13, .16, .22, 0, .68, 0); } },
    { x: 1.42, z: -3.05, make: o => { o.B(.6, 2.3, 2.5, 0, 0, 0, 0xE4D3B6); o.K(.02, 2.1, .02, .31, .1, 0, 0x9C8B70); } },
    { x: 4.5, z: -.9, make: o => o.K(2.6, .015, 2.4, 0, 0, 0, 0xC9D6EE) },
    { x: 4.9, z: 4.0, make: o => { o.B(1.8, .55, .72, 0, 0, 0, W1, 0, .08); o.K(1.6, .02, .52, 0, .55, 0, 0xB9CBEB); } },
    { x: 5.68, z: 1.7, make: o => { o.B(.5, .82, .9, 0, 0, 0, 0xD9C29E); o.Cy(.17, .14, .1, 0, .82, 0, W1); o.K(.04, .7, .7, .23, 1.1, 0, 0xCFE0FF); } },
    { x: 1.4, z: 3.7, make: o => { o.B(.4, .8, 1.2, 0, 0, 0, 0xD9C29E); o.K(.04, 1.0, .7, -.2, 1.15, 0, 0xCFE0FF); plant(o, .02, -.9, GR, 0x6F9A7E); } },
  ]);
  const UP_A = 0x2F5BB8, OAK = 0xD9C29E;
  const setA = furnGroup('setA', [
    { x: -4.9, z: 2.4, make: o => o.K(3.2, .015, 2.6, 1.9, 0, 0, 0xC9D6EE) },
    { x: -3.0, z: 1.3, make: o => { o.B(2.4, .42, .95, 0, 0, 0, UP_A); o.B(2.4, .5, .24, 0, .38, -.36, UP_A); o.B(.22, .62, .95, -1.1, 0, 0, UP_A); o.B(.22, .62, .95, 1.1, 0, 0, UP_A);
      o.B(.98, .12, .62, -.5, .42, .08, 0x4A73CC, 0, .05); o.B(.98, .12, .62, .5, .42, .08, 0x4A73CC, 0, .05); o.B(.42, .36, .12, -.6, .55, -.16, 0xFFB45A, 0, .05); o.B(.42, .36, .12, .62, .55, -.16, W1, 0, .05); } },
    { x: -3.0, z: 2.6, make: o => { o.Cy(.48, .48, .04, 0, .36, 0, OAK, 24); o.Cy(.08, .14, .36, 0, 0, 0, GR); o.Cy(.12, .1, .06, .15, .4, -.1, W1); } },
    { x: -4.95, z: 2.55, ry: Math.PI / 2, make: o => { o.B(.8, .4, .78, 0, 0, 0, W1); o.B(.8, .44, .18, 0, .36, -.3, W1); o.B(.14, .56, .78, -.33, 0, 0, W1); o.B(.14, .56, .78, .33, 0, 0, W1); o.B(.5, .1, .5, 0, .4, .05, 0x4A73CC, 0, .04); } },
    { x: -3.6, z: -2.8, make: o => { o.B(1.8, .05, .9, 0, .72, 0, OAK, 0, .015); for (const [x, z] of [[-.82, -.38], [.82, -.38], [-.82, .38], [.82, .38]]) o.K(.05, .72, .05, x, 0, z, GR);
      chair(o.B, -.45, -.62, 0, UP_A, W1); chair(o.B, .45, -.62, 0, UP_A, W1); chair(o.B, -.45, .62, Math.PI, UP_A, W1); chair(o.B, .45, .62, Math.PI, UP_A, W1); } },
    { x: -3.6, z: -2.8, make: o => { o.Cy(.006, .006, .9, 0, 1.9, 0, GR, 6); o.Cy(.08, .34, .26, 0, 1.64, 0, W1, 20); o.G(.1, 0, 1.68, 0); } },
    { x: -1.5, z: 1.0, make: o => { o.Cy(.18, .2, .03, 0, 0, 0, GR); o.Cy(.015, .015, 1.4, 0, 0, 0, GR, 6); o.Cy(.16, .22, .3, 0, 1.3, 0, 0xF2E6CF); o.G(.09, 0, 1.36, 0); } },
    { x: -5.45, z: -3.95, make: o => plant(o, 0, 0, W1, 0x6F9A7E) },
    { x: .45, z: 3.9, make: o => plant(o, 0, 0, 0xD9C29E, 0x5E8C6A) },
  ]);
  const UP_B = 0xC9774F, WAL = 0x7A5236, BR = 0xB08D57;
  const setB = furnGroup('setB', [
    { x: -3.1, z: 2.4, make: o => o.K(3.6, .015, 2.9, 0, 0, 0, 0x34466F) },
    { x: -3.0, z: 1.3, hl: 1, make: o => { o.B(2.8, .4, .95, 0, 0, 0, UP_B, 0, .06); o.B(2.8, .46, .26, 0, .36, -.35, UP_B, 0, .06); o.B(.95, .4, 1.0, -.92, 0, .96, UP_B, 0, .06);
      o.B(.9, .12, .64, -.92, .4, .1, 0xD98A60, 0, .05); o.B(.9, .12, .64, .1, .4, .1, 0xD98A60, 0, .05); o.B(.9, .12, .64, .98, .4, .1, 0xD98A60, 0, .05); o.B(.4, .34, .12, 1.0, .52, -.16, 0xF2F5FB, 0, .05); } },
    { x: -2.75, z: 2.65, hl: 1, make: o => { o.B(1.2, .06, .62, 0, .32, 0, WAL, 0, .02); o.B(1.0, .32, .1, 0, 0, -.2, GR); o.B(1.0, .32, .1, 0, 0, .2, GR); o.Cy(.09, .07, .18, .3, .38, 0, BR); } },
    { x: -1.2, z: 2.6, ry: -Math.PI / 2.6, make: o => { o.Cy(.4, .36, .38, 0, 0, 0, 0xE9DCC6, 20); o.B(.8, .46, .2, 0, .3, -.3, 0xE9DCC6, 0, .08); o.Cy(.34, .34, .1, 0, .38, .02, 0xD98A60, 20); } },
    { x: -3.6, z: -2.8, make: o => { o.Cy(.68, .68, .05, 0, .72, 0, WAL, 32); o.Cy(.08, .26, .72, 0, 0, 0, GR, 16);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; chair(o.B, Math.sin(a) * .82, Math.cos(a) * .82, a + Math.PI, 0x34466F, GR); } } },
    { x: -3.6, z: -2.8, hl: 1, make: o => { o.Cy(.006, .006, .8, 0, 2.0, 0, GR, 6); o.Cy(.55, .55, .04, 0, 1.96, 0, BR, 32); o.GC(.5, .5, .02, 0, 1.94, 0); } },
    { x: -1.3, z: .55, make: o => { o.Cy(.2, .2, .03, 0, 0, 0, GR); o.Cy(.015, .015, 1.7, 0, 0, 0, BR, 6); o.G(.18, 0, 1.78, 0); } },
    { x: -5.72, z: 3.1, make: o => { o.B(.42, .72, 1.9, 0, 0, 0, WAL); o.Cy(.12, .1, .3, 0, .72, -.5, 0xF2F5FB); o.B(.2, .26, .3, 0, .72, .5, BR); } },
    { x: -5.45, z: -3.95, make: o => { o.Cy(.26, .22, .5, 0, 0, 0, GR); o.Sp(.5, 0, 1.0, 0, 0x4E7A5E); o.Sp(.36, .2, 1.45, 0, 0x4E7A5E); o.Sp(.3, -.2, 1.3, .15, 0x4E7A5E); } },
  ]);
  const glowMats = [base, setA, setB].map(s => s.gl && s.gl.material);

  // ---------- 3. tower (other floors) ----------
  const G0 = -5 * 3.2 - .3; // ground level
  const KS = [-5, -4, -3, -2, -1, 0, 1, 2];
  const gT = makeGroup('tower', KS.length);
  const tGeos = [], tEdges = [], tWin = [];
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const LIT = [0xFFB45A, 0xFFC877, 0xFF9E45, 0xFFD69A];
  function windowsOn(list, i, pv, x0, z0, w, d, y0, floors, col = 2.6, litP = .5, WR = .62) {
    const quad = (cx, cy, cz, ux, uz, ww, hh) => {
      const a = [], hw = ww / 2, hh2 = hh / 2;
      const P = (s, t) => [cx + ux * s * hw, cy + t * hh2, cz + uz * s * hw];
      a.push(...P(-1, -1), ...P(1, -1), ...P(1, 1), ...P(-1, -1), ...P(1, 1), ...P(-1, 1));
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
      list.push(tag(g, i, pv, rnd() < litP ? LIT[(rnd() * 4) | 0] : 0x1A3370));
    };
    for (let f = 0; f < floors; f++) {
      const cy = y0 + f * 3.2 + 1.45;
      const nx = Math.max(1, Math.floor((w - 1) / col)), nz = Math.max(1, Math.floor((d - 1) / col));
      for (let k = 0; k < nx; k++) { const cx = x0 - w / 2 + (k + .5) * w / nx; quad(cx, cy, z0 + d / 2 + .04, 1, 0, w / nx * WR, 1.9); quad(cx, cy, z0 - d / 2 - .04, 1, 0, w / nx * WR, 1.9); }
      for (let k = 0; k < nz; k++) { const cz = z0 - d / 2 + (k + .5) * d / nz; quad(x0 + w / 2 + .04, cy, cz, 0, 1, d / nz * WR, 1.9); quad(x0 - w / 2 - .04, cy, cz, 0, 1, d / nz * WR, 1.9); }
    }
  }
  KS.forEach((k, i) => {
    const pv = V(0, 0, 0);
    const slab = box(12.6, .3, 9.6).translate(0, -.3, 0); tGeos.push(tag(slab, i, pv)); tEdges.push(tag(new THREE.EdgesGeometry(slab), i, pv));
    if (k !== 0) {
      const b = box(12.2, 2.9, 9.2); tGeos.push(tag(b, i, pv)); tEdges.push(tag(new THREE.EdgesGeometry(b), i, pv));
      windowsOn(tWin, i, pv, 0, 0, 12.2, 9.2, -.1, 1, 2.4, .62, .9);
    }
    if (k === 2) { const r = box(12.6, .3, 9.6).translate(0, 2.9, 0); tGeos.push(tag(r, i, pv)); tEdges.push(tag(new THREE.EdgesGeometry(r), i, pv)); const pp = box(3, 1.2, 2.4).translate(2, 3.2, -1); tGeos.push(tag(pp, i, pv)); tEdges.push(tag(new THREE.EdgesGeometry(pp), i, pv)); }
  });
  const bodyMat = () => new THREE.MeshStandardMaterial({ color: 0xEEF2FA, roughness: .9 });
  const tower = groupMesh(gT, tGeos, bodyMat());
  const towerL = groupLines(gT, tEdges, edgeMat(0xFFFFFF, .7));
  const U = { uDay: { value: C(0x6E8FD2) }, uNight: { value: 0 } };
  const winExtra = { uniforms: sh => { sh.uniforms.uDay = U.uDay; sh.uniforms.uNight = U.uNight; },
    frag: f => f.replace('#include <common>', '#include <common>\nuniform vec3 uDay; uniform float uNight;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(uDay, diffuseColor.rgb, uNight);') };
  const winMat = () => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true }); m.userData.win = 1; return m; };
  const towerWinMat = winMat(); patch(towerWinMat, gT, winExtra);
  const towerW = new THREE.Mesh(mergeGeometries(tWin), towerWinMat); towerW.frustumCulled = false;
  world.add(tower, towerL, towerW);

  // ---------- 4. district + your plot + house ----------
  const PLOT = { x: 36, z: 18, w: 15, d: 11 };
  const blds = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const r2 = i * i + j * j; if (r2 > 27 || (Math.abs(i) <= 1 && Math.abs(j) <= 1) || (i === 2 && j === 1)) continue;
    if (rnd() < .12) continue;
    const w = 8 + rnd() * 6, d = 8 + rnd() * 6, near = r2 <= 5, byPlot = Math.abs(i - 2) <= 1 && Math.abs(j - 1) <= 1;
    const h = byPlot ? 6.4 + (rnd() < .5 ? 3.2 : 0) + .6 : Math.round((near ? 7 + rnd() * 14 : 10 + rnd() * 30) / 3.2) * 3.2 + .6;
    blds.push({ x: i * 18 + (rnd() - .5) * 3, z: j * 18 + (rnd() - .5) * 3, w, d, h, dd: clamp(Math.sqrt(r2) / 5.3) });
  }
  blds.push({ x: PLOT.x + 1, z: PLOT.z, w: 11, d: 7.5, h: 7, dd: 0, house: 1 });
  const gC = makeGroup('city', blds.length);
  const cGeos = [], cEdges = [], cWin = [];
  blds.forEach((b, i) => {
    const pv = V(b.x, G0, b.z);
    const add = g => { cGeos.push(tag(g, i, pv)); cEdges.push(tag(new THREE.EdgesGeometry(g), i, pv)); };
    if (b.house) { add(box(b.w, 3.4, b.d).translate(b.x, G0, b.z)); add(box(b.w * .62, 3.2, b.d * .9).translate(b.x - b.w * .16, G0 + 3.4, b.z - .2)); add(box(b.w * .7, .25, b.d * 1.05).translate(b.x - b.w * .14, G0 + 6.6, b.z - .2));
      windowsOn(cWin, i, pv, b.x, b.z, b.w, b.d, G0, 1, 2.6, .9); windowsOn(cWin, i, pv, b.x - b.w * .16, b.z - .2, b.w * .62, b.d * .9, G0 + 3.4, 1, 2.4, .9); }
    else { add(box(b.w, b.h, b.d).translate(b.x, G0, b.z)); windowsOn(cWin, i, pv, b.x, b.z, b.w, b.d, G0 + .3, Math.floor(b.h / 3.2), 2.6, .42); }
  });
  const cityMat = bodyMat();
  const city = groupMesh(gC, cGeos, cityMat);
  const cityL = groupLines(gC, cEdges, edgeMat(0xFFFFFF, .5));
  const cityWinMat = winMat(); patch(cityWinMat, gC, winExtra);
  const cityW = new THREE.Mesh(mergeGeometries(cWin), cityWinMat); cityW.frustumCulled = false;
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xDDE5F4, roughness: 1, transparent: true, opacity: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520).rotateX(-Math.PI / 2), groundMat); ground.position.y = G0; ground.receiveShadow = true;
  const roads = [];
  for (let k = -5; k <= 5; k++) { const c = k * 18 + 9; roads.push(new THREE.PlaneGeometry(4.5, 220).rotateX(-Math.PI / 2).translate(c, 0, 0), new THREE.PlaneGeometry(220, 4.5).rotateX(-Math.PI / 2).translate(0, 0, c)); }
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xBCCAE6, roughness: 1, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  const road = new THREE.Mesh(mergeGeometries(roads), roadMat); road.position.y = G0 + .02; road.receiveShadow = true;
  const plotPts = [PLOT.x - PLOT.w / 2, PLOT.z - PLOT.d / 2, PLOT.x + PLOT.w / 2, PLOT.z - PLOT.d / 2, PLOT.x + PLOT.w / 2, PLOT.z + PLOT.d / 2, PLOT.x - PLOT.w / 2, PLOT.z + PLOT.d / 2, PLOT.x - PLOT.w / 2, PLOT.z - PLOT.d / 2];
  const plotGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 5 }, (_, k) => V(plotPts[k * 2], 0, plotPts[k * 2 + 1])));
  const plotMat = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: .9, gapSize: .6, transparent: true, opacity: 0, fog: true });
  const plotL = new THREE.Line(plotGeo, plotMat); plotL.computeLineDistances(); plotL.position.y = G0 + .08;
  world.add(ground, road, city, cityL, cityW, plotL);
  apt.add(lampA, lampB);

  // ---------- state per slide ----------
  // value or [value, delay s, duration s]
  const DEF = { plan: 0, walls: 0, furn: 0, swap: 0, warm: 0, outline: 0, sheet: 1, floors: 0, explode: 0, city: 0, day: 0, night: 0, plot: 0, house: 0, sink: 0, vf: 0 };
  const ST = [
    { plan: [1, .4, 2.8] },
    { plan: 1, vf: [1, 1, .6] },
    { plan: 1, walls: [1, .5, 2.4] },
    { plan: 1, walls: 1, furn: [1, 1.0, 1.8], warm: [1, 1.4, 1.6] },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: [1, 1.1, 2.0] },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: 1, outline: [1, 1.1, .9] },
    { plan: 1, walls: 1, furn: 1, warm: .7, swap: 1, sheet: [0, .2, 1], floors: [1, .5, 1.6], explode: [1, 1.5, 1.5], day: [1, .2, 1.6] },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: 1, sheet: 0, floors: 1, explode: [0, 0, 1.4], day: 1, city: [1, .5, 2.6], night: [1, 2.0, 2.8] },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: 1, sheet: 0, floors: 1, day: 1, city: 1, night: 1 },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: 1, sheet: 0, floors: 1, day: 1, city: 1, night: 1 },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: 1, sheet: 0, floors: 1, day: 1, city: 1, night: 1 },
    { plan: 1, walls: 1, furn: 1, warm: 1, swap: 1, sheet: 0, floors: 1, day: 1, city: 1, night: 1, plot: [1, .9, .8], house: [1, 1.8, 1.8] },
    { plan: 1, walls: [0, .2, 1.4], furn: [0, 0, .8], warm: 1, swap: 1, sheet: 0, floors: 1, day: 1, city: 1, night: 1, house: 1, sink: [1, .3, 2.4] },
  ];
  // camera stops: p position, t target, f fov, m portrait distance factor, fm portrait fov, via waypoints from previous stop, drift
  const PO = [
    { p: [10, 19, 17], t: [0, 0, .4], f: 36, fog: [40, 110], drift: { p: [6.5, 19.5, 19.5], d: 10 } },
    { p: [.4, 23, 3.2], t: [0, 0, .2], f: 36, fog: [40, 110], m: 2.15 },
    { p: [-14, 10.5, 15], t: [0, .5, 0], f: 36, fog: [40, 110], drift: { p: [-16.5, 10, 11.5], d: 9 } },
    { p: [-5.4, 1.5, 4.05], t: [-1.0, 1.05, -3], f: 54, fm: 70, m: 1, fog: [60, 200], via: [[-4.8, 6.2, 4.6]], dur: 2.3, drift: { p: [-4.1, 1.55, 4.0], t: [-.2, 1.0, -3.2], d: 8 } },
    { p: [-5.55, 2.55, 4.25], t: [-2.4, .45, -1.2], f: 52, fm: 70, m: 1, fog: [60, 200] },
    { p: [-3.0, 2.05, 4.15], t: [-2.2, .7, -1.4], f: 54, fm: 72, m: 1, fog: [60, 200] },
    { p: [-34, 4, 62], t: [0, -5.5, 0], f: 38, m: 2.1, fog: [90, 240], via: [[-3.0, 1.95, 4.5], [-3.6, 2.5, 9]], dur: 2.6 },
    { p: [-64, 40, 72], t: [6, -9, 0], f: 40, fog: [100, 300], m: 1.5, drift: { p: [-74, 42, 58], d: 10 } },
    { p: [46, 30, 58], t: [0, -9, 0], f: 40, fog: [100, 300], m: 1.5, drift: { p: [56, 32, 44], d: 10 } },
    { p: [80, 52, -18], t: [4, -10, 2], f: 40, fog: [100, 300], m: 1.5, drift: { p: [76, 50, -34], d: 10 } },
    { p: [-30, 22, -62], t: [0, -6, 0], f: 40, fog: [100, 300], m: 1.5, drift: { p: [-14, 22, -68], d: 10 } },
    { p: [60, 44, 46], t: [36, G0 + 2, 18], f: 40, fog: [100, 300], m: 1.4 },
    { p: [8, 190, 40], t: [6, G0, 2], f: 40, fog: [180, 420], m: 1.5, dur: 2.4 },
  ];

  const P = { ...DEF };
  let tweens = [];
  const portrait = () => innerHeight > innerWidth;
  function poseOf(n) {
    const o = PO[n], pt = V(...o.t), pp = V(...o.p);
    let f = o.f;
    if (portrait()) { const m = o.m ?? 1.75; pp.sub(pt).multiplyScalar(m).add(pt); f = o.fm ?? o.f + 6; }
    return { p: pp, t: pt, f, fog: o.fog };
  }
  const cam = { p: V(), t: V(), f: 38, fn: 40, ff: 120 };
  let flight = null, drift = null;
  function setState(n, instant) {
    const now = performance.now() / 1000, s = { ...DEF, ...Object.fromEntries(Object.entries(ST[n]).map(([k, v]) => [k, v])) };
    tweens = tweens.filter(tw => !(tw.key in s));
    for (const k in DEF) {
      let v = s[k], d = 0, du = .9; if (Array.isArray(v)) [v, d, du] = v;
      if (instant) { P[k] = v; continue; }
      if (P[k] !== v) tweens.push({ key: k, a: P[k], b: v, t0: now + d, du });
    }
  }
  function flyTo(n, from) {
    const o = PO[n], to = poseOf(n), now = performance.now() / 1000;
    const pts = [cam.p.clone()]; if (o.via && from === n - 1) o.via.forEach(v => pts.push(V(...v))); pts.push(to.p);
    flight = { curve: pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, 'centripetal') : null, a: pts[0], b: to.p, ta: cam.t.clone(), tb: to.t,
      fa: cam.f, fb: to.f, na: cam.fn, nb: to.fog[0], xa: cam.ff, xb: to.fog[1], t0: now, du: (from === n - 1 || from === n + 1) ? (o.dur || 1.7) : 1.8, n };
    drift = null;
  }

  // ---------- applying params to the scene ----------
  const colSpace = [C(0x041338), C(0x0A2560)], colDay = [C(0x1F52B8), C(0xAFC4EC)], colNight = [C(0x020818), C(0x0B2766)];
  const tmpA = C(0), tmpB = C(0);
  const sky = $('#sky').style;
  const loc = (v, d, S = .8) => clamp(v * (1 + S) - S * d);
  let shadowPhase = -1;
  function apply() {
    // walls & panes: footprints appear with the plan, then rise in a wave
    gW.uT.value.forEach((u, i) => {
      const m = wallMeta[i], drawn = m.pane ? P.walls > .02 : P.plan * 1.15 > m.d * .9 + .05;
      const h = eout(loc(P.walls, m.d, .9));
      u.set(drawn ? 1 : 0, Math.max(m.pane ? .001 : .05, h * H), 0, 1);
    });
    paneMat.opacity = .22 * clamp(P.walls * 3);
    wallEdgeMat.opacity = .75;
    floorMat.opacity = clamp(P.walls * 1.6 - .3);
    floorMat.visible = floorMat.opacity > .001;
    planGeo.setDrawRange(0, Math.floor(planVerts * clamp(P.plan) / 2) * 2);
    planMat.opacity = (.95 - .7 * clamp(P.walls * 1.5)) * P.sheet; planL.visible = planMat.opacity > .01;
    sheetMat.opacity = P.sheet; sheetLineMat.opacity = .55 * P.sheet; sheet.visible = sheetL.visible = P.sheet > .01;
    // furniture
    const pop = (sg, fn) => sg.g.uT.value.forEach((u, i) => { const s = fn(i / Math.max(1, sg.items.length - 1)); u.set(s > .001 ? s : 0, s, 0, 1); });
    pop(base, d => back(loc(P.furn, d, 1.2)));
    pop(setA, d => back(Math.min(loc(P.furn, d, 1.2), 1 - loc(P.swap, d, 1.3))));
    pop(setB, d => back(Math.min(loc(P.furn, d, 1.2), loc(P.swap * 1.1 - .1, d, 1.3))));
    for (const s of [base, setA, setB]) s.body.visible = s.g.uT.value.some(u => u.x > 0);
    setB.ol.material.opacity = .95 * P.outline; setB.ol.visible = P.outline > .01;
    const warm = P.warm;
    glowMats.forEach(m => m && m.color.setRGB(.55 + .45 * warm, .5 + .5 * warm, .45 + .55 * warm));
    lampA.intensity = 3.2 * warm; lampB.intensity = 2.0 * warm;
    // tower
    const kT = 1 - Math.pow(loc(P.sink, 0, .6), 3);
    gT.uT.value.forEach((u, i) => {
      const k = KS[i], a = eout(loc(P.floors, Math.abs(k) / 5, 1));
      if (k === 0) { u.set(P.floors > .01 ? 1 : 0, Math.max(.01, a * kT), G0 + (0 - G0) * kT, 1); return; }
      const y = k * 3.2 + eio(P.explode) * k * 1.7, sy = Math.max(.004, a * kT);
      u.set(P.floors > .01 && a > .001 ? 1 : 0, sy, G0 + (y - G0) * kT, sy > .3 ? 1 : 0);
    });
    apt.position.y = G0 + (0 - G0) * kT;
    // district
    gC.uT.value.forEach((u, i) => {
      const b = blds[i];
      const g = b.house ? eout(clamp(P.house)) * (1 - Math.pow(loc(P.sink, 0, .6), 3)) : eout(loc(P.city, b.dd, 1.2)) * (1 - Math.pow(loc(P.sink, 1 - b.dd, .6), 3));
      const on = b.house ? P.house > .002 : P.city > .002 && loc(P.city, b.dd, 1.2) > 0;
      u.set(on ? 1 : 0, Math.max(.004, g), 0, g > .25 ? 1 : 0);
    });
    groundMat.opacity = roadMat.opacity = clamp(P.city * 2.5); ground.visible = road.visible = P.city > .01;
    plotMat.opacity = .95 * P.plot * (1 - P.sink); plotL.visible = plotMat.opacity > .01;
    // light & sky: space -> day -> night
    const nt = P.night, dy = P.day;
    const sk = i => tmpA.copy(colSpace[i]).lerp(colDay[i], dy).lerp(colNight[i], nt);
    const top = sk(0).getHexString(), bot = sk(1).getHexString();
    scene.fog.color.copy(tmpA);
    sky.setProperty('--sky-top', '#' + top); sky.setProperty('--sky-bot', '#' + bot);
    tmpB.set(0x5C86E0).lerp(C(0xC9D8FF), dy).lerp(C(0x8A5A2C), nt);
    sky.setProperty('--glow', '#' + tmpB.getHexString());
    groundMat.color.set(0xDDE5F4).lerp(C(0x16306E), nt); roadMat.color.set(0xBCCAE6).lerp(C(0x27407E), nt);
    hemi.intensity = 1.25 - .85 * nt; hemi.color.set(0xDCE6FF).lerp(C(0xFFE6C8), .45 * warm * (1 - dy)).lerp(C(0x6F86C8), nt);
    hemi.groundColor.set(0x0A2560).lerp(C(0x8A7F86), .7 * warm * (1 - dy));
    sun.intensity = 2.4 - 2.0 * nt; sun.color.set(0xFFFFFF).lerp(C(0x9FB4F0), nt);
    U.uNight.value = nt;
    cityL.material.opacity = towerL.material.opacity = .35 + .45 * nt;
    // shadow frustum follows the scale of the scene
    const phase = P.city > .02 ? 1 : 0;
    if (phase !== shadowPhase) {
      shadowPhase = phase; const s = phase ? 95 : 10, sc = sun.shadow.camera;
      sc.left = sc.bottom = -s; sc.right = sc.top = s; sc.near = 1; sc.far = phase ? 400 : 60; sc.updateProjectionMatrix();
      sun.target.position.set(phase ? 6 : 0, phase ? G0 : 0, 0);
      sun.position.copy(sun.target.position).add(phase ? V(-80, 140, 60) : V(-9, 18, 11));
      sun.shadow.radius = phase ? 2 : 4;
    }
  }

  // ---------- overlays that follow 3D points ----------
  const tags = [['01', [-3.6, 1.9, -2.8]], ['02', [-3.0, .95, 1.3]], ['03', [-1.1, 1.0, -2.2]], ['04', [-2.9, .78, -2.2]]].map(([txt, p]) => {
    const el = document.createElement('div'); el.className = 'tag'; el.innerHTML = `<b></b><i></i><span>${txt}</span>`; $('#tags').appendChild(el); return { el, p: V(...p) };
  });
  const vf = $('#vf'), plotEl = $('#plot');
  const pr = V();
  const toScreen = (v) => { pr.copy(v).project(camera); return [(pr.x * .5 + .5) * innerWidth, (-pr.y * .5 + .5) * innerHeight, pr.z]; };
  function overlays() {
    const on = P.outline > .5;
    for (const t of tags) {
      const [x, y, z] = toScreen(pr.copy(t.p).add(apt.position));
      t.el.classList.toggle('on', on && z < 1);
      if (on) t.el.style.transform = `translate(${(x - 5).toFixed(1)}px,${(y - 5).toFixed(1)}px)`;
    }
    vf.classList.toggle('on', P.vf > .5);
    if (P.vf > .01) {
      const c = [[-7.2, -5.6], [7.2, -5.6], [7.2, 5.6], [-7.2, 5.6]].map(([x, z]) => toScreen(V(x, 0, z)));
      const xs = c.map(q => clamp(q[0], 14, innerWidth - 14)), ys = c.map(q => clamp(q[1], 74, innerHeight - 60));
      Object.assign(vf.style, { left: Math.min(...xs) + 'px', top: Math.min(...ys) + 'px', width: (Math.max(...xs) - Math.min(...xs)) + 'px', height: (Math.max(...ys) - Math.min(...ys)) + 'px', right: 'auto', bottom: 'auto' });
    }
    const pOn = P.plot > .5 && P.sink < .2;
    plotEl.classList.toggle('on', pOn);
    if (pOn) { const [x, y] = toScreen(V(PLOT.x, G0 + .1, PLOT.z + PLOT.d / 2 + 3.5)); plotEl.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  }

  // ---------- frame loop: runs only while something moves ----------
  let running = false, shadowDirty = true;
  const stats = { maxCalls: 0, maxTris: 0, perSlide: {} };
  window.__show = { stats, P, dbg: { camera, renderer, scene, cam }, resume: () => { window.__hold = false; const im = $('#snap'); if (im) im.remove(); kick(); },
    snap: () => { window.__hold = true; const im = $('#snap') || Object.assign(document.createElement('img'), { id: 'snap' }); im.src = canvas.toDataURL(); im.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none'; canvas.after(im); }, frames: 0, get busy() { return running; }, get cur() { return cur; } };
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (portrait()) camera.setViewOffset(w, h, 0, h * .29, w, h); else camera.setViewOffset(w, h, -w * .2, 0, w, h);
    camera.updateProjectionMatrix();
    fit(); kick();
  }
  function frame() {
    if (window.__hold) { running = false; return; } // test harness: freeze before a screenshot
    const now = performance.now() / 1000;
    let moving = false;
    tweens = tweens.filter(tw => {
      const k = clamp((now - tw.t0) / tw.du); if (now < tw.t0) { moving = true; return true; }
      P[tw.key] = tw.a + (tw.b - tw.a) * eio(k); moving = true; shadowDirty = true; return k < 1;
    });
    if (flight) {
      const k = clamp((now - flight.t0) / flight.du), e = eio(k);
      if (flight.curve) cam.p.copy(flight.curve.getPoint(e)); else cam.p.lerpVectors(flight.a, flight.b, e);
      cam.t.lerpVectors(flight.ta, flight.tb, e); cam.f = flight.fa + (flight.fb - flight.fa) * e;
      cam.fn = flight.na + (flight.nb - flight.na) * e; cam.ff = flight.xa + (flight.xb - flight.xa) * e;
      moving = true;
      if (k >= 1) {
        const o = PO[flight.n]; flight = null;
        if (o.drift) { const to = poseOf(cur), dp = V(...o.drift.p), dt = o.drift.t ? V(...o.drift.t) : to.t.clone();
          if (portrait()) { const m = o.m ?? 1.75; if (m !== 1) dp.sub(dt).multiplyScalar(m).add(dt); }
          drift = { a: cam.p.clone(), b: dp, ta: cam.t.clone(), tb: dt, t0: now, du: o.drift.d }; }
      }
    } else if (drift) {
      const k = clamp((now - drift.t0) / drift.du), e = .5 - .5 * Math.cos(Math.PI * k);
      cam.p.lerpVectors(drift.a, drift.b, e); cam.t.lerpVectors(drift.ta, drift.tb, e);
      moving = true; if (k >= 1) drift = null;
    }
    apply();
    camera.position.copy(cam.p); camera.lookAt(cam.t);
    if (Math.abs(camera.fov - cam.f) > 1e-3) { camera.fov = cam.f; camera.updateProjectionMatrix(); }
    scene.fog.near = cam.fn; scene.fog.far = cam.ff;
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, camera);
    const ri = renderer.info.render;
    stats.maxCalls = Math.max(stats.maxCalls, ri.calls); stats.maxTris = Math.max(stats.maxTris, ri.triangles);
    const ps = stats.perSlide[cur + 1] || (stats.perSlide[cur + 1] = { calls: 0, tris: 0 }); ps.calls = Math.max(ps.calls, ri.calls); ps.tris = Math.max(ps.tris, ri.triangles);
    overlays(); window.__show.frames++;
    if (moving) requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function go(n, fromHash) {
    n = clamp(n, 0, N - 1); const now = performance.now();
    if (n === cur || now < navLock) return; navLock = now + 650;
    const from = cur; cur = n;
    setState(n, false); flyTo(n, from);
    showText(n, Math.max(200, flight.du * 1000 * .72));
    shadowDirty = true; kick();
  }

  // start: previous stop's state, then fly into the requested one (slide 1 draws its plan)
  addEventListener('resize', resize);
  resize();
  const start = hashN();
  if (start > 0) { setState(start - 1, true); const pz = poseOf(start - 1); cam.p.copy(pz.p); cam.t.copy(pz.t); cam.f = pz.f; [cam.fn, cam.ff] = pz.fog; }
  else { const pz = poseOf(0); cam.t.copy(pz.t); cam.p.copy(pz.p).sub(pz.t).multiplyScalar(1.35).add(pz.t); cam.f = pz.f; [cam.fn, cam.ff] = pz.fog; }
  cur = -1;
  bindInput(go);
  if (start > 0) { cur = start - 1; navLock = 0; go(start); } else { cur = -1; setState(0, false); flyTo(0, -5); flight.du = 2.4; showText(0, 900); cur = 0; kick(); }
}
