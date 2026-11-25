/* 멍냥공방 피규어 빚기 — figure-spec.json 을 읽어 '녹여 붙인' 한 몸을 브라우저에서 바로 만든다.
   거리장(SDF) + 매끈한 합집합 + 마칭 큐브. figure/sculpt.py(출력 STL)와 같은 규칙을 같은 순서로 계산한다
   (figure-spec.json 의 _설명 ①~⑧). 숫자는 모두 틀 파일에서 읽는다.
   쓰는 곳: index.html 의 initThree() → MnSculpt.three(...)   시험: node 로 불러 파이썬과 값 대조 */
(function (root) {
"use strict";
const BIG = 1e6;

/* ── 틀 읽기 ①②③ ── */
function resolveParts(spec, feat) {
  const f = {};
  for (const [k, d] of Object.entries(spec.features || {})) f[k] = d.default;
  for (const [k, v] of Object.entries(feat)) if (k !== "colors") f[k] = v;
  const ok = w => Object.entries(w || {}).every(([k, v]) => f[k] === v);
  const out = [];
  for (const p of spec.parts) {
    if (!ok(p.when)) continue;
    const q = { ...p, center: [...p.center] };
    if (p.radii) q.radii = [...p.radii];
    for (const a of spec.adjust || []) {
      if (!ok(a.when) || !a.parts.includes(p.name)) continue;
      if (a.zoom !== undefined) { // about 을 중심으로 부품을 통째로 zoom 배(4판)
        const z = a.zoom, o = a.about;
        q.center = q.center.map((c, i) => o[i] + (c - o[i]) * z);
        if (q.shape === "tube") q.pts = q.pts.map(pt => pt.map(v => v * z));
        else if (q.radii) q.radii = q.radii.map(r => r * z);
        if (q.round !== undefined) q.round = q.round * z;
      }
      const s = a.scale || [1, 1, 1], m = a.move || [0, 0, 0];
      if (q.radii) q.radii = q.radii.map((r, i) => r * s[i]);
      q.center = q.center.map((c, i) => c + m[i]);
    }
    out.push(q);
  }
  return out;
}

/* ── 모양 ④ ── */
function rotm(rot) { // R = Rz·Ry·Rx (고정축 x→y→z), 행 우선 9칸
  const r = (rot || [0, 0, 0]).map(v => v * Math.PI / 180);
  const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
  return [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
          sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
          -sy, cy * sx, cy * cx];
}
const partK = (p, spec) => (p.k === undefined ? spec.sculpt.k : p.k);
const opOf = p => p.op || "add";

function partBox(p) { // 부품을 감싸는 상자(세계 좌표)
  const R = rotm(p.rot), c = p.center, shape = p.shape || "ell";
  const lo = [0, 0, 0], hi = [0, 0, 0];
  if (shape === "tube") {
    const st = p.radii || [1, 1, 1], l0 = [BIG, BIG, BIG], l1 = [-BIG, -BIG, -BIG];
    for (const q of p.pts) for (let a = 0; a < 3; a++) {
      l0[a] = Math.min(l0[a], (q[a] - q[3]) * st[a]); l1[a] = Math.max(l1[a], (q[a] + q[3]) * st[a]);
    }
    for (let i = 0; i < 3; i++) {
      let e = 0, m = c[i];
      for (let j = 0; j < 3; j++) { e += Math.abs(R[i * 3 + j]) * (l1[j] - l0[j]) / 2; m += R[i * 3 + j] * (l0[j] + l1[j]) / 2; }
      lo[i] = m - e; hi[i] = m + e;
    }
    return { lo, hi };
  }
  const r = p.radii;
  for (let i = 0; i < 3; i++) {
    let e = 0;
    if (shape === "ell") { for (let j = 0; j < 3; j++) e += (R[i * 3 + j] * r[j]) ** 2; e = Math.sqrt(e); }
    else for (let j = 0; j < 3; j++) e += Math.abs(R[i * 3 + j]) * r[j];
    lo[i] = c[i] - e; hi[i] = c[i] + e;
  }
  return { lo, hi };
}

function makeSdf(p) { // 부품 하나의 거리 함수(안이 음수). 세계 좌표 (x,y,z) → d
  const R = rotm(p.rot), cx = p.center[0], cy = p.center[1], cz = p.center[2], shape = p.shape || "ell";
  const R00 = R[0], R01 = R[1], R02 = R[2], R10 = R[3], R11 = R[4], R12 = R[5], R20 = R[6], R21 = R[7], R22 = R[8];
  if (shape === "ell") {
    const rx = p.radii[0], ry = p.radii[1], rz = p.radii[2], rmin = Math.min(rx, ry, rz);
    const ix = 1 / rx, iy = 1 / ry, iz = 1 / rz, jx = ix * ix, jy = iy * iy, jz = iz * iz;
    return (x, y, z) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const qx = R00 * dx + R10 * dy + R20 * dz, qy = R01 * dx + R11 * dy + R21 * dz, qz = R02 * dx + R12 * dy + R22 * dz;
      const ax = qx * ix, ay = qy * iy, az = qz * iz, bx = qx * jx, by = qy * jy, bz = qz * jz;
      const k0 = Math.sqrt(ax * ax + ay * ay + az * az), k1 = Math.sqrt(bx * bx + by * by + bz * bz);
      return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -rmin;
    };
  }
  if (shape === "puck") {
    const rr = p.radii[0], hh = p.radii[2], ro = p.round || 0;
    return (x, y, z) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const qx = R00 * dx + R10 * dy + R20 * dz, qy = R01 * dx + R11 * dy + R21 * dz, qz = R02 * dx + R12 * dy + R22 * dz;
      const a = Math.sqrt(qx * qx + qy * qy) - rr + ro, b = Math.abs(qz) - hh + ro;
      const pa = a > 0 ? a : 0, pb = b > 0 ? b : 0;
      return Math.min(Math.max(a, b), 0) + Math.sqrt(pa * pa + pb * pb) - ro;
    };
  }
  if (shape === "box") {
    const hx = p.radii[0], hy = p.radii[1], hz = p.radii[2], ro = p.round || 0;
    return (x, y, z) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const qx = R00 * dx + R10 * dy + R20 * dz, qy = R01 * dx + R11 * dy + R21 * dz, qz = R02 * dx + R12 * dy + R22 * dz;
      const a = Math.abs(qx) - hx + ro, b = Math.abs(qy) - hy + ro, e = Math.abs(qz) - hz + ro;
      const pa = a > 0 ? a : 0, pb = b > 0 ? b : 0, pe = e > 0 ? e : 0;
      return Math.min(Math.max(a, b, e), 0) + Math.sqrt(pa * pa + pb * pb + pe * pe) - ro;
    };
  }
  if (shape === "tube") {
    const flat = p.flat === "y", st = p.radii || null, smin_ = st ? Math.min(st[0], st[1], st[2]) : 1;
    const sx = st ? 1 / st[0] : 1, sy = st ? 1 / st[1] : 1, sz = st ? 1 / st[2] : 1;
    const seg = [];
    for (let i = 0; i + 1 < p.pts.length; i++) {
      const a = p.pts[i], b = p.pts[i + 1], ay = flat ? 0 : a[1], by = flat ? 0 : b[1];
      const ux = b[0] - a[0], uy = by - ay, uz = b[2] - a[2];
      seg.push([a[0], ay, a[2], ux, uy, uz, 1 / (ux * ux + uy * uy + uz * uz), a[3], b[3] - a[3]]);
    }
    const ns = seg.length;
    return (x, y, z) => {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const qx = (R00 * dx + R10 * dy + R20 * dz) * sx, qy = flat ? 0 : (R01 * dx + R11 * dy + R21 * dz) * sy, qz = (R02 * dx + R12 * dy + R22 * dz) * sz;
      let d = BIG;
      for (let i = 0; i < ns; i++) {
        const s = seg[i], px = qx - s[0], py = qy - s[1], pz = qz - s[2];
        let t = (px * s[3] + py * s[4] + pz * s[5]) * s[6]; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - t * s[3], ey = py - t * s[4], ez = pz - t * s[5];
        const di = Math.sqrt(ex * ex + ey * ey + ez * ez) - (s[7] + t * s[8]);
        if (di < d) d = di;
      }
      return d * smin_;
    };
  }
  throw new Error("모르는 모양: " + shape);
}

