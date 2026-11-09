/* The bass stage: the red bass from the gig photo, built in three.js (r169, vendored, fetched only as the section
   nears). It turns into the light as you pass, its strings ring when the pointer crosses them, and a click on the
   neck frets the note under it. With sound on, every pluck plays through a Karplus-Strong string, and the readout
   answers the way the soundcheck tuner did. No WebGL2: the section stays the photo break. Reduced motion: one still
   frame, and a pluck only names (and, with sound on, plays) its note. */

import { rm, coarse, hasIO, $, $$, clamp, easeOut } from './lib.js';

const OPEN = [28, 33, 38, 43];                       // E1 A1 D2 G2 as MIDI notes, low string first
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const named = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const FRETS = 20;

/* ---------- Sound: one plucked string per note, rendered once and cached; one voice per string, like a real one ---------- */
function Amp() {
  let ac = null, out = null;
  const cache = new Map(), voices = [];

  function ready() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      const tone = ac.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 1500; tone.Q.value = 0.5;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
      out = ac.createGain();
      out.gain.value = 0.8;
      out.connect(tone); tone.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  /* Karplus-Strong: a soft burst of noise circulating in a delay line one period long, averaged and damped on every
     pass. The damping is set per sample, so a low E and a high G ring out over the same time. */
  function render(m) {
    if (cache.has(m)) return cache.get(m);
    const sr = ac.sampleRate, N = Math.max(2, Math.round(sr / hz(m) - 0.5)), len = Math.floor(sr * 2.4);
    const buf = ac.createBuffer(1, len, sr), y = buf.getChannelData(0);
    let lp = 0, mean = 0, peak = 0;
    for (let i = 0; i < N; i++) { lp += 0.32 * (Math.random() * 2 - 1 - lp); y[i] = lp; mean += lp; }
    mean /= N;
    for (let i = 0; i < N; i++) { y[i] -= mean; peak = Math.max(peak, Math.abs(y[i])); }
    for (let i = 0; i < N; i++) y[i] /= peak || 1;
    const rho = Math.exp(-N / (sr * 0.8));
    for (let i = N; i < len; i++) {
      const a = y[i - N], b = i - N - 1 >= 0 ? y[i - N - 1] : a;
      y[i] = rho * 0.5 * (a + b);
    }
    const fade = Math.floor(sr * 0.3);
    for (let i = 0; i < fade; i++) y[len - 1 - i] *= i / fade;
    cache.set(m, buf);
    return buf;
  }

  function play(i, m, vel) {
    if (!ready()) return;
    const t = ac.currentTime, v = voices[i];
    if (v) { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.012); v.s.stop(t + 0.08); }
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = render(m);
    g.gain.value = 0.3 + 0.7 * clamp(vel, 0, 1);
    s.connect(g); g.connect(out);
    s.start(t);
    voices[i] = { s, g };
    s.onended = () => { if (voices[i] && voices[i].s === s) voices[i] = null; };
  }

  return { ready, play };
}

/* ---------- The instrument (units: decimetres; saddles at y = -1.05, nut at y = 7.62) ---------- */
const SCALE = 8.64, NUT = 7.62, BRIDGE = NUT - SCALE, BASS_LEN = 1.21;
const fretY = (n) => NUT - SCALE * (1 - Math.pow(2, -n / 12));

