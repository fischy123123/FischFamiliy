/* ============================================================
   FISCH FAMILY: FOREST CHAOS
   A 3D family game set at the Fisch house in Felton, CA
   Eric · Jessy · Liam · Maddie · Rowan · Faylen
   ============================================================ */
(function () {
'use strict';

// ---------- Basic setup ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.74;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.Fog(0xb5c8b2, 60, 240); // valley haze

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

// Lights — dappled forest afternoon
const hemi = new THREE.HemisphereLight(0xa8c8e8, 0x243620, 0.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2ae, 1.4);
sun.position.set(35, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
sun.shadow.camera.far = 160;
sun.shadow.bias = -0.0005;
scene.add(sun);

// ---------- Helpers ----------
const mats = {};
function mat(color, opts) {
  const key = color + JSON.stringify(opts || {});
  if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts));
  return mats[key];
}
function box(w, h, d, color, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}
function cyl(rt, rb, h, color, x, y, z, parent, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  (parent || scene).add(m);
  return m;
}
function rand(a, b) { return a + Math.random() * (b - a); }
// procedural canvas textures for real-world surface detail
function canvasTex(w, h, draw, rx, ry) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (rx) tex.repeat.set(rx, ry || rx);
  return tex;
}
function speckle(c, w, h, colors, n, minR, maxR) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = colors[i % colors.length];
    c.globalAlpha = rand(0.1, 0.4);
    const r = rand(minR, maxR);
    c.beginPath();
    c.ellipse(rand(0, w), rand(0, h), r, r * rand(0.4, 1), rand(0, 3), 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
}
const groundTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#3f4c29'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#37451f', '#4a5a30', '#56472c', '#2f3d1e', '#5a6b38', '#453620', '#61713e'], 900, 2, 9);
  speckle(c, w, h, ['#2a3618', '#6a7a46'], 250, 0.5, 2);
}, 26, 26);
const duffTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#5d4b32'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#6d5a3c', '#4a3a26', '#7a6644', '#54422b'], 400, 1, 5);
  c.strokeStyle = '#4a3a26'; c.globalAlpha = 0.5;
  for (let i = 0; i < 90; i++) { // fallen needles
    const x = rand(0, w), y = rand(0, h), a = rand(0, 3);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); c.stroke();
  }
  c.globalAlpha = 1;
}, 3, 3);
const barkTex = canvasTex(128, 256, (c, w, h) => {
  c.fillStyle = '#573620'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { // deep vertical furrows of redwood bark
    c.fillStyle = ['#472a16', '#6b4028', '#3c2312', '#7a4c30', '#502f1c'][i % 5];
    c.globalAlpha = rand(0.35, 0.8);
    const x = rand(0, w), wd = rand(2, 7);
    c.fillRect(x, 0, wd, h);
  }
  c.globalAlpha = 0.4; c.strokeStyle = '#3d2312';
  for (let i = 0; i < 40; i++) {
    const x = rand(0, w), y = rand(0, h);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(-4, 4), y + rand(8, 30)); c.stroke();
  }
  c.globalAlpha = 1;
}, 2, 5);
const sidingTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#7a3b2a'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#8a4632', '#6b3222', '#93503a', '#5e2b1d'], 300, 3, 14);
  for (let x = 0; x < w; x += 16) { // board-and-batten
    c.fillStyle = '#5a2b1e'; c.globalAlpha = 0.85; c.fillRect(x, 0, 2.5, h);
    c.fillStyle = '#94523c'; c.globalAlpha = 0.5; c.fillRect(x + 2.5, 0, 1.5, h);
  }
  c.globalAlpha = 1;
}, 3, 1.5);
const shingleTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#52413a'; c.fillRect(0, 0, w, h);
  let row = 0;
  for (let y = 0; y < h; y += 16) {
    for (let x = -16; x < w; x += 22) {
      c.fillStyle = ['#5c4a41', '#493a33', '#63504a', '#544239'][Math.floor(rand(0, 4))];
      c.fillRect(x + (row % 2) * 11, y, 21, 15);
    }
    c.fillStyle = '#332822'; c.fillRect(0, y + 15, w, 2);
    row++;
  }
  speckle(c, w, h, ['#3a2d26', '#6b584f'], 200, 1, 4);
}, 4, 3);
const asphaltTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#43454a'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#54565c', '#38393d', '#5e6066', '#2e2f33', '#6a6c72'], 1400, 0.5, 2.5);
  c.strokeStyle = '#333438'; c.globalAlpha = 0.6;
  for (let i = 0; i < 8; i++) { // hairline cracks
    let x = rand(0, w), y = rand(0, h);
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += rand(-14, 14); y += rand(6, 18); c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 1;
}, 5, 5);
const plankTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#7a4f33'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 20) {
    c.fillStyle = ['#845737', '#6e4429', '#8d5f3e', '#653d24'][Math.floor(rand(0, 4))];
    c.fillRect(x, 0, 19, h);
    c.fillStyle = '#4a2d18'; c.fillRect(x + 19, 0, 1.5, h);
  }
  c.strokeStyle = '#5e3a22'; c.globalAlpha = 0.5;
  for (let i = 0; i < 60; i++) {
    const x = rand(0, w), y = rand(0, h);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + rand(10, 40)); c.stroke();
  }
  c.globalAlpha = 1;
}, 2, 1);
const garageTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#3c2b20'; c.fillRect(0, 0, w, h);
  // carriage-style recessed panels
  for (let px = 0; px < 2; px++) for (let py = 0; py < 3; py++) {
    const x = 14 + px * 122, y = 78 + py * 58;
    c.fillStyle = '#33231a'; c.fillRect(x, y, 106, 46);
    c.strokeStyle = '#553d2c'; c.lineWidth = 3; c.strokeRect(x, y, 106, 46);
  }
  for (let px = 0; px < 4; px++) { // arched windows along the top
    const x = 16 + px * 60;
    c.fillStyle = '#1d2a33';
    c.beginPath();
    c.moveTo(x, 62); c.lineTo(x, 30); c.quadraticCurveTo(x + 26, 8, x + 52, 30); c.lineTo(x + 52, 62); c.closePath();
    c.fill();
    c.strokeStyle = '#5a4534'; c.lineWidth = 3; c.stroke();
  }
  speckle(c, w, h, ['#2e211a', '#4a3628'], 150, 1, 4);
});
const waterTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#3c5862'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    c.fillStyle = ['#5d8290', '#4a6c78', '#729aa8', '#33505a'][i % 4];
    c.globalAlpha = rand(0.12, 0.3);
    c.beginPath();
    c.ellipse(rand(0, w), rand(0, h), rand(6, 26), rand(1, 2.5), 0, 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
}, 24, 3);
function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Colliders
const colliders = []; // {type:'box',minX,maxX,minZ,maxZ} | {type:'circle',x,z,r}
function addBoxCollider(minX, maxX, minZ, maxZ) { colliders.push({ type: 'box', minX, maxX, minZ, maxZ }); }
function addCircleCollider(x, z, r) { colliders.push({ type: 'circle', x, z, r }); }
function collide(pos, radius) {
  for (const c of colliders) {
    if (c.type === 'circle') {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 0.0001) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    } else {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        if (d > 0.0001) { pos.x = cx + dx / d * radius; pos.z = cz + dz / d * radius; }
        else pos.z = c.maxZ + radius;
      }
    }
  }
  const dist = Math.hypot(pos.x, pos.z);
  if (dist > 82) { pos.x *= 82 / dist; pos.z *= 82 / dist; } // world edge
}
function spotIsClear(x, z, r) {
  for (const c of colliders) {
    if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; }
    else if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return false;
  }
  return true;
}
function clearSpot(minR, maxR, r) {
  for (let i = 0; i < 60; i++) {
    const a = rand(0, Math.PI * 2), d = rand(minR, maxR);
    const x = Math.sin(a) * d, z = Math.cos(a) * d - 5;
    if (z < -30) continue;
    if (spotIsClear(x, z, r)) return new THREE.Vector3(x, 0, z);
  }
  return new THREE.Vector3(rand(-20, 20), 0, rand(-2, 6));
}

// ---------- Sky, ground, road, driveway, river ----------
// gradient sky dome (zenith blue -> hazy warm horizon)
(function skyDome() {
  const geo = new THREE.SphereGeometry(280, 20, 14);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const zen = new THREE.Color(0x5b93cc), hor = new THREE.Color(0xe6ecd6);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 280));
    tmp.copy(hor).lerp(zen, Math.pow(t, 0.55));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(dome);
})();
const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshLambertMaterial({ map: groundTex }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// hazy outer valley floor + the Santa Cruz Mountains ringing the San Lorenzo Valley
(function valley() {
  const outer = new THREE.Mesh(new THREE.RingGeometry(118, 235, 40), new THREE.MeshLambertMaterial({ color: 0x54695a }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.05;
  scene.add(outer);
  function ridgeRing(radius, count, hMin, hMax, color) {
    const m = mat(color);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.08, 0.08);
      const h = rand(hMin, hMax);
      // wide, low, overlapping domes read as a continuous forested ridgeline
      const peak = new THREE.Mesh(new THREE.ConeGeometry(rand(1.6, 2.4) * h, h, 7), m);
      peak.position.set(Math.sin(a) * radius, h * 0.28, Math.cos(a) * radius);
      peak.rotation.y = rand(0, 9);
      scene.add(peak);
    }
  }
  ridgeRing(148, 44, 12, 24, 0x415a47); // near forested ridge, mostly behind the treeline
  ridgeRing(200, 32, 24, 44, 0x7793a0); // far ridge dissolving into haze
})();
// needle-duff patches under the trees
const duffMat = new THREE.MeshLambertMaterial({ map: duffTex });
for (let i = 0; i < 26; i++) {
  const p = new THREE.Mesh(new THREE.CircleGeometry(rand(1.5, 5), 10), duffMat);
  p.rotation.x = -Math.PI / 2;
  p.rotation.z = rand(0, 9);
  p.position.set(rand(-80, 80), 0.02, rand(-80, 80));
  p.receiveShadow = true;
  scene.add(p);
}
// River Lane along the front
const asphaltMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
const road = box(140, 0.1, 7, 0x3c3c40, 0, 0.03, 13);
road.material = asphaltMat;
road.castShadow = false;
// driveway from garage to road
const drive = box(15, 0.1, 28, 0x4b4b50, 8, 0.04, -4);
drive.material = asphaltMat;
drive.castShadow = false;
// paver path to the front door
for (let i = 0; i < 7; i++) box(1.1, 0.08, 0.8, 0x9a8f7d, -8 + Math.sin(i * 0.7) * 0.4, 0.06, -16.6 + i * 1.35);
// the San Lorenzo River (real layout: house → River Ln → RV resort → river → Henry Cowell)
const water = new THREE.Mesh(new THREE.PlaneGeometry(180, 10), new THREE.MeshPhongMaterial({
  map: waterTex, transparent: true, opacity: 0.94,
  shininess: 90, specular: 0x9fc3d0,
}));
water.rotation.x = -Math.PI / 2;
water.position.set(0, 0.01, 33);
scene.add(water);
for (const bz of [27.9, 38.1]) { // sandy banks
  const bank = box(180, 0.08, 1.6, 0x8a7a5e, 0, 0.03, bz);
  bank.castShadow = false;
  bank.material = new THREE.MeshLambertMaterial({ map: duffTex, color: 0xc9b896 });
}
for (let i = 0; i < 16; i++) { // river boulders
  const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.3, 0.9), 7, 5), mat(0x6e6d64));
  b.scale.y = 0.6;
  b.position.set(rand(-70, 70), 0.1, rand(28, 39));
  b.rotation.y = rand(0, 9);
  b.castShadow = true;
  scene.add(b);
}
// river is off-limits — except across the Felton Covered Bridge (x 20..23)
addBoxCollider(-95, 18.6, 27.5, 39);
addBoxCollider(24.4, 95, 27.5, 39);

// ---------- Felton Covered Bridge (est. 1892, tallest covered bridge in the US) ----------
(function coveredBridge() {
  const BX = 21.5, Z0 = 26.8, Z1 = 39.2, W = 3.2;
  const plankMat = new THREE.MeshLambertMaterial({ map: plankTex });
  const shingleMat = new THREE.MeshLambertMaterial({ map: shingleTex });
  const g = new THREE.Group(); scene.add(g);
  const len = Z1 - Z0, cz = (Z0 + Z1) / 2;
  // deck
  const deck = box(W, 0.18, len + 1.2, 0x6b4a30, BX, 0.1, cz, g);
  deck.material = plankMat;
  // side walls with open window band (like the real one)
  for (const s of [-1, 1]) {
    const lower = box(0.18, 1.4, len, 0x6b4a30, BX + s * W / 2, 0.8, cz, g);
    lower.material = plankMat;
    const upper = box(0.18, 0.9, len, 0x6b4a30, BX + s * W / 2, 2.85, cz, g);
    upper.material = plankMat;
    for (let i = 0; i < 6; i++) { // window posts
      const post = box(0.16, 1.35, 0.22, 0x4a3220, BX + s * W / 2, 2.15, Z0 + 1 + i * (len - 2) / 5, g);
    }
    addBoxCollider(BX + s * W / 2 - 0.25, BX + s * W / 2 + 0.25, Z0 - 0.5, Z1 + 0.5);
  }
  // gabled shake roof
  for (const s of [-1, 1]) {
    const slab = box(2.35, 0.14, len + 1.6, 0x4e3a2c, 0, 0, 0, g);
    slab.material = shingleMat;
    slab.rotation.z = s * 0.62;
    slab.position.set(BX - s * 0.92, 3.95, cz);
  }
  // portal gable boards front & back
  for (const zz of [Z0 - 0.05, Z1 + 0.05]) {
    const gable = box(W + 0.6, 0.9, 0.14, 0x5a3a24, BX, 3.55, zz, g);
    gable.material = plankMat;
  }
  // plaque
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#f2e6c4'; c.fillRect(0, 0, 256, 64);
  c.strokeStyle = '#4a3220'; c.lineWidth = 4; c.strokeRect(3, 3, 250, 58);
  c.fillStyle = '#3a2718'; c.textAlign = 'center'; c.font = 'bold 20px Georgia';
  c.fillText('FELTON COVERED BRIDGE', 128, 27);
  c.font = '15px Georgia';
  c.fillText('EST. 1892 · SAN LORENZO RIVER', 128, 49);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  plaque.position.set(BX, 3.0, Z0 - 0.14);
  plaque.rotation.y = Math.PI;
  g.add(plaque);
  // dirt path from the lane to the bridge
  const path = box(2.6, 0.06, 11, 0x8a7454, BX, 0.04, 21);
  path.castShadow = false;
  path.material = new THREE.MeshLambertMaterial({ map: duffTex, color: 0xc9ae86 });
})();

