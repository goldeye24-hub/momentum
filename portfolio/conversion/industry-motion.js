/* Momentum Marketing: restrained, industry-aware scroll interactions.
   Progressive enhancement: content stays visible when animation is unavailable.
   The seven information-/form-first demos deliberately do not load this script. */
(() => {
  'use strict';
  const kind = document.body && document.body.dataset.mood;
  const presets = {
    restaurant: { targets: ['.mood-gallery > *','.season-board','.menu-entries > *','.visit-panel'], speed: 620, move: 15, hero: '.hero-caption' },
    beauty: { targets: ['.ongyeol-offer','.look-strip > *','.designer-inner','.service-index .service-row'], speed: 700, move: 12 },
    b2b: { targets: ['.zieum-modules > *','.problem-matrix > *','.mood-gallery > *'], speed: 520, move: 11 },
    stay: { targets: ['.raum-side','.rooms-head','.room-grid > *','.journey > *'], speed: 760, move: 18, hero: '.view-copy' },
    interior: { targets: ['.formspace-grid > *','.projects > *','.mood-gallery > *'], speed: 680, move: 16, hero: '.hero-image' },
    pet: { targets: ['.mongle-offers > *','.care-cards > *','.groom .img'], speed: 600, move: 12 },
    auto: { targets: ['.pitworks-services > *','.services > *','.workshop'], speed: 500, move: 12 },
    fitness: { targets: ['.movemore-layout > *','.class-list > *','.coach'], speed: 650, move: 17 },
    estate: { targets: ['.roomindex-strip > *','.results > *','.mood-gallery > *'], speed: 570, move: 12, hero: '.splash-art' },
    hrd: { targets: ['.learnworks-courses > *','.program-grid > *','.method-flow > *'], speed: 500, move: 10 },
    pilates: { targets: ['.forma-editor','.classes > *','.mood-gallery > *'], speed: 720, move: 14 }
  };
  const preset = presets[kind];
  if (!preset || !('IntersectionObserver' in window) || !Element.prototype.animate) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduceMotion.matches) return;

  const nodes = [...new Set(preset.targets.flatMap(s => [...document.querySelectorAll(s)]))]
    .filter(el => el instanceof HTMLElement && !el.closest('[hidden],dialog,[aria-hidden="true"]'));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const node = entry.target;
      observer.unobserve(node);
      if (reduceMotion.matches || document.visibilityState === 'hidden') continue;
      const delay = Math.min((Number(node.dataset.mmOrder) || 0) * 55, 165);
      node.animate([
        { opacity: 0.68, transform: 'translateY(' + preset.move + 'px)' },
        { opacity: 1, transform: 'translateY(0px)' }
      ], { duration: preset.speed, delay, easing: 'cubic-bezier(.2,.72,.2,1)', fill: 'none' });
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' });
  nodes.forEach((node, index) => {
    const box = node.getBoundingClientRect();
    if (box.top > innerHeight * .78 || box.bottom < 0) {
      node.dataset.mmOrder = String(index % 3);
      observer.observe(node);
    }
  });

  // Small, capped scroll offset on visual-first hero sections only.
  // No scroll hijacking, pinned sections, animation dependencies or layout reflow.
  if (!preset.hero || !window.matchMedia('(min-width: 880px)').matches) return;
  const art = document.querySelector(preset.hero);
  if (!(art instanceof HTMLElement)) return;
  let scheduled = false;
  const paint = () => {
    scheduled = false;
    if (reduceMotion.matches) { art.style.translate = ''; return; }
    const y = window.scrollY || 0;
    art.style.translate = '0 ' + Math.round(Math.max(0, Math.min(y * .055, 24))) + 'px';
  };
  const requestPaint = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(paint); } };
  window.addEventListener('scroll', requestPaint, { passive: true });
  reduceMotion.addEventListener?.('change', paint);
  requestPaint();
})();