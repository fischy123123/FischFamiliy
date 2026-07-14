/* ============================================================
   FISCH FAMILY: FOREST CHAOS
   A 3D family game set at the Fisch house in Felton, CA
   Eric · Jessy · Liam · Maddie · Rowan · Faylen
   ============================================================ */
(function () {
'use strict';

// ---------- Basic setup ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0; // tuned for sRGB-decoded surface textures
const FINE = matchMedia('(pointer: fine)').matches; // desktops get the max-quality tier
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.Fog(0xb5c8b2, 60, 240); // valley haze

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);

// cinematic post pipeline: real bloom + film grade + FXAA on the GPU (graceful fallback)
let composer = null, bloomPass = null, fxaaPass = null, gradePass = null;
function fitFXAA() {
  if (!fxaaPass) return;
  const pr = Math.min(window.devicePixelRatio || 1, FINE ? 2 : 1.75);
  fxaaPass.uniforms.resolution.value.set(1 / (window.innerWidth * pr), 1 / (window.innerHeight * pr));
}
(function postFX() {
  if (!THREE.EffectComposer || !THREE.UnrealBloomPass || !THREE.ShaderPass) return;
  composer = new THREE.EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, FINE ? 2 : 1.75));
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.22, 0.55, 0.8);
  composer.addPass(bloom);
  bloomPass = bloom;
  const grade = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uTime;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime) * 43758.5453); }',
      'void main(){',
      '  float d = distance(vUv, vec2(0.5));',
      // whisper of chromatic aberration, growing toward the edges (lens feel)
      '  vec2 off = (vUv - 0.5) * d * 0.0035;',
      '  vec4 c = texture2D(tDiffuse, vUv);',
      '  c.r = texture2D(tDiffuse, vUv - off).r;',
      '  c.b = texture2D(tDiffuse, vUv + off).b;',
      '  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));',
      '  c.rgb = mix(vec3(l), c.rgb, 1.17);',                    // saturation
      // filmic S-curve: deeper shadows, protected highlights
      '  c.rgb = c.rgb * c.rgb * (3.0 - 2.0 * c.rgb) * 0.55 + c.rgb * 0.45;',
      // split tone: teal whisper in shadows, golden warmth in highlights
      '  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));',
      '  c.rgb += (1.0 - smoothstep(0.0, 0.45, lum)) * vec3(-0.012, 0.006, 0.016);',
      '  c.rgb += smoothstep(0.55, 1.0, lum) * vec3(0.02, 0.012, -0.008);',
      '  c.rgb *= 1.0 - smoothstep(0.45, 0.9, d) * 0.3;',        // vignette
      '  c.rgb = pow(max(c.rgb, 0.0), vec3(0.4545));',           // linear -> sRGB
      '  c.rgb += (hash(vUv * 640.0) - 0.5) * 0.018;',           // fine animated film grain
      '  gl_FragColor = c;',
      '}',
    ].join('\n'),
  });
  composer.addPass(grade);
  gradePass = grade;
  // composer renders to offscreen targets, so the canvas's MSAA never applies —
  // FXAA as the final pass brings antialiasing back
  if (THREE.FXAAShader) {
    fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
    composer.addPass(fxaaPass);
    fitFXAA();
  }
})();

// Lights — dappled forest afternoon
const hemi = new THREE.HemisphereLight(0x9fc2e6, 0x27381f, 0.48);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9a0, 1.5);
sun.position.set(35, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(FINE ? 4096 : 2048, FINE ? 4096 : 2048);
// tight frustum that follows the player — far crisper than one map stretched over the whole valley
sun.shadow.camera.left = -46; sun.shadow.camera.right = 46;
sun.shadow.camera.top = 46; sun.shadow.camera.bottom = -46;
sun.shadow.camera.far = 280;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

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
  tex.encoding = THREE.sRGBEncoding; // painted colors are sRGB — without this every surface washes out pale
  tex.anisotropy = MAX_ANISO;        // keeps roads/ground sharp at grazing angles
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
  c.fillStyle = '#3a4526'; c.fillRect(0, 0, w, h); // duff-blended forest floor, not lawn
  speckle(c, w, h, ['#33401d', '#465530', '#513f27', '#2c391b', '#55663a', '#41321d', '#5c6c3c', '#4e3f27'], 1100, 2, 9);
  speckle(c, w, h, ['#263214', '#657543'], 280, 0.5, 2);
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
// River Ln itself: pale, sun-bleached, alligator-cracked pavement (straight from the street view)
const crackedTex = canvasTex(256, 512, (c, w, h) => {
  c.fillStyle = '#8d8a80'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#9b988c', '#7e7b71', '#a6a396', '#6f6c63'], 900, 1.5, 6);
  // dark repair patches
  for (let i = 0; i < 7; i++) {
    c.fillStyle = '#54565a'; c.globalAlpha = rand(0.35, 0.6);
    c.beginPath();
    c.ellipse(rand(0, w), rand(0, h), rand(14, 46), rand(10, 30), rand(0, 3), 0, 7);
    c.fill();
  }
  c.globalAlpha = 1;
  // alligator crack web
  c.strokeStyle = '#57544b'; c.lineWidth = 1.6; c.globalAlpha = 0.8;
  for (let i = 0; i < 90; i++) {
    let x = rand(0, w), y = rand(0, h);
    c.beginPath(); c.moveTo(x, y);
    for (let s2 = 0; s2 < 4; s2++) { x += rand(-16, 16); y += rand(-16, 16); c.lineTo(x, y); }
    c.stroke();
  }
  // long longitudinal cracks
  c.lineWidth = 2; c.globalAlpha = 0.6; c.strokeStyle = '#5d5a50';
  for (let i = 0; i < 5; i++) {
    let x = rand(w * 0.15, w * 0.85), y = 0;
    c.beginPath(); c.moveTo(x, y);
    while (y < h) { x += rand(-10, 10); y += rand(24, 50); c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 0.5; // redwood-needle debris drifting in from the shoulders
  speckle(c, w * 0.14, h, ['#7a5c3a', '#5d452c'], 160, 0.6, 2.4);
  c.save(); c.translate(w, 0); c.scale(-1, 1);
  speckle(c, w * 0.14, h, ['#7a5c3a', '#5d452c'], 160, 0.6, 2.4);
  c.restore();
  c.globalAlpha = 1;
}, 1, 8);
// Hwy 9: darker two-lane blacktop with a dashed yellow centerline + white fog lines
const hwyTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#393b40'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#46484e', '#2f3034', '#515358', '#26272b'], 1200, 0.5, 2.5);
  c.strokeStyle = '#2c2d31'; c.globalAlpha = 0.6;
  for (let i = 0; i < 6; i++) {
    let x = rand(0, w), y = rand(0, h);
    c.beginPath(); c.moveTo(x, y);
    for (let s2 = 0; s2 < 4; s2++) { x += rand(-14, 14); y += rand(6, 18); c.lineTo(x, y); }
    c.stroke();
  }
  c.globalAlpha = 0.9;
  c.fillStyle = '#d8b23a'; c.fillRect(0, h / 2 - 4, w * 0.62, 3.4); // dashed double yellow
  c.fillRect(0, h / 2 + 1, w * 0.62, 3.4);
  c.fillStyle = '#cfd2d4'; // fog lines
  c.fillRect(0, 14, w, 3); c.fillRect(0, h - 17, w, 3);
  c.globalAlpha = 1;
}, 16, 1);
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

// Contact-shadow blobs (instanced later, for grounding objects like real AO)
const blobs = []; // {x, z, r}
// registries for drop-in GLB replacement (see assets/README.md)
const treeReg = [];   // every redwood
const rockReg = [];   // every rock/boulder
const foliageRef = {};
const grassRef = {};
// ---- Act I state: day/night, driving, swimming, riding ----
const dayNight = { t: 0.42, override: null, dayF: 1, nightF: 0 };
const nightBulbMats = []; // emissive bulb materials that brighten after dark
const cloudMats = [];
const swimZones = [];     // {x,z,r} circles and {minX,maxX,minZ,maxZ} rects
let domeRef = null, sunGlowRef = null, starsRef = null, firefliesRef = null;
let flashlight = null, porchLight = null;
const photo = { on: false };
const RIDE = { flagged: false, riding: false };
const henryCowell = {}, trainPlatform = {}, nightSky = {}, calendar = {};

// Colliders
const colliders = []; // {type:'box',minX,maxX,minZ,maxZ} | {type:'circle',x,z,r}
function addBoxCollider(minX, maxX, minZ, maxZ) { colliders.push({ type: 'box', minX, maxX, minZ, maxZ }); }
function addCircleCollider(x, z, r) { colliders.push({ type: 'circle', x, z, r }); }
const INT = { on: false };
const INTCOLL = []; // interior walls/furniture: {minX,maxX,minZ,maxZ, minY?,maxY?}
function collideInt(pos, radius) {
  for (const c of INTCOLL) {
    if (c.minY !== undefined && (pos.y < c.minY || pos.y > c.maxY)) continue;
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
function collide(pos, radius) {
  if (pos.x > 270) { collideInt(pos, radius); return; } // indoors: interior walls, no world edge
  for (const c of colliders) {
    if (c.disabled) continue;
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
  // world edge — but let people roam out to Henry Cowell past the river (z > 27)
  const dist = Math.hypot(pos.x, pos.z);
  const edge = pos.z > 27 ? 92 : 82;
  if (dist > edge) { pos.x *= edge / dist; pos.z *= edge / dist; }
}
function spotIsClear(x, z, r) {
  for (const c of colliders) {
    if (c.type === 'circle') { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; }
    else if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return false;
  }
  return true;
}
const HWY9 = { z: -44, halfW: 4.5 };                 // z -48.5 .. -39.5
const LANE = { x: 18.5, halfW: 2.75, z0: -40, z1: 26.5 }; // x 15.75 .. 21.25
function onRoad(x, z, pad) {
  const p = pad || 0;
  if (Math.abs(z - HWY9.z) < HWY9.halfW + p && Math.abs(x) < 78) return true;
  if (Math.abs(x - LANE.x) < LANE.halfW + p && z > LANE.z0 - p && z < LANE.z1 + p) return true;
  if (x > 0 - p && x < 16.5 + p && z > -26.5 - p && z < -18 + p) return true; // driveway apron
  return false;
}
function clearSpot(minR, maxR, r) {
  for (let i = 0; i < 60; i++) {
    const a = rand(0, Math.PI * 2), d = rand(minR, maxR);
    const x = Math.sin(a) * d, z = Math.cos(a) * d - 5;
    if (z < -30) continue;
    if (onRoad(x, z, r)) continue;
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
  domeRef = dome; // tinted through the day/night cycle
})();
// image-based lighting: every PBR surface reflects a sky/forest/sun environment
(function environmentLight() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const sky2 = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 12), new THREE.MeshBasicMaterial({ color: 0x8db8de, side: THREE.BackSide }));
  env.add(sky2);
  const gr = new THREE.Mesh(new THREE.CircleGeometry(46, 24), new THREE.MeshBasicMaterial({ color: 0x2c4022 }));
  gr.rotation.x = -Math.PI / 2;
  gr.position.y = -3;
  env.add(gr);
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff0c8 }));
  sunBall.position.set(20, 32, 12);
  env.add(sunBall);
  scene.environment = pmrem.fromScene(env, 0.08).texture;
  pmrem.dispose();
})();
const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48),
  new THREE.MeshStandardMaterial({ map: groundTex, bumpMap: groundTex, bumpScale: 0.07, roughness: 1, metalness: 0 }));
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
// needle-duff patches under the trees — soft radial edges so they melt into the floor
const duffPatchTex = canvasTex(256, 256, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.save();
  c.beginPath(); c.arc(128, 128, 126, 0, 7); c.clip();
  c.fillStyle = '#5d4b32'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#6d5a3c', '#4a3a26', '#7a6644', '#54422b'], 700, 2, 8);
  c.strokeStyle = '#4a3a26'; c.globalAlpha = 0.5;
  for (let i = 0; i < 160; i++) {
    const x = rand(0, w), y = rand(0, h), a = rand(0, 3);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); c.stroke();
  }
  c.restore();
  c.globalAlpha = 1;
  // feather the rim
  c.globalCompositeOperation = 'destination-in';
  const gr = c.createRadialGradient(128, 128, 40, 128, 128, 126);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.75, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
});
duffPatchTex.repeat.set(1, 1);
const duffMat = new THREE.MeshLambertMaterial({ map: duffPatchTex, transparent: true, depthWrite: false });
for (let i = 0; i < 38; i++) {
  const duffR = rand(2, 7);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(duffR * 2, duffR * 2), duffMat);
  p.rotation.x = -Math.PI / 2;
  p.rotation.z = rand(0, 9);
  let dx2 = rand(-80, 80), dz2 = rand(-80, 80);
  if (onRoad(dx2, dz2, duffR)) { dx2 = rand(30, 70); dz2 = rand(-80, -58); }
  p.position.set(dx2, 0.02, dz2);
  p.receiveShadow = true;
  scene.add(p);
}
// ---- Roads, laid out like the real place: Hwy 9 runs east-west to the south,
// and River Ln is a short cracked dead-end lane running north from it, past the
// house, ending at the San Lorenzo. (See the street view + aerial.)
const paverTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#6e5940'; c.fillRect(0, 0, w, h); // sand joints
  let row = 0;
  for (let y = 0; y < h; y += 24) {
    for (let x = -24; x < w; x += 42) {
      c.fillStyle = ['#8a6a4a', '#7d5c42', '#96775a', '#715234'][Math.floor(rand(0, 4))];
      c.fillRect(x + (row % 2) * 21 + 2, y + 2, 38, 20);
    }
    row++;
  }
  speckle(c, w, h, ['#5c4630', '#a0805c'], 260, 1, 4);
}, 4, 4);
const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, bumpMap: asphaltTex, bumpScale: 0.03, roughness: 0.95, metalness: 0 });
const hwy = box(152, 0.1, HWY9.halfW * 2, 0x3c3c40, 0, 0.03, HWY9.z);
hwy.material = new THREE.MeshStandardMaterial({ map: hwyTex, bumpMap: asphaltTex, bumpScale: 0.02, roughness: 0.95, metalness: 0 });
hwy.castShadow = false;
const lane = box(LANE.halfW * 2, 0.1, LANE.z1 - LANE.z0, 0x9a978c, LANE.x, 0.045, (LANE.z0 + LANE.z1) / 2);
lane.material = new THREE.MeshStandardMaterial({ map: crackedTex, bumpMap: crackedTex, bumpScale: 0.04, roughness: 1, metalness: 0 });
lane.castShadow = false;
// driveway pad from the garage east to the lane
const drive = box(15.5, 0.08, 7.5, 0x4b4b50, 8.25, 0.05, -22.25);
drive.material = asphaltMat;
drive.castShadow = false;
const walkway = box(2.2, 0.07, 6.5, 0xa08464, 2.6, 0.05, -15.2);
walkway.material = new THREE.MeshStandardMaterial({ map: paverTex, bumpMap: paverTex, bumpScale: 0.03, roughness: 0.95, metalness: 0 });
walkway.castShadow = false;
// paver path to the front door
for (let i = 0; i < 7; i++) box(0.8, 0.08, 1.1, 0x9a8f7d, 3.6 + i * 1.35, 0.06, -10.3 + Math.sin(i * 0.7) * 0.4);
// the San Lorenzo River (real layout: house → River Ln → RV resort → river → Henry Cowell)
const water = new THREE.Mesh(new THREE.PlaneGeometry(180, 10), new THREE.MeshPhongMaterial({
  map: waterTex, transparent: true, opacity: 0.94,
  shininess: 55, specular: 0x628c9a,
}));
water.rotation.x = -Math.PI / 2;
water.position.set(0, 0.01, 33);
scene.add(water);
// sun glints riding the current (additive, scrolled against the water drift each frame)
const sparkleTex = canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 130; i++) {
    c.fillStyle = ['#ffffff', '#cfe8f0', '#9fd8e8'][i % 3];
    c.globalAlpha = rand(0.25, 0.9);
    c.fillRect(rand(0, w), rand(0, h), rand(2, 7), 1.2);
  }
  c.globalAlpha = 1;
}, 24, 3);
const sparkleMat = new THREE.MeshBasicMaterial({ map: sparkleTex, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
const riverSparkle = new THREE.Mesh(new THREE.PlaneGeometry(180, 10), sparkleMat);
riverSparkle.rotation.x = -Math.PI / 2;
riverSparkle.position.set(0, 0.055, 33);
scene.add(riverSparkle);
for (const bz of [27.9, 38.1]) { // sandy banks
  const bank = box(180, 0.08, 1.6, 0x8a7a5e, 0, 0.03, bz);
  bank.castShadow = false;
  bank.material = new THREE.MeshLambertMaterial({ map: duffTex, color: 0xc9b896 });
}
const riverRockMat = new THREE.MeshStandardMaterial({ color: 0x7d7b72, map: asphaltTex, bumpMap: asphaltTex, bumpScale: 0.04, roughness: 0.9, metalness: 0, envMapIntensity: 0.3 });
for (let i = 0; i < 16; i++) { // river boulders
  const br = rand(0.3, 0.9);
  const b = new THREE.Mesh(new THREE.SphereGeometry(br, 9, 7), riverRockMat);
  b.scale.y = 0.6;
  b.position.set(rand(-70, 70), 0.1, rand(28, 39));
  b.rotation.y = rand(0, 9);
  b.castShadow = true;
  scene.add(b);
  rockReg.push({ m: b, x: b.position.x, z: b.position.z, r: br });
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
(function signpost() { // fingerpost at the Hwy 9 / River Ln junction
  const g = new THREE.Group(); g.position.set(24.3, 0, -37.6); g.rotation.y = -0.2; scene.add(g);
  cyl(0.07, 0.09, 3.1, 0x5a4534, 0, 1.55, 0, g, 8);
  const entries = [['SANTA CRUZ 7', 1], ['DOWNTOWN FELTON ½', -1], ['ROARING CAMP 1', -1], ['SAN LORENZO RIVER', -1]];
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
  addCircleCollider(24.3, -37.6, 0.35);
})();
// the lane really is a dead end — yellow END diamond where it meets the river
(function deadEnd() {
  cyl(0.05, 0.06, 2.4, 0x7a7d80, 15.6, 1.2, 24.6, null, 8);
  const cv = document.createElement('canvas'); cv.width = cv.height = 96;
  const c = cv.getContext('2d');
  c.translate(48, 48); c.rotate(Math.PI / 4);
  c.fillStyle = '#e8c33a'; c.fillRect(-30, -30, 60, 60);
  c.strokeStyle = '#1d1d1d'; c.lineWidth = 4; c.strokeRect(-27, -27, 54, 54);
  c.rotate(-Math.PI / 4);
  c.fillStyle = '#1d1d1d'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('END', 0, 1);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  p.position.set(15.6, 2.05, 24.6); p.rotation.y = Math.PI; scene.add(p);
  addCircleCollider(15.6, 24.6, 0.25);
  // CA-9 route shields flanking the junction
  function shield(x, z, ry) {
    cyl(0.05, 0.06, 2.6, 0x7a7d80, x, 1.3, z, null, 8);
    const sv = document.createElement('canvas'); sv.width = 96; sv.height = 110;
    const s = sv.getContext('2d');
    s.fillStyle = '#f2f2ee';
    s.beginPath(); // CA miner's-spade shield, simplified
    s.moveTo(10, 8); s.lineTo(86, 8); s.lineTo(86, 60); s.quadraticCurveTo(86, 96, 48, 106); s.quadraticCurveTo(10, 96, 10, 60); s.closePath(); s.fill();
    s.strokeStyle = '#1d5c34'; s.lineWidth = 5; s.stroke();
    s.fillStyle = '#1d5c34'; s.font = 'bold 15px Arial'; s.textAlign = 'center';
    s.fillText('CALIFORNIA', 48, 26);
    s.font = 'bold 48px Arial'; s.fillText('9', 48, 78);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sv), transparent: true }));
    pl.position.set(x, 2.3, z); pl.rotation.y = ry; scene.add(pl);
    addCircleCollider(x, z, 0.2);
  }
  shield(28, -38.6, 0.3);    // for westbound traffic
  shield(-30, -49.4, Math.PI - 0.3); // for eastbound traffic
})();

// ---------- Santa Cruz Redwoods RV Resort (4980 Hwy 9 — right across the lane) ----------
(function rvResort() {
  const pad = box(27, 0.05, 9.5, 0xb9b4a6, 35, 0.03, 22);
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
  rv(26.5, 22.5, 0.12, 0x8a4a32);
  rv(34.5, 21.5, -0.08, 0x3f5a3a);
  rv(42.5, 22.8, 0.2, 0x35507a);
  // picnic table
  (function () {
    const g = new THREE.Group(); g.position.set(30.5, 0, 19.2); g.rotation.y = 0.4; scene.add(g);
    box(1.8, 0.08, 0.8, 0x7a4f33, 0, 0.72, 0, g).material = plankMat;
    for (const s of [-1, 1]) {
      box(1.8, 0.06, 0.3, 0x7a4f33, 0, 0.45, s * 0.62, g).material = plankMat;
      box(0.1, 0.72, 0.9, 0x5e3a22, s * 0.7, 0.36, 0, g);
    }
    addCircleCollider(30.5, 19.2, 1.1);
  })();
  // string lights between two posts
  cyl(0.06, 0.08, 2.6, 0x5a4534, 28, 1.3, 18.2, null, 6);
  cyl(0.06, 0.08, 2.6, 0x5a4534, 38, 1.3, 18.2, null, 6);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const bm = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xc9a24a });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), bm);
    bulb.position.set(28 + t * 10, 2.5 - Math.sin(t * Math.PI) * 0.5, 18.2);
    scene.add(bulb);
    nightBulbMats.push({ m: bm, base: 0xc9a24a, twinkle: rand(0, 9) }); // twinkles after dark
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
  // nobody stands on the tracks — except a level crossing aligned with the bridge (x 18–25)
  addBoxCollider(-95, 18, TZ - 1.2, TZ + 1.2);
  addBoxCollider(25, 95, TZ - 1.2, TZ + 1.2);
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
const WALL = 0x77402e, TRIM = 0x38231a, ROOFC = 0x4e3a2c, DOORC = 0x33221a;
const sidingMat = new THREE.MeshStandardMaterial({ map: sidingTex, bumpMap: sidingTex, bumpScale: 0.05, roughness: 0.95, metalness: 0 });
const shingleMat = new THREE.MeshStandardMaterial({ map: shingleTex, bumpMap: shingleTex, bumpScale: 0.06, roughness: 0.95, metalness: 0 });
const plankMat = new THREE.MeshStandardMaterial({ map: plankTex, bumpMap: plankTex, bumpScale: 0.04, roughness: 0.9, metalness: 0 });
const garageMat = new THREE.MeshStandardMaterial({ map: garageTex, bumpMap: garageTex, bumpScale: 0.05, roughness: 0.9, metalness: 0 });
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
const houseL = gableHouse(-4, -7, 12, 9, 5.5, 3);
houseL.rotation.y = Math.PI / 2; // the house faces its street — River Ln, to the east
windowPane(houseL, 0.5, 3.6, 4.62, 1.6, 1.8);
windowPane(houseL, -3.6, 3.6, 4.62, 1.6, 1.8);
windowPane(houseL, -1.5, 6.4, 4.62, 1.4, 1.2); // gable window
// front door + porch + steps — the entry sits in the notch beside the garage, under the pergola
box(1.4, 2.5, 0.15, DOORC, 4.2, 1.25, 4.58, houseL);
box(0.25, 0.25, 0.25, 0xc9a227, 3.78, 1.25, 4.7, houseL); // doorknob... fancy
// "110" house number plaque by the door
(function houseNumber() {
  const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48;
  const c = cv.getContext('2d');
  c.fillStyle = '#2c1c12'; c.fillRect(0, 0, 96, 48);
  c.strokeStyle = '#c9a227'; c.lineWidth = 3; c.strokeRect(3, 3, 90, 42);
  c.fillStyle = '#e8d9a0'; c.font = 'bold 30px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('110', 48, 26);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  plaque.position.set(2.6, 2.4, 4.59);
  houseL.add(plaque);
})();
// oval glass inset in the front door (like the real door)
const oval = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), glassMat);
oval.scale.y = 1.5;
oval.position.set(4.2, 1.55, 4.68);
houseL.add(oval);
// upper side deck on the left with dark railing (photo 1)
const sideDeck = box(1.7, 0.12, 3.2, 0x6b4a30, -6.9, 3.3, 0.5, houseL);
sideDeck.material = plankMat;
for (let i = 0; i < 4; i++) box(0.07, 0.85, 0.07, 0x22201d, -7.68, 3.85, -0.9 + i * 0.95, houseL);
box(0.06, 0.06, 3.1, 0x22201d, -7.68, 4.3, 0.5, houseL);
box(0.12, 3.3, 0.12, 0x5a4534, -7.5, 1.65, -0.7, houseL);
box(0.12, 3.3, 0.12, 0x5a4534, -7.5, 1.65, 1.7, houseL);
const porch = box(4, 0.3, 2.2, 0x6b4a30, 3.5, 0.15, 5.6, houseL); // porch deck by the door
porch.material = plankMat;
const step = box(2, 0.2, 0.9, 0x6b4a30, 3.2, 0.05, 7.0, houseL); // step
step.material = plankMat;
// dark porch railing (like the photos), gap at the steps
for (const [rx, rz] of [[5.35, 6.6], [4.6, 6.6], [1.7, 6.6], [5.35, 5.1], [1.7, 5.1]])
  box(0.09, 0.85, 0.09, 0x2b2118, rx, 0.72, rz, houseL);
