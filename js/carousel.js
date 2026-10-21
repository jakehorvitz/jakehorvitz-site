/* Carousels: scroll-snap tracks with buttons, dots, arrow keys, and an autoplay that runs only while the carousel
   is on screen and stops for good on any user input. */

import { $, $$, rm, hasIO } from './lib.js';

export function initCarousel(root) {
  const track = $('.car-track', root);
  if (!track) return;
  const slides = Array.from(track.children), n = slides.length;
  if (n < 2) { root.classList.add('car--single'); return; }
  const prev = $('[data-prev]', root), next = $('[data-next]', root), dots = $('.car-dots', root), count = $('.car-count', root);
  let i = 0, timer = 0, inView = false, hover = false, stopped = rm, settle = 0;

  slides.forEach((s, k) => {
    s.setAttribute('aria-roledescription', 'slide');
    s.setAttribute('aria-label', (k + 1) + ' of ' + n);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'car-dot';
    b.tabIndex = -1;
    b.addEventListener('click', () => go(k, true));
    dots.appendChild(b);
  });
  const dotEls = Array.from(dots.children);

  function render() {
    dotEls.forEach((d, k) => d.classList.toggle('is-on', k === i));
    count.textContent = (i + 1) + ' / ' + n;
  }
  function go(k, user) {
    i = (k + n) % n;
    track.scrollTo({ left: i * track.clientWidth, behavior: rm ? 'auto' : 'smooth' });
    render();
    if (user) stopAuto(); else schedule();
  }
  function schedule() {
    window.clearTimeout(timer);
    if (stopped || !inView) return;
    timer = window.setTimeout(() => {
      if (!hover && !document.hidden) go(i + 1, false); else schedule();
    }, 5500);
  }
  function startAuto() {
    if (stopped) return;
    root.classList.add('is-auto');
    // Force-load every slide so the first automatic advance never shows a blank frame.
    $$('img[loading="lazy"]', track).forEach((img) => { img.loading = 'eager'; });
    render();
    schedule();
  }
  function stopAuto() {
    stopped = true;
    window.clearTimeout(timer);
    root.classList.remove('is-auto');
    render();
  }

  prev.addEventListener('click', () => go(i - 1, true));
  next.addEventListener('click', () => go(i + 1, true));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
  });
  track.addEventListener('scroll', () => {
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      const k = Math.round(track.scrollLeft / track.clientWidth);
      if (k !== i && k >= 0 && k < n) { i = k; render(); }
    }, 90);
  }, { passive: true });
  track.addEventListener('pointerdown', stopAuto, { passive: true });
  track.addEventListener('touchstart', stopAuto, { passive: true });
  root.addEventListener('pointerenter', () => { hover = true; });
  root.addEventListener('pointerleave', () => { hover = false; });
  root.addEventListener('focusin', () => { hover = true; });
  root.addEventListener('focusout', () => { hover = false; });
  if (hasIO) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        inView = en.isIntersecting;
        if (inView) startAuto(); else window.clearTimeout(timer);
      });
    }, { threshold: 0.45 }).observe(root);
  }
  window.addEventListener('resize', () => track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' }));
  render();
}