function makeLocalY(p) {
  const R = rotm(p.rot), c = p.center;
  return (x, y, z) => R[1] * (x - c[0]) + R[4] * (y - c[1]) + R[7] * (z - c[2]);
}

function smin(a, b, k) { // ⑤ 매끈한 합집합
  if (k <= 0) return a < b ? a : b;
  let h = k - Math.abs(a - b); if (h < 0) h = 0; h /= k;
  return (a < b ? a : b) - h * h * k * 0.25;
}

/* ── 격자 ⑥⑦ ── */
function makeGrid(parts, spec, cell) {
  const h = cell, m = spec.sculpt.margin, lo = [BIG, BIG, BIG], hi = [-BIG, -BIG, -BIG];
  for (const p of parts) {
    if (opOf(p) !== "add") continue;
    const b = partBox(p);
    for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.lo[a] - m); hi[a] = Math.max(hi[a], b.hi[a] + m); }
  }
  lo[2] = -h;
  const i0 = [0, 0, 0], n = [0, 0, 0];
  for (let a = 0; a < 3; a++) { i0[a] = Math.floor(lo[a] / h - 0.5) - 1; n[a] = Math.ceil(hi[a] / h - 0.5) + 1 - i0[a] + 1; }
  const g = { h, i0, n, N: n[0] * n[1] * n[2], sx: n[1] * n[2], sy: n[2], origin: i0.map(i => (i + 0.5) * h) };
  g.block = (lo, hi, pad) => {
    const s = [];
    for (let a = 0; a < 3; a++) {
      const i = Math.max(Math.ceil((lo[a] - pad) / h - 0.5) - i0[a], 0);
      const j = Math.floor((hi[a] + pad) / h - 0.5) - i0[a];
      s.push(i, Math.max(Math.min(j + 1, n[a]), i));
    }
    return s; // [x0,x1,y0,y1,z0,z1)
  };
  return g;
}