box(1.0, 0.07, 0.07, 0x2b2118, 4.95, 1.12, 6.6, houseL);
box(0.6, 0.07, 0.07, 0x2b2118, 1.7, 1.12, 6.25, houseL).rotation.y = Math.PI / 2;
// pergola / arbor over the entry (slatted trellis on two posts)
(function pergola() {
  for (const pz of [4.9, 6.9]) box(0.16, 3.1, 0.16, 0x3d2b1e, 5.6, 1.55, pz, houseL);
  for (const pz of [4.9, 6.9]) box(0.16, 3.1, 0.16, 0x3d2b1e, 2.2, 1.55, pz, houseL);
  box(0.18, 0.12, 2.6, 0x3d2b1e, 5.6, 3.16, 5.9, houseL);
  box(0.18, 0.12, 2.6, 0x3d2b1e, 2.2, 3.16, 5.9, houseL);
  for (let i = 0; i < 6; i++) box(4.1, 0.07, 0.22, 0x3d2b1e, 3.9, 3.3, 4.75 + i * 0.46, houseL);
})();
// metal chimney
cyl(0.25, 0.25, 2.2, 0x8f9499, -6, 9.2, -9, null, 10);
// Right: garage with two doors
const garage = gableHouse(-4, -22, 12, 9, 5, 2.6);
garage.rotation.y = Math.PI / 2; // doors open east onto the driveway
for (const gx of [-2.6, 2.6]) {
  const door = box(3.6, 3.1, 0.2, DOORC, gx, 1.55, 4.6, garage);
  door.material = garageMat;
  for (const hx of [-0.5, 0.5]) box(0.34, 0.06, 0.06, 0x8a8578, gx + hx, 1.0, 4.74, garage); // carriage handles
}
windowPane(garage, -2, 6, 4.62, 1.3, 1.4);
windowPane(garage, 2, 6, 4.62, 1.3, 1.4);
for (const gx of [-2, 2]) { // the arched tops those windows have in the photos
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.66, 14, 0, Math.PI), glassMat);
  arch.position.set(gx, 6.72, 4.63); garage.add(arch);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.09, 6, 12, Math.PI), mat(TRIM));
  rim.position.set(gx, 6.72, 4.66); garage.add(rim);
}
// exposed rafter tails under the eaves + dark trim band between floors (both volumes)
for (const [vol, eaveY, w2] of [[houseL, 5.35, 12], [garage, 4.85, 12]]) {
  for (let rx = -w2 / 2 + 0.6; rx <= w2 / 2 - 0.4; rx += 0.85)
    box(0.14, 0.14, 0.6, TRIM, rx, eaveY, 4.55, vol);
  box(w2 + 0.1, 0.24, 0.1, TRIM, 0, 3.15, 4.58, vol); // mid-band
}
// broad chimney cap
box(0.9, 0.18, 0.9, 0x6e7378, -6, 10.35, -9);
// rear balcony over the backyard, with the rainbow hammock + string lights (photos)
(function rearBalcony() {
  const deck = box(1.7, 0.16, 4.6, 0x6b4a30, -9.4, 3.35, -7);
  deck.material = new THREE.MeshStandardMaterial({ map: plankTex, bumpMap: plankTex, bumpScale: 0.04, roughness: 0.9, metalness: 0 });
  for (const pz of [-9.1, -4.9]) {
    box(0.14, 3.5, 0.14, TRIM, -10.1, 1.75, pz);           // posts to the ground
    addCircleCollider(-10.1, pz, 0.2);
    box(0.14, 1.0, 0.14, TRIM, -10.15, 3.95, pz);          // railing posts
  }
  for (let i = 0; i < 4; i++) box(0.07, 0.8, 0.07, TRIM, -10.15, 3.85, -8.6 + i * 1.1);
  box(0.09, 0.09, 4.5, TRIM, -10.15, 4.4, -7);             // top rail
  // rainbow hammock slung between the railing posts
  const hamTex = canvasTex(64, 64, (c, w, h) => {
    const cols = ['#d84a3a', '#e8a03a', '#e8d84a', '#4aa85a', '#3a6ac8', '#8a4ac8'];
    for (let i = 0; i < 12; i++) { c.fillStyle = cols[i % 6]; c.fillRect(0, i * 6, w, 6); }
  }, 1, 1);
  const ham = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 10, 1, true, Math.PI * 1.15, Math.PI * 0.7),
    new THREE.MeshLambertMaterial({ map: hamTex, side: THREE.DoubleSide }));
  ham.rotation.z = Math.PI / 2; ham.rotation.y = Math.PI / 2;
  ham.position.set(-9.8, 4.05, -7); scene.add(ham);
  // string lights swagged along the balcony (they twinkle after dark)
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const bm = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xc9a24a });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), bm);
    bulb.position.set(-10.2, 4.45 - Math.sin(t * Math.PI) * 0.35, -9.1 + t * 4.2);
    scene.add(bulb);
    nightBulbMats.push({ m: bm, base: 0xc9a24a, twinkle: i * 1.7 });
  }
})();
// half-timber diagonals on the garage gable
for (const s of [-1, 1]) {
  const t = box(0.22, 3.4, 0.1, TRIM, s * 3.4, 6.1, 4.66, garage);
  t.rotation.z = s * 0.7;
}
// lantern sconces between and beside the garage doors
for (const sx of [-5.4, 0, 5.4]) {
  box(0.14, 0.24, 0.1, 0x2b2118, sx, 3.6, 4.66, garage);
  const gm = new THREE.MeshLambertMaterial({ color: 0xffd28a, emissive: 0x000000 });
  const gg = box(0.09, 0.14, 0.09, 0xffd28a, sx, 3.58, 4.7, garage);
  gg.material = gm;
  nightBulbMats.push({ m: gm, base: 0xcc8a30 });
}
// The breezeway: open passage at ground level, enclosed bridge on the SECOND floor
// (like the real house — it's how the game room over the garage connects).
(function breezeway() {
  const bridge = box(6.5, 2.55, 3.4, WALL, -4, 4.2, -14.5);
  bridge.material = sidingMat;
  const soffit = box(6.5, 0.1, 3.5, 0x6b4a30, -4, 2.95, -14.5); // plank underside you walk beneath
  soffit.material = plankMat;
  const cap = box(7, 0.16, 4.1, ROOFC, -4, 5.55, -14.5); // low roof cap
  cap.material = shingleMat;
  // little window on the street side of the bridge
  const bw = box(0.08, 0.85, 1.3, 0x243542, 0.52, 4.35, -14.5);
  bw.material = glassMat;
  box(0.1, 1.0, 1.45, TRIM, 0.5, 4.35, -14.5).position.x = 0.49;
  // warm lights under the breezeway (on after dark)
  for (const bz of [-15.6, -13.4]) {
    const bm = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x000000 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bm);
    bulb.position.set(-4, 2.82, bz);
    scene.add(bulb);
    nightBulbMats.push({ m: bm, base: 0xcc8a30, window: true });
  }
})();
// house colliders — the breezeway gap stays open so you can walk through to the backyard
addBoxCollider(-8.7, 1, -28.2, -16);
addBoxCollider(-8.7, 1, -13, -1);

// White Mini in the driveway
const car = (function miniCooper() {
  const g = new THREE.Group(); g.position.set(7, 0, -22.5); g.rotation.y = 1.57; scene.add(g);
  box(2, 0.75, 4, 0xf2f2f2, 0, 0.75, 0, g);
  box(1.7, 0.6, 2.2, 0x1a1a1a, 0, 1.4, -0.2, g);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
    const w = cyl(0.35, 0.35, 0.25, 0x111111, x, 0.35, z, g, 12);
    w.rotation.z = Math.PI / 2;
    wheels.push(w);
  }
  box(0.5, 0.15, 0.1, 0xfff3b0, -0.6, 0.8, 2.0, g); box(0.5, 0.15, 0.1, 0xfff3b0, 0.6, 0.8, 2.0, g);
  // brake lights
  box(0.4, 0.12, 0.08, 0x7a1010, -0.6, 0.85, -2.02, g); box(0.4, 0.12, 0.08, 0x7a1010, 0.6, 0.85, -2.02, g);
  // headlight cones for night driving
  const hl = new THREE.SpotLight(0xfff2cc, 0, 34, 0.6, 0.5, 1.2);
  hl.position.set(0, 0.9, 2.1);
  const hlTarget = new THREE.Object3D(); hlTarget.position.set(0, 0, 14); g.add(hlTarget);
  hl.target = hlTarget; g.add(hl);
  return { g, wheels, headlight: hl, heading: 1.57, speed: 0, occupied: false,
           colliderId: colliders.length };
})();
addBoxCollider(5.1, 8.9, -24.4, -20.6);
car.colliderIndex = colliders.length - 1; // removed while driving

// Fence (right side, like the photos)
for (let i = 0; i < 4; i++) box(0.15, 1.7, 1.9, 0x7a4f33, 15.4, 0.85, -33 + i * 2).material = plankMat;
addBoxCollider(15.1, 15.7, -34, -26.2);

// Mailbox at the end of the driveway
box(0.12, 1.1, 0.12, 0x4a3a28, 14.9, 0.55, -17);
box(0.5, 0.4, 0.7, 0x2e3134, 14.9, 1.3, -17);
addCircleCollider(14.9, -17, 0.4);

// ---------- The rest of the neighborhood ----------
(function neighborhood() {
  // power lines along River Ln (they're in every photo of the street)
  const poleM = new THREE.MeshStandardMaterial({ map: barkTex, bumpMap: barkTex, bumpScale: 0.08, roughness: 1, metalness: 0 });
  const wireM = new THREE.MeshBasicMaterial({ color: 0x15140f });
  // poles march up the east side of River Ln, wires overhead (they're in the street view)
  const poleZs = [-37, -13, 11];
  for (const pz of poleZs) {
    const pole = cyl(0.13, 0.17, 8.4, 0x4a3a2c, 23.6, 4.2, pz, null, 8);
    pole.material = poleM;
    box(2.3, 0.14, 0.12, 0x3d2f22, 23.6, 7.5, pz);
    addCircleCollider(23.6, pz, 0.3);
  }
  for (let i = 0; i < poleZs.length - 1; i++) {
    for (const off of [-0.95, 0.95]) {
      const p0 = new THREE.Vector3(23.6 + off, 7.45, poleZs[i]);
      const p2 = new THREE.Vector3(23.6 + off, 7.45, poleZs[i + 1]);
      const mid = p0.clone().add(p2).multiplyScalar(0.5);
      mid.y -= 1.3; // sag
      const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p2), 14, 0.03, 4), wireM);
      scene.add(wire);
    }
  }
  // a service drop sagging from the mid pole across to the house eaves
  (function serviceDrop() {
    const p0 = new THREE.Vector3(23.6, 7.3, -13);
    const p2 = new THREE.Vector3(0.5, 5.6, -10);
    const mid = p0.clone().add(p2).multiplyScalar(0.5); mid.y -= 1.6;
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p2), 14, 0.025, 4), wireM));
  })();
  // low stone wall edging the front garden bed (photo detail)
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const st = new THREE.Mesh(new THREE.SphereGeometry(rand(0.3, 0.42), 7, 5), mat(0x8a8578));
    st.scale.set(1.15, 0.62, 0.8);
    st.position.set(2.3 + Math.sin(t * 2.6) * 0.7, 0.16, -6.6 + t * 5.2);
    st.rotation.y = rand(0, 9);
    st.castShadow = true; st.receiveShadow = true;
    scene.add(st);
  }
  // landscaping hugging the facade like the listing photos
  for (const bz of [-8.0, -6.4, -4.4, -2.4, -1.2]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.4, 0.68), 8, 6), mat(Math.random() < 0.4 ? 0x3d6030 : 0x2e4c26));
    b.position.set(1.5, 0.32, bz);
    b.castShadow = true;
    scene.add(b);
    blobs.push({ x: 1.5, z: bz, r: 0.9 });
  }
  // neighbor cabins tucked into the trees down the lane
  function cabin(cx, cz, ry, number) {
    const c = gableHouse(cx, cz, 8, 7, 3.4, 2);
    c.rotation.y = ry;
    box(1.1, 2.1, 0.14, DOORC, 0, 1.05, 3.57, c);
    windowPane(c, -2.2, 1.9, 3.6, 1.1, 1.1);
    windowPane(c, 2.2, 1.9, 3.6, 1.1, 1.1);
    if (number) { // little address plaque by the door
      const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48;
      const cc = cv.getContext('2d');
      cc.fillStyle = '#2c1c12'; cc.fillRect(0, 0, 96, 48);
      cc.strokeStyle = '#c9a227'; cc.lineWidth = 3; cc.strokeRect(3, 3, 90, 42);
      cc.fillStyle = '#e8d9a0'; cc.font = 'bold 30px Georgia'; cc.textAlign = 'center'; cc.textBaseline = 'middle';
      cc.fillText(number, 48, 26);
      const plq = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
      plq.position.set(1.2, 2.1, 3.59);
      c.add(plq);
    }
    if (Math.abs(Math.sin(ry)) > 0.5) addBoxCollider(cx - 3.8, cx + 3.8, cz - 4.2, cz + 4.2);
    else addBoxCollider(cx - 4.2, cx + 4.2, cz - 3.8, cz + 3.8);
    blobs.push({ x: cx, z: cz, r: 5 });
  }
  // 111 River Ln — the brown cabin across the lane (it's in the street view)
  cabin(27.5, -2, -Math.PI / 2, '111');
  const drv1 = box(3.2, 0.05, 3, 0x9a8f7d, 22.4, 0.03, -2);
  drv1.material = new THREE.MeshLambertMaterial({ map: duffTex, color: 0xbfb49e });
  drv1.castShadow = false;
  // a second cabin tucked off Hwy 9
  cabin(-47, -33.6, Math.PI);
  const drv2 = box(3.2, 0.05, 3.2, 0x9a8f7d, -47, 0.03, -38);
  drv2.material = new THREE.MeshLambertMaterial({ map: duffTex, color: 0xbfb49e });
  drv2.castShadow = false;
  // the neighbor's faded old pickup
  (function pickup() {
    const g = new THREE.Group(); g.position.set(31.5, 0, 4.8); g.rotation.y = -1.35; scene.add(g);
    const paint = new THREE.MeshStandardMaterial({ color: 0x5d7a87, roughness: 0.55, metalness: 0.25, envMapIntensity: 0.6 });
    for (const [w2, h2, d2, y2, z2] of [[1.9, 1.0, 1.7, 1.25, -0.9], [1.8, 0.55, 1.3, 0.95, -2.2], [1.9, 0.6, 2.2, 0.9, 1.1]]) {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), paint);
      part.position.set(0, y2, z2);
      part.castShadow = true;
      g.add(part);
    }
    box(1.7, 0.5, 0.06, 0x27333a, 0, 1.35, -1.72, g); // windshield
    for (const [wx, wz] of [[-0.95, -1.9], [0.95, -1.9], [-0.95, 1.4], [0.95, 1.4]]) {
      const wh = cyl(0.34, 0.34, 0.24, 0x151515, wx, 0.34, wz, g, 10);
      wh.rotation.z = Math.PI / 2;
    }
    addCircleCollider(31.5, 4.8, 2.6);
    blobs.push({ x: 31.5, z: 4.8, r: 3 });
  })();
})();

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
woodSign(-36, -38.2, Math.PI + 0.1, ['WELCOME TO', 'FELTON, CA'], 3.4);
woodSign(23.6, 17.5, -Math.PI / 2 - 0.12, ['SANTA CRUZ', 'REDWOODS', 'RV RESORT'], 3.6);
(function streetBlade() { // RIVER LN at the end of the driveway
  const g = new THREE.Group(); g.position.set(14.6, 0, -38.4); g.rotation.y = -0.7; scene.add(g);
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
  addCircleCollider(14.6, -38.4, 0.3);
})();

// ---- backyard: paver patio + the hot tub under the redwoods (from the photos) ----
(function backyard() {
  const pav = new THREE.MeshStandardMaterial({ map: paverTex, bumpMap: paverTex, bumpScale: 0.02, roughness: 0.95, metalness: 0, color: 0xb8b0a2 });
  const patio = box(4.4, 0.07, 13.5, 0xb8b0a2, -11.1, 0.04, -11.2);
  patio.material = pav; patio.castShadow = false;
  const g = new THREE.Group(); g.position.set(-11.6, 0, -16.2); scene.add(g);
  const shell = cyl(1.15, 1.05, 0.75, 0xe8e6e0, 0, 0.38, 0, g, 8);
  const wat = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), new THREE.MeshPhongMaterial({ map: waterTex, transparent: true, opacity: 0.9, shininess: 80, specular: 0x9fc3d0 }));
  wat.rotation.x = -Math.PI / 2; wat.position.y = 0.72; g.add(wat);
  box(0.6, 0.08, 0.3, 0x2e3134, 1.05, 0.72, 0, g); // control panel
  addCircleCollider(-11.6, -16.2, 1.35);
  blobs.push({ x: -11.6, z: -16.2, r: 1.6 });
})();

// ---- Hwy 9 ambient traffic: locals headed for Felton or Santa Cruz ----
const traffic = [];
(function buildTraffic() {
  const paints = [0x8a3a2e, 0x3a5a7a, 0xd8d4c8];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: paints[i], roughness: 0.5, metalness: 0.25, envMapIntensity: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.72, 1.85), paint);
    body.position.y = 0.72; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 1.7), paint);
    cabin.position.set(-0.25, 1.35, 0); cabin.castShadow = true; g.add(cabin);
    const glass = box(2.14, 0.42, 1.6, 0x26333c, -0.25, 1.38, 0, g);
    glass.material = mat(0x26333c, { emissive: 0x101b22 });
    for (const [wx, wz] of [[-1.35, 0.95], [1.35, 0.95], [-1.35, -0.95], [1.35, -0.95]]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 10), mat(0x151515));
      wh.rotation.x = Math.PI / 2; wh.position.set(wx, 0.33, wz); g.add(wh);
    }
    const headM = new THREE.MeshLambertMaterial({ color: 0xfff3c0, emissive: 0x000000 });
    const tailM = new THREE.MeshLambertMaterial({ color: 0x8a1c14, emissive: 0x000000 });
    for (const s of [-0.6, 0.6]) {
      const hd = box(0.1, 0.16, 0.34, 0xfff3c0, 2.11, 0.78, s, g); hd.material = headM;
      const tl = box(0.1, 0.14, 0.3, 0x8a1c14, -2.11, 0.8, s, g); tl.material = tailM;
    }
    nightBulbMats.push({ m: headM, base: 0xfff0b0, window: true });
    nightBulbMats.push({ m: tailM, base: 0xd83a2a, window: true });
    const dir = i === 1 ? -1 : 1; // two eastbound, one westbound
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    g.visible = false;
    scene.add(g);
    traffic.push({ g, dir, z: HWY9.z + dir * -2.2, speed: rand(11.5, 14.5), active: false, t: rand(3, 9) + i * 7, whooshed: false });
  }
})();
function updateTraffic(dt) {
  for (const c of traffic) {
    if (!c.active) {
      c.t -= dt;
      if (c.t <= 0) { c.active = true; c.g.visible = true; c.x = -c.dir * 92; c.whooshed = false; }
      continue;
    }
    c.x += c.dir * c.speed * dt;
    c.g.position.set(c.x, 0, c.z);
    if (Math.abs(c.x) > 92) { c.active = false; c.g.visible = false; c.t = rand(6, 22); continue; }
    if (player) {
      const dx = Math.abs(c.x - player.pos.x), dz = Math.abs(c.z - player.pos.z);
      if (!c.whooshed && dx < 7 && dz < 11) { c.whooshed = true; tone(130 + Math.random() * 50, 0.5, 'sawtooth', 0.04); }
      if (dx > 24) c.whooshed = false;
    }
  }
}

