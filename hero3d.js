/* Hero: a four-string bass in real 3D (three.js r169), lit like a stage.
   Amber key light from above, magenta rim from behind, haze in the beam.
   The strings vibrate when the pointer crosses them. Pauses off screen.
   Reduced motion: one still frame. No WebGL: app.js falls back to the 2D particle bass. */
import * as THREE from 'three';

const canvas = document.getElementById('heroBass');
const hero = document.getElementById('top');
const root = document.documentElement;
const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const INTRO = root.classList.contains('intro-hold');

function fail() {
  window.__hero3d = 'failed';
  document.dispatchEvent(new CustomEvent('hero3d:fail'));
}

if (!canvas || !hero || window.__hero3d === 'fallback') {
  if (window.__hero3d !== 'fallback') fail();
} else {
  start().catch((err) => { console.warn('hero3d', err); fail(); });
}

// While the opening sequence plays, wait for the stage to split before doing any GPU work.
// The split is a compositor transition, so it keeps moving even if setup holds the main thread.
function afterIntro() {
  if (!root.classList.contains('intro-hold')) return Promise.resolve();
  return new Promise((res) => {
    let done = false;
    const go = () => { if (done) return; done = true; requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(res, 80))); };
    document.addEventListener('intro:open', go, { once: true });
    setTimeout(go, 6000);
  });
}