// Henry Cowell trailhead sign at the far end of the bridge (the park really is right there)
woodSign(27, 39.9, Math.PI + 0.4, ['HENRY COWELL', 'REDWOODS', 'STATE PARK'], 3.4);
// direction signpost at the bridge path
(function signpost() {
  const g = new THREE.Group(); g.position.set(18.4, 0, 17.6); g.rotation.y = -0.4; scene.add(g);
  cyl(0.07, 0.09, 3.1, 0x5a4534, 0, 1.55, 0, g, 8);
  const entries = [['SANTA CRUZ 7', 1], ['ROARING CAMP 1', -1], ['DOWNTOWN FELTON ½', 1], ['HWY 9', -1]];
  entries.forEach(([label, dir], i) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 40;
    const c = cv.getContext('2d');
    c.fillStyle = '#5a4534'; c.fillRect(0, 0, 256, 40);
    c.fillStyle = '#f2e6c4'; c.font = 'bold 21px Georgia';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText((dir < 0 ? '◄ ' : '') + label + (dir > 0 ? ' ►' : ''), 128, 21);
    const bladeTex = new THREE.CanvasTexture(cv);
    for (const face of [0, Math.PI]) { // readable from both sides
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.24), new THREE.MeshBasicMaterial({ map: bladeTex }));
      blade.position.set(dir * 0.45, 2.75 - i * 0.34, face === 0 ? 0.01 : -0.01);
      blade.rotation.y = dir * 0.12 + face;
      g.add(blade);
    }
  });
  addCircleCollider(18.4, 17.6, 0.35);
})();

// ---------- Santa Cruz Redwoods RV Resort (4980 Hwy 9 — right across the lane) ----------
(function rvResort() {
  const pad = box(27, 0.05, 9.5, 0xb9b4a6, 17, 0.03, 22);
  pad.castShadow = false;
  pad.material = new THREE.MeshLambertMaterial({ map: duffTex, color: 0xcac2b0 });
  const plankMat = new THREE.MeshLambertMaterial({ map: plankTex });
  function rv(x, z, ry, accent) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const body = box(5.2, 2.1, 2.2, 0xf0efe8, 0, 1.45, 0, g);
    const roof = cyl(1.06, 1.06, 5.1, 0xd8d6cc, 0, 2.55, 0, g, 12);
    roof.rotation.z = Math.PI / 2;
    roof.scale.z = 0.32;
    box(5.2, 0.34, 2.24, accent, -0, 1.05, 0, g); // accent stripe
    box(4.9, 0.5, 2.0, 0x2a2a2c, 0, 0.35, 0, g);  // undercarriage so it sits on its wheels
    for (const wx of [-1.6, 0, 1.6]) {
      const win = box(0.9, 0.55, 0.06, 0x2e4a5c, wx, 1.8, 1.12, g);
      win.material = mat(0x2e4a5c, { emissive: 0x16262e });
    }
    box(0.7, 1.5, 0.06, 0x4a3a2c, 2, 1.2, 1.12, g); // door
    for (const wx of [-1.7, 1.7]) {
      const wheel = cyl(0.36, 0.36, 0.24, 0x1a1a1a, wx, 0.36, 1.05, g, 10);
      wheel.rotation.x = Math.PI / 2;
    }
    addCircleCollider(x, z, 3.0);
  }
  rv(8.5, 22.5, 0.12, 0x8a4a32);
  rv(16.5, 21.5, -0.08, 0x3f5a3a);
  rv(24.5, 22.8, 0.2, 0x35507a);
  // picnic table
  (function () {
    const g = new THREE.Group(); g.position.set(12.5, 0, 19.2); g.rotation.y = 0.4; scene.add(g);
    box(1.8, 0.08, 0.8, 0x7a4f33, 0, 0.72, 0, g).material = plankMat;
    for (const s of [-1, 1]) {
      box(1.8, 0.06, 0.3, 0x7a4f33, 0, 0.45, s * 0.62, g).material = plankMat;
      box(0.1, 0.72, 0.9, 0x5e3a22, s * 0.7, 0.36, 0, g);
    }
    addCircleCollider(12.5, 19.2, 1.1);
  })();
  // string lights between two posts
  cyl(0.06, 0.08, 2.6, 0x5a4534, 10, 1.3, 18.2, null, 6);
  cyl(0.06, 0.08, 2.6, 0x5a4534, 20, 1.3, 18.2, null, 6);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xc9a24a }));
    bulb.position.set(10 + t * 10, 2.5 - Math.sin(t * Math.PI) * 0.5, 18.2);
    scene.add(bulb);
  }
})();

// ---------- Roaring Camp steam train, beyond the river in Henry Cowell ----------
(function railway() {
  const TZ = 41.8;
  for (const rz of [TZ - 0.45, TZ + 0.45]) {
    const rail = box(170, 0.09, 0.09, 0x6a6a6e, 0, 0.22, rz);
    rail.castShadow = false;
  }
  const tieGeo = new THREE.BoxGeometry(0.5, 0.1, 1.5);
  const ties = new THREE.InstancedMesh(tieGeo, mat(0x4a3826), 70);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 70; i++) {
    dummy.position.set(-84 + i * 2.42, 0.12, TZ);
    dummy.updateMatrix();
    ties.setMatrixAt(i, dummy.matrix);
  }
  scene.add(ties);
  addBoxCollider(-95, 95, TZ - 1.2, TZ + 1.2); // nobody stands on the tracks
})();
const train = (function () {
  const g = new THREE.Group(); scene.add(g);
  const dark = new THREE.MeshStandardMaterial({ color: 0x20261f, roughness: 0.5, metalness: 0.3 });
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 12), dark);
  boiler.rotation.z = Math.PI / 2;
  boiler.position.set(-0.6, 1.15, 0);
  boiler.castShadow = true;
  g.add(boiler);
  const stack = cyl(0.13, 0.22, 0.6, 0x1a1a18, -1.45, 1.95, 0, g, 8);
  const cab = box(1.15, 1.25, 1.25, 0x7a2c20, 0.85, 1.5, 0, g);
  box(1.25, 0.18, 1.35, 0x1a1a18, 0.85, 2.2, 0, g); // cab roof
  box(3.2, 0.3, 1.2, 0x14140f, -0.2, 0.55, 0, g);   // chassis
  const catcher = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 4), dark);
  catcher.rotation.x = Math.PI / 2;
  catcher.rotation.y = Math.PI / 4;
  catcher.position.set(-2, 0.5, 0);
  g.add(catcher);
  // tender + open excursion car (Roaring Camp style)
  box(1.5, 0.95, 1.15, 0x243024, 2.6, 1.05, 0, g);
  box(1.4, 0.3, 1, 0x4a3220, 2.6, 1.6, 0, g); // wood load
  const car = box(2.7, 0.85, 1.2, 0x6e2f22, 4.9, 1.0, 0, g);
  for (let i = 0; i < 4; i++) box(0.12, 0.5, 1.24, 0x8a5a3a, 3.9 + i * 0.65, 1.65, 0, g); // open-car posts
  box(2.9, 0.12, 1.3, 0x1a1a18, 4.9, 1.95, 0, g); // car canopy
  for (const wx of [-1.5, -0.4, 0.7, 2.2, 3.1, 4.3, 5.5]) {
    const wheel = cyl(0.32, 0.32, 0.18, 0x111111, wx, 0.34, 0.55, g, 10);
    wheel.rotation.x = Math.PI / 2;
    const wheel2 = wheel.clone();
    wheel2.position.z = -0.55;
    g.add(wheel2);
  }
  g.position.set(-999, 0, 41.8);
  return { g, phase: 'wait', t: rand(6, 12), dir: 1, chuffT: 0, puffs: [] };
})();
for (let i = 0; i < 6; i++) {
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xd8dde0, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(puff);
  train.puffs.push({ m: puff, t: 10 });
}
function trainWhistle() {
  tone(587, 0.7, 'triangle', 0.07); tone(740, 0.7, 'triangle', 0.06);
  tone(587, 0.45, 'triangle', 0.06, 0.9); tone(740, 0.45, 'triangle', 0.05, 0.9);
}
function updateTrain(dt) {
  train.t -= dt;
  if (train.phase === 'wait' && train.t <= 0) {
    train.phase = 'run';
    train.t = 26;
    train.dir *= -1;
    train.g.position.x = -train.dir * 100;
    train.g.rotation.y = train.dir > 0 ? 0 : Math.PI;
    trainWhistle();
  } else if (train.phase === 'run') {
    train.g.position.x += train.dir * (200 / 26) * dt;
    train.chuffT -= dt;
    if (train.chuffT <= 0) {
      train.chuffT = 0.4;
      tone(85, 0.09, 'triangle', 0.045);
      const p = train.puffs.find(p2 => p2.t > 2.2);
      if (p) {
        p.t = 0;
        p.m.position.set(train.g.position.x - train.dir * 1.45, 2.4, 41.8);
      }
    }
    if (train.t <= 0 || Math.abs(train.g.position.x) > 105) {
      train.phase = 'wait';
      train.t = rand(24, 45);
      train.g.position.x = -999;
    }
  }
  for (const p of train.puffs) {
    p.t += dt;
    if (p.t < 2.2) {
      p.m.position.y += 1.6 * dt;
      p.m.scale.setScalar(0.7 + p.t * 1.3);
      p.m.material.opacity = 0.4 * (1 - p.t / 2.2);
    } else p.m.material.opacity = 0;
  }
}

// ---------- The Fisch House (brown/red chalet, twin gables, 2-car garage) ----------
const WALL = 0x743828, TRIM = 0x3d251b, ROOFC = 0x4e3a2c, DOORC = 0x33221a;
const sidingMat = new THREE.MeshLambertMaterial({ map: sidingTex });
const shingleMat = new THREE.MeshLambertMaterial({ map: shingleTex });
const plankMat = new THREE.MeshLambertMaterial({ map: plankTex });
const garageMat = new THREE.MeshLambertMaterial({ map: garageTex });
function gableHouse(cx, cz, w, d, wallH, roofH) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  scene.add(g);
  const walls = box(w, wallH, d, WALL, 0, wallH / 2, 0, g);
  walls.material = sidingMat;
  // gable triangles (front & back), gable faces +z
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, roofH); tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false });
  const front = new THREE.Mesh(triGeo, sidingMat);
  front.position.set(0, wallH, d / 2 - 0.3); front.castShadow = true; g.add(front);
  const back = front.clone(); back.position.z = -d / 2; g.add(back);
  // roof slabs
  const slope = Math.atan2(roofH, w / 2);
  const slabLen = Math.hypot(w / 2, roofH) + 0.6;
  const rl = box(slabLen, 0.25, d + 1.2, ROOFC, 0, 0, 0, g);
  rl.material = shingleMat;
  rl.rotation.z = slope;
  rl.position.set(-w / 4, wallH + roofH / 2 + 0.1, 0);
  const rr = box(slabLen, 0.25, d + 1.2, ROOFC, 0, 0, 0, g);
  rr.material = shingleMat;
  rr.rotation.z = -slope;
  rr.position.set(w / 4, wallH + roofH / 2 + 0.1, 0);
  // corner trim
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    box(0.3, wallH, 0.3, TRIM, sx * (w / 2 - 0.1), wallH / 2, sz * (d / 2 - 0.1), g);
  return g;
}
const glassTex = canvasTex(128, 128, (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 30, 128); // reflected sky + trees
  sky.addColorStop(0, '#b8d4e8'); sky.addColorStop(0.55, '#7fa3b8'); sky.addColorStop(1, '#3d5a4a');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.35; c.fillStyle = '#ffffff';
  c.beginPath(); c.moveTo(10, 0); c.lineTo(52, 0); c.lineTo(12, 128); c.lineTo(0, 128); c.closePath(); c.fill(); // glare streak
  c.globalAlpha = 1;
  c.strokeStyle = '#3d251b'; c.lineWidth = 6; // mullions
  c.beginPath(); c.moveTo(64, 0); c.lineTo(64, 128); c.moveTo(0, 64); c.lineTo(128, 64); c.stroke();
});
const glassMat = new THREE.MeshLambertMaterial({ map: glassTex, emissive: 0x223440, emissiveIntensity: 0.25 });
function windowPane(parent, x, y, z, w, h) {
  box(w + 0.24, h + 0.24, 0.12, TRIM, x, y, z, parent);
  const glass = box(w, h, 0.14, 0x243542, x, y, z + 0.02, parent);
  glass.material = glassMat;
  box(w + 0.3, 0.1, 0.2, TRIM, x, y - h / 2 - 0.1, z + 0.03, parent); // sill
}
// Left: main house
const houseL = gableHouse(-8, -23, 12, 9, 5.5, 3);
windowPane(houseL, -3, 3.6, 4.62, 1.6, 1.8);
windowPane(houseL, 3, 3.6, 4.62, 1.6, 1.8);
windowPane(houseL, 0, 6.4, 4.62, 1.4, 1.2); // gable window
// front door + porch + steps
box(1.4, 2.5, 0.15, DOORC, 0, 1.25, 4.58, houseL);
box(0.25, 0.25, 0.25, 0xc9a227, 0.45, 1.25, 4.7, houseL); // doorknob... fancy
// "110" house number plaque by the door
(function houseNumber() {
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48;
  const c = cv.getContext('2d');
  c.fillStyle = '#2c1c12'; c.fillRect(0, 0, 96, 48);
  c.strokeStyle = '#c9a227'; c.lineWidth = 3; c.strokeRect(3, 3, 90, 42);
  c.fillStyle = '#e8d9a0'; c.font = 'bold 30px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('110', 48, 26);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  plaque.position.set(1.3, 2.4, 4.59);
  houseL.add(plaque);
})();
const porch = box(4, 0.3, 2.2, 0x6b4a30, 0, 0.15, 5.6, houseL); // porch
porch.material = plankMat;
const step = box(3, 0.2, 0.9, 0x6b4a30, 0, 0.05, 7.0, houseL); // step
step.material = plankMat;
// metal chimney
cyl(0.25, 0.25, 2.2, 0x8f9499, -3, 9.2, -23 - 1, null, 10);
// Right: garage with two doors
const garage = gableHouse(8, -23, 12, 9, 5, 2.6);
for (const gx of [-2.6, 2.6]) {
  const door = box(3.6, 3.1, 0.2, DOORC, gx, 1.55, 4.6, garage);
  door.material = garageMat;
}
windowPane(garage, -2, 6, 4.62, 1.3, 1.4);
windowPane(garage, 2, 6, 4.62, 1.3, 1.4);
// half-timber diagonals on the garage gable
for (const s of [-1, 1]) {
  const t = box(0.22, 3.4, 0.1, TRIM, s * 3.4, 6.1, 4.66, garage);
  t.rotation.z = s * 0.7;
}
// Middle connector with the deck bridge
box(4, 4, 6.5, WALL, 0, 2, -23).material = sidingMat;
box(4.6, 0.3, 7, 0x6b4a30, 0, 4.15, -23).material = plankMat;
for (let i = -3; i <= 3; i++) { box(0.12, 0.9, 0.12, TRIM, -2.2, 4.75, -23 + i); box(0.12, 0.9, 0.12, TRIM, 2.2, 4.75, -23 + i); }
box(0.1, 0.1, 6.6, TRIM, -2.2, 5.2, -23); box(0.1, 0.1, 6.6, TRIM, 2.2, 5.2, -23);
// house colliders
addBoxCollider(-14, -2, -27.5, -18.3);
addBoxCollider(2, 14, -27.5, -18.3);
addBoxCollider(-2, 2, -26.3, -19.7);