// ---------- Redwood forest ----------
const foliageMat = mat(0x24401f), foliageMat2 = mat(0x2e5026);
const trunkMat = new THREE.MeshStandardMaterial({ map: barkTex, bumpMap: barkTex, bumpScale: 0.14, roughness: 1, metalness: 0 });
const swayers = []; // gently wind-blown things: {obj, phase, amp, axis}
// redwood foliage as thousands of instanced branch clusters (one draw call, organic canopies)
const foliageXforms = [];
const FOLIAGE_GREENS = [0x274a22, 0x2f5628, 0x1f3d1c, 0x39642e, 0x2a4f24];
function redwood(x, z, s) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  g.rotation.y = rand(0, Math.PI * 2);            // natural variation
  g.rotation.z = rand(-0.02, 0.02);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.85 * s, 17 * s, 9), trunkMat);
  trunk.position.y = 8.5 * s; trunk.castShadow = true; g.add(trunk);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.85 * s, 1.5 * s, 1.6 * s, 9), trunkMat); // buttressed base
  flare.position.y = 0.8 * s; flare.castShadow = true; g.add(flare);
  // whorls of drooping branch clusters, dense at the bottom, tight at the crown
  const levels = 7;
  for (let l = 0; l < levels; l++) {
    const t = l / (levels - 1);
    const y = (7 + t * 9.2) * s;
    const radius = (3.1 - t * 2.3) * s;
    const n = l === levels - 1 ? 2 : 4 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const rr = l === levels - 1 ? radius * 0.2 : radius * rand(0.3, 0.95);
      foliageXforms.push({
        x: x + Math.cos(a) * rr,
        y: y + rand(-0.6, 0.6) * s,
        z: z + Math.sin(a) * rr,
        s: rand(0.9, 1.5) * s * (1.55 - t * 0.75),
        ry: rand(0, 9),
        c: FOLIAGE_GREENS[Math.floor(rand(0, FOLIAGE_GREENS.length))],
      });
    }
  }
  // crown spire
  foliageXforms.push({ x, y: 17 * s, z, s: 0.8 * s, ry: 0, spire: true, c: FOLIAGE_GREENS[1] });
  blobs.push({ x, z, r: 2.4 * s });
  treeReg.push({ g, x, z, s, ry: g.rotation.y });
  addCircleCollider(x, z, 0.9 * s);
}
function buildFoliage() {
  // a painted redwood branch spray — feathery sprays of flat needles, drawn once,
  // instanced thousands of times as crossed cards. Reads like real canopy and is
  // cheaper than the old sphere clusters (2 tris vs 70 per cluster).
  const sprayTex = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const greens = ['#3d6631', '#2e5226', '#4c7a3c', '#24421e', '#5a8a48'];
    for (let br = 0; br < 9; br++) { // branches radiating from bottom-center
      const a = -Math.PI / 2 + (br - 4) * 0.34 + rand(-0.08, 0.08);
      const len = rand(90, 120);
      const bx = 128, by = 236;
      c.strokeStyle = '#4a3822'; c.lineWidth = 2.4; c.globalAlpha = 0.9;
      const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke();
      for (let t = 0.12; t <= 1; t += 0.07) { // flat needle tufts along each branch
        const px = bx + Math.cos(a) * len * t, py = by + Math.sin(a) * len * t;
        c.fillStyle = greens[Math.floor(rand(0, greens.length))];
        c.globalAlpha = rand(0.75, 1);
        const s2 = (1.1 - t * 0.55) * rand(9, 15);
        c.save(); c.translate(px, py); c.rotate(a + Math.PI / 2 + rand(-0.4, 0.4));
        c.beginPath(); c.ellipse(0, 0, s2, s2 * 0.38, 0, 0, 7); c.fill();
        c.restore();
      }
    }
    c.globalAlpha = 1;
  });
  sprayTex.repeat.set(1, 1);
  const geo = new THREE.PlaneGeometry(2.4, 2.4);
  const m = new THREE.MeshLambertMaterial({ map: sprayTex, color: 0xffffff, alphaTest: 0.35, side: THREE.DoubleSide, transparent: false });
  const inst = new THREE.InstancedMesh(geo, m, foliageXforms.length * 2);
  // alpha-tested shadows so canopies cast dappled light, not solid squares
  inst.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: sprayTex, alphaTest: 0.35 });
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  foliageXforms.forEach((f, i) => {
    for (const rot of [0, Math.PI / 2]) {
      dummy.position.set(f.x, f.y + (f.spire ? f.s * 0.5 : 0), f.z);
      dummy.rotation.set(f.spire ? 0 : rand(-0.25, 0.25), f.ry + rot, f.spire ? 0 : rand(-0.2, 0.2));
      const sc = f.spire ? f.s * 0.9 : f.s * 1.15;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      inst.setMatrixAt(i * 2 + (rot ? 1 : 0), dummy.matrix);
      col.setHex(f.c);
      col.offsetHSL(rand(-0.015, 0.015), rand(-0.05, 0.05), rand(-0.04, 0.04));
      col.multiplyScalar(1.55); // texture is dark; instance tint restores variation
      inst.setColorAt(i * 2 + (rot ? 1 : 0), col);
    }
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
  foliageRef.inst = inst;
}
// dense redwood forest crowding the neighborhood (like the real property)
let placed = 0, guard = 0;
while (placed < 68 && guard++ < 800) {
  const a = rand(0, Math.PI * 2), d = rand(22, 80);
  const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
  if (x > -20 && x < 20 && z > -28.5 && z < 18) continue; // keep the yard clear
  if (z > 16 && z < 43 && x > 12) continue;               // resort, river crossing & tracks
  if (z > 25 && z < 43) continue;                         // river banks
  if (onRoad(x, z, 2.6)) continue;                        // Hwy 9 + River Ln
  if (Math.hypot(x - 17, z - 50) < 9.5) continue;          // the swimming hole is not a planter
  if (x > -30 && x < 30 && z > -40 && z < -28.5) continue; // house backdrop stays airy
  if (!spotIsClear(x, z, 2.2)) continue;
  redwood(x, z, rand(0.8, 1.7));
  placed++;
}
// hero redwoods hugging the house and driveway, exactly like the photos
for (const [hx, hz, hs] of [[-18.5, -29.5, 1.5], [32, -25, 1.7], [24.5, -7.5, 1.15], [-21, -6.5, 1.1], [-24.5, -21, 1.35], [-14, 6, 1.45], [7, 13, 1.3], [-3, 16, 1.05]]) {
  if (!onRoad(hx, hz, 1.4) && spotIsClear(hx, hz, 1.2)) redwood(hx, hz, hs);
}
buildFoliage();
// dark huckleberry understory beneath the canopy
for (let i = 0; i < 16; i++) {
  const a = rand(0, Math.PI * 2), d = rand(24, 55);
  const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
  if (z > 25 && z < 43) continue;
  if (onRoad(x, z, 1) || Math.hypot(x - 17, z - 50) < 8.5) continue;
  if (!spotIsClear(x, z, 0.8)) continue;
  const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.6, 1.3), 7, 6), mat(0x25381f));
  b.scale.y = 0.7;
  b.position.set(x, 0.35, z);
  b.castShadow = true;
  scene.add(b);
  blobs.push({ x, z, r: 1.4 });
}
// bushes around the yard
for (let i = 0; i < 18; i++) {
  const p = clearSpot(8, 30, 1);
  const b = new THREE.Mesh(new THREE.SphereGeometry(rand(0.5, 1.1), 7, 6), mat(0x30522a));
  b.position.set(p.x, 0.4, p.z); b.castShadow = true; scene.add(b);
  swayers.push({ obj: b, phase: rand(0, 9), amp: 0.05 });
  blobs.push({ x: p.x, z: p.z, r: 1.3 });
}
// front-yard trees like the photo
for (const [x, z] of [[7.5, -5.5], [10.5, -1.5]]) {
  const t = cyl(0.15, 0.22, 1.6, 0x6e4a30, x, 0.8, z);
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 7), mat(0x47632c));
  c.position.set(x, 2.4, z); c.castShadow = true; scene.add(c);
  addCircleCollider(x, z, 0.5);
  blobs.push({ x, z, r: 2 });
}
blobs.push({ x: 7, z: -22.5, r: 3 });                       // the Mini
for (const [bx, bz] of [[26.5, 22.5], [34.5, 21.5], [42.5, 22.8]]) blobs.push({ x: bx, z: bz, r: 3.4 }); // RVs

// ---------- Ambience: a living redwood forest ----------
// sword ferns — THE Felton understory — as painted crossed cards, one instanced draw call
(function swordFerns() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 96;
  const c = cv.getContext('2d');
  const greens = ['#39662c', '#2e5624', '#457a35', '#26481e'];
  for (let f = 0; f < 12; f++) { // fronds fanning up from the base
    const a = -Math.PI / 2 + (f - 5.5) * 0.24 + rand(-0.05, 0.05);
    const len = rand(42, 60);
    const tipX = 64 + Math.cos(a) * len, tipY = 92 + Math.sin(a) * len;
    const midX = 64 + Math.cos(a) * len * 0.5, midY = 92 + Math.sin(a) * len * 0.5 - 4;
    c.strokeStyle = greens[f % greens.length];
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(64, 92); c.quadraticCurveTo(midX, midY, tipX, tipY); c.stroke();
    for (let l = 0.15; l < 1; l += 0.09) { // leaflets along each frond
      const t = l, ix = (1 - t) * (1 - t) * 64 + 2 * (1 - t) * t * midX + t * t * tipX,
        iy = (1 - t) * (1 - t) * 92 + 2 * (1 - t) * t * midY + t * t * tipY;
      const na = a + Math.PI / 2, ll = (1 - t) * 9 + 2;
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(ix - Math.cos(na) * ll, iy - Math.sin(na) * ll);
      c.lineTo(ix + Math.cos(na) * ll, iy + Math.sin(na) * ll);
      c.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.encoding = THREE.sRGBEncoding;
  const geo = new THREE.PlaneGeometry(1.7, 1.15);
  geo.translate(0, 0.5, 0);
  const m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.28, side: THREE.DoubleSide });
  const N = FINE ? 190 : 130;
  const inst = new THREE.InstancedMesh(geo, m, N * 2); // two crossed cards per fern
  const dummy = new THREE.Object3D();
  let n = 0;
  for (let i = 0; i < 900 && n < N; i++) {
    const a = rand(0, Math.PI * 2), d = rand(23, 72);
    const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
    if (x > -20 && x < 20 && z > -30 && z < 16) continue;
    if (onRoad(x, z, 0.8) || (z > 25 && z < 43) || Math.hypot(x - 17, z - 50) < 8) continue;
    if (!spotIsClear(x, z, 0.5)) continue;
    const s = rand(0.7, 1.7), ry = rand(0, Math.PI);
    for (const rot of [0, Math.PI / 2]) {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(rand(-0.08, 0.08), ry + rot, rand(-0.08, 0.08));
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      inst.setMatrixAt(n * 2 + (rot ? 1 : 0), dummy.matrix);
    }
    n++;
  }
  inst.count = n * 2;
  inst.receiveShadow = true;
  scene.add(inst);
})();
// low sun shafts slanting through the canopy (fade with daylight, gone in rain)
const shaftMats = [];
(function sunShafts() {
  const geo = new THREE.CylinderGeometry(0.32, 2.6, 17, 7, 1, true);
  const picks = treeReg.filter(t => t.z > -55 && t.z < 22 && Math.abs(t.x) < 65);
  for (let i = 0; i < Math.min(9, picks.length); i++) {
    const t = picks[Math.floor(rand(0, picks.length))];
    const m = new THREE.MeshBasicMaterial({
      color: 0xfff3d0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
    });
    const shaft = new THREE.Mesh(geo, m);
    shaft.position.set(t.x + rand(1.5, 3.5), 8.4, t.z + rand(-2, 2));
    shaft.rotation.z = 0.24; shaft.rotation.x = rand(-0.08, 0.08);
    shaft.renderOrder = 3;
    scene.add(shaft);
    shaftMats.push({ m, base: rand(0.07, 0.11) });
  }
})();
// mushroom clusters
(function mushrooms() {
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), d = rand(22, 60);
    const x = Math.sin(a) * d, z = Math.cos(a) * d - 8;
    if (x > -20 && x < 20 && z > -30 && z < 16) continue;
    if (onRoad(x, z, 0.6) || (z > 25 && z < 43) || Math.hypot(x - 17, z - 50) < 8) continue;
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
const rockBumpTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#8a887f'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, ['#a3a196', '#6e6c63', '#b5b3a8', '#57554e'], 700, 1, 5);
}, 2, 2);
const rockStdMat = new THREE.MeshStandardMaterial({ color: 0x8a887f, map: rockBumpTex, bumpMap: rockBumpTex, bumpScale: 0.05, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 });
for (let i = 0; i < 12; i++) {
  const p = clearSpot(10, 55, 0.8);
  const rr = rand(0.3, 0.85);
  const r = new THREE.Mesh(new THREE.SphereGeometry(rr, 9, 7), rockStdMat);
  r.scale.y = 0.55;
  r.position.set(p.x, 0.1, p.z);
  r.rotation.y = rand(0, 9);
  r.castShadow = true; r.receiveShadow = true;
  scene.add(r);
  blobs.push({ x: p.x, z: p.z, r: rr * 1.5 });
  rockReg.push({ m: r, x: p.x, z: p.z, r: rr });
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
  const bladeTex = canvasTex(64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { // a little sheaf of blades
      const x0 = 12 + i * 5 + rand(-2, 2), lean = rand(-10, 10);
      c.strokeStyle = ['#5b7a3c', '#4d6a33', '#66823f', '#42602c'][i % 4];
      c.lineWidth = rand(1.6, 2.6); c.globalAlpha = rand(0.8, 1);
      c.beginPath(); c.moveTo(x0, h);
      c.quadraticCurveTo(x0 + lean * 0.4, h * 0.5, x0 + lean, rand(2, 16));
      c.stroke();
    }
    c.globalAlpha = 1;
  });
  bladeTex.repeat.set(1, 1);
  const geo = new THREE.PlaneGeometry(0.24, 0.32);
  geo.translate(0, 0.16, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: bladeTex, color: 0xffffff, alphaTest: 0.3, side: THREE.DoubleSide }), FINE ? 2400 : 1500);
  grassRef.inst = inst;
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const greens = [0x4d6a33, 0x5b7a3c, 0x42602c, 0x66823f];
  let n = 0;
  for (let i = 0; i < 9000 && n < (FINE ? 2400 : 1500); i++) {
    const x = rand(-44, 44), z = rand(-31, 18);
    if (x > 0 && x < 16.5 && z > -26.5 && z < -18) continue;    // driveway pad
    if (onRoad(x, z, 0.4)) continue;                           // lane + Hwy 9
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
  for (const px of [5.2, 1.9]) {
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
  const lantern = box(0.16, 0.26, 0.12, 0x2b2118, 2.85, 2.5, 4.56, houseL);
  const glowM = new THREE.MeshLambertMaterial({ color: 0xffd28a, emissive: 0xcc8a30 });
  const glow = box(0.1, 0.16, 0.1, 0xffd28a, 2.85, 2.5, 4.58, houseL);
  glow.material = glowM;
  nightBulbMats.push({ m: glowM, base: 0xcc8a30 });
  // warm porch point light that switches on at dusk (world coords: houseL at -8,-23)
  porchLight = new THREE.PointLight(0xffce85, 0, 10, 1.6);
  porchLight.position.set(0.9, 2.5, -11.4);
  scene.add(porchLight);
  // lit windows after dark — aligned to the actual window panes
  for (const [wx, wy] of [[0.5, 3.6], [-3.6, 3.6], [-1.5, 6.4]]) {
    const wm = new THREE.MeshLambertMaterial({ color: 0x3a4a55, emissive: 0x000000 });
    const w = box(1.3, 1.5, 0.05, 0x3a4a55, wx, wy, 4.7, houseL);
    w.material = wm;
    nightBulbMats.push({ m: wm, base: 0xffcf87, window: true });
  }
})();
// ---- photoreal atmosphere layer ----
// soft contact shadows under everything (fakes ambient occlusion, one draw call)
(function contactShadows() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  const grad = c.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.4)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grad; c.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  const geo = new THREE.PlaneGeometry(2, 2);
  const inst = new THREE.InstancedMesh(geo,
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }), blobs.length);
  const dummy = new THREE.Object3D();
  blobs.forEach((b, i) => {
    dummy.position.set(b.x, 0.025, b.z);
    dummy.rotation.set(-Math.PI / 2, 0, rand(0, 9));
    dummy.scale.setScalar(b.r);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.renderOrder = 1;
  scene.add(inst);
})();
// pools of ground mist drifting between the trees and over the river
const mists = [];
(function mistPools() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const c = cv.getContext('2d');
  const grad = c.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(235,242,238,0.55)');
  grad.addColorStop(0.7, 'rgba(235,242,238,0.22)');
  grad.addColorStop(1, 'rgba(235,242,238,0)');
  c.fillStyle = grad; c.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  for (let i = 0; i < 11; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: rand(0.16, 0.3), depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    const overRiver = i < 4;
    m.position.set(rand(-60, 60), overRiver ? rand(0.6, 1.4) : rand(0.8, 2.2), overRiver ? rand(28, 38) : rand(-70, 20));
    if (!overRiver && Math.abs(m.position.x) < 26 && m.position.z > -30 && m.position.z < 18) m.position.x += 45; // keep the yard clear
    m.scale.set(rand(18, 34), rand(10, 18), 1);
    m.renderOrder = 2;
    scene.add(m);
    mists.push({ m, v: rand(0.2, 0.6) });
  }
})();
// visible sun with warm glow
(function sunGlow() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const c = cv.getContext('2d');
  const grad = c.createRadialGradient(128, 128, 6, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255,246,224,1)');
  grad.addColorStop(0.12, 'rgba(255,238,196,0.9)');
  grad.addColorStop(0.4, 'rgba(255,222,160,0.28)');
  grad.addColorStop(1, 'rgba(255,222,160,0)');
  c.fillStyle = grad; c.fillRect(0, 0, 256, 256);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sp.position.copy(sun.position).normalize().multiplyScalar(225);
  sp.scale.setScalar(85);
  scene.add(sp);
  sunGlowRef = sp; // follows the sun and fades at night
})();
// split-rail fence along the bridge path (that trailhead look)
(function splitRail() {
  const railM = new THREE.MeshLambertMaterial({ map: plankTex });
  for (const sx of [19.6, 23.4]) {
    for (let i = 0; i < 4; i++) {
      const z0 = 17.5 + i * 2.4;
      const post = box(0.14, 1.1, 0.14, 0x6b4a30, sx, 0.55, z0);
      post.material = railM;
      const rail = box(0.09, 0.12, 2.4, 0x6b4a30, sx, 0.85, z0 + 1.2);
      rail.material = railM;
      rail.rotation.x = rand(-0.02, 0.02);
      const rail2 = box(0.09, 0.12, 2.4, 0x6b4a30, sx, 0.45, z0 + 1.2);
      rail2.material = railM;
    }
  }
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
  cloudMats.push(puffMat); // dimmed at night
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
  for (const mi of mists) {
    mi.m.position.x += mi.v * dt;
    if (mi.m.position.x > 75) mi.m.position.x = -75;
    mi.m.material.opacity = 0.14 + Math.sin(t * 0.2 + mi.v * 20) * 0.07;
  }
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

// ---------- Drop-in photo-real assets (see assets/README.md) ----------
// Any file found in /assets upgrades the world on load; missing files = keep the procedural look.
(function assetUpgrades() {
  // Visible loading indicator, counted by files-settled rather than bytes: browsers' built-in
  // TextureLoader/ImageLoader don't reliably fire byte-progress events, so a percentage bar
  // would often be wrong or stuck. A simple "N of M checked" count is honest and always correct.
  const loadEl = document.getElementById('assetload');
  const pctEl = document.getElementById('assetloadpct');
  const pending = {}; // file -> done(bool)
  let anyLoaded = false, showTimer = null, hidden = true;
  function total() { return Object.keys(pending).length; }
  function doneCount() { return Object.values(pending).filter(Boolean).length; }
  function refreshBadge() {
    const d = doneCount(), t = total();
    pctEl.textContent = d + '/' + t;
    if (d >= t) { // everything attempted has settled
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      if (anyLoaded && !hidden) setTimeout(() => { loadEl.style.display = 'none'; hidden = true; }, 500);
      else { loadEl.style.display = 'none'; hidden = true; }
      return;
    }
    pctEl.textContent = d + '/' + t;
    // delay showing briefly so a project with zero real assets (instant 404s) never flashes this
    if (!showTimer && hidden) showTimer = setTimeout(() => { loadEl.style.display = 'block'; hidden = false; }, 400);
  }
  function track(file) { pending[file] = false; refreshBadge(); }
  function onProgress() { return () => {}; } // kept as a no-op hook; loaders below still pass it
  function markDone(file, ok) {
    pending[file] = true;
    if (ok) anyLoaded = true;
    refreshBadge();
  }
  const TL = new THREE.TextureLoader();
  function tryTex(file, rx, ry2, srgb, apply) {
    track(file);
    TL.load('assets/' + file, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry2);
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = MAX_ANISO;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      apply(t);
      toast('📸 Photo upgrade loaded: ' + file, 2.5);
      markDone(file, true);
    }, onProgress(file), () => markDone(file, false));
  }
  tryTex('ground_diff.jpg', 70, 70, true, t => {
    ground.material.map = t; ground.material.bumpMap = null; ground.material.needsUpdate = true;
    if (grassRef.inst) grassRef.inst.visible = false; // the photo floor replaces the grass cards
  });
  tryTex('ground_nor.jpg', 70, 70, false, t => { ground.material.normalMap = t; ground.material.needsUpdate = true; });
  tryTex('bark_diff.jpg', 2, 5, true, t => { trunkMat.map = t; trunkMat.bumpMap = null; trunkMat.needsUpdate = true; });
  tryTex('bark_nor.jpg', 2, 5, false, t => { trunkMat.normalMap = t; trunkMat.needsUpdate = true; });
  // real captured sky -> real lighting on every surface
  if (THREE.RGBELoader) {
    track('env.hdr');
    new THREE.RGBELoader().load('assets/env.hdr', hdr => {
      try {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const pm = new THREE.PMREMGenerator(renderer);
        scene.environment = pm.fromEquirectangular(hdr).texture;
        pm.dispose();
        hdr.dispose();
        toast('📸 Real sky lighting loaded (env.hdr)', 2.5);
        markDone('env.hdr', true);
      } catch (e) { markDone('env.hdr', false); }
    }, onProgress('env.hdr'), () => markDone('env.hdr', false));
  }
  // scanned models replace the procedural redwoods / rocks, instanced for one draw call per mesh
  function prepMaterial(m2) {
    const ms = Array.isArray(m2) ? m2[0] : m2;
    if (ms.map) { ms.map.encoding = THREE.sRGBEncoding; ms.map.anisotropy = MAX_ANISO; }
    if (ms.isMeshStandardMaterial) ms.envMapIntensity = 0.45;
    return ms;
  }
  function instSwap(src, reg, scaleFor, cleanup) {
    src.updateMatrixWorld(true);
    const meshes = [];
    src.traverse(o => { if (o.isMesh) meshes.push(o); });
    if (!meshes.length) return false;
    const bbox = new THREE.Box3().setFromObject(src);
    const size = bbox.getSize(new THREE.Vector3());
    const ctr = bbox.getCenter(new THREE.Vector3());
    if (size.y <= 0.0001) return false;
    cleanup();
    const dummy = new THREE.Object3D();
    for (const m2 of meshes) {
      const geo = m2.geometry.clone();
      geo.applyMatrix4(m2.matrixWorld);
      geo.translate(-ctr.x, -bbox.min.y, -ctr.z);
      const inst = new THREE.InstancedMesh(geo, prepMaterial(m2.material), reg.length);
      reg.forEach((t, i) => {
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.ry !== undefined ? t.ry : rand(0, Math.PI * 2), 0);
        dummy.scale.setScalar(scaleFor(t, size));
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.castShadow = true;
      inst.receiveShadow = true;
      scene.add(inst);
    }
    return true;
  }
  if (THREE.GLTFLoader) {
    // accepts either a single .glb OR an unzipped Sketchfab folder (scene.gltf + textures)
    function tryModel(label, paths, onScene) {
      track(label);
      const GL = new THREE.GLTFLoader();
      (function attempt(i) {
        if (i >= paths.length) { markDone(label, false); return; }
        GL.load(paths[i], g => {
          try { onScene(g.scene, paths[i]); markDone(label, true); }
          catch (e) { markDone(label, false); }
        }, onProgress(label), () => attempt(i + 1));
      })(0);
    }
    tryModel('tree.glb', ['assets/tree.glb', 'assets/tree/scene.gltf', 'assets/tree/scene.glb'], (sc, path) => {
      const ok = instSwap(sc, treeReg,
        (t, size) => (17 * t.s) / size.y,        // match each redwood's original height
        () => {
          for (const t of treeReg) scene.remove(t.g);
          if (foliageRef.inst) scene.remove(foliageRef.inst);
        });
      if (ok) toast('📸 Real trees loaded (' + path.replace('assets/', '') + ')', 3);
    });
    tryModel('rock.glb', ['assets/rock.glb', 'assets/rock/scene.gltf', 'assets/rock/scene.glb'], (sc, path) => {
      const ok = instSwap(sc, rockReg,
        (t, size) => (t.r * 2.2) / Math.max(size.x, size.z, 0.0001),
        () => { for (const t of rockReg) scene.remove(t.m); });
      if (ok) toast('📸 Real rocks loaded (' + path.replace('assets/', '') + ')', 3);
    });
  }
})();

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
  if (!pmats[key]) pmats[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0, envMapIntensity: 0.45 }, opts));
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
  const skinM = pmat(cfg.skin, { roughness: 0.55, envMapIntensity: 0.55 });
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
    if (a === parts.lArm) parts.lHand = hand; else parts.rHand = hand;
  }
  if (cfg.ring) { // the engagement ring, of course
    const band = new THREE.Mesh(new THREE.TorusGeometry(h * 0.028, h * 0.006, 6, 12), pmat(0xe8e4da, { roughness: 0.15, metalness: 0.95 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = h * 0.01;
    parts.lHand.add(band);
    const gem = sph(h * 0.011, pmat(0xf4faff, { roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4 }), 8, 6);
    gem.position.set(0, h * 0.01, h * 0.03);
    parts.lHand.add(gem);
  }
  if (cfg.leather) { // jacket details: open collar, zipper line, white tee
    const collM = pmat(0x1a1816, { roughness: 0.4, metalness: 0.2 });
    for (const s of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(h * 0.05, h * 0.085, h * 0.02), collM);
      lapel.position.set(s * h * 0.055, legH + torsoH * 0.92, h * 0.075);
      lapel.rotation.z = s * 0.5;
      g.add(lapel);
    }
    const tee = sph(h * 0.075, pmat(0xf0eee8, { roughness: 0.8 }), 10, 8);
    tee.scale.set(1.1, 0.9, 0.55);
    tee.position.set(0, legH + torsoH * 0.82, h * 0.055);
    g.add(tee);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(h * 0.008, torsoH * 0.72, h * 0.004), pmat(0x8a8e92, { roughness: 0.3, metalness: 0.8 }));
    zip.position.set(h * 0.035, legH + torsoH * 0.42, h * 0.083);
    g.add(zip);
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
    const iris = sph(R * 0.082, pmat(cfg.eyes, { roughness: 0.12, envMapIntensity: 1 }), 10, 8);
    iris.position.z = R * 0.11;
    eyeG.add(iris);
    const pupil = sph(R * 0.038, pmat(0x14100c, { roughness: 0.1 }), 8, 6);
    pupil.position.z = R * 0.165;
    eyeG.add(pupil);
    const spark = sph(R * 0.016, pmat(0xffffff, { roughness: 0.05, envMapIntensity: 1.5 }), 6, 5); // catchlight
    spark.position.set(-R * 0.035, R * 0.04, R * 0.19);
    eyeG.add(spark);
    // lash line along the upper lid (reads as real eyes at any distance)
    const lash = new THREE.Mesh(new THREE.TorusGeometry(R * 0.15, R * (cfg.liner ? 0.026 : 0.016), 5, 10, Math.PI * 0.9),
      pmat(cfg.liner ? 0x141210 : 0x2e241c, { roughness: 0.4 }));
    lash.rotation.z = (Math.PI - Math.PI * 0.9) / 2;
    lash.position.set(0, R * 0.035, R * 0.09);
    eyeG.add(lash);
    if (cfg.liner) { // the winged eyeliner from the selfie
      const wing = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.02, R * 0.14, 4, 6), pmat(0x141210, { roughness: 0.4 }));
      wing.rotation.z = Math.PI / 2 - s * 0.6;
      wing.position.set(s * R * 0.19, R * 0.08, R * 0.05);
      eyeG.add(wing);
    }
    headG.add(eyeG);
    parts.eyes.push(eyeG);
    // eyebrow — heavier for Eric, slimmer + arched for Jessy
    const browR = R * (cfg.browHeavy ? 0.05 : cfg.liner ? 0.026 : 0.035);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(browR, R * 0.3, 4, 8), cfg.brow ? pmat(cfg.brow, { roughness: 0.7 }) : hairM);
    brow.rotation.z = Math.PI / 2 + s * (cfg.liner ? 0.2 : 0.12);
    brow.position.set(s * R * 0.33, R * (cfg.liner ? 0.38 : 0.36), R * 0.92);
    headG.add(brow);
  }
  // nose
  const nose = sph(R * 0.1, skinM, 10, 8);
  nose.scale.set(0.75, 1, 0.85);
  nose.position.set(0, -R * 0.05, R * 1.0);
  headG.add(nose);
  if (cfg.lips) { // sculpted glossy lips (the selfie's soft smile)
    const lipM = pmat(cfg.lips, { roughness: 0.12, envMapIntensity: 0.9 });
    const upper = sph(R * 0.15, lipM, 12, 8);
    upper.scale.set(1.55, 0.42, 0.55);
    upper.position.set(0, -R * 0.32, R * 0.9);
    headG.add(upper);
    const lower = sph(R * 0.15, lipM, 12, 8);
    lower.scale.set(1.3, 0.55, 0.62);
    lower.position.set(0, -R * 0.42, R * 0.9);
    headG.add(lower);
  } else {
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.2, R * 0.03, 6, 14, Math.PI * 0.85),
      pmat(0x9c5a4a, { roughness: 0.5 })
    );
    mouth.rotation.z = Math.PI + (Math.PI - Math.PI * 0.85) / 2; // arc opens upward = smile
    mouth.position.set(0, -R * 0.34, cfg.beard ? R * 1.04 : R * 0.96);
    headG.add(mouth);
  }
  // hair styles (smooth, rounded)
  if (cfg.style === 'short') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
    cap.scale.set(0.96, 1.02, 1);
    cap.rotation.x = -0.42; // hairline up in front
    cap.castShadow = true;
    headG.add(cap);
  } else if (cfg.style === 'long') { // Jessy: long chestnut waves, side-swept, sun-lightened strands
    const hairHi = pmat(0x7a563a, { roughness: 0.6 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairM);
    cap.rotation.x = -0.28;
    cap.castShadow = true;
    headG.add(cap);
    const back = sph(R * 0.95, hairM, 16, 12); // full fall of hair down the back
    back.scale.set(1.15, 2.05, 0.8);
    back.position.set(0, -R * 0.75, -R * 0.5);
    headG.add(back);
    for (const s of [-1, 1]) { // wavy side falls: stacked lobes that swing in and out
      for (let seg = 0; seg < 4; seg++) {
        const wave = sph(R * (0.3 - seg * 0.03), seg % 2 ? hairHi : hairM, 10, 8);
        wave.position.set(
          s * R * (0.82 + Math.sin(seg * 1.9) * 0.14),
          R * 0.1 - seg * R * 0.52,
          R * (0.18 - seg * 0.05)
        );
        wave.scale.set(1, 1.35, 0.9);
        headG.add(wave);
      }
    }
    // side-swept bangs crossing from her part toward her left
    const bangs = sph(R * 0.58, hairM, 12, 10);
    bangs.scale.set(1.55, 0.48, 0.72);
    bangs.position.set(-R * 0.22, R * 0.6, R * 0.64);
    bangs.rotation.z = 0.42;
    headG.add(bangs);
    const bangHi = sph(R * 0.3, hairHi, 10, 8); // lighter strand in the sweep
    bangHi.scale.set(1.3, 0.32, 0.6);
    bangHi.position.set(-R * 0.42, R * 0.52, R * 0.7);
    bangHi.rotation.z = 0.45;
    headG.add(bangHi);
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
  if (cfg.noseStud) { // Jessy's gold stud — her left nostril, like the selfie
    const stud = sph(R * 0.036, pmat(0xe0b84f, { roughness: 0.12, metalness: 1, envMapIntensity: 1.3 }), 8, 6);
    stud.position.set(-R * 0.14, -R * 0.09, R * 0.98);
    headG.add(stud);
  }
  if (cfg.beard) { // full trimmed beard: jaw band + chin volume + connected mustache
    const beard = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.03, 20, 12, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.36),
      hairM
    );
    beard.scale.set(0.97, 1.08, 1);
    beard.position.y = -R * 0.02;
    headG.add(beard);
    const chin = sph(R * 0.42, hairM, 12, 9);
    chin.scale.set(1.15, 0.8, 0.7);
    chin.position.set(0, -R * 0.72, R * 0.62);
    headG.add(chin);
    for (const s of [-1, 1]) { // mustache halves angling down to meet the beard
      const st = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.055, R * 0.18, 4, 8), hairM);
      st.rotation.z = Math.PI / 2 + s * 0.35;
      st.position.set(s * R * 0.13, -R * 0.2, R * 0.95);
      headG.add(st);
    }
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
  label.scale.set(1.5, 0.44, 1);
  g.add(label);
  parts.label = label;
  parts.height = h;
  return { group: g, parts };
}

