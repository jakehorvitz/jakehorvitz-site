/* Nav: scrolled state, page progress, the mobile menu, and a status verb that follows the section you are in. */

import { $, $$, clamp, rm, hasIO, Pluck, swapText } from './lib.js';

const VERBS = { top: 'Drafting', agents: 'Calling', projects: 'Shipping', how: 'Reviewing', now: 'Planning', contact: 'Waiting on you' };

/* Report the id of whichever target crosses the middle band of the viewport. */
export function spy(targets, onChange) {
  if (!hasIO) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) onChange(en.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  targets.forEach((t) => { if (t) io.observe(t); });
}

export function initNav() {
  const nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks');
  if (!nav) return;

  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.style.setProperty('--scroll', max > 0 ? clamp(window.scrollY / max, 0, 1).toFixed(4) : '0');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (toggle && links) {
    const set = (open) => {
      links.classList.toggle('is-open', open);
      nav.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => set(!links.classList.contains('is-open')));
    $$('a', links).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('is-open')) { set(false); toggle.focus(); } });
  }

  const verb = $('.nav-verb'), glyph = Pluck($('.nav-status .pluck'));
  const anchors = $$('.nav-links a[href^="#"]');
  let shimmer = 0;
  spy(Object.keys(VERBS).map((id) => document.getElementById(id)), (id) => {
    anchors.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    if (!verb || verb.textContent === VERBS[id]) return;
    swapText(verb, VERBS[id]);
    glyph.pluck(5);
    if (!rm) {
      verb.classList.add('shimmer');
      window.clearTimeout(shimmer);
      shimmer = window.setTimeout(() => verb.classList.remove('shimmer'), 2200);
    }
  });
}