// White Mini in the driveway
(function miniCooper() {
  const g = new THREE.Group(); g.position.set(-17, 0, -12); g.rotation.y = 0.4; scene.add(g);
  box(2, 0.75, 4, 0xf2f2f2, 0, 0.75, 0, g);
  box(1.7, 0.6, 2.2, 0x1a1a1a, 0, 1.4, -0.2, g);
  for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
    const w = cyl(0.35, 0.35, 0.25, 0x111111, x, 0.35, z, g, 12);
    w.rotation.z = Math.PI / 2;
  }
  box(0.5, 0.15, 0.1, 0xfff3b0, -0.6, 0.8, 2.0, g); box(0.5, 0.15, 0.1, 0xfff3b0, 0.6, 0.8, 2.0, g);
  addBoxCollider(-19, -15, -14.5, -9.5);
})();

// Fence (right side, like the photos)
for (let i = 0; i < 9; i++) box(0.15, 1.7, 1.9, 0x7a4f33, 15.5, 0.85, -18 + i * 2).material = plankMat;
addBoxCollider(15.2, 15.8, -19, 0.5);

// Mailbox at the end of the driveway
box(0.12, 1.1, 0.12, 0x4a3a28, 3.5, 0.55, 8.5);
box(0.5, 0.4, 0.7, 0x2e3134, 3.5, 1.3, 8.5);
addCircleCollider(3.5, 8.5, 0.4);

// signs: the RV resort across the lane + the River Ln street blade
function woodSign(x, z, ry, lines, w) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  box(0.2, 2.2, 0.2, 0x5a4534, -w / 2 + 0.3, 1.1, 0, g);
  box(0.2, 2.2, 0.2, 0x5a4534, w / 2 - 0.3, 1.1, 0, g);
  const board = box(w, 1.2, 0.15, 0x3f5a3a, 0, 2.25, 0, g);
  const cv = document.createElement('canvas'); cv.width = 320; cv.height = 110;
  const c = cv.getContext('2d');
  c.fillStyle = '#3a5236'; c.fillRect(0, 0, 320, 110);
  c.strokeStyle = '#f7e9b8'; c.lineWidth = 3; c.strokeRect(6, 6, 308, 98);
  c.fillStyle = '#f7e9b8'; c.textAlign = 'center';
  c.font = 'bold ' + (lines.length > 2 ? 24 : 28) + 'px Georgia';
  lines.forEach((ln, i) => c.fillText(ln, 160, 38 + i * 30 - (lines.length - 2) * 8));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, 1.05), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  p.position.set(0, 2.25, 0.09); g.add(p);
  addCircleCollider(x, z, 1.0);
}
woodSign(-24, 9, 0.5, ['WELCOME TO', 'FELTON, CA'], 3.4);
woodSign(4, 17.4, Math.PI + 0.15, ['SANTA CRUZ', 'REDWOODS', 'RV RESORT'], 3.6);
(function streetBlade() { // RIVER LN at the end of the driveway
  const g = new THREE.Group(); g.position.set(-1, 0, 10.5); g.rotation.y = -0.3; scene.add(g);
  cyl(0.05, 0.05, 2.8, 0x7a7d80, 0, 1.4, 0, g, 8);
  const cv = document.createElement('canvas'); cv.width = 220; cv.height = 48;
  const c = cv.getContext('2d');
  c.fillStyle = '#1e5c34'; c.fillRect(0, 0, 220, 48);
  c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(2, 2, 216, 44);
  c.fillStyle = '#fff'; c.font = 'bold 27px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('RIVER LN', 110, 25);
  const bladeTex = new THREE.CanvasTexture(cv);
  for (const face of [0, Math.PI]) { // readable from both sides
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.28), new THREE.MeshBasicMaterial({ map: bladeTex }));
    blade.position.set(0.3, 2.7, face === 0 ? 0.01 : -0.01);
    blade.rotation.y = face;
    g.add(blade);
  }
  addCircleCollider(-1, 10.5, 0.3);
})();

// ---------- Redwood forest ----------
const foliageMat = mat(0x24401f), foliageMat2 = mat(0x2e5026);
const trunkMat = new THREE.MeshLambertMaterial({ map: barkTex });
const swayers = []; // gently wind-blown things: {obj, phase, amp, axis}
const foliageMat3 = mat(0x1d3519);
function redwood(x, z, s) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  g.rotation.y = rand(0, Math.PI * 2);            // natural variation
  g.rotation.z = rand(-0.025, 0.025);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.85 * s, 16 * s, 9), trunkMat);
  trunk.position.y = 8 * s; trunk.castShadow = true; g.add(trunk);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.85 * s, 1.5 * s, 1.6 * s, 9), trunkMat); // buttressed base
  flare.position.y = 0.8 * s; flare.castShadow = true; g.add(flare);
  const mats2 = [foliageMat, foliageMat2, foliageMat3];
  const pick = Math.floor(rand(0, 3));
  for (let i = 0; i < 4; i++) {
    const r = (4.2 - i * 0.85) * s * rand(0.92, 1.08);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 5.5 * s, 7), mats2[(pick + i) % 3]);
    cone.position.y = (8 + i * 3.4) * s;
    cone.castShadow = true;
    g.add(cone);
    if (i % 2 === 0) swayers.push({ obj: cone, phase: rand(0, 9), amp: 0.035 });
  }
  addCircleCollider(x, z, 0.9 * s);
}
// ring of big redwoods + scattered ones (kept out of the yard)
let placed = 0, guard = 0;
while (placed < 42 && guard++ < 400) {
  const a = rand(0, Math.PI * 2), d = rand(26, 78);
  const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
  if (x > -22 && x < 22 && z > -32 && z < 18) continue; // keep yard + road clear
  if (!spotIsClear(x, z, 2.5)) continue;
  redwood(x, z, rand(0.8, 1.6));
  placed++;
}
// bushes around the yard
for (let i = 0; i < 18; i++) {
  const p = clearSpot(8, 30, 1);
  const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 1.1), 7, 6), mat(0x30522a));
  b.position.set(p.x, 0.4, p.z); b.castShadow = true; scene.add(b);
  swayers.push({ obj: b, phase: rand(0, 9), amp: 0.05 });
}
// front-yard trees like the photo
for (const [x, z] of [[-4, -13], [-11, -12]]) {
  const t = cyl(0.15, 0.22, 1.6, 0x6e4a30, x, 0.8, z);
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 7), mat(0x47632c));
  c.position.set(x, 2.4, z); c.castShadow = true; scene.add(c);
  addCircleCollider(x, z, 0.5);
}

// ---------- Ambience: a living redwood forest ----------
// ferns clustered near the trees
(function ferns() {
  const frondMat = mat(0x2f5a2a);
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2), d = rand(24, 66);
    const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
    if (x > -20 && x < 20 && z > -30 && z < 16) continue;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const n = 6;
    for (let f = 0; f < n; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.16, rand(0.8, 1.3), 5), frondMat);
      frond.scale.z = 0.25;
      frond.position.y = 0.15;
      frond.rotation.set(-1.15, 0, 0);
      const holder = new THREE.Group();
      holder.rotation.y = (f / n) * Math.PI * 2 + rand(-0.2, 0.2);
      holder.add(frond);
      g.add(holder);
    }
    scene.add(g);
    swayers.push({ obj: g, phase: rand(0, 9), amp: 0.06 });
  }
})();
// mushroom clusters
(function mushrooms() {
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), d = rand(22, 60);
    const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
    if (x > -20 && x < 20 && z > -30 && z < 16) continue;
    for (let m = 0; m < 2 + Math.floor(rand(0, 2)); m++) {
      const s = rand(0.5, 1.1);
      const mx = x + rand(-0.6, 0.6), mz = z + rand(-0.6, 0.6);
      cyl(0.05 * s, 0.08 * s, 0.2 * s, 0xe8dcc8, mx, 0.1 * s, mz, null, 8);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 10, 8), mat(Math.random() < 0.5 ? 0xb84a32 : 0xc9a15f));
      cap.scale.y = 0.55;
      cap.position.set(mx, 0.2 * s, mz);
      cap.castShadow = true;
      scene.add(cap);
    }
  }
})();
// rocks + a mossy fallen log
for (let i = 0; i < 12; i++) {
  const p = clearSpot(10, 55, 0.8);
  const r = new THREE.Mesh(new THREE.SphereGeometry(rand(0.3, 0.85), 6, 5), mat(0x686760));
  r.scale.y = 0.55;
  r.position.set(p.x, 0.1, p.z);
  r.rotation.y = rand(0, 9);
  r.castShadow = true; r.receiveShadow = true;
  scene.add(r);
}
(function fallenLog() {
  const log = cyl(0.45, 0.55, 5.5, 0x5f4230, -27, 0.5, -6, null, 9);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.5;
  for (let i = 0; i < 4; i++) {
    const moss = new THREE.Mesh(new THREE.SphereGeometry(rand(0.2, 0.35), 7, 5), mat(0x4f7038));
    moss.scale.y = 0.4;
    moss.position.set(-27 + rand(-2, 2), 0.95, -6 + rand(-1.2, 1.2));
    scene.add(moss);
  }
  addCircleCollider(-27, -6, 1.2);
})();
// wildflowers in the yard
(function flowers() {
  const petals = [0xfff3f7, 0xffd166, 0xc39bd9, 0xff9f6b, 0xfef9e0];
  for (let i = 0; i < 30; i++) {
    const p = clearSpot(6, 32, 0.4);
    const g = new THREE.Group();
    g.position.copy(p);
    cyl(0.015, 0.02, 0.28, 0x3f6a34, 0, 0.14, 0, g, 5);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), mat(petals[i % petals.length]));
    bloom.scale.y = 0.6;
    bloom.position.y = 0.3;
    g.add(bloom);
    scene.add(g);
    swayers.push({ obj: g, phase: rand(0, 9), amp: 0.12 });
  }
})();
// instanced grass tufts across the yard
(function grass() {
  const geo = new THREE.PlaneGeometry(0.16, 0.28);
  geo.translate(0, 0.14, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 700);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const greens = [0x4d6a33, 0x5b7a3c, 0x42602c, 0x66823f];
  let n = 0;
  for (let i = 0; i < 2600 && n < 700; i++) {
    const x = rand(-44, 44), z = rand(-34, 18);
    if (x > 0 && x < 16 && z > -18.5 && z < 10) continue;      // driveway
    if (z > 9 && z < 17) continue;                             // road
    if (!spotIsClear(x, z, 0.2)) continue;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI), rand(-0.12, 0.12));
    dummy.scale.setScalar(rand(0.6, 1.5));
    dummy.updateMatrix();
    inst.setMatrixAt(n, dummy.matrix);
    col.setHex(greens[n % greens.length]);
    inst.setColorAt(n, col);
    n++;
  }
  inst.count = n;
  scene.add(inst);
})();
// porch planters + a warm lantern by the door
(function porchLife() {
  for (const px of [-1.7, 1.7]) {
    const pot = cyl(0.22, 0.16, 0.3, 0xa8653f, px, 0.45, 6.1, houseL, 10);
    const bush2 = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0x3d6030));
    bush2.castShadow = true;
    bush2.position.set(px, 0.75, 6.1);
    houseL.add(bush2);
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat([0xffd166, 0xf2a5c0, 0xfef9f0][i % 3]));
      fl.position.set(px + rand(-0.2, 0.2), 0.8 + rand(0, 0.2), 6.1 + rand(-0.2, 0.2));
      houseL.add(fl);
    }
  }
  const lantern = box(0.16, 0.26, 0.12, 0x2b2118, -1.1, 2.5, 4.56, houseL);
  const glow = box(0.1, 0.16, 0.1, 0xffd28a, -1.1, 2.5, 4.58, houseL);
  glow.material = new THREE.MeshLambertMaterial({ color: 0xffd28a, emissive: 0xcc8a30 });
})();
// drifting clouds
const clouds = [];
for (let i = 0; i < 7; i++) {
  const g = new THREE.Group();
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  for (let pfs = 0; pfs < 4; pfs++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(3, 6), 8, 6), puffMat);
    puff.scale.y = 0.45;
    puff.position.set(rand(-6, 6), rand(-0.5, 0.5), rand(-3, 3));
    g.add(puff);
  }
  g.position.set(rand(-100, 100), rand(38, 56), rand(-90, 50));
  scene.add(g);
  clouds.push({ g, v: rand(0.6, 1.4) });
}
// sun shafts slanting between the redwoods
const shaftMat = new THREE.MeshBasicMaterial({
  color: 0xfff3c2, transparent: true, opacity: 0.06,
  depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
});
const shafts = [];
for (const [sx, sz] of [[-22, -16], [19, -12], [-27, 4], [24, 8], [-14, 12]]) {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 3.2, 24, 8, 1, true), shaftMat.clone());
  shaft.position.set(sx, 12, sz);
  shaft.rotation.z = -0.28; // slant away from the sun
  shaft.rotation.x = 0.1;
  scene.add(shaft);
  shafts.push({ m: shaft, phase: rand(0, 9), base: rand(0.045, 0.075) });
}
// floating pollen / dust motes
const MOTES = 220;
const moteGeo = new THREE.BufferGeometry();
const motePos = new Float32Array(MOTES * 3);
const moteSpd = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) {
  motePos[i * 3] = rand(-45, 45);
  motePos[i * 3 + 1] = rand(0.2, 12);
  motePos[i * 3 + 2] = rand(-40, 25);
  moteSpd[i] = rand(0.1, 0.35);
}
moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
  color: 0xfff8dd, size: 0.09, transparent: true, opacity: 0.65, depthWrite: false, sizeAttenuation: true,
}));
scene.add(motes);
// butterflies
const butterflies = [];
for (const color of [0xf28c28, 0x7ab8f5, 0xfef9f0]) {
  const g = new THREE.Group();
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    w.geometry.translate(s * 0.1, 0, 0);
    g.add(w);
    wings.push(w);
  }
  const anchor = clearSpot(7, 26, 0.4);
  g.position.copy(anchor);
  scene.add(g);
  butterflies.push({ g, wings, t: rand(0, 100), cx: anchor.x, cz: anchor.z, prev: new THREE.Vector3() });
}
// birds circling above the canopy
const flocks = [];
for (let f = 0; f < 2; f++) {
  const g = new THREE.Group();
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.28), new THREE.MeshBasicMaterial({ color: 0x2c2a26, side: THREE.DoubleSide }));
    wl.geometry.translate(-0.45, 0, 0);
    const wr = wl.clone(); wr.geometry = wl.geometry.clone(); wr.geometry.translate(0.9, 0, 0);
    b.add(wl); b.add(wr);
    b.position.set(i * 1.6 - 2.4, rand(-0.5, 0.5), -Math.abs(i - 1.5) * 1.2);
    g.add(b);
    birds.push({ b, wl, wr, ph: rand(0, 9) });
  }
  scene.add(g);
  flocks.push({ g, birds, t: rand(0, 60), w: rand(0.02, 0.03) * (f ? -1 : 1), r: rand(45, 62), y: rand(26, 34) });
}
// chimney smoke
const smokePuffs = [];
const smokeMat = new THREE.MeshLambertMaterial({ color: 0xb9bfc4, transparent: true, opacity: 0.3, depthWrite: false });
for (let i = 0; i < 8; i++) {
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), smokeMat.clone());
  scene.add(puff);
  smokePuffs.push({ m: puff, t: i * 0.55 });
}
function updateAmbience(dt, now) {
  const t = now * 0.001;
  waterTex.offset.x += 0.018 * dt; // the San Lorenzo flows
  waterTex.offset.y = Math.sin(t * 0.4) * 0.01;
  for (const s of swayers) s.obj.rotation.z = Math.sin(t * 0.9 + s.phase) * s.amp;
  for (const c of clouds) {
    c.g.position.x += c.v * dt;
    if (c.g.position.x > 115) c.g.position.x = -115;
  }
  for (const s of shafts) s.m.material.opacity = s.base + Math.sin(t * 0.35 + s.phase) * 0.02;
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3 + 1] -= moteSpd[i] * dt;
    motePos[i * 3] += Math.sin(t * 0.4 + i) * 0.12 * dt;
    if (motePos[i * 3 + 1] < 0.1) motePos[i * 3 + 1] = rand(8, 12);
  }
  moteGeo.attributes.position.needsUpdate = true;
  for (const bf of butterflies) {
    bf.t += dt;
    bf.prev.copy(bf.g.position);
    bf.g.position.set(
      bf.cx + Math.sin(bf.t * 0.6) * 3.5 + Math.sin(bf.t * 0.21) * 2.5,
      0.9 + Math.sin(bf.t * 1.4) * 0.45,
      bf.cz + Math.cos(bf.t * 0.47) * 3.5
    );
    bf.g.rotation.y = Math.atan2(bf.g.position.x - bf.prev.x, bf.g.position.z - bf.prev.z);
    const flap = 0.35 + Math.abs(Math.sin(bf.t * 14)) * 1.0;
    bf.wings[0].rotation.y = flap;
    bf.wings[1].rotation.y = -flap;
  }
  for (const fl of flocks) {
    fl.t += dt;
    const a = fl.t * fl.w * 10;
    fl.g.position.set(Math.sin(a) * fl.r, fl.y + Math.sin(fl.t * 0.4) * 1.5, Math.cos(a) * fl.r - 10);
    fl.g.rotation.y = a + (fl.w > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (const bd of fl.birds) {
      const f = Math.sin(fl.t * 9 + bd.ph) * 0.55;
      bd.wl.rotation.y = f;
      bd.wr.rotation.y = -f;
    }
  }
  for (const p of smokePuffs) {
    p.t += dt;
    if (p.t > 4.4) p.t = 0;
    const k = p.t / 4.4;
    p.m.position.set(-3 + k * 1.6 + Math.sin(t + k * 6) * 0.25, 10.4 + k * 5.5, -24);
    p.m.scale.setScalar(0.6 + k * 2.4);
    p.m.material.opacity = 0.32 * (1 - k);
  }
}