async function start() {
  await afterIntro();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { fail(); return; }
  if (!renderer.getContext()) { fail(); return; }

  const BG = 0x141210;
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 40);

  /* ---------- Environment: a dark room with stage softboxes, for clearcoat reflections ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x0c0a08, side: THREE.BackSide })));
  function panel(w, h, color, k, pos) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  panel(8, 0.6, 0xffb35a, 10, [-6, 7, 1.5]);    // amber strip softbox, front left, high
  panel(0.8, 10, 0xff3fa0, 12, [7.5, 0.5, -3]); // magenta strip, right, behind
  panel(9, 0.35, 0xfff1dc, 9, [0, 9.5, 0.5]);   // white batten overhead
  panel(0.4, 6, 0xfff1dc, 5, [-8, 1, 2]);       // thin white side strip, left
  panel(14, 14, 0x2a1408, 0.6, [0, -11, 0]);    // stage floor
  panel(5, 5, 0xfff4e6, 1.4, [1, 10, 3]);        // soft overhead fill, so chrome reads as metal
  const envRT = pmrem.fromScene(env, 0.035);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();

  /* ---------- Procedural wood ---------- */
  function woodTexture(base, dark, lines, w, h, seed) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    let s = seed;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < lines; i++) {
      const x = r() * w, a = 0.05 + r() * 0.14, lw = 0.6 + r() * 2.2, wob = 2 + r() * 6, ph = r() * 6;
      g.strokeStyle = dark; g.globalAlpha = a; g.lineWidth = lw;
      g.beginPath();
      for (let y = 0; y <= h; y += 16) {
        const xx = x + Math.sin(y / (40 + wob * 20) + ph) * wob;
        if (y === 0) g.moveTo(xx, y); else g.lineTo(xx, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  const mapleTex = woodTexture('#e3b06b', '#8a5a26', 90, 256, 1024, 7);
  mapleTex.repeat.set(1.6, 0.12);
  const roseTex = woodTexture('#3a2016', '#120805', 120, 256, 1024, 11);
  roseTex.repeat.set(2.2, 0.12);

  /* ---------- Materials ---------- */
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: 0xb3121d, roughness: 0.5, metalness: 0, specularIntensity: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
    guard: new THREE.MeshPhysicalMaterial({ color: 0x070606, roughness: 0.45, metalness: 0, specularIntensity: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.06 }),
    maple: new THREE.MeshPhysicalMaterial({ map: mapleTex, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    rose: new THREE.MeshStandardMaterial({ map: roseTex, roughness: 0.75 }),
    fret: new THREE.MeshStandardMaterial({ color: 0xe0dbd2, metalness: 1, roughness: 0.22 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe9ecf1, metalness: 1, roughness: 0.09 }),
    pickup: new THREE.MeshStandardMaterial({ color: 0x23201e, roughness: 0.42 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: 0xf6efe2, roughness: 0.25, clearcoat: 1, sheen: 1, sheenColor: 0xffe6c4 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.4 })
  };

  /* ---------- Model (units: decimetres; saddles at y = -1.05, nut at y = 7.62) ---------- */
  const model = new THREE.Group();
  const SCALE = 8.64, NUT = 7.62, BRIDGE = NUT - SCALE;

  function extrude(shape, depth, bevel, z0, mat, seg) {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.9,
      bevelSegments: bevel > 0 ? 6 : 0, curveSegments: seg || 40
    });
    geo.translate(0, 0, z0 + bevel);
    const m = new THREE.Mesh(geo, mat);
    model.add(m);
    return m;
  }
  function roundRect(cx, cy, w, h, r) {
    const s = new THREE.Shape(), x = cx - w / 2, y = cy - h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  // Body: an offset double-cut, long horn on the bass side (left, facing you).
  const body = new THREE.Shape();
  body.moveTo(0, -2.25);
  body.bezierCurveTo(0.95, -2.27, 1.72, -1.78, 1.74, -0.9);
  body.bezierCurveTo(1.76, -0.2, 1.28, 0.2, 1.24, 0.82);
  body.bezierCurveTo(1.2, 1.35, 1.55, 1.72, 1.46, 2.22);
  body.bezierCurveTo(1.4, 2.56, 1.06, 2.6, 0.97, 2.32);
  body.bezierCurveTo(0.9, 2.04, 0.74, 1.78, 0.4, 1.82);
  body.lineTo(-0.4, 1.86);
  body.bezierCurveTo(-0.74, 1.86, -0.94, 2.2, -1.0, 2.66);
  body.bezierCurveTo(-1.06, 3.05, -1.44, 3.1, -1.52, 2.76);
  body.bezierCurveTo(-1.64, 2.3, -1.46, 1.8, -1.42, 1.34);
  body.bezierCurveTo(-1.38, 0.92, -1.26, 0.52, -1.4, 0.12);
  body.bezierCurveTo(-1.62, -0.42, -1.82, -1.02, -1.64, -1.56);
  body.bezierCurveTo(-1.44, -2.12, -0.88, -2.25, 0, -2.25);
  extrude(body, 0.3, 0.12, -0.54, M.body, 64);

  // Pickguard: wraps the upper horn and the split pickup.
  const guard = new THREE.Shape();
  guard.moveTo(-0.36, 1.92);
  guard.bezierCurveTo(-0.62, 1.94, -0.76, 2.18, -0.8, 2.46);
  guard.bezierCurveTo(-0.84, 2.7, -1.1, 2.74, -1.17, 2.52);
  guard.bezierCurveTo(-1.25, 2.2, -1.12, 1.78, -1.09, 1.34);
  guard.bezierCurveTo(-1.06, 0.96, -0.98, 0.6, -1.04, 0.28);
  guard.bezierCurveTo(-1.1, 0.0, -0.86, -0.16, -0.52, -0.1);
  guard.bezierCurveTo(-0.18, -0.04, 0.18, 0.04, 0.46, 0.2);
  guard.bezierCurveTo(0.74, 0.36, 0.92, 0.56, 0.93, 0.88);
  guard.bezierCurveTo(0.95, 1.28, 1.16, 1.66, 1.13, 2.0);
  guard.bezierCurveTo(1.1, 2.2, 0.96, 2.2, 0.92, 2.04);
  guard.bezierCurveTo(0.86, 1.86, 0.72, 1.7, 0.38, 1.74);
  guard.lineTo(0.36, 1.92);
  guard.lineTo(-0.36, 1.92);
  extrude(guard, 0.02, 0.012, 0, M.guard, 48);

  // Neck, fretboard, frets, inlays
  const neckHalf = (y) => 0.31 - (0.31 - 0.2225) * ((y - 1.45) / (NUT - 1.45));
  const neck = new THREE.Shape();
  neck.moveTo(-neckHalf(1.45) + 0.04, 1.45); neck.lineTo(neckHalf(1.45) - 0.04, 1.45);
  neck.lineTo(neckHalf(NUT) - 0.04, NUT); neck.lineTo(-neckHalf(NUT) + 0.04, NUT); neck.closePath();
  extrude(neck, 0.14, 0.04, -0.12, M.maple, 4);

  const board = new THREE.Shape();
  board.moveTo(-neckHalf(1.55), 1.55); board.lineTo(neckHalf(1.55), 1.55);
  board.lineTo(neckHalf(NUT), NUT); board.lineTo(-neckHalf(NUT), NUT); board.closePath();
  extrude(board, 0.055, 0, 0.10, M.rose, 4);

  const fretY = (n) => NUT - SCALE * (1 - Math.pow(2, -n / 12));
  for (let n = 1; n <= 20; n++) {
    const y = fretY(n), hw = neckHalf(y);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, hw * 2, 8), M.fret);
    f.rotation.z = Math.PI / 2;
    f.position.set(0, y, 0.155);
    model.add(f);
  }
  const dotGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.01, 20);
  [3, 5, 7, 9, 12, 15, 17, 19].forEach((n) => {
    const y = (fretY(n - 1) + fretY(n)) / 2;
    const xs = n === 12 ? [-0.11, 0.11] : [0];
    xs.forEach((x) => {
      const d = new THREE.Mesh(dotGeo, M.pearl);
      d.rotation.x = Math.PI / 2;
      d.position.set(x, y, 0.153);
      model.add(d);
    });
  });
  const nut = new THREE.Mesh(new THREE.BoxGeometry(0.445, 0.05, 0.07), M.bone);
  nut.position.set(0, NUT + 0.02, 0.16);
  model.add(nut);

  // Headstock: four-in-line, posts on the bass side, the flare on the treble side.
  const head = new THREE.Shape();
  head.moveTo(-0.2225, NUT);
  head.lineTo(0.2225, NUT);
  head.bezierCurveTo(0.24, 7.92, 0.47, 8.0, 0.49, 8.38);
  head.bezierCurveTo(0.51, 8.78, 0.36, 9.0, 0.4, 9.36);
  head.bezierCurveTo(0.44, 9.68, 0.2, 9.86, -0.06, 9.83);
  head.bezierCurveTo(-0.3, 9.8, -0.37, 9.62, -0.34, 9.4);
  head.lineTo(-0.3, 8.0);
  head.bezierCurveTo(-0.29, 7.8, -0.24, 7.7, -0.2225, NUT);
  extrude(head, 0.12, 0.025, -0.07, M.maple, 40);

  const postY = [8.12, 8.56, 9.0, 9.44]; // G, D, A, E from the nut outward
  const postGeo = new THREE.CylinderGeometry(0.038, 0.045, 0.14, 16);
  const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12);
  const keyGeo = new THREE.SphereGeometry(1, 24, 12);
  postY.forEach((y) => {
    const p = new THREE.Mesh(postGeo, M.chrome);
    p.rotation.x = Math.PI / 2; p.position.set(-0.16, y, 0.15); model.add(p);
    const s = new THREE.Mesh(shaftGeo, M.chrome);
    s.rotation.z = Math.PI / 2; s.position.set(-0.42, y, 0.0); model.add(s);
    const k = new THREE.Mesh(keyGeo, M.chrome);
    k.scale.set(0.13, 0.1, 0.028); k.position.set(-0.6, y, 0.0); model.add(k);
  });

  // Bridge and saddles
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.5, 0.03), M.chrome);
  plate.position.set(0, -1.1, 0.015); model.add(plate);
  const xb = [-0.285, -0.095, 0.095, 0.285], xn = [-0.165, -0.055, 0.055, 0.165];
  xb.forEach((x) => {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.2, 0.13), M.chrome);
    s.position.set(x, BRIDGE, 0.1); model.add(s);
  });

  // Split pickup with pole pieces
  const pole = new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12);
  [[-0.18, 0.62, [-0.264, -0.088]], [0.18, 0.4, [0.088, 0.264]]].forEach(([cx, cy, sx]) => {
    extrude(roundRect(cx, cy, 0.4, 0.2, 0.06), 0.06, 0.012, 0.035, M.pickup, 12);
    sx.forEach((x) => [-0.04, 0.04].forEach((dx) => {
      const p = new THREE.Mesh(pole, M.chrome);
      p.rotation.x = Math.PI / 2; p.position.set(x + dx, cy, 0.12); model.add(p);
    }));
  });

  // Control plate and knobs
  const ctrl = extrude(roundRect(0, 0, 0.36, 1.0, 0.16), 0.012, 0.006, 0, M.chrome, 16);
  ctrl.geometry.rotateZ(0.62); ctrl.geometry.translate(1.04, -0.78, 0);
  const knobGeo = new THREE.CylinderGeometry(0.12, 0.13, 0.15, 32);
  [[0.92, -0.6], [1.16, -0.96]].forEach(([x, y]) => {
    const k = new THREE.Mesh(knobGeo, M.chrome);
    k.rotation.x = Math.PI / 2; k.position.set(x, y, 0.1); model.add(k);
  });
  const neckPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.58, 0.02), M.chrome);
  neckPlate.position.set(0, 1.7, -0.55); model.add(neckPlate);

  // Strings: cylinders that bend in a standing wave in the vertex shader.
  const strings = [];
  const gauge = [0.034, 0.028, 0.023, 0.018];
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Vector3(xb[i], BRIDGE, 0.215);
    const b = new THREE.Vector3(xn[i], NUT, 0.198);
    const len = a.distanceTo(b);
    const mat = new THREE.MeshStandardMaterial({ color: i < 3 ? 0xcfc6b8 : 0xe6e2da, metalness: 1, roughness: i < 3 ? 0.36 : 0.2, emissive: 0xffa437, emissiveIntensity: 0 });
    const u = { uAmp: { value: 0 }, uTime: { value: 0 }, uFreq: { value: 38 + i * 9 }, uLen: { value: len } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'uniform float uAmp;\nuniform float uTime;\nuniform float uFreq;\nuniform float uLen;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', [
          'vec3 transformed = vec3( position );',
          'float su = position.y / uLen + 0.5;',
          'float wv = sin(3.14159265 * su) * sin(uTime * uFreq) + 0.35 * sin(6.2831853 * su) * sin(uTime * uFreq * 2.0 + 1.3);',
          'transformed.x += uAmp * wv;'
        ].join('\n'));
    };
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(gauge[i] / 2, gauge[i] / 2, len, 8, 64), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    model.add(mesh);
    // Short run from the nut to its tuner post (G to the nearest post).
    const post = new THREE.Vector3(-0.16, postY[3 - i], 0.205);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(gauge[i] / 2, gauge[i] / 2, post.distanceTo(b), 6), M.fret);
    tail.position.copy(post).add(b).multiplyScalar(0.5);
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), post.clone().sub(b).normalize());
    model.add(tail);
    strings.push({ a, b, mat, u, amp: 0, wa: new THREE.Vector3(), wb: new THREE.Vector3(), sa: { x: 0, y: 0 }, sb: { x: 0, y: 0 } });
  }

  model.position.set(0, -3.8, 0);
  const spinner = new THREE.Group();
  spinner.add(model);
  spinner.scale.setScalar(0.1);
  const rig = new THREE.Group();
  rig.add(spinner);
  scene.add(rig);

  /* ---------- Light ---------- */
  const key = new THREE.SpotLight(0xffb45e, 0, 0, 0.42, 0.75, 2);
  key.position.set(-0.7, 2.5, 0.55);
  key.target.position.set(0, -0.05, 0);
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xff3d9e, 0, 0, 0.6, 0.6, 2);
  rim.position.set(1.7, 0.9, -1.4);
  rim.target.position.set(0, 0, 0);
  scene.add(rim, rim.target);
  const fill = new THREE.DirectionalLight(0xffe2c0, 0);
  fill.position.set(1.5, -0.6, 2.5);
  scene.add(fill);
  const LIGHT = { key: 60, rim: 75, fill: 0.45, env: 1.0 };

  // A haze beam from the key light, drawn as a soft additive cone.
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0xffa64a) }, uLevel: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = uv.y; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uLevel; varying vec3 vN; varying vec3 vV; varying float vY;\nvoid main(){ float f = pow(abs(dot(vN, vV)), 2.4); float along = pow(vY, 1.6) * smoothstep(1.0, 0.9, vY); gl_FragColor = vec4(uColor * f * along * uLevel * 0.42, 1.0); }'
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.75, 4.2, 48, 1, true), beamMat);
  {
    const from = key.position.clone(), to = new THREE.Vector3(0.35, -1.9, -0.9);
    const dir = to.clone().sub(from).normalize();
    beam.position.copy(from).addScaledVector(dir, 2.1);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  }
  scene.add(beam);

  // Dust in the beam
  const DUST = window.innerWidth < 700 ? 260 : 520;
  const dpos = new Float32Array(DUST * 3), dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const t = Math.random(), r = Math.sqrt(Math.random()) * (0.06 + t * 0.62);
    const ang = Math.random() * Math.PI * 2;
    dpos[i * 3] = Math.cos(ang) * r; dpos[i * 3 + 1] = 2.1 - t * 4.2; dpos[i * 3 + 2] = Math.sin(ang) * r;
    dseed[i] = Math.random();
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dgeo.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
  const dustMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uPx: { value: 1 }, uStir: { value: 0 } },
    vertexShader: [
      'attribute float seed; uniform float uTime; uniform float uPx; uniform float uStir; varying float vA;',
      'void main(){',
      ' vec3 p = position;',
      ' float t = uTime * (0.04 + seed * 0.05) + seed * 40.0;',
      ' p.y = mod(p.y + 2.1 - t * 0.6, 4.2) - 2.1;',
      ' p.x += sin(t * 3.0 + seed * 9.0) * (0.05 + uStir * 0.12);',
      ' p.z += cos(t * 2.3 + seed * 5.0) * (0.05 + uStir * 0.12);',
      ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      ' gl_PointSize = (1.2 + seed * 2.6) * uPx * (2.2 / -mv.z);',
      ' vA = 0.25 + 0.75 * fract(seed * 13.7);',
      ' gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: 'uniform float uLevel; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * a * vA * uLevel * 0.7, 1.0); }'
  });
  const dust = new THREE.Points(dgeo, dustMat);
  dust.position.copy(beam.position);
  dust.quaternion.copy(beam.quaternion);
  scene.add(dust);

  // A faint stage glow behind the instrument
  const backMat = new THREE.ShaderMaterial({
    depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    uniforms: { uLevel: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uLevel; varying vec2 vUv; void main(){ vec2 c = vUv - vec2(0.42, 0.56); float a = exp(-dot(c, c) * 14.0); vec2 m = vUv - vec2(0.78, 0.45); float b = exp(-dot(m, m) * 22.0); vec3 col = vec3(0.075, 0.04, 0.012) * a + vec3(0.06, 0.008, 0.035) * b; gl_FragColor = vec4(col * uLevel, 1.0); }'
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), backMat);
  back.position.set(0, 0, -2.6);
  scene.add(back);

  /* ---------- Layout ---------- */
  let W = 1, H = 1, wide = true, baseZ = 3, pose = { lean: -0.42, tilt: -0.18, face: -0.35 };
  const fovK = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const BASS_LEN = 1.21;
  function layout() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    wide = W >= 900;
    const dpr = Math.min(window.devicePixelRatio || 1, wide ? 2 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    let cx, cy, len;
    const vh = window.innerHeight || H;
    if (wide) {
      len = Math.min(vh * 0.9, W * 0.54);
      cx = W * 0.72; cy = vh * 0.5;
      pose = { lean: -0.42, tilt: -0.16, face: -0.35 };
    } else {
      const navH = 68, stage = Math.min(vh * 0.44, W * 0.95);
      len = Math.min(W * 1.0, stage * 1.45);
      cx = W * 0.5; cy = navH + stage * 0.5;
      pose = { lean: -0.98, tilt: -0.1, face: 0.32 };
    }
    // Distance so the instrument spans `len` pixels; then shift the frustum so it sits at (cx, cy).
    baseZ = (BASS_LEN * H) / (len * fovK);
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    dustMat.uniforms.uPx.value = renderer.getPixelRatio() * (wide ? 1 : 0.8) * Math.max(0.6, H / 900) * 1.5;
  }

  /* ---------- Motion state ---------- */
  let spin = -0.35, spinVel = 0.32, lastInput = 2.2, level = RM ? 1 : 0, levelT0 = null;
  let mx = 0, my = 0, tmx = 0, tmy = 0, scrollP = 0, pulse = 0, stir = 0;
  let running = false, raf = 0, last = performance.now(), clock = 0, visible = true;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function pluck(i, strength, user) {
    const s = strings[i];
    s.amp = Math.min(0.11, s.amp + 0.035 + strength * 0.06);
    pulse = Math.min(1, pulse + 0.25 + strength * 0.3);
    stir = Math.min(1, stir + 0.3);
    if (!running && !RM) startLoop();
    document.dispatchEvent(new CustomEvent('hero3d:pluck', { detail: { user: !!user } }));
  }
  function strum(delay) {
    [3, 2, 1, 0].forEach((i, k) => setTimeout(() => pluck(i, 0.7), (delay || 0) + k * 70));
  }

  const tmpN = new THREE.Vector3(), tmpC = new THREE.Vector3();
  function project() {
    for (const s of strings) {
      s.wa.copy(s.a); s.wb.copy(s.b);
      model.localToWorld(s.wa); model.localToWorld(s.wb);
      const pa = s.wa.clone().project(camera), pb = s.wb.clone().project(camera);
      s.sa.x = (pa.x + 1) / 2 * W; s.sa.y = (1 - pa.y) / 2 * H;
      s.sb.x = (pb.x + 1) / 2 * W; s.sb.y = (1 - pb.y) / 2 * H;
    }
  }
  function facing() {
    tmpN.set(0, 0, 1).transformDirection(model.matrixWorld);
    tmpC.copy(camera.position).sub(rig.position).normalize();
    return tmpN.dot(tmpC);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; clock += dt;
    mx += (tmx - mx) * 0.06; my += (tmy - my) * 0.06;

    if (!RM) {
      if (levelT0 !== null && level < 1) level = easeOut(Math.min(1, (now - levelT0) / 1700));
      const idle = clock - lastInput > 2.6;
      if (idle) {
        spinVel += (0.32 - spinVel) * 0.02;
        spin += spinVel * dt;
      } else {
        // Reaching for it turns the strings toward you.
        const target = Math.round(spin / (Math.PI * 2)) * Math.PI * 2 + pose.face;
        spinVel = 0;
        spin += (target - spin) * Math.min(1, dt * 3.2);
      }
    }
    rig.rotation.set(pose.tilt + my * 0.12 + scrollP * 0.5, 0, pose.lean + mx * 0.08);
    spinner.rotation.y = spin + mx * 0.4 + scrollP * 1.4;
    rig.position.set(0, scrollP * 0.18, -scrollP * 0.6);
    camera.position.set(0, 0, baseZ + (1 - level) * 0.6);
    camera.lookAt(0, 0, 0);

    pulse *= Math.pow(0.04, dt);
    stir *= Math.pow(0.2, dt);
    const lv = level * (1 - scrollP * 0.6);
    key.intensity = LIGHT.key * lv * (1 + pulse * 0.35);
    rim.intensity = LIGHT.rim * lv;
    fill.intensity = LIGHT.fill * lv;
    scene.environmentIntensity = LIGHT.env * (0.25 + 0.75 * lv);
    beamMat.uniforms.uLevel.value = lv * (1 + pulse * 0.25);
    dustMat.uniforms.uLevel.value = lv;
    dustMat.uniforms.uTime.value = clock;
    dustMat.uniforms.uStir.value = stir;
    backMat.uniforms.uLevel.value = lv;

    let active = false;
    for (const s of strings) {
      s.amp *= Math.pow(0.12, dt);
      if (s.amp < 0.0004) s.amp = 0; else active = true;
      s.u.uAmp.value = s.amp;
      s.u.uTime.value = clock;
      s.mat.emissiveIntensity = Math.min(2.2, s.amp * 28);
    }
    renderer.render(scene, camera);
    project();
    return active;
  }

  function loop(now) {
    frame(now);
    raf = running ? requestAnimationFrame(loop) : 0;
  }
  function startLoop() {
    if (raf || RM || !visible || document.hidden) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() { running = false; cancelAnimationFrame(raf); raf = 0; }

  /* ---------- Input: crossing a string plucks it ---------- */
  let px = null, py = null, pt = 0;
  function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(d) < 1e-6) return false;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tmx = e.clientX / window.innerWidth - 0.5;
    tmy = e.clientY / window.innerHeight - 0.5;
    if (y < 0 || y > r.height) { px = null; return; }
    lastInput = clock;
    if (!running) startLoop();
    const now = performance.now();
    if (px !== null && level > 0.5 && facing() > 0.3) {
      const speed = Math.min(1, Math.hypot(x - px, y - py) / Math.max(1, now - pt) / 2.5);
      strings.forEach((s, i) => {
        if (segCross(px, py, x, y, s.sa.x, s.sa.y, s.sb.x, s.sb.y)) pluck(i, speed, true);
      });
    }
    px = x; py = y; pt = now;
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', (e) => { px = null; onMove(e); }, { passive: true });
  window.addEventListener('pointerup', () => { px = null; }, { passive: true });

  /* ---------- Scroll, visibility, resize ---------- */
  function onScroll() {
    const h = hero.offsetHeight || 1;
    scrollP = Math.max(0, Math.min(1, window.scrollY / h));
    canvas.style.opacity = String(1 - scrollP * 0.85);
    if (RM) frame(performance.now());
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoop(); else startLoop(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible) startLoop(); else stopLoop();
    }, { threshold: 0 }).observe(hero);
  }
  let rzT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => { layout(); if (RM || !running) frame(performance.now()); }, 80);
  });

  /* ---------- Go ---------- */
  layout();
  spin = pose.face;
  // Compile shaders off the main thread where the driver allows it, so the opening sequence never stalls.
  if (renderer.compileAsync) {
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* first render compiles instead */ }
  }
  if (window.__hero3d === 'fallback') { renderer.dispose(); return; }
  onScroll();
  function lightsUp(withStrum) {
    if (RM) return;
    if (levelT0 === null) levelT0 = performance.now();
    if (withStrum) strum(380);
  }
  if (RM) {
    spin = pose.face - 0.07;
    frame(performance.now());
  } else {
    frame(performance.now());
    startLoop();
    lightsUp(INTRO);
  }
  canvas.classList.add('is-ready');
  hero.classList.add('has-3d');
  window.__hero3d = 'ready';
  document.dispatchEvent(new CustomEvent('hero3d:ready'));
}
