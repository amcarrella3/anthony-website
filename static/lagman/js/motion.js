// motion.js — elegant, physical reveal helpers. The page loads, the data draws
// itself in, scores count up. Everything respects prefers-reduced-motion.

export function prefersReduced() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

export function countUp(el, target, opts = {}) {
  const decimal = !!opts.decimal;
  const fin = decimal ? Number(target).toFixed(1) : String(Math.round(target));
  if (prefersReduced()) { el.textContent = fin; return; }
  const dur = opts.dur || 850; const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3), v = target * e;
    el.textContent = decimal ? v.toFixed(1) : String(Math.round(v));
    if (p < 1) requestAnimationFrame(tick); else el.textContent = fin;
  })(performance.now());
}

// Reveal one archive entry: add .in, count the score up, stagger the notation.
export function revealEntry(entry) {
  entry.classList.add('in');
  if (prefersReduced()) return;
  const n = entry.querySelector('.score .n');
  if (n && n.dataset.target != null) {
    const target = parseFloat(n.dataset.target);
    n.textContent = '0';
    setTimeout(() => countUp(n, target, { decimal: n.dataset.decimal === '1' }), 300);
  }
  entry.querySelectorAll('.notation > span').forEach((s, i) => { s.style.animationDelay = (0.35 + i * 0.05) + 's'; });
}

// Reveal a list of entries in a gentle stagger.
export function revealAll(entries, step = 120) {
  const list = [].slice.call(entries);
  if (prefersReduced()) { list.forEach((e) => e.classList.add('in')); return; }
  list.forEach((e, i) => setTimeout(() => revealEntry(e), i * step));
}

// Stagger the tokens of a standalone notation block (detail hero) and reveal it.
export function revealNotation(wrap) {
  if (!wrap) return;
  if (!prefersReduced()) wrap.querySelectorAll('.notation > span').forEach((s, i) => { s.style.animationDelay = (0.1 + i * 0.045) + 's'; });
  wrap.classList.add('in');
}
