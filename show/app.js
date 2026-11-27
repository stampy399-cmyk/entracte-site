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
const phoneMQ = matchMedia('(orientation:portrait),(max-aspect-ratio:1/1)');
const phone = () => phoneMQ.matches;
// phone layout: scene = top 58 %, text panel = bottom 42 % (expands to 84 %)
const PANEL = .42;
function layout() {
  const h = innerHeight, r = document.documentElement.style;
  if (!phone()) { r.removeProperty('--ph'); r.removeProperty('--pH'); return; }
  r.setProperty('--ph', Math.round(h * PANEL) + 'px'); r.setProperty('--pH', Math.round(h * .84) + 'px');
}
function setOpen(v) {
  document.body.classList.toggle('open', !!v);
  document.querySelectorAll('.grip').forEach(g => g.setAttribute('aria-expanded', v ? 'true' : 'false'));
  if (!v) slides.forEach(s => s.scrollTop = 0);
}
slides.forEach(s => {
  if (!s.querySelector('.x')) { s.classList.add('nog'); return; }
  const g = document.createElement('button'); g.type = 'button'; g.className = 'grip'; g.setAttribute('aria-expanded', 'false');
  g.innerHTML = '<span class="a">Подробнее</span><span class="c">Свернуть</span><i aria-hidden="true">▲</i>';
  g.addEventListener('click', () => setOpen(!document.body.classList.contains('open')));
  s.prepend(g);
});
function fit() {
  layout();
  for (const s of slides) {
    if (phone()) { // phone: fixed sizes, headings shrink to at most 3 lines
      s.style.setProperty('--k', 1);
      const wasOn = s.classList.contains('on'); s.style.visibility = 'hidden'; s.style.display = 'flex';
      s.querySelectorAll('h1,h2').forEach(e => {
        e.style.fontSize = ''; let px = parseFloat(getComputedStyle(e).fontSize);
        while (e.getBoundingClientRect().height > px * 1.12 * 3 + 2 && px > 17) { px -= 1; e.style.fontSize = px + 'px'; }
      });
      s.style.visibility = ''; s.style.display = ''; if (wasOn) s.classList.add('on');
      continue;
    }
    s.querySelectorAll('h1,h2').forEach(e => e.style.fontSize = '');
    let k = 1; s.style.setProperty('--k', k);
    const wasOn = s.classList.contains('on'); s.style.visibility = 'hidden'; s.style.display = 'flex';
    while (s.scrollHeight > s.clientHeight + 2 && k > .55) { k -= .03; s.style.setProperty('--k', k.toFixed(2)); }
    s.style.visibility = ''; if (wasOn) s.classList.add('on');
  }
}
function showText(n, delay) {
  setOpen(false);
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
    if (phone() && document.body.classList.contains('open') && e.target.closest('.slide')) return;
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
  let st0 = 0;
  addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = performance.now(); st0 = e.target.closest?.('.slide')?.scrollTop || 0; }, { passive: true });
  addEventListener('touchmove', e => { if (!e.target.closest('a')) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', e => {
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 36 || performance.now() - tt > 900) return; // taps go to the edge buttons
    if (phone()) { // horizontal swipe pages; vertical swipe on the panel opens/closes it, never pages
      if (Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
      else if (e.target.closest?.('.slide.on')) { if (dy < 0) setOpen(true); else if (st0 <= 0) setOpen(false); }
      return;
    }
    go(cur + ((Math.abs(dy) > Math.abs(dx) ? -dy : -dx) > 0 ? 1 : -1));
  });
  const edge = d => () => { if (phone() && document.body.classList.contains('open')) setOpen(false); else go(cur + d); };
  $('#prev').addEventListener('click', edge(-1));
  $('#next').addEventListener('click', edge(1));
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0A2560, 40, 120);
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 900);

  // --- procedural textures + two image-based environments (room for interiors, sky for the district)
  // heavy textures come from a worker after the first frame; until then 1x1 placeholders keep the same shader programs
  const texHooks = [];
  const tT0 = performance.now(), TX = (await import('./tex.js')).makeTextures(THREE, renderer, mobile, (k, t) => { TX[k] = t; texHooks.forEach(f => f(k, t)); window.__texN = (window.__texN || 0) + 1; if (window.__kick) window.__kick(); }), tT1 = performance.now();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRoom = (() => {
    const s = new THREE.Scene(), bm = (c, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 20), bm(0x8A7E70, .9)); room.position.y = 3; s.add(room);
    const panel = (w, h, c, k, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    panel(9, 4, 0xCFE0FF, 7, 0, 3, -9.9); panel(6, 3, 0xBFD3FF, 4, -9.9, 3, 0, Math.PI / 2);
    panel(2.2, 2.2, 0xFFB861, 14, 2, 6.9, 2, 0, Math.PI / 2); panel(1.4, 1.4, 0xFFC27A, 10, -3, 6.9, 4, 0, Math.PI / 2);
    panel(20, 20, 0x4A3526, 1, 0, -.95, 0, 0, Math.PI / 2);
    return pmrem.fromScene(s, .035).texture;
  })();
  let envSky = null; const makeSky = () => {
    const s = new THREE.Scene(), g = new THREE.SphereGeometry(50, 24, 12), p = g.attributes.position, col = [];
    const top = C(0x2A5CC4), hz = C(0xFFB27A), mid = C(0x9CB8EE), low = C(0x6A6E7A), t = C(0);
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) / 50; if (y > 0) t.copy(hz).lerp(mid, Math.min(1, y * 4)).lerp(top, clamp(y * 1.4 - .3)); else t.copy(hz).lerp(low, Math.min(1, -y * 5)); col.push(t.r * 2.2, t.g * 2.2, t.b * 2.2); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer), tx = pm.fromScene(s, .02).texture; pm.dispose(); return tx;
  };
  setTimeout(() => { envSky = makeSky(); shadowDirty = true; kick(); }, 1500); // the district sky is needed from slide 7 on
  pmrem.dispose(); const tT2 = performance.now();

  // --- lights
  const hemi = new THREE.HemisphereLight(0xDCE6FF, 0x0A2560, 1.25);
  const sun = new THREE.DirectionalLight(0xFFFFFF, 2.4);
  sun.castShadow = true;
  const SM = mobile ? 1024 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; sun.shadow.radius = 4;
  scene.add(hemi, sun, sun.target);
  const lampA = new THREE.PointLight(0xFFAE55, 0, 9, 1.6), lampB = new THREE.PointLight(0xFFB45A, 0, 8, 1.6), lampC = new THREE.PointLight(0xFFC27A, 0, 6, 1.8);
  lampA.position.set(-3.6, 1.45, -2.8); lampB.position.set(-1.5, 1.45, 1.0); lampC.position.set(-1.1, 1.5, -2.6);

  // --- per-piece transform patch: every group is one draw call, pieces animate through a uniform array
  const groups = {};
  function makeGroup(name, n) { const g = { n, uT: { value: Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, 0)) } }; groups[name] = g; return g; }
  function patch(mat, g, extra) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uT = g.uT;
      if (extra) extra.uniforms(sh);
      if (extra && extra.vert) sh.vertexShader = extra.vert(sh.vertexShader);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