const CHARS = [
  { id: 'eric',  name: 'Eric',  h: 1.82, skin: 0xc98d63, shirt: 0x23211f, sleeve: 0x23211f, pants: 0x2e3440, hair: 0x1d1712, eyes: 0x4a3520, style: 'short', beard: true, leather: true, browHeavy: true, labelColor: '#ffd166', speed: 6.6, jump: 7.2,
    tag: 'Dad · Powered by coffee & dad jokes',
    quips: ['Has anyone seen my coffee? It was RIGHT here.', 'I’m not sleeping, I’m checking my eyelids for holes.', 'Who wants to help me rake 40 billion redwood needles?', 'Grill’s hot. Dad mode: ACTIVATED.'] },
  { id: 'jessy', name: 'Jessy', h: 1.7, skin: 0xe8b48f, shirt: 0xf26f21, sleeve: 0xf26f21, pants: 0x35507a, hair: 0x543822, eyes: 0x93b06e, style: 'long', lips: 0xd0808e, noseStud: true, liner: true, brow: 0x3a2a1c, ring: true, labelColor: '#ff9f6b', speed: 6.9, jump: 7.2,
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
// walkable raised surfaces (jump rock etc.) — you land on them only from above
const PLATFORMS = []; // {x, z, r, y} circles or {minX, maxX, minZ, maxZ, y} rects
function groundYAt(ch) {
  let gy = 0;
  for (const p of PLATFORMS) {
    if (ch.pos.y < p.y - 0.3) continue;
    if (p.r !== undefined) {
      if (Math.hypot(ch.pos.x - p.x, ch.pos.z - p.z) < p.r) gy = Math.max(gy, p.y);
    } else if (ch.pos.x > p.minX && ch.pos.x < p.maxX && ch.pos.z > p.minZ && ch.pos.z < p.maxZ) gy = Math.max(gy, p.y);
  }
  return gy;
}
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
  const gy = groundYAt(ch);
  if (ch.pos.y <= gy) { ch.pos.y = gy; ch.vy = 0; ch.grounded = true; }
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
  for (const b of bubbles) if (b.ch === ch) b.ttl = Math.min(b.ttl, 0.15); // one bubble per person
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  bubbleLayer.appendChild(el);
  // reading time scales with the line — nobody speed-reads while chasing a toddler
  const need = 1.6 + text.split(/\s+/).length * 0.42;
  bubbles.push({ el, ch, ttl: Math.max(secs || 0, need), px: null, py: null });
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
    // target position, clamped so the text never slides off screen
    let tx = (v3.x * 0.5 + 0.5) * window.innerWidth;
    let ty = (-v3.y * 0.5 + 0.5) * window.innerHeight;
    tx = Math.max(110, Math.min(window.innerWidth - 110, tx));
    ty = Math.max(70, Math.min(window.innerHeight - 120, ty));
    // smooth the walk-bob and camera lerp out of it — the text holds still enough to read
    if (b.px === null) { b.px = tx; b.py = ty; }
    const k = Math.min(1, dt * 7);
    b.px += (tx - b.px) * k;
    b.py += (ty - b.py) * k;
    b.el.style.left = b.px + 'px';
    b.el.style.top = b.py + 'px';
    b.el.style.opacity = Math.min(1, b.ttl / 0.3);
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
  drive: '🚗 Licensed to Thrill — drove the Mini',
  stargaze: '🌌 Dark Skies — saw the stars over Felton',
  swim: '🏊 Garden of Eden — took a dip in the San Lorenzo',
  plunge: '🪨 Cannonball! — leapt off the jump rock',
  fremont: '🌲 Inside the Giant — stepped into the Fremont Tree',
  train: '🚂 All Aboard — rode the Roaring Camp railroad',
  photo: '📷 Say Cheese — took a photo',
  fish: '🎣 Gone Fischin’ — caught something in the San Lorenzo',
  lunker: '🐟 Lunker! — landed a steelhead',
  downtown: '🏪 Town Trip — visited downtown Felton',
  zipline: '🚡 Canopy Flyer — rode the redwood zipline',
  timetrial: '🏁 Trailblazer — finished a time trial',
  weather: '🌫️ Marine Layer — saw the fog roll in',
  inside: '🏠 Home Sweet Home — stepped inside 110 River Ln',
  rack: '🎱 Corner Pocket — broke at the pool table',
  tunes: '🎹 Forest Recital — played the piano',
  soak: '🛁 Prune Mode — soaked in the hot tub',
};
const ach = { unlocked: {}, bounceStreak: 0, hifived: {} };
function achCount() { return Object.keys(ach.unlocked).length; }
document.getElementById('achv').textContent = '🏆 0/' + Object.keys(ACH_LIST).length;
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
// set Faylen down gently (called before driving/train/zip/fishing so she doesn't hang in mid-air)
function dropFaylen() {
  const fay = family[5];
  if (fay.riding > 0) {
    fay.riding = 0;
    fay.pos.y = 0;
    fay.parts.lArm.rotation.x = 0; fay.parts.rArm.rotation.x = 0;
    say(fay, 'Down now? Okay!', 2);
  }
}
const SPECIALS = {
  eric: { label: '📢 Dad joke', fn(t) { say(t, '📢 ' + DAD_JOKES[Math.floor(rand(0, DAD_JOKES.length))], 4.5); setTimeout(() => say(player, 'DAAAD. 🙄', 2), 2300); } },
  jessy: { label: '🍎 Ask for snack', fn(t) { say(t, 'Here. Eat. You look like you’re about to do something reckless.', 3); player.buffT = 20; toast('🍎 SNACK POWER! +30% speed for 20s', 3); blip(); } },
  liam: { label: '🏁 Race to mailbox', fn(t) { t.raceTarget = new THREE.Vector3(13.4, 0, -17); raceState = { racing: true, t: 0 }; toast('🏁 RACE! First one to the mailbox! GO GO GO!', 3); say(t, 'You’re about to get DUSTED.', 2.5); } },
  maddie: { label: '💃 Dance party', fn(t) { for (const f of family) if (f.pos.distanceTo(t.pos) < 9) f.danceT = 3; [523, 659, 784, 659, 523, 784].forEach((f2, i) => tone(f2, 0.15, 'triangle', 0.08, i * 0.14)); throwConfetti(t.pos); say(t, 'DANCE BREAK. It’s mandatory.', 2.5); score += 3; } },
  rowan: { label: '🏃 Play tag', fn(t) { t.fleeTag = 15; say(t, 'CAN’T CATCH ME, I HAD JUICE!', 2.5); toast('🏃 Rowan is IT-proof for 15s. Catch him!', 3); } },
  faylen: { label: '🎒 Piggyback', fn(t) { t.riding = 25; say(t, 'UPPY!!! 🥹', 2); toast('🎒 Faylen is aboard. Precious cargo mode: slightly slower.', 3); } },
};
function updateRace(dt) {
  if (!raceState || !raceState.racing) return;
  const liam = family[2];
  const mail = new THREE.Vector3(13.4, 0, -17);
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
  { key: 'mail', label: '📬 Check mail', near: p => Math.hypot(p.x - 14.9, p.z + 17) < 2.2, fn() { toast(MAIL_LINES[Math.floor(rand(0, MAIL_LINES.length))], 3.5); blip(); award('mail'); } },
  { key: 'door', label: '🚪 Go inside', near: p => Math.hypot(p.x - 1.5, p.z + 11.2) < 2.4, fn() { goInside(false); },
    extra: { label: '✊ Knock', fn() { tone(130, 0.08, 'triangle', 0.12); tone(120, 0.08, 'triangle', 0.12, 0.18); setTimeout(() => toast('🚪 “IT’S OPEN!” — just walk in, you live here', 3), 700); } } },
  { key: 'backdoor', label: '🚪 In through the patio doors', near: p => Math.hypot(p.x + 10.5, p.z + 8) < 2, fn() { goInside(true); } },
  { key: 'hottub', label: '🛁 Soak in the hot tub', near: p => Math.hypot(p.x + 11.6, p.z + 16.2) < 2, fn() {
    award('soak'); score += 3;
    tone(rand(350, 500), 0.3, 'sine', 0.05); tone(rand(250, 380), 0.35, 'sine', 0.04, 0.3);
    say(player, ['Ahhhh. Prune mode: engaged. 🛁', 'This is where I live now.', 'Someone bring me a lemonade.'][Math.floor(rand(0, 3))], 3);
  } },
  { key: 'fire', label: '🍫 Make s’more', near: p => Math.hypot(p.x - CAMP.x, p.z - CAMP.z) < 2.8, fn() { score += 3; blip(); say(player, ['Perfectly toasted. I am a s’mores sommelier.', 'Crispy outside, molten core. Chef’s kiss.', 'One for me, zero for sharing.'][Math.floor(rand(0, 3))], 3); award('smore'); } },
  { key: 'river', label: '🪨 Skip a stone', near: p => p.z > 23 && p.z < 27.4, fn() { skipStone(); } },
  { key: 'jumprock', label: '🧗 Climb the jump rock',
    near: p => henryCowell.jumpRock && p.y < 1.5 && Math.hypot(p.x - henryCowell.jumpRock.x, p.z - henryCowell.jumpRock.z) < 3.4,
    fn() { const jr = henryCowell.jumpRock; player.pos.set(jr.x, jr.top, jr.z); player.vy = 0; blip(); toast('🪨 Top of the jump rock! Walk off toward the water… CANNONBALL! 💦', 3.5); } },
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
  if (photo.on) return; // hotkeys are gameplay — photo mode is for framing
  const idx = { KeyE: 0, KeyF: 1, KeyG: 2 }[e.code];
  if (idx !== undefined && currentActions[idx]) { currentActions[idx].fn(currentActions[idx].target); currentKey = ''; }
});
function updateInteractions() {
  if (photo.on) { setActions('photo', []); return; } // no ghost buttons while framing a shot
  // vehicle / train states take priority
  if (car.occupied) { setActions('driving', [{ label: '🚪 Get out', fn: exitCar }]); return; }
  if (RIDE.riding) { setActions('riding', [{ label: '📣 Whistle', fn: trainWhistle }, { label: '🚪 Hop off', fn: hopOffTrain }]); return; }
  if (player) {
    if (car.g.position.distanceTo(player.pos) < 3.4) {
      setActions('car', [
        { label: '🚗 Drive', fn: enterCar },
        { label: '📣 Honk', fn: () => { tone(310, 0.25, 'square', 0.12); tone(392, 0.25, 'square', 0.12); tone(310, 0.3, 'square', 0.12, 0.35); toast('🚗 BEEP BEEP! The Mini is pleased.', 2.5); award('honk'); } },
      ]);
      return;
    }
    if (Math.hypot(player.pos.x - trainPlatform.pos.x, player.pos.z - trainPlatform.pos.z) < 3.5) {
      setActions('train', [{ label: '🚂 Ride the train', fn: boardTrain }]);
      return;
    }
  }
  // Act II states + spots
  if (ACT2.zip.riding) { setActions('ziphold', []); return; }
  if (ACT2.zip.atTop) { setActions('ziptop', [{ label: '🚀 Zip!', fn: rideZip }, { label: '🪜 Climb down', fn: climbDown }]); return; }
  if (ACT2.fishing.active) { setActions('fishhold', []); return; } // fishing bar handles it
  if (ACT2.trial.active) { setActions('trialrun', [{ label: '🏳️ Quit trial', fn: () => endTrial(false) }]); return; }
  if (player && player.pos.x > 270) { // indoors: room-by-room interactions
    const hits = INTERIOR_POIS.filter(a => a.near(player.pos)).slice(0, 3);
    setActions('int:' + hits.map(h => h.label).join(), hits);
    return;
  }
  if (player) {
    if (Math.hypot(player.pos.x - ACT2.dock.x, player.pos.z - (ACT2.dock.z + 2.5)) < 3) {
      setActions('dock', [{ label: '🎣 Fish', fn: startFishing }]); return;
    }
    if (player.pos.y < 3 && Math.hypot(player.pos.x - ACT2.zip.base.x, player.pos.z - ACT2.zip.base.z) < 2.5) {
      setActions('zipbase', [{ label: '🚡 Climb up', fn: climbZip }]); return;
    }
    if (!ACT2.trial.active && Math.hypot(player.pos.x - 3, player.pos.z - 6) < 2.6) {
      setActions('trial', [{ label: '🏁 Time trial', fn: startTrial }]); return;
    }
  }
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
    if (o.near(player.pos)) { setActions('obj:' + o.key, o.extra ? [o, o.extra] : [o]); return; }
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
          k.group.position.set(3.6, 0, -10.8 + rand(-1.6, 1.6)); // waiting by the porch
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
      for (const spot of [[1.7, -9.8], [1.7, -11.9]]) {
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
  if (!ACT2.trial.active) // during a time trial the HUD belongs to the stopwatch
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
  // mid-activity switching strands an invisible driver / remote-controls the rod — finish first
  if (car.occupied || RIDE.riding || ACT2.zip.riding || ACT2.zip.atTop || ACT2.fishing.active) {
    toast('🙅 Finish what you’re doing first! (hop out / climb down / reel in)', 2.5);
    return;
  }
  if (family[5].riding > 0 && ch === family[5]) dropFaylen(); // can't piggyback yourself
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
    if (calendar.message) setTimeout(() => toast(calendar.message, 5), 3500);
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

// ============================================================
//  ACT I — day/night, driving, Henry Cowell, train rides,
//  calendar magic, and photo mode
// ============================================================

// ---- Henry Cowell Redwoods: Fremont Tree + Garden of Eden swimming hole ----
(function buildHenryCowell() {
  // the hollow Fremont Tree you can walk inside (real landmark), NW of the crossing
  const FX = -6, FZ = 48;
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.9, 15, 16, 1, true, Math.PI * 0.28, Math.PI * 1.72),
    new THREE.MeshStandardMaterial({ map: barkTex, bumpMap: barkTex, bumpScale: 0.14, roughness: 1, side: THREE.DoubleSide })
  );
  shell.position.set(FX, 7.5, FZ); shell.castShadow = true; scene.add(shell);
  // dark hollow interior cap
  const capM = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.4, 16), mat(0x140f0a));
  capM.position.set(FX, 3.4, FZ); scene.add(capM);
  for (let i = 0; i < 4; i++) { // canopy way up top
    const cone = new THREE.Mesh(new THREE.ConeGeometry(5 - i, 6, 8), i % 2 ? foliageMat : foliageMat2);
    cone.position.set(FX, 15 + i * 3, FZ); cone.castShadow = true; scene.add(cone);
  }
  // ring of wall colliders leaves a doorway gap facing the crossing (south, -z side open)
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) {
    if (a > Math.PI * 0.75 && a < Math.PI * 1.25) continue; // south doorway
    addCircleCollider(FX + Math.cos(a) * 2.5, FZ + Math.sin(a) * 2.5, 0.55);
  }
  blobs.push({ x: FX, z: FZ, r: 3.2 });
  henryCowell.fremont = { x: FX, z: FZ };

  // Garden of Eden swimming hole — a bend in the San Lorenzo, NE of the crossing
  const PX = 17, PZ = 50, PR = 6.5;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(PR, 32),
    new THREE.MeshPhongMaterial({ map: waterTex, transparent: true, opacity: 0.9, shininess: 110, specular: 0xbfe0ea }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(PX, 0.04, PZ); scene.add(pool);
  const ps = new THREE.Mesh(new THREE.CircleGeometry(PR - 0.3, 24), sparkleMat);
  ps.rotation.x = -Math.PI / 2; ps.position.set(PX, 0.075, PZ); scene.add(ps);
  henryCowell.pool = { x: PX, z: PZ, r: PR, waterY: 0 };
  swimZones.push({ x: PX, z: PZ, r: PR - 0.6 });
  // sandy/rocky rim
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.SphereGeometry(rand(0.35, 0.7), 6, 5), mat(0x7d7c72));
    rock.scale.y = 0.6;
    rock.position.set(PX + Math.cos(a) * (PR + 0.5), 0.12, PZ + Math.sin(a) * (PR + 0.5));
    rock.castShadow = true; scene.add(rock);
  }
  // the jump rock — climb it, leap off, cannonball
  const jr = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), mat(0x6f6e64));
  jr.scale.set(1.1, 1.5, 1.1); jr.position.set(PX - PR - 1.2, 1.4, PZ); jr.castShadow = true; scene.add(jr);
  const step = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 5), mat(0x6f6e64));
  step.scale.set(1.2, 0.7, 1.2); step.position.set(PX - PR - 2.6, 0.5, PZ + 1.2); step.castShadow = true; scene.add(step);
  henryCowell.jumpRock = { x: PX - PR - 1.2, z: PZ, top: 2.9 };
  // both boulders are climbable: the low step, then the jump rock proper
  PLATFORMS.push({ x: PX - PR - 2.6, z: PZ + 1.2, r: 1.15, y: 0.85 });
  PLATFORMS.push({ x: PX - PR - 1.2, z: PZ, r: 1.5, y: 2.9 });
  // a couple of trailhead logs to sit on
  for (const [lx, lz, lr] of [[8, 44, 0.5], [24, 46, 0.4]]) {
    const log = cyl(lr, lr, 3, 0x5f4230, lx, lr, lz, null, 8);
    log.rotation.z = Math.PI / 2; log.rotation.y = rand(0, 3);
    addCircleCollider(lx, lz, 0.6);
  }
})();

