/* Shared helpers: one frame loop, the string glyph, status-line swaps, and streamed text. */

export const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarse = window.matchMedia('(pointer: coarse)').matches;
export const hasIO = 'IntersectionObserver' in window;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const pad = (n) => (n < 10 ? '0' + n : String(n));
export const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));
export const seconds = () => performance.now() / 1000;

/* Read an "r g b" triplet token from CSS (the --rgb-* tokens in styles.css). */
export function cssRGB(name, el = document.documentElement) {
  const v = getComputedStyle(el).getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
  return v.length === 3 && v.every((n) => !Number.isNaN(n)) ? v : [255, 255, 255];
}
export const cssVar = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

/* ---------- One shared frame loop. Each tick returns false when it has nothing left to draw. ---------- */
const ticks = new Set();
let raf = 0;
function loop(now) {
  raf = 0;
  ticks.forEach((fn) => { if (fn(now) === false) ticks.delete(fn); });
  if (ticks.size) raf = window.requestAnimationFrame(loop);
}
export function addTick(fn) {
  ticks.add(fn);
  if (!raf) raf = window.requestAnimationFrame(loop);
}

/* Fire once per element when it enters the viewport (or right away without IntersectionObserver). */
export function onEnter(els, fn, options) {
  if (!hasIO) { els.forEach(fn); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); fn(en.target); } });
  }, options);
  els.forEach((el) => io.observe(el));
}

/* ---------- The string glyph: pluck it and it rings, then settles ---------- */
export function Pluck(svg) {
  if (!svg) return { pluck() {} };
  const str = $('.str', svg), g1 = $('.g1', svg), g2 = $('.g2', svg);
  let t0 = 0, amp = 0;
  const d = (a) => 'M10 3 Q ' + (10 + 2 * a).toFixed(2) + ' 15 10 27';
  function draw(now) {
    const t = now - t0, env = amp * Math.exp(-t / 520);
    if (env < 0.05) { str.setAttribute('d', d(0)); g1.style.opacity = 0; g2.style.opacity = 0; return false; }
    str.setAttribute('d', d(env * Math.sin(t * 0.055)));
    g1.setAttribute('d', d(env)); g2.setAttribute('d', d(-env));
    g1.style.opacity = g2.style.opacity = (env / amp * 0.3).toFixed(3);
  }
  return { pluck(a) { if (rm) return; t0 = performance.now(); amp = a || 5; addTick(draw); } };
}

/* Swap a short label the way a status line does: a quick lift out, a soft settle in. */
export function swapText(el, text) {
  if (el.textContent === text) return;
  if (rm || !el.animate) { el.textContent = text; return; }
  const out = el.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 110, easing: 'ease-in' });
  out.onfinish = () => {
    el.textContent = text;
    el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
  };
}

/* ---------- Streamed text: words arrive in chunks of one to three, blur to sharp ---------- */
export function tokenize(el) {
  if (el.__toks) return el.__toks;
  const words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
  el.textContent = '';
  el.__toks = words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'tok';
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    return s;
  });
  return el.__toks;
}
export function stream(el, speed) {
  const toks = tokenize(el);
  let i = 0, timer = 0, done = false, resolve;
  const promise = new Promise((r) => { resolve = r; });
  el.classList.add('streaming');
  void el.offsetWidth;
  function finish() {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    toks.forEach((t) => t.classList.add('on'));
    window.setTimeout(() => el.classList.remove('streaming'), 900);
    resolve();
  }
  function step() {
    if (done) return;
    const n = Math.min(toks.length - i, 1 + Math.floor(Math.random() * 3));
    for (let k = 0; k < n; k++) toks[i + k].classList.add('on');
    i += n;
    if (i >= toks.length) { finish(); return; }
    timer = window.setTimeout(step, (55 + Math.random() * 90) / speed);
  }
  step();
  return { done: promise, finish };
}