function woodTexture(THREE, base, dark, lines, w, h, seed) {
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

function makeBass(THREE) {
  const mapleTex = woodTexture(THREE, '#e3b06b', '#8a5a26', 90, 256, 1024, 7);
  mapleTex.repeat.set(1.6, 0.12);
  const roseTex = woodTexture(THREE, '#3a2016', '#120805', 120, 256, 1024, 11);
  roseTex.repeat.set(2.2, 0.12);

  // Candy red, black guard, maple neck, rosewood board: the bass in the photo.
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: 0xc0141f, roughness: 0.5, metalness: 0, specularIntensity: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
    guard: new THREE.MeshPhysicalMaterial({ color: 0x070606, roughness: 0.45, metalness: 0, specularIntensity: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.06 }),
    maple: new THREE.MeshPhysicalMaterial({ map: mapleTex, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
    rose: new THREE.MeshStandardMaterial({ map: roseTex, roughness: 0.75 }),
    fret: new THREE.MeshStandardMaterial({ color: 0xe0dbd2, metalness: 1, roughness: 0.22 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xe9ecf1, metalness: 1, roughness: 0.09 }),
    pickup: new THREE.MeshStandardMaterial({ color: 0x23201e, roughness: 0.42 }),
    pearl: new THREE.MeshPhysicalMaterial({ color: 0xf6efe2, roughness: 0.25, clearcoat: 1, sheen: 1, sheenColor: 0xffe6c4 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.4 })
  };

  const model = new THREE.Group();
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

  // Body: an offset double-cut, the long horn on the bass side.
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

  for (let n = 1; n <= FRETS; n++) {
    const y = fretY(n), hw = neckHalf(y);
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, hw * 2, 8), M.fret);
    f.rotation.z = Math.PI / 2;
    f.position.set(0, y, 0.155);
    model.add(f);
  }
  const dotGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.01, 20);
  [3, 5, 7, 9, 12, 15, 17, 19].forEach((n) => {
    const y = (fretY(n - 1) + fretY(n)) / 2;
    (n === 12 ? [-0.11, 0.11] : [0]).forEach((x) => {
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

  /* Strings: cylinders that bend in a standing wave in the vertex shader. uEnd is the ringing share of the string,
     measured from the saddle: 1 when open, 2^(-n/12) when it is stopped at fret n. */
  const strings = [];
  const gauge = [0.034, 0.028, 0.023, 0.018];
  for (let i = 0; i < 4; i++) {
    const a = new THREE.Vector3(xb[i], BRIDGE, 0.215);
    const b = new THREE.Vector3(xn[i], NUT, 0.198);
    const len = a.distanceTo(b);
    const mat = new THREE.MeshStandardMaterial({ color: i < 3 ? 0xcfc6b8 : 0xe6e2da, metalness: 1, roughness: i < 3 ? 0.36 : 0.2, emissive: 0xffa437, emissiveIntensity: 0 });
    const u = { uAmp: { value: 0 }, uTime: { value: 0 }, uFreq: { value: 38 + i * 9 }, uLen: { value: len }, uEnd: { value: 1 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'uniform float uAmp;\nuniform float uTime;\nuniform float uFreq;\nuniform float uLen;\nuniform float uEnd;\n' +
        sh.vertexShader.replace('#include <begin_vertex>', [
          'vec3 transformed = vec3( position );',
          'float su = position.y / uLen + 0.5;',
          'float k = su / uEnd;',
          'float wv = step(su, uEnd) * (sin(3.14159265 * k) * sin(uTime * uFreq / uEnd) + 0.35 * sin(6.2831853 * k) * sin(uTime * uFreq * 2.0 / uEnd + 1.3));',
          'transformed.x += uAmp * wv;'
        ].join('\n'));
    };
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(gauge[i] / 2, gauge[i] / 2, len, 8, 64), mat);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    model.add(mesh);
    // The short run from the nut to its tuner post.
    const post = new THREE.Vector3(-0.16, postY[3 - i], 0.205);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(gauge[i] / 2, gauge[i] / 2, post.distanceTo(b), 6), M.fret);
    tail.position.copy(post).add(b).multiplyScalar(0.5);
    tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), post.clone().sub(b).normalize());
    model.add(tail);
    strings.push({ a, b, mat, u, amp: 0, last: 0, sa: { x: -1e4, y: -1e4 }, sb: { x: -1e4, y: -1e4 } });
  }

  // Where a fretted note is held: a small gold light on the string, between fret n-1 and fret n.
  const finger = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffc35c, transparent: true, opacity: 0, depthWrite: false }));
  finger.scale.set(0.07, 0.07, 0.03);
  model.add(finger);

  model.position.set(0, -3.8, 0);
  return { model, strings, finger };
}