// ---------- Characters ----------
function makeLabel(text, color) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72;
  const c = cv.getContext('2d');
  c.font = 'bold 42px "Trebuchet MS", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 8; c.strokeStyle = 'rgba(0,0,0,0.55)'; c.strokeText(text, 128, 36);
  c.fillStyle = color; c.fillText(text, 128, 36);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  sp.scale.set(1.9, 0.55, 1);
  return sp;
}
// person materials: smooth PBR-ish shading, no blocky flat look
const pmats = {};
function pmat(color, opts) {
  const key = 'p' + color + JSON.stringify(opts || {});
  if (!pmats[key]) pmats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, opts));
  return pmats[key];
}
function sph(r, material, ws, hs) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws || 20, hs || 16), material);
  m.castShadow = true;
  return m;
}
function buildPerson(cfg) {
  const g = new THREE.Group();
  const h = cfg.h;
  const R = h * 0.1 * (cfg.headScale || 1);   // head radius
  const legH = h * 0.46, torsoH = h * 0.31;
  const hipW = h * 0.072;
  const parts = {};
  const skinM = pmat(cfg.skin, { roughness: 0.7 });
  const clothM = pmat(cfg.shirt, cfg.leather ? { roughness: 0.45, metalness: 0.15 } : {});
  const pantsM = pmat(cfg.pants);
  const hairM = pmat(cfg.hair, { roughness: 0.65 });
  const shoeM = pmat(cfg.shoes || 0x2b2b2b, { roughness: 0.5 });

  function capsuleLimb(r, len, material) { // pivot at top
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 6, 14);
    geo.translate(0, -len / 2, 0);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    return m;
  }
  // legs with rounded shoes
  const legR = h * 0.052;
  parts.lLeg = capsuleLimb(legR, legH, pantsM); parts.lLeg.position.set(-hipW, legH, 0);
  parts.rLeg = capsuleLimb(legR, legH, pantsM); parts.rLeg.position.set(hipW, legH, 0);
  for (const l of [parts.lLeg, parts.rLeg]) {
    const shoe = sph(legR * 1.15, shoeM, 14, 10);
    shoe.scale.set(1, 0.7, 1.9);
    shoe.position.set(0, -legH + legR * 0.55, legR * 0.9);
    l.add(shoe);
    g.add(l);
  }
  // hips
  const hips = sph(h * 0.1, pantsM);
  hips.scale.set(1.25, 0.75, 0.9);
  hips.position.y = legH * 0.99;
  g.add(hips);
  // chest: rounded capsule torso
  parts.body = new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.1, torsoH * 0.62, 6, 16), clothM);
  parts.body.castShadow = true;
  parts.body.scale.set(1.28, 1, 0.82);
  parts.body.position.y = legH + torsoH * 0.5;
  g.add(parts.body);
  parts.bodyBaseY = parts.body.position.y;
  // arms: capsules, pivot at shoulder, resting slightly outward
  const armR = h * 0.04, armLen = torsoH * 1.08;
  const shX = h * 0.1 * 1.28 + armR * 0.7, shY = legH + torsoH * 0.9;
  parts.lArm = capsuleLimb(armR, armLen, clothM); parts.lArm.position.set(-shX, shY, 0); parts.lArm.rotation.z = 0.1;
  parts.rArm = capsuleLimb(armR, armLen, clothM); parts.rArm.position.set(shX, shY, 0); parts.rArm.rotation.z = -0.1;
  for (const a of [parts.lArm, parts.rArm]) {
    const hand = sph(armR * 1.2, skinM, 12, 10);
    hand.position.y = -armLen;
    a.add(hand);
    g.add(a);
  }
  // neck
  const neck = cyl(R * 0.32, R * 0.36, R * 0.5, cfg.skin, 0, legH + torsoH + R * 0.1, 0, g, 10);
  neck.material = skinM;
  // ---- head ----
  const headG = new THREE.Group();
  headG.position.y = legH + torsoH + R * 1.18;
  const head = sph(R, skinM, 24, 18);
  head.scale.set(0.94, 1.04, 0.98);
  headG.add(head);
  // ears
  for (const s of [-1, 1]) {
    const ear = sph(R * 0.16, skinM, 10, 8);
    ear.scale.set(0.55, 1, 0.7);
    ear.position.set(s * R * 0.92, 0, 0);
    headG.add(ear);
  }
  // eyes (grouped so they can blink)
  parts.eyes = [];
  for (const s of [-1, 1]) {
    const eyeG = new THREE.Group();
    eyeG.position.set(s * R * 0.33, R * 0.12, R * 0.92);
    const white = sph(R * 0.155, pmat(0xffffff, { roughness: 0.35 }), 12, 10);
    white.scale.set(1, 1, 0.55);
    eyeG.add(white);
    const iris = sph(R * 0.082, pmat(cfg.eyes, { roughness: 0.3 }), 10, 8);
    iris.position.z = R * 0.11;
    eyeG.add(iris);
    const pupil = sph(R * 0.038, pmat(0x14100c, { roughness: 0.25 }), 8, 6);
    pupil.position.z = R * 0.165;
    eyeG.add(pupil);
    headG.add(eyeG);
    parts.eyes.push(eyeG);
    // eyebrow
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.035, R * 0.3, 4, 8), hairM);
    brow.rotation.z = Math.PI / 2 + s * 0.12;
    brow.position.set(s * R * 0.33, R * 0.36, R * 0.92);
    headG.add(brow);
  }
  // nose
  const nose = sph(R * 0.1, skinM, 10, 8);
  nose.scale.set(0.75, 1, 0.85);
  nose.position.set(0, -R * 0.05, R * 1.0);
  headG.add(nose);
  // smiling mouth (arc)
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.22, R * 0.038, 6, 14, Math.PI * 0.85),
    pmat(cfg.lips || 0x9c5a4a, { roughness: 0.55 })
  );
  mouth.rotation.z = Math.PI + (Math.PI - Math.PI * 0.85) / 2; // arc opens upward = smile
  mouth.position.set(0, -R * 0.34, cfg.beard ? R * 1.04 : R * 0.96);
  headG.add(mouth);
  // hair styles (smooth, rounded)
  if (cfg.style === 'short') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
    cap.scale.set(0.96, 1.02, 1);
    cap.rotation.x = -0.42; // hairline up in front
    cap.castShadow = true;
    headG.add(cap);
  } else if (cfg.style === 'long') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hairM);
    cap.rotation.x = -0.3;
    cap.castShadow = true;
    headG.add(cap);
    const back = sph(R * 0.9, hairM, 16, 12);
    back.scale.set(1.15, 1.7, 0.8);
    back.position.set(0, -R * 0.55, -R * 0.5);
    headG.add(back);
    for (const s of [-1, 1]) { // long side locks
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.24, R * 1.5, 6, 10), hairM);
      lock.position.set(s * R * 0.82, -R * 0.75, R * 0.15);
      lock.rotation.z = s * 0.12;
      headG.add(lock);
    }
    const bangs = sph(R * 0.55, hairM, 12, 10); // side-swept bangs
    bangs.scale.set(1.5, 0.5, 0.7);
    bangs.position.set(-R * 0.25, R * 0.62, R * 0.62);
    bangs.rotation.z = 0.35;
    headG.add(bangs);
  } else if (cfg.style === 'ponytail') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM);
    cap.rotation.x = -0.35;
    cap.castShadow = true;
    headG.add(cap);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.2, R * 1.2, 6, 10), hairM);
    tail.position.set(0, -R * 0.15, -R * 0.95);
    tail.rotation.x = 0.55;
    headG.add(tail);
    const scrunch = sph(R * 0.18, pmat(0xff5a8a), 8, 6);
    scrunch.position.set(0, R * 0.42, -R * 0.85);
    headG.add(scrunch);
  } else if (cfg.style === 'wild') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.03, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM);
    cap.rotation.x = -0.42;
    headG.add(cap);
    for (let i = 0; i < 6; i++) {
      const tuft = sph(R * rand(0.28, 0.42), hairM, 10, 8);
      tuft.position.set(rand(-0.55, 0.55) * R, R * rand(0.65, 0.95), rand(-0.6, 0.35) * R);
      headG.add(tuft);
    }
  } else if (cfg.style === 'pigtails') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    cap.rotation.x = -0.38;
    headG.add(cap);
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.18, R * 0.55, 6, 10), hairM);
      tail.position.set(s * R * 0.95, R * 0.35, -R * 0.1);
      tail.rotation.z = s * 1.25;
      headG.add(tail);
      const tie = sph(R * 0.12, pmat(0xffd166), 8, 6);
      tie.position.set(s * R * 0.88, R * 0.5, -R * 0.1);
      headG.add(tie);
    }
  } else if (cfg.style === 'wavybob') { // Maddie: side-parted waves to the jaw
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM);
    cap.rotation.x = -0.3;
    cap.castShadow = true;
    headG.add(cap);
    const back = sph(R * 0.85, hairM, 14, 10);
    back.scale.set(1.12, 1.15, 0.8);
    back.position.set(0, -R * 0.3, -R * 0.45);
    headG.add(back);
    for (const s of [-1, 1]) { // wavy locks: stacked offset blobs down to the jaw
      for (let seg = 0; seg < 3; seg++) {
        const wave = sph(R * (0.32 - seg * 0.04), hairM, 10, 8);
        wave.position.set(s * R * (0.85 + Math.sin(seg * 2.1) * 0.12), R * 0.15 - seg * R * 0.42, R * 0.1 - seg * 0.06 * R);
        headG.add(wave);
      }
    }
    const bangs = sph(R * 0.5, hairM, 12, 10); // side-swept part
    bangs.scale.set(1.4, 0.45, 0.7);
    bangs.position.set(R * 0.28, R * 0.68, R * 0.6);
    bangs.rotation.z = -0.3;
    headG.add(bangs);
  } else if (cfg.style === 'curly') { // Liam: long curly mop to the shoulders
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
    cap.rotation.x = -0.35;
    cap.castShadow = true;
    headG.add(cap);
    for (let ring = 0; ring < 3; ring++) { // rings of curls around sides + back
      const n = 6, y = R * (0.35 - ring * 0.55);
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI + Math.PI; // back half + sides only
        const rad = R * (0.92 + ring * 0.06);
        const curl = sph(R * rand(0.26, 0.36), hairM, 8, 6);
        curl.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad * 0.9);
        headG.add(curl);
      }
    }
    for (const s of [-1, 1]) { // curls framing the face
      const curl = sph(R * 0.3, hairM, 8, 6);
      curl.position.set(s * R * 0.88, R * 0.05, R * 0.45);
      headG.add(curl);
    }
  } else if (cfg.style === 'bun') { // Faylen: wispy top bun
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM);
    cap.rotation.x = -0.32;
    headG.add(cap);
    const bun = sph(R * 0.4, hairM, 12, 10);
    bun.scale.set(1, 0.85, 1);
    bun.position.set(0, R * 1.05, -R * 0.12);
    headG.add(bun);
    for (let i = 0; i < 4; i++) { // escaped wisps
      const wisp = sph(R * 0.09, hairM, 6, 5);
      wisp.position.set(rand(-0.5, 0.5) * R, R * (0.85 + rand(0, 0.35)), rand(-0.4, 0.2) * R);
      headG.add(wisp);
    }
  }
  if (cfg.cap) { // sideways ball cap (Rowan style)
    const capG = new THREE.Group();
    const capM = pmat(cfg.cap, { roughness: 0.8 });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.48), capM);
    crown.castShadow = true;
    capG.add(crown);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.85, R * 0.85, R * 0.07, 14, 1, false, -Math.PI * 0.38, Math.PI * 0.76), capM);
    brim.scale.set(1.25, 1, 1.5);
    brim.position.set(0, R * 0.38, R * 0.35);
    capG.add(brim);
    const logo = sph(R * 0.22, pmat(0xb03a2e), 10, 8); // round red patch
    logo.scale.z = 0.25;
    logo.position.set(0, R * 0.62, R * 0.92);
    capG.add(logo);
    capG.rotation.y = 0.55; // worn charmingly sideways
    capG.position.y = R * 0.12;
    headG.add(capG);
  }
  if (cfg.glasses) { // Liam's frames
    const frameM = pmat(0x4a3a34, { roughness: 0.35 });
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.24, R * 0.035, 6, 14), frameM);
      rim.position.set(s * R * 0.33, R * 0.12, R * 0.97);
      headG.add(rim);
      const temple = box(R * 0.05, R * 0.05, R * 1.0, 0x4a3a34, s * R * 0.62, R * 0.16, R * 0.45, headG);
      temple.material = frameM;
    }
    const bridge = box(R * 0.2, R * 0.05, R * 0.05, 0x4a3a34, 0, R * 0.14, R * 0.99, headG);
    bridge.material = frameM;
  }
  if (cfg.fuzz) { // proud teenage mustache fuzz
    const fuzz = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.032, R * 0.24, 4, 8), pmat(0x8a6a48, { roughness: 0.8 }));
    fuzz.rotation.z = Math.PI / 2;
    fuzz.position.set(0, -R * 0.19, R * 0.97);
    headG.add(fuzz);
  }
  if (cfg.blush) { // rosy kid cheeks
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(R * 0.16, 10, 8), pmat(0xe09a86, { transparent: true, opacity: 0.4 }));
      cheek.scale.set(1, 0.65, 0.4);
      cheek.position.set(s * R * 0.52, -R * 0.14, R * 0.78);
      headG.add(cheek);
    }
  }
  if (cfg.noseStud) { // Jessy's nose ring
    const stud = sph(R * 0.04, pmat(0xd4c088, { roughness: 0.2, metalness: 0.9 }), 8, 6);
    stud.position.set(R * 0.13, -R * 0.1, R * 0.99);
    headG.add(stud);
  }
  if (cfg.beard) { // trimmed beard hugging the jaw + mustache
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.02, 20, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.33),
      hairM
    );
    beard.scale.set(0.96, 1.05, 0.99);
    beard.position.y = -R * 0.02;
    headG.add(beard);
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.055, R * 0.28, 4, 8), hairM);
    stache.rotation.z = Math.PI / 2;
    stache.position.set(0, -R * 0.18, R * 0.99);
    headG.add(stache);
  }
  g.add(headG);
  parts.headG = headG;
  if (cfg.headphones) { // Beats resting around the neck, teen-style
    const hpM = pmat(0x17181a, { roughness: 0.35 });
    const neckY = legH + torsoH + R * 0.05;
    const band = new THREE.Mesh(new THREE.TorusGeometry(R * 0.52, R * 0.05, 6, 14, Math.PI), hpM);
    band.rotation.x = Math.PI * 0.42; // arcs behind the neck
    band.rotation.z = Math.PI;
    band.position.set(0, neckY, -R * 0.05);
    g.add(band);
    for (const s of [-1, 1]) {
      const cup = sph(R * 0.17, hpM, 10, 8);
      cup.scale.x = 0.6;
      cup.position.set(s * R * 0.52, neckY - R * 0.1, R * 0.12);
      g.add(cup);
    }
  }
  if (cfg.dress) { // toddler sundress
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.105, h * 0.175, h * 0.3, 14), clothM);
    skirt.castShadow = true;
    skirt.position.y = legH * 0.92;
    g.add(skirt);
  }
  // label
  const label = makeLabel(cfg.name, cfg.labelColor);
  label.position.y = h + 0.45;
  g.add(label);
  parts.height = h;
  return { group: g, parts };
}

