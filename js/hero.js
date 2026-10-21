/* The hero: the headline set on the four strings (E, A, D, G), its letters riding whatever the strings do,
   and the opening that plays once the soundcheck hands over the stage: each line drops onto its string as
   an arpeggio, the tagline streams in, and the three agents check in. */

import { rm, coarse, hasIO, $, $$, clamp, pad, seconds, addTick, Pluck, swapText, tokenize, stream } from './lib.js';

const WORK = ['Tuning', 'Interrogating', 'Specifying', 'Drafting', 'Queueing', 'Building', 'Reviewing', 'Staging'];

export function initHero({ hero, strings, stage }) {
  const title = $('#heroTitle'), lines = $$('.hl-line', title);

  /* Split each line into letters; a zero-size probe at the end of the line marks its baseline. */
  const chars = lines.map((line) => {
    const text = line.textContent;
    const list = [];
    line.textContent = '';
    for (const c of text) {
      if (c === ' ') { line.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      line.appendChild(s);
      list.push({ el: s, u: 0.5 });
    }
    const probe = document.createElement('span');
    probe.className = 'bl';
    line.appendChild(probe);
    list.probe = probe;
    return list;
  });

  /* Size the headline so its longest line spans the column, between 30px and 6rem. */
  let fittedFor = -1;
  function fit() {
    const avail = title.clientWidth;
    if (!avail || avail === fittedFor) return;
    fittedFor = avail;
    title.style.fontSize = '';
    const base = parseFloat(getComputedStyle(title).fontSize);
    let widest = 0;
    lines.forEach((l) => {
      const r = document.createRange();
      r.selectNodeContents(l);
      widest = Math.max(widest, r.getBoundingClientRect().width);
    });
    if (widest) title.style.fontSize = clamp(Math.floor((base * avail) / widest * 0.99), 30, 96) + 'px';
    // On a laptop the whole stage should land in one screen: shrink the poster before the tagline and the call drop off.
    if (window.innerWidth >= 861) {
      const foot = $('.hero-foot', hero), padB = parseFloat(getComputedStyle(hero).paddingBottom) || 0;
      const room = window.innerHeight - (title.getBoundingClientRect().top - hero.getBoundingClientRect().top) - foot.offsetHeight - padB;
      const fs = parseFloat(title.style.fontSize), tall = title.offsetHeight / fs;
      if (tall && room / tall < fs) title.style.fontSize = clamp(Math.floor(room / tall), 56, 96) + 'px';
    }
  }

  /* Each string runs a hair under its line's baseline, so the capitals stand on it. */
  function measure() {
    const hr = hero.getBoundingClientRect();
    if (!hr.width) return;
    const fs = parseFloat(getComputedStyle(title).fontSize);
    const ys = chars.map((list) => list.probe.getBoundingClientRect().bottom - hr.top + fs * 0.07);
    chars.forEach((list) => list.forEach((c) => {
      const r = c.el.getBoundingClientRect();
      c.u = (r.left + r.width / 2 - hr.left) / hr.width;
    }));
    stage.setLines(ys);
  }
  /* force: the font just arrived, so the same width now fits a different size. */
  function relayout(force) { if (force === true) fittedFor = -1; fit(); measure(); }
  relayout();
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(hero);
  else window.addEventListener('resize', relayout);

  /* Letters ride the string under them for as long as it rings. */
  let riding = false;
  function ride() {
    const t = seconds();
    let busy = false;
    chars.forEach((list, i) => {
      if (strings.energy(i, t) < 0.03) {
        if (list.moved) { list.forEach((c) => { c.el.style.transform = ''; }); list.moved = false; }
        return;
      }
      busy = true;
      list.moved = true;
      list.forEach((c) => { c.el.style.transform = 'translate3d(0,' + strings.disp(i, c.u, t).toFixed(2) + 'px,0)'; });
    });
    if (!busy) riding = false;
    return busy;
  }
  strings.onPluck(() => { if (!riding && !rm) { riding = true; addTick(ride); } });

  /* Session clock: real time on the page, nothing invented. */
  const clock = $('#sessionClock'), born = Date.now();
  if (clock) {
    window.setInterval(() => {
      if (document.hidden) return;
      const s = Math.floor((Date.now() - born) / 1000);
      clock.textContent = pad(Math.floor(s / 60) % 100) + ':' + pad(s % 60);
    }, 1000);
  }

  /* A repeat visit skips the soundcheck; the band still says hello with one soft E-A-D-G. */
  function idle() {
    if (rm) return;
    window.setTimeout(() => {
      [0, 1, 2, 3].forEach((i) => window.setTimeout(() => strings.pluck(i, 0.28 + i * 0.12, 9 - i * 1.5), i * 170));
    }, 650);
  }

  function play() {
    const status = $('#heroStatus'), statusText = $('#statusText'), meta = $('#statusMeta'), tag = $('#heroTagline');
    const main = Pluck($('#heroPluck'));
    const rows = $$('.checkin', hero);
    const quotes = rows.map((r) => $('q', r));
    const finals = quotes.map((q) => q.textContent);
    const plucks = rows.map((r) => Pluck($('.pluck', r)));
    const FINAL = statusText.textContent;
    const streams = [];
    let skipped = false, verbTimer = 0, metaTimer = 0, beatTimer = 0;

    tokenize(tag);
    tag.classList.add('streaming');
    quotes.forEach((q) => { q.textContent = ''; });
    statusText.textContent = WORK[0];
    statusText.classList.add('shimmer');
    statusText.setAttribute('aria-hidden', 'true');
    hero.classList.add('playing');

    let secs = 0, wi = 0;
    const hint = coarse ? 'Tap to skip' : 'Click or press any key to skip';
    meta.textContent = '0s · ' + hint;
    metaTimer = window.setInterval(() => { secs++; meta.textContent = secs + 's · ' + hint; }, 1000);
    verbTimer = window.setInterval(() => { wi = (wi + 1) % WORK.length; swapText(statusText, WORK[wi]); }, 700);
    main.pluck(5.5);
    beatTimer = window.setInterval(() => main.pluck(5.5), 950);

    const wait = (ms) => new Promise((res, rej) => window.setTimeout(() => (skipped ? rej('skip') : res()), ms));

    /* A line falls onto its string; the landing plucks the string and the letters ring with it. */
    function drop(i) {
      const list = chars[i], mid = list[Math.floor(list.length / 2)];
      list.forEach((c, j) => {
        c.el.classList.add('in');
        if (c.el.animate) {
          c.drop = c.el.animate(
            [{ translate: '0 -0.9em', opacity: 0, filter: 'blur(10px)' }, { translate: '0 0', opacity: 1, filter: 'blur(0px)' }],
            { duration: 440, delay: j * 22, easing: 'cubic-bezier(0.5, 0, 0.9, 0.45)', fill: 'backwards' }
          );
        }
      });
      return wait(440 + Math.floor(list.length / 2) * 22).then(() => strings.pluck(i, mid ? mid.u : 0.4, 17 - i * 2.2));
    }
    function type(q, text) {
      q.classList.add('caret');
      q.textContent = '';
      let i = 0;
      const next = () => {
        if (i >= text.length) return wait(260).then(() => q.classList.remove('caret'));
        q.textContent += text.charAt(i++);
        return wait(26 + Math.random() * 22).then(next);
      };
      return next();
    }
    function erase(q) {
      q.classList.add('caret');
      const next = () => {
        if (!q.textContent.length) return Promise.resolve();
        q.textContent = q.textContent.slice(0, -1);
        return wait(14).then(next);
      };
      return next();
    }
    function speak(k, text) {
      rows[k].classList.add('is-speaking');
      plucks[k].pluck(6);
      return type(quotes[k], text).then(() => rows[k].classList.remove('is-speaking'));
    }
    function settleStatus() {
      window.clearInterval(verbTimer); window.clearInterval(metaTimer); window.clearInterval(beatTimer);
      statusText.classList.remove('shimmer');
      statusText.removeAttribute('aria-hidden');
      status.classList.add('is-done');
    }
    function cleanup() {
      window.setTimeout(() => hero.classList.remove('playing', 'cta-in'), 900);
      ['pointerdown', 'keydown'].forEach((ev) => window.removeEventListener(ev, skip, true));
    }
    function skip(e) {
      if (skipped) return;
      if (e && e.type === 'pointerdown' && !hero.contains(e.target)) return;
      skipped = true;
      streams.forEach((s) => s.finish());
      chars.forEach((list) => list.forEach((c) => { c.el.classList.add('in'); if (c.drop) c.drop.finish(); }));
      (tag.__toks || []).forEach((t) => t.classList.add('on'));
      hero.classList.add('cta-in');
      rows.forEach((r, k) => { r.classList.add('in'); r.classList.remove('is-speaking'); quotes[k].classList.remove('caret'); quotes[k].textContent = finals[k]; });
      settleStatus();
      statusText.textContent = FINAL;
      cleanup();
    }
    ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, skip, { capture: true, passive: true }));
    if (hasIO) new IntersectionObserver((entries) => entries.forEach((en) => { if (!en.isIntersecting) skip(); })).observe(title);

    wait(120)
      .then(() => Promise.all([0, 1, 2, 3].map((i) => wait(i * 300).then(() => drop(i)))))
      .then(() => wait(160))
      .then(() => { const s = stream(tag, 2.6); streams.push(s); return s.done; })
      .then(() => { hero.classList.add('cta-in'); return wait(260); })
      .then(() => rows.reduce((p, r) => p.then(() => { r.classList.add('in'); return wait(160); }), Promise.resolve()))
      .then(() => wait(320))
      .then(() => speak(0, finals[0]))
      .then(() => speak(1, 'Task accepted'))
      .then(() => wait(620))
      .then(() => erase(quotes[1]))
      .then(() => speak(1, finals[1]))
      .then(() => speak(2, finals[2]))
      .then(() => {
        settleStatus();
        swapText(statusText, FINAL);
        main.pluck(7);
        skipped = true;
        cleanup();
      })
      .catch(() => { /* skipped: skip() already painted the finished state */ });
  }

  return { relayout, play, idle, lineY: (i) => stage.lineY(i) };
}
