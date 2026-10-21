/* The four bass strings' physics, shared by the WebGL stage (which draws them) and the headline (whose letters ride them).
   A pluck is a triangle-shaped displacement peaked where it was struck, ringing at the string's own rate and decaying. */

import { clamp, seconds } from './lib.js';

export const OMEGA = [34, 41, 49, 58];  // rad/s, slow enough to read at 60fps; the low E swings slowest
export const DECAY = 0.95;              // seconds to fall to 1/e
export const SLOTS = 4;                 // plucks kept per string (the shader reads exactly this many)

function shape(u, at) {
  const tri = u < at ? u / at : (1 - u) / (1 - at);
  return 0.55 * tri + 0.45 * Math.sin(Math.PI * u);
}

export class Strings {
  constructor(n = 4) {
    this.n = n;
    this.plucks = Array.from({ length: n }, () => []);
    this.listeners = [];
  }

  onPluck(fn) { this.listeners.push(fn); }

  /* u is 0..1 along the string, amp is CSS px of peak displacement. */
  pluck(i, u, amp, t = seconds()) {
    const list = this.plucks[i];
    if (!list) return;
    list.push({ u: clamp(u, 0.04, 0.96), a: amp, t });
    if (list.length > SLOTS) list.shift();
    this.listeners.forEach((fn) => fn(i, t));
  }

  disp(i, u, t) {
    let d = 0;
    for (const p of this.plucks[i]) {
      const dt = t - p.t;
      if (dt < 0) continue;
      const env = p.a * Math.exp(-dt / DECAY);
      if (env < 0.02) continue;
      d += env * Math.sin(dt * OMEGA[i]) * shape(u, p.u);
    }
    return d;
  }

  energy(i, t) {
    let e = 0;
    for (const p of this.plucks[i]) { const dt = t - p.t; if (dt >= 0) e += p.a * Math.exp(-dt / DECAY); }
    return e;
  }

  total(t) {
    let e = 0;
    for (let i = 0; i < this.n; i++) e += this.energy(i, t);
    return e;
  }

  /* Uniform payload for the shader: per string, SLOTS x (u, start time relative to t0, amp in buffer px, 0). */
  pack(out, t0, scale) {
    out.fill(0);
    for (let i = 0; i < this.n; i++) {
      this.plucks[i].forEach((p, k) => {
        const o = (i * SLOTS + k) * 4;
        out[o] = p.u; out[o + 1] = p.t - t0; out[o + 2] = p.a * scale;
      });
    }
    return out;
  }
}