const CHARS = [
  { id: 'eric',  name: 'Eric',  h: 1.82, skin: 0xc98d63, shirt: 0x23211f, sleeve: 0x23211f, pants: 0x2e3440, hair: 0x1d1712, eyes: 0x4a3520, style: 'short', beard: true, leather: true, labelColor: '#ffd166', speed: 6.6, jump: 7.2,
    tag: 'Dad · Powered by coffee & dad jokes',
    quips: ['Has anyone seen my coffee? It was RIGHT here.', 'I’m not sleeping, I’m checking my eyelids for holes.', 'Who wants to help me rake 40 billion redwood needles?', 'Grill’s hot. Dad mode: ACTIVATED.'] },
  { id: 'jessy', name: 'Jessy', h: 1.7, skin: 0xe8b48f, shirt: 0xf26f21, sleeve: 0xf26f21, pants: 0x35507a, hair: 0x5a3d28, eyes: 0x7aa05c, style: 'long', lips: 0xc96a7a, noseStud: true, labelColor: '#ff9f6b', speed: 6.9, jump: 7.2,
    tag: 'Mom · Can hear a snack wrapper from 3 rooms away',
    quips: ['I found a banana slug in someone’s shoe. AGAIN.', 'If it’s quiet for more than 2 minutes, I panic.', 'Yes I counted the kids. Twice. We still have four.', 'Whoever drew on the wall… nice shading, but NO.'] },
  { id: 'liam',  name: 'Liam',  h: 1.68, skin: 0xe4b58e, shirt: 0xa9c1cf, sleeve: 0xa9c1cf, pants: 0x33383f, hair: 0x7a5535, eyes: 0x76909e, style: 'curly', glasses: true, fuzz: true, headphones: true, blush: true, labelColor: '#a9d4e8', speed: 7.6, jump: 7.6,
    tag: 'Age 14 · Hoodie, headphones, "five more minutes"',
    quips: ['Five more minutes. FIVE. That’s basically nothing.', 'I’m not running, I’m speed-walking competitively.', 'Maddie started it.', 'Can we have pizza? Asking for me.'] },
  { id: 'maddie', name: 'Maddie', h: 1.5, skin: 0xeec3a0, shirt: 0xaede6a, sleeve: 0xaede6a, pants: 0x3a3a4a, hair: 0x6b4a2e, eyes: 0x5f4026, style: 'wavybob', blush: true, headScale: 1.06, labelColor: '#c8f08a', speed: 7.3, jump: 7.4,
    tag: 'Age 11 · CEO of Sass, secretly in charge',
    quips: ['Liam started it.', 'I’m not bossy, I just have better ideas.', 'Technically, I’m the favorite. It’s just science.', 'Did someone say SNACKS?'] },
  { id: 'rowan', name: 'Rowan', h: 1.05, skin: 0xf0c8a8, shirt: 0x2b3444, sleeve: 0x2b3444, pants: 0x4a6b8a, hair: 0x5a3d22, eyes: 0x7d94a6, style: 'short', cap: 0x232c3d, blush: true, headScale: 1.22, labelColor: '#ff8a7a', speed: 7.0, jump: 6.8,
    tag: 'Age 4 · ZOOMIES incarnate. Do not feed sugar.',
    quips: ['ZOOOOOOMIES!!!', 'I’m NOT tired!! *falls asleep standing*', 'Watch this!! (nobody watch this)', 'The slug is my best friend now. His name is Greg.'] },
  { id: 'faylen', name: 'Faylen', h: 0.78, skin: 0xdca87e, shirt: 0xbfe3cf, sleeve: 0xbfe3cf, pants: 0xdca87e, shoes: 0xfdfdfd, hair: 0x6b4a2e, eyes: 0x7a93a8, style: 'bun', dress: true, blush: true, headScale: 1.34, labelColor: '#ffc0dd', speed: 4.8, jump: 6.0,
    tag: 'Age 2 · Tiny tornado. Professional crayon eater.',
    quips: ['SNACK?? SNACK!!!', 'Uppy!! UPPY!!', 'Mine. Mine. MINE. mine.', '*mysterious toddler babbling* ...uh oh.'] },
];

const family = CHARS.map((cfg, i) => {
  const built = buildPerson(cfg);
  const start = clearSpot(6, 14, 0.8);
  built.group.position.copy(start);
  scene.add(built.group);
  return {
    cfg, i,
    group: built.group, parts: built.parts,
    pos: built.group.position,
    heading: rand(0, Math.PI * 2),
    vy: 0, grounded: true, walkT: 0, moving: false, speedMul: 1, blink: rand(1, 4),
    ai: { state: 'idle', timer: rand(1, 3), target: new THREE.Vector3() },
    carrying: null, tagged: false, home: false,
    buffT: 0, danceT: 0, riding: 0, fleeTag: 0, raceTarget: null,
  };
});
const eric = family[0], jessy = family[1];
const kids = family.slice(2);
let player = null; // set at intro

// ---------- Movement ----------
const GRAV = -22;
function moveChar(ch, dx, dz, dt, speed) {
  const len = Math.hypot(dx, dz);
  ch.moving = len > 0.01;
  if (ch.moving) {
    dx /= len; dz /= len;
    ch.pos.x += dx * speed * dt;
    ch.pos.z += dz * speed * dt;
    ch.heading = lerpAngle(ch.heading, Math.atan2(dx, dz), Math.min(1, dt * 12));
    ch.walkT += dt * speed * 1.6;
  }
  collide(ch.pos, 0.45);
  // gravity / jump
  ch.vy += GRAV * dt;
  ch.pos.y += ch.vy * dt;
  if (ch.pos.y <= 0) { ch.pos.y = 0; ch.vy = 0; ch.grounded = true; }
  else ch.grounded = false;
  // animate limbs
  const swing = ch.moving ? Math.sin(ch.walkT) * 0.7 : 0;
  const p = ch.parts;
  p.lLeg.rotation.x = swing; p.rLeg.rotation.x = -swing;
  p.lArm.rotation.x = -swing * 0.8; p.rArm.rotation.x = swing * 0.8;
  if (!ch.grounded) { p.lArm.rotation.x = -2.6; p.rArm.rotation.x = -2.6; } // wheee arms up
  const breathe = Math.sin(performance.now() * 0.0022 + ch.i) * 0.008;
  p.body.position.y = p.bodyBaseY + breathe + (ch.moving ? Math.abs(Math.sin(ch.walkT)) * 0.03 : 0);
  p.headG.rotation.z = ch.moving ? Math.sin(ch.walkT) * 0.05 : Math.sin(performance.now() * 0.0011 + ch.i * 2) * 0.04;
  // blinking
  ch.blink -= dt;
  if (ch.blink < -0.13) ch.blink = rand(2.2, 5.5);
  const eyeS = ch.blink < 0 ? 0.12 : 1;
  for (const e of p.eyes) e.scale.y += (eyeS - e.scale.y) * Math.min(1, dt * 30);
  ch.group.rotation.y = ch.heading;
}

// ---------- Input: keyboard + touch ----------
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5) - 1;
    if (n >= 0 && n < 6) switchTo(n);
  }
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Space') e.preventDefault();
  initAudio();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// camera orbit
let camYaw = 0, camPitch = 0.42, camDist = 8; // yaw 0 = camera looks toward the house
const touch = { moveId: null, camId: null, baseX: 0, baseY: 0, vx: 0, vz: 0, run: false };
const joy = document.getElementById('joy'), joyKnob = document.getElementById('joyknob');
function setJoy(x, y, show) {
  joy.style.display = show ? 'block' : 'none';
  joy.style.left = (x - 60) + 'px'; joy.style.top = (y - 60) + 'px';
}
function pointerDown(e) {
  initAudio();
  for (const t of e.changedTouches ? e.changedTouches : [e]) {
    const id = t.identifier !== undefined ? t.identifier : 'mouse';
    if (t.target.closest && t.target.closest('.ui')) continue;
    if (t.clientX < window.innerWidth * 0.45 && touch.moveId === null && t.identifier !== undefined) {
      touch.moveId = id; touch.baseX = t.clientX; touch.baseY = t.clientY;
      setJoy(t.clientX, t.clientY, true);
      joyKnob.style.transform = 'translate(0px,0px)';
    } else if (touch.camId === null) {
      touch.camId = id; touch.lastX = t.clientX; touch.lastY = t.clientY;
    }
  }
}
function pointerMove(e) {
  for (const t of e.changedTouches ? e.changedTouches : [e]) {
    const id = t.identifier !== undefined ? t.identifier : 'mouse';
    if (id === touch.moveId) {
      let dx = t.clientX - touch.baseX, dy = t.clientY - touch.baseY;
      const d = Math.hypot(dx, dy), max = 48;
      if (d > max) { dx *= max / d; dy *= max / d; }
      joyKnob.style.transform = `translate(${dx}px,${dy}px)`;
      touch.vx = dx / max; touch.vz = dy / max;
      touch.run = d > max * 0.85;
    } else if (id === touch.camId) {
      camYaw -= (t.clientX - touch.lastX) * 0.007;
      camPitch = Math.max(0.12, Math.min(1.1, camPitch + (t.clientY - touch.lastY) * 0.005));
      touch.lastX = t.clientX; touch.lastY = t.clientY;
    }
  }
  if (e.cancelable) e.preventDefault();
}
function pointerUp(e) {
  for (const t of e.changedTouches ? e.changedTouches : [e]) {
    const id = t.identifier !== undefined ? t.identifier : 'mouse';
    if (id === touch.moveId) { touch.moveId = null; touch.vx = touch.vz = 0; touch.run = false; setJoy(0, 0, false); }
    if (id === touch.camId) touch.camId = null;
  }
}
canvas.addEventListener('touchstart', pointerDown, { passive: false });
canvas.addEventListener('touchmove', pointerMove, { passive: false });
canvas.addEventListener('touchend', pointerUp);
canvas.addEventListener('touchcancel', pointerUp);
let mouseDown = false;
canvas.addEventListener('mousedown', e => { mouseDown = true; touch.camId = 'mouse'; touch.lastX = e.clientX; touch.lastY = e.clientY; initAudio(); });
window.addEventListener('mousemove', e => { if (mouseDown) pointerMove(e); });
window.addEventListener('mouseup', () => { mouseDown = false; if (touch.camId === 'mouse') touch.camId = null; });
document.getElementById('jumpbtn').addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
document.getElementById('jumpbtn').addEventListener('mousedown', e => { e.preventDefault(); doJump(); });
function doJump() {
  initAudio();
  if (player && player.grounded) { player.vy = player.cfg.jump; boing(); }
}

// ---------- Audio (tiny synth) ----------
let AC = null, muted = false, master = null;
function initAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(AC.destination);
      startAmbientSound();
    } catch (e) {}
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(freq, dur, type, vol, when) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.08, AC.currentTime + (when || 0));
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + (when || 0) + dur);
  o.connect(g); g.connect(master);
  o.start(AC.currentTime + (when || 0)); o.stop(AC.currentTime + (when || 0) + dur + 0.02);
}
// forest soundscape: soft wind bed + occasional birdsong
function startAmbientSound() {
  const len = AC.sampleRate * 2;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource();
  src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.4;
  const windGain = AC.createGain();
  windGain.gain.value = 0.02;
  src.connect(lp); lp.connect(windGain); windGain.connect(master);
  src.start();
  // slow swell so the wind breathes
  const lfo = AC.createOscillator(), lfoG = AC.createGain();
  lfo.frequency.value = 0.07; lfoG.gain.value = 0.011;
  lfo.connect(lfoG); lfoG.connect(windGain.gain);
  lfo.start();
  (function birdLoop() {
    setTimeout(() => {
      if (AC && !muted && AC.state === 'running') {
        const f0 = rand(2100, 3100);
        for (let i = 0; i < 2 + Math.floor(rand(0, 2)); i++) {
          const o = AC.createOscillator(), g = AC.createGain();
          const start = AC.currentTime + i * 0.17;
          o.type = 'sine';
          o.frequency.setValueAtTime(f0 * rand(0.95, 1.1), start);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.72, start + 0.13);
          g.gain.setValueAtTime(0.016, start);
          g.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
          o.connect(g); g.connect(master);
          o.start(start); o.stop(start + 0.2);
        }
      }
      birdLoop();
    }, rand(5000, 13000));
  })();
}
function blip() { tone(880, 0.09, 'square', 0.06); tone(1320, 0.12, 'square', 0.05, 0.07); }
function boing() { tone(220, 0.18, 'sine', 0.1); tone(440, 0.1, 'sine', 0.06, 0.05); }
function owSound() { tone(180, 0.3, 'sawtooth', 0.1); tone(140, 0.35, 'sawtooth', 0.08, 0.1); }
function fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.13)); }
function tada() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, i * 0.09)); }
function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  document.getElementById('mute').textContent = muted ? '🔇' : '🔊';
}
document.getElementById('mute').addEventListener('click', () => { initAudio(); toggleMute(); });

