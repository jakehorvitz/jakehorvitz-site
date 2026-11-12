/* Scroll scenes: each [data-scene] gets --p from 0 to 1 as it passes. The device stage rides the same tick:
   the laptop lid opens, the screen powers on, then Bartok's queue scrolls with the page. */

import { $, $$, clamp, rm, easeOut, easeInOut } from './lib.js';

function sceneP(el, r, vh) {
  const mode = el.getAttribute('data-scene');
  if (mode === 'through') return clamp((vh - r.top) / (vh + r.height), 0, 1);
  if (mode === 'pin') {
    // progress through the pinned stretch: 0 when the child sticks, 1 when it lets go
    const child = el.firstElementChild, top = parseFloat(getComputedStyle(child).top) || 0;
    return clamp((top - r.top) / Math.max(1, r.height - child.offsetHeight), 0, 1);
  }
  if (mode === 'fill') return clamp((vh * 0.8 - r.top) / Math.max(1, r.height), 0, 1);
  return easeOut(clamp((vh - r.top) / (vh * 0.62), 0, 1));
}

function devices(root) {
  const screen = $('.laptop-screen', root), img = screen && $('img', screen), phone = $('.phone', root);
  if (!img) return null;
  function place(prog) {
    const h = img.offsetHeight;
    if (h) img.style.setProperty('--sy', (-(easeInOut(prog) * Math.max(0, h - screen.clientHeight))).toFixed(1) + 'px');
  }
  if (rm) { img.addEventListener('load', () => place(0)); return null; }
  const update = () => {
    const r = root.getBoundingClientRect(), vh = window.innerHeight || 1;
    const open = clamp((vh * 0.9 - r.top) / (vh * 0.45), 0, 1);
    root.style.setProperty('--lid', ((1 - easeOut(open)) * 86).toFixed(2));
    root.style.setProperty('--pow', clamp((open - 0.4) / 0.3, 0, 1).toFixed(3));
    root.style.setProperty('--ph', easeOut(clamp((open - 0.3) / 0.7, 0, 1)).toFixed(3));
    const prog = clamp((vh * 0.4 - r.top) / (vh * 0.4 + r.height * 0.55), 0, 1);
    place(prog);
    if (phone) phone.style.setProperty('--py', ((0.5 - prog) * 28).toFixed(1) + 'px');
  };
  img.addEventListener('load', update);
  return update;
}

export function initScenes() {
  const scenes = $$('[data-scene]');
  const deviceUpdate = devices($('[data-devices]'));
  if (rm) return;
  let ticking = false;
  function update() {
    ticking = false;
    const vh = window.innerHeight || 1;
    scenes.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
      const p = sceneP(el, r, vh).toFixed(3);
      if (el.__p !== p) { el.__p = p; el.style.setProperty('--p', p); }
    });
    if (deviceUpdate) deviceUpdate();
  }
  const request = () => { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
  update();
}
