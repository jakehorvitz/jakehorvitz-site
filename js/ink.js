/* Ink strings: a hand-inked line draws itself on, rings once, and rings again when you cross it.
   The "frets" variant runs under the pinned setlist: a fret wire per project, a marker for where you are,
   and a pluck each time a new project takes the stage. */

import { $, clamp, rm, hasIO, easeOut, easeInOut, addTick, cssVar } from './lib.js';

export function InkLine(box) {
  const cv = $('canvas', box);
  if (!cv || !cv.getContext) return null;
  const ctx = cv.getContext('2d');
  const variant = box.getAttribute('data-ink');
  const light = variant === 'light', frets = variant === 'frets';
  let LINE = '', GHOST = '', KNOT = '', MARK = '';
  let W = 0, H = 0, dpr = 1, P = [], WD = [], x0 = 0, x1 = 0, y0 = 0;
  let t0 = -1, drawn = rm, plucks = [], lastY = null, nFrets = 0, active = -1, marker = -1;
  const seed = Math.random() * 10;

  function layout() {
    LINE = cssVar('--ink-line', box) || 'rgb(214 204 210)';
    GHOST = cssVar('--ink-ghost', box) || 'rgb(74 50 64)';
    KNOT = cssVar('--ink-knot', box) || 'rgb(232 62 160)';
    MARK = 'rgb(' + (cssVar('--rgb-gold', box) || '246 196 84') + ')';
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = box.clientWidth; H = box.clientHeight;
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (frets) {
      const left = parseFloat(cssVar('--show-left', box)) || 24;
      x0 = left; x1 = W - left;
    } else {
      const gut = parseFloat(window.getComputedStyle($('.wrap') || document.body).paddingLeft) || 16;
      x0 = Math.max(gut, (W - 1240) / 2 + gut) + 10; x1 = W - x0 + 10;
    }
    y0 = H * 0.5;
    const N = clamp(Math.round((x1 - x0) / 5), 60, 320);
    P = []; WD = [];
    for (let i = 0; i < N; i++) {
      P.push({ x: x0 + (x1 - x0) * (i / (N - 1)), y: y0 + 1.4 * Math.sin(i * 0.17 + seed) + 0.9 * Math.sin(i * 0.043 + seed * 2) });
      const taper = Math.min(1, i / 12, (N - 1 - i) / 9 + 0.25);
      WD.push((1.3 + 1.0 * (0.5 + 0.5 * Math.sin(i * 0.09 + seed))) * taper + 0.3);
    }
  }

  function disp(u, now) {
    let d = 0;
    for (const p of plucks) {
      const t = now - p.t, env = p.a * Math.exp(-t / 700);
      if (env < 0.05) continue;
      const tri = u < p.u ? u / p.u : (1 - u) / (1 - p.u);
      d += env * Math.sin(t * 0.045) * (0.55 * tri + 0.45 * Math.sin(Math.PI * u));
    }
    return d;
  }
  function energy(now) {
    plucks = plucks.filter((p) => now - p.t < 4500);
    return plucks.reduce((e, p) => e + p.a * Math.exp(-(now - p.t) / 700), 0);
  }
  function stroke(prog, now, off, color, wscale) {
    const n = Math.floor(prog * (P.length - 1)), N = P.length;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (let i = 1; i <= n; i++) {
      const a = P[i - 1], b = P[i];
      ctx.lineWidth = WD[i] * wscale;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y + off(i - 1, N, now));
      ctx.lineTo(b.x, b.y + off(i, N, now));
      ctx.stroke();
    }
  }
  function frame(now) {
    if (!W || (t0 < 0 && !drawn)) return false;
    const prog = drawn ? 1 : easeInOut(clamp((now - t0) / 1500, 0, 1));
    const e = energy(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (e > 1.2 && prog >= 1) {
      const ghost = (s) => (i, N) => s * e * 0.7 * Math.sin(Math.PI * i / (N - 1));
      stroke(1, now, ghost(1), GHOST, 0.6);
      stroke(1, now, ghost(-1), GHOST, 0.6);
    }
    stroke(prog, now, (i, N, t) => disp(i / (N - 1), t), LINE, 1);
    if (frets && nFrets > 1 && prog >= 1) {
      for (let k = 0; k < nFrets; k++) {
        const u = k / (nFrets - 1), x = x0 + (x1 - x0) * u, y = y0 + disp(u, now);
        ctx.fillStyle = k === active ? KNOT : GHOST;
        ctx.fillRect(x - 1, y0 - 10, 2, 20);
        if (k === active) { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
      }
      if (marker >= 0) {
        const x = x0 + (x1 - x0) * marker, y = y0 + disp(marker, now);
        ctx.fillStyle = MARK;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (prog > 0 && !frets) {
      ctx.fillStyle = KNOT;
      ctx.beginPath(); ctx.arc(x0 - 10, y0, 3.4 * easeOut(clamp(prog * 4, 0, 1)), 0, Math.PI * 2); ctx.fill();
    }
    if (!drawn && prog >= 1) { drawn = true; if (!rm) plucks.push({ t: now, a: light ? 7 : 10, u: 0.62 }); }
    return !drawn || e > 0.05;
  }

  function pluckAt(u, amp) {
    if (rm || !drawn) return;
    plucks.push({ t: performance.now(), a: amp, u: clamp(u, 0.05, 0.95) });
    addTick(frame);
  }

  box.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (lastY !== null && x > x0 && x < x1 && (lastY - y0) * (y - y0) <= 0 && lastY !== y) {
      pluckAt((x - x0) / (x1 - x0), clamp(Math.abs(y - lastY) * 0.8 + 5, 6, 18));
    }
    lastY = y;
  }, { passive: true });
  box.addEventListener('pointerleave', () => { lastY = null; });
  box.addEventListener('pointerdown', (e) => {
    const r = cv.getBoundingClientRect();
    if (Math.abs(e.clientY - r.top - y0) < 26) pluckAt((e.clientX - r.left - x0) / (x1 - x0), 12);
  }, { passive: true });

  layout();
  if (rm || !hasIO || frets) { drawn = true; addTick(frame); }
  else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { t0 = performance.now(); addTick(frame); io.disconnect(); } });
    }, { threshold: 0.9 });
    io.observe(box);
  }
  let rz = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(rz);
    rz = window.setTimeout(() => { layout(); addTick(frame); }, 120);
  });

  return {
    layout() { layout(); addTick(frame); },
    pluckAt,
    setFrets(n) { nFrets = n; addTick(frame); },
    setActive(k) {
      if (k === active) return;
      active = k;
      if (nFrets > 1) pluckAt(k / (nFrets - 1), 11);
      addTick(frame);
    },
    setMarker(u) { marker = u; addTick(frame); }
  };
}
