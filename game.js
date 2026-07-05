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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.Fog(0xb7d4c8, 40, 150);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

// Lights — dappled forest afternoon
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2e4226, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffedc9, 1.35);
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

// ---------- Ground, road, driveway ----------
const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), mat(0x4a6138));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
// dirt patches
for (let i = 0; i < 26; i++) {
  const p = new THREE.Mesh(new THREE.CircleGeometry(rand(1.5, 5), 10), mat(Math.random() < 0.5 ? 0x5d5138 : 0x42552f));
  p.rotation.x = -Math.PI / 2;
  p.position.set(rand(-80, 80), 0.02, rand(-80, 80));
  p.receiveShadow = true;
  scene.add(p);
}
// road along the front
const road = box(140, 0.1, 7, 0x3c3c40, 0, 0.03, 13);
road.castShadow = false;
// driveway from garage to road
const drive = box(15, 0.1, 28, 0x4b4b50, 8, 0.04, -4);
drive.castShadow = false;
// paver path to the front door
for (let i = 0; i < 7; i++) box(1.1, 0.08, 0.8, 0x9a8f7d, -8 + Math.sin(i * 0.7) * 0.4, 0.06, -16.6 + i * 1.35);

// ---------- The Fisch House (brown/red chalet, twin gables, 2-car garage) ----------
const WALL = 0x743828, TRIM = 0x3d251b, ROOFC = 0x4e3a2c, DOORC = 0x33221a;
function gableHouse(cx, cz, w, d, wallH, roofH) {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  scene.add(g);
  box(w, wallH, d, WALL, 0, wallH / 2, 0, g);
  // gable triangles (front & back), gable faces +z
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, roofH); tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.3, bevelEnabled: false });
  const front = new THREE.Mesh(triGeo, mat(WALL));
  front.position.set(0, wallH, d / 2 - 0.3); front.castShadow = true; g.add(front);
  const back = front.clone(); back.position.z = -d / 2; g.add(back);
  // roof slabs
  const slope = Math.atan2(roofH, w / 2);
  const slabLen = Math.hypot(w / 2, roofH) + 0.6;
  const rl = box(slabLen, 0.25, d + 1.2, ROOFC, 0, 0, 0, g);
  rl.rotation.z = slope;
  rl.position.set(-w / 4, wallH + roofH / 2 + 0.1, 0);
  const rr = box(slabLen, 0.25, d + 1.2, ROOFC, 0, 0, 0, g);
  rr.rotation.z = -slope;
  rr.position.set(w / 4, wallH + roofH / 2 + 0.1, 0);
  // corner trim
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    box(0.3, wallH, 0.3, TRIM, sx * (w / 2 - 0.1), wallH / 2, sz * (d / 2 - 0.1), g);
  return g;
}
function windowPane(parent, x, y, z, w, h) {
  box(w + 0.24, h + 0.24, 0.12, TRIM, x, y, z, parent);
  const glass = box(w, h, 0.14, 0x243542, x, y, z + 0.02, parent);
  glass.material = mat(0x2e4a5c, { emissive: 0x1a2c38 });
}
// Left: main house
const houseL = gableHouse(-8, -23, 12, 9, 5.5, 3);
windowPane(houseL, -3, 3.6, 4.62, 1.6, 1.8);
windowPane(houseL, 3, 3.6, 4.62, 1.6, 1.8);
windowPane(houseL, 0, 6.4, 4.62, 1.4, 1.2); // gable window
// front door + porch + steps
box(1.4, 2.5, 0.15, DOORC, 0, 1.25, 4.58, houseL);
box(0.25, 0.25, 0.25, 0xc9a227, 0.45, 1.25, 4.7, houseL); // doorknob... fancy
box(4, 0.3, 2.2, 0x6b4a30, 0, 0.15, 5.6, houseL); // porch
box(3, 0.2, 0.9, 0x6b4a30, 0, 0.05, 7.0, houseL); // step
// metal chimney
cyl(0.25, 0.25, 2.2, 0x8f9499, -3, 9.2, -23 - 1, null, 10);
// Right: garage with two doors
const garage = gableHouse(8, -23, 12, 9, 5, 2.6);
box(3.6, 3.1, 0.2, DOORC, -2.6, 1.55, 4.6, garage);
box(3.6, 3.1, 0.2, DOORC, 2.6, 1.55, 4.6, garage);
for (const gx of [-2.6, 2.6]) for (let i = 0; i < 3; i++)
  box(3.2, 0.08, 0.06, 0x5a4534, gx, 0.8 + i * 0.85, 4.72, garage);
