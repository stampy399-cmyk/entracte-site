// Procedural canvas textures for the show: drawn once at load, no external files.
// det1 RGB = fabric weave / wood grain / marble veins; det2 RGB = plaster / facade panels / tile (all linear, mean ~.5)
// floor (sRGB) + floorH (linear R parquet height, G tile height); rugA, rugB, paper (sRGB); dot (radial glow)
const hash = (a, b, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noiseGrid(gx, gy, seed) { const a = new Float32Array(gx * gy); for (let i = 0; i < a.length; i++) a[i] = hash(i, seed, 7); return { gx, gy, a }; }
// tileable bilinear value noise; u,v in [0,1)
function vn(g, u, v) {
  const x = u * g.gx, y = v * g.gy, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % g.gx) + g.gx) % g.gx, y0 = ((yi % g.gy) + g.gy) % g.gy, x1 = (x0 + 1) % g.gx, y1 = (y0 + 1) % g.gy, A = g.a;
  const a = A[y0 * g.gx + x0], b = A[y0 * g.gx + x1], c = A[y1 * g.gx + x0], d = A[y1 * g.gx + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbmMaker(gx, gy, oct, seed) {
  const gs = Array.from({ length: oct }, (_, k) => noiseGrid(gx << k, gy << k, seed + k));
  return (u, v) => { let s = 0, w = .5, n = 0; for (const g of gs) { s += vn(g, u, v) * w; n += w; w *= .5; } return s / n; };
}
const cnv = (w, h) => { if (typeof document === 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgb = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

function gen(S, light) {
  const S2 = 512, D = 512;
  const fill = (w, h, fn) => { const c = cnv(w, h), x = c.getContext('2d'), im = x.createImageData(w, h), d = im.data;
    for (let j = 0, p = 0; j < h; j++) for (let i = 0; i < w; i++, p += 4) { const r = fn(i, j); d[p] = r[0]; d[p + 1] = r[1]; d[p + 2] = r[2]; d[p + 3] = 255; }
    x.putImageData(im, 0, 0); return c; };
  const out = [0, 0, 0];
  if (light) return lightTex(S, fill, out);

  // ---- det1: fabric / wood / marble
  const fF = fbmMaker(8, 8, 3, 11), fW = fbmMaker(2, 16, 3, 21), fWl = fbmMaker(2, 4, 2, 23), fM = fbmMaker(4, 4, 4, 31);
  const det1 = fill(D, D, (i, j) => {
    const u = i / D, v = j / D;
    const p = 6, ti = Math.floor(i / p), tj = Math.floor(j / p), fx = (i % p) / p, fy = (j % p) / p;
    const over = (ti + tj) & 1, thread = over ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy);
    out[0] = 255 * Math.min(1, .28 + .42 * thread + .45 * (fF(u, v) - .5) + .12 * hash(i, j, 3));
    const rings = .5 + .5 * Math.sin(2 * Math.PI * (v * 18 + 2.2 * fWl(u, v)));
    out[1] = 255 * Math.min(1, .3 + .3 * Math.pow(rings, 3) + .5 * fW(u, v) * .8 + .06 * hash(i, j, 5));
    const vein = Math.abs(Math.sin(2 * Math.PI * (u + v) * 2 + 7 * fM(u, v)));
    out[2] = 255 * (.68 - .45 * (1 - sm(0, .1, vein)) - .12 * (1 - sm(0, .45, vein)) + .08 * (fM(v, u) - .5));
    return out;
  });
  // ---- det2: plaster / facade panels / tile
  const fP = fbmMaker(8, 8, 4, 41), fQ = fbmMaker(16, 16, 2, 43);
  const det2 = fill(D, D, (i, j) => {
    const u = i / D, v = j / D;
    out[0] = 255 * (.5 + .22 * (fP(u, v) - .5) + .16 * (fQ(u, v) - .5) + .05 * (hash(i, j, 9) - .5));
    const pw = D / 4, ph = D / 8, pi = Math.floor(i / pw), pj = Math.floor(j / ph), jx = Math.min(i % pw, pw - 1 - i % pw), jy = Math.min(j % ph, ph - 1 - j % ph);
    const joint = Math.min(jx, jy) < 2 ? .5 : 1;
    out[1] = 255 * Math.min(1, joint * (.5 + .14 * (hash(pi, pj, 13) - .5) + .18 * (fP(u, v) - .5)));
    const tw = D / 8, gi = Math.floor(i / tw), gj = Math.floor(j / tw), gx = Math.min(i % tw, tw - 1 - i % tw), gy = Math.min(j % tw, tw - 1 - j % tw);
    out[2] = 255 * (Math.min(gx, gy) < 2 ? .15 : .55 + .1 * (hash(gi, gj, 17) - .5) + .08 * (fQ(u, v) - .5));
    return out;
  });

  // ---- floor: herringbone oak (k=3 tiles of the 6:1 lattice per texture) | checker tile; height in floorH
  const n = 6, k = 3, W = S / (k * n * Math.SQRT2), oaks = [0xC29462, 0xB3875A, 0xCDA373, 0xB98D5F, 0xA77B52, 0xC79C6B].map(rgb);
  const fGr = fbmMaker(4, 4, 2, 51);
  const hgt = new Uint8ClampedArray(S * S);
  const floorC = fill(S, S, (X, Y) => {
    const uu = X / W, vv = Y / W, x = (uu - vv) / Math.SQRT1_2 / 2, y = (uu + vv) / Math.SQRT1_2 / 2;
    const m = Math.floor(y), r = ((x - m) % (2 * n) + 2 * n) % (2 * n);
    let a, c, id;
    if (r < n) { a = r; c = y - m; id = hash(((m % (k * n)) + k * n) % (k * n), ((Math.floor((x - m) / (2 * n)) % k) + k) % k, 1); }
    else { const q = Math.floor(x - n), rr = ((y - q - 1 + n) % (2 * n) + 2 * n) % (2 * n); a = rr; c = x - q - n - Math.floor(x - q - n); id = hash(((q % (k * n)) + k * n) % (k * n), ((Math.floor((y - q - 1 + n) / (2 * n)) % k) + k) % k, 2); }
    const edge = Math.min(c, 1 - c) * W, end = Math.min(a, n - a) * W, gap = Math.min(edge, end);
    const base = oaks[(id * oaks.length) | 0], grain = .5 + .5 * Math.sin(2 * Math.PI * (c * 4.5 + .3 * Math.sin(a * 1.1 + id * 30) + id * 9 + .4 * fGr(X / S, Y / S)));
    const f = (gap < .9 ? .45 : 1) * (.86 + .12 * grain + .05 * hash(X, Y, 4)) * (.94 + .12 * id);
    hgt[Y * S + X] = gap < .9 ? 40 : 200 + 30 * grain;
    out[0] = base[0] * f; out[1] = base[1] * f; out[2] = base[2] * f; return out;
  });
  const fT = fbmMaker(4, 4, 2, 61), tileA = rgb(0xEFE8DA), tileB = rgb(0x2C5A4C), Tn = 8, Tw = S2 / Tn;
  const tileC = fill(S2, S2, (X, Y) => {
    const ti = Math.floor(X / Tw), tj = Math.floor(Y / Tw), gx = Math.min(X % Tw, Tw - 1 - X % Tw), gy = Math.min(Y % Tw, Tw - 1 - Y % Tw);
    const b = (ti + tj) & 1 ? tileB : tileA, vein = Math.abs(Math.sin(6.283 * (X + Y) / S2 * 2 + 6 * fT(X / S2, Y / S2)));
    const f = (Math.min(gx, gy) < 1.5 ? .7 : 1) * (.93 + .07 * sm(0, .2, vein)) * (.97 + .06 * hash(ti, tj, 8));
    out[0] = b[0] * f; out[1] = b[1] * f; out[2] = b[2] * f; return out;
  });
  const Tw2 = S / Tn, floorH = fill(S, S, (X, Y) => { const g = Math.min(X % Tw2, Tw2 - 1 - X % Tw2, Y % Tw2, Tw2 - 1 - Y % Tw2); out[0] = hgt[Y * S + X]; out[1] = g < 1.5 ? 60 : 210; out[2] = 128; return out; });

  // ---- rugs (top face uv 0..1)
  const fiber = (c, amt = .18) => { const x = c.getContext('2d'), w = c.width, h = c.height, im = x.getImageData(0, 0, w, h), d = im.data;
    for (let j = 0, p = 0; j < h; j++) for (let i = 0; i < w; i++, p += 4) { const f = 1 - amt / 2 + amt * hash(i >> 1, j, 21) * (.7 + .3 * hash(i, j >> 1, 22)); d[p] *= f; d[p + 1] *= f; d[p + 2] *= f; }
    x.putImageData(im, 0, 0); return c; };
  const R = S2, rugA = cnv(R, R), A = rugA.getContext('2d');
  { const s = R / 100; A.fillStyle = '#C45E37'; A.fillRect(0, 0, R, R);
    A.fillStyle = '#F0E4CC'; A.fillRect(4 * s, 4 * s, 92 * s, 92 * s); A.fillStyle = '#2F5BB8'; A.fillRect(6 * s, 6 * s, 88 * s, 88 * s); A.fillStyle = '#C45E37'; A.fillRect(8 * s, 8 * s, 84 * s, 84 * s);
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) {
      const cx = (24 + q * 26) * s, cy = (18 + r * 16) * s, dia = (cx2, cy2, w, h, col) => { A.fillStyle = col; A.beginPath(); A.moveTo(cx2, cy2 - h); A.lineTo(cx2 + w, cy2); A.lineTo(cx2, cy2 + h); A.lineTo(cx2 - w, cy2); A.closePath(); A.fill(); };
      dia(cx, cy, 10 * s, 7.5 * s, '#F0E4CC'); dia(cx, cy, 7.5 * s, 5.5 * s, (r + q) & 1 ? '#E2A63A' : '#2F5BB8'); dia(cx, cy, 3.5 * s, 2.6 * s, '#5A2A1C');
    }
    A.fillStyle = '#E2A63A'; for (let t = 0; t < 24; t++) A.fillRect((8 + t * 3.6) * s, 5 * s, 1.6 * s, 1 * s), A.fillRect((8 + t * 3.6) * s, 94 * s, 1.6 * s, 1 * s);
    fiber(rugA); }
  const rugB = cnv(R, R), B = rugB.getContext('2d');
  { const s = R / 100; B.fillStyle = '#16213C'; B.fillRect(0, 0, R, R); B.fillStyle = '#1E6A54'; B.fillRect(10 * s, 10 * s, 80 * s, 80 * s);
    B.strokeStyle = '#D2A956'; B.lineWidth = .9 * s; B.strokeRect(6 * s, 6 * s, 88 * s, 88 * s); B.strokeRect(10 * s, 10 * s, 80 * s, 80 * s);
    for (const [cx, cy, a0] of [[10, 10, 0], [90, 10, Math.PI / 2], [90, 90, Math.PI], [10, 90, -Math.PI / 2]]) for (let r = 6; r <= 26; r += 5) { B.beginPath(); B.arc(cx * s, cy * s, r * s, a0, a0 + Math.PI / 2); B.stroke(); }
    B.lineWidth = .7 * s; for (let r = 4; r <= 16; r += 4) { B.beginPath(); B.arc(50 * s, 50 * s, r * s, 0, Math.PI * 2); B.stroke(); }
    B.fillStyle = '#D2A956'; B.beginPath(); B.arc(50 * s, 50 * s, 2 * s, 0, Math.PI * 2); B.fill();
    fiber(rugB, .14); }

  return { det1, det2, floor: floorC, tile: tileC, floorH, rugA, rugB };
}

function lightTex(S, fill, out) {
  // ---- blueprint paper 30x21 m; grid on whole metres of the world (sheet x0=-14.4, z0=-10.3)
  const PW = S, PH = Math.round(S * 21 / 30), sw = 256, sh = 180, fPa = fbmMaker(6, 4, 3, 71);
  const small = fill(sw, sh, (i, j) => { const u = i / sw, v = j / sh, f = .93 + .1 * (fPa(u, v) - .5), vg = 1 - .28 * Math.pow(Math.hypot(u - .5, v - .5) * 1.5, 2);
    out[0] = 20 * f * vg; out[1] = 64 * f * vg; out[2] = 150 * f * vg; return out; });
  const paper = cnv(PW, PH); { const x = paper.getContext('2d'); x.imageSmoothingEnabled = true; x.drawImage(small, 0, 0, PW, PH); }
  { const x = paper.getContext('2d'); x.strokeStyle = 'rgba(190,215,255,.05)'; x.lineWidth = 1;
    for (let m = -14; m <= 15; m++) { const px = (m + 14.4) / 30 * PW; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, PH); x.stroke(); }
    for (let m = -10; m <= 10; m++) { const py = (m + 10.3) / 21 * PH; x.beginPath(); x.moveTo(0, py); x.lineTo(PW, py); x.stroke(); } }

  const dot = cnv(64, 64), g = dot.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.18, 'rgba(255,255,255,.75)'); rg.addColorStop(.5, 'rgba(255,255,255,.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);

  return { paper, dot };
}
const SRGB = { floor: 1, tile: 1, rugA: 1, rugB: 1, paper: 1, dot: 1 }, CLAMP = { rugA: 1, rugB: 1, paper: 1, dot: 1 };
// worker side: build the heavy set off the main thread and transfer raw RGBA rows (flipped to texture orientation)
if (typeof document === 'undefined' && typeof self !== 'undefined') self.onmessage = e => {
  const set = gen(e.data.S, false), res = {}, bufs = [];
  for (const k in set) { const c = set[k], im = c.getContext('2d').getImageData(0, 0, c.width, c.height); res[k] = { w: c.width, h: c.height, d: im.data }; bufs.push(im.data.buffer); }
  self.postMessage(res, bufs);
};