// ---- Roaring Camp flag-stop platform at the level crossing ----
(function buildPlatform() {
  const PX = 24, PZ = 44;
  const deck = box(4, 0.4, 3, 0x7a5636, PX, 0.2, PZ);
  deck.material = new THREE.MeshLambertMaterial({ map: plankTex });
  box(0.15, 1.6, 0.15, 0x4a3423, PX - 1.8, 1, PZ - 1.3);
  box(0.15, 1.6, 0.15, 0x4a3423, PX + 1.8, 1, PZ - 1.3);
  box(4, 0.15, 0.15, 0x4a3423, PX, 1.75, PZ - 1.3);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = '#3a2a18'; c.fillRect(0, 0, 256, 64);
  c.fillStyle = '#f2d9a0'; c.font = 'bold 26px Georgia'; c.textAlign = 'center';
  c.fillText('ROARING CAMP', 128, 28); c.fillText('FLAG STOP', 128, 54);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  sign.position.set(PX, 2.4, PZ - 1.22); scene.add(sign);
  addCircleCollider(PX - 1.8, PZ - 1.3, 0.3); addCircleCollider(PX + 1.8, PZ - 1.3, 0.3);
  trainPlatform.pos = { x: PX, z: PZ };
})();

// ---- Night sky: stars, Milky Way, moon ----
(function buildNightSky() {
  const N = 1400;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cc = new THREE.Color();
  for (let i = 0; i < N; i++) {
    // upper hemisphere of a big sphere
    const theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random()); // 0..π/2 from zenith
    const R = 260;
    let x = Math.sin(phi) * Math.cos(theta), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(theta);
    // condense some into a Milky Way band
    if (Math.random() < 0.4) {
      const band = theta;
      x = Math.cos(band); z = Math.sin(band); y = rand(0.25, 0.75) + Math.sin(band * 3) * 0.05;
      const n = Math.hypot(x, y, z); x /= n; y /= n; z /= n;
    }
    pos[i * 3] = x * R; pos[i * 3 + 1] = Math.abs(y) * R + 8; pos[i * 3 + 2] = z * R;
    const w = rand(0.6, 1); cc.setRGB(w, w, rand(0.85, 1));
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  starsRef = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.4, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, sizeAttenuation: true,
  }));
  scene.add(starsRef);
  // moon
  const mcv = document.createElement('canvas'); mcv.width = mcv.height = 128;
  const mc = mcv.getContext('2d');
  const mg = mc.createRadialGradient(64, 64, 8, 64, 64, 62);
  mg.addColorStop(0, 'rgba(255,255,245,1)'); mg.addColorStop(0.5, 'rgba(240,242,230,0.7)'); mg.addColorStop(1, 'rgba(230,235,220,0)');
  mc.fillStyle = mg; mc.fillRect(0, 0, 128, 128);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mcv), transparent: true, depthWrite: false, fog: false, opacity: 0, blending: THREE.AdditiveBlending }));
  moon.scale.setScalar(26); moon.position.set(-120, 130, -120); scene.add(moon);
  nightSky.moon = moon;
})();

// ---- Fireflies over the yard at night ----
(function fireflies() {
  const N = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = [];
  for (let i = 0; i < N; i++) {
    let x = rand(-20, 20), z = rand(-26, 12);
    while (x > -10.5 && x < 2.5 && z < -0.5) { x = rand(-20, 20); z = rand(-26, 12); } // not inside the house
    pos[i * 3] = x; pos[i * 3 + 1] = rand(0.4, 2.6); pos[i * 3 + 2] = z;
    seed.push({ x, z, ph: rand(0, 9), sp: rand(0.3, 0.8) });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const fcv = document.createElement('canvas'); fcv.width = fcv.height = 32;
  const fc = fcv.getContext('2d');
  const fg = fc.createRadialGradient(16, 16, 1, 16, 16, 15);
  fg.addColorStop(0, 'rgba(255,255,220,1)'); fg.addColorStop(0.4, 'rgba(216,255,138,0.6)'); fg.addColorStop(1, 'rgba(216,255,138,0)');
  fc.fillStyle = fg; fc.fillRect(0, 0, 32, 32);
  firefliesRef = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xd8ff8a, size: 0.3, map: new THREE.CanvasTexture(fcv), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
  }));
  firefliesRef.userData.seed = seed;
  scene.add(firefliesRef);
})();

// ---- Player flashlight (auto-on after dark, on foot) ----
flashlight = new THREE.SpotLight(0xfff0d0, 0, 26, 0.5, 0.6, 1.3);
flashlight.position.set(0, 2, 0);
const flashTarget = new THREE.Object3D();
scene.add(flashTarget);
flashlight.target = flashTarget;
scene.add(flashlight);

// ---- Day/night driver ----
function updateDayNight(dt, now) {
  if (dayNight.override == null) dayNight.t = (dayNight.t + dt / 300) % 1; // ~5 min full cycle
  else dayNight.t = dayNight.override;
  const t = dayNight.t;
  const sunH = Math.sin((t - 0.25) * Math.PI * 2);       // +1 noon, -1 midnight
  const az = t * Math.PI * 2;
  dayNight.dayF = Math.max(0, Math.min(1, (sunH + 0.12) / 0.3));
  dayNight.nightF = 1 - dayNight.dayF;
  const dF = dayNight.dayF, nF = dayNight.nightF;
  // sun light — anchored to the player so its tight shadow frustum covers wherever you are
  const sunDX = Math.cos(az) * 60, sunDY = Math.max(-8, sunH * 72), sunDZ = Math.sin(az) * 45 + 6;
  const ax = player ? player.pos.x : 0, az2 = player ? player.pos.z : 0;
  sun.position.set(ax + sunDX, sunDY, az2 + sunDZ);
  sun.target.position.set(ax, 0, az2);
  sun.target.updateMatrixWorld();
  const horizon = Math.max(0, 1 - Math.abs(sunH) * 3); // orange near sunrise/sunset
  sun.color.setRGB(1, 0.85 - horizon * 0.25 + dF * 0.05, 0.62 + dF * 0.28 - horizon * 0.2);
  sun.color.lerp(new THREE.Color(0.68, 0.76, 1.0), nF); // …and cool moonlight after dark
  sun.intensity = 0.14 * nF + 0.05 + dF * 1.55;
  hemi.intensity = 0.24 + dF * 0.68;             // higher fill so shaded faces aren't black
  hemi.color.setRGB(0.1 + dF * 0.52, 0.16 + dF * 0.6, 0.28 + dF * 0.62);
  hemi.groundColor.setRGB(0.05 + dF * 0.1, 0.08 + dF * 0.14, 0.05 + dF * 0.08);
  // sky dome + fog
  if (domeRef) domeRef.material.color.setRGB(0.06 + dF * 0.94, 0.08 + dF * 0.92, 0.2 + dF * 0.8);
  scene.background.setRGB(0.04 + dF * 0.58, 0.06 + dF * 0.72, 0.14 + dF * 0.78);
  scene.fog.color.setRGB(0.09 + dF * 0.62, 0.12 + dF * 0.66, 0.2 + dF * 0.52);
  // sun glow sprite
  if (sunGlowRef) {
    sunGlowRef.position.set(sunDX, sunDY, sunDZ).normalize().multiplyScalar(230);
    sunGlowRef.material.opacity = Math.max(0, dF - 0.1) + horizon * 0.5 * dF;
    sunGlowRef.scale.setScalar(85 + horizon * 40);
  }
  // stars + moon
  if (starsRef) starsRef.material.opacity = nF;
  if (nightSky.moon) {
    nightSky.moon.material.opacity = nF * 0.9;
    nightSky.moon.position.set(Math.cos(az + Math.PI) * 150, Math.max(20, -sunH * 120 + 30), Math.sin(az + Math.PI) * 150);
  }
  // clouds dim, fireflies glow, night lamps
  for (const m of cloudMats) { m.opacity = 0.12 + dF * 0.8; m.color.setRGB(0.35 + dF * 0.65, 0.38 + dF * 0.62, 0.45 + dF * 0.55); }
  if (firefliesRef) firefliesRef.material.opacity = nF * (0.5 + Math.sin(now * 0.004) * 0.5);
  if (porchLight) porchLight.intensity = nF * 1.5;
  for (const b of nightBulbMats) {
    if (b.lightRef) { b.lightRef.intensity = nF * 1.3; continue; } // street/porch point lights
    if (b.window) { const e = b.m.emissive; e.setHex(b.base); e.multiplyScalar(nF * 0.72); }
    else { const tw = 0.6 + Math.sin(now * 0.006 + (b.twinkle || 0)) * 0.4; b.m.emissive.setHex(b.base); b.m.emissive.multiplyScalar(0.3 + nF * tw); }
  }
  renderer.toneMappingExposure = 1.0 + nF * 0.08; // tiny lift so night is moody, not black
  if (bloomPass) bloomPass.strength = 0.22 + nF * 0.33; // lamps, windows and fire glow at night
  const shaftF = Math.pow(dF, 1.6) * (ACT2.weather === 0 ? 1 : ACT2.weather === 1 ? 0.35 : 0);
  for (const s of shaftMats) s.m.opacity = s.base * shaftF;
  for (const l of intLights) l.li.intensity = l.base * (0.55 + nF * 1.15); // lamps carry the rooms at night
  for (const v of intViews) v.color.setRGB(0.25 + dF * 0.75, 0.28 + dF * 0.72, 0.38 + dF * 0.62);
}

// ---- Flashlight + fireflies motion (called each frame) ----
function updateNightFX(dt, now) {
  if (firefliesRef && dayNight.nightF > 0.05) {
    const arr = firefliesRef.geometry.attributes.position.array;
    const seed = firefliesRef.userData.seed;
    for (let i = 0; i < seed.length; i++) {
      const s = seed[i];
      arr[i * 3] = s.x + Math.sin(now * 0.0008 * s.sp + s.ph) * 2.2;
      arr[i * 3 + 1] = 0.5 + (Math.sin(now * 0.0011 + s.ph) * 0.5 + 0.5) * 2.2;
      arr[i * 3 + 2] = s.z + Math.cos(now * 0.0007 * s.sp + s.ph * 1.3) * 2.2;
    }
    firefliesRef.geometry.attributes.position.needsUpdate = true;
  }
  const onFoot = player && !car.occupied && !RIDE.riding && !photo.on && player.pos.x < 270;
  if (flashlight) {
    const want = (onFoot && dayNight.nightF > 0.4) ? 1.6 * dayNight.nightF : 0;
    flashlight.intensity += (want - flashlight.intensity) * Math.min(1, dt * 6);
    if (player) {
      flashlight.position.set(player.pos.x, player.pos.y + 1.6, player.pos.z);
      flashTarget.position.set(
        player.pos.x + Math.sin(player.heading) * 8,
        player.pos.y + 0.3,
        player.pos.z + Math.cos(player.heading) * 8
      );
    }
  }
  // stargazing achievement
  if (onFoot && dayNight.nightF > 0.8) award('stargaze');
}

// ---- Driving the Mini ----
function enterCar() {
  if (!player || car.occupied) return;
  dropFaylen();
  car.occupied = true;
  car.heading = car.g.rotation.y;
  colliders[car.colliderIndex].disabled = true;
  player.group.visible = false;
  toast('🚗 You’re driving! WASD / joystick to drive · tap 🚪 to hop out', 4);
  tone(90, 0.3, 'sawtooth', 0.06);
  award('drive');
}
function exitCar() {
  if (!car.occupied) return;
  car.occupied = false;
  car.speed = 0;
  car.headlight.intensity = 0;
  // re-park the collider around wherever the car actually is now
  const cc = colliders[car.colliderIndex];
  cc.minX = car.g.position.x - 1.9; cc.maxX = car.g.position.x + 1.9;
  cc.minZ = car.g.position.z - 1.9; cc.maxZ = car.g.position.z + 1.9;
  cc.disabled = false;
  player.group.visible = true;
  // step out beside the driver door
  player.pos.set(car.g.position.x - Math.cos(car.heading) * 2.2, 0, car.g.position.z + Math.sin(car.heading) * 2.2);
  collide(player.pos, 0.45);
}
function updateDriving(dt, now) {
  let throttle = 0, steer = 0;
  if (keys.KeyW || keys.ArrowUp) throttle += 1;
  if (keys.KeyS || keys.ArrowDown) throttle -= 1;
  if (keys.KeyA || keys.ArrowLeft) steer -= 1;
  if (keys.KeyD || keys.ArrowRight) steer += 1;
  throttle += -touch.vz; steer += touch.vx;
  const maxSpd = 17;
  car.speed += throttle * 14 * dt;
  car.speed *= (1 - 1.1 * dt);                       // rolling friction
  car.speed = Math.max(-6, Math.min(maxSpd, car.speed));
  if (Math.abs(car.speed) > 0.15) {
    car.heading -= steer * 1.5 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 4);
  }
  const nx = car.g.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.g.position.z + Math.cos(car.heading) * car.speed * dt;
  const p = new THREE.Vector3(nx, 0, nz);
  collide(p, 1.5);
  if (p.distanceTo(car.g.position) < Math.abs(car.speed) * dt * 0.5) car.speed *= 0.4; // bumped something
  car.g.position.x = p.x; car.g.position.z = p.z;
  car.g.rotation.y = car.heading;
  for (const w of car.wheels) w.rotation.x += car.speed * dt * 3;
  car.headlight.intensity = dayNight.nightF * 2.2;
  // glue player + camera to the car
  player.pos.set(car.g.position.x, 0.9, car.g.position.z);
  player.heading = car.heading;
  if (Math.abs(car.speed) > 6 && Math.random() < 0.04) tone(70 + Math.abs(car.speed) * 3, 0.1, 'sawtooth', 0.03);
}

// ---- Swimming (Garden of Eden) ----
function applySwim(ch) {
  for (const z of swimZones) {
    if (Math.hypot(ch.pos.x - z.x, ch.pos.z - z.z) < z.r) {
      const bob = Math.sin(performance.now() * 0.004) * 0.06;
      if (ch.pos.y < -0.15) ch === player && ch.vy > -3 && (ch.vy = 0);
      ch.pos.y = -0.28 + bob;
      ch.vy = 0; ch.grounded = true;
      // paddle
      ch.parts.lArm.rotation.x = Math.sin(performance.now() * 0.01) * 1.2 - 0.5;
      ch.parts.rArm.rotation.x = -Math.sin(performance.now() * 0.01) * 1.2 - 0.5;
      if (ch === player) {
        award('swim');
        if (!applySwim.splashT || performance.now() - applySwim.splashT > 700) {
          applySwim.splashT = performance.now();
          tone(rand(400, 700), 0.08, 'sine', 0.04);
        }
      }
      return true;
    }
  }
  return false;
}

// ---- Riding the Roaring Camp train ----
function boardTrain() {
  if (RIDE.riding || !player) return;
  dropFaylen();
  RIDE.riding = true;
  player.group.visible = false;
  // launch the train from the west heading east
  train.phase = 'run'; train.t = 26; train.dir = 1;
  train.g.position.x = -60; train.g.rotation.y = 0;
  trainWhistle();
  toast('🚂 All aboard! Pulling out of the station… tap 🚪 to hop off', 4.5);
  award('train');
}
function hopOffTrain() {
  if (!RIDE.riding) return;
  RIDE.riding = false;
  player.group.visible = true;
  // step down beside the train wherever it is (fall back to the platform once it's gone)
  if (train.phase === 'run' && Math.abs(train.g.position.x) < 85) {
    player.pos.set(train.g.position.x, 0, 39.9);
    collide(player.pos, 0.45);
  } else {
    player.pos.set(trainPlatform.pos.x, 0, trainPlatform.pos.z + 2);
  }
}
function updateRiding(dt) {
  // seat the player on the open excursion car (local +x ~4.9 from the loco)
  const seatX = train.g.position.x + (train.dir > 0 ? 4.9 : -4.9);
  player.pos.set(seatX, 1.7, 41.8);
  player.heading = train.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  if (train.phase !== 'run') hopOffTrain(); // ride ended, drop back at platform
}

// ---- Calendar magic: real dates decorate the yard ----
(function buildCalendar() {
  const BIRTHDAYS = [
    { name: 'Liam', m: 4, d: 9 }, { name: 'Maddie', m: 8, d: 29 },
    { name: 'Rowan', m: 8, d: 3 }, { name: 'Faylen', m: 11, d: 13 },
  ];
  const now = new Date();
  const M = now.getMonth() + 1, D = now.getDate();
  function balloon(x, z, color) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat(color));
    b.scale.y = 1.25; b.position.y = 3.0; b.castShadow = true; g.add(b);
    cyl(0.01, 0.01, 2.7, 0xbbbbbb, 0, 1.65, 0, g, 4);
    swayers.push({ obj: b, phase: rand(0, 9), amp: 0.08 });
    return g;
  }
  const todayBday = BIRTHDAYS.find(b => b.m === M && b.d === D);
  if (todayBday) {
    const colors = [0xff5a5a, 0x6bb8ff, 0xffd166, 0x7ee08a, 0xd9a3ff];
    for (let i = 0; i < 8; i++) balloon(4.5 + (i % 2) * 1.4, -12.5 + i * 1.5, colors[i % 5]);
    // banner across the porch
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = '#ff4d6d'; c.fillRect(0, 0, 512, 96);
    c.fillStyle = '#fff'; c.font = 'bold 44px Trebuchet MS'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('HAPPY BIRTHDAY ' + todayBday.name.toUpperCase() + '!', 256, 50);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
    banner.position.set(2, 5.6, -7); banner.rotation.y = Math.PI / 2; scene.add(banner);
    // cake on the picnic table
    const cake = cyl(0.5, 0.55, 0.4, 0xfff0e0, 30.5, 1.0, 19.2, null, 16);
    cyl(0.5, 0.5, 0.06, 0xffb3c8, 30.5, 1.25, 19.2, null, 16);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(0.02, 0.02, 0.2, 0xffe08a, 30.5 + Math.cos(a) * 0.3, 1.4, 19.2 + Math.sin(a) * 0.3, null, 4); }
    calendar.message = '🎂 It’s ' + todayBday.name + '’s birthday today! The yard threw a party.';
  } else if (M === 12 && D <= 26) {
    // holiday string lights along the eaves + a wreath
    for (let i = 0; i <= 14; i++) {
      const bm = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: [0xd83a3a, 0x3ad86a, 0xffd166, 0x6bb8ff][i % 4] });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), bm);
      bulb.position.set(0.7, 5.4 - Math.sin(i / 14 * Math.PI) * 0.2, -13 + i * 0.86);
      scene.add(bulb); nightBulbMats.push({ m: bm, base: [0xd83a3a, 0x3ad86a, 0xffd166, 0x6bb8ff][i % 4], twinkle: i });
    }
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.14, 8, 16), mat(0x2f6a34));
    wreath.position.set(0.95, 2.4, -11.2); wreath.rotation.y = Math.PI / 2; scene.add(wreath);
    calendar.message = '🎄 Happy Holidays from Felton! The eaves are all lit up.';
  } else if (M === 10 && D >= 20) {
    // jack-o'-lanterns on the porch
    for (const px of [-8.7, -12.3]) {
      const pm = new THREE.MeshStandardMaterial({ color: 0xe8731f, emissive: 0x341300, roughness: 0.7 });
      const pk = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), pm);
      pk.scale.y = 0.82; pk.position.set(3.1, 0.5, px); scene.add(pk);
      nightBulbMats.push({ m: pm, base: 0xff7a1a, twinkle: px });
    }
    calendar.message = '🎃 Spooky season in the redwoods! Pumpkins on the porch.';
  } else {
    // everyday: gently count down to the next birthday so the calendar always feels alive
    let best = null, bestDays = 999;
    for (const b of BIRTHDAYS) {
      let d = new Date(now.getFullYear(), b.m - 1, b.d);
      if (d < now) d = new Date(now.getFullYear() + 1, b.m - 1, b.d);
      const days = Math.ceil((d - now) / 86400000);
      if (days < bestDays) { bestDays = days; best = b; }
    }
    if (best) calendar.message = `📅 ${bestDays} day${bestDays === 1 ? '' : 's'} until ${best.name}’s birthday!`;
  }
})();

// ---- Photo mode ----
const flashEl = document.createElement('div');
flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:30;transition:opacity .35s';
document.body.appendChild(flashEl);
function togglePhoto() {
  photo.on = !photo.on;
  const hud = document.getElementById('hud');
  hud.style.opacity = photo.on ? '0' : '1';
  hud.style.pointerEvents = photo.on ? 'none' : 'auto'; // faded HUD must not eat taps
  document.getElementById('bubbles').style.display = photo.on ? 'none' : 'block';
  document.getElementById('photobar').style.display = photo.on ? 'flex' : 'none';
  if (photo.on) toast('📷 Photo Mode — drag to aim, tap 📸 to capture', 3);
}
function capturePhoto() {
  flashEl.style.opacity = '0.85';
  setTimeout(() => { flashEl.style.opacity = '0'; }, 60);
  tone(1200, 0.05, 'sine', 0.05); tone(1800, 0.05, 'sine', 0.04, 0.05);
  try {
    if (composer) composer.render(); else renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'fisch-family-' + Date.now() + '.png';
    a.click();
    award('photo');
  } catch (e) { toast('Could not save photo on this device 😕', 3); }
}

