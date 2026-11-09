/* The show: the projects run top to bottom (Oct 21, Jake: the whole site is vertical). The setlist marks whichever
   project is in the middle of the screen, and its height sets where the project text sticks on wide screens. */

import { $, $$, hasIO } from './lib.js';

export function initShow(root) {
  if (!root) return;
  const panels = $$('.proj', root), links = $$('.setlist a', root), setlist = $('.setlist', root);
  let active = -1;

  function setActive(k) {
    if (k < 0 || k === active) return;
    active = k;
    links.forEach((a, j) => a.classList.toggle('is-on', j === k));
  }

  const measure = () => document.documentElement.style.setProperty('--setlist-h', (setlist ? setlist.offsetHeight : 0) + 'px');
  measure();
  if ('ResizeObserver' in window && setlist) new ResizeObserver(measure).observe(setlist);

  if (hasIO) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(panels.indexOf(en.target)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    panels.forEach((p) => io.observe(p));
  }
}