/* ---------- The room: softbox reflections, a gold key, a magenta rim, haze in the beam ---------- */
async function build(THREE, { section, canvas, spot, strike, onLive }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const rgb = getComputedStyle(document.documentElement).getPropertyValue('--rgb-bg').trim().split(/[\s,]+/).map(Number);
  const BG = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);
  renderer.setClearColor(BG, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 40);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: 0x0c0a08, side: THREE.BackSide })));
  function panel(w, h, color, k, pos) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    env.add(m);
  }
  panel(8, 0.6, 0xffb35a, 10, [-6, 7, 1.5]);    // gold strip softbox, front left, high
  panel(0.8, 10, 0xff3fa0, 12, [7.5, 0.5, -3]); // magenta strip, right, behind
  panel(9, 0.35, 0xfff1dc, 9, [0, 9.5, 0.5]);   // white batten overhead
  panel(0.4, 6, 0xfff1dc, 5, [-8, 1, 2]);       // thin white side strip, left
  panel(14, 14, 0x2a0d18, 0.6, [0, -11, 0]);    // stage floor
  panel(5, 5, 0xfff4e6, 1.4, [1, 10, 3]);       // soft overhead fill, so chrome reads as metal
  panel(5, 1.1, 0xfff1dc, 4, [4, 4, 8]);        // a softbox behind the audience: the long highlight down the clearcoat
  panel(1.2, 6, 0xff3fa0, 5, [-7, -1, 6]);      // magenta from the house left, for a coloured edge on the body
  const envRT = pmrem.fromScene(env, 0.035);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const { model, strings, finger } = makeBass(THREE);
  const spinner = new THREE.Group();
  spinner.add(model);
  spinner.scale.setScalar(0.1);
  const rig = new THREE.Group();
  rig.add(spinner);
  scene.add(rig);

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

  const DUST = window.innerWidth < 700 ? 220 : 440;
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

  // A faint gold and magenta wash on the back wall, the way the gels land on the brick in the photo.
  const backMat = new THREE.ShaderMaterial({
    depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    uniforms: { uLevel: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uLevel; varying vec2 vUv; void main(){ vec2 c = vUv - vec2(0.42, 0.56); float a = exp(-dot(c, c) * 14.0); vec2 m = vUv - vec2(0.78, 0.45); float b = exp(-dot(m, m) * 22.0); vec3 col = vec3(0.075, 0.04, 0.012) * a + vec3(0.07, 0.008, 0.04) * b; gl_FragColor = vec4(col * uLevel, 1.0); }'
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), backMat);
  back.position.set(0, 0, -2.6);
  scene.add(back);

  /* ---------- Layout: the bass fills the .bass-spot box, wherever the CSS puts it ---------- */
  const WIDE = { lean: -0.55, tilt: -0.12, face: -0.3 }, NARROW = { lean: -0.45, tilt: -0.1, face: -0.26 };
  const fovK = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let W = 1, H = 1, baseZ = 3, pose = WIDE;
  function layout() {
    W = Math.max(1, section.clientWidth); H = Math.max(1, section.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75, Math.sqrt(3.2e6 / (W * H)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    pose = W > 900 ? WIDE : NARROW;
    const hr = section.getBoundingClientRect(), sr = spot.getBoundingClientRect();
    const sn = Math.abs(Math.sin(pose.lean)), cs = Math.cos(pose.lean);
    // The body is about a third as wide as the bass is long; fit both along the lean.
    const len = Math.max(120, Math.min(sr.height / (cs + 0.32 * sn), sr.width / (sn + 0.32 * cs)) * 0.94);
    // Nudged up and in a touch, so the body clears the controls that sit in the box's lower corner.
    const cx = sr.left - hr.left + sr.width * (W > 900 ? 0.46 : 0.5), cy = sr.top - hr.top + sr.height * (W > 900 ? 0.44 : 0.5);
    baseZ = (BASS_LEN * H) / (len * fovK);
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    dustMat.uniforms.uPx.value = renderer.getPixelRatio() * Math.max(0.6, len / 900) * 1.5;
  }

  /* ---------- Motion ---------- */
  let level = rm ? 1 : 0, struckAt = null, pT = 0, pS = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  let pulse = 0, stir = 0, clock = 0, last = performance.now(), fingerT = -10;
  let visible = false, raf = 0;

  function readP() {
    const r = spot.getBoundingClientRect(), vh = window.innerHeight || 1;
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  }

  const tmpN = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function project() {
    for (const s of strings) {
      tmpA.copy(s.a); tmpB.copy(s.b);
      model.localToWorld(tmpA).project(camera);
      model.localToWorld(tmpB).project(camera);
      s.sa.x = (tmpA.x + 1) / 2 * W; s.sa.y = (1 - tmpA.y) / 2 * H;
      s.sb.x = (tmpB.x + 1) / 2 * W; s.sb.y = (1 - tmpB.y) / 2 * H;
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
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    pS += (pT - pS) * (rm ? 1 : Math.min(1, dt * 7));

    // Lights strike once, the first time the bass comes into view: a couple of flickers, then they hold.
    if (!rm && struckAt !== null && level < 1) {
      const k = Math.min(1, (now - struckAt) / 1500);
      level = easeOut(k) * (k < 0.3 ? 0.55 + 0.45 * Math.abs(Math.sin(k * 52)) : 1);
    }

    // It turns into the light as the section rises, faces you in the middle, and keeps turning as it leaves.
    const d = rm ? 0 : pS - 0.5;
    spinner.rotation.y = pose.face + 5.6 * d * Math.abs(d) + mx * 0.3;
    rig.rotation.set(pose.tilt + d * 0.32 + my * 0.08, 0, pose.lean + mx * 0.05);
    rig.position.set(0, -d * 0.05, 0);
    camera.position.set(0, 0, baseZ + (1 - level) * 0.5);
    camera.lookAt(0, 0, 0);

    pulse *= Math.pow(0.04, dt);
    stir *= Math.pow(0.2, dt);
    const lv = level;
    key.intensity = LIGHT.key * lv * (1 + pulse * 0.35);
    rim.intensity = LIGHT.rim * lv;
    fill.intensity = LIGHT.fill * lv;
    scene.environmentIntensity = LIGHT.env * (0.2 + 0.8 * lv);
    beamMat.uniforms.uLevel.value = lv * (1 + pulse * 0.25);
    dustMat.uniforms.uLevel.value = lv;
    dustMat.uniforms.uTime.value = clock;
    dustMat.uniforms.uStir.value = stir;
    backMat.uniforms.uLevel.value = lv;

    for (const s of strings) {
      s.amp *= Math.pow(0.12, dt);
      if (s.amp < 0.0004) s.amp = 0;
      s.u.uAmp.value = s.amp;
      s.u.uTime.value = clock;
      s.mat.emissiveIntensity = Math.min(2.2, s.amp * 28);
    }
    const fk = clock - fingerT;
    finger.material.opacity = fk < 0 ? 0 : Math.max(0, 1 - fk / 0.9);

    renderer.render(scene, camera);
    project();
  }

  function loop(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    frame(now);
    raf = requestAnimationFrame(loop);
  }
  function wake() {
    if (rm) { frame(performance.now()); return; }
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  function strikeLights() {
    if (struckAt !== null || rm) return;
    struckAt = performance.now();
    // The band hits as the lights come up: one soft downstroke, low string first.
    [0, 1, 2, 3].forEach((i) => window.setTimeout(() => ring(i, 0.5, 0.35, 0), 520 + i * 70));
  }

  /* A pluck on string i at u (0 at the saddle, 1 at the nut), stopped at fret n (0 is open). */
  function ring(i, u, vel, n) {
    const s = strings[i];
    if (!s || rm) return;
    const end = Math.pow(2, -n / 12);
    s.u.uEnd.value = end;
    s.amp = Math.min(0.11, s.amp + 0.03 + vel * 0.05);
    if (n > 0) {
      const at = (Math.pow(2, -(n - 1) / 12) + end) / 2;
      finger.position.copy(s.a).lerp(s.b, at);
      finger.position.z += 0.012;
      fingerT = clock;
    }
    pulse = Math.min(1, pulse + 0.2 + vel * 0.3);
    stir = Math.min(1, stir + 0.3);
    wake();
  }

  /* ---------- Input: crossing a string strums it open; a click or tap on the neck frets the note there ---------- */
  const live = () => level > 0.6 && facing() > 0.25;
  function nearest(s, x, y) {
    const ax = s.sa.x, ay = s.sa.y, bx = s.sb.x - ax, by = s.sb.y - ay;
    const L = bx * bx + by * by || 1;
    const u = clamp(((x - ax) * bx + (y - ay) * by) / L, 0, 1);
    return { u, d: Math.hypot(x - (ax + bx * u), y - (ay + by * u)) };
  }
  function crossed(x0, y0, x1, y1, s) {
    const ax = s.sa.x, ay = s.sa.y, bx = s.sb.x, by = s.sb.y;
    const den = (x1 - x0) * (by - ay) - (y1 - y0) * (bx - ax);
    if (Math.abs(den) < 1e-6) return null;
    const t = ((ax - x0) * (by - ay) - (ay - y0) * (bx - ax)) / den;
    const u = ((ax - x0) * (y1 - y0) - (ay - y0) * (x1 - x0)) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? u : null;
  }
  // Behind fret n means between fret n-1 and fret n; past the last fret the hand is over the pickups, so it rings open.
  const fretAt = (u) => (u <= Math.pow(2, -FRETS / 12) ? 0 : clamp(Math.ceil(-12 * Math.log2(Math.max(u, 1e-4)) - 1e-6), 0, FRETS));
  function pluck(i, u, vel, n) {
    const s = strings[i], now = performance.now();
    if (now - s.last < 60) return;
    s.last = now;
    strike(i, { u, vel, fret: n });
  }

  let px = null, py = 0, pt = 0;
  function local(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  section.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || rm) return;
    const [x, y] = local(e);
    tmx = x / W - 0.5; tmy = y / H - 0.5;
    if (px !== null && live()) {
      const speed = clamp(Math.hypot(x - px, y - py) / Math.max(1, e.timeStamp - pt) / 2.2, 0, 1);
      strings.forEach((s, i) => { const u = crossed(px, py, x, y, s); if (u !== null) pluck(i, u, 0.35 + 0.65 * speed, 0); });
    }
    px = x; py = y; pt = e.timeStamp;
    wake();
  }, { passive: true });
  section.addEventListener('pointerleave', () => { px = null; tmx = 0; tmy = 0; });
  section.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a') || !live()) return;
    const [x, y] = local(e);
    let best = -1, bd = e.pointerType === 'touch' ? 26 : 14, bu = 0;
    strings.forEach((s, i) => { const h = nearest(s, x, y); if (h.d < bd) { bd = h.d; best = i; bu = h.u; } });
    if (best >= 0) { strings[best].last = 0; pluck(best, bu, 0.85, fretAt(bu)); }
  }, { passive: true });

  /* ---------- Scroll, visibility, resize ---------- */
  const onScroll = () => {
    if (rm) return;
    pT = readP();
    if (pT > 0.24) strikeLights();
    wake();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  if (hasIO) {
    new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
      if (visible) wake();
    }).observe(section);
  } else visible = true;
  if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); frame(performance.now()); }).observe(section);
  else window.addEventListener('resize', () => { layout(); frame(performance.now()); });

  layout();
  pT = pS = readP();
  if (renderer.compileAsync) {
    try { await renderer.compileAsync(scene, camera); } catch (err) { /* the first render compiles instead */ }
  }
  frame(performance.now());
  onScroll();
  onLive();
  return { ring };
}

