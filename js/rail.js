/* Pipeline rail: a signal walks the ten gates while the rail is on screen; owner gates hold longer. */

import { $, $$, pad, rm, hasIO, Pluck, swapText } from './lib.js';

export function initRail(vis) {
  const lis = $$('.rail li', vis), verb = $('.rail-verb', vis), nEl = $('.rail-n', vis), glyph = Pluck($('.rail-status .pluck', vis));
  let i = -1, timer = 0;
  function paint(k) {
    lis.forEach((li, j) => { li.classList.toggle('done', j < k); li.classList.toggle('on', j === k); });
    swapText(verb, lis[k].getAttribute('data-verb'));
    nEl.textContent = 'gate ' + pad(k + 1) + ' of ' + lis.length;
  }
  if (rm || !hasIO) { paint(lis.length - 1); return; }
  function step() {
    i = (i + 1) % lis.length;
    paint(i);
    glyph.pluck(4.5);
    const owner = lis[i].getAttribute('data-gate') === 'owner';
    timer = window.setTimeout(step, i === lis.length - 1 ? 2600 : owner ? 1700 : 850);
  }
  new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      window.clearTimeout(timer);
      if (en.isIntersecting) { vis.classList.add('is-running'); verb.classList.add('shimmer'); step(); }
      else verb.classList.remove('shimmer');
    });
  }, { threshold: 0.5 }).observe(vis);
}