function eachPoint(g, s, fn) { // fn(격자 번호, x, y, z)
  const h = g.h, ox = g.origin[0], oy = g.origin[1], oz = g.origin[2];
  for (let i = s[0]; i < s[1]; i++) {
    const x = ox + i * h;
    for (let j = s[2]; j < s[3]; j++) {
      const y = oy + j * h; let idx = (i * g.n[1] + j) * g.n[2] + s[4];
      for (let k = s[4]; k < s[5]; k++, idx++) fn(idx, x, y, oz + k * h);
    }
  }
}

function field(parts, spec, g) { // ⑤⑥ 한 몸의 거리장 F (+ 이음매용 D)
  const ck = spec.sculpt.cull[0], cp = spec.sculpt.cull[1], stand = spec.sculpt.stand, rest = spec.sculpt.rest;
  const F = new Float32Array(g.N).fill(BIG), B = new Float32Array(g.N).fill(BIG), D = new Float32Array(g.N).fill(BIG);
  for (const p of parts) {
    const op = opOf(p);
    if (op === "paint") continue;
    const k = partK(p, spec), sdf = makeSdf(p), bx = partBox(p);
    if (stand.roles.includes(p.role)) {
      eachPoint(g, g.block(bx.lo, bx.hi, ck * k + cp), (i, x, y, z) => { B[i] = smin(B[i], sdf(x, y, z), k); });
      continue;
    }
    if (op === "engrave") { bx.lo[1] = -BIG; bx.hi[1] = BIG; }
    const s = g.block(bx.lo, bx.hi, ck * k + cp);
    if (op === "add") {
      const isRest = p.role === rest;
      eachPoint(g, s, (i, x, y, z) => { const d = sdf(x, y, z); F[i] = smin(F[i], d, k); if (isRest && d < D[i]) D[i] = d; });
    } else if (op === "cut") {
      eachPoint(g, s, (i, x, y, z) => { F[i] = -smin(-F[i], sdf(x, y, z), k); });
    } else if (op === "engrave") {
      const ly = makeLocalY(p), depth = p.depth, soft = p.soft, reach = p.reach;
      eachPoint(g, s, (i, x, y, z) => {
        let u = -sdf(x, y, z) / soft; if (u <= 0) return; if (u > 1) u = 1;
        if (ly(x, y, z) < reach) F[i] += depth * u * u * (3 - 2 * u);
      });
    } else throw new Error("모르는 op: " + op);
  }
  const ks = stand.k, nz = g.n[2], oz = g.origin[2], h = g.h;
  for (let i = 0; i < g.N; i++) {
    let v = smin(F[i], B[i], ks);
    const z = oz + (i % nz) * h;
    if (-z > v) v = -z;
    F[i] = v === 0 ? 1e-6 : v;
  }
  return { F, D };
}

function regions(parts, spec, g, D, groups) { // ⑧ 묶음마다 색 자리 [{name, R(Float32Array|null), s}]
  const sc = spec.sculpt, cp = sc.cull[1], pad = sc.pad, seam = sc.seam, out = [];
  for (const [name, roles] of groups) {
    if (roles.includes(sc.rest)) { out.push({ name, R: null }); continue; }
    const mine = parts.filter(p => roles.includes(p.role) && (opOf(p) === "add" || opOf(p) === "paint"));
    if (!mine.length) continue;
    const lo = [BIG, BIG, BIG], hi = [-BIG, -BIG, -BIG]; let kmax = 0;
    for (const p of mine) {
      const b = partBox(p); kmax = Math.max(kmax, partK(p, spec));
      for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.lo[a]); hi[a] = Math.max(hi[a], b.hi[a]); }
    }
    const s = g.block(lo, hi, cp + kmax * 0.25 + pad + 2 * g.h);
    const R = new Float32Array(g.N).fill(BIG);
    for (const p of mine) {
      const sdf = makeSdf(p), b = partBox(p), ps = g.block(b.lo, b.hi, cp + kmax * 0.25 + pad + 2 * g.h);
      const isSeam = Object.prototype.hasOwnProperty.call(seam, p.role), bias = isSeam ? seam[p.role] : 0;
      const off = opOf(p) === "add" ? partK(p, spec) * 0.25 + pad : 0;
      eachPoint(g, ps, (i, x, y, z) => {
        const d = isSeam ? sdf(x, y, z) - D[i] - bias : sdf(x, y, z) - off;
        if (d < R[i]) R[i] = d === 0 ? 1e-6 : d;
      });
    }
    out.push({ name, R, s });
  }
  return out;
}
const roleGroups = spec => spec.sculpt.priority.map(r => [r, [r]]);
const slotGroups = (spec, mode) => spec.sculpt.slots[mode].map(g => [g.name, g.roles]);

/* ── 마칭 큐브 (표는 규칙으로 만든다) ── */
const CORNERS = []; for (let i = 0; i < 8; i++) CORNERS.push([i & 1, (i >> 1) & 1, (i >> 2) & 1]);
const EDGES = []; for (let a = 0; a < 8; a++) for (let ax = 0; ax < 3; ax++) if (!((a >> ax) & 1)) EDGES.push([a, a | (1 << ax), ax]);
function makeTable() {
  const eid = {}; EDGES.forEach((e, i) => { eid[e[0] + "," + e[1]] = i; });
  const faces = [];
  for (let ax = 0; ax < 3; ax++) {
    const uv = [0, 1, 2].filter(a => a !== ax);
    for (let side = 0; side < 2; side++) faces.push([[0, 0], [1, 0], [1, 1], [0, 1]].map(d => (side << ax) | (d[0] << uv[0]) | (d[1] << uv[1])));
  }
  const mid = EDGES.map(e => CORNERS[e[0]].map((v, i) => (v + CORNERS[e[1]][i]) / 2));
  const sameFace = (e1, e2) => {
    const c = [EDGES[e1][0], EDGES[e1][1], EDGES[e2][0], EDGES[e2][1]];
    for (let ax = 0; ax < 3; ax++) for (let side = 0; side < 2; side++) if (c.every(x => ((x >> ax) & 1) === side)) return true;
    return false;
  };
  const triangulate = loop0 => { // 큐브 면 위에 눕는 대각선은 쓰지 않는다
    const n = loop0.length;
    for (let s = 0; s < n; s++) {
      const loop = loop0.slice(s).concat(loop0.slice(0, s));
      const rec = (i, j) => {
        if (j - i < 2) return [];
        for (let m = i + 1; m < j; m++) {
          if ((m - i > 1 && sameFace(loop[i], loop[m])) || (j - m > 1 && sameFace(loop[m], loop[j]))) continue;
          const a = rec(i, m), b = rec(m, j);
          if (a && b) return a.concat([[loop[i], loop[m], loop[j]]], b);
        }
        return null;
      };
      const t = rec(0, n - 1);
      if (t) return t;
    }
    throw new Error("세모로 못 나눔");
  };
  const table = [];
  for (let mask = 0; mask < 256; mask++) {
    const link = {};
    const conn = (a, b) => { (link[a] = link[a] || []).push(b); (link[b] = link[b] || []).push(a); };
    for (const cyc of faces) {
      const ins = cyc.map(c => (mask >> c) & 1);
      const fe = [0, 1, 2, 3].map(i => eid[Math.min(cyc[i], cyc[(i + 1) % 4]) + "," + Math.max(cyc[i], cyc[(i + 1) % 4])]);
      const cr = [0, 1, 2, 3].filter(i => ins[i] !== ins[(i + 1) % 4]);
      if (cr.length === 2) conn(fe[cr[0]], fe[cr[1]]);
      else if (cr.length === 4) for (let i = 0; i < 4; i++) if (ins[i]) conn(fe[(i + 3) % 4], fe[i]);
    }
    const tris = [], seen = new Set();
    for (const e0 of Object.keys(link).map(Number).sort((a, b) => a - b)) {
      if (seen.has(e0)) continue;
      let loop = [e0], prev = -1, cur = e0;
      for (;;) {
        const nx = link[cur][0] !== prev ? link[cur][0] : link[cur][1];
        if (nx === e0) break;
        loop.push(nx); prev = cur; cur = nx;
      }
      loop.forEach(e => seen.add(e));
      const nrm = [0, 0, 0];
      for (let i = 0; i < loop.length; i++) {
        const a = mid[loop[i]], b = mid[loop[(i + 1) % loop.length]];
        nrm[0] += a[1] * b[2] - a[2] * b[1]; nrm[1] += a[2] * b[0] - a[0] * b[2]; nrm[2] += a[0] * b[1] - a[1] * b[0];
      }
      let s = 0;
      for (const e of loop) {
        const a = EDGES[e][0], b = EDGES[e][1], inA = (mask >> a) & 1;
        const pin = CORNERS[inA ? a : b], pout = CORNERS[inA ? b : a];
        s += nrm[0] * (pout[0] - pin[0]) + nrm[1] * (pout[1] - pin[1]) + nrm[2] * (pout[2] - pin[2]);
      }
      if (s < 0) loop = loop.slice().reverse();
      for (const t of triangulate(loop)) tris.push(t[0], t[1], t[2]);
    }
    table.push(Int8Array.from(tris));
  }
  return table;
}
const TABLE = makeTable();

/* 한덩어리 표면. 꼭짓점마다 자리·법선(F 기울기)·구석 그늘·색 자리 값을 같이 낸다 */
function surface(g, F, regs, tmin) {
  const n = g.n, nx = n[0], ny = n[1], nz = n[2], N = g.N, sx = g.sx, sy = g.sy, h = g.h, o = g.origin;
  const coff = CORNERS.map(c => c[0] * sx + c[1] * sy + c[2]);
  const stride = [sx, sy, 1];
  const cache = new Int32Array(3 * N).fill(-1);
  let cap = 1 << 16, nv = 0, ni = 0, icap = 1 << 18;
  let pos = new Float32Array(cap * 3), nor = new Float32Array(cap * 3), idx = new Uint32Array(icap);
  let vA = new Int32Array(cap), vT = new Float32Array(cap), vAx = new Int8Array(cap);
  const grow = () => {
    cap *= 2;
    const p2 = new Float32Array(cap * 3); p2.set(pos); pos = p2;
    const n2 = new Float32Array(cap * 3); n2.set(nor); nor = n2;
    const a2 = new Int32Array(cap); a2.set(vA); vA = a2;
    const t2 = new Float32Array(cap); t2.set(vT); vT = t2;
    const x2 = new Int8Array(cap); x2.set(vAx); vAx = x2;
  };
  const gx = i => F[i + sx] - F[i - sx], gy = i => F[i + sy] - F[i - sy], gz = i => F[i + 1] - F[i - 1];
  const vert = (a, ax) => { // 격자점 a 에서 축 ax 쪽 모서리 위 꼭짓점
    const key = ax * N + a; let v = cache[key];
    if (v >= 0) return v;
    if (nv === cap) grow();
    const b = a + stride[ax], v0 = F[a], v1 = F[b];
    let t = v0 / (v0 - v1); t = t < tmin ? tmin : t > 1 - tmin ? 1 - tmin : t;
    const k = a % nz, j = ((a - k) / nz) % ny, i = (a - k - j * nz) / sx;
    v = nv++;
    pos[v * 3] = o[0] + (i + (ax === 0 ? t : 0)) * h; pos[v * 3 + 1] = o[1] + (j + (ax === 1 ? t : 0)) * h; pos[v * 3 + 2] = o[2] + (k + (ax === 2 ? t : 0)) * h;
    let ux = gx(a) + t * (gx(b) - gx(a)), uy = gy(a) + t * (gy(b) - gy(a)), uz = gz(a) + t * (gz(b) - gz(a));
    const l = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    nor[v * 3] = ux / l; nor[v * 3 + 1] = uy / l; nor[v * 3 + 2] = uz / l;
    vA[v] = a; vT[v] = t; vAx[v] = ax;
    cache[key] = v; return v;
  };
  for (let i = 1; i < nx - 2; i++) for (let j = 1; j < ny - 2; j++) {
    let a = (i * ny + j) * nz + 1;
    for (let k = 1; k < nz - 2; k++, a++) {
      let mask = 0;
      if (F[a] < 0) mask |= 1; if (F[a + coff[1]] < 0) mask |= 2; if (F[a + coff[2]] < 0) mask |= 4; if (F[a + coff[3]] < 0) mask |= 8;
      if (F[a + coff[4]] < 0) mask |= 16; if (F[a + coff[5]] < 0) mask |= 32; if (F[a + coff[6]] < 0) mask |= 64; if (F[a + coff[7]] < 0) mask |= 128;
      if (mask === 0 || mask === 255) continue;
      const t = TABLE[mask];
      if (ni + t.length > icap) { icap *= 2; const i2 = new Uint32Array(icap); i2.set(idx); idx = i2; }
      for (let q = 0; q < t.length; q++) { const e = EDGES[t[q]]; idx[ni++] = vert(a + coff[e[0]], e[2]); }
    }
  }
  /* 구석 그늘(AO): 법선 쪽으로 조금씩 나가 F 를 읽는다 — 가까이에 다른 살이 있으면 어둡다 */
  const tri = (x, y, z) => {
    let fx = (x - o[0]) / h, fy = (y - o[1]) / h, fz = (z - o[2]) / h;
    fx = fx < 0 ? 0 : fx > nx - 1.001 ? nx - 1.001 : fx; fy = fy < 0 ? 0 : fy > ny - 1.001 ? ny - 1.001 : fy; fz = fz < 0 ? 0 : fz > nz - 1.001 ? nz - 1.001 : fz;
    const i = fx | 0, j = fy | 0, k = fz | 0, u = fx - i, v = fy - j, w = fz - k, a = (i * ny + j) * nz + k;
    const c00 = F[a] + u * (F[a + sx] - F[a]), c10 = F[a + sy] + u * (F[a + sx + sy] - F[a + sy]);
    const c01 = F[a + 1] + u * (F[a + sx + 1] - F[a + 1]), c11 = F[a + sy + 1] + u * (F[a + sx + sy + 1] - F[a + sy + 1]);
    const c0 = c00 + v * (c10 - c00), c1 = c01 + v * (c11 - c01);
    return c0 + w * (c1 - c0);
  };
  const AO = [[1.2, 0.35], [3.0, 0.3], [6.0, 0.2], [11.0, 0.15]];
  const ao = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ux = nor[v * 3], uy = nor[v * 3 + 1], uz = nor[v * 3 + 2];
    let occ = 0;
    for (const [d, w] of AO) { let c = (d - tri(x + ux * d, y + uy * d, z + uz * d)) / d; c = c < 0 ? 0 : c > 1 ? 1 : c; occ += w * c; }
    ao[v] = 1 - occ;
  }
  /* 색 자리 값: 묶음마다 꼭짓점에서의 R (음수면 그 색). 화면에서 화소마다 부호를 봐서 칠한다 */
  const reg = [];
  for (const r of regs) {
    if (!r.R) continue;
    const a = new Float32Array(nv), R = r.R;
    for (let v = 0; v < nv; v++) {
      const p0 = R[vA[v]], p1 = R[vA[v] + stride[vAx[v]]];
      const r = (p0 > 1e5 || p1 > 1e5) ? 4 : p0 + vT[v] * (p1 - p0);
      a[v] = r < -4 ? -4 : r > 4 ? 4 : r; // 경계 가까이만 뜻이 있다(멀리는 ±4 로 눌러 화면에서 번지지 않게)
    }
    reg.push({ name: r.name, values: a });
  }
  return { positions: pos.subarray(0, nv * 3), normals: nor.subarray(0, nv * 3), indices: idx.subarray(0, ni), ao, regions: reg };
}

/* 고른 특징 → 한덩어리 표면 + 색 자리. mode: "point"(포인트 색 4칸) | "role"(역할별 전체 색) */
function build(spec, feat, opt) {
  opt = opt || {};
  const t0 = (typeof performance !== "undefined" ? performance : Date).now();
  const cell = opt.cell || spec.sculpt.cell_mm.web;
  const parts = resolveParts(spec, feat);
  const g = makeGrid(parts, spec, cell);
  const fd = field(parts, spec, g);
  const groups = opt.mode === "role" ? roleGroups(spec) : slotGroups(spec, opt.mode || "point");
  const regs = regions(parts, spec, g, fd.D, groups);
  const out = surface(g, fd.F, regs, spec.sculpt.tmin);
  out.grid = g; out.F = fd.F; out.groups = groups.map(x => x[0]);
  out.rest = groups.find(x => x[1].includes(spec.sculpt.rest))[0];
  out.ms = (typeof performance !== "undefined" ? performance : Date).now() - t0;
  return out;
}

/* three.js(r128) 그물로. colors={묶음 이름:'#hex'} — 색은 화소마다 색 자리 값의 부호로 정해 경계가 매끈하다
   3판: opt.real = '실물 모습'(가로 층 결 + 무광). 결은 틀의 높이(z, mm)를 opt.layer(mm) 간격으로 나눠 그린다 —
   실제 층 0.12mm 는 화면에서 안 보여 보기 좋게 과장한 값(기본 0.6mm)을 쓴다. mesh.userData.setReal(true|false) 로 바로 바꾼다 */
