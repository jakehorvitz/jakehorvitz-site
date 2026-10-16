(function () {
  'use strict';
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var hasIO = 'IntersectionObserver' in window;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /* ---------- One shared frame loop. Each tick returns false when it has nothing left to draw. ---------- */
  var ticks = [], raf = 0;
  function addTick(fn) { if (ticks.indexOf(fn) < 0) ticks.push(fn); if (!raf) raf = window.requestAnimationFrame(loop); }
  function loop(now) {
    raf = 0;
    ticks = ticks.filter(function (fn) { return fn(now) !== false; });
    if (ticks.length) raf = window.requestAnimationFrame(loop);
  }

  /* ---------- The string glyph: pluck it and it rings, then settles ---------- */
  function Pluck(svg) {
    if (!svg) return { pluck: function () {} };
    var str = $('.str', svg), g1 = $('.g1', svg), g2 = $('.g2', svg), t0 = 0, amp = 0;
    function d(a) { return 'M10 3 Q ' + (10 + 2 * a).toFixed(2) + ' 15 10 27'; }
    function draw(now) {
      var t = now - t0, env = amp * Math.exp(-t / 520);
      if (env < 0.05) { str.setAttribute('d', d(0)); g1.style.opacity = 0; g2.style.opacity = 0; return false; }
      str.setAttribute('d', d(env * Math.sin(t * 0.055)));
      g1.setAttribute('d', d(env)); g2.setAttribute('d', d(-env));
      g1.style.opacity = g2.style.opacity = (env / amp * 0.3).toFixed(3);
    }
    return { pluck: function (a) { if (rm) return; t0 = performance.now(); amp = a || 5; addTick(draw); } };
  }

  /* Swap a short label the way a status line does: a quick lift out, a soft settle in. */
  function swapText(el, text) {
    if (el.textContent === text) return;
    if (rm || !el.animate) { el.textContent = text; return; }
    var out = el.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-4px)' }], { duration: 110, easing: 'ease-in' });
    out.onfinish = function () {
      el.textContent = text;
      el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)' });
    };
  }

  /* ---------- Streamed text: words arrive in chunks of one to three, blur to sharp ---------- */
  function tokenize(el) {
    if (el.__toks) return el.__toks;
    var words = el.textContent.replace(/\s+/g, ' ').trim().split(' ');
    el.textContent = '';
    el.__toks = words.map(function (w, i) {
      var s = document.createElement('span');
      s.className = 'tok';
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    return el.__toks;
  }
  function stream(el, speed) {
    var toks = tokenize(el), i = 0, timer = 0, done = false, resolve;
    var promise = new Promise(function (r) { resolve = r; });
    el.classList.add('streaming');
    void el.offsetWidth;
    function finish() {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      toks.forEach(function (t) { t.classList.add('on'); });
      window.setTimeout(function () { el.classList.remove('streaming'); }, 900);
      resolve();
    }
    function step() {
      if (done) return;
      var n = Math.min(toks.length - i, 1 + Math.floor(Math.random() * 3));
      for (var k = 0; k < n; k++) toks[i + k].classList.add('on');
      i += n;
      if (i >= toks.length) { finish(); return; }
      timer = window.setTimeout(step, (55 + Math.random() * 90) / speed);
    }
    step();
    return { done: promise, finish: finish };
  }

  /* ---------- Nav: scrolled state, progress, current section, and a status verb per section ---------- */
  var nav = $('#nav'), toggle = $('#navToggle'), links = $('#navLinks');
  function onScrollNav() {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    nav.style.setProperty('--scroll', max > 0 ? clamp(window.scrollY / max, 0, 1).toFixed(4) : '0');
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    $$('a', links).forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) toggle.click();
    });
  }
  function spy(targets, onChange) {
    if (!hasIO) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) onChange(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { if (t) io.observe(t); });
  }
  var VERBS = { top: 'Drafting', agents: 'Calling', projects: 'Shipping', how: 'Reviewing', now: 'Planning', contact: 'Waiting on you' };
  var navVerb = $('.nav-verb'), navPluck = Pluck($('.nav-status .pluck')), navShimmer = 0;
  var navAnchors = $$('.nav-links a[href^="#"]');
  spy(Object.keys(VERBS).map(function (id) { return document.getElementById(id); }), function (id) {
    navAnchors.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + id); });
    if (!navVerb || navVerb.textContent === VERBS[id]) return;
    swapText(navVerb, VERBS[id]);
    navPluck.pluck(5);
    if (!rm) {
      navVerb.classList.add('shimmer');
      window.clearTimeout(navShimmer);
      navShimmer = window.setTimeout(function () { navVerb.classList.remove('shimmer'); }, 2200);
    }
  });
  var setlist = $('[data-setlist]');
  if (setlist) {
    var track = $('.setlist-track', setlist), setLinks = $$('a', setlist);
    spy(setLinks.map(function (a) { return $(a.getAttribute('href')); }), function (id) {
      setLinks.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-on', on);
        if (on && track.scrollWidth > track.clientWidth) {
          track.scrollTo({ left: Math.max(0, a.offsetLeft - (track.clientWidth - a.offsetWidth) / 2), behavior: rm ? 'auto' : 'smooth' });
        }
      });
    });
  }

  /* ---------- Session clock: real time on the page, nothing invented ---------- */
  var clock = $('#sessionClock'), born = Date.now();
  if (clock) {
    window.setInterval(function () {
      if (document.hidden) return;
      var s = Math.floor((Date.now() - born) / 1000);
      clock.textContent = pad(Math.floor(s / 60) % 100) + ':' + pad(s % 60);
    }, 1000);
  }

  /* ---------- Hero: the live session ---------- */
  (function heroSession() {
    var root = document.documentElement, hero = $('#top');
    window.clearTimeout(window.__liveSafety);
    if (!hero || !root.classList.contains('live')) { root.classList.remove('live'); return; }

    var h1 = $('#heroTitle'), tag = $('#heroTagline'), status = $('#heroStatus');
    var statusText = $('#statusText'), meta = $('#statusMeta');
    var main = Pluck($('#heroPluck'));
    var rows = $$('.checkin', hero);
    var quotes = rows.map(function (r) { return $('q', r); });
    var finals = quotes.map(function (q) { return q.textContent; });
    var plucks = rows.map(function (r) { return Pluck($('.pluck', r)); });
    var FINAL = statusText.textContent;
    var WORK = ['Interrogating', 'Specifying', 'Drafting', 'Queueing', 'Building', 'Reviewing', 'Staging'];
    var skipped = false, streams = [], verbTimer = 0, metaTimer = 0, beatTimer = 0;

    tokenize(h1); tokenize(tag);
    h1.classList.add('streaming'); tag.classList.add('streaming');
    quotes.forEach(function (q) { q.textContent = ''; });
    statusText.textContent = WORK[0];
    statusText.classList.add('shimmer');
    statusText.setAttribute('aria-hidden', 'true');
    hero.classList.add('playing');
    root.classList.remove('live');

    var secs = 0, hint = coarse ? 'Tap to skip' : 'Click or press any key to skip';
    meta.textContent = '0s · ' + hint;
    metaTimer = window.setInterval(function () { secs++; meta.textContent = secs + 's · ' + hint; }, 1000);
    var wi = 0;
    verbTimer = window.setInterval(function () { wi = (wi + 1) % WORK.length; swapText(statusText, WORK[wi]); }, 700);
    main.pluck(5.5);
    beatTimer = window.setInterval(function () { main.pluck(5.5); }, 950);

    function sleep(ms) {
      return new Promise(function (res, rej) { window.setTimeout(function () { skipped ? rej('skip') : res(); }, ms); });
    }
    function type(q, text) {
      q.classList.add('caret');
      q.textContent = '';
      var i = 0;
      function next() {
        if (i >= text.length) return sleep(260).then(function () { q.classList.remove('caret'); });
        q.textContent += text.charAt(i++);
        return sleep(26 + Math.random() * 22).then(next);
      }
      return next();
    }
    function erase(q) {
      q.classList.add('caret');
      function next() {
        if (!q.textContent.length) return Promise.resolve();
        q.textContent = q.textContent.slice(0, -1);
        return sleep(14).then(next);
      }
      return next();
    }
    function settleStatus() {
      window.clearInterval(verbTimer); window.clearInterval(metaTimer); window.clearInterval(beatTimer);
      statusText.classList.remove('shimmer');
      statusText.removeAttribute('aria-hidden');
      status.classList.add('is-done');
    }
    function speak(k, text) {
      rows[k].classList.add('is-speaking');
      plucks[k].pluck(6);
      return type(quotes[k], text).then(function () { rows[k].classList.remove('is-speaking'); });
    }
    function cleanup() {
      window.setTimeout(function () { hero.classList.remove('playing', 'cta-in'); }, 900);
      ['pointerdown', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, skip, true); });
    }
    function skip(e) {
      if (skipped) return;
      if (e && e.type === 'pointerdown' && !hero.contains(e.target)) return;
      skipped = true;
      streams.forEach(function (s) { s.finish(); });
      [h1, tag].forEach(function (el) { (el.__toks || []).forEach(function (t) { t.classList.add('on'); }); });
      hero.classList.add('cta-in');
      rows.forEach(function (r, k) { r.classList.add('in'); r.classList.remove('is-speaking'); quotes[k].classList.remove('caret'); quotes[k].textContent = finals[k]; });
      settleStatus();
      statusText.textContent = FINAL;
      cleanup();
    }
    ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, skip, { capture: true, passive: true }); });
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (!en.isIntersecting) skip(); });
      }).observe(h1);
    }

    sleep(900)
      .then(function () { var s = stream(h1, 1); streams.push(s); return s.done; })
      .then(function () { return sleep(220); })
      .then(function () { var s = stream(tag, 2.6); streams.push(s); return s.done; })
      .then(function () { hero.classList.add('cta-in'); return sleep(260); })
      .then(function () {
        return rows.reduce(function (p, r) { return p.then(function () { r.classList.add('in'); return sleep(160); }); }, Promise.resolve());
      })
      .then(function () { return sleep(320); })
      .then(function () { return speak(0, finals[0]); })
      .then(function () { return speak(1, 'Task accepted'); })
      .then(function () { return sleep(620); })
      .then(function () { return erase(quotes[1]); })
      .then(function () { return speak(1, finals[1]); })
      .then(function () { return speak(2, finals[2]); })
      .then(function () {
        settleStatus();
        swapText(statusText, FINAL);
        main.pluck(7);
        skipped = true;
        cleanup();
      })
      .catch(function () { /* skipped: skip() already painted the finished state */ });
  })();

  /* ---------- Hero dot field: dots settle into place, then lean away from the pointer ---------- */
  (function heroDots() {
    var cv = $('#heroDots'), hero = $('#top');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), dpr = 1, W = 0, H = 0, D = [], t0 = performance.now(), px = -1e4, py = -1e4, lastMove = -1e4;
    var GAP = 26;
    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      D = [];
      var cols = Math.ceil(W / GAP), rows = Math.ceil(H / GAP), ox = (W - (cols - 1) * GAP) / 2;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var x = ox + c * GAP, y = 14 + r * GAP, a = Math.random() * Math.PI * 2, m = 10 + Math.random() * 16;
        D.push({ x: x, y: y, sx: Math.cos(a) * m, sy: Math.sin(a) * m, d: Math.random() * 500 + (x / W) * 400, ox: 0, oy: 0 });
      }
    }
    function draw(now) {
      var t = rm ? 1e6 : now - t0, settling = false, live = now - lastMove < 1400;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < D.length; i++) {
        var p = D[i], k = clamp((t - p.d) / 1300, 0, 1), e = easeOut(k);
        if (k < 1) settling = true;
        var tx = 0, ty = 0, near = 0;
        if (live) {
          var dx = p.x - px, dy = p.y - py, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) { near = 1 - dist / 110; tx = dx / (dist || 1) * near * 7; ty = dy / (dist || 1) * near * 7; }
        }
        p.ox += (tx - p.ox) * 0.14; p.oy += (ty - p.oy) * 0.14;
        if (Math.abs(p.ox) > 0.05 || Math.abs(p.oy) > 0.05) settling = true;
        var x = p.x + p.sx * (1 - e) + p.ox, y = p.y + p.sy * (1 - e) + p.oy;
        ctx.fillStyle = near > 0.55 ? 'rgba(184,90,55,' + (0.5 * e).toFixed(3) + ')' : 'rgba(28,27,24,' + (0.17 * e).toFixed(3) + ')';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
      return settling || live;
    }
    layout();
    if (rm) { draw(performance.now()); } else { addTick(draw); }
    window.addEventListener('resize', function () { layout(); t0 = -1e6; addTick(draw); });
    if (!rm && !coarse) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        px = e.clientX - r.left; py = e.clientY - r.top; lastMove = performance.now();
        addTick(draw);
      }, { passive: true });
      hero.addEventListener('pointerleave', function () { px = py = -1e4; addTick(draw); });
    }
  })();

  /* ---------- Ink strings: a hand-inked line draws itself on, rings once, and rings again when crossed ---------- */
  function InkLine(box) {
    var cv = $('canvas', box);
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d'), light = box.getAttribute('data-ink') === 'light';
    // Solid colours, pre-mixed with the ground: alpha strokes double up where segments overlap and look beaded.
    var LINE = light ? 'rgb(214,182,166)' : 'rgb(44,42,38)', GHOST = light ? 'rgb(162,90,64)' : 'rgb(222,216,206)';
    var KNOT = light ? 'rgb(246,238,228)' : '#B85A37';
    var W = 0, H = 0, dpr = 1, P = [], WD = [], x0 = 0, x1 = 0, y0 = 0, seed = Math.random() * 10;
    var t0 = -1, drawn = rm, plucks = [], lastY = null;
    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = box.clientWidth; H = box.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var gut = parseFloat(window.getComputedStyle($('.wrap') || document.body).paddingLeft) || 16;
      x0 = Math.max(gut, (W - 1240) / 2 + gut) + 10; x1 = W - x0 + 10; y0 = H * 0.5;
      var N = clamp(Math.round((x1 - x0) / 5), 60, 280);
      P = []; WD = [];
      for (var i = 0; i < N; i++) {
        var u = i / (N - 1);
        P.push({ x: x0 + (x1 - x0) * u, y: y0 + 1.4 * Math.sin(i * 0.17 + seed) + 0.9 * Math.sin(i * 0.043 + seed * 2) });
        var taper = Math.min(1, i / 12, (N - 1 - i) / 9 + 0.25);
        WD.push((1.3 + 1.0 * (0.5 + 0.5 * Math.sin(i * 0.09 + seed))) * taper + 0.3);
      }
    }
    function disp(u, now) {
      var d = 0;
      for (var k = 0; k < plucks.length; k++) {
        var p = plucks[k], t = now - p.t, env = p.a * Math.exp(-t / 700);
        if (env < 0.05) continue;
        var tri = u < p.u ? u / p.u : (1 - u) / (1 - p.u);
        d += env * Math.sin(t * 0.045) * (0.55 * tri + 0.45 * Math.sin(Math.PI * u));
      }
      return d;
    }
    function energy(now) {
      var e = 0;
      plucks = plucks.filter(function (p) { return now - p.t < 4500; });
      plucks.forEach(function (p) { e += p.a * Math.exp(-(now - p.t) / 700); });
      return e;
    }
    function stroke(prog, now, off, color, wscale) {
      var n = Math.floor(prog * (P.length - 1)), N = P.length;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      for (var i = 1; i <= n; i++) {
        var a = P[i - 1], b = P[i];
        ctx.lineWidth = WD[i] * wscale;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y + off(i - 1, N, now));
        ctx.lineTo(b.x, b.y + off(i, N, now));
        ctx.stroke();
      }
    }
    function frame(now) {
      if (t0 < 0 && !drawn) return false;
      var prog = drawn ? 1 : easeInOut(clamp((now - t0) / 1500, 0, 1));
      var e = energy(now);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (e > 1.2 && prog >= 1) {
        var ghost = function (s) { return function (i, N) { return s * e * 0.7 * Math.sin(Math.PI * i / (N - 1)); }; };
        stroke(1, now, ghost(1), GHOST, 0.6);
        stroke(1, now, ghost(-1), GHOST, 0.6);
      }
      stroke(prog, now, function (i, N, t) { return disp(i / (N - 1), t); }, LINE, 1);
      if (prog > 0) {
        var g = easeOut(clamp(prog * 4, 0, 1));
        ctx.fillStyle = KNOT;
        ctx.beginPath(); ctx.arc(x0 - 10, y0, 3.4 * g, 0, Math.PI * 2); ctx.fill();
      }
      if (!drawn && prog >= 1) { drawn = true; if (!rm) plucks.push({ t: now, a: light ? 7 : 10, u: 0.62 }); }
      return !drawn || e > 0.05;
    }
    function pluckAt(x, amp) {
      if (rm || !drawn) return;
      plucks.push({ t: performance.now(), a: amp, u: clamp((x - x0) / (x1 - x0), 0.05, 0.95) });
      addTick(frame);
    }
    box.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (lastY !== null && x > x0 && x < x1 && (lastY - y0) * (y - y0) <= 0 && lastY !== y) {
        pluckAt(x, clamp(Math.abs(y - lastY) * 0.8 + 5, 6, 18));
      }
      lastY = y;
    }, { passive: true });
    box.addEventListener('pointerleave', function () { lastY = null; });
    box.addEventListener('pointerdown', function (e) {
      var r = cv.getBoundingClientRect();
      if (Math.abs(e.clientY - r.top - y0) < 26) pluckAt(e.clientX - r.left, 12);
    }, { passive: true });
    layout();
    if (rm || !hasIO) { drawn = true; frame(performance.now()); }
    else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { t0 = performance.now(); addTick(frame); io.disconnect(); }
        });
      }, { threshold: 0.9 });
      io.observe(box);
    }
    var rz = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(rz);
      rz = window.setTimeout(function () { layout(); if (drawn) frame(performance.now()); }, 120);
    });
  }
  $$('[data-ink]').forEach(InkLine);

  /* ---------- Streams below the fold: section heads and project notes arrive the way they are written ---------- */
  if (!rm && hasIO) {
    var vh0 = window.innerHeight;
    var pending = $$('[data-stream]').filter(function (el) { return el.getBoundingClientRect().top > vh0; });
    pending.forEach(function (el) { tokenize(el); el.classList.add('streaming'); });
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        sio.unobserve(en.target);
        var n = en.target.__toks ? en.target.__toks.length : 10;
        stream(en.target, Math.max(1.4, n / 14));
      });
    }, { threshold: 0.35 });
    pending.forEach(function (el) { sio.observe(el); });
  }

  /* ---------- Reveals (content is visible without JS; this only adds the entrance) ---------- */
  var reveals = $$('.rv');
  if (rm || !hasIO) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { rio.observe(el); });
    window.setTimeout(function () {
      // Anything still waiting below the fold keeps its entrance; anything already passed is shown.
      reveals.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in'); });
    }, 4000);
  }

  /* ---------- Pipeline rail: a signal walks the ten gates; owner gates hold longer ---------- */
  $$('[data-rail]').forEach(function (vis) {
    var lis = $$('.rail li', vis), verb = $('.rail-verb', vis), nEl = $('.rail-n', vis), glyph = Pluck($('.rail-status .pluck', vis));
    var i = -1, timer = 0;
    function paint(k) {
      lis.forEach(function (li, j) { li.classList.toggle('done', j < k); li.classList.toggle('on', j === k); });
      swapText(verb, lis[k].getAttribute('data-verb'));
      nEl.textContent = 'gate ' + pad(k + 1) + ' of ' + lis.length;
    }
    if (rm || !hasIO) { paint(lis.length - 1); return; }
    function step() {
      i = (i + 1) % lis.length;
      paint(i);
      glyph.pluck(4.5);
      var owner = lis[i].getAttribute('data-gate') === 'owner';
      timer = window.setTimeout(step, i === lis.length - 1 ? 2600 : owner ? 1700 : 850);
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        window.clearTimeout(timer);
        if (en.isIntersecting) { vis.classList.add('is-running'); verb.classList.add('shimmer'); step(); }
        else { verb.classList.remove('shimmer'); }
      });
    }, { threshold: 0.5 }).observe(vis);
  });

  /* ---------- Scroll scenes: each [data-scene] gets --p from 0 to 1 ---------- */
  var scenes = $$('[data-scene]');
  var devices = $('[data-devices]');
  var deviceUpdate = null, ticking = false;
  function sceneP(el, r, vh) {
    var mode = el.getAttribute('data-scene');
    if (mode === 'through') return clamp((vh - r.top) / (vh + r.height), 0, 1);
    if (mode === 'fill') return clamp((vh * 0.8 - r.top) / Math.max(1, r.height), 0, 1);
    return easeOut(clamp((vh - r.top) / (vh * 0.62), 0, 1));
  }
  function updateScenes() {
    ticking = false;
    var vh = window.innerHeight || 1;
    for (var i = 0; i < scenes.length; i++) {
      var el = scenes[i], r = el.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
      var p = sceneP(el, r, vh).toFixed(3);
      if (el.__p !== p) { el.__p = p; el.style.setProperty('--p', p); }
    }
    if (deviceUpdate) deviceUpdate();
  }
  function requestScenes() { if (!ticking) { ticking = true; window.requestAnimationFrame(updateScenes); } }
  if (!rm) {
    window.addEventListener('scroll', requestScenes, { passive: true });
    window.addEventListener('resize', requestScenes);
  }

  /* ---------- Device stage: the lid opens, the screen powers on, then Bartok's queue scrolls ---------- */
  function initDevices(root) {
    var screen = $('.laptop-screen', root), img = screen && $('img', screen), phone = $('.phone', root);
    if (!img) return;
    function place(prog) {
      var h = img.offsetHeight;
      if (!h) return;
      img.style.setProperty('--sy', (-(easeInOut(prog) * Math.max(0, h - screen.clientHeight))).toFixed(1) + 'px');
    }
    if (rm) {
      img.addEventListener('load', function () { place(0); });
      return;
    }
    deviceUpdate = function () {
      var r = root.getBoundingClientRect(), vh = window.innerHeight || 1;
      var open = clamp((vh * 0.9 - r.top) / (vh * 0.45), 0, 1);
      root.style.setProperty('--lid', ((1 - easeOut(open)) * 86).toFixed(2));
      root.style.setProperty('--pow', clamp((open - 0.4) / 0.3, 0, 1).toFixed(3));
      root.style.setProperty('--ph', easeOut(clamp((open - 0.3) / 0.7, 0, 1)).toFixed(3));
      var prog = clamp((vh * 0.4 - r.top) / (vh * 0.4 + r.height * 0.55), 0, 1);
      place(prog);
      if (phone) phone.style.setProperty('--py', ((0.5 - prog) * 28).toFixed(1) + 'px');
    };
    img.addEventListener('load', deviceUpdate);
  }
  if (devices) initDevices(devices);
  requestScenes();
  if (!rm) updateScenes();

  /* ---------- Carousels ---------- */
  function initCarousel(root) {
    var track = $('.car-track', root);
    if (!track) return;
    var slides = Array.prototype.slice.call(track.children), n = slides.length;
    if (n < 2) { root.classList.add('car--single'); return; }
    var prev = $('[data-prev]', root), next = $('[data-next]', root), dots = $('.car-dots', root), count = $('.car-count', root);
    var i = 0, timer = null, inView = false, hover = false, stopped = rm, settle = null;
    slides.forEach(function (s, k) {
      s.setAttribute('aria-roledescription', 'slide');
      s.setAttribute('aria-label', (k + 1) + ' of ' + n);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'car-dot';
      b.tabIndex = -1;
      b.addEventListener('click', function () { go(k, true); });
      dots.appendChild(b);
    });
    var dotEls = Array.prototype.slice.call(dots.children);
    function render() {
      dotEls.forEach(function (d, k) { d.classList.toggle('is-on', k === i); });
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
      timer = window.setTimeout(function () {
        if (!hover && !document.hidden) go(i + 1, false); else schedule();
      }, 5500);
    }
    function startAuto() {
      if (stopped) return;
      root.classList.add('is-auto');
      // Force-load every slide so the first automatic advance never shows a blank frame.
      $$('img[loading="lazy"]', track).forEach(function (img) { img.loading = 'eager'; });
      render();
      schedule();
    }
    function stopAuto() {
      stopped = true;
      window.clearTimeout(timer);
      root.classList.remove('is-auto');
      render();
    }
    prev.addEventListener('click', function () { go(i - 1, true); });
    next.addEventListener('click', function () { go(i + 1, true); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
    });
    track.addEventListener('scroll', function () {
      window.clearTimeout(settle);
      settle = window.setTimeout(function () {
        var k = Math.round(track.scrollLeft / track.clientWidth);
        if (k !== i && k >= 0 && k < n) { i = k; render(); }
      }, 90);
    }, { passive: true });
    track.addEventListener('pointerdown', stopAuto, { passive: true });
    track.addEventListener('touchstart', stopAuto, { passive: true });
    root.addEventListener('pointerenter', function () { hover = true; });
    root.addEventListener('pointerleave', function () { hover = false; });
    root.addEventListener('focusin', function () { hover = true; });
    root.addEventListener('focusout', function () { hover = false; });
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (inView) startAuto(); else window.clearTimeout(timer);
        });
      }, { threshold: 0.45 }).observe(root);
    }
    window.addEventListener('resize', function () { track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' }); });
    render();
  }
  $$('[data-car]').forEach(initCarousel);
})();
