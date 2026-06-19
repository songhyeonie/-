/* ============================================================
   JUNG'GAM BNG — main.js  (v2)
   preloader · scroll progress · sticky header(hide/show) ·
   reveal+stagger · line-mask · parallax · counters · marquee dup
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- preloader (with hard failsafe so the curtain can never get stuck) ---- */
  (function () {
    var pl = document.querySelector('.preloader');
    if (!pl) return;
    var lift = function () { pl.classList.add('done'); };
    window.addEventListener('load', function () { setTimeout(lift, 700); });
    // failsafe: even if `load` never fires (hung asset / slow CDN), lift after 3.2s
    setTimeout(lift, 3200);
  })();

  /* ---- scroll progress bar ---- */
  var bar = document.querySelector('.progress');
  /* ---- sticky header: solid + hide on scroll-down ---- */
  var header = document.querySelector('.site-header');
  var hero = document.querySelector('.hero, .page-hero');
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    if (bar) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    }
    if (header) {
      var th = hero ? hero.offsetHeight - 100 : 60;
      header.classList.toggle('solid', y > th);
      if (y > th + 120 && y > lastY) header.classList.add('hide');
      else header.classList.remove('hide');
    }
    lastY = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- mobile menu ---- */
  var burger = document.querySelector('.burger');
  if (burger) {
    burger.addEventListener('click', function () { document.body.classList.toggle('menu-open'); });
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () { document.body.classList.remove('menu-open'); });
    });
  }

  /* ---- reveal (with stagger via --i on children groups) ----
     Signature scroll-reveal stays ON even under reduce-motion: it is a gentle
     scroll-tied fade, not autoplay vestibular motion. This is what makes the
     whole site feel alive as you scroll, so it must never be silently killed. */
  var revealEls = document.querySelectorAll('[data-reveal], .line-mask, .img-reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- overview hero: add .is-in (one-shot) to trigger wipe/sweep ---- */
  var oheroEls = document.querySelectorAll('.ohero');
  if (oheroEls.length) {
    if ('IntersectionObserver' in window) {
      var oio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); oio.unobserve(e.target); } });
      }, { threshold: 0.18 });
      oheroEls.forEach(function (el) { oio.observe(el); });
    } else {
      oheroEls.forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  /* auto-stagger: assign --i to direct children of [data-stagger] */
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (child, i) {
      child.style.setProperty('--i', i);
    });
  });

  /* ---- parallax on scroll ---- */
  var parEls = document.querySelectorAll('[data-parallax]');
  function parallax() {
    var vh = window.innerHeight;
    parEls.forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.15;
      var rect = el.getBoundingClientRect();
      var center = rect.top + rect.height / 2;
      var offset = (center - vh / 2) * speed;
      el.style.transform = 'translate3d(0,' + (-offset) + 'px,0)';
    });
  }
  if (parEls.length && !reduce) {
    window.addEventListener('scroll', parallax, { passive: true });
    window.addEventListener('resize', parallax);
    parallax();
  }

  /* ---- number counters ---- */
  function fmt(n) { return n.toLocaleString('ko-KR'); }
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dur = 1700, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = parseFloat(el.getAttribute('data-count')).toLocaleString('ko-KR'); });
  }

  /* ---- marquee: duplicate track for seamless loop ---- */
  document.querySelectorAll('.marquee__track').forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  /* ---- hero particle field — interactive "anti-gravity" canvas ----
     vanilla port of the React <AntiGravityCanvas/>. White + bronze particles
     spring back to origin, repel from the cursor, and collide elastically over
     drifting twinkle stars and a bronze radial pulse. (blue accent → brand bronze) */
  (function () {
    var canvas = document.querySelector('.hero-particles');
    if (!canvas) return;
    var host = canvas.closest('.hero') || canvas.parentElement;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var P_DENSITY = 0.00015, BG_DENSITY = 0.00005;      // particles per px²
    var MOUSE_R = 180, RETURN = 0.08, DAMP = 0.90, REPULSE = 1.2;
    var rr = function (a, b) { return Math.random() * (b - a) + a; };

    var parts = [], stars = [], mouse = { x: -1e4, y: -1e4, active: false };
    var W = 0, Hh = 0, raf = 0;

    function build(w, h) {
      W = w; Hh = h;
      parts = [];
      var n = Math.floor(w * h * P_DENSITY);
      for (var i = 0; i < n; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        parts.push({ x: x, y: y, ox: x, oy: y, vx: 0, vy: 0,
          size: rr(1, 2.5), accent: Math.random() > 0.9 });
      }
      stars = [];
      var m = Math.floor(w * h * BG_DENSITY);
      for (var j = 0; j < m; j++) {
        stars.push({ x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
          size: rr(0.5, 1.5), alpha: rr(0.1, 0.4), phase: Math.random() * Math.PI * 2 });
      }
    }

    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // absolute set → no cumulative scaling on re-resize
      build(r.width, r.height);
    }

    function render(t) {
      ctx.clearRect(0, 0, W, Hh);

      // bronze radial pulse
      var cx = W / 2, cy = Hh / 2;
      var op = Math.sin(t * 0.0008) * 0.035 + 0.085;
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, Hh) * 0.7);
      g.addColorStop(0, 'rgba(161,124,68,' + op + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);

      // drifting twinkle stars
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0) s.x = W; if (s.x > W) s.x = 0;
        if (s.y < 0) s.y = Hh; if (s.y > Hh) s.y = 0;
        var tw = Math.sin(t * 0.002 + s.phase) * 0.5 + 0.5;
        ctx.globalAlpha = s.alpha * (0.3 + 0.7 * tw);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // forces: cursor repulsion + spring home
      for (var a = 0; a < parts.length; a++) {
        var p = parts[a];
        var dx = mouse.x - p.x, dy = mouse.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (mouse.active && d < MOUSE_R && d > 0) {
          var f = (MOUSE_R - d) / MOUSE_R * REPULSE;
          p.vx -= (dx / d) * f * 5; p.vy -= (dy / d) * f * 5;
        }
        p.vx += (p.ox - p.x) * RETURN; p.vy += (p.oy - p.y) * RETURN;
      }

      // elastic collisions (restitution 0.85)
      for (var u = 0; u < parts.length; u++) {
        for (var v = u + 1; v < parts.length; v++) {
          var p1 = parts[u], p2 = parts[v];
          var ax = p2.x - p1.x, ay = p2.y - p1.y, dsq = ax * ax + ay * ay, md = p1.size + p2.size;
          if (dsq < md * md) {
            var dd = Math.sqrt(dsq);
            if (dd > 0.01) {
              var nx = ax / dd, ny = ay / dd, ov = md - dd, qx = nx * ov * 0.5, qy = ny * ov * 0.5;
              p1.x -= qx; p1.y -= qy; p2.x += qx; p2.y += qy;
              var rvn = (p1.vx - p2.vx) * nx + (p1.vy - p2.vy) * ny;
              if (rvn > 0) {
                var imp = (-1.85 * rvn) / (1 / p1.size + 1 / p2.size);
                p1.vx += imp * nx / p1.size; p1.vy += imp * ny / p1.size;
                p2.vx -= imp * nx / p2.size; p2.vy -= imp * ny / p2.size;
              }
            }
          }
        }
      }

      // integrate + draw
      for (var b = 0; b < parts.length; b++) {
        var c = parts[b];
        c.vx *= DAMP; c.vy *= DAMP; c.x += c.vx; c.y += c.vy;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
        if (c.accent) ctx.fillStyle = '#a17c44';
        else {
          var vel = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
          ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.3 + vel * 0.1, 1) + ')';
        }
        ctx.fill();
      }
    }

    function loop(t) { render(t); raf = requestAnimationFrame(loop); }

    host.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    }, { passive: true });
    host.addEventListener('mouseleave', function () { mouse.active = false; });
    window.addEventListener('resize', resize);

    resize();
    if (reduce) render(0);                 // static field, no loop / no interaction
    else raf = requestAnimationFrame(loop);
  })();

  /* ---- 카테고리 페이지 히어로: smooth-scroll clip reveal + 줌 ----
     .page-hero-scroll 안의 sticky .page-hero __media를 스크롤에 따라 펼친다.
     clip 25%→full, 이미지 scale 1.12→1. (framer useTransform 범위 그대로) */
  document.querySelectorAll('.page-hero-scroll').forEach(function (wrap) {
    var media = wrap.querySelector('.page-hero__media');
    if (!media) return;
    var img = media.querySelector('img');
    var H = parseFloat(wrap.getAttribute('data-scroll-height')) || 500;
    function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    if (reduce) {   // 모션 최소화: 전체화면으로 펼친 정지 상태
      media.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      if (img) img.style.transform = 'none';
      return;
    }

    function update() {
      var top = wrap.getBoundingClientRect().top + window.scrollY;
      var y = window.scrollY - top;
      var p = cl(y / H);
      var s = 25 * (1 - p);          // 25 -> 0
      var e = 75 + 25 * p;           // 75 -> 100
      media.style.clipPath =
        'polygon(' + s + '% ' + s + '%, ' + e + '% ' + s + '%, ' + e + '% ' + e + '%, ' + s + '% ' + e + '%)';
      if (img) img.style.transform = 'scale(' + (1.12 - 0.12 * cl(y / (H + 300))) + ')';
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---- active nav ---- */
  var path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(function (a) {
    if (a.getAttribute('href') === path) a.classList.add('active');
  });

  /* ---- 3D 틸트: data-tilt 카드가 커서를 따라 미세하게 기운다 (절제된 6deg) ---- */
  if (!reduce) {
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      var MAX = 6;
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-py * MAX).toFixed(2) +
          'deg) rotateY(' + (px * MAX).toFixed(2) + 'deg) translateY(-10px)';
      }, { passive: true });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ============================================================
     CRAFT LAYER — agency finish: grain · custom cursor · magnetic
     buttons · preloader counter · Lenis smooth scroll
     ============================================================ */
  (function craft() {
    // film grain
    var grain = document.createElement('div');
    grain.className = 'grain'; grain.setAttribute('aria-hidden', 'true');
    document.body.appendChild(grain);

    // preloader % counter
    var pl = document.querySelector('.preloader');
    if (pl && !pl.querySelector('.pl-count')) {
      var c = document.createElement('div'); c.className = 'pl-count'; c.textContent = '0';
      pl.appendChild(c);
      var n = 0, iv = setInterval(function () {
        n += Math.floor(Math.random() * 9) + 4; if (n >= 100) { n = 100; clearInterval(iv); }
        c.textContent = n;
      }, 70);
    }

    var fine = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
    if (fine) {
      var ring = document.createElement('div'); ring.className = 'cursor hide';
      var dot = document.createElement('div'); dot.className = 'cursor__dot hide';
      document.body.appendChild(ring); document.body.appendChild(dot);
      document.body.classList.add('cursor-on');
      var mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my, seen = false;
      document.addEventListener('mousemove', function (e) {
        mx = e.clientX; my = e.clientY;
        if (!seen) { seen = true; ring.classList.remove('hide'); dot.classList.remove('hide'); }
        dot.style.transform = 'translate(' + mx + 'px,' + my + 'px) translate(-50%,-50%)';
      }, { passive: true });
      (function loop() {
        rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
        ring.style.transform = 'translate(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px) translate(-50%,-50%)';
        requestAnimationFrame(loop);
      })();
      var SEL = 'a,button,input,textarea,select,.media,.mtile,[data-tilt],.chip,.kr-label,.socials a,.burger';
      document.addEventListener('mouseover', function (e) {
        if (e.target.closest && e.target.closest(SEL)) ring.classList.add('grow');
      });
      document.addEventListener('mouseout', function (e) {
        if (e.target.closest && e.target.closest(SEL)) {
          var to = e.relatedTarget;
          if (!(to && to.closest && to.closest(SEL))) ring.classList.remove('grow');
        }
      });
      document.addEventListener('mouseleave', function () { ring.classList.add('hide'); dot.classList.add('hide'); });
      document.addEventListener('mouseenter', function () { ring.classList.remove('hide'); dot.classList.remove('hide'); });

      // magnetic buttons
      if (!reduce) {
        document.querySelectorAll('.btn').forEach(function (b) {
          b.addEventListener('mousemove', function (e) {
            var r = b.getBoundingClientRect();
            b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) +
              'px,' + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px)';
          });
          b.addEventListener('mouseleave', function () { b.style.transform = ''; });
        });
      }
    }

    // Lenis smooth scroll (CDN, graceful — falls back to native if blocked)
    if (!reduce) {
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/lenis@1.1.14/dist/lenis.min.js';
      s.onload = function () {
        if (!window.Lenis) return;
        try {
          var l = new Lenis({ lerp: 0.11, smoothWheel: true });
          function raf(t) { l.raf(t); requestAnimationFrame(raf); }
          requestAnimationFrame(raf);
          window.__lenis = l;
        } catch (e) { }
      };
      document.head.appendChild(s);
    }
  })();
})();