windowPane(garage, -2, 6, 4.62, 1.3, 1.4);
windowPane(garage, 2, 6, 4.62, 1.3, 1.4);
// half-timber diagonals on the garage gable
for (const s of [-1, 1]) {
  const t = box(0.22, 3.4, 0.1, TRIM, s * 3.4, 6.1, 4.66, garage);
  t.rotation.z = s * 0.7;
}
// Middle connector with the deck bridge
box(4, 4, 6.5, WALL, 0, 2, -23);
box(4.6, 0.3, 7, 0x6b4a30, 0, 4.15, -23);
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
for (let i = 0; i < 9; i++) box(0.15, 1.7, 1.9, 0x7a4f33, 15.5, 0.85, -18 + i * 2);
addBoxCollider(15.2, 15.8, -19, 0.5);

// Mailbox at the end of the driveway
box(0.12, 1.1, 0.12, 0x333333, 3.5, 0.55, 8.5);
box(0.5, 0.4, 0.7, 0x2f4f6f, 3.5, 1.3, 8.5);
addCircleCollider(3.5, 8.5, 0.4);

// "SANTA CRUZ REDWOODS" sign, RV-resort style
(function sign() {
  const g = new THREE.Group(); g.position.set(-24, 0, 9); g.rotation.y = 0.5; scene.add(g);
  box(0.2, 2.2, 0.2, 0x5a4534, -1.4, 1.1, 0, g); box(0.2, 2.2, 0.2, 0x5a4534, 1.4, 1.1, 0, g);
  box(3.4, 1.1, 0.15, 0x3f5a3a, 0, 2.2, 0, g);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 84;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#3f5a3a'; cx.fillRect(0, 0, 256, 84);
  cx.fillStyle = '#f7e9b8'; cx.font = 'bold 30px Georgia'; cx.textAlign = 'center';
  cx.fillText('WELCOME TO', 128, 34); cx.fillText('FELTON, CA', 128, 68);
  const tex = new THREE.CanvasTexture(cv);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshBasicMaterial({ map: tex }));
  p.position.set(0, 2.2, 0.09); g.add(p);
  addCircleCollider(-24, 9, 1.2);
})();

