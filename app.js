(function () {
  'use strict';
  var rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Nav ---------- */
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  function onScroll() { nav.classList.toggle('is-scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
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
    window.setTimeout(showAll, 4000);
  }

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

  /* ---------- Device stage: the laptop screen scrolls with the page, the phone drifts ---------- */
  function initDevices(root) {
    var screen = root.querySelector('.laptop-screen');
    var img = screen && screen.querySelector('img');
    var phone = root.querySelector('.phone');
    if (!img) return;
    function update() {
      var r = root.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var prog = (vh - r.top) / (vh + r.height);
      prog = Math.max(0, Math.min(1, prog));
      var eased = prog < 0.5 ? 2 * prog * prog : 1 - Math.pow(-2 * prog + 2, 2) / 2;
      var max = img.offsetHeight - screen.clientHeight;
      if (max > 0) img.style.setProperty('--sy', (-eased * max).toFixed(1) + 'px');
      if (phone) phone.style.setProperty('--py', ((0.5 - prog) * 28).toFixed(1) + 'px');
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    img.addEventListener('load', update);
    update();
  }
  document.querySelectorAll('[data-devices]').forEach(initDevices);

  /* ---------- Hero: a four-string bass drawn as ~3,700 particles, spinning on its own axis ---------- */
  function bass(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Bass local space: x right, y up (headstock at +y), z toward the viewer. Total length about 2.1 units.
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
    rect(0.20, -0.72, 0.24, -0.68, 12, T + 0.02, 6);
    rect(0.27, -0.78, 0.31, -0.74, 12, T + 0.02, 6);
    var N = P.length;
    var COL = ['226,200,160', '226,200,160', '240,215,170', '214,180,130', '250,236,210', '245,166,35', '255,245,225', '226,200,160'];
    var ALPHA = [0.7, 0.35, 0.75, 0.7, 0.95, 1, 1, 0.7];
    var SIZE = [0, 0, 0.1, 0, 0.3, 0.5, 0.5, 0];

    var w = 0, h = 0, cx = 0, cy = 0, S = 0, wide = true;
    var mx = 0, my = 0, tx = 0, ty = 0;
    var running = true, raf = 0, t0 = performance.now();

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wide = w > 900;
      cx = wide ? w * 0.72 : w * 0.5;
      cy = wide ? h * 0.5 : h * 0.42;
      S = wide ? Math.min(h * 0.42, w * 0.24) : Math.min(h * 0.28, w * 0.66);
    }

    function frame(now) {
      var t = (now - t0) / 1000;
      mx += (tx - mx) * 0.04;
      my += (ty - my) * 0.04;
      ctx.clearRect(0, 0, w, h);
      var spin = t * 0.3 + mx * 0.9;          // rotation about the bass's own vertical axis
      var lean = 0.4;                          // it leans like it is on a stand
      var tilt = -0.28 + my * 0.3;              // camera slightly above
      var cs = Math.cos(spin), ss = Math.sin(spin), cl = Math.cos(lean), sl = Math.sin(lean), ct = Math.cos(tilt), st = Math.sin(tilt);
      var dim = wide ? 1 : 0.5;
      // strings shimmer: a standing wave on each string, each at its own rate
      for (var q = 0; q < STR.length; q++) {
        var sp = STR[q];
        sp.dx = 0.011 * Math.sin(Math.PI * sp.u) * Math.sin(t * (6.2 + sp.s * 2.3) + sp.s * 1.7);
      }
      for (var k = 0; k < N; k++) {
        var p = P[k];
        var x = p.x + (p.dx || 0), y = p.y, z = p.z;
        var x1 = x * cs + z * ss, z1 = -x * ss + z * cs;          // spin about Y
        var x2 = x1 * cl - y * sl, y2 = x1 * sl + y * cl;         // lean about Z
        var y3 = y2 * ct - z1 * st, z3 = y2 * st + z1 * ct;       // tilt about X
        var pr = 1 / (1 - z3 * 0.42);
        var sx = cx + x2 * S * pr, sy = cy - y3 * S * pr;
        var depth = Math.max(0, Math.min(1, (z3 + 0.5)));
        var a = (0.14 + depth * 0.8) * ALPHA[p.k] * dim;
        var sz = 1.0 + depth * 1.4 + SIZE[p.k];
        ctx.fillStyle = 'rgba(' + COL[p.k] + ',' + a.toFixed(3) + ')';
        ctx.fillRect(sx, sy, sz, sz);
      }
    }
    function loop(now) { frame(now); raf = running ? window.requestAnimationFrame(loop) : 0; }
    function start() { if (raf || rm) return; running = true; raf = window.requestAnimationFrame(loop); }
    function stop() { running = false; window.cancelAnimationFrame(raf); raf = 0; }

    window.addEventListener('resize', function () { resize(); if (rm) frame(performance.now()); });
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5);
      ty = (e.clientY / window.innerHeight - 0.5);
    }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) start(); else stop(); });
      }, { threshold: 0.05 }).observe(canvas);
    }
    resize();
    if (rm) { t0 = performance.now() - 1600; frame(performance.now()); } else { start(); }
  }
  var heroCanvas = document.getElementById('heroBass');
  if (heroCanvas) bass(heroCanvas);
})();
