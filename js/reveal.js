/* Reveals below the fold. Content is visible without JS; these only add the entrance. */

import { $$, rm, hasIO } from './lib.js';

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
