/* The house rig: the two gels behind the page swing as you scroll, a followspot tracks the pointer, the Strip outside
   travels sideways with the scroll, and whichever project is mid-screen takes the light. Without JS the page is evenly lit. */

import { $, $$, rm, coarse, hasIO } from './lib.js';

export function initRig() {
  const rig = $('.rig'), spot = $('.rig-spot');
  if (!rig) return;

  const panels = $$('.proj');
  if (hasIO && panels.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => en.target.classList.toggle('is-lit', en.isIntersecting));
    }, { rootMargin: '-32% 0px -32% 0px' });
    panels.forEach((p) => io.observe(p));
    document.documentElement.classList.add('rig-on');
  }
  /* The tape band is a window onto the Strip: while it is on screen the street comes up to full brightness. */
  const band = $('.band');
  if (hasIO && band) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => rig.classList.toggle('strip-up', en.isIntersecting));
    }, { rootMargin: '0px 0px -35% 0px' }).observe(band);
  }
  if (rm) return;

  let ticking = false, mx = null, my = 0;
  function update() {
    ticking = false;
    const y = window.scrollY;
    rig.style.setProperty('--sw', Math.sin(y / 900).toFixed(3));
    rig.style.setProperty('--sw2', Math.sin(y / 1300 + 1.2).toFixed(3));
    const max = document.documentElement.scrollHeight - window.innerHeight;
    rig.style.setProperty('--sx', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    if (spot && mx !== null) spot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
  }
  const request = () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  if (spot && !coarse) {
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY;
      rig.classList.add('has-spot');
      request();
    }, { passive: true });
  }
  update();
}
