/* Soundcheck: a tuner on the low E string (41.20 Hz). The needle follows real loading (fonts, the agents' faces,
   the stage) and the string beats slower as it nears pitch, the way two close notes do. In tune, the string is
   plucked, the room splits along it, and the string glides up to become the E string the headline stands on. */

import { rm, coarse, $, clamp, easeOut, easeOutExpo, cssVar } from './lib.js';

const E1 = 41.2034;
const MIN_MS = 1500;   // never flash: the needle takes at least this long to reach pitch
const CAP_MS = 4500;   // never hold the room shut on a stalled request

export function runIntro({ root, stage, strings, tasks, onHandoff }) {
  const el = $('#intro');
  window.clearTimeout(window.__introSafety);
  if (!el || !root.classList.contains('intro-on')) { onHandoff(); return; }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const needle = $('.tuner-needle', el), hz = $('[data-hz]', el), cents = $('[data-cents]', el), load = $('[data-load]', el);
  if (coarse) $('[data-hint]', el).textContent = 'Tap to skip';
  const cv = $('.intro-string', el), ctx = cv.getContext('2d');
  const STEEL = cssVar('--ink-line') || '#d6ccd2', GHOST = cssVar('--ink-ghost') || '#4a3240';
  const GOLD = 'rgb(' + cssVar('--rgb-gold') + ')', MAG = 'rgb(' + cssVar('--rgb-mag') + ')';

  let W = 0, H = 0, dpr = 1, split = 0, y = 0;
  let done = 0, p = 0, last = performance.now();
  const start = last, total = tasks.length;
  let phase = 'tuning', skipped = false, tunedAt = 0, pluckAt = 0, openAt = 0, glideFrom = 0, glideTo = 0, glideMs = 1050;

  stage.dark();
  tasks.forEach((t) => Promise.resolve(t).catch(() => {}).then(() => { done++; }));
  window.setTimeout(() => { done = total; }, CAP_MS);

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    split = Math.round(H * 0.58);
    el.style.setProperty('--split', split + 'px');
    if (phase === 'tuning' || phase === 'tuned') y = split;
  }
  layout();
  window.addEventListener('resize', layout);

  function skip() {
    if (skipped || phase === 'gone') return;
    skipped = true;
    done = total; p = 1;
    glideMs = 700;
  }
  el.addEventListener('pointerdown', skip);
  window.addEventListener('keydown', skip);

  /* One string, drawn as the eye sees it ringing: a sharp line inside the faint blur of its own swing. */
  function draw(now, env, color, glow) {
    const t = now / 1000, ph = Math.sin(t * 36), N = 96;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';
    const path = (k) => {
      ctx.beginPath();
      for (let s = 0; s <= N; s++) {
        const u = s / N, yy = y + k * env * Math.sin(Math.PI * u);
        if (s) ctx.lineTo(u * W, yy); else ctx.moveTo(0, yy);
      }
    };
    ctx.lineWidth = 1;
    ctx.strokeStyle = GHOST;
    path(1); ctx.stroke();
    path(-1); ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = color;
    path(ph); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function readout(c) {
    needle.style.setProperty('--cents', c.toFixed(2));
    hz.textContent = (E1 * Math.pow(2, c / 1200)).toFixed(2) + ' Hz';
    const r = Math.round(c);
    cents.textContent = r === 0 ? '0¢' : (r < 0 ? '−' : '+') + Math.abs(r) + '¢';
    load.textContent = 'loading ' + Math.round(p * 100) + '%';
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (phase === 'tuning') {
      const target = total ? Math.min(1, done / total) : 1;
      p = Math.min(target, p + dt / (MIN_MS / 1000));
      const k = easeOut(p), off = 1 - k;
      // a real needle never sits still on a decaying note: it drifts and twitches, less as it closes in
      const c = -50 * off + (7 * Math.sin(now * 0.0047) + 2.2 * Math.sin(now * 0.031)) * off;
      readout(c);
      const beat = Math.abs(E1 * (Math.pow(2, c / 1200) - 1));
      const env = 1.5 + 6.5 * Math.abs(Math.cos(Math.PI * beat * now / 1000));
      draw(now, env, STEEL, 0);
      if (p >= 1 && (skipped || now - start >= MIN_MS)) {
        phase = 'tuned';
        tunedAt = now;
        el.classList.add('is-tuned');
        readout(0);
        cents.textContent = 'in tune';
        load.textContent = 'ready';
      }
      return true;
    }

    if (phase === 'tuned') {
      const hold = skipped ? 90 : 380;
      if (!pluckAt && now - tunedAt >= hold) pluckAt = now;
      const env = pluckAt ? 2 + 24 * Math.exp(-(now - pluckAt) / 420) : 8;
      draw(now, env, GOLD, pluckAt ? 26 : 14);
      if (pluckAt && now - pluckAt >= (skipped ? 60 : 160)) {
        phase = 'open';
        openAt = now;
        glideFrom = y;
        const target = stage.lineY(0);
        glideTo = target >= 0 ? target : H * 0.32;
        el.classList.add('is-open');
        stage.lightUp(1100);
      }
      return true;
    }

    if (phase === 'open') {
      const k = clamp((now - openAt) / glideMs, 0, 1);
      y = glideFrom + (glideTo - glideFrom) * easeOutExpo(k);
      const env = 2 + 24 * Math.exp(-(now - pluckAt) / 420);
      draw(now, env, k < 0.5 ? GOLD : MAG, 20 * (1 - k));
      if (k >= 1) {
        // hand the ringing over to the stage's own E string, so the note never stops
        strings.pluck(0, 0.5, Math.max(6, env));
        phase = 'gone';
        window.removeEventListener('keydown', skip);
        window.removeEventListener('resize', layout);
        root.classList.remove('intro-on');
        onHandoff();
        return false;
      }
      return true;
    }
    return false;
  }

  if (rm) {
    // forced under reduced motion (?intro): no needle chase, just the readout, then the page
    Promise.race([Promise.all(tasks), new Promise((r) => window.setTimeout(r, 1500))]).then(() => {
      readout(0);
      root.classList.remove('intro-on');
      onHandoff();
    });
    return;
  }
  /* Whatever happens, the soundcheck never holds the page: an error or a stall opens the room. */
  function bail() {
    if (phase === 'gone') return;
    phase = 'gone';
    window.removeEventListener('keydown', skip);
    window.removeEventListener('resize', layout);
    root.classList.remove('intro-on');
    onHandoff();
  }
  window.setTimeout(bail, CAP_MS + 4000);
  window.requestAnimationFrame(function loop(now) {
    let more = false;
    try { more = frame(now); } catch (err) { bail(); }
    if (more) window.requestAnimationFrame(loop);
  });
}