// ---------- Speech bubbles ----------
const bubbleLayer = document.getElementById('bubbles');
const bubbles = [];
function say(ch, text, secs) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  bubbleLayer.appendChild(el);
  bubbles.push({ el, ch, ttl: secs || 3.2 });
}
const v3 = new THREE.Vector3();
function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.ttl -= dt;
    if (b.ttl <= 0) { b.el.remove(); bubbles.splice(i, 1); continue; }
    v3.copy(b.ch.pos); v3.y += b.ch.cfg.h + 0.75;
    v3.project(camera);
    if (v3.z > 1) { b.el.style.display = 'none'; continue; }
    b.el.style.display = 'block';
    b.el.style.left = ((v3.x * 0.5 + 0.5) * window.innerWidth) + 'px';
    b.el.style.top = ((-v3.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    b.el.style.opacity = Math.min(1, b.ttl / 0.4);
  }
}
let quipTimer = 5;
function randomQuips(dt) {
  quipTimer -= dt;
  if (quipTimer <= 0) {
    quipTimer = rand(6, 13);
    const others = family.filter(f => f !== player && !f.home);
    if (!others.length) return;
    const ch = others[Math.floor(Math.random() * others.length)];
    say(ch, ch.cfg.quips[Math.floor(Math.random() * ch.cfg.quips.length)]);
  }
}
// Dad jokes on a timer — with kid groan
const DAD_JOKES = [
  'Why don’t redwoods use the internet? They’d just log out.',
  'I used to hate facial hair. Then it grew on me.',
  'What do you call a slug on the porch? A slow-mo delivery.',
  'Felton? More like FELT-great-to-live-here, am I right?',
  'I’m reading a book about anti-gravity. Impossible to put down.',
  'Why did the scarecrow win an award? He was outstanding in his field.',
];
let jokeTimer = 25;
function dadJokes(dt) {
  jokeTimer -= dt;
  if (jokeTimer <= 0) {
    jokeTimer = rand(35, 55);
    say(eric, '📢 ' + DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)], 4.5);
    const groaners = kids.filter(k => !k.home);
    if (groaners.length) setTimeout(() => say(groaners[Math.floor(Math.random() * groaners.length)], 'DAAAAAD. 🙄', 2.5), 2500);
  }
}

// ---------- Toast ----------
let toastTimeout = null;
function toast(text, secs) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.remove('show'), (secs || 3) * 1000);
}

// ---------- Confetti ----------
const confetti = [];
function throwConfetti(pos) {
  const colors = [0xff5a5a, 0xffd166, 0x7ee08a, 0x6bb8ff, 0xd9a3ff, 0xff9f6b];
  for (let i = 0; i < 90; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), mat(colors[i % colors.length], { side: THREE.DoubleSide }));
    m.position.copy(pos); m.position.y += 1.5;
    scene.add(m);
    confetti.push({ m, vx: rand(-3.5, 3.5), vy: rand(4, 9), vz: rand(-3.5, 3.5), spin: rand(3, 9), ttl: rand(1.8, 3) });
  }
}
function updateConfetti(dt) {
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.ttl -= dt;
    c.vy -= 9 * dt;
    c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
    c.m.rotation.x += c.spin * dt; c.m.rotation.y += c.spin * 0.7 * dt;
    if (c.m.position.y < 0 || c.ttl <= 0) { scene.remove(c.m); confetti.splice(i, 1); }
  }
}

// ---------- Critters: banana slugs + a squirrel ----------
function makeSlug() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat(0xf5d033));
  body.scale.set(1, 0.55, 2.1); body.position.y = 0.12; body.castShadow = true; g.add(body);
  for (const s of [-1, 1]) {
    const ant = box(0.03, 0.16, 0.03, 0xd4b429, s * 0.07, 0.28, 0.38, g);
    ant.rotation.x = -0.5;
  }
  return g;
}
const squirrel = (function () {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(0x8a5a3a));
  body.scale.set(1, 0.9, 1.5); body.position.y = 0.18; g.add(body);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), mat(0x9a6a45));
  tail.scale.set(0.7, 2, 0.7); tail.position.set(0, 0.35, -0.28); tail.rotation.x = 0.6; g.add(tail);
  scene.add(g);
  g.position.copy(clearSpot(15, 30, 0.5));
  return { g, target: clearSpot(15, 30, 0.5), timer: 3 };
})();
function updateSquirrel(dt) {
  squirrel.timer -= dt;
  if (squirrel.timer <= 0) { squirrel.timer = rand(2, 6); squirrel.target = clearSpot(10, 35, 0.5); }
  const d = squirrel.target.clone().sub(squirrel.g.position); d.y = 0;
  if (d.length() > 0.3) {
    d.normalize();
    squirrel.g.position.addScaledVector(d, 6 * dt);
    squirrel.g.rotation.y = Math.atan2(d.x, d.z);
    squirrel.g.position.y = Math.abs(Math.sin(performance.now() * 0.02)) * 0.15;
  }
}

// ---------- AI for the rest of the family ----------
function updateAI(ch, dt) {
  if (ch.riding > 0) return; // being carried piggyback
  if (ch.home) { moveChar(ch, 0, 0, dt, 0); return; }
  if (ch.raceTarget) { // racing the player!
    const d = ch.raceTarget.clone().sub(ch.pos); d.y = 0;
    if (d.length() > 0.5) { d.normalize(); moveChar(ch, d.x, d.z, dt, ch.cfg.speed * 1.02); }
    else moveChar(ch, 0, 0, dt, 0);
    return;
  }
  if (ch.fleeTag > 0) { // playing tag — run away!
    ch.fleeTag -= dt;
    const d = ch.pos.clone().sub(player.pos); d.y = 0;
    if (d.length() < 10) { d.normalize(); moveChar(ch, d.x, d.z, dt, ch.cfg.speed * 0.95); return; }
  }
  const ai = ch.ai;
  // Faylen follows the nearest parent (adorably slowly)
  if (ch.cfg.id === 'faylen' && Math.random() < 0.006) {
    const p = [eric, jessy].filter(x => x !== null).sort((a, b) => a.pos.distanceTo(ch.pos) - b.pos.distanceTo(ch.pos))[0];
    ai.target.copy(p.pos).add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)));
    ai.state = 'walk';
  }
  // fleeing kids during dinner mission
  if (ch.flee) {
    const d = ch.pos.clone().sub(player.pos); d.y = 0;
    if (d.length() < 8) {
      d.normalize();
      moveChar(ch, d.x, d.z, dt, ch.cfg.speed * 0.92);
      return;
    }
  }
  ai.timer -= dt;
  if (ai.timer <= 0) {
    if (ai.state === 'idle') {
      ai.state = 'walk';
      ai.target.copy(clearSpot(4, 26, 0.8));
      ai.timer = 20;
      if (ch.cfg.id === 'rowan' && Math.random() < 0.25) { ch.speedMul = 2.1; say(ch, 'ZOOMIES!!! 🌀', 2); }
      else ch.speedMul = 1;
    } else { ai.state = 'idle'; ai.timer = rand(1.5, 4); }
  }
  if (ai.state === 'walk') {
    const d = ai.target.clone().sub(ch.pos); d.y = 0;
    if (d.length() < 0.6) { ai.state = 'idle'; ai.timer = rand(1.5, 5); moveChar(ch, 0, 0, dt, 0); }
    else { d.normalize(); moveChar(ch, d.x, d.z, dt, ch.cfg.speed * 0.55 * ch.speedMul); }
  } else moveChar(ch, 0, 0, dt, 0);
}

// ---------- Achievements ----------
const ACH_LIST = {
  honk: '🚗 Beep Beep! — honked the Mini',
  mail: '📬 Mail Call — checked the mailbox',
  skipper: '💦 Stone Cold Skipper — 4+ skips on the San Lorenzo',
  bounce: '🤸 Boing Master — 5 bounces in a row',
  deer: '🦌 Deer Whisperer — spotted the deer',
  squirrel: '🐿️ Rejected — tried to pet the squirrel',
  smore: '🍫 S’more Sommelier — perfectly toasted',
  golden: '🐌✨ Legend of Greg — found the Golden Slug',
  family: '✋ Full House — high-fived the whole family',
  goal: '⚽ Top Fisch — scored a goal',
};
const ach = { unlocked: {}, bounceStreak: 0, hifived: {} };
function achCount() { return Object.keys(ach.unlocked).length; }
function award(id) {
  if (ach.unlocked[id]) return;
  ach.unlocked[id] = true;
  score += 10;
  tada();
  toast('🏆 Achievement: ' + ACH_LIST[id] + `  (${achCount()}/${Object.keys(ACH_LIST).length})`, 4);
  const el = document.getElementById('achv');
  if (el) el.textContent = '🏆 ' + achCount() + '/' + Object.keys(ACH_LIST).length;
}

// ---------- Backyard activities ----------
// in-ground trampoline (very Felton)
const TRAMP = { x: -21, z: -2, r: 1.7 };
(function trampoline() {
  const pad = cyl(TRAMP.r, TRAMP.r, 0.06, 0x1c1c20, TRAMP.x, 0.03, TRAMP.z, null, 20);
  pad.castShadow = false;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(TRAMP.r, 0.13, 8, 20), pmat(0x3563a8, { roughness: 0.7 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(TRAMP.x, 0.1, TRAMP.z);
  scene.add(ring);
})();
// campfire ring
const CAMP = { x: -24, z: -16 };
const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, fog: false });
const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 8), flameMat);
flame.position.set(CAMP.x, 0.55, CAMP.z);
scene.add(flame);
const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, fog: false }));
flame2.position.set(CAMP.x, 0.5, CAMP.z);
scene.add(flame2);
const fireLight = new THREE.PointLight(0xff8a3c, 0.9, 9);
fireLight.position.set(CAMP.x, 1, CAMP.z);
scene.add(fireLight);
for (let i = 0; i < 8; i++) { // ring of stones
  const a = (i / 8) * Math.PI * 2;
  const st = new THREE.Mesh(new THREE.SphereGeometry(rand(0.14, 0.2), 6, 5), mat(0x6e6d64));
  st.position.set(CAMP.x + Math.cos(a) * 0.55, 0.08, CAMP.z + Math.sin(a) * 0.55);
  scene.add(st);
}
for (const a of [0.4, 2.1]) { // crossed logs
  const lg = cyl(0.08, 0.1, 0.9, 0x4a3220, CAMP.x, 0.14, CAMP.z, null, 6);
  lg.rotation.z = Math.PI / 2; lg.rotation.y = a;
}
addCircleCollider(CAMP.x, CAMP.z, 0.7);
// soccer ball + goal
const GOAL = { x: -24, z1: -7.2, z2: -4.8 };
for (const gz of [GOAL.z1, GOAL.z2]) cyl(0.06, 0.06, 1.8, 0xf0f0f0, GOAL.x, 0.9, gz, null, 8);
const bar = cyl(0.06, 0.06, GOAL.z2 - GOAL.z1, 0xf0f0f0, GOAL.x, 1.8, (GOAL.z1 + GOAL.z2) / 2, null, 8);
bar.rotation.x = Math.PI / 2;
const ball = { pos: new THREE.Vector3(5, 0.35, -2), vel: new THREE.Vector3(), kickCd: 0 };
const ballMesh = (function () {
  const g = new THREE.Group();
  g.add(sph(0.35, pmat(0xf5f5f0, { roughness: 0.5 }), 16, 12));
  for (let i = 0; i < 8; i++) {
    const dot = sph(0.09, pmat(0x1c1c1c), 6, 5);
    const a = (i / 8) * Math.PI * 2, b = (i % 2 ? 0.5 : -0.5);
    dot.position.set(Math.cos(a) * 0.31, Math.sin(b) * 0.2, Math.sin(a) * 0.31).normalize();
    dot.position.multiplyScalar(0.33);
    dot.scale.setScalar(0.55);
    g.add(dot);
  }
  scene.add(g);
  return g;
})();
function ballReset() { ball.pos.set(5, 0.35, -2); ball.vel.set(0, 0, 0); }
let onGoalScored = null;
function updateBall(dt) {
  ball.kickCd -= dt;
  // kick when the player runs into it
  const d = ball.pos.distanceTo(player.pos);
  if (d < 0.95 && ball.kickCd <= 0) {
    ball.kickCd = 0.35;
    const dir = ball.pos.clone().sub(player.pos); dir.y = 0; dir.normalize();
    const pow = 8 + (player.moving ? 3 : 0);
    ball.vel.set(dir.x * pow, 3.5, dir.z * pow);
    tone(160, 0.08, 'square', 0.09);
  }
  ball.vel.y -= 20 * dt;
  ball.pos.addScaledVector(ball.vel, dt);
  if (ball.pos.y < 0.35) { ball.pos.y = 0.35; ball.vel.y *= -0.45; ball.vel.x *= 0.92; ball.vel.z *= 0.92; }
  const pre = ball.pos.clone();
  collide(ball.pos, 0.35);
  const push = ball.pos.clone().sub(pre);
  if (push.lengthSq() > 0.00001) { // bounce off whatever we hit
    const n = push.normalize();
    const vn = ball.vel.dot(n);
    if (vn < 0) ball.vel.addScaledVector(n, -1.6 * vn);
    ball.vel.multiplyScalar(0.7);
  }
  ball.vel.x *= (1 - 0.4 * dt); ball.vel.z *= (1 - 0.4 * dt);
  // GOOOOAL?
  if (ball.pos.x < GOAL.x + 0.4 && ball.pos.x > GOAL.x - 1 && ball.pos.z > GOAL.z1 && ball.pos.z < GOAL.z2 && ball.pos.y < 1.7) {
    score += 5;
    fanfare();
    throwConfetti(ball.pos);
    toast('⚽ GOOOOAL!!! The redwoods go wild!', 3);
    say(player, ['GOLAZO!', 'Top bins!!', 'And the crowd (of trees) goes WILD!'][Math.floor(rand(0, 3))], 2.5);
    award('goal');
    if (onGoalScored) onGoalScored();
    ballReset();
  }
  ballMesh.position.copy(ball.pos);
  ballMesh.rotation.x += ball.vel.z * dt * 2;
  ballMesh.rotation.z -= ball.vel.x * dt * 2;
}
// Greg the Golden Slug (one per playthrough, hiding in the deep forest)
const goldenSlug = (function () {
  const g = makeSlug();
  g.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0x8a6a10, roughness: 0.3, metalness: 0.6 }); });
  g.scale.setScalar(1.4);
  let spot = clearSpot(40, 65, 0.6);
  for (let i = 0; i < 40 && spot.z > 25; i++) spot = clearSpot(40, 65, 0.6); // stay on the home side of the river
  g.position.copy(spot);
  scene.add(g);
  return g;
})();
let goldenFound = false;
// a deer at the forest edge (it's Felton, of course there's a deer)
const deer = (function () {
  const g = new THREE.Group();
  const bodyM = pmat(0x8a6844, { roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.62, 6, 12), bodyM);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.78;
  body.castShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 10), bodyM);
  neck.rotation.x = -0.5;
  neck.position.set(0, 1.15, 0.42);
  g.add(neck);
  const head = sph(0.15, bodyM, 12, 10);
  head.scale.set(0.8, 0.85, 1.25);
  head.position.set(0, 1.42, 0.62);
  g.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), bodyM);
    ear.position.set(s * 0.11, 1.58, 0.55);
    ear.rotation.z = s * -0.5;
    g.add(ear);
    for (const lz of [-0.25, 0.32]) {
      const leg = cyl(0.035, 0.045, 0.75, 0x7a5c3c, s * 0.13, 0.38, lz, g, 6);
    }
  }
  const tail = sph(0.09, pmat(0xf0ead8), 8, 6);
  tail.position.set(0, 0.9, -0.48);
  g.add(tail);
  g.position.set(34, 0, -14);
  scene.add(g);
  return { g, target: new THREE.Vector3(34, 0, -14), timer: 2, speed: 2.5 };
})();
function updateDeer(dt) {
  const dp = deer.g.position.distanceTo(player.pos);
  if (dp < 8) award('deer');
  if (dp < 6) { // flee gracefully
    const away = deer.g.position.clone().sub(player.pos); away.y = 0; away.normalize();
    deer.target.copy(deer.g.position).addScaledVector(away, 18);
    deer.speed = 8.5;
  }
  deer.timer -= dt;
  if (deer.timer <= 0) {
    deer.timer = rand(4, 9);
    deer.speed = 2.5;
    const a = rand(0, Math.PI * 2), d = rand(30, 60);
    deer.target.set(Math.sin(a) * d, 0, Math.min(24, Math.cos(a) * d - 8)); // deer stays out of the river
  }
  deer.target.z = Math.min(24, deer.target.z);
  const dv = deer.target.clone().sub(deer.g.position); dv.y = 0;
  if (dv.length() > 0.8) {
    dv.normalize();
    deer.g.position.addScaledVector(dv, deer.speed * dt);
    deer.g.rotation.y = Math.atan2(dv.x, dv.z);
    const dist = Math.hypot(deer.g.position.x, deer.g.position.z);
    if (dist > 78) { deer.g.position.multiplyScalar(78 / dist); }
  }
}
// stone skipping on the San Lorenzo
const stones = [];
function skipStone() {
  const s = { pos: player.pos.clone().add(new THREE.Vector3(0, 1, 0)), vel: new THREE.Vector3(rand(-0.5, 0.5), 3.2, 9), hops: 0 };
  s.m = sph(0.09, pmat(0x77766e, { roughness: 0.6 }), 8, 6);
  s.m.scale.y = 0.5;
  scene.add(s.m);
  stones.push(s);
  tone(500, 0.05, 'sine', 0.05);
}
function updateStones(dt) {
  for (let i = stones.length - 1; i >= 0; i--) {
    const s = stones[i];
    s.vel.y -= 14 * dt;
    s.pos.addScaledVector(s.vel, dt);
    if (s.pos.y <= 0.06 && s.vel.y < 0) {
      if (s.pos.z > 28 && s.pos.z < 38) { // on the water: skip!
        s.hops++;
        tone(700 + s.hops * 160, 0.07, 'sine', 0.06);
        s.vel.y = Math.abs(s.vel.y) * 0.55;
        s.vel.z *= 0.75;
        if (s.vel.y < 1.3) { // sink
          toast(`💦 ${s.hops} skip${s.hops === 1 ? '' : 's'}!` + (s.hops >= 4 ? ' LEGENDARY.' : ''), 2.5);
          if (s.hops >= 4) award('skipper');
          scene.remove(s.m); stones.splice(i, 1);
          continue;
        }
      } else { // thud on land
        tone(140, 0.1, 'triangle', 0.06);
        scene.remove(s.m); stones.splice(i, 1);
        continue;
      }
    }
    s.m.position.copy(s.pos);
  }
}

