/* Reveals and streams below the fold. Content is visible without JS; these only add the entrance. */

import { $$, rm, hasIO, tokenize, stream } from './lib.js';

/* Section heads and project notes arrive the way they are written. */
export function initStreams() {
  if (rm || !hasIO) return;
  const vh0 = window.innerHeight;
  const pending = $$('[data-stream]').filter((el) => el.getBoundingClientRect().top > vh0);
  pending.forEach((el) => { tokenize(el); el.classList.add('streaming'); });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const n = en.target.__toks ? en.target.__toks.length : 10;
      stream(en.target, Math.max(1.4, n / 14));
    });
  }, { threshold: 0.35 });
  pending.forEach((el) => io.observe(el));
}

export function initReveals() {
  const reveals = $$('.rv');
  if (rm || !hasIO) { reveals.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  reveals.forEach((el) => io.observe(el));
  window.setTimeout(() => {
    // Anything still waiting below the fold keeps its entrance; anything already passed is shown.
    reveals.forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in'); });
  }, 4000);
}