/* ---------- Wiring ---------- */
export function initBass(section, { gl }) {
  const root = document.documentElement;
  if (!section) return;
  if (!gl || !root.classList.contains('gl2')) { root.classList.remove('gl2'); return; }

  const canvas = $('.bass-stage', section), spot = $('.bass-spot', section);
  const read = $('.bass-read', section), noteEl = $('[data-note]', section), hzEl = $('[data-hz]', section);
  const soundBtn = $('.bass-sound', section), keys = $$('[data-string]', section);
  const amp = Amp();
  let sound = false, stage = null;

  /* Name the note, sound it if the amp is on, and ring the string. */
  function strike(i, { u = 0.5, vel = 0.7, fret = 0 } = {}) {
    const m = OPEN[i] + fret;
    noteEl.textContent = named(m);
    hzEl.textContent = hz(m).toFixed(2) + ' Hz';
    read.classList.remove('hit');
    void read.offsetWidth;
    read.classList.add('hit');
    if (sound) amp.play(i, m, vel);
    if (stage) stage.ring(i, u, vel, fret);
  }

  soundBtn.addEventListener('click', () => {
    sound = !sound && !!amp.ready();
    soundBtn.setAttribute('aria-pressed', String(sound));
    soundBtn.textContent = sound ? 'Sound on' : 'Sound off';
    if (sound) strike(0, { vel: 0.6, u: 0.3 }); // the low E, the note the soundcheck tuned
  });
  keys.forEach((b) => b.addEventListener('click', () => strike(+b.getAttribute('data-string'), { vel: 0.8, u: 0.3 })));

  const fail = (err) => {
    if (err) console.warn('bass stage', err);
    section.classList.remove('is-ready');
    root.classList.remove('gl2');
  };
  const load = () => import('../assets/vendor/three.module.min.js')
    .then((THREE) => build(THREE, { section, canvas, spot, strike, onLive: () => section.classList.add('is-ready') }))
    .then((s) => { stage = s; })
    .catch(fail);

  if (hasIO) {
    const io = new IntersectionObserver((en) => {
      if (!en.some((e) => e.isIntersecting)) return;
      io.disconnect();
      load();
    }, { rootMargin: '120% 0px' });
    io.observe(section);
  } else load();
}
