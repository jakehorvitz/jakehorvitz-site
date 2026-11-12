/* The stage: a WebGL2 room with a magenta gel and a gold gel cutting through haze, a followspot on the pointer,
   and the four strings the headline stands on. Strum them by sweeping across; tap one on touch.
   Without WebGL2 a 2D canvas draws the strings and the CSS fallback paints the gels. */

import { rm, coarse, clamp, addTick, cssRGB, seconds, hasIO, easeOut } from './lib.js';
import { OMEGA, DECAY, SLOTS } from './strings.js';

const VERT = `#version 300 es
in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr, uTime, uHouse, uEnergy;
uniform vec3 uPtr;
uniform vec4 uY, uOmega;
uniform vec4 uPl[${4 * SLOTS}];
uniform vec3 uBg, uMag, uGold;
out vec4 o;
const float PI = 3.14159265;
const float DECAY = ${DECAY.toFixed(3)};

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + vec2(5.2, 1.3); a *= 0.5; } return v; }

// A cone of light hung at src (height-normalised units), aimed ang radians off straight down.
float beam(vec2 p, vec2 src, float ang, float spread) {
  vec2 d = p - src;
  float a = atan(d.x, d.y) - ang;
  float s2 = spread * spread;
  return (exp(-a * a / s2) + 0.6 * exp(-a * a / (s2 * 0.1))) / (1.0 + dot(d, d) * 1.1);
}

void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = fc / uRes.y;
  float asp = uRes.x / uRes.y;
  float t = uTime;

  float h = fbm(p * vec2(1.4, 2.2) + vec2(t * 0.035, -t * 0.018));
  float haze = 0.3 + 1.1 * h * h + 0.3 * fbm(p * 4.6 - vec2(t * 0.055, t * 0.012));

  float b1 = beam(p, vec2(asp * 0.1, -0.15), 0.42 + 0.09 * sin(t * 0.23), 0.16);
  float b2 = beam(p, vec2(asp * 0.92, -0.15), -0.44 + 0.08 * sin(t * 0.19 + 1.7), 0.14);
  // Three moving heads between the gels. Dark at rest; they come up only while the strings ring.
  float m1 = beam(p, vec2(asp * 0.34, -0.12), 0.55 * sin(t * 0.31), 0.05);
  float m2 = beam(p, vec2(asp * 0.50, -0.12), 0.50 * sin(t * 0.27 + 2.1), 0.05);
  float m3 = beam(p, vec2(asp * 0.66, -0.12), 0.55 * sin(t * 0.36 + 4.0), 0.05);
  vec3 movers = (uMag * m1 + vec3(1.0, 0.93, 0.9) * m2 * 0.55 + uGold * m3) * (0.4 * uEnergy);
  vec3 light = ((uMag * b1 * 0.85 + uGold * b2 * 0.6) * (1.0 + 0.12 * uEnergy) + movers) * haze * uHouse;

  vec2 dp = (fc - uPtr.xy) / uRes.y;
  light += vec3(1.0, 0.9, 0.86) * exp(-dot(dp, dp) / 0.02) * uPtr.z * 0.16 * (0.5 + 0.5 * haze);

  vec3 col = uBg + light * 0.5;

  float u = clamp(fc.x / uRes.x, 0.0, 1.0);
  for (int i = 0; i < 4; i++) {
    float y0 = uY[i];
    if (y0 < 0.0) continue;
    float d = 0.0, env = 0.0;
    for (int k = 0; k < ${SLOTS}; k++) {
      vec4 pl = uPl[i * ${SLOTS} + k];
      float dt = t - pl.y;
      if (pl.z > 0.0 && dt > 0.0) {
        float e = pl.z * exp(-dt / DECAY);
        float sh = 0.55 * (u < pl.x ? u / pl.x : (1.0 - u) / (1.0 - pl.x)) + 0.45 * sin(PI * u);
        d += e * sin(dt * uOmega[i]) * sh;
        env += e * sh;
      }
    }
    float w = (2.4 - float(i) * 0.36) * uDpr;
    float dist = abs(fc.y - y0 - d);
    float core = clamp(1.0 - (dist - w * 0.5) / uDpr, 0.0, 1.0);
    float wind = 0.84 + 0.16 * sin(fc.x / uDpr * 1.7 + float(i) * 1.3);
    vec3 lit = vec3(0.62, 0.58, 0.62) * (0.35 + 0.45 * uHouse) + light * 1.7;
    col = mix(col, lit * wind, core);
    // a ringing string reads as a blurred band across its swing, the way it looks to the eye
    float band = smoothstep(env + uDpr, env - uDpr, abs(fc.y - y0)) * step(0.6 * uDpr, env);
    col += lit * band * 0.06;
    float en = min(env / (14.0 * uDpr), 1.0);
    col += (light * 0.9 + vec3(0.2, 0.14, 0.18)) * exp(-dist / (7.0 * uDpr)) * (0.06 + 0.55 * en);
  }

  float vig = smoothstep(1.3, 0.3, length((fc / uRes - vec2(0.5, 0.38)) * vec2(1.2, 1.0)));
  col = mix(uBg, col, mix(0.5, 1.0, vig));
  col = mix(col, uBg, smoothstep(0.78, 1.0, fc.y / uRes.y));
  col += (hash(fc + fract(t * 7.0) * 91.0) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

function compile(gl) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, 'a');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
  return prog;
}

export function initStage(hero, canvas, strings) {
  let W = 0, H = 0, dpr = 1, visible = true, running = false, house = 1, lightFrom = 0, lightMs = 0;
  let lastPluck = seconds(), lastY = null;
  const ptr = { x: -1e4, y: -1e4, a: 0, to: 0 };
  const t0 = seconds();
  const packed = new Float32Array(4 * SLOTS * 4);
  const api = {
    gl: false,
    lines: [-1, -1, -1, -1],
    setLines(ys) { api.lines = ys.slice(0, 4); wake(); },
    lineY(i) { return api.lines[i]; },
    /* The house is dark through soundcheck; lightUp brings the gels in with a strike flicker. */
    dark() { house = 0; },
    lightUp(ms = 1100) { lightFrom = performance.now(); lightMs = ms; wake(); },
    wake: () => wake()
  };

  let gl = null, prog = null, loc = {}, ctx = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (gl) {
      prog = compile(gl);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uDpr', 'uTime', 'uHouse', 'uEnergy', 'uPtr', 'uY', 'uOmega', 'uPl', 'uBg', 'uMag', 'uGold'].forEach((n) => { loc[n] = gl.getUniformLocation(prog, n); });
      const rgb = (name) => cssRGB(name).map((v) => v / 255);
      gl.uniform3fv(loc.uBg, rgb('--rgb-bg'));
      gl.uniform3fv(loc.uMag, rgb('--rgb-mag'));
      gl.uniform3fv(loc.uGold, rgb('--rgb-gold'));
      gl.uniform4fv(loc.uOmega, OMEGA);
      api.gl = true;
      hero.classList.add('has-gl');
    }
  } catch (err) {
    gl = null;
  }
  if (!gl) ctx = canvas.getContext('2d');

  function layout() {
    W = hero.clientWidth; H = hero.clientHeight;
    // a pixel budget keeps the haze smooth on big 4K/5K screens and phone GPUs
    dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5, Math.sqrt(2.6e6 / Math.max(1, W * H)));
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    paint(performance.now());
  }

  function houseAt(now) {
    if (!lightMs) return house;
    const k = (now - lightFrom) / lightMs;
    if (k >= 1) { lightMs = 0; house = 1; return 1; }
    // lights strike: a couple of quick flickers, then they hold
    const strike = k < 0.3 ? 0.55 + 0.45 * Math.abs(Math.sin(k * 52)) : 1;
    return easeOut(k) * strike;
  }

  function paintGL(now) {
    const t = rm ? 14 : seconds() - t0;
    ptr.a += (ptr.to - ptr.a) * 0.08;
    gl.uniform2f(loc.uRes, canvas.width, canvas.height);
    gl.uniform1f(loc.uDpr, dpr);
    gl.uniform1f(loc.uTime, t);
    gl.uniform1f(loc.uHouse, houseAt(now));
    gl.uniform1f(loc.uEnergy, clamp(strings.total(seconds()) / 40, 0, 1));
    gl.uniform3f(loc.uPtr, ptr.x * dpr, ptr.y * dpr, ptr.a);
    gl.uniform4f(loc.uY, ...api.lines.map((y) => (y < 0 ? -1 : y * dpr)));
    gl.uniform4fv(loc.uPl, strings.pack(packed, t0, dpr));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function paint2D() {
    const t = seconds();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    api.lines.forEach((y0, i) => {
      if (y0 < 0) return;
      ctx.beginPath();
      for (let s = 0; s <= 120; s++) {
        const u = s / 120, y = y0 + strings.disp(i, u, t);
        if (s) ctx.lineTo(u * W, y); else ctx.moveTo(0, y);
      }
      ctx.lineWidth = 2.4 - i * 0.36;
      ctx.strokeStyle = 'rgb(200 188 196)';
      ctx.stroke();
    });
  }

  function paint(now) {
    if (!W) return;
    if (gl) paintGL(now); else if (ctx) paint2D();
  }

  /* The room breathes while it is on screen; under reduced motion it holds one still frame. */
  function frame(now) {
    if (!visible) { running = false; return false; }
    paint(now);
    const busy = lightMs || strings.total(seconds()) > 0.05 || Math.abs(ptr.to - ptr.a) > 0.01;
    if ((rm || !gl) && !busy) { running = false; return false; }
    return true;
  }
  function wake() {
    if (running || !visible) return;
    running = true;
    addTick(frame);
  }

  layout();
  if ('ResizeObserver' in window) new ResizeObserver(() => layout()).observe(hero);
  else window.addEventListener('resize', layout);
  if (hasIO) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => { visible = en.isIntersecting; if (visible) wake(); });
    }).observe(hero);
  }
  strings.onPluck(() => { lastPluck = seconds(); wake(); });
  wake();

  if (!rm) {
    /* Strum: crossing a string with the pointer plucks it where you crossed, harder the faster you move. */
    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      ptr.x = x; ptr.y = y; ptr.to = 1;
      if (lastY !== null) {
        api.lines.forEach((ly, i) => {
          if (ly >= 0 && (lastY - ly) * (y - ly) < 0) strings.pluck(i, x / W, clamp(Math.abs(y - lastY) * 0.45 + 5, 5, 20));
        });
      }
      lastY = y;
      wake();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { lastY = null; ptr.to = 0; wake(); });
    /* Touch has no hover to strum with, so a tap near a string plucks it. */
    hero.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      let best = -1, bd = 34;
      api.lines.forEach((ly, i) => { if (ly >= 0 && Math.abs(ly - y) < bd) { bd = Math.abs(ly - y); best = i; } });
      if (best >= 0) strings.pluck(best, x / W, 14);
    }, { passive: true });
    /* Left alone, the room is not silent: now and then a string rings softly on its own. */
    window.setInterval(() => {
      if (!visible || document.hidden || seconds() - lastPluck < 9) return;
      const i = Math.floor(Math.random() * 4);
      if (api.lines[i] >= 0) strings.pluck(i, 0.2 + Math.random() * 0.6, 4 + Math.random() * 3);
    }, 1500);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); hero.classList.remove('has-gl'); visible = false; });
  return api;
}