// ---------- Redwood forest ----------
const foliageMat = mat(0x2e4a2b), foliageMat2 = mat(0x3a5c33), trunkMat = mat(0x6e3f2a);
function redwood(x, z, s) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * s, 0.9 * s, 16 * s, 7), trunkMat);
  trunk.position.y = 8 * s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const r = (4.2 - i * 0.85) * s;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 5.5 * s, 7), i % 2 ? foliageMat : foliageMat2);
    cone.position.y = (8 + i * 3.4) * s;
    cone.castShadow = true;
    g.add(cone);
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
  const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 1.1), 7, 6), mat(0x3f6134));
  b.position.set(p.x, 0.4, p.z); b.castShadow = true; scene.add(b);
}
// front-yard trees like the photo
for (const [x, z] of [[-4, -13], [-11, -12]]) {
  const t = cyl(0.15, 0.22, 1.6, 0x6e4a30, x, 0.8, z);
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 7), mat(0x5d7a3a));
  c.position.set(x, 2.4, z); c.castShadow = true; scene.add(c);
  addCircleCollider(x, z, 0.5);
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
  { id: 'jessy', name: 'Jessy', h: 1.7, skin: 0xe8b48f, shirt: 0xf26f21, sleeve: 0xf26f21, pants: 0x35507a, hair: 0x5a3d28, eyes: 0x7aa05c, style: 'long', lips: 0xc96a7a, labelColor: '#ff9f6b', speed: 6.9, jump: 7.2,
    tag: 'Mom · Can hear a snack wrapper from 3 rooms away',
    quips: ['I found a banana slug in someone’s shoe. AGAIN.', 'If it’s quiet for more than 2 minutes, I panic.', 'Yes I counted the kids. Twice. We still have four.', 'Whoever drew on the wall… nice shading, but NO.'] },
  { id: 'liam',  name: 'Liam',  h: 1.52, skin: 0xd9a173, shirt: 0x2f8f4e, sleeve: 0x2f8f4e, pants: 0x39506b, hair: 0x3c2a1a, eyes: 0x4a3520, style: 'short', headScale: 1.08, labelColor: '#7ee08a', speed: 7.6, jump: 7.6,
    tag: 'Age 12 · Master of "five more minutes"',
    quips: ['Five more minutes. FIVE. That’s basically nothing.', 'I’m not running, I’m speed-walking competitively.', 'Maddie started it.', 'Can we have pizza? Asking for me.'] },
  { id: 'maddie', name: 'Maddie', h: 1.48, skin: 0xe3ab80, shirt: 0x9b5bb5, sleeve: 0x9b5bb5, pants: 0x3a3a4a, hair: 0x4a301a, eyes: 0x55702f, style: 'ponytail', headScale: 1.08, labelColor: '#d9a3ff', speed: 7.3, jump: 7.4,
    tag: 'Age 11 · CEO of Sass, secretly in charge',
    quips: ['Liam started it.', 'I’m not bossy, I just have better ideas.', 'Technically, I’m the favorite. It’s just science.', 'Did someone say SNACKS?'] },
  { id: 'rowan', name: 'Rowan', h: 1.05, skin: 0xdda278, shirt: 0xd8442e, sleeve: 0xd8442e, pants: 0x4a6b8a, hair: 0x5a3d22, eyes: 0x4a3520, style: 'wild', headScale: 1.22, labelColor: '#ff8a7a', speed: 7.0, jump: 6.8,
    tag: 'Age 4 · ZOOMIES incarnate. Do not feed sugar.',
    quips: ['ZOOOOOOMIES!!!', 'I’m NOT tired!! *falls asleep standing*', 'Watch this!! (nobody watch this)', 'The slug is my best friend now. His name is Greg.'] },
  { id: 'faylen', name: 'Faylen', h: 0.78, skin: 0xecb894, shirt: 0xf2a5c0, sleeve: 0xf2a5c0, pants: 0xf2a5c0, hair: 0x6b4a2e, eyes: 0x5d7a4a, style: 'pigtails', headScale: 1.34, labelColor: '#ffc0dd', speed: 4.8, jump: 6.0,
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
let AC = null, muted = false;
function initAudio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); }
function tone(freq, dur, type, vol, when) {
  if (!AC || muted) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.08, AC.currentTime + (when || 0));
  g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + (when || 0) + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(AC.currentTime + (when || 0)); o.stop(AC.currentTime + (when || 0) + dur + 0.02);
}
function blip() { tone(880, 0.09, 'square', 0.06); tone(1320, 0.12, 'square', 0.05, 0.07); }
function boing() { tone(220, 0.18, 'sine', 0.1); tone(440, 0.1, 'sine', 0.06, 0.05); }
function owSound() { tone(180, 0.3, 'sawtooth', 0.1); tone(140, 0.35, 'sawtooth', 0.08, 0.1); }
function fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.13)); }
function tada() { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, i * 0.09)); }
function toggleMute() { muted = !muted; document.getElementById('mute').textContent = muted ? '🔇' : '🔊'; }
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
  if (ch.home) { moveChar(ch, 0, 0, dt, 0); return; }
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
    moveChar(player, dx, dz, dt, player.cfg.speed * (run ? 1.55 : 1));

    for (const ch of family) if (ch !== player) updateAI(ch, dt);
    updateMission(dt);
    randomQuips(dt);
    dadJokes(dt);
  }
  updateSquirrel(dt);
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