// ---------- Talking & playing with the family ----------
const GREET = {
  eric: ['Hey hey! What’s the word?', 'Family meeting? No? Okay just checking.'],
  jessy: ['Hi sweetie. Everyone alive? Good.', 'Talk to me — but make it quick, I smell mischief.'],
  liam: ['Yo.', 'Sup. I have headphones on but I’ll allow it.'],
  maddie: ['Hi. You have 30 seconds, I’m very busy.', 'Yes? Speak.'],
  rowan: ['HI HI HI HI HI!!', 'Guess what?! CHICKEN BUTT!'],
  faylen: ['Hai.', '*offers you one (1) soggy goldfish cracker*'],
};
const REPLY = {
  eric: { any: ['Have you seen my coffee? This is not a drill.', 'I was today years old when I found a slug in my shoe.', 'Who wants to help stack firewood? ...Hello?'], liam: ['Turn that music down!... wait, that’s a banger. Turn it up.'], rowan: ['No, we cannot jump off the roof onto the trampoline.'] },
  jessy: { any: ['Did everyone put on sunscreen? Even you, Eric.', 'If anyone asks, the last cookie was ALWAYS gone.', 'I love you, but why are you sticky?'], eric: ['Yes, I saw your coffee. It’s where you left it. On the car roof.'], faylen: ['Is that a crayon in your mouth?? FAYLEN.'] },
  liam: { any: ['Huh? Sorry, headphones.', 'Can I get Robux? It’s for... education.', 'Flynn Creek Circus was literally peak.'], eric: ['Five. More. Minutes. I’m mid-match.'], maddie: ['I did NOT take your charger. (I took the charger.)'] },
  maddie: { any: ['I’m literally in the middle of something very important.', 'Fine, you can be my assistant. Unpaid.', 'Technically, that was Liam’s fault.'], liam: ['Nice hair. Did a squirrel style it?'], jessy: ['Mom, tell Liam to stop EXISTING so loudly.'] },
  rowan: { any: ['Wanna see how fast I run?? TOO LATE, already did.', 'My cap gives me POWERS.', 'Greg the slug is my best friend. Don’t tell the other slugs.'], eric: ['Dad watch this! No wait. Watch THIS!'] },
  faylen: { any: ['*hands you a slightly chewed crayon* ...gift.', 'Uppy??', 'No. No no no. ...Okay yes.'], jessy: ['Mama!! *shows you a rock like it’s treasure*'] },
};
function talkTo(target) {
  const g = GREET[player.cfg.id];
  say(player, g[Math.floor(rand(0, g.length))], 2.6);
  const pool = REPLY[target.cfg.id];
  const lines = (pool[player.cfg.id] && Math.random() < 0.5) ? pool[player.cfg.id] : pool.any;
  setTimeout(() => say(target, lines[Math.floor(rand(0, lines.length))], 3.2), 1300);
  score += 1;
}
function highFive(target) {
  if (player.grounded) player.vy = 4.5;
  if (target.grounded) target.vy = 4.5;
  tone(950, 0.06, 'square', 0.08); tone(1400, 0.08, 'square', 0.06, 0.05);
  say(target, '✋ Up top!', 1.8);
  score += 2;
  ach.hifived[target.cfg.id] = true;
  if (Object.keys(ach.hifived).length >= 5) award('family');
}
let raceState = null;
const SPECIALS = {
  eric: { label: '📢 Dad joke', fn(t) { say(t, '📢 ' + DAD_JOKES[Math.floor(rand(0, DAD_JOKES.length))], 4.5); setTimeout(() => say(player, 'DAAAD. 🙄', 2), 2300); } },
  jessy: { label: '🍎 Ask for snack', fn(t) { say(t, 'Here. Eat. You look like you’re about to do something reckless.', 3); player.buffT = 20; toast('🍎 SNACK POWER! +30% speed for 20s', 3); blip(); } },
  liam: { label: '🏁 Race to mailbox', fn(t) { t.raceTarget = new THREE.Vector3(3.5, 0, 7); raceState = { racing: true, t: 0 }; toast('🏁 RACE! First one to the mailbox! GO GO GO!', 3); say(t, 'You’re about to get DUSTED.', 2.5); } },
  maddie: { label: '💃 Dance party', fn(t) { for (const f of family) if (f.pos.distanceTo(t.pos) < 9) f.danceT = 3; [523, 659, 784, 659, 523, 784].forEach((f2, i) => tone(f2, 0.15, 'triangle', 0.08, i * 0.14)); throwConfetti(t.pos); say(t, 'DANCE BREAK. It’s mandatory.', 2.5); score += 3; } },
  rowan: { label: '🏃 Play tag', fn(t) { t.fleeTag = 15; say(t, 'CAN’T CATCH ME, I HAD JUICE!', 2.5); toast('🏃 Rowan is IT-proof for 15s. Catch him!', 3); } },
  faylen: { label: '🎒 Piggyback', fn(t) { t.riding = 25; say(t, 'UPPY!!! 🥹', 2); toast('🎒 Faylen is aboard. Precious cargo mode: slightly slower.', 3); } },
};
function updateRace(dt) {
  if (!raceState || !raceState.racing) return;
  const liam = family[2];
  const mail = new THREE.Vector3(3.5, 0, 7);
  const pd = player.pos.distanceTo(mail), ld = liam.pos.distanceTo(mail);
  if (pd < 1.9 || ld < 1.9) {
    raceState.racing = false;
    liam.raceTarget = null;
    if (pd < ld) { toast('🏁 YOU WIN! Liam demands a rematch.', 3.5); say(liam, 'Lag. That was lag.', 2.5); score += 10; fanfare(); throwConfetti(player.pos); }
    else { toast('🏁 Liam wins. He will never let you forget this.', 3.5); say(liam, 'EZ. Clipped it. GG.', 2.5); }
  }
}
function updateTag(dt) {
  const rowan = family[4];
  if (rowan.fleeTag > 0 && player.pos.distanceTo(rowan.pos) < 1.3) {
    rowan.fleeTag = 0;
    score += 8;
    fanfare();
    say(rowan, 'NOOO my juice powers!!', 2.5);
    toast('🏃 TAG! You caught the gremlin! +8', 3);
  }
}

// ---------- Context actions (interact with whatever is near) ----------
const MAIL_LINES = [
  '📬 Bill. Bill. Coupon for 43 tacos. Jackpot.',
  '📬 A catalog for “Redwood Life” — it’s just pictures of trees. 10/10.',
  '📬 Letter addressed to “Greg the Slug, 110 River Ln.” Concerning.',
  '📬 Free pizza coupon! Expired in 2019. Keeping it anyway.',
  '📬 The neighbor’s mail. Again. Off to the RV resort with you.',
];
const objectActions = [
  { key: 'car', label: '🚗 Honk', near: p => Math.hypot(p.x + 17, p.z + 12) < 3.2, fn() { tone(310, 0.25, 'square', 0.12); tone(392, 0.25, 'square', 0.12); tone(310, 0.3, 'square', 0.12, 0.35); tone(392, 0.3, 'square', 0.12, 0.35); toast('🚗 BEEP BEEP! The Mini is pleased.', 2.5); award('honk'); } },
  { key: 'mail', label: '📬 Check mail', near: p => Math.hypot(p.x - 3.5, p.z - 8.5) < 2.2, fn() { toast(MAIL_LINES[Math.floor(rand(0, MAIL_LINES.length))], 3.5); blip(); award('mail'); } },
  { key: 'door', label: '🚪 Knock', near: p => Math.hypot(p.x + 8, p.z + 17.6) < 2.4, fn() { tone(130, 0.08, 'triangle', 0.12); tone(120, 0.08, 'triangle', 0.12, 0.18); setTimeout(() => toast('🚪 “IT’S OPEN!” — everyone inside, in perfect unison', 3), 700); } },
  { key: 'fire', label: '🍫 Make s’more', near: p => Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 2.8, fn() { score += 3; blip(); say(player, ['Perfectly toasted. I am a s’mores sommelier.', 'Crispy outside, molten core. Chef’s kiss.', 'One for me, zero for sharing.'][Math.floor(rand(0, 3))], 3); award('smore'); } },
  { key: 'river', label: '🪨 Skip a stone', near: p => p.z > 23 && p.z < 27.4, fn() { skipStone(); } },
  { key: 'squirrel', label: '🐿️ Pet squirrel', near: p => squirrel.g.position.distanceTo(p) < 2, fn() { squirrel.timer = 0; squirrel.target = clearSpot(30, 45, 0.5); toast('🐿️ The squirrel respectfully declines your friendship.', 3); award('squirrel'); } },
];
const actionsEl = document.getElementById('actions');
let currentActions = [], currentKey = '';
function setActions(key, list) {
  if (key === currentKey) return;
  currentKey = key;
  currentActions = list;
  actionsEl.innerHTML = '';
  actionsEl.style.display = list.length ? 'flex' : 'none';
  const hotkeys = ['E', 'F', 'G'];
  list.forEach((a, i) => {
    const b = document.createElement('button');
    b.className = 'ui';
    b.innerHTML = a.label + (matchMedia('(pointer: coarse)').matches ? '' : ` <span class="hk">${hotkeys[i]}</span>`);
    b.addEventListener('click', () => { initAudio(); a.fn(a.target); currentKey = ''; });
    actionsEl.appendChild(b);
  });
}
window.addEventListener('keydown', e => {
  const idx = { KeyE: 0, KeyF: 1, KeyG: 2 }[e.code];
  if (idx !== undefined && currentActions[idx]) { currentActions[idx].fn(currentActions[idx].target); currentKey = ''; }
});
function updateInteractions() {
  // nearest family member first
  let best = null, bd = 2.4;
  for (const f of family) {
    if (f === player || f.home) continue;
    const d = f.pos.distanceTo(player.pos);
    if (d < bd) { bd = d; best = f; }
  }
  if (best) {
    const sp = SPECIALS[best.cfg.id];
    setActions('char:' + best.cfg.id, [
      { label: '💬 Talk', fn: talkTo, target: best },
      { label: '✋ High five', fn: highFive, target: best },
      { label: sp.label, fn: sp.fn, target: best },
    ]);
    return;
  }
  for (const o of objectActions) {
    if (o.near(player.pos)) { setActions('obj:' + o.key, [o]); return; }
  }
  setActions('none', []);
}
function updateActivities(dt, now) {
  if (player.buffT > 0) player.buffT -= dt;
  // trampoline auto-bounce
  if (player.grounded && Math.hypot(player.pos.x - TRAMP.x, player.pos.z - TRAMP.z) < TRAMP.r) {
    player.vy = 12.5;
    boing();
    ach.bounceStreak++;
    if (ach.bounceStreak >= 5) award('bounce');
  } else if (player.grounded) ach.bounceStreak = 0;
  for (const f of family) { // wandering kids bounce too
    if (f !== player && f.grounded && Math.hypot(f.pos.x - TRAMP.x, f.pos.z - TRAMP.z) < TRAMP.r) f.vy = 8;
    if (f.danceT > 0) { // dance party!
      f.danceT -= dt;
      f.group.rotation.y = f.heading + f.danceT * 9;
      if (f.grounded) f.vy = 3.5;
    }
  }
  // Faylen piggyback ride
  const fay = family[5];
  if (fay.riding > 0) {
    fay.riding -= dt;
    fay.pos.set(player.pos.x, player.pos.y + player.cfg.h * 0.78, player.pos.z - Math.cos(player.heading) * 0.1);
    fay.heading = player.heading;
    fay.group.rotation.y = player.heading;
    fay.walkT += dt * 6;
    fay.parts.lArm.rotation.x = -2.8; fay.parts.rArm.rotation.x = -2.8; // arms up, wheee
    if (fay.riding <= 0) {
      fay.pos.y = 0;
      say(fay, 'Again! AGAIN!', 2.5);
    }
  }
  // golden slug
  if (!goldenFound && player.pos.distanceTo(goldenSlug.position) < 1.4) {
    goldenFound = true;
    scene.remove(goldenSlug);
    score += 25;
    award('golden');
    throwConfetti(player.pos);
    say(player, 'GREG?! THE Greg?! The legends were true!', 3.5);
  }
  goldenSlug.rotation.y += dt * 0.5;
  // flame flicker
  const fl = 0.85 + Math.sin(now * 0.02) * 0.1 + Math.sin(now * 0.047) * 0.08;
  flame.scale.set(fl, fl * (1 + Math.sin(now * 0.031) * 0.15), fl);
  flame2.scale.copy(flame.scale);
  fireLight.intensity = 0.7 + Math.sin(now * 0.023) * 0.25;
  updateBall(dt);
  updateDeer(dt);
  updateStones(dt);
  updateRace(dt);
  updateTag(dt);
  updateInteractions();
}

