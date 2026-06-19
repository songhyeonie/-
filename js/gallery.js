/* ============================================================
   JUNG'GAM BNG — gallery.js
   Renders category archives from js/gallery-manifest.js:
   · masonry mosaic with per-column scroll parallax + scroll reveal
   · moving film-strip   · brand logo marquee   · click-to-zoom lightbox
   Markup hooks:
     <div class="mosaic"  data-gallery="rooms" [data-exclude="a.jpg,b.jpg"] [data-limit="60"]></div>
     <div class="filmstrip" data-gallery="story" [data-pick="..."] [data-limit="30"] [class~=rev]></div>
     <div class="logo-marquee" data-gallery="others"></div>
     <span data-gallery-count="story"></span>
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var G = window.GALLERY || {};
  var BASE = 'assets/graphics/';

  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function list(cat) { return G[cat] || []; }
  function csv(s) { return (s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }

  /* ---------- lightbox ---------- */
  var lb;
  function ensureLB() {
    if (lb) return;
    lb = el('div', 'lightbox');
    lb.innerHTML = '<button class="lb-close" aria-label="닫기">×</button><img alt="">';
    document.body.appendChild(lb);
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('lb-close')) lb.classList.remove('open');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lb) lb.classList.remove('open');
    });
  }
  function openLB(src) { ensureLB(); lb.querySelector('img').src = src; lb.classList.add('open'); }

  /* ---------- shared reveal observer ---------- */
  var io = ('IntersectionObserver' in window && !reduce) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' }) : null;

  function tile(cat, it, idx) {
    var fig = el('figure', 'mtile');
    fig.style.aspectRatio = it.w + '/' + it.h;
    fig.style.setProperty('--d', idx % 6);
    var img = el('img');
    img.loading = 'lazy'; img.decoding = 'async';
    img.src = BASE + cat + '/' + it.f; img.alt = '';
    fig.appendChild(img);
    fig.addEventListener('click', function () { openLB(img.src); });
    if (io) io.observe(fig); else fig.classList.add('in');
    return fig;
  }

  /* ---------- masonry mosaic ---------- */
  function colsFor(w) { return w < 560 ? 2 : w < 900 ? 3 : w < 1200 ? 4 : 5; }

  function buildMosaic(node) {
    var cat = node.getAttribute('data-gallery');
    var exclude = csv(node.getAttribute('data-exclude'));
    var limit = parseInt(node.getAttribute('data-limit'), 10) || 0;
    var fixed = parseInt(node.getAttribute('data-cols'), 10) || 0;
    var items = list(cat).filter(function (it) { return it.t === 'photo' && exclude.indexOf(it.f) < 0; });
    if (limit > 0) items = items.slice(0, limit);

    function render() {
      var n = fixed || colsFor(window.innerWidth);
      node._n = n; node.innerHTML = '';
      var cols = [], hsum = [];
      for (var c = 0; c < n; c++) { var cd = el('div', 'mcol'); node.appendChild(cd); cols.push(cd); hsum.push(0); }
      items.forEach(function (it, idx) {
        var mi = 0; for (var c = 1; c < n; c++) if (hsum[c] < hsum[mi]) mi = c;
        cols[mi].appendChild(tile(cat, it, idx));
        hsum[mi] += (it.h / it.w);
      });
      cols.forEach(function (cd, i) { cd._amp = ((i % 2 === 0) ? -1 : 1) * (14 + (i % 3) * 8); });
      node._cols = cols;
    }
    render();
    node._render = render;
  }

  /* ---------- film-strip ---------- */
  function buildStrip(node) {
    var cat = node.getAttribute('data-gallery');
    var pick = csv(node.getAttribute('data-pick'));
    var limit = parseInt(node.getAttribute('data-limit'), 10) || 36;
    var items = pick.length ? pick.map(function (f) { return { f: f }; })
                            : list(cat).filter(function (it) { return it.t === 'photo'; }).slice(0, limit);
    var track = el('div', 'filmstrip__track');
    function fill() {
      items.forEach(function (it) {
        var fig = el('figure'), img = el('img');
        img.loading = 'lazy'; img.decoding = 'async'; img.src = BASE + cat + '/' + it.f; img.alt = '';
        fig.appendChild(img);
        fig.addEventListener('click', function () { openLB(img.src); });
        track.appendChild(fig);
      });
    }
    fill(); fill();
    node.appendChild(track);
  }

  /* ---------- logo marquee ---------- */
  function buildLogos(node) {
    var cat = node.getAttribute('data-gallery');
    var pick = csv(node.getAttribute('data-pick'));
    var items = pick.length ? pick.map(function (f) { return { f: f }; })
                            : list(cat).filter(function (it) { return it.t === 'logo'; });
    var track = el('div', 'logo-marquee__track');
    function fill() { items.forEach(function (it) { var img = el('img'); img.loading = 'lazy'; img.src = BASE + cat + '/' + it.f; img.alt = ''; track.appendChild(img); }); }
    fill(); fill();
    node.appendChild(track);
  }

  /* ---------- counts ---------- */
  document.querySelectorAll('[data-gallery-count]').forEach(function (s) {
    s.textContent = list(s.getAttribute('data-gallery-count')).filter(function (it) { return it.t === 'photo'; }).length;
  });

  document.querySelectorAll('.mosaic[data-gallery]').forEach(buildMosaic);
  document.querySelectorAll('.filmstrip[data-gallery]').forEach(buildStrip);
  document.querySelectorAll('.logo-marquee[data-gallery]').forEach(buildLogos);

  /* ---------- per-column parallax ---------- */
  var mosaics = Array.prototype.slice.call(document.querySelectorAll('.mosaic[data-gallery]'));
  function par() {
    var vh = window.innerHeight;
    mosaics.forEach(function (m) {
      if (!m._cols) return;
      var r = m.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      var prog = (vh - r.top) / (vh + r.height);   // 0..1 across the pass, height-independent
      if (prog < 0) prog = 0; else if (prog > 1) prog = 1;
      m._cols.forEach(function (cd) { cd.style.transform = 'translate3d(0,' + ((prog - 0.5) * cd._amp).toFixed(1) + 'px,0)'; });
    });
  }
  if (!reduce && mosaics.length) {
    window.addEventListener('scroll', par, { passive: true });
    window.addEventListener('resize', par);
    par();
  }

  /* ---------- rebuild mosaics only when column count changes ---------- */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      mosaics.forEach(function (m) {
        if (m.getAttribute('data-cols')) return;
        if (m._render && m._n !== colsFor(window.innerWidth)) m._render();
      });
      par();
    }, 220);
  });
})();
