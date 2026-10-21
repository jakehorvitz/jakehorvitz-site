/* The show: on a wide screen the setlist pins and the projects travel sideways as you scroll down, one vertical
   pixel per horizontal pixel. The panel on stage is full strength; the next one waits in the wings. On narrow
   screens, short screens, or under reduced motion it is a plain vertical list with a sticky setlist. */

import { $, $$, clamp, rm, hasIO } from './lib.js';

export function initShow(root, ink) {
  if (!root) return;
  const track = $('.show-track', root), panels = $$('.proj', track), links = $$('.setlist a', root);
  const setTrack = $('.setlist-track', root);
  const wide = window.matchMedia('(min-width: 1000px) and (min-height: 620px)');
  const N = panels.length;
  let pinned = false, start = 0, step = 1, dist = 0, active = -1, ticking = false;
  const navH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;

  if (ink) ink.setFrets(N);

  function setActive(k) {
    if (k === active) return;
    active = k;
    links.forEach((a, j) => a.classList.toggle('is-on', j === k));
    const on = links[k];
    if (!pinned && on && setTrack.scrollWidth > setTrack.clientWidth) {
      setTrack.scrollTo({ left: Math.max(0, on.offsetLeft - (setTrack.clientWidth - on.offsetWidth) / 2), behavior: rm ? 'auto' : 'smooth' });
    }
    if (pinned && ink) ink.setActive(k);
  }

  function layout() {
    pinned = wide.matches && !rm;
    root.classList.toggle('is-pinned', pinned);
    if (!pinned) {
      root.style.height = '';
      track.style.removeProperty('--show-x');
      panels.forEach((p) => { p.style.removeProperty('--o'); p.style.removeProperty('--par'); });
      return;
    }
    const vw = document.documentElement.clientWidth;
    const gutter = clamp(vw * 0.04, 16, 48);
    const left = Math.max(gutter, (vw - 1240) / 2 + gutter);
    const panelW = Math.min(vw * 0.8, 1240);
    const gap = clamp(vw * 0.06, 48, 120);
    root.style.setProperty('--show-left', left + 'px');
    root.style.setProperty('--panel-w', panelW + 'px');
    root.style.setProperty('--show-gap', gap + 'px');
    step = panelW + gap;
    dist = step * (N - 1);
    const pinH = window.innerHeight - navH();
    root.style.height = (pinH + dist) + 'px';
    start = root.getBoundingClientRect().top + window.scrollY - navH();
    if (ink) ink.layout();
    update();
  }

  function update() {
    ticking = false;
    if (!pinned) return;
    const x = clamp(window.scrollY - start, 0, dist);
    track.style.setProperty('--show-x', (-x).toFixed(1) + 'px');
    panels.forEach((p, i) => {
      const d = clamp((i * step - x) / step, -1.5, 1.5);
      p.style.setProperty('--o', (1 - Math.min(Math.abs(d), 1) * 0.6).toFixed(3));
      p.style.setProperty('--par', (d * 70).toFixed(1) + 'px');
    });
    setActive(Math.round(x / step));
    if (ink) ink.setMarker(dist ? x / dist : 0);
  }

  const yFor = (i) => start + i * step;

  /* Setlist links and keyboard focus both move the page, so the panel you asked for is the one on stage. */
  links.forEach((a, i) => a.addEventListener('click', (e) => {
    if (!pinned) return;
    e.preventDefault();
    window.scrollTo({ top: yFor(i) + 1, behavior: rm ? 'auto' : 'smooth' });
  }));
  track.addEventListener('focusin', (e) => {
    if (!pinned) return;
    const i = panels.findIndex((p) => p.contains(e.target));
    if (i >= 0 && i !== active) window.scrollTo({ top: yFor(i) + 1, behavior: 'auto' });
  });

  /* In the vertical layout the setlist follows whichever project is in the middle of the screen. */
  if (hasIO) {
    const io = new IntersectionObserver((entries) => {
      if (pinned) return;
      entries.forEach((en) => { if (en.isIntersecting) setActive(panels.indexOf(en.target)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    panels.forEach((p) => io.observe(p));
  }

  layout();
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
  let rz = 0;
  window.addEventListener('resize', () => { window.clearTimeout(rz); rz = window.setTimeout(layout, 120); });
  if (wide.addEventListener) wide.addEventListener('change', layout);
  if ('ResizeObserver' in window) new ResizeObserver(() => { if (pinned) { start = root.getBoundingClientRect().top + window.scrollY - navH(); update(); } }).observe(document.body);

  /* A deep link to a project lands with that project on stage. */
  const hashIndex = panels.findIndex((p) => '#' + p.id === window.location.hash);
  if (hashIndex >= 0 && pinned) window.requestAnimationFrame(() => window.scrollTo({ top: yFor(hashIndex) + 1, behavior: 'auto' }));

  return { layout };
}