// ---------- Missions ----------
let round = 1, score = 0, missionIdx = -1, mission = null, missionDone = false, doneTimer = 0;
const items = []; // active pickups
function clearItems() { for (const it of items) scene.remove(it.g); items.length = 0; }
function setHUD(title, desc, prog) {
  document.getElementById('mtitle').textContent = title;
  document.getElementById('mdesc').textContent = desc;
  document.getElementById('mprog').textContent = prog;
  document.getElementById('score').textContent = '⭐ ' + score;
}

const MISSIONS = [
  { // --- Slug Patrol ---
    title: '🐌 Slug Patrol',
    init() {
      this.need = 6 + round * 2; this.got = 0;
      for (let i = 0; i < this.need; i++) {
        const g = makeSlug();
        g.position.copy(clearSpot(5, 38, 0.5));
        g.rotation.y = rand(0, Math.PI * 2);
        scene.add(g);
        items.push({ g, kind: 'slug', wob: rand(0, 9) });
      }
      toast('🐌 Banana slugs are invading the yard! Round ’em up!', 4);
    },
    desc: () => 'Banana slugs everywhere! Walk into them to scoop them up (gently).',
    prog() { return `Slugs rescued: ${this.got} / ${this.need}`; },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.wob += dt;
        it.g.position.x += Math.sin(it.wob * 0.8) * 0.1 * dt;
        it.g.children[0].scale.z = 2.1 + Math.sin(it.wob * 3) * 0.25;
        if (player.pos.distanceTo(it.g.position) < 1.1) {
          scene.remove(it.g); items.splice(i, 1);
          this.got++; score += 5; blip();
          if (Math.random() < 0.3) say(player, ['Gotcha, slimy buddy!', 'Ew ew ew ew ok got it.', 'This one’s named Greg.', 'So. Much. Slime.'][Math.floor(rand(0, 4))], 2);
        }
      }
      return this.got >= this.need;
    },
    doneText: 'All slugs relocated to the Slug Sanctuary (a bucket)! 🐌🏆',
  },
  { // --- Toy Tornado ---
    title: '🧸 Toy Tornado',
    init() {
      this.need = 8 + round * 2; this.got = 0; this.legoHit = false;
      const toyColors = [0xff5a5a, 0x6bb8ff, 0xffd166, 0x7ee08a, 0xd9a3ff];
      for (let i = 0; i < this.need; i++) {
        const g = new THREE.Group();
        const isLego = i === 0;
        if (isLego) {
          const b = box(0.3, 0.18, 0.5, 0xd8442e, 0, 0.09, 0, g);
          for (let s = 0; s < 4; s++) cyl(0.06, 0.06, 0.06, 0xd8442e, (s % 2) * 0.16 - 0.08, 0.21, Math.floor(s / 2) * 0.24 - 0.12, g, 8);
        } else if (i % 3 === 0) {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(toyColors[i % 5]));
          ball.position.y = 0.22; ball.castShadow = true; g.add(ball);
        } else if (i % 3 === 1) {
          box(0.35, 0.35, 0.35, toyColors[i % 5], 0, 0.18, 0, g);
        } else {
          const duck = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0xffd166));
          duck.position.y = 0.18; g.add(duck);
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0xffd166));
          head.position.set(0, 0.38, 0.12); g.add(head);
          box(0.08, 0.05, 0.12, 0xff8c42, 0, 0.36, 0.26, g);
        }
        g.position.copy(clearSpot(4, 28, 0.5));
        scene.add(g);
        items.push({ g, kind: isLego ? 'lego' : 'toy' });
      }
      toast('🧸 Rowan & Faylen struck again! Pick up the toys before someone steps on a LEGO!', 4.5);
    },
    desc: () => 'The yard is a toy minefield. Grab them all — and beware The LEGO.',
    prog() { return `Toys picked up: ${this.got} / ${this.need}`; },
    update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.g.rotation.y += dt;
        if (player.pos.distanceTo(it.g.position) < 1.0) {
          scene.remove(it.g); items.splice(i, 1);
          this.got++; score += 5;
          if (it.kind === 'lego' && player.grounded) {
            owSound(); player.vy = 7;
            say(player, 'OW OW OW — A LEGO! BAREFOOT! WHY!! 🦶💥', 3.5);
            toast('💥 Critical LEGO damage! (+5 sympathy points)', 3);
            score += 5;
          } else blip();
        }
      }
      return this.got >= this.need;
    },
    doneText: 'Yard secured! Not a single LEGO left behind. 🧸✨',
  },
  { // --- Dinner Time ---
    title: '🍝 Dinner Time!',
    init() {
      this.tagged = 0;
      for (const k of kids) { k.tagged = false; k.home = false; k.flee = true; }
      toast('🍝 Dinner’s ready! Play as a parent and CATCH those kids!', 4.5);
    },
    desc() {
      if (player !== eric && player !== jessy) return '⚠️ You need parent powers! Tap Eric or Jessy in the corner to switch!';
      return 'The kids scattered! Chase them down and tag them for dinner. They are FAST.';
    },
    prog() { return `Kids caught: ${this.tagged} / 4`; },
    update(dt) {
      if (player !== eric && player !== jessy) return false;
      for (const k of kids) {
        if (!k.tagged && player.pos.distanceTo(k.pos) < 1.5) {
          k.tagged = true; k.flee = false; k.home = true; this.tagged++;
          score += 10; blip();
          say(k, ['Fiiiine. I’m hungry anyway.', 'You got lucky!!', 'Only because it’s pasta night!', 'Carry me!!'][Math.floor(rand(0, 4))], 3);
          k.group.position.set(-8 + rand(-1.5, 1.5), 0, -16.2); // waiting by the porch
          k.pos.copy(k.group.position);
        }
      }
      return this.tagged >= 4;
    },
    cleanup() { for (const k of kids) { k.flee = false; k.home = false; k.tagged = false; } },
    doneText: 'All four kids captured — er, seated for dinner! Spaghetti for the win! 🍝',
  },
  { // --- Coffee Emergency ---
    title: '☕ Coffee Emergency',
    init() {
      this.delivered = 0;
      this.parentsNeeding = new Set(['eric', 'jessy']);
      for (const spot of [[-6.2, -16.6], [-9.8, -16.6]]) {
        const g = new THREE.Group();
        cyl(0.16, 0.13, 0.24, 0xfdf6ec, 0, 0.12, 0, g, 10);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10), mat(0xfdf6ec));
        handle.position.set(0.18, 0.12, 0); g.add(handle);
        cyl(0.13, 0.13, 0.03, 0x4a2e1a, 0, 0.24, 0, g, 10); // coffee!
        g.position.set(spot[0], 0.35, spot[1]);
        scene.add(g);
        items.push({ g, kind: 'coffee', taken: false });
      }
      toast('☕ RED ALERT: The parents ran out of coffee! Play as a kid and deliver mugs from the porch!', 5);
    },
    desc() {
      if (player === eric || player === jessy) return '⚠️ Parents are too under-caffeinated to walk. Switch to a kid (tap a portrait)!';
      if (player.carrying) return 'You have the precious cargo! Deliver it to a coffee-less parent. DO NOT SPILL.';
      return 'Grab a mug from the front porch and run it to Eric and Jessy!';
    },
    prog() { return `Coffees delivered: ${this.delivered} / 2`; },
    update(dt) {
      if (player === eric || player === jessy) return false;
      // pick up a mug
      if (!player.carrying) {
        for (const it of items) {
          if (!it.taken && player.pos.distanceTo(it.g.position) < 1.1) {
            it.taken = true;
            player.carrying = it.g;
            blip();
            say(player, 'Precious cargo acquired! ☕', 2);
            break;
          }
        }
      }
      // carry it in the right hand
      if (player.carrying) {
        const hand = player.parts.rArm;
        hand.getWorldPosition(v3);
        player.carrying.position.set(v3.x, v3.y - player.cfg.h * 0.3, v3.z);
        player.carrying.rotation.y = player.heading;
        // deliver
        for (const p of [eric, jessy]) {
          if (this.parentsNeeding.has(p.cfg.id) && player.pos.distanceTo(p.pos) < 1.8) {
            this.parentsNeeding.delete(p.cfg.id);
            scene.remove(player.carrying);
            player.carrying = null;
            this.delivered++; score += 15; fanfare();
            say(p, p === eric ? 'MY HERO. Dad power: restored. ☕⚡' : 'Bless you, tiny barista. ☕💛', 3.5);
            break;
          }
        }
      }
      return this.delivered >= 2;
    },
    cleanup() { if (player && player.carrying) { scene.remove(player.carrying); player.carrying = null; } },
    doneText: 'Caffeine levels restored. The parents can parent again! ☕🎉',
  },
  { // --- Forest Cup ---
    title: '⚽ Forest Cup',
    init() {
      this.goals = 0; this.need = 1 + round;
      ballReset();
      const self = this;
      onGoalScored = () => { self.goals++; };
      toast('⚽ THE FOREST CUP! Kick the ball into the white goal on the west side of the yard!', 4.5);
    },
    desc: () => 'Run into the ball to kick it (running kicks are stronger). Aim for the white goal by the trees!',
    prog() { return `Goals: ${this.goals} / ${this.need}`; },
    update(dt) { return this.goals >= this.need; },
    cleanup() { onGoalScored = null; },
    doneText: 'Forest Cup CHAMPION! The redwoods sway in celebration! ⚽🏆',
  },
];

function startMission(idx) {
  clearItems();
  if (mission && mission.cleanup) mission.cleanup();
  missionIdx = idx;
  mission = MISSIONS[idx];
  missionDone = false;
  mission.init();
}
function updateMission(dt) {
  if (!mission) return;
  if (missionDone) {
    doneTimer -= dt;
    if (doneTimer <= 0) {
      const next = missionIdx + 1;
      if (next >= MISSIONS.length) {
        round++;
        tada();
        toast(`🏆 ROUND ${round - 1} COMPLETE! Family chaos level: MAXIMUM. It gets harder now…`, 5);
        setTimeout(() => startMission(0), 1200);
        mission = null;
        setHUD('🏆 Chaos Managed!', 'Catch your breath… more chaos incoming!', '');
        return;
      }
      startMission(next);
    }
    return;
  }
  const done = mission.update(dt);
  setHUD(mission.title, typeof mission.desc === 'function' ? mission.desc() : mission.desc, mission.prog());
  if (done) {
    missionDone = true;
    doneTimer = 3.5;
    score += 20;
    fanfare();
    throwConfetti(player.pos);
    toast('✅ ' + mission.doneText, 3.5);
    clearItems();
  }
}

// ---------- Character switching ----------
const SWITCH_LINES = {
  eric: 'Dad has entered the chat. Somebody hide the thermostat.',
  jessy: 'Mom mode: ON. I see everything. EVERYTHING.',
  liam: 'Liam time! Try to keep up. You won’t.',
  maddie: 'Finally, someone competent takes over.',
  rowan: 'ROWAN SMASH!! I mean… Rowan help!',
  faylen: 'goo goo ga— just kidding. Let’s cause problems.',
};
function switchTo(i) {
  const ch = family[i];
  if (!ch || ch === player) return;
  if (mission && mission.cleanup && player && player.carrying) mission.cleanup();
  if (player) player.flee = false;
  player = ch;
  player.home = false;
  say(player, SWITCH_LINES[player.cfg.id], 3);
  document.querySelectorAll('#portraits button').forEach((b, bi) => b.classList.toggle('active', bi === i));
}

// portraits UI
const portraitsEl = document.getElementById('portraits');
CHARS.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'ui';
  b.style.borderColor = c.labelColor;
  b.innerHTML = `<span style="color:${c.labelColor}">${c.name[0]}</span>`;
  b.title = c.name;
  b.addEventListener('click', () => { initAudio(); switchTo(i); });
  portraitsEl.appendChild(b);
});

// ---------- Intro screen ----------
const intro = document.getElementById('intro');
const cardsEl = document.getElementById('cards');
CHARS.forEach((c, i) => {
  const card = document.createElement('button');
  card.className = 'card';
  card.innerHTML = `<div class="cname" style="color:${c.labelColor}">${c.name}</div><div class="ctag">${c.tag}</div>`;
  card.addEventListener('click', () => {
    initAudio();
    switchTo(i);
    intro.style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    startMission(0);
    tada();
  });
  cardsEl.appendChild(card);
});

// ---------- Camera ----------
function updateCamera(dt) {
  const target = player ? player.pos : new THREE.Vector3(0, 0, -5);
  const ideal = new THREE.Vector3(
    target.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist,
    target.y + 1.2 + Math.sin(camPitch) * camDist,
    target.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist
  );
  camera.position.lerp(ideal, Math.min(1, dt * 6));
  v3.set(target.x, target.y + (player ? player.cfg.h * 0.8 : 1.5), target.z);
  camera.lookAt(v3);
}
camera.position.set(0, 8, 14);
camera.lookAt(0, 2, -10);

// ---------- Main loop ----------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (player) {
    // gather input
    let ix = touch.vx, iz = touch.vz;
    if (keys.KeyW || keys.ArrowUp) iz -= 1;
    if (keys.KeyS || keys.ArrowDown) iz += 1;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1;
    if (keys.KeyD || keys.ArrowRight) ix += 1;
    if (keys.Space) { if (player.grounded) { player.vy = player.cfg.jump; boing(); } }
    const run = keys.ShiftLeft || keys.ShiftRight || touch.run;
    // rotate input by camera yaw (forward = away from camera)
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const dx = ix * cos + iz * sin;
    const dz = -ix * sin + iz * cos;
    let spd = player.cfg.speed * (run ? 1.55 : 1);
    if (player.buffT > 0) spd *= 1.3;            // snack power
    if (family[5].riding > 0) spd *= 0.9;        // carrying Faylen
    moveChar(player, dx, dz, dt, spd);

    for (const ch of family) if (ch !== player) updateAI(ch, dt);
    updateActivities(dt, now);
    updateMission(dt);
    randomQuips(dt);
    dadJokes(dt);
  }
  updateSquirrel(dt);
  updateTrain(dt);
  updateAmbience(dt, now);
  updateConfetti(dt);
  updateBubbles(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// tiny hook for automated tests
window.__test = { setCam(y, p, d) { camYaw = y; camPitch = p; camDist = d; }, switchTo, family };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
})();
