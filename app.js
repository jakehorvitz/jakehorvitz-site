(function () {
  'use strict';
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ---------- Nav: scrolled state, reading progress, current section ---------- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  function onScrollNav() {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    nav.style.setProperty('--scroll', max > 0 ? clamp(window.scrollY / max).toFixed(4) : '0');
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('has-menu', open);
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('is-open');
        nav.classList.remove('has-menu');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) toggle.click();
    });
  }

  function spy(targets, onChange) {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) onChange(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(function (t) { if (t) io.observe(t); });
  }
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
  spy(navAnchors.map(function (a) { return document.querySelector(a.getAttribute('href')); }).concat([document.getElementById('top')]), function (id) {
    navAnchors.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + id); });
  });
  var setlist = document.querySelector('[data-setlist]');
  if (setlist) {
    var setLinks = Array.prototype.slice.call(setlist.querySelectorAll('a'));
    spy(setLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); }), function (id) {
      setLinks.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-on', on);
        if (on) {
          var left = a.offsetLeft - (setlist.clientWidth - a.offsetWidth) / 2;
          setlist.scrollTo({ left: Math.max(0, left), behavior: rm ? 'auto' : 'smooth' });
        }
      });
    });
  }

  /* ---------- Reveals (content is visible without JS; this only adds the entrance) ---------- */
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.rv'));
  function showAll() { reveals.forEach(function (el) { el.classList.add('in'); }); }
  if (rm || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
    window.setTimeout(function () {
      // Anything still waiting below the fold keeps its entrance; anything already passed is shown.
      reveals.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in'); });
    }, 4000);
  }

  /* ---------- Scroll scenes: each [data-scene] gets --p from 0 to 1 ---------- */
  var scenes = Array.prototype.slice.call(document.querySelectorAll('[data-scene]'));
  var devices = document.querySelector('[data-devices]');
  var deviceUpdate = null;
  var ticking = false;
  function sceneP(el, r, vh) {
    var mode = el.getAttribute('data-scene');
    if (mode === 'through') return clamp((vh - r.top) / (vh + r.height));
    if (mode === 'fill') return clamp((vh * 0.8 - r.top) / Math.max(1, r.height));
    return easeOut(clamp((vh - r.top) / (vh * 0.62)));
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
    var screen = root.querySelector('.laptop-screen');
    var img = screen && screen.querySelector('img');
    var phone = root.querySelector('.phone');
    if (!img) return;
    var CROP = 420 / 2867; // the queue column starts below the stat tiles
    function place(prog) {
      var h = img.offsetHeight;
      if (!h) return;
      var start = h * CROP, max = h - start - screen.clientHeight;
      img.style.setProperty('--sy', (-(start + easeInOut(prog) * Math.max(0, max))).toFixed(1) + 'px');
    }
    if (rm) {
      img.addEventListener('load', function () { place(0); });
      window.addEventListener('resize', function () { place(0); });
      place(0);
      return;
    }
    deviceUpdate = function () {
      var r = root.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var open = clamp((vh * 0.9 - r.top) / (vh * 0.45));
      root.style.setProperty('--lid', ((1 - easeOut(open)) * 86).toFixed(2));
      root.style.setProperty('--pow', clamp((open - 0.4) / 0.3).toFixed(3));
      root.style.setProperty('--ph', easeOut(clamp((open - 0.3) / 0.7)).toFixed(3));
      var prog = clamp((vh * 0.4 - r.top) / (vh * 0.4 + r.height * 0.55));
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
    var track = root.querySelector('.car-track');
    if (!track) return;
    var slides = Array.prototype.slice.call(track.children);
    var n = slides.length;
    if (n < 2) { root.classList.add('car--single'); return; }
    var prev = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');
    var dots = root.querySelector('.car-dots');
    var count = root.querySelector('.car-count');
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
      track.querySelectorAll('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });
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
    track.addEventListener('pointerdown', function () { stopAuto(); }, { passive: true });
    track.addEventListener('touchstart', function () { stopAuto(); }, { passive: true });
    root.addEventListener('pointerenter', function () { hover = true; });
    root.addEventListener('pointerleave', function () { hover = false; });
    root.addEventListener('focusin', function () { hover = true; });
    root.addEventListener('focusout', function () { hover = false; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (inView) startAuto(); else window.clearTimeout(timer);
        });
      }, { threshold: 0.45 }).observe(root);
    }
    window.addEventListener('resize', function () {
      track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' });
    });
    render();
  }
  document.querySelectorAll('[data-car]').forEach(initCarousel);

  /* ---------- Tactile: frames tilt toward the pointer with a moving highlight; primary buttons lean in ---------- */
  if (finePointer && !rm) {
    document.querySelectorAll('.proj .frame').forEach(function (f) {
      f.addEventListener('pointermove', function (e) {
        var r = f.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        f.style.setProperty('--ry', ((x - 0.5) * 5).toFixed(2) + 'deg');
        f.style.setProperty('--rx', ((0.5 - y) * 4).toFixed(2) + 'deg');
        f.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        f.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        f.classList.add('is-tilting');
      });
      f.addEventListener('pointerleave', function () {
        f.style.setProperty('--rx', '0deg');
        f.style.setProperty('--ry', '0deg');
        f.classList.remove('is-tilting');
      });
    });
    document.querySelectorAll('.btn-amber, .btn-ink').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1) + 'px');
        b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', function () {
        b.style.setProperty('--mx', '0px');
        b.style.setProperty('--my', '0px');
      });
    });
  }

  /* ---------- Hero hint ---------- */
  var hero = document.getElementById('top');
  var hint = document.getElementById('heroHint');
  if (hint && window.matchMedia('(pointer: coarse)').matches) {
    var hs = hint.querySelector('span');
    if (hs) hs.textContent = 'Drag a finger across the strings';
  }
  document.addEventListener('hero3d:pluck', function (e) {
    if (e.detail && e.detail.user && hero) hero.classList.add('is-played');
  });

  /* ---------- Contact band: four strings along the bottom edge that ring when the pointer crosses them ---------- */
  function contactStrings(cv) {
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    var band = cv.parentElement;
    var w = 0, h = 0, ys = [], amp = [0, 0, 0, 0], at = [0, 0, 0, 0], hitX = [0.5, 0.5, 0.5, 0.5], raf = 0, last = 0;
    var GA = [1, 1.3, 1.7, 2.1];
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ys = [0.3, 0.46, 0.62, 0.78].map(function (f) { return f * h; });
      draw(performance.now());
    }
    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      var live = false;
      for (var i = 0; i < 4; i++) {
        var age = (now - at[i]) / 1000, a = amp[i] * Math.exp(-age * 2.6);
        if (a > 0.15) live = true;
        ctx.beginPath();
        for (var s = 0; s <= 90; s++) {
          var u = s / 90, x = u * w;
          var env = Math.sin(Math.PI * u) * (0.6 + 0.4 * Math.exp(-Math.pow((u - hitX[i]) * 3, 2)));
          var d = a * env * Math.sin(age * (30 + i * 6));
          if (s === 0) ctx.moveTo(x, ys[i] + d); else ctx.lineTo(x, ys[i] + d);
        }
        ctx.strokeStyle = 'rgba(43,29,12,' + (0.28 + Math.min(0.5, a / 14)).toFixed(3) + ')';
        ctx.lineWidth = GA[i];
        ctx.stroke();
      }
      return live;
    }
    function loop(now) { raf = draw(now) ? window.requestAnimationFrame(loop) : 0; }
    var px = null, py = null;
    band.addEventListener('pointermove', function (e) {
      var r = cv.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      if (px !== null && !rm) {
        for (var i = 0; i < 4; i++) {
          if ((py - ys[i]) * (y - ys[i]) <= 0 && py !== y) {
            var sp = Math.min(1, Math.abs(y - py) / 18);
            amp[i] = 5 + sp * 9; at[i] = performance.now(); hitX[i] = clamp(x / Math.max(1, w));
            if (!raf) raf = window.requestAnimationFrame(loop);
          }
        }
      }
      px = x; py = y;
    }, { passive: true });
    band.addEventListener('pointerleave', function () { px = null; });
    window.addEventListener('resize', size);
    size();
  }
  var cstr = document.getElementById('contactStrings');
  if (cstr) contactStrings(cstr);

  /* ---------- Fallback hero: the 2D particle bass, used only if WebGL or the module is unavailable ---------- */
  function bass(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var BODY = [[0.05, -0.14], [0.14, -0.10], [0.22, -0.09], [0.29, -0.12], [0.33, -0.20], [0.31, -0.30], [0.30, -0.40], [0.34, -0.52], [0.40, -0.64], [0.42, -0.76], [0.38, -0.88], [0.28, -0.97], [0.14, -1.02], [0, -1.03], [-0.14, -1.02], [-0.28, -0.97], [-0.38, -0.88], [-0.42, -0.76], [-0.40, -0.64], [-0.34, -0.52], [-0.30, -0.40], [-0.31, -0.30], [-0.35, -0.18], [-0.36, -0.06], [-0.33, 0.02], [-0.27, 0.02], [-0.20, -0.06], [-0.13, -0.12], [-0.05, -0.14]];
    var HEAD = [[-0.036, 0.78], [0.036, 0.78], [0.05, 0.86], [0.06, 0.96], [0.03, 1.05], [-0.06, 1.04], [-0.08, 0.95], [-0.06, 0.86]];
    var T = 0.09, NUT = 0.78, BRIDGE = -0.80, L = NUT - BRIDGE;
    var P = [], STR = [];
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function inPoly(poly, x, y) {
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      return inside;
    }
    function fillPoly(poly, n, z, k, jz) {
      var x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      poly.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      for (var c = 0, g = 0; c < n && g < n * 30; g++) {
        var x = rnd(x0, x1), y = rnd(y0, y1);
        if (inPoly(poly, x, y)) { P.push({ x: x, y: y, z: z + rnd(-jz, jz), k: k }); c++; }
      }
    }
    function edge(poly, per, z0, z1, k) {
      for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length];
        var n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) * per));
        for (var j = 0; j < n; j++) { var u = j / n; P.push({ x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, z: rnd(z0, z1), k: k }); }
      }
    }
    function rect(x0, y0, x1, y1, n, z, k) { for (var i = 0; i < n; i++) P.push({ x: rnd(x0, x1), y: rnd(y0, y1), z: z, k: k }); }
    function neckHalfWidth(y) { return 0.05 - 0.014 * ((y + 0.30) / 1.08); }
    fillPoly(BODY, 2300, T, 0, 0.006);
    fillPoly(BODY, 900, -T, 1, 0.006);
    edge(BODY, 230, -T, T, 2);
    for (var i = 0; i < 700; i++) { var ny = rnd(-0.30, NUT); var hw = neckHalfWidth(ny); P.push({ x: rnd(-hw, hw), y: ny, z: T + 0.02, k: 3 }); }
    for (var f = 1; f <= 20; f++) {
      var fy = NUT - L * (1 - Math.pow(2, -f / 12)), fw = neckHalfWidth(fy);
      for (var q = 0; q <= 7; q++) P.push({ x: -fw + 2 * fw * q / 7, y: fy, z: T + 0.025, k: 4 });
    }
    for (var q2 = 0; q2 <= 7; q2++) P.push({ x: -0.036 + 0.072 * q2 / 7, y: NUT, z: T + 0.03, k: 6 });
    var nutX = [-0.024, -0.008, 0.008, 0.024], brX = [-0.045, -0.015, 0.015, 0.045];
    for (var s = 0; s < 4; s++) {
      for (var j2 = 0; j2 <= 96; j2++) {
        var u2 = j2 / 96;
        var sp = { x: nutX[s] + (brX[s] - nutX[s]) * u2, y: NUT + (BRIDGE - NUT) * u2, z: T + 0.04, k: 5, s: s, u: u2 };
        P.push(sp); STR.push(sp);
      }
    }
    fillPoly(HEAD, 420, T * 0.6, 7, 0.012);
    edge(HEAD, 200, -T * 0.6, T * 0.6, 7);
    [0.84, 0.90, 0.96, 1.01].forEach(function (py) { rect(-0.105, py - 0.012, -0.075, py + 0.012, 14, T * 0.6 + 0.02, 6); });
    rect(-0.13, -0.47, -0.01, -0.43, 40, T + 0.02, 6);
    rect(0.01, -0.53, 0.13, -0.49, 40, T + 0.02, 6);
    rect(-0.13, -0.70, 0.13, -0.66, 60, T + 0.02, 6);
    rect(-0.08, -0.83, 0.08, -0.77, 45, T + 0.02, 6);
    var N = P.length;
    var COL = ['226,200,160', '226,200,160', '240,215,170', '214,180,130', '250,236,210', '245,166,35', '255,245,225', '226,200,160'];
    var ALPHA = [0.7, 0.35, 0.75, 0.7, 0.95, 1, 1, 0.7];
    var SIZE = [0, 0, 0.1, 0, 0.3, 0.5, 0.5, 0];
    var w = 0, h = 0, cx = 0, cy = 0, S = 0, wide = true;
    var mx = 0, tx = 0, running = true, raf = 0, t0 = performance.now();
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wide = w > 900;
      cx = wide ? w * 0.72 : w * 0.5;
      cy = wide ? h * 0.5 : h * 0.3;
      S = wide ? Math.min(h * 0.42, w * 0.24) : Math.min(h * 0.2, w * 0.6);
    }
    function frame(now) {
      var t = (now - t0) / 1000;
      mx += (tx - mx) * 0.04;
      ctx.clearRect(0, 0, w, h);
      var spin = t * 0.3 + mx * 0.9, lean = 0.4, tilt = -0.28;
      var cs = Math.cos(spin), ss = Math.sin(spin), cl = Math.cos(lean), sl = Math.sin(lean), ct = Math.cos(tilt), st = Math.sin(tilt);
      for (var q = 0; q < STR.length; q++) {
        var sp = STR[q];
        sp.dx = 0.011 * Math.sin(Math.PI * sp.u) * Math.sin(t * (6.2 + sp.s * 2.3) + sp.s * 1.7);
      }
      for (var k = 0; k < N; k++) {
        var p = P[k];
        var x = p.x + (p.dx || 0), y = p.y, z = p.z;
        var x1 = x * cs + z * ss, z1 = -x * ss + z * cs;
        var x2 = x1 * cl - y * sl, y2 = x1 * sl + y * cl;
        var y3 = y2 * ct - z1 * st, z3 = y2 * st + z1 * ct;
        var pr = 1 / (1 - z3 * 0.42);
        var depth = Math.max(0, Math.min(1, (z3 + 0.5)));
        ctx.fillStyle = 'rgba(' + COL[p.k] + ',' + ((0.14 + depth * 0.8) * ALPHA[p.k]).toFixed(3) + ')';
        var sz = 1.0 + depth * 1.4 + SIZE[p.k];
        ctx.fillRect(cx + x2 * S * pr, cy - y3 * S * pr, sz, sz);
      }
    }
    function loop(now) { frame(now); raf = running ? window.requestAnimationFrame(loop) : 0; }
    function start() { if (raf || rm) return; running = true; raf = window.requestAnimationFrame(loop); }
    function stop() { running = false; window.cancelAnimationFrame(raf); raf = 0; }
    window.addEventListener('resize', function () { resize(); if (rm) frame(performance.now()); });
    window.addEventListener('pointermove', function (e) { tx = (e.clientX / window.innerWidth - 0.5); }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    resize();
    if (rm) { t0 = performance.now() - 1600; frame(performance.now()); } else { start(); }
  }
  var fellBack = false;
  function fallback() {
    if (fellBack || window.__hero3d === 'ready') return;
    fellBack = true;
    window.__hero3d = 'fallback';
    var stage = document.querySelector('.hero-stage');
    var old = document.getElementById('heroBass');
    if (!stage) return;
    var c2 = document.createElement('canvas');
    c2.className = 'hero-canvas';
    if (old) old.style.display = 'none';
    stage.appendChild(c2);
    bass(c2);
  }
  document.addEventListener('hero3d:fail', fallback);
  window.setTimeout(function () { if (!window.__hero3d) fallback(); }, 9000);
})();