attribute float aI; attribute vec3 aP; uniform vec4 uT[${g.n}];`).replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec4 T = uT[int(aI + .5)];
  if (T.x <= 0.0${mat.userData.win ? ' || T.w < .5' : ''}) transformed = vec3(0., -9999., 0.);
  else transformed = vec3(aP.x + (transformed.x - aP.x) * T.x, aP.y + (transformed.y - aP.y) * T.y + T.z, aP.z + (transformed.z - aP.z) * T.x); }`);
      if (extra && extra.frag) sh.fragmentShader = extra.frag(sh.fragmentShader);
    };
    const key = mat.type + g.n + (mat.userData.win ? 'w' : '') + (extra ? extra.key || 'x' : '');
    mat.customProgramCacheKey = () => key + Object.keys(groups).indexOf(Object.keys(groups).find(k => groups[k] === g));
    return mat;
  }
  // col: hex, or a surface [hex, roughness, metalness, kind]; kinds: 0 paint, 1 fabric, 2 wood, 3 marble, 4 metal, 5 accent wall, 6 plaster, 7 facade, 8 tile, 9 leaf
  const fill3 = (n, a, b, c) => { const r = new Float32Array(n * 3); for (let k = 0; k < n; k++) { r[k * 3] = a; r[k * 3 + 1] = b; r[k * 3 + 2] = c; } return new THREE.Float32BufferAttribute(r, 3); };
  function tag(geo, i, p, col, keepUV) {
    if (!keepUV) geo.deleteAttribute('uv');
    const n = geo.attributes.position.count;
    geo.setAttribute('aI', new THREE.Float32BufferAttribute(new Float32Array(n).fill(i), 1));
    geo.setAttribute('aP', fill3(n, p.x, p.y, p.z));
    const [hex, r, m, k] = Array.isArray(col) ? col : [col, .85, 0, 0];
    if (hex !== undefined) { const c = C(hex); geo.setAttribute('color', fill3(n, c.r, c.g, c.b)); }
    geo.setAttribute('aR', fill3(n, r, m, k));
    return geo;
  }
  // shared surface shader: triplanar detail (fabric/wood/marble/plaster/facade/tile), bump from the same height, roughness/metalness per vertex
  const PN = `vec3 pnArb(vec3 sp, vec3 sn, vec2 dH, float fd) { vec3 sx = normalize(dFdx(sp)), sy = normalize(dFdy(sp)), r1 = cross(sy, sn), r2 = cross(sn, sx);
  float det = dot(sx, r1) * fd; return normalize(abs(det) * sn - sign(det) * (dH.x * r1 + dH.y * r2)); }`;
  const SU = { tD1: { value: TX.det1 }, tD2: { value: TX.det2 }, uAcc: { value: C(0x9DAE8C) } };
  const SURF = { key: 's', uniforms: sh => Object.assign(sh.uniforms, SU),
    vert: v => v.replace('#include <common>', '#include <common>\nattribute vec3 aR; varying vec3 vR; varying vec3 vLP; varying vec3 vLN;')
      .replace('#include <project_vertex>', 'vR = aR; vLP = transformed; vLN = objectNormal;\n#include <project_vertex>'),
    frag: f => f.replace('#include <common>', `#include <common>
uniform sampler2D tD1, tD2; uniform vec3 uAcc; varying vec3 vR; varying vec3 vLP; varying vec3 vLN; float sH = .5;
vec3 tri(sampler2D t, float sc) { vec3 w = pow(abs(normalize(vLN)), vec3(4.)); w /= (w.x + w.y + w.z);
  return texture(t, vLP.zy * sc).rgb * w.x + texture(t, vLP.xz * sc).rgb * w.y + texture(t, vLP.xy * sc).rgb * w.z; }
${PN}`).replace('#include <color_fragment>', `#include <color_fragment>
{ int k = int(vR.z + .5);
  if (k == 5) diffuseColor.rgb = uAcc;
  if (k == 1 || k == 2 || k == 3 || k == 9) { vec3 d = tri(tD1, k == 1 ? 4. : k == 2 ? 1.5 : k == 9 ? 2.5 : 1.1); sH = k == 2 ? d.g : k == 3 ? d.b : d.r;
    diffuseColor.rgb *= k == 3 ? .55 + .9 * sH : k == 2 ? .8 + .4 * sH : .8 + .4 * sH; }
  else if (k != 4) { vec3 d = tri(tD2, k == 7 ? .11 : k == 8 ? 1.6 : .45); sH = k == 7 ? d.g : k == 8 ? d.b : d.r;
    diffuseColor.rgb *= k == 0 ? .95 + .1 * sH : k == 7 ? .84 + .32 * sH : .76 + .48 * sH; } }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(vR.x * (1.18 - .36 * sH), .04, 1.);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = vR.y;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{ int k = int(vR.z + .5); float bs = k == 1 ? 1.2 : k == 2 ? .35 : k == 3 ? .08 : k == 4 ? 0. : k == 7 ? 1.4 : k == 8 ? 1. : k == 9 ? .4 : k == 0 ? .15 : .5;
  if (bs > 0.) normal = pnArb(-vViewPosition, normal, vec2(dFdx(sH), dFdy(sH)) * bs, faceDirection); }`) };
  const surfMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  // rounded box with smooth normals (RoundedBoxGeometry method: unit box with odd segments pushed onto a rounded hull)
  function rbox(w, h, d, r = .025) {
    r = Math.min(r, w / 2.05, h / 2.05, d / 2.05);
    const sg = 3, g = new THREE.BoxGeometry(1, 1, 1, sg, sg, sg).toNonIndexed(), P = g.attributes.position, Nn = g.attributes.normal, hs = .5 / sg;
    const bx = V(w / 2 - r, h / 2 - r, d / 2 - r), p = V(), nn = V();
    for (let k = 0; k < P.count; k++) {
      p.fromBufferAttribute(P, k); nn.copy(p); nn.x -= Math.sign(nn.x) * hs; nn.y -= Math.sign(nn.y) * hs; nn.z -= Math.sign(nn.z) * hs; nn.normalize();
      P.setXYZ(k, bx.x * Math.sign(p.x) + nn.x * r, bx.y * Math.sign(p.y) + nn.y * r + h / 2, bx.z * Math.sign(p.z) + nn.z * r); Nn.setXYZ(k, nn.x, nn.y, nn.z);
    }
    return g;
  }
  const depthFor = g => patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), g);
  function groupMesh(g, geos, mat, shadow = true, extra) {
    const m = new THREE.Mesh(mergeGeometries(geos), patch(mat, g, extra));
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
  const sheetMat = new THREE.MeshStandardMaterial({ map: TX.paper, roughness: .92, transparent: true });
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
    const p = V(cx, 0, cz), accent = !pane && x1 === -6 && x2 === -6 || i === 0;
    (pane ? paneGeos : wallGeos).push(tag(g, i, p, pane ? undefined : accent ? [0xFFFFFF, .9, 0, 5] : [0xEEE6DA, .9, 0, 6]));
    wallEdges.push(tag(new THREE.EdgesGeometry(g), i, p));
    const along = (a, wA, h, y, wB, off = 0) => { // box centred on the wall line (or offset inward), in unit-height space
      const inX = hor ? 0 : -Math.sign(x1) * off, inZ = hor ? -Math.sign(z1) * off : 0;
      return box(hor ? wA : wB, h, hor ? wB : wA).translate((hor ? a : cx) + inX, y, (hor ? cz : a) + inZ);
    };
    const BLKF = [0x1C1D21, .45, .6, 4];
    if (!pane) wallGeos.push(tag(along(hor ? cx : cz, len, .036, 0, T + .024), i, p, [0xF3EFE8, .45, 0, 0])); // skirting
    else {
      const a1 = hor ? x1 : z1, a2 = hor ? x2 : z2, L = Math.abs(a2 - a1), mid = (a1 + a2) / 2;
      for (const f of [0, .33, .66, 1]) wallGeos.push(tag(along(a1 + (a2 - a1) * f, f % 1 ? .045 : .07, 1, 0, .08), i, p, BLKF)); // posts and mullions
      for (const y of [0, .975]) wallGeos.push(tag(along(mid, L, .025, y, .08), i, p, BLKF)); // sill and head
      if (L > 2.5 || !hor) {
        wallGeos.push(tag(along(mid, L + .5, .01, .955, .022, .16), i, p, BLKF)); // curtain rod
        for (const end of [a1, a2]) for (let q = 0; q < 5; q++) { // pleated linen curtain gathered at each end
          const s = Math.sign(mid - end), a = end - s * .12 + s * q * .085, c = new THREE.CylinderGeometry(.05, .05, .95, 8, 1).translate(0, .475, 0).toNonIndexed();
          const o = .14 + (q & 1) * .045, inX = hor ? 0 : -Math.sign(x1) * o, inZ = hor ? -Math.sign(z1) * o : 0;
          wallGeos.push(tag(c.translate((hor ? a : cx) + inX, 0, (hor ? cz : a) + inZ), i, p, [0xE6D9C3, .95, 0, 1]));
        }
      }
    }
    wallMeta.push({ d: clamp(((cx + 6) / 12) * .55 + ((cz + 4.5) / 9) * .45), pane });
  });
  const walls = groupMesh(gW, wallGeos, surfMat(), true, SURF);
  const paneMat = new THREE.MeshStandardMaterial({ color: 0xD6E4F7, roughness: .04, metalness: .85, transparent: true, opacity: .3, depthWrite: false });
  const panes = groupMesh(gW, paneGeos, paneMat, false);
  const wallEdgeMat = edgeMat(0x4D72C4, .75);
  const wallL = groupLines(gW, wallEdges, wallEdgeMat);
  apt.add(walls, panes, wallL);

  // floors per room (fade in under the rising walls): herringbone oak in living and bedroom, checker tile in bath and hall
  const ROOMS = [[-6, 1, -4.5, 4.5, 0], [1, 6, -4.5, .6, 0], [1, 3.8, .6, 4.5, 1], [3.8, 6, .6, 4.5, 1]];
  const floorGeo = mergeGeometries(ROOMS.map(([a, b, c, d, t]) => {
    const g = new THREE.PlaneGeometry(b - a, d - c).rotateX(-Math.PI / 2).translate((a + b) / 2, .004, (c + d) / 2).toNonIndexed();
    g.deleteAttribute('uv'); g.setAttribute('aF', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(t), 1)); return g;
  }));
  const floorMat = new THREE.MeshStandardMaterial({ roughness: .6, transparent: true, opacity: 0 });
  const FU = { tFl: { value: TX.floor }, tTi: { value: TX.tile }, tFH: { value: TX.floorH } };
  texHooks.push((k, t) => { if (k === 'floor') FU.tFl.value = t; if (k === 'tile') FU.tTi.value = t; if (k === 'floorH') FU.tFH.value = t; if (k === 'det1') SU.tD1.value = t; if (k === 'det2') SU.tD2.value = t; });
  floorMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, FU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aF; varying float vF; varying vec2 vXZ;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvF = aF; vXZ = position.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform sampler2D tFl, tTi, tFH; varying float vF; varying vec2 vXZ; float fh;\n${PN}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec2 uP = vXZ / 2.3, uT = vXZ / 2.4; diffuseColor.rgb *= mix(texture(tFl, uP).rgb, texture(tTi, uT).rgb, vF); fh = mix(texture(tFH, uP).r, texture(tFH, uT).g, vF);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(.42 + .35 * (1. - fh), .22, vF);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = pnArb(-vViewPosition, normal, vec2(dFdx(fh), dFdy(fh)) * .8, faceDirection);');
  };
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
  // soft glow of the drawing: the same lines offset a few cm, additive (shares the geometry and its draw range)
  const planGlowMat = new THREE.LineBasicMaterial({ color: 0x7FB2FF, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const planGlow = [[.03, 0], [-.03, 0], [0, .03], [0, -.03]].map(([x, z]) => { const l = new THREE.LineSegments(planGeo, planGlowMat); l.position.set(x, .028, z); apt.add(l); return l; });
  const planVerts = plan.length / 3;

  // ---------- 2. furniture: base (kitchen, bedroom, bath, hall), living set A (oak, oatmeal, mustard/terracotta/blue, sage wall), set B (walnut, emerald velvet, brass, terracotta wall) ----------
  const S_ = (h, r, m, k) => [h, r, m, k];
  const PNT = h => S_(h, .38, 0, 0), FAB = h => S_(h, .95, 0, 1), VEL = h => S_(h, .72, 0, 1), WD = h => S_(h, .48, 0, 2), MRB = h => S_(h, .12, 0, 3), MET = (h, r = .3) => S_(h, r, 1, 4), LF = h => S_(h, .55, 0, 9), CER = h => S_(h, .16, 0, 0);
  const OAK = WD(0xC4915A), WAL = WD(0x6B4027), BRASS = MET(0xE0B567, .26), BLK = S_(0x18191C, .45, .6, 4), CHR = MET(0xE8EBF0, .1), MIR = MET(0xF4F6F8, .03), MARW = MRB(0xF1EDE6), MARK = MRB(0x2E2E31), WHT = FAB(0xF5F2EC), GLOW = 0xFFD9A0;
  const OAT = 0xE6D8C2, MUST = 0xD99A2B, TERR = 0xC2552F, BLUE = 0x2F5BB8, EMER = 0x1B6A50, GOLD = 0xC9963E;
  function furnGroup(name, items, rugTex) {
    const g = makeGroup(name, items.length), geos = [], glow = [], outl = [], rugs = [];
    items.forEach((it, i) => {
      const pv = V(it.x, 0, it.z);
      const put = (geo, col, x, y, z, ry = 0, rx = 0, isGlow = false, rz = 0) => {
        if (rz) geo.rotateZ(rz); if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry);
        geo.translate(x, y, z); geo.rotateY(it.ry || 0); geo.translate(it.x, 0, it.z);
        if (isGlow) glow.push(tag(geo, i, pv, col)); else { geos.push(tag(geo, i, pv, col)); if (it.hl) outl.push(tag(new THREE.EdgesGeometry(geo, 25), i, pv)); }
      };
      it.make({ B: (w, h, d, x, y, z, col, ry, b = .03) => put(rbox(w, h, d, b), col, x, y, z, ry), K: (w, h, d, x, y, z, col, ry) => put(box(w, h, d), col, x, y, z, ry),
        Cy: (rt, rb, h, x, y, z, col, s = 16) => put(cyl(rt, rb, h, s), col, x, y, z),
        Sp: (r, x, y, z, col, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0) => put(new THREE.SphereGeometry(r, 8, 5).toNonIndexed().scale(sx, sy, sz), col, x, y, z, ry, rx),
        X: (geo, col, x, y, z, ry, rx, rz) => put(geo, col, x, y, z, ry, rx, false, rz),
        G: (r, x, y, z) => put(new THREE.SphereGeometry(r, 12, 8).toNonIndexed(), GLOW, x, y, z, 0, 0, true),
        GC: (rt, rb, h, x, y, z) => put(cyl(rt, rb, h, 20), GLOW, x, y, z, 0, 0, true), GK: (w, h, d, x, y, z) => put(box(w, h, d), GLOW, x, y, z, 0, 0, true),
        R: (w, d) => { const geo = box(w, .012, d); geo.rotateY(it.ry || 0); geo.translate(it.x, 0, it.z); rugs.push(tag(geo, i, pv, undefined, true)); } });
    });
    const body = groupMesh(g, geos, surfMat(), true, SURF);
    const gl = glow.length ? groupMesh(g, glow, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }), false) : null;
    const ol = outl.length ? groupLines(g, outl, edgeMat(0xFFB45A, 0)) : null;
    const rug = rugs.length ? groupMesh(g, rugs, new THREE.MeshStandardMaterial({ map: TX[rugTex], roughness: .96 }), false) : null;
    if (rug) texHooks.push((k, t) => { if (k === rugTex) { rug.material.map.dispose(); rug.material.map = t; } });
    [body, gl, ol, rug].forEach(o => o && apt.add(o));
    return { g, items, body, gl, ol, rug };
  }
  const chair = (o, x, z, ry, seat, frame, legs = frame) => {
    const c = Math.cos(ry), s = Math.sin(ry), at = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
    for (const [dx, dz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) { const [px, pz] = at(dx, dz); o.Cy(.017, .013, .42, px, 0, pz, legs, 6); }
    o.B(.46, .05, .46, x, .4, z, frame, ry, .015); o.B(.42, .07, .42, x, .44, z, seat, ry, .03);
    const [bx, bz] = at(0, -.21); o.B(.44, .4, .06, bx, .48, bz, seat, ry, .028);
  };
  const blade = (h, w) => new THREE.CylinderGeometry(.002, w, h, 4, 1).translate(0, h / 2, 0).toNonIndexed().scale(1, 1, .25);
  const soil = S_(0x2A1E16, 1, 0, 1);
  const snake = (o, x, z, pot, leaf, hh = 1) => { o.Cy(.17, .13, .36, x, 0, z, pot, 14); o.Cy(.15, .15, .02, x, .34, z, soil, 12);
    for (let k = 0; k < 11; k++) { const a = k * 2.4, r = .03 + (k % 3) * .03; o.X(blade(hh * (.55 + .35 * ((k * 7) % 5) / 4), .045), leaf, x + Math.cos(a) * r, .34, z + Math.sin(a) * r, a, .1 + (k % 3) * .07); } };
  const fiddle = (o, x, z, pot, leaf, hh = 1.5, n = 18, ls = 1) => { o.Cy(.2, .16, .42, x, 0, z, pot, 16); o.Cy(.15, .15, .02, x, .4, z, soil, 12); o.Cy(.018, .024, hh, x, .4, z, WD(0x5A3E2A), 6);
    for (let k = 0; k < n; k++) { const a = k * 2.4, y = .7 + (k / n) * (hh - .2), r = .1 + .09 * Math.abs(Math.sin(k * 1.7)); o.Sp(.14 * ls, x + Math.cos(a) * r, y, z + Math.sin(a) * r, leaf, 1, .12, .6, -a, .45 - (k % 4) * .22); } };
  const flowers = (o, x, y, z, vase, cols) => { o.Cy(.055, .045, .2, x, y, z, vase, 14); cols.forEach((c, k) => { const a = k * 2.1; o.Cy(.004, .004, .22, x + Math.cos(a) * .03, y + .18, z + Math.sin(a) * .03, LF(0x47703B), 4); o.Sp(.045, x + Math.cos(a) * .05, y + .42, z + Math.sin(a) * .05, FAB(c)); }); };
  const base = furnGroup('base', [
    { x: .59, z: -2.55, make: o => { // kitchen run: navy lacquer, oak uppers, marble top and splash, brass pulls
      o.K(.56, .08, 3.46, .02, 0, 0, BLK); o.B(.62, .78, 3.5, 0, .08, 0, PNT(0x1D3A7C), 0, .012);
      for (const z of [-.875, 0, .875]) o.K(.006, .7, .012, -.311, .12, z, BLK);
      for (const z of [-1.31, -.44, .44, 1.31]) o.K(.02, .02, .3, -.325, .76, z, BRASS);
      o.K(.66, .04, 3.54, 0, .86, 0, MARW); o.K(.015, .56, 3.5, .29, .9, 0, S_(0xEDE7DC, .2, 0, 8));
      o.K(.42, .012, .5, -.02, .9, .35, CHR); o.Cy(.012, .012, .32, .2, .9, .35, CHR, 8); o.K(.18, .016, .016, .11, 1.21, .35, CHR);
      o.K(.5, .006, .56, -.02, .9, -1.05, S_(0x0E0F11, .08, 0, 0));
      o.B(.34, .72, 1.6, .14, 1.5, -.95, OAK, 0, .012); o.B(.34, .72, 1.0, .14, 1.5, 1.25, OAK, 0, .012);
      o.GK(.03, .01, 1.5, .02, 1.494, -.95); o.GK(.03, .01, .9, .02, 1.494, 1.25);
      o.K(.28, .03, .5, .16, 1.62, .32, OAK); o.Cy(.05, .05, .16, .16, 1.65, .18, CER(MUST), 12); o.Cy(.045, .045, .22, .16, 1.65, .32, CER(BLUE), 12); o.Cy(.06, .05, .12, .16, 1.65, .46, CER(0xF1EDE6), 12); } },
    { x: -1.1, z: -2.6, make: o => { o.B(1.0, .86, 2.2, 0, 0, 0, OAK, 0, .015); o.K(1.08, .05, 2.28, 0, .86, 0, MARW);
      o.Cy(.16, .1, .07, .12, .91, .45, CER(0xF4F1EA), 16); for (const [dx, dz] of [[.08, .42], [.16, .5], [.13, .38]]) o.Sp(.042, dx, 1.0, dz, S_(0xF08A2A, .5, 0, 0));
      for (const z of [-.6, .1]) { o.Cy(.2, .2, .05, -.8, .7, z, S_(0x8A4A2A, .6, 0, 1)); o.Cy(.02, .02, .7, -.8, 0, z, BRASS, 8); o.Cy(.16, .17, .015, -.8, 0, z, BLK); }
      for (const z of [-.55, .55]) { o.Cy(.004, .004, .85, 0, 1.95, z, BLK, 6); o.Cy(.04, .13, .16, 0, 1.8, z, BRASS); o.GC(.12, .12, .01, 0, 1.795, z); } } },
    { x: 4.5, z: -.55, make: o => { o.B(1.9, .3, 2.1, 0, .04, 0, OAK, 0, .03); o.B(1.8, .24, 2.0, 0, .32, -.02, WHT, 0, .06); o.B(1.86, .1, 1.45, 0, .52, -.3, FAB(MUST), 0, .05);
      o.B(1.9, .03, .42, 0, .62, -.75, FAB(BLUE), 0, .014); o.B(.62, .14, .36, -.42, .56, .78, WHT, 0, .07); o.B(.62, .14, .36, .42, .56, .78, WHT, 0, .07); o.B(2.0, 1.1, .12, 0, 0, 1.03, VEL(0xB4573A), 0, .05); } },
    { x: 3.25, z: .2, make: o => { o.B(.44, .48, .4, 0, 0, 0, OAK, 0, .02); o.Cy(.05, .08, .2, 0, .48, 0, CER(0x2B4F45)); o.GC(.13, .16, .22, 0, .68, 0); } },
    { x: 5.75, z: .2, make: o => { o.B(.44, .48, .4, 0, 0, 0, OAK, 0, .02); o.Cy(.05, .08, .2, 0, .48, 0, CER(0x2B4F45)); o.GC(.13, .16, .22, 0, .68, 0); } },
    { x: 1.42, z: -3.05, make: o => { o.B(.6, 2.3, 2.5, 0, 0, 0, OAK, 0, .015); o.K(.02, 2.1, .02, .31, .1, 0, BLK); o.K(.02, .5, .02, .32, 1.0, -.1, BRASS); o.K(.02, .5, .02, .32, 1.0, .1, BRASS); } },
    { x: 4.5, z: -.9, make: o => o.K(2.6, .012, 2.4, 0, 0, 0, FAB(0xDCCDB6)) },
    { x: 4.9, z: 4.0, make: o => { o.B(1.8, .55, .72, 0, 0, 0, CER(0xF6F4EF), 0, .08); o.K(1.6, .02, .52, 0, .53, 0, S_(0x8FC1DA, .05, 0, 0)); o.Cy(.015, .015, .3, .8, .5, 0, CHR, 8); } },
    { x: 5.68, z: 1.7, make: o => { o.B(.5, .82, .9, 0, 0, 0, WAL, 0, .015); o.Cy(.17, .14, .1, 0, .82, 0, CER(0xF6F4EF), 20); o.K(.03, .7, .7, .23, 1.1, 0, MIR); o.K(.035, .74, .74, .235, 1.08, 0, BRASS); } },
    { x: 1.4, z: 3.7, make: o => { o.B(.4, .8, 1.2, 0, 0, 0, OAK, 0, .015); o.K(.03, 1.0, .7, -.2, 1.15, 0, MIR); snake(o, .02, -.9, CER(0xF1EDE6), LF(0x4F7A45)); } },
  ]);
  const setA = furnGroup('setA', [
    { x: -3.0, z: 2.4, make: o => o.R(3.2, 2.6) },
    { x: -3.0, z: 1.3, make: o => { const U = FAB(OAT), y = .1;
      for (const [lx, lz] of [[-1.1, -.38], [1.1, -.38], [-1.1, .38], [1.1, .38]]) o.Cy(.026, .018, .1, lx, 0, lz, OAK, 6);
      o.B(2.4, .36, .95, 0, y, 0, U, 0, .05); o.B(2.4, .5, .24, 0, y + .3, -.36, U, 0, .09); o.B(.22, .55, .95, -1.1, y, 0, U, 0, .09); o.B(.22, .55, .95, 1.1, y, 0, U, 0, .09);
      o.B(.98, .14, .66, -.5, y + .34, .08, U, 0, .065); o.B(.98, .14, .66, .5, y + .34, .08, U, 0, .065);
      o.B(.44, .4, .14, -.66, y + .48, -.17, FAB(MUST), .16, .065); o.B(.44, .4, .14, .66, y + .48, -.17, FAB(TERR), -.14, .065); o.B(.36, .3, .12, -.22, y + .47, -.14, VEL(BLUE), -.08, .055); } },
    { x: -3.0, z: 2.6, make: o => { o.Cy(.48, .48, .035, 0, .36, 0, OAK, 32); for (let k = 0; k < 3; k++) { const a = k * 2.094; o.Cy(.02, .016, .36, Math.cos(a) * .3, 0, Math.sin(a) * .3, OAK, 6); }
      o.K(.3, .04, .22, .14, .395, -.08, PNT(TERR)); o.K(.26, .03, .2, .14, .435, -.08, PNT(0xEFE6D2)); flowers(o, -.18, .395, .1, CER(MUST), [0xF2E6CF, TERR, 0xF2E6CF]); } },
    { x: -4.95, z: 2.55, ry: Math.PI / 2, make: o => { const U = VEL(BLUE); for (const [lx, lz] of [[-.32, -.3], [.32, -.3], [-.32, .3], [.32, .3]]) o.Cy(.024, .016, .1, lx, 0, lz, OAK, 6);
      o.B(.8, .32, .78, 0, .1, 0, U, 0, .06); o.B(.8, .5, .18, 0, .34, -.3, U, 0, .08); o.B(.14, .46, .78, -.33, .1, 0, U, 0, .06); o.B(.14, .46, .78, .33, .1, 0, U, 0, .06); o.B(.5, .1, .5, 0, .42, .05, FAB(MUST), 0, .045); } },
    { x: -3.6, z: -2.8, make: o => { o.B(1.8, .05, .9, 0, .7, 0, OAK, 0, .012); for (const [x, z] of [[-.8, -.36], [.8, -.36], [-.8, .36], [.8, .36]]) o.Cy(.028, .022, .7, x, 0, z, OAK, 8);
      chair(o, -.45, -.62, 0, FAB(OAT), OAK); chair(o, .45, -.62, 0, FAB(OAT), OAK); chair(o, -.45, .62, Math.PI, FAB(OAT), OAK); chair(o, .45, .62, Math.PI, FAB(OAT), OAK);
      flowers(o, 0, .75, 0, CER(BLUE), [TERR, MUST, 0xF2E6CF, TERR]); } },
    { x: -3.6, z: -2.8, make: o => { o.Cy(.006, .006, .9, 0, 1.9, 0, BLK, 6); o.Cy(.07, .3, .24, 0, 1.56, 0, PNT(0x1E2024), 24); o.GC(.28, .28, .01, 0, 1.555, 0); o.G(.08, 0, 1.6, 0); } },
    { x: -1.5, z: 1.0, make: o => { o.Cy(.17, .19, .03, 0, 0, 0, BLK); o.Cy(.012, .012, 1.12, 0, 0, 0, BRASS, 6); o.GC(.16, .22, .32, 0, 1.1, 0); } },
    { x: -5.45, z: -3.95, make: o => fiddle(o, 0, 0, S_(0xB5603C, .8, 0, 0), LF(0x3F6E3A)) },
    { x: .45, z: 3.9, make: o => snake(o, 0, 0, CER(0xF1EDE6), LF(0x4F7A45), 1.1) },
    { x: -5.72, z: -3.0, make: o => { for (const z of [-.7, .7]) for (const x of [-.15, .15]) o.Cy(.02, .016, .12, x, 0, z, OAK, 6); o.B(.45, .58, 1.6, 0, .12, 0, OAK, 0, .015);
      [TERR, MUST, BLUE, 0x2B4F45, 0xEFE6D2].forEach((c, k) => o.K(.17, .22 + (k % 2) * .03, .035, 0, .7, -.62 + k * .04, PNT(c)));
      o.Cy(.08, .06, .3, 0, .7, .2, CER(BLUE), 16); o.Sp(.07, 0, .77, .55, BRASS); } },
    { x: -5.88, z: -3.0, make: o => { o.K(.03, .86, 1.16, 0, 1.2, 0, OAK); o.K(.01, .78, 1.08, .018, 1.24, 0, PNT(0xF0E6D2));
      o.K(.01, .36, .42, .024, 1.56, -.22, PNT(TERR)); o.K(.01, .5, .26, .028, 1.3, .26, PNT(MUST)); o.K(.01, .09, .92, .032, 1.36, 0, PNT(BLUE)); } },
  ], 'rugA');
  const setB = furnGroup('setB', [
    { x: -3.1, z: 2.4, make: o => o.R(3.6, 2.9) },
    { x: -3.0, z: 1.3, hl: 1, make: o => { const U = VEL(EMER), y = .08;
      for (const [lx, lz] of [[-1.3, -.38], [1.3, -.38], [1.3, .38], [-1.3, 1.36]]) o.Cy(.02, .016, .08, lx, 0, lz, BRASS, 6);
      o.B(2.8, .34, .95, 0, y, 0, U, 0, .06); o.B(2.8, .46, .26, 0, y + .28, -.35, U, 0, .1); o.B(.95, .34, 1.0, -.92, y, .96, U, 0, .06);
      for (const x of [-.92, .1, .98]) o.B(.9, .12, .64, x, y + .34, .1, VEL(0x237A5E), 0, .055);
      o.B(.42, .36, .13, .98, y + .46, -.16, VEL(GOLD), -.12, .06); o.B(.4, .34, .12, .45, y + .45, -.15, FAB(0xE8B4A0), .1, .06); o.B(.36, .3, .12, -1.1, y + .44, -.15, FAB(0xF2EEE6), .05, .055); } },
    { x: -2.75, z: 2.65, hl: 1, make: o => { o.B(1.2, .05, .62, 0, .32, 0, MARK, 0, .015); o.K(1.0, .32, .025, 0, 0, -.2, BRASS); o.K(1.0, .32, .025, 0, 0, .2, BRASS);
      o.Cy(.12, .07, .07, .32, .37, 0, BRASS, 20); o.K(.28, .04, .2, -.25, .37, .04, PNT(TERR)); o.K(.24, .03, .18, -.25, .41, .04, PNT(GOLD)); } },
    { x: -1.2, z: 2.6, ry: -Math.PI / 2.6, make: o => { o.Cy(.4, .36, .38, 0, 0, 0, FAB(0xEFE6D6), 24); o.B(.8, .46, .2, 0, .3, -.3, FAB(0xEFE6D6), 0, .09); o.Cy(.34, .34, .1, 0, .38, .02, VEL(TERR), 24); } },
    { x: -3.6, z: -2.8, make: o => { o.Cy(.68, .68, .05, 0, .72, 0, WAL, 40); o.Cy(.08, .26, .72, 0, 0, 0, BLK, 20);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; chair(o, Math.sin(a) * .82, Math.cos(a) * .82, a + Math.PI, VEL(0xC0703F), WAL, BRASS); }
      o.Cy(.1, .06, .14, 0, .77, 0, BRASS, 16); o.Sp(.16, 0, .98, 0, LF(0x3F6E3A), 1, .7, 1); } },
    { x: -3.6, z: -2.8, hl: 1, make: o => { o.Cy(.006, .006, .8, 0, 2.0, 0, BLK, 6); o.Cy(.55, .55, .04, 0, 1.96, 0, BRASS, 40); o.GC(.5, .5, .02, 0, 1.94, 0); } },
    { x: -5.55, z: .25, make: o => { o.Cy(.2, .2, .03, 0, 0, 0, BLK); o.Cy(.015, .015, 1.5, 0, 0, 0, BRASS, 6); o.Cy(.05, .2, .16, 0, 1.5, 0, BRASS, 24); o.GC(.19, .19, .01, 0, 1.495, 0); o.G(.06, 0, 1.52, 0); } },
    { x: -5.72, z: 3.1, make: o => { o.B(.42, .72, 1.9, 0, 0, 0, WAL, 0, .015); for (const z of [-.47, .47]) o.K(.02, .2, .02, .22, .4, z, BRASS);
      o.Cy(.12, .1, .3, 0, .72, -.5, CER(0xF2EEE6), 16); o.Sp(.12, 0, 1.12, -.5, LF(0x4E7A5E), 1, 1.3, 1); o.B(.2, .26, .3, 0, .72, .5, BRASS, 0, .02);
      [EMER, GOLD, TERR, 0x1E2024].forEach((c, k) => o.K(.24, .035, .3, 0, .72 + k * .035, .05, PNT(c))); } },
    { x: -5.88, z: 3.1, make: o => { o.K(.03, 1.0, 1.3, 0, 1.15, 0, BLK); o.K(.01, .92, 1.22, .018, 1.19, 0, PNT(0x163C33));
      o.X(box(.01, .42, .42), PNT(GOLD), .026, 1.44, 0, 0, Math.PI / 4); o.X(box(.01, .2, .2), PNT(TERR), .03, 1.56, 0, 0, Math.PI / 4); } },
    { x: -5.45, z: -3.95, make: o => fiddle(o, 0, 0, BLK, LF(0x2F5E3A), 1.7, 24, 1.25) },
  ], 'rugB');
  const glowMats = [base, setA, setB].map(s => s.gl && s.gl.material);

  // ---------- 3. tower (other floors) ----------
  const G0 = -5 * 3.2 - .3; // ground level
  const KS = [-5, -4, -3, -2, -1, 0, 1, 2];
  const gT = makeGroup('tower', KS.length);
  const tGeos = [], tEdges = [], tWin = [];
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const LIT = [0xFFB45A, 0xFFC877, 0xFF9E45, 0xFFD69A, 0xFFE0B0, 0xFF8A5C, 0xFFB45A, 0xFFF0D2];
  function windowsOn(list, i, pv, x0, z0, w, d, y0, floors, col = 2.6, litP = .5, WR = .62) {
    const quad = (cx, cy, cz, ux, uz, ww, hh) => {
      const a = [], hw = ww / 2, hh2 = hh / 2;
      const P = (s, t) => [cx + ux * s * hw, cy + t * hh2, cz + uz * s * hw];
      a.push(...P(-1, -1), ...P(1, -1), ...P(1, 1), ...P(-1, -1), ...P(1, 1), ...P(-1, 1));
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
      list.push(tag(g, i, pv, rnd() < litP ? LIT[(rnd() * LIT.length) | 0] : 0x1A3370));
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
    const SL = [0xDCD6CB, .85, 0, 6], FA = [0xECE5D8, .7, 0, 7];
    const slab = box(12.6, .3, 9.6).translate(0, -.3, 0); tGeos.push(tag(slab, i, pv, SL)); tEdges.push(tag(new THREE.EdgesGeometry(slab), i, pv));
    if (k !== 0) {
      const b = box(12.2, 2.9, 9.2); tGeos.push(tag(b, i, pv, FA)); tEdges.push(tag(new THREE.EdgesGeometry(b), i, pv));
      windowsOn(tWin, i, pv, 0, 0, 12.2, 9.2, -.1, 1, 2.4, .62, .9);
    }
    if (k === 2) { const r = box(12.6, .3, 9.6).translate(0, 2.9, 0); tGeos.push(tag(r, i, pv, SL)); tEdges.push(tag(new THREE.EdgesGeometry(r), i, pv)); const pp = box(3, 1.2, 2.4).translate(2, 3.2, -1); tGeos.push(tag(pp, i, pv, SL)); tEdges.push(tag(new THREE.EdgesGeometry(pp), i, pv)); }
  });
  const tower = groupMesh(gT, tGeos, surfMat(), true, SURF);
  const towerL = groupLines(gT, tEdges, edgeMat(0xFFFFFF, .7));
  // windows: reflective glass by day (sky environment), lit from inside at night in several warm tones
  const U = { uDay: { value: C(0x9AABC6) }, uNight: { value: 0 } };
  const winExtra = { key: 'w', uniforms: sh => { sh.uniforms.uDay = U.uDay; sh.uniforms.uNight = U.uNight; },
    frag: f => f.replace('#include <common>', '#include <common>\nuniform vec3 uDay; uniform float uNight; vec3 litC; float isLit;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nlitC = diffuseColor.rgb; isLit = step(.2, litC.r) * uNight; diffuseColor.rgb = mix(uDay, vec3(.03, .04, .07), uNight);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += litC * isLit * 1.25 + vec3(.008, .016, .05) * uNight * (1. - isLit);') };
  const winMat = () => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .06, metalness: .85 }); m.userData.win = 1; return m; };
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
  const rnd2 = (() => { let s = 11; return () => (s = (s * 48271) % 2147483647) / 2147483647; })();
  const FAC = [0xE8DFCF, 0xD9C6A6, 0xF1EEE8, 0xB9714F, 0xC9CFD8, 0x5A606B, 0xE3D3B8, 0xA8846A], GRN = [0x2F5A36, 0x3E6B3A, 0x4E7A3E, 0x2B4F45, 0x587F3C];
  const roadD = v => Math.abs(v - 9 - 18 * Math.round((v - 9) / 18));
  const tree = (i, pv, x, z, r) => { const c = GRN[(rnd2() * GRN.length) | 0];
    cGeos.push(tag(cyl(.12, .17, 1.5, 5).translate(x, G0, z), i, pv, [0x4A3426, .9, 0, 2]));
    cGeos.push(tag(new THREE.IcosahedronGeometry(r, 0).scale(1, 1.25, 1).translate(x, G0 + 1.3 + r, z), i, pv, [c, .8, 0, 9])); };
  blds.forEach((b, i) => {
    const pv = V(b.x, G0, b.z), fc = b.house ? [0xF2EDE4, .75, 0, 6] : [FAC[(rnd2() * FAC.length) | 0], .72, 0, 7];
    const add = g => { cGeos.push(tag(g, i, pv, fc)); cEdges.push(tag(new THREE.EdgesGeometry(g), i, pv)); };
    if (b.house) { for (const z of [14.2, 17.4, 20.6]) tree(i, pv, 29.6, z, .95); for (const x of [31, 34.5, 38, 41.5]) tree(i, pv, x, 22.8, .85); }
    else for (let k = 0, put = 0; k < 7 && put < 3; k++) {
      const x = b.x + (rnd2() - .5) * 15, z = b.z + (rnd2() - .5) * 15;
      if ((Math.abs(x - b.x) > b.w / 2 + 1.3 || Math.abs(z - b.z) > b.d / 2 + 1.3) && roadD(x) > 3.8 && roadD(z) > 3.8) { tree(i, pv, x, z, 1.2 + rnd2() * 1.1); put++; }
    }
    if (b.house) { add(box(b.w, 3.4, b.d).translate(b.x, G0, b.z)); add(box(b.w * .62, 3.2, b.d * .9).translate(b.x - b.w * .16, G0 + 3.4, b.z - .2)); add(box(b.w * .7, .25, b.d * 1.05).translate(b.x - b.w * .14, G0 + 6.6, b.z - .2));
      windowsOn(cWin, i, pv, b.x, b.z, b.w, b.d, G0, 1, 2.6, .9); windowsOn(cWin, i, pv, b.x - b.w * .16, b.z - .2, b.w * .62, b.d * .9, G0 + 3.4, 1, 2.4, .9); }
    else { add(box(b.w, b.h, b.d).translate(b.x, G0, b.z)); windowsOn(cWin, i, pv, b.x, b.z, b.w, b.d, G0 + .3, Math.floor(b.h / 3.2), 2.6, .42); }
  });
  const city = groupMesh(gC, cGeos, surfMat(), true, SURF);
  const cityL = groupLines(gC, cEdges, edgeMat(0xFFFFFF, .5));
  const cityWinMat = winMat(); patch(cityWinMat, gC, winExtra);
  const cityW = new THREE.Mesh(mergeGeometries(cWin), cityWinMat); cityW.frustumCulled = false;
  const groundMat = new THREE.MeshStandardMaterial({ color: 0xC9CDBF, roughness: 1, transparent: true, opacity: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520).rotateX(-Math.PI / 2), groundMat); ground.position.y = G0; ground.receiveShadow = true;
  const roads = [];
  for (let k = -5; k <= 5; k++) { const c = k * 18 + 9; roads.push(new THREE.PlaneGeometry(4.5, 220).rotateX(-Math.PI / 2).translate(c, 0, 0), new THREE.PlaneGeometry(220, 4.5).rotateX(-Math.PI / 2).translate(0, 0, c)); }
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8E96A6, roughness: .9, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -1 });
  const road = new THREE.Mesh(mergeGeometries(roads), roadMat); road.position.y = G0 + .02; road.receiveShadow = true;
  // street lights: warm pools along every road, visible as the night falls
  const lp = [];
  for (let k = -5; k <= 5; k++) { const c = k * 18 + 9; for (let t = -104; t <= 104; t += 6.5) { const o = (Math.round(t / 6.5) & 1) ? 2.7 : -2.7;
    for (const [x, z] of [[c + o, t], [t, c + o]]) lp.push(new THREE.PlaneGeometry(3.2, 3.2).rotateX(-Math.PI / 2).translate(x, 0, z)); } }
  const lampMat = new THREE.MeshBasicMaterial({ map: TX.dot, color: 0xFFB866, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const lamps = new THREE.Mesh(mergeGeometries(lp), lampMat); lamps.position.y = G0 + .07; lamps.frustumCulled = false;
  const plotPts = [PLOT.x - PLOT.w / 2, PLOT.z - PLOT.d / 2, PLOT.x + PLOT.w / 2, PLOT.z - PLOT.d / 2, PLOT.x + PLOT.w / 2, PLOT.z + PLOT.d / 2, PLOT.x - PLOT.w / 2, PLOT.z + PLOT.d / 2, PLOT.x - PLOT.w / 2, PLOT.z - PLOT.d / 2];
  const plotGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 5 }, (_, k) => V(plotPts[k * 2], 0, plotPts[k * 2 + 1])));
  const plotMat = new THREE.LineDashedMaterial({ color: 0xFFFFFF, dashSize: .9, gapSize: .6, transparent: true, opacity: 0, fog: true });
  const plotL = new THREE.Line(plotGeo, plotMat); plotL.computeLineDistances(); plotL.position.y = G0 + .08;
  world.add(ground, road, lamps, city, cityL, cityW, plotL);
  apt.add(lampA, lampB, lampC);

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
    { p: [-5.4, 1.5, 4.05], t: [-1.0, 1.05, -3], f: 54, fm: 78, m: 1, fog: [60, 200], via: [[-4.8, 6.2, 4.6]], dur: 2.3, drift: { p: [-4.1, 1.55, 4.0], t: [-.2, 1.0, -3.2], d: 8 } },
    { p: [-5.55, 2.55, 4.25], t: [-2.4, .45, -1.2], f: 52, fm: 82, m: 1, fog: [60, 200] },
    { p: [-3.0, 2.05, 4.15], t: [-2.2, .7, -1.4], f: 54, fm: 80, m: 1, fog: [60, 200] },
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
  const tmpA = C(0), tmpB = C(0), accA = C(0x9DAE8C), accB = C(0x9C4A33), sunset = C(0xF0875A), sunsetTop = C(0x3A3F92), sunsetGlow = C(0xFF7A45);
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
    paneMat.opacity = .32 * clamp(P.walls * 3);
    wallEdgeMat.opacity = .75 * (1 - .85 * clamp(P.furn * 1.5));
    floorMat.opacity = clamp(P.walls * 1.6 - .3);
    floorMat.visible = floorMat.opacity > .001;
    planGeo.setDrawRange(0, Math.floor(planVerts * clamp(P.plan) / 2) * 2);
    planMat.opacity = (.95 - .7 * clamp(P.walls * 1.5)) * P.sheet; planL.visible = planMat.opacity > .01;
    planGlowMat.opacity = .32 * (1 - clamp(P.walls * 1.5)) * P.sheet; planGlow.forEach(l => l.visible = planGlowMat.opacity > .01);
    sheetMat.opacity = P.sheet; sheetLineMat.opacity = .55 * P.sheet; sheet.visible = sheetL.visible = P.sheet > .01;
    // furniture
    const pop = (sg, fn) => sg.g.uT.value.forEach((u, i) => { const s = fn(i / Math.max(1, sg.items.length - 1)); u.set(s > .001 ? s : 0, s, 0, 1); });
    pop(base, d => back(loc(P.furn, d, 1.2)));
    pop(setA, d => back(Math.min(loc(P.furn, d, 1.2), 1 - loc(P.swap, d, 1.3))));
    pop(setB, d => back(Math.min(loc(P.furn, d, 1.2), loc(P.swap * 1.1 - .1, d, 1.3))));
    for (const s of [base, setA, setB]) s.body.visible = s.g.uT.value.some(u => u.x > 0);
    setB.ol.material.opacity = .95 * P.outline; setB.ol.visible = P.outline > .01;
    const warm = P.warm;
    glowMats.forEach(m => m && m.color.setRGB(.55 + 1.35 * warm, .5 + 1.1 * warm, .45 + .75 * warm));
    lampA.intensity = 6 * warm; lampB.intensity = 4.5 * warm; lampC.intensity = 3 * warm;
    lampB.position.set(-1.5 + (-5.55 + 1.5) * P.swap, 1.4, 1.0 - .75 * P.swap);
    SU.uAcc.value.copy(accA).lerp(accB, clamp(P.swap));
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
    lampMat.opacity = .9 * clamp(P.city * 2.5) * clamp(P.night * 1.6 - .3); lamps.visible = lampMat.opacity > .01;
    plotMat.opacity = .95 * P.plot * (1 - P.sink); plotL.visible = plotMat.opacity > .01;
    // light & sky: space -> day -> night
    const nt = P.night, dy = P.day;
    const ss = Math.pow(Math.sin(Math.PI * clamp(nt)), 1.3); // sunset peak halfway between day and night
    const sk = i => tmpA.copy(colSpace[i]).lerp(colDay[i], dy).lerp(colNight[i], nt).lerp(i ? sunset : sunsetTop, (i ? .8 : .45) * ss);
    const top = sk(0).getHexString(), bot = sk(1).getHexString();
    scene.fog.color.copy(tmpA);
    sky.setProperty('--sky-top', '#' + top); sky.setProperty('--sky-bot', '#' + bot);
    tmpB.set(0x5C86E0).lerp(C(0xC9D8FF), dy).lerp(C(0x8A4A3C), nt).lerp(sunsetGlow, .8 * ss);
    sky.setProperty('--glow', '#' + tmpB.getHexString());
    groundMat.color.set(0xC9CDBF).lerp(C(0x0E1934), nt); roadMat.color.set(0x8E96A6).lerp(C(0x1A2347), nt);
    const inside = (1 - dy) * clamp(P.walls * 2);
    hemi.intensity = .75 - .58 * nt - .25 * inside; hemi.color.set(0xDCE6FF).lerp(C(0xFFE6C8), .35 * warm * (1 - dy)).lerp(C(0x6F86C8), nt);
    hemi.groundColor.set(0x1A2F66).lerp(C(0x8A6F5E), .7 * warm * (1 - dy));
    sun.intensity = 2.6 - 2.35 * nt + 1.2 * ss - .5 * inside; sun.color.set(0xF4F7FF).lerp(C(0xFF9A5A), .7 * ss).lerp(C(0x9FB4F0), nt * (1 - ss));
    U.uNight.value = nt;
    cityL.material.opacity = towerL.material.opacity = .08 + .22 * nt;
    const phaseEnv = P.city > .02 || dy > .5;
    scene.environment = phaseEnv && envSky ? envSky : envRoom;
    scene.environmentIntensity = phaseEnv ? .9 - .8 * nt + .25 * ss : .55 + .25 * warm;
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
      const xs = c.map(q => clamp(q[0], 14, innerWidth - 14)), ys = c.map(q => clamp(q[1], 74, phone() ? innerHeight * (1 - PANEL) - 14 : innerHeight - 60));
      Object.assign(vf.style, { left: Math.min(...xs) + 'px', top: Math.min(...ys) + 'px', width: (Math.max(...xs) - Math.min(...xs)) + 'px', height: (Math.max(...ys) - Math.min(...ys)) + 'px', right: 'auto', bottom: 'auto' });
    }
    const pOn = P.plot > .5 && P.sink < .2;
    plotEl.classList.toggle('on', pOn);
    if (pOn) { const [x, y] = toScreen(V(PLOT.x, G0 + .1, PLOT.z + PLOT.d / 2 + 3.5)); plotEl.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`; }
  }

  // ---------- frame loop: runs only while something moves ----------
  let running = false, shadowDirty = true;
  const stats = { maxCalls: 0, maxTris: 0, perSlide: {}, texMs: Math.round(tT1 - tT0), envMs: Math.round(tT2 - tT1), boot: Math.round(performance.now()) };
  window.__show = { stats, P, dbg: { camera, renderer, scene, cam }, resume: () => { window.__hold = false; const im = $('#snap'); if (im) im.remove(); kick(); },
    snap: () => { window.__hold = true; const im = $('#snap') || Object.assign(document.createElement('img'), { id: 'snap' }); im.src = canvas.toDataURL(); im.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:' + (canvas.style.height || '100%') + ';pointer-events:none'; canvas.after(im); }, frames: 0, get busy() { return running; }, get cur() { return cur; } };
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    if (phone()) { // draw only the visible scene zone (top 58 %), framed as the centre of that zone
      const zh = h - Math.round(h * PANEL);
      renderer.setSize(w, zh, false); canvas.style.height = zh + 'px';
      camera.setViewOffset(w, h, 0, h * .5 - zh / 2, w, zh);
    } else { canvas.style.height = ''; renderer.setSize(w, h, false); camera.setViewOffset(w, h, -w * .2, 0, w, h); }
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
    const tR0 = performance.now(); renderer.render(scene, camera); if (!window.__show.frames) { stats.r0 = Math.round(tR0); stats.r1 = Math.round(performance.now()); }
    const ri = renderer.info.render;
    stats.maxCalls = Math.max(stats.maxCalls, ri.calls); stats.maxTris = Math.max(stats.maxTris, ri.triangles);
    const ps = stats.perSlide[cur + 1] || (stats.perSlide[cur + 1] = { calls: 0, tris: 0 }); ps.calls = Math.max(ps.calls, ri.calls); ps.tris = Math.max(ps.tris, ri.triangles);
    overlays(); window.__show.frames++;
    if (moving) requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }
  window.__kick = kick;

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