// ---- Act I HUD controls (built in JS to avoid touching the shell) ----
(function actIControls() {
  const cluster = document.createElement('div');
  cluster.id = 'actglobal';
  cluster.style.cssText = 'position:fixed;z-index:12;right:calc(env(safe-area-inset-right,0px) + 60px);top:calc(env(safe-area-inset-top,0px) + 8px);display:flex;gap:6px;';
  function btn(label, title, fn) {
    const b = document.createElement('button');
    b.className = 'ui'; b.textContent = label; b.title = title;
    b.style.cssText = 'width:40px;height:40px;border-radius:50%;border:2px solid #ffffffaa;background:rgba(12,26,18,0.75);font-size:18px;cursor:pointer;';
    b.addEventListener('click', () => { initAudio(); fn(); });
    cluster.appendChild(b);
  }
  btn('🌗', 'Cycle time of day', cycleTimeOfDay);
  btn('📷', 'Photo mode', togglePhoto);
  document.body.appendChild(cluster);

  const pbar = document.createElement('div');
  pbar.id = 'photobar';
  pbar.style.cssText = 'display:none;position:fixed;z-index:31;bottom:calc(env(safe-area-inset-bottom,0px) + 24px);left:50%;transform:translateX(-50%);gap:10px;';
  const shoot = document.createElement('button');
  shoot.className = 'ui'; shoot.textContent = '📸 Capture';
  shoot.style.cssText = 'background:rgba(12,26,18,0.9);color:#fff;border:2px solid #ffd166;border-radius:24px;padding:12px 20px;font-weight:bold;font-size:16px;cursor:pointer;';
  shoot.addEventListener('click', capturePhoto);
  const exitp = document.createElement('button');
  exitp.className = 'ui'; exitp.textContent = '✕ Exit';
  exitp.style.cssText = 'background:rgba(12,26,18,0.9);color:#fff;border:2px solid #ffffff77;border-radius:24px;padding:12px 18px;font-weight:bold;font-size:16px;cursor:pointer;';
  exitp.addEventListener('click', togglePhoto);
  pbar.appendChild(shoot); pbar.appendChild(exitp);
  document.body.appendChild(pbar);
})();
const TIME_STOPS = [0.42, 0.72, 0.78, 0.86, 0.0]; // morning, afternoon, sunset, dusk, night
let timeStopIdx = 0;
function cycleTimeOfDay() {
  timeStopIdx = (timeStopIdx + 1) % TIME_STOPS.length;
  dayNight.override = TIME_STOPS[timeStopIdx];
  const names = ['☀️ Morning', '🌤️ Afternoon', '🌅 Sunset', '🌆 Dusk', '🌙 Night'];
  toast(names[timeStopIdx] + '  (tap 🌗 again to change, it resumes drifting after a bit)', 3);
  clearTimeout(cycleTimeOfDay.tmr);
  cycleTimeOfDay.tmr = setTimeout(() => { dayNight.override = null; }, 25000);
}
window.addEventListener('keydown', e => {
  if (e.code === 'KeyT') cycleTimeOfDay();
  if (e.code === 'KeyP') togglePhoto();
});

// ============================================================
//  ACT II — Greater Felton: downtown, fishing, zipline,
//  weather, and family time-trials
// ============================================================
const ACT2 = {
  fishing: { active: false, phase: 'idle', t: 0, window: 0, caught: 0 },
  zip: { riding: false, t: 0, start: null, end: null },
  trial: { active: false, t: 0, cp: 0, rings: [], best: {} },
  weather: 0, // 0 clear · 1 marine-layer fog · 2 rain
  dock: { x: 5, z: 26.6 },
};
try { ACT2.trial.best = JSON.parse(localStorage.getItem('fisch_trial_best') || '{}'); } catch (e) { ACT2.trial.best = {}; }

// ---- Downtown Felton, west along the lane (Highway 9 vibe) ----
(function downtown() {
  const shopMat = new THREE.MeshLambertMaterial({ map: sidingTex });
  const boardMat = new THREE.MeshLambertMaterial({ map: plankTex });
  // wooden boardwalk fronting the shops
  const walk = box(30, 0.12, 3, 0x6b4a30, -58, 0.09, -37.7);
  walk.material = boardMat;
  function shop(cx, w, h, color, name, awning) {
    const g = new THREE.Group(); g.position.set(cx, 0, -33); g.rotation.y = Math.PI; scene.add(g); // storefronts face the boardwalk + Hwy 9
    const body = box(w, h, 7, color, 0, h / 2, 0, g); body.material = shopMat; body.material = new THREE.MeshLambertMaterial({ map: sidingTex, color });
    // false-front parapet (old-timey main street)
    box(w + 0.4, 1.1, 0.4, color, 0, h + 0.4, 3.3, g).material = new THREE.MeshLambertMaterial({ map: sidingTex, color });
    // awning
    const aw = box(w - 0.4, 0.12, 1.6, awning, 0, h - 0.9, 4.2, g);
    aw.rotation.x = 0.32;
    // windows
    for (const wx of [-w / 4, w / 4]) { const win = box(w * 0.3, 1.3, 0.1, 0x2c4653, wx, 1.5, 3.56, g); win.material = mat(0x2c4653, { emissive: 0x0a1216 }); nightBulbMats.push({ m: win.material, base: 0xffd98a, window: true }); }
    box(1.1, 2.1, 0.12, 0x3a2818, 0, 1.05, 3.56, g); // door
    // hanging sign
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d'); c.fillStyle = '#2a1c10'; c.fillRect(0, 0, 256, 64);
    c.strokeStyle = '#e8cf94'; c.lineWidth = 3; c.strokeRect(4, 4, 248, 56);
    c.fillStyle = '#f2dca0'; c.font = 'bold 30px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(name, 128, 34);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
    sign.position.set(0, h - 0.3, 3.62, g); sign.position.z = 3.62; g.add(sign);
    addBoxCollider(cx - w / 2, cx + w / 2, -36.6, -29.4);
    blobs.push({ x: cx, z: -33, r: w * 0.6 });
  }
  shop(-68, 8, 4, 0xc27a4e, 'FELTON COFFEE', 0xa84636);
  shop(-58, 9, 4.6, 0xa9b199, 'FELTON MARKET', 0x3f7a62);
  shop(-48, 8, 4.2, 0xcbb476, 'THE TRADING POST', 0x4d63a0);
  // street lamps that glow at night
  for (const lx of [-73, -63, -53, -43]) {
    cyl(0.09, 0.12, 4, 0x2b2b2f, lx, 2, -38.9, null, 8);
    const lampM = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x3a2e12 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), lampM);
    lamp.position.set(lx, 4.1, -38.9); scene.add(lamp);
    nightBulbMats.push({ m: lampM, base: 0xffcf7a });
    const lp = new THREE.PointLight(0xffce85, 0, 9, 1.6); lp.position.set(lx, 4, -38.9); scene.add(lp);
    nightBulbMats.push({ lightRef: lp });
  }
  ACT2.downtownCenter = { x: -58, z: -33 };
})();

// ---- Fishing dock on the San Lorenzo ----
(function fishingDock() {
  const boardMat = new THREE.MeshLambertMaterial({ map: plankTex });
  const d = box(2.4, 0.16, 5, 0x6b4a30, ACT2.dock.x, 0.14, ACT2.dock.z + 1.6, null); d.material = boardMat;
  for (const dz of [ACT2.dock.z, ACT2.dock.z + 3.2]) { cyl(0.1, 0.1, 0.9, 0x4a3420, ACT2.dock.x - 1, 0.2, dz, null, 6); cyl(0.1, 0.1, 0.9, 0x4a3420, ACT2.dock.x + 1, 0.2, dz, null, 6); }
  // bobber (hidden until fishing)
  const bob = new THREE.Group();
  const ball = sph(0.16, mat(0xd83a3a), 10, 8); ball.position.y = 0.1; bob.add(ball);
  const btm = sph(0.16, mat(0xf2f2f2), 10, 8); btm.position.y = -0.06; btm.scale.y = 0.6; bob.add(btm);
  bob.position.set(ACT2.dock.x, 0.1, ACT2.dock.z + 5.5); bob.visible = false; scene.add(bob);
  ACT2.fishing.bobber = bob;
})();

// ---- Redwood-canopy zipline ----
(function ziplineBuild() {
  const S = new THREE.Vector3(-27, 13, -18), E = new THREE.Vector3(-16, 2.2, 3);
  ACT2.zip.start = S; ACT2.zip.end = E;
  // start tower: a platform lashed high on a trunk, with a ladder
  const post = cyl(0.3, 0.4, 14, 0x5a3f28, S.x, 7, S.z, null, 8);
  const plat = box(3, 0.2, 3, 0x6b4a30, S.x, S.y - 0.2, S.z); plat.material = new THREE.MeshLambertMaterial({ map: plankTex });
  for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]]) cyl(0.06, 0.06, 1, 0x3a2818, S.x + ox, S.y + 0.5, S.z + oz, null, 5);
  addCircleCollider(S.x, S.z, 0.6);
  // landing pole
  cyl(0.15, 0.2, 2.4, 0x5a3f28, E.x, 1.2, E.z, null, 8);
  // the cable
  const cableGeo = new THREE.BufferGeometry().setFromPoints([S.clone().add(new THREE.Vector3(0, 0.3, 0)), E.clone().add(new THREE.Vector3(0, 1.6, 0))]);
  scene.add(new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
  // pulley handle the rider hangs from
  const handle = new THREE.Group();
  const bar = cyl(0.05, 0.05, 0.5, 0x777, 0, 0, 0, handle, 6); bar.rotation.z = Math.PI / 2;
  handle.visible = false; scene.add(handle);
  ACT2.zip.handle = handle;
  ACT2.zip.base = { x: S.x, z: S.z };
})();

// ---- Time-trial checkpoint rings (hidden until a run starts) ----
(function trialBuild() {
  const path = [[3, 6], [-11, 3], [-16, -10], [-12, -21], [-4, -31], [9, -22], [4, 6]];
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.16, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x3a2e00, transparent: true, opacity: 0.85 }));
    ring.position.set(x, 1.7, z); ring.rotation.y = Math.PI / 2; ring.visible = false;
    scene.add(ring);
    ACT2.trial.rings.push({ m: ring, x, z, last: i === path.length - 1 });
  }
})();

// ---- Rain system ----
(function rainBuild() {
  const N = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rand(-40, 40); pos[i * 3 + 1] = rand(0, 40); pos[i * 3 + 2] = rand(-40, 40); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fb4c4, size: 0.14, transparent: true, opacity: 0, depthWrite: false }));
  rain.visible = false; scene.add(rain);
  ACT2.rain = rain;
})();

// ---- Fishing ----
function startFishing() {
  if (ACT2.fishing.active) return;
  dropFaylen();
  ACT2.fishing.active = true; ACT2.fishing.phase = 'idle';
  document.getElementById('fishbar').style.display = 'flex';
  fishStatus('🎣 Tap CAST to drop your line');
}
function fishStatus(t) { const e = document.getElementById('fishstatus'); if (e) e.textContent = t; }
function castLine() {
  const f = ACT2.fishing;
  if (f.phase === 'waiting' || f.phase === 'bite') return;
  f.phase = 'waiting'; f.t = rand(1.6, 4.5);
  f.bobber.visible = true; f.bobber.position.set(ACT2.dock.x, 0.1, ACT2.dock.z + 5.5);
  fishStatus('🎣 Waiting for a bite…');
  tone(300, 0.12, 'sine', 0.05);
}
function reelIn() {
  const f = ACT2.fishing;
  if (f.phase === 'bite') {
    f.phase = 'idle';
    const roll = Math.random();
    let msg, pts;
    if (roll < 0.12) { msg = '🥾 …an old boot. Classic.'; pts = 1; }
    else if (roll < 0.2) { msg = '🐌 A banana slug. In the RIVER? Greg, explain.'; pts = 2; }
    else if (roll < 0.55) { msg = '🐟 A rainbow trout!'; pts = 5; }
    else if (roll < 0.85) { msg = '🐠 A feisty smallmouth bass!'; pts = 6; }
    else { msg = '🐟✨ A STEELHEAD! The one Dad brags about!'; pts = 12; award('lunker'); }
    f.caught++; score += pts;
    fanfare(); f.bobber.visible = false;
    toast(msg + '  (+' + pts + ')  ·  caught today: ' + f.caught, 3.5);
    award('fish');
    fishStatus('🎣 Nice! Tap CAST to go again');
  } else if (f.phase === 'waiting') {
    f.phase = 'idle'; f.bobber.visible = false;
    fishStatus('🎣 Reeled in early — nothing. Tap CAST');
    tone(180, 0.15, 'triangle', 0.05);
  }
}
function endFishing() {
  ACT2.fishing.active = false; ACT2.fishing.phase = 'idle';
  ACT2.fishing.bobber.visible = false;
  document.getElementById('fishbar').style.display = 'none';
}
function updateFishing(dt, now) {
  const f = ACT2.fishing;
  if (!f.active) return;
  if (f.bobber.visible) f.bobber.position.y = 0.1 + Math.sin(now * 0.004) * 0.04;
  if (f.phase === 'waiting') {
    f.t -= dt;
    if (f.t <= 0) { f.phase = 'bite'; f.window = 1.4; fishStatus('‼️ BITE!! Tap REEL!'); tone(880, 0.08, 'square', 0.09); tone(1180, 0.1, 'square', 0.07, 0.08); }
  } else if (f.phase === 'bite') {
    f.window -= dt;
    f.bobber.position.y = 0.1 - Math.abs(Math.sin(now * 0.03)) * 0.25; // dipping
    if (f.window <= 0) { f.phase = 'idle'; f.bobber.visible = false; fishStatus('🎣 It got away! Tap CAST'); tone(160, 0.2, 'triangle', 0.05); }
  }
}

// ---- Zipline ----
function climbZip() {
  if (!player || ACT2.zip.riding) return;
  dropFaylen();
  ACT2.zip.atTop = true;
  player.pos.copy(ACT2.zip.start);
  toast('🚡 You’re up in the canopy! Tap 🚀 Zip! to fly', 3.5);
}
function climbDown() {
  ACT2.zip.atTop = false;
  player.pos.set(ACT2.zip.base.x + 1.5, 0, ACT2.zip.base.z + 1.5);
}
function rideZip() {
  if (!player) return;
  ACT2.zip.atTop = false;
  ACT2.zip.riding = true; ACT2.zip.t = 0;
  ACT2.zip.handle.visible = true;
  tone(300, 0.5, 'sawtooth', 0.04);
  award('zipline');
}
function updateZip(dt) {
  const z = ACT2.zip;
  z.t += dt / 2.6; // ~2.6s ride
  const k = Math.min(1, z.t);
  const p = z.start.clone().lerp(z.end, k);
  p.y += Math.sin(k * Math.PI) * -0.6 + 1.6 * (1 - k); // slight sag, hang below cable
  player.pos.set(p.x, p.y - 1.4, p.z);
  player.heading = Math.atan2(z.end.x - z.start.x, z.end.z - z.start.z);
  z.handle.position.set(p.x, p.y, p.z);
  if (Math.random() < 0.3) tone(rand(200, 320), 0.05, 'sawtooth', 0.02); // zip whir
  if (k >= 1) { z.riding = false; z.handle.visible = false; player.pos.copy(z.end); player.pos.y = 0; toast('🚡 Stuck the landing! 🌲', 2.5); }
}

// ---- Time-trials with a per-character family leaderboard ----
function startTrial() {
  const tr = ACT2.trial;
  if (tr.active) return;
  tr.active = true; tr.t = 0; tr.cp = 0;
  tr.rings.forEach((r, i) => { r.m.visible = true; r.m.material.color.setHex(i === 0 ? 0x7ee08a : 0xffd166); });
  toast('🏁 GO! Run through the glowing rings in order!', 3);
}
function endTrial(finished) {
  const tr = ACT2.trial;
  tr.active = false;
  tr.rings.forEach(r => r.m.visible = false);
  if (!finished) toast('🏳️ Trial abandoned — the rings will wait.', 2.5);
  if (finished) {
    const id = player.cfg.id, prev = tr.best[id];
    const secs = tr.t;
    const isBest = !prev || secs < prev;
    if (isBest) { tr.best[id] = secs; try { localStorage.setItem('fisch_trial_best', JSON.stringify(tr.best)); } catch (e) {} }
    fanfare(); throwConfetti(player.pos); award('timetrial'); score += 15;
    const board = family.map(f => ({ n: f.cfg.name, t: tr.best[f.cfg.id] }))
      .filter(x => x.t != null).sort((a, b) => a.t - b.t)
      .map((x, i) => `${['🥇', '🥈', '🥉', '4.', '5.', '6.'][i]} ${x.n} ${x.t.toFixed(1)}s`).join('   ');
    toast(`🏁 ${player.cfg.name}: ${secs.toFixed(1)}s${isBest ? ' — NEW BEST! 🎉' : ''}\n${board}`, 6);
  }
}
function updateTrial(dt, now) {
  const tr = ACT2.trial;
  if (!tr.active) return;
  tr.t += dt;
  for (const r of tr.rings) r.m.rotation.z += dt * 1.5;
  const next = tr.rings[tr.cp];
  if (next && Math.hypot(player.pos.x - next.x, player.pos.z - next.z) < 2.1 && Math.abs(player.pos.y - 1.7) < 3) {
    tone(700 + tr.cp * 80, 0.1, 'square', 0.07);
    next.m.visible = false;
    tr.cp++;
    if (tr.cp >= tr.rings.length) { endTrial(true); return; }
    tr.rings[tr.cp].m.material.color.setHex(0x7ee08a);
  }
  setHUD('🏁 Time Trial', 'Ring ' + tr.cp + ' / ' + tr.rings.length + '  ·  keep going!', '⏱️ ' + tr.t.toFixed(1) + 's');
}

// ---- Weather ----
function cycleWeather() {
  ACT2.weather = (ACT2.weather + 1) % 3;
  const names = ['☀️ Clear skies', '🌫️ Marine layer rolling in…', '🌧️ Rain over the redwoods'];
  toast(names[ACT2.weather], 3);
  if (ACT2.weather >= 1) award('weather');
  if (ACT2.rain) ACT2.rain.visible = ACT2.weather === 2;
}
function updateWeather(dt, now) {
  const w = ACT2.weather;
  // fog distance by weather (day/night already set fog colour this frame)
  const targetNear = w === 1 ? 14 : (w === 2 ? 30 : 60);
  const targetFar = w === 1 ? 62 : (w === 2 ? 150 : 240);
  scene.fog.near += (targetNear - scene.fog.near) * Math.min(1, dt * 1.5);
  scene.fog.far += (targetFar - scene.fog.far) * Math.min(1, dt * 1.5);
  if (w === 1) { scene.fog.color.lerp(new THREE.Color(0xd0d6d2), 0.5); scene.background.lerp(new THREE.Color(0xd0d6d2), 0.4); }
  if (w === 2) { scene.fog.color.lerp(new THREE.Color(0x8a95a0), 0.5); scene.background.lerp(new THREE.Color(0x8a95a0), 0.4); sun.intensity *= 0.5; }
  if (ACT2.rain && ACT2.rain.visible) {
    const arr = ACT2.rain.geometry.attributes.position.array;
    const cx = player ? player.pos.x : 0, cz = player ? player.pos.z : 0;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 1] -= 55 * dt;
      if (arr[i + 1] < 0) { arr[i + 1] = 38; arr[i] = cx + rand(-38, 38); arr[i + 2] = cz + rand(-38, 38); }
    }
    ACT2.rain.geometry.attributes.position.needsUpdate = true;
    ACT2.rain.material.opacity = 0.5;
    if (Math.random() < 0.02) tone(rand(1200, 2000), 0.02, 'sine', 0.01);
  }
}

function updateActII(dt, now) {
  updateWeather(dt, now);
  if (!photo.on) { // photo mode freezes the clock on bites and stopwatches
    updateFishing(dt, now);
    updateTrial(dt, now);
  }
  if (ACT2.zip.riding) updateZip(dt);
  // downtown visit achievement
  if (player && ACT2.downtownCenter && Math.hypot(player.pos.x - ACT2.downtownCenter.x, player.pos.z - ACT2.downtownCenter.z) < 14) award('downtown');
}

// ---- Act II HUD: weather button + fishing bar ----
(function actIIControls() {
  const cluster = document.getElementById('actglobal');
  if (cluster) {
    const b = document.createElement('button');
    b.className = 'ui'; b.textContent = '🌦️'; b.title = 'Cycle weather';
    b.style.cssText = 'width:40px;height:40px;border-radius:50%;border:2px solid #ffffffaa;background:rgba(12,26,18,0.75);font-size:18px;cursor:pointer;';
    b.addEventListener('click', () => { initAudio(); cycleWeather(); });
    cluster.appendChild(b);
  }
  const bar = document.createElement('div');
  bar.id = 'fishbar';
  bar.style.cssText = 'display:none;position:fixed;z-index:13;bottom:calc(env(safe-area-inset-bottom,0px) + 84px);left:50%;transform:translateX(-50%);flex-direction:column;align-items:center;gap:8px;';
  const status = document.createElement('div');
  status.id = 'fishstatus';
  status.style.cssText = 'background:rgba(12,26,18,0.9);color:#fff;border:2px solid #6bb8ff;border-radius:14px;padding:8px 16px;font-weight:bold;font-size:15px;';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;';
  function fbtn(label, fn, color) {
    const x = document.createElement('button'); x.className = 'ui'; x.textContent = label;
    x.style.cssText = `background:rgba(12,26,18,0.9);color:#fff;border:2px solid ${color};border-radius:22px;padding:11px 18px;font-weight:bold;font-size:15px;cursor:pointer;`;
    x.addEventListener('click', () => { initAudio(); fn(); });
    row.appendChild(x);
  }
  fbtn('🎣 Cast', castLine, '#7ee08a');
  fbtn('🎯 Reel!', reelIn, '#ffd166');
  fbtn('✕ Done', endFishing, '#ffffff77');
  bar.appendChild(status); bar.appendChild(row);
  document.body.appendChild(bar);
})();
window.addEventListener('keydown', e => {
  if (e.code === 'KeyF' && ACT2.fishing.active) reelIn();
});