// main side: paper and glow dot now (cheap), placeholders for the rest, swapped in via onReady(name, texture) when the worker answers
export function makeTextures(THREE, renderer, mobile, onReady) {
  const S = mobile ? 512 : 1024, aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const setup = (t, k) => { t.anisotropy = aniso; t.colorSpace = SRGB[k] ? THREE.SRGBColorSpace : THREE.NoColorSpace; if (!CLAMP[k]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t; };
  const L = gen(S, true), T = {};
  for (const k in L) T[k] = setup(new THREE.CanvasTexture(L[k]), k);
  const PH = { det1: [128, 128, 160], det2: [128, 128, 140], floor: [196, 150, 100], tile: [200, 196, 186], floorH: [210, 210, 128], rugA: [196, 94, 55], rugB: [30, 106, 84] };
  for (const k in PH) T[k] = setup(new THREE.DataTexture(new Uint8Array([...PH[k], 255]), 1, 1), k);
  const take = res => { for (const k in res) { const r = res[k], rows = new Uint8Array(r.d.length), st = r.w * 4;
    for (let y = 0; y < r.h; y++) rows.set(r.d.subarray((r.h - 1 - y) * st, (r.h - y) * st), y * st); // canvas top row -> v = 1
    onReady(k, setup(new THREE.DataTexture(rows, r.w, r.h), k)); } };
  const local = () => setTimeout(() => { const set = gen(S, false), res = {}; for (const k in set) { const c = set[k]; res[k] = { w: c.width, h: c.height, d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data }; } take(res); }, 30);
  try { const w = new Worker(new URL('./tex.js', import.meta.url), { type: 'module' }); w.onmessage = e => { take(e.data); w.terminate(); }; w.onerror = () => { w.terminate(); local(); }; w.postMessage({ S }); }
  catch (e) { local(); }
  return T;
}