function three(THREE, built, colors, opt) {
  opt = opt || {};
  const uReal = { value: opt.real ? 1 : 0 }, uLayer = { value: opt.layer || 0.6 };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(built.positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(built.normals, 3));
  geo.setAttribute("ao", new THREE.BufferAttribute(built.ao, 1));
  geo.setIndex(new THREE.BufferAttribute(built.indices, 1));
  const nv = built.ao.length, rA = new Float32Array(nv * 4).fill(4), rB = new Float32Array(nv * 4).fill(4);
  const cols = [];
  for (let i = 0; i < 8; i++) cols.push(new THREE.Color(0xffffff));
  built.regions.slice(0, 8).forEach((r, i) => {
    const dst = i < 4 ? rA : rB, o = i % 4;
    for (let v = 0; v < nv; v++) dst[v * 4 + o] = r.values[v];
    cols[i].set(colors[r.name]);
  });
  geo.setAttribute("rA", new THREE.BufferAttribute(rA, 4));
  geo.setAttribute("rB", new THREE.BufferAttribute(rB, 4));
  const mat = new THREE.MeshPhysicalMaterial({ color: colors[built.rest], roughness: 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.45 });
  const setReal = v => { uReal.value = v ? 1 : 0; mat.roughness = v ? 0.92 : 0.62; mat.clearcoat = v ? 0 : 0.25; }; // 실물 = 무광(윤 없음)
  setReal(!!opt.real);
  mat.onBeforeCompile = sh => {
    sh.uniforms.uCol = { value: cols }; sh.uniforms.uReal = uReal; sh.uniforms.uLayer = uLayer;
    sh.vertexShader = "attribute vec4 rA;\nattribute vec4 rB;\nattribute float ao;\nvarying vec4 vRA;\nvarying vec4 vRB;\nvarying float vAo;\nvarying float vZ;\nvarying vec3 vUpV;\n"
      + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vRA = rA; vRB = rB; vAo = ao; vZ = position.z; vUpV = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));");
    const paint = [7, 6, 5, 4, 3, 2, 1, 0].map(i => `mnc = mnPaint(mnc, uCol[${i}], ${i < 4 ? "vRA" : "vRB"}.${"xyzw"[i % 4]});`).join("\n ");
    sh.fragmentShader = "varying vec4 vRA;\nvarying vec4 vRB;\nvarying float vAo;\nvarying float vZ;\nvarying vec3 vUpV;\nuniform vec3 uCol[8];\nuniform float uReal;\nuniform float uLayer;\n"
      + "vec3 mnPaint(vec3 c, vec3 k, float r){ float w = max(fwidth(r), 1e-5); return mix(c, k, 1.0 - smoothstep(-w, w, r)); }\n"
      + sh.fragmentShader.replace("vec4 diffuseColor = vec4( diffuse, opacity );",
        "vec3 mnc = diffuse;\n " + paint
        // 층 결: 한 층 안의 자리 mnT(0~1). 층이 화소보다 촘촘해지면(mnK→0) 얼룩지지 않게 흐린다
        + "\n float mnT = fract(vZ / uLayer);\n float mnK = uReal * (1.0 - smoothstep(0.30, 0.70, fwidth(vZ / uLayer)));"
        + "\n float mnSeam = smoothstep(0.28, 0.50, abs(mnT - 0.5));"
        + "\n vec4 diffuseColor = vec4( mnc * (0.35 + 0.65 * vAo) * (1.0 - 0.16 * mnK * mnSeam), opacity );")
        // 층마다 둥근 띠처럼 빛을 받게 겉면 방향을 위아래로 살짝 기울인다
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n normal = normalize(normal + mnK * 0.42 * (mnT - 0.5) * 2.0 * normalize(vUpV));");
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.cols = cols; mesh.userData.setReal = setReal; mesh.userData.uReal = uReal; mesh.userData.uLayer = uLayer;
  return mesh;
}

const api = { resolveParts, partBox, makeSdf, makeGrid, field, regions, roleGroups, slotGroups, makeTable, TABLE, EDGES, surface, build, three, smin };
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.MnSculpt = api;
})(typeof window !== "undefined" ? window : globalThis);