// ============================================================
//  INSIDE 110 RIVER LANE — a walk-in interior built from the
//  family's photos: entry/dining, kitchen + nook, the great room
//  with the river-rock fireplace, Liam's room, and upstairs the
//  game room, primary suite and stone bathroom. Lives in its own
//  pocket of space (x≈300) behind the real front door.
// ============================================================
const intLights = [];  // {li, base} warm lamps, brighter after dark
const intViews = [];   // window-view materials, dimmed at night
const fans = [];       // spinning ceiling fans
let hearth = null;     // fireplace flicker
(function buildInterior() {
  const IL = { minX: 288, maxX: 301.5 }; // footprint reference
  // ---- palettes & textures ----
  const laminateTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#6e5138'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      for (let x = -64; x < w; x += 128) {
        c.fillStyle = ['#7a5b40', '#66492f', '#836548', '#5d4229'][Math.floor(rand(0, 4))];
        c.fillRect(x + (y / 32 % 2) * 64, y, 126, 30);
      }
    }
    c.globalAlpha = 0.25; c.strokeStyle = '#4a3320';
    for (let i = 0; i < 120; i++) { const x = rand(0, w), y = rand(0, h); c.beginPath(); c.moveTo(x, y); c.lineTo(x + rand(8, 30), y); c.stroke(); }
    c.globalAlpha = 1;
  }, 3, 3);
  const carpetGreenTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#5e7a5d'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, ['#6e8a6d', '#4e6a4e', '#7e9a7d', '#3e5a3f'], 900, 1, 3);
  }, 6, 6);
  const carpetCreamTex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#cfc7b8'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, ['#dbd4c6', '#c2b9a8'], 500, 1, 3);
  }, 6, 6);
  const stoneTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#8a7a64'; c.fillRect(0, 0, w, h); // river-rock chimney
    for (let i = 0; i < 90; i++) {
      c.fillStyle = ['#a89272', '#7d6a52', '#b8a488', '#6a5a46', '#93805f', '#c0ac8c'][i % 6];
      c.strokeStyle = '#57493a'; c.lineWidth = 3;
      const x = rand(0, w), y = rand(0, h), r = rand(14, 34);
      c.beginPath(); c.ellipse(x, y, r, r * rand(0.6, 0.9), rand(0, 3), 0, 7); c.fill(); c.stroke();
    }
  }, 1, 2);
  const tileTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#7a746a'; c.fillRect(0, 0, w, h); // grey wood-look bath tile
    for (let y = 0; y < h; y += 28) for (let x = -40; x < w; x += 90) {
      c.fillStyle = ['#847d72', '#6e675c', '#8f887c', '#635c52'][Math.floor(rand(0, 4))];
      c.fillRect(x + (y / 28 % 2) * 45, y, 88, 26);
    }
  }, 3, 3);
  const rugBWTex = canvasTex(256, 192, (c, w, h) => {
    c.fillStyle = '#e8e2d4'; c.fillRect(0, 0, w, h); // the black & white dining rug
    c.strokeStyle = '#26303c'; c.lineWidth = 7; c.lineCap = 'square';
    for (let i = 0; i < 26; i++) {
      const x = rand(10, w - 10), y = rand(10, h - 10), l = rand(18, 44);
      c.beginPath();
      if (i % 3 === 0) { c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y); c.moveTo(x, y - 9); c.lineTo(x, y + 9); }
      else if (i % 3 === 1) { c.moveTo(x, y - l / 2); c.lineTo(x, y + l / 2); }
      else { c.moveTo(x - l / 2, y); c.lineTo(x + l / 2, y); }
      c.stroke();
    }
    c.strokeStyle = '#26303c'; c.lineWidth = 5; c.strokeRect(6, 6, w - 12, h - 12);
  }, 1, 1);
  const rugWarmTex = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#c9a67e'; c.fillRect(0, 0, w, h); // living-room kilim
    for (let y = 8; y < h; y += 22) {
      c.fillStyle = ['#b3495a', '#d8798a', '#8a5a9a', '#e0c28e'][Math.floor(y / 22) % 4];
      for (let x = 0; x < w; x += 24) { c.beginPath(); c.moveTo(x, y + 9); c.lineTo(x + 12, y); c.lineTo(x + 24, y + 9); c.lineTo(x + 12, y + 18); c.closePath(); c.fill(); }
    }
  }, 1, 1);
  const viewTex = canvasTex(256, 160, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); // sunlit canopy out every window
    g.addColorStop(0, '#dcecf2'); g.addColorStop(0.3, '#b5d49a'); g.addColorStop(1, '#44603a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { // soft leafy blobs, brighter up top
      const y = rand(10, h);
      c.fillStyle = ['#6e9a56', '#547a42', '#86b268', '#3e5c32', '#a3c886'][i % 5];
      c.globalAlpha = rand(0.25, 0.6);
      c.beginPath(); c.ellipse(rand(0, w), y, rand(12, 30), rand(8, 20), rand(0, 3), 0, 7); c.fill();
    }
    c.globalAlpha = 0.5; // a few trunk hints low down
    c.fillStyle = '#5c4632';
    for (let i = 0; i < 5; i++) c.fillRect(rand(0, w), rand(h * 0.55, h * 0.75), rand(4, 8), h * 0.45);
    c.globalAlpha = 1;
  }, 1, 1);
  const granite2 = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#cfc8bc'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, ['#8a8074', '#b5aa98', '#5e564c', '#e2dcd0'], 800, 0.5, 3);
  }, 2, 2);
  const wallCol = 0xb6b0a8, wallBlue = 0x8fa5c2, ceilCol = 0xf2efe8;
  const woodTrim = mat(0x6e4f33);
  const whiteCab = mat(0xf0ede6);
  const viewMat = new THREE.MeshBasicMaterial({ map: viewTex });
  intViews.push(viewMat);

  // ---- helpers ----
  function wall(cx, cy, cz, w, h, ry, color, noColl, yGate, dbl) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshLambertMaterial({ color, side: dbl ? THREE.DoubleSide : THREE.FrontSide }));
    p.position.set(cx, cy, cz); p.rotation.y = ry;
    scene.add(p);
    if (!noColl) {
      const alongX = Math.abs(Math.sin(ry)) < 0.5; // wall runs along x?
      const c = alongX
        ? { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - 0.12, maxZ: cz + 0.12 }
        : { minX: cx - 0.12, maxX: cx + 0.12, minZ: cz - w / 2, maxZ: cz + w / 2 };
      if (yGate) { c.minY = yGate[0]; c.maxY = yGate[1]; }
      INTCOLL.push(c);
    }
    return p;
  }
  function ibox(w, h, d, m, x, y, z, coll) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); b.castShadow = false; b.receiveShadow = true; scene.add(b);
    if (coll) INTCOLL.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: coll[0], maxY: coll[1] });
    return b;
  }
  function view(cx, cy, cz, w, h, ry) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), viewMat);
    p.position.set(cx, cy, cz); p.rotation.y = ry; scene.add(p);
    // simple wood frame
    const fm = woodTrim;
    const horiz = Math.abs(Math.sin(ry)) < 0.5;
    const t = 0.08;
    for (const s of [-1, 1]) {
      const e1 = new THREE.Mesh(new THREE.BoxGeometry(horiz ? w + t : t, t, horiz ? t : w + t), fm);
      e1.position.set(cx, cy + s * h / 2, cz); scene.add(e1);
      const e2 = new THREE.Mesh(new THREE.BoxGeometry(horiz ? t : t, h, horiz ? t : t), fm);
      e2.position.set(cx + (horiz ? s * w / 2 : 0), cy, cz + (horiz ? 0 : s * w / 2)); scene.add(e2);
    }
  }
  function lamp(x, y, z, color, range, base) {
    const li = new THREE.PointLight(color || 0xffd9a8, 0.5, range || 8, 1.4);
    li.position.set(x, y, z); scene.add(li);
    intLights.push({ li, base: base || 0.5 });
    return li;
  }

  // ---- floors ----
  const lamMat = new THREE.MeshStandardMaterial({ map: laminateTex, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.25 });
  function floorPlane(x0, x1, z0, z1, m, y) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m);
    f.rotation.x = -Math.PI / 2;
    f.position.set((x0 + x1) / 2, y || 0.01, (z0 + z1) / 2);
    f.receiveShadow = true; scene.add(f);
    return f;
  }
  floorPlane(288, 301.5, 293, 302.5, lamMat);                    // great room + dining
  floorPlane(296, 301.5, 291.5, 297, lamMat);                    // kitchen
  floorPlane(288, 296, 288, 293, new THREE.MeshLambertMaterial({ map: carpetCreamTex })); // Liam's room

  // ---- perimeter walls (single plane, DoubleSide keeps it simple; camera mostly stays inside) ----
  // west window wall of the great room: mullions + big forest panes, two rows
  for (let i = 0; i < 4; i++) {
    const z0 = 293.6 + i * 2.2;
    view(288.06, 1.5, z0 + 0.95, 1.9, 1.9, Math.PI / 2);
    view(288.06, 3.7, z0 + 0.95, 1.9, 1.6, Math.PI / 2);
  }
  for (let i = 0; i <= 4; i++) ibox(0.16, 5.6, 0.24, woodTrim, 288.05, 2.8, 293.5 + i * 2.25);
  ibox(0.16, 0.3, 9.5, woodTrim, 288.05, 2.7, 297.75);
  INTCOLL.push({ minX: 287.8, maxX: 288.2, minZ: 288, maxZ: 302.5 }); // whole west face
  wall(288, 5.35, 297.75, 9.5, 1.5, Math.PI / 2, wallCol, true);      // header above windows
  wall(288, 2.8, 290.5, 5, 5.6, Math.PI / 2, 0xf4f2ec, true);         // Liam west (collider above)
  wall(294.75, 2.8, 288, 2.5, 5.6, 0, 0xf4f2ec, true); wall(290, 2.8, 288, 4, 5.6, 0, 0xf4f2ec, true); // north perim + window gap
  INTCOLL.push({ minX: 288, maxX: 296, minZ: 287.8, maxZ: 288.2 });
  view(292.25, 1.7, 288.06, 2, 1.4, 0);
  wall(292.25, 4.2, 288, 2.1, 2.8, 0, 0xf4f2ec, true);
  wall(296, 2.8, 289.5, 3, 5.6, Math.PI / 2, 0xf4f2ec, false, null, true); // Liam east wall (door gap z 291..292.2)
  wall(296, 2.8, 292.6, 0.8, 5.6, Math.PI / 2, 0xf4f2ec, false, null, true);
  wall(298.75, 2.8, 291.5, 5.5, 5.6, 0, wallCol);                     // kitchen north (sink window)
  view(298.7, 1.75, 291.56, 2.2, 1.1, 0);
  wall(301.5, 2.8, 294.25, 5.5, 5.6, -Math.PI / 2, wallCol);          // kitchen east
  view(301.44, 1.6, 293.6, 1.8, 1.5, -Math.PI / 2);                   // nook window
  view(301.44, 4.1, 294.3, 2, 1.6, -Math.PI / 2);                     // game room arch window (visual)
  // east wall of dining, with the real front door gap
  wall(301.5, 2.8, 297.85, 1.7, 5.6, -Math.PI / 2, wallCol);
  wall(301.5, 2.8, 301.75, 1.5, 5.6, -Math.PI / 2, wallCol);
  wall(301.5, 4.35, 300, 2, 2.5, -Math.PI / 2, wallCol, true);        // header over door
  INTCOLL.push({ minX: 301.3, maxX: 301.7, minZ: 298.6, maxZ: 301.1 }); // invisible screen door
  // the oval-glass front door, standing open against the wall
  (function frontDoorIn() {
    const d = ibox(0.1, 2.4, 1.2, new THREE.MeshLambertMaterial({ map: plankTex, color: 0xa87848 }), 301.2, 1.2, 298.6, [0, 2.2]);
    const ov = new THREE.Mesh(new THREE.CircleGeometry(0.24, 14), glassMat);
    ov.scale.y = 1.5; ov.position.set(301.08, 1.45, 298.6); ov.rotation.y = -Math.PI / 2; scene.add(ov);
  })();
  wall(294.75, 2.8, 302.5, 13.5, 5.6, Math.PI, wallCol);              // south perimeter
  view(297.4, 1.7, 302.44, 1.7, 1.6, Math.PI);                        // dining window
  // patio french doors (south wall of great room) — you can walk out
  for (const dx of [289.45, 290.35]) { // glazed doors, always ajar
    const fr = ibox(0.86, 2.3, 0.1, woodTrim, dx, 1.15, 302.42);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.9), viewMat);
    gl.position.set(dx, 1.25, 302.36); scene.add(gl);
  }

  // ---- interior partitions (ground) ----
  wall(295.1, 1.42, 293, 1.8, 2.85, 0, wallCol, false, [-1, 2.6])    // G north wall bits beside fireplace
  wall(290.35, 1.42, 293, 0.7, 2.85, 0, wallCol, false, [-1, 2.6])
  // upstairs south wall of primary suite sits on top
  wall(292, 4.22, 293, 8, 2.75, 0, wallBlue, false, [2.6, 9])
  // dining/great-room divider with wide opening
  wall(296, 1.42, 296.9, 1.4, 2.85, Math.PI / 2, wallCol, false, [-1, 2.6])
  wall(296, 1.42, 302, 1, 2.85, Math.PI / 2, wallCol, false, [-1, 2.6])
  // dining/kitchen divider
  wall(296.6, 1.42, 297, 1.2, 2.85, 0, wallCol, false, [-1, 2.6])
  wall(300.45, 1.42, 297, 2.1, 2.85, 0, wallCol, false, [-1, 2.6])

  // ---- upstairs slabs (visible from below as ceilings) + platforms ----
  function slab(x0, x1, z0, z1, topMat) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.18, z1 - z0), lamMat);
    b.position.set((x0 + x1) / 2, 2.76, (z0 + z1) / 2); scene.add(b);
    if (topMat) floorPlane(x0, x1, z0, z1, topMat, 2.86);
    PLATFORMS.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: 2.85 });
  }
  slab(297.35, 301.5, 291.5, 297, new THREE.MeshLambertMaterial({ map: carpetGreenTex })); // game room (east of stair)
  slab(296, 297.35, 291.5, 293.55, new THREE.MeshLambertMaterial({ map: carpetGreenTex }));
  slab(296, 301.5, 297, 302.5, null);                                                     // loft hall (wood)
  slab(288, 296, 288, 293, new THREE.MeshLambertMaterial({ map: carpetCreamTex }));        // primary + bath
  // upper ceilings
  (function ceilings() {
    const cm = new THREE.MeshLambertMaterial({ color: ceilCol, side: THREE.DoubleSide });
    for (const [x0, x1, z0, z1, y] of [[296, 301.5, 291.5, 302.5, 5.55], [288, 296, 288, 293, 5.55]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), cm);
      p.rotation.x = Math.PI / 2; p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(p);
    }
    // plank ceiling over the great room with dark beams (like the photos)
    const pm = new THREE.MeshLambertMaterial({ map: plankTex, color: 0xd8b98c, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 9.6), pm);
    p.rotation.x = Math.PI / 2; p.position.set(292, 5.95, 297.75); scene.add(p);
    const bm = mat(0x4a3421);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.3, 0.22), bm);
      b.position.set(292, 5.78, 294.2 + i * 2.35); scene.add(b);
    }
  })();

  // ---- the staircase (real, walkable) ----
  (function stairs() {
    const sm = new THREE.MeshLambertMaterial({ map: plankTex, color: 0xc09868 });
    for (let i = 1; i <= 10; i++) {
      const z = 296.62 - i * 0.29, y = i * 0.285;
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.1, 0.3), sm);
      st.position.set(296.67, y - 0.05, z); scene.add(st);
      const riser = new THREE.Mesh(new THREE.BoxGeometry(1.25, y, 0.06), mat(0xf0ede6));
      riser.position.set(296.67, y / 2 - 0.03, z + 0.15); scene.add(riser);
      PLATFORMS.push({ minX: 296.05, maxX: 297.3, minZ: z - 0.16, maxZ: z + 0.14, y });
    }
    // rails
    for (const rx of [296.08, 297.28]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 3.1), woodTrim);
      rail.position.set(rx, 2.35, 295.1); rail.rotation.x = -0.75; scene.add(rail);
    }
    INTCOLL.push({ minX: 295.9, maxX: 296.15, minZ: 293.4, maxZ: 296.7 });   // void-side stair wall
    INTCOLL.push({ minX: 297.2, maxX: 297.45, minZ: 293.4, maxZ: 296.7, minY: 0.2, maxY: 9 });
    // loft railings overlooking the great room
    function railing(x0, x1, z0, z1) {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.45));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 0.06), woodTrim);
        p.position.set(x0 + (x1 - x0) * t, 3.3, z0 + (z1 - z0) * t); scene.add(p);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(Math.max(Math.abs(x1 - x0), 0.09), 0.09, Math.max(Math.abs(z1 - z0), 0.09)), woodTrim);
      top.position.set((x0 + x1) / 2, 3.75, (z0 + z1) / 2); scene.add(top);
      INTCOLL.push({ minX: Math.min(x0, x1) - 0.1, maxX: Math.max(x0, x1) + 0.1, minZ: Math.min(z0, z1) - 0.1, maxZ: Math.max(z0, z1) + 0.1, minY: 2.4, maxY: 9 });
    }
    railing(296.05, 296.05, 297.1, 302.4); // hall overlook
    railing(296.05, 296.05, 291.6, 293.4); // game-room edge by the stair top
  })();

  // ================= DINING / ENTRY =================
  (function dining() {
    const rug = floorPlane(297, 301, 298.2, 301.6, new THREE.MeshLambertMaterial({ map: rugBWTex }), 0.02);
    const wood = new THREE.MeshLambertMaterial({ map: plankTex, color: 0xc9a06a });
    ibox(2.6, 0.09, 1.15, wood, 298.9, 0.78, 299.9, [0, 1.2]);          // farmhouse table
    for (const [lx, lz] of [[297.8, 299.4], [300, 299.4], [297.8, 300.4], [300, 300.4]])
      ibox(0.12, 0.74, 0.12, wood, lx, 0.37, lz);
    for (const bz of [299.05, 300.75]) ibox(2.3, 0.45, 0.34, wood, 298.9, 0.32, bz); // benches
    // antler chandelier
    const ant = mat(0xd8c5a4);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), ant); hub.position.set(298.9, 2.45, 299.9); scene.add(hub);
    cyl(0.02, 0.02, 0.5, 0x6e5138, 298.9, 2.75, 299.9, null, 5);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.5, 5), ant);
      seg1.position.set(298.9 + Math.cos(a) * 0.28, 2.42, 299.9 + Math.sin(a) * 0.28);
      seg1.rotation.z = Math.cos(a) * 1.2; seg1.rotation.x = -Math.sin(a) * 1.2; scene.add(seg1);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.3, 5), ant);
      tip.position.set(298.9 + Math.cos(a) * 0.52, 2.58, 299.9 + Math.sin(a) * 0.52);
      tip.rotation.z = Math.cos(a) * 0.5; tip.rotation.x = -Math.sin(a) * 0.5; scene.add(tip);
    }
    const bulbM = new THREE.MeshLambertMaterial({ color: 0xfff2cc, emissive: 0xb8862f });
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.4;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), bulbM);
      b.position.set(298.9 + Math.cos(a) * 0.34, 2.52, 299.9 + Math.sin(a) * 0.34); scene.add(b);
    }
    lamp(298.9, 2.3, 299.9, 0xffd9a8, 9, 0.6);
    // plant + mirror + floor lamp
    ibox(0.22, 0.18, 0.22, mat(0xe8e4da), 298.9, 0.92, 299.9);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), mat(0x3e6a35)); leaf.position.set(298.9, 1.1, 299.9); scene.add(leaf);
    const mir = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), new THREE.MeshLambertMaterial({ color: 0xc8d4da, emissive: 0x2a3438 }));
    mir.position.set(298.4, 2, 302.44); mir.rotation.y = Math.PI; scene.add(mir);
  })();

  // ================= KITCHEN + NOOK =================
  (function kitchen() {
    const granMat = new THREE.MeshStandardMaterial({ map: granite2, roughness: 0.35, metalness: 0.1, envMapIntensity: 0.35 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.8, envMapIntensity: 0.5 });
    const backTex = new THREE.MeshLambertMaterial({ map: tileTex, color: 0xd8cfc0 });
    // north run: sink + dishwasher + counters
    ibox(4.6, 0.9, 0.62, whiteCab, 298.9, 0.45, 291.95, [0, 1.2]);
    ibox(4.7, 0.06, 0.68, granMat, 298.9, 0.93, 291.96);
    ibox(4.6, 0.8, 0.06, backTex, 298.9, 1.45, 291.62);
    const sink = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.4), mat(0x8a8e92)); sink.position.set(298.7, 0.94, 291.95); scene.add(sink);
    const fauc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 10, Math.PI), mat(0x2e2e30)); fauc.position.set(298.7, 1.06, 291.8); scene.add(fauc);
    ibox(0.66, 0.72, 0.06, steel, 300.1, 0.42, 292.29); // dishwasher front
    // east run: range + microwave + uppers
    ibox(0.62, 0.9, 3.4, whiteCab, 301.15, 0.45, 294.6, [0, 1.2]);
    ibox(0.68, 0.06, 3.5, granMat, 301.16, 0.93, 294.6);
    const range = ibox(0.66, 0.94, 0.78, steel, 301.12, 0.47, 295.5);
    for (const [bx, bz] of [[301, 295.25], [301, 295.75], [300.85, 295.25], [300.85, 295.75]]) {
      const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), mat(0x1c1c1e));
      burner.position.set(bx, 0.96, bz); scene.add(burner);
    }
    ibox(0.5, 0.5, 0.8, steel, 301.28, 2.05, 295.5); // microwave
    ibox(0.55, 0.75, 2.2, whiteCab, 301.3, 2.2, 293.4); // uppers with glass front
    const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), new THREE.MeshLambertMaterial({ color: 0x9fb2bc, emissive: 0x1e262a, transparent: true, opacity: 0.7 }));
    glassFront.position.set(301, 2.2, 293.4); glassFront.rotation.y = -Math.PI / 2; scene.add(glassFront);
    // fridge (NW of kitchen by Liam's wall)
    ibox(0.85, 1.9, 0.75, steel, 296.55, 0.95, 292, [0, 2]);
    ibox(0.04, 0.7, 0.06, mat(0x8a8e92), 296.98, 1.15, 291.8);
    // espresso machine — Eric's altar
    ibox(0.3, 0.32, 0.3, mat(0x62666a), 297.5, 1.09, 291.95);
    // washer + dryer niche by the stairs
    for (const wz of [296.1, 296.75]) { /* compact laundry visual */ }
    ibox(0.6, 0.85, 0.6, steel, 296.4, 0.43, 296.2, [0, 1]);
    ibox(0.6, 0.85, 0.6, steel, 296.4, 0.43, 296.85, [0, 1]);
    // skylight with wood grid
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.2), new THREE.MeshBasicMaterial({ color: 0xfdf8ea }));
    sky.rotation.x = Math.PI / 2; sky.position.set(299.3, 5.5, 294.3); scene.add(sky);
    intViews.push(sky.material);
    for (const gx of [-0.5, 0, 0.5]) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 1.25), woodTrim); g.position.set(299.3 + gx, 5.48, 294.3); scene.add(g); }
    lamp(299, 2.5, 294.4, 0xfff0d8, 8, 0.55);
    // breakfast nook: table + 4 chairs with red cushions
    const nw = new THREE.MeshLambertMaterial({ map: plankTex, color: 0xb08a58 });
    ibox(1.1, 0.06, 1.1, nw, 299.9, 0.74, 293.6, [0, 0.9]);
    for (const [lx, lz] of [[299.5, 293.2], [300.3, 293.2], [299.5, 294], [300.3, 294]]) ibox(0.08, 0.72, 0.08, nw, lx, 0.36, lz);
    for (const [cx2, cz2, ry] of [[299.9, 292.8, 0], [299.9, 294.4, Math.PI], [299.1, 293.6, Math.PI / 2], [300.7, 293.6, -Math.PI / 2]]) {
      ibox(0.42, 0.06, 0.42, nw, cx2, 0.46, cz2);
      ibox(0.4, 0.05, 0.4, mat(0xa8323e), cx2, 0.5, cz2);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.06), nw);
      back.position.set(cx2 - Math.sin(ry) * 0.19, 0.75, cz2 - Math.cos(ry) * 0.19); back.rotation.y = ry; scene.add(back);
    }
  })();

  // ================= GREAT ROOM =================
  (function greatRoom() {
    floorPlane(290, 294.6, 295.4, 300.6, new THREE.MeshLambertMaterial({ map: rugWarmTex }), 0.02);
    // river-rock fireplace to the vault
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 });
    ibox(3.3, 5.9, 0.7, stone, 292.4, 2.95, 293.05, [0, 9]);
    ibox(3.9, 0.34, 1.15, stone, 292.4, 0.17, 293.35, [0, 0.6]);
    const insert = ibox(1.5, 1.1, 0.2, mat(0x17171a), 292.4, 0.85, 293.44);
    const fbox = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9 }));
    fbox.position.set(292.4, 0.8, 293.56); scene.add(fbox);
    hearth = new THREE.PointLight(0xff8a3c, 0.8, 7, 1.5);
    hearth.position.set(292.4, 1, 294); scene.add(hearth);
    ibox(2.6, 0.12, 0.34, woodTrim, 292.4, 2.15, 293.5); // mantel
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.85), new THREE.MeshLambertMaterial({ map: canvasTex(64, 48, (c, w, h) => {
      c.fillStyle = '#e8d8a8'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) { c.fillStyle = ['#4a7a4e', '#c9a03a', '#8a4a3e', '#3e5a8a'][i % 4]; c.globalAlpha = 0.8; c.fillRect(rand(0, w), rand(0, h), rand(6, 20), rand(6, 16)); }
    }) }));
    art.position.set(292.4, 3.1, 293.42); scene.add(art);
    // burgundy leather sofas + driftwood glass table + green chair (photos)
    const leather = new THREE.MeshStandardMaterial({ color: 0x451219, roughness: 0.45, metalness: 0.05, envMapIntensity: 0.25 });
    function sofa(cx, cz, ry, len) {
      const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ry; scene.add(g);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.42, 0.95), leather); seat.position.y = 0.35; g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, 0.28), leather); back.position.set(0, 0.82, -0.36); g.add(back);
      for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.95), leather); arm.position.set(s * (len / 2 - 0.12), 0.72, 0); g.add(arm); }
      INTCOLL.push({ minX: cx - len / 2, maxX: cx + len / 2, minZ: cz - 0.6, maxZ: cz + 0.6, minY: -1, maxY: 1.4 });
    }
    sofa(292.3, 297.1, Math.PI, 2.3);
    sofa(289.6, 298.9, Math.PI / 2, 2.1);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.7), mat(0x5a7a58)); chair.position.set(294.4, 0.45, 297.6); scene.add(chair);
    INTCOLL.push({ minX: 294.05, maxX: 294.75, minZ: 297.25, maxZ: 297.95, minY: -1, maxY: 1.2 });
    const drift = new THREE.Mesh(new THREE.SphereGeometry(0.3, 7, 5), mat(0xb59a72)); drift.scale.y = 0.9; drift.position.set(292.3, 0.3, 298.6); scene.add(drift);
    const glassTop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.04, 18), new THREE.MeshStandardMaterial({ color: 0xbfd4d8, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.2 }));
    glassTop.position.set(292.3, 0.62, 298.6); scene.add(glassTop);
    INTCOLL.push({ minX: 291.7, maxX: 292.9, minZ: 298, maxZ: 299.2, minY: -1, maxY: 1 });
    // TV console under the loft
    ibox(1.7, 0.4, 0.4, woodTrim, 295.7, 0.2, 300.9, [0, 0.6]);
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshLambertMaterial({ color: 0x14161a, emissive: 0x0a121e }));
    tv.position.set(295.65, 1.15, 300.9); tv.rotation.y = -Math.PI / 2; scene.add(tv);
    // plants by the window wall
    for (const pz of [294.2, 301.6]) {
      ibox(0.3, 0.35, 0.3, mat(0xa8654f), 288.6, 0.18, pz);
      const pl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 7, 6), mat(0x3e6a35)); pl.position.set(288.6, 0.62, pz); scene.add(pl);
    }
    lamp(292.3, 4.6, 297.7, 0xffe4bc, 12, 0.5);
  })();

  // ================= LIAM'S ROOM =================
  (function liamRoom() {
    // bed with the blue tufted headboard
    ibox(1.35, 0.4, 2, mat(0xd8d4c8), 294.9, 0.32, 290.4, [0, 0.8]);
    ibox(1.45, 1, 0.14, mat(0x2a3f8a), 294.9, 0.85, 289.35);
    ibox(0.55, 0.12, 0.35, mat(0xfdfcf8), 294.9, 0.56, 289.7);
    // corner desk + monitor + chair (Liam HQ)
    ibox(1.7, 0.06, 0.55, woodTrim, 289, 0.72, 288.5, [0, 0.9]);
    ibox(0.55, 0.06, 1.4, woodTrim, 288.4, 0.72, 289.2, [0, 0.9]);
    const mon = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.35), new THREE.MeshLambertMaterial({ color: 0x10141c, emissive: 0x16324a }));
    mon.position.set(289, 1.1, 288.4); scene.add(mon);
    ibox(0.4, 0.45, 0.4, mat(0x2c2c30), 289.1, 0.25, 289.3);
    // wardrobe
    ibox(1.1, 1.9, 0.5, new THREE.MeshLambertMaterial({ map: plankTex, color: 0xa87848 }), 292.2, 0.95, 288.35, [0, 2]);
    floorPlane(292.8, 295.6, 289.8, 292.2, new THREE.MeshLambertMaterial({ map: rugWarmTex }), 0.02);
    lamp(292, 2.5, 290.5, 0xfff0d8, 7, 0.4);
  })();

  // ================= UPSTAIRS: GAME ROOM =================
  (function gameRoom() {
    const felt = mat(0x2e7a4e);
    const wood = new THREE.MeshLambertMaterial({ map: plankTex, color: 0x8a5a34 });
    ibox(2.1, 0.22, 1.15, wood, 299.4, 3.62, 294.2, [2.85, 4.4]);
    ibox(1.9, 0.05, 0.95, felt, 299.4, 3.76, 294.2);
    for (const [lx, lz] of [[298.55, 293.75], [300.25, 293.75], [298.55, 294.65], [300.25, 294.65]])
      ibox(0.16, 0.72, 0.16, wood, lx, 3.21, lz);
    // balls + stained-glass light
    const cols = [0xf2c14e, 0xd8442e, 0x2a3f8a, 0x111111, 0xffffff];
    for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(cols[i])); b.position.set(299.2 + (i % 3) * 0.12, 3.83, 294 + Math.floor(i / 3) * 0.14); scene.add(b); }
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.25, 8), new THREE.MeshLambertMaterial({ color: 0x3e7a52, emissive: 0x1e3a28 }));
    shade.position.set(299.4, 4.75, 294.2); scene.add(shade);
    lamp(299.4, 4.55, 294.2, 0xd8ffe0, 6, 0.5);
    // bar rail + stools
    ibox(1.6, 0.95, 0.35, wood, 300.6, 3.32, 296.6, [2.85, 4]);
    for (const sx of [300.2, 301]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.5, 8), mat(0x4a2e22)); st.position.set(sx, 3.35, 296.1); scene.add(st); }
    // drum kit + guitars + piano along the north wall
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.35, 12), mat(0xd8d4c8)); drum.rotation.z = Math.PI / 2; drum.position.set(297.9, 3.2, 292); scene.add(drum);
    const snare = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10), mat(0xb8b4a8)); snare.position.set(298.35, 3.3, 292.2); scene.add(snare);
    for (const cx2 of [297.6, 298.6]) { const cym = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 12), mat(0xc9a03a)); cym.position.set(cx2, 3.6, 292.05); scene.add(cym); cyl(0.015, 0.015, 0.75, 0x2e2e30, cx2, 3.22, 292.05, null, 5); }
    for (const gx of [299.4, 299.75]) { const gtr = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.08), mat(gx > 299.5 ? 0xa8542e : 0x2e2e34)); gtr.position.set(gx, 3.3, 291.8); gtr.rotation.x = -0.12; scene.add(gtr); }
    ibox(1.2, 0.3, 0.35, mat(0x1c1c20), 300.7, 3.55, 291.85, [2.85, 4]); // digital piano
    ibox(1.1, 0.04, 0.3, mat(0xf4f2ec), 300.7, 3.72, 291.87);
    ibox(0.7, 0.28, 0.3, wood, 300.7, 3, 292.4);
    // chalkboard + ceiling fan
    const chalk = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), mat(0x1e2a22)); chalk.position.set(297.5, 4.1, 296.9); chalk.rotation.y = Math.PI; scene.add(chalk);
    const fan = new THREE.Group(); fan.position.set(299.4, 5.3, 293); scene.add(fan);
    for (let i = 0; i < 4; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.16), wood); bl.position.set(Math.cos(i * Math.PI / 2) * 0.55, 0, Math.sin(i * Math.PI / 2) * 0.55); bl.rotation.y = -i * Math.PI / 2; fan.add(bl); }
    const fhub = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xc9a03a)); fan.add(fhub);
    fans.push(fan);
  })();

  // ================= UPSTAIRS: PRIMARY + BATH =================
  (function primarySuite() {
    // blue walls
    wall(296, 4.2, 289.95, 3.9, 2.7, Math.PI / 2, wallBlue, false, [2.6, 9], true); // east wall, doorway open z 291.9..293
    wall(290.5, 4.2, 289.9, 2.6, 2.7, Math.PI / 2, wallBlue, false, [2.6, 9], true); // bath divider (barn gap z 291.2..292.3)
    wall(290.5, 4.2, 292.7, 0.6, 2.7, Math.PI / 2, wallBlue, false, [2.6, 9], true);
    // barn door on its rail
    const barn = ibox(0.08, 2.1, 1.05, new THREE.MeshLambertMaterial({ map: plankTex, color: 0x9a6a3e }), 290.62, 3.95, 290.55);
    ibox(0.05, 0.05, 2.4, mat(0x2e2e30), 290.6, 5.05, 291.2);
    // bed with tall cream tufted headboard
    ibox(1.6, 0.45, 2.05, mat(0xe8e2d4), 293.4, 3.12, 289.6, [2.85, 3.6]);
    ibox(1.7, 1.15, 0.15, mat(0xdfd8c8), 293.4, 3.7, 288.55);
    for (const px of [292.9, 293.9]) ibox(0.5, 0.12, 0.32, mat(0xc8ccd4), px, 3.4, 288.95);
    for (const nx of [292.4, 294.4]) {
      ibox(0.4, 0.45, 0.4, mat(0x3a3a40), nx, 3.08, 288.5, [2.85, 3.6]);
      const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.16, 8), new THREE.MeshLambertMaterial({ color: 0xf4ead0, emissive: 0x8a6a2f }));
      lm.position.set(nx, 3.45, 288.5); scene.add(lm);
    }
    lamp(293.4, 4.9, 290.3, 0xffe4c0, 8, 0.45);
    // bench + dresser + arched window high on the wall
    ibox(1.1, 0.3, 0.35, woodTrim, 293.4, 3, 291.2);
    ibox(1, 0.9, 0.45, new THREE.MeshLambertMaterial({ map: plankTex, color: 0xa87848 }), 295.3, 3.3, 290.6, [2.85, 4.3]);
    view(292.6, 4.9, 288.12, 1.3, 0.75, 0);
    // ---- bath: rustic vanity, vessel sinks, tub, glass shower ----
    floorPlane(288.15, 290.35, 288.15, 292.85, new THREE.MeshLambertMaterial({ map: tileTex }), 2.87);
    const rustic = new THREE.MeshLambertMaterial({ map: plankTex, color: 0x7a4f2e });
    ibox(1.5, 0.85, 0.5, rustic, 289.1, 3.28, 288.55, [2.85, 4.2]);
    for (const sx of [288.7, 289.5]) { const vs = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xfdfcf8)); vs.scale.y = 0.55; vs.position.set(sx, 3.78, 288.55); scene.add(vs); }
    const bmir = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0xc8d4da, emissive: 0x2a3438 })); bmir.position.set(289.1, 4.45, 288.18); scene.add(bmir);
    ibox(1.3, 0.55, 0.75, mat(0xfdfcf8), 289, 3.13, 292.3, [2.85, 3.6]); // tub
    ibox(1.1, 0.1, 0.55, mat(0xe8f2f4), 289, 3.42, 292.3);
    // glass shower w/ pebble floor
    const gl = new THREE.MeshStandardMaterial({ color: 0xcfe4e8, transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0.1 });
    for (const [gx, gz, gw, gr] of [[290, 290.6, 1, 0], [289.5, 290.1, 1, Math.PI / 2]]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(gw, 2), gl); pane.position.set(gx, 3.95, gz); pane.rotation.y = gr; scene.add(pane);
    }
    const peb = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), new THREE.MeshLambertMaterial({ map: duffTex, color: 0xb8b4a8 }));
    peb.rotation.x = -Math.PI / 2; peb.position.set(289.7, 2.88, 289.7); scene.add(peb);
    cyl(0.02, 0.02, 0.5, 0x8a8e92, 289.7, 4.9, 289.35, null, 5);
    lamp(289.3, 4.7, 290.5, 0xfff0d8, 6, 0.4);
  })();

  // ---- hall art (the colorful abstract) + french-door balcony view ----
  const hart = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.8), new THREE.MeshLambertMaterial({ map: canvasTex(64, 48, (c, w, h) => {
    c.fillStyle = '#2a3450'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) { c.fillStyle = ['#d8442e', '#3a8ad8', '#e8c93a', '#7a3a9a', '#3ac98a'][i % 5]; c.globalAlpha = 0.85; c.beginPath(); c.moveTo(rand(0, w), rand(0, h)); c.lineTo(rand(0, w), rand(0, h)); c.lineTo(rand(0, w), rand(0, h)); c.closePath(); c.fill(); }
  }) }));
  hart.position.set(301.44, 4.3, 299.9); hart.rotation.y = -Math.PI / 2; scene.add(hart);
  view(301.44, 4, 301.6, 1.4, 1.9, -Math.PI / 2); // balcony french doors (view only)
  lamp(298.5, 4.9, 299.8, 0xffe4c0, 8, 0.4);
})();

// ---- doors in and out ----
function setIntLights(on) {
  for (const l of intLights) l.li.visible = on;
  if (hearth) hearth.visible = on;
}
function goInside(spawn) {
  if (!player) return;
  dropFaylen();
  INT.on = true;
  setIntLights(true);
  player.pos.set(spawn ? 289.9 : 300.6, 0, spawn ? 301.6 : 300.1);
  player.vy = 0; player.heading = spawn ? 0.6 : -Math.PI / 2;
  camYaw = spawn ? Math.PI + 0.5 : Math.PI / 2;
  toast('🏠 Home sweet home. (The whole family is “about to come inside,” allegedly.)', 3);
  award('inside');
  blip();
}
function goOutside(back) {
  INT.on = false;
  setIntLights(false);
  if (back) { player.pos.set(-10.8, 0, -8.2); player.heading = -Math.PI / 2; camYaw = Math.PI / 2 + 0.4; }
  else { player.pos.set(3, 0, -11.2); player.heading = Math.PI / 2; camYaw = -Math.PI / 2; }
  player.vy = 0;
  blip();
}
setIntLights(false); // dark until someone walks in
const INTERIOR_POIS = [
  { label: '🚪 Go outside', near: p => Math.hypot(p.x - 300.9, p.z - 300.2) < 1.7, fn: () => goOutside(false) },
  { label: '🌲 Out to the patio', near: p => p.y < 1 && Math.hypot(p.x - 289.9, p.z - 302) < 1.6, fn: () => goOutside(true) },
  { label: '☕ Fire up the espresso', near: p => p.y < 1 && Math.hypot(p.x - 297.5, p.z - 292.2) < 1.4, fn() {
    tone(220, 0.5, 'sawtooth', 0.05); tone(660, 0.3, 'sine', 0.04, 0.5);
    player.buffT = 20; score += 2;
    say(player, player === family[0] ? 'Dad power: MAXIMUM. ☕⚡' : 'Whoa. I can see through time. ☕', 3);
  } },
  { label: '🍪 Raid the fridge', near: p => p.y < 1 && Math.hypot(p.x - 296.6, p.z - 292.2) < 1.3, fn() {
    player.buffT = 14; blip();
    toast(['🍪 One (1) cookie. For balance.', '🧀 String cheese acquired. Power rising.', '🥕 A carrot?? Who put vegetables in here?'][Math.floor(rand(0, 3))], 3);
  } },
  { label: '🔥 Warm up by the fire', near: p => p.y < 1 && Math.hypot(p.x - 292.4, p.z - 294.3) < 1.6, fn() {
    toast('🔥 Toasty. The rain can do its worst.', 2.5); tone(140, 0.4, 'triangle', 0.05);
  } },
  { label: '🎱 Break!', near: p => p.y > 2 && Math.hypot(p.x - 299.4, p.z - 294.9) < 1.6, fn() {
    tone(880, 0.03, 'square', 0.09); tone(760, 0.03, 'square', 0.08, 0.05); tone(620, 0.04, 'square', 0.07, 0.11); tone(500, 0.05, 'square', 0.06, 0.18);
    award('rack'); score += 3;
    toast(['🎱 Clean break! Two in. Nobody saw the scratch.', '🎱 The cue ball flew off the table. Classic.', '🎱 8-ball first hit. We don’t talk about it.'][Math.floor(rand(0, 3))], 3);
  } },
  { label: '🎹 Play the piano', near: p => p.y > 2 && Math.hypot(p.x - 300.7, p.z - 292.3) < 1.3, fn() {
    const notes = [262, 330, 392, 523, 392, 330, 262];
    notes.forEach((n, i) => tone(n, 0.22, 'sine', 0.07, i * 0.16));
    award('tunes'); score += 3;
  } },
  { label: '🥁 Crash the drums', near: p => p.y > 2 && Math.hypot(p.x - 298.1, p.z - 292.2) < 1.4, fn() {
    tone(90, 0.15, 'sine', 0.12); tone(2400, 0.2, 'sawtooth', 0.03, 0.05); tone(70, 0.15, 'sine', 0.1, 0.22);
    say(player, 'BAND PRACTICE!', 2);
  } },
  { label: '😴 Nap', near: p => p.y > 2 && Math.hypot(p.x - 293.4, p.z - 289.4) < 1.5, fn() {
    cycleTimeOfDay();
    toast('😴 Best nap of your life. Time did… something.', 3);
  } },
  { label: '📺 Watch TV', near: p => p.y < 1 && Math.hypot(p.x - 294.8, p.z - 300.4) < 1.5, fn() {
    toast('📺 34 minutes of “what should we watch” later, everyone is asleep.', 3.2);
  } },
];

// ---------- Main loop ----------
let last = performance.now();
frame.lastEnvF = 99; // force first-frame env pass
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  updateDayNight(dt, now);
  updateActII(dt, now);
  if (player) {
    if (photo.on) {
      // frozen for framing — camera still orbits via drag; no gameplay
    } else if (car.occupied) {
      updateDriving(dt, now);
    } else if (RIDE.riding) {
      updateRiding(dt);
    } else if (ACT2.zip.riding) {
      // gliding the zipline — handled in updateActII
    } else if (ACT2.zip.atTop) {
      player.pos.copy(ACT2.zip.start); // pinned on the platform until you zip
    } else if (ACT2.fishing.active) {
      // standing on the dock, line in the water
    } else {
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
      const fallSpd = player.vy;                 // capture before swim zeroes it
      const wasSwimming = player.swimming;
      moveChar(player, dx, dz, dt, spd);
      player.swimming = applySwim(player);
      if (player.swimming && !wasSwimming && fallSpd < -5) { award('plunge'); throwConfetti(player.pos); } // cannonball
      if (Math.hypot(player.pos.x - henryCowell.fremont.x, player.pos.z - henryCowell.fremont.z) < 1.8) award('fremont');
    }
    for (const ch of family) if (ch !== player) updateAI(ch, dt);
    if (!photo.on && !car.occupied && !RIDE.riding && !ACT2.zip.riding && !ACT2.zip.atTop && !ACT2.fishing.active) {
      updateActivities(dt, now);
      updateMission(dt);
      randomQuips(dt);
      dadJokes(dt);
    } else {
      updateInteractions();
    }
  }
  updateNightFX(dt, now);
  updateSquirrel(dt);
  updateTrain(dt);
  updateTraffic(dt);
  for (const f of fans) f.rotation.y += dt * 5;
  if (hearth) hearth.intensity = 0.65 + Math.sin(now * 0.021) * 0.2 + Math.sin(now * 0.047) * 0.12;
  if (gradePass) gradePass.uniforms.uTime.value = now * 0.00021 % 100.0;
  // the San Lorenzo actually flows (texture drift + a light cross-ripple)
  waterTex.offset.x -= dt * 0.05;
  waterTex.offset.y = Math.sin(now * 0.0005) * 0.03;
  sparkleTex.offset.x += dt * 0.028;
  sparkleTex.offset.y = Math.sin(now * 0.0007) * 0.02;
  sparkleMat.opacity = 0.08 + dayNight.dayF * 0.26; // glints belong to the sun
  updateAmbience(dt, now);
  updateConfetti(dt);
  updateBubbles(dt);
  updateCamera(dt);
  // image-based light is a daytime sky — fade it out after dark or the ground glows at night.
  // Runs a traverse only when the light level actually moves (and picks up late-loaded assets).
  const envF = 0.1 + dayNight.dayF * 0.9;
  if (Math.abs(envF - frame.lastEnvF) > 0.02) {
    frame.lastEnvF = envF;
    scene.traverse(o => {
      if (!o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
        if (!m.isMeshStandardMaterial) return;
        if (m.userData.envBase === undefined) m.userData.envBase = m.envMapIntensity === 1 ? 0.4 : m.envMapIntensity;
        m.envMapIntensity = m.userData.envBase * envF;
      });
    });
  }
  for (const f of family) { // name tags fade with distance (less floating-UI clutter)
    const dc = camera.position.distanceTo(f.pos);
    f.parts.label.material.opacity = Math.max(0, Math.min(1, 1.9 - dc / 11)) * 0.85;
  }
  if (composer) composer.render();
  else renderer.render(scene, camera);
}
requestAnimationFrame(frame);

// tiny hook for automated tests
window.__test = { setCam(y, p, d) { camYaw = y; camPitch = p; camDist = d; }, switchTo, family };
window.__act = { nightF: () => dayNight.nightF, driving: () => car.occupied, photo: () => photo.on, riding: () => RIDE.riding,
  weather: () => ACT2.weather, fishing: () => ACT2.fishing.active, zip: () => ACT2.zip.riding, trial: () => ACT2.trial.active,
  cycleWeather, startFishing, castLine, reelIn,
  atTop: () => ACT2.zip.atTop, trialT: () => ACT2.trial.t, startTrial, endTrial, climbZip, rideZip, enterCar, exitCar,
  carPos: () => car.g.position, carSpeed: () => car.speed, carCollider: () => colliders[car.colliderIndex], fxaa: () => !!fxaaPass, boardTrain, hopOffTrain,
  traffic: () => traffic.map(c => ({ active: c.active, x: c.active ? +c.x.toFixed(1) : null, dir: c.dir })), trafficRaw: () => traffic,
  goInside, goOutside, inside: () => INT.on };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
  fitFXAA();
});
})();
