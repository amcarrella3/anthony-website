// ornament.js — crisp-SVG Uzbek (Timurid) accents, built from ruler-and-compass
// geometry so they stay razor-sharp at any zoom. Colors come from CSS vars so
// they retheme with light/dark automatically. Ornament is ACCENT, never clutter.
//
//   shamsa()      — radial star-rosette medallion (Shah-i-Zinda / dome-interior shams)
//   mihrabCrown() — four-centred pointed-arch "niche" crown (pishtaq / mihrab)
//   ribbedDome()  — fluted melon dome (Gur-e-Amir / Bibi-Khanym) — the brand mark

const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of [].concat(kids)) if (c) n.appendChild(c);
  return n;
}

// Shamsa: one lancet petal path rotated N times about the centre, plus concentric
// tracery rings and a small central flower. Stroke-only (ganch-lace hairline).
export function shamsa({ size = 240, points = 16, className = 'orn-shamsa' } = {}) {
  const svg = s('svg', { viewBox: '0 0 100 100', class: className, 'aria-hidden': 'true', width: size, height: size });
  const petals = s('g', { fill: 'none', stroke: 'var(--accent-3)', 'stroke-width': 0.7 });
  const petal = 'M50,50 Q46.5,28 50,7 Q53.5,28 50,50 Z'; // lancet from centre to rim
  for (let i = 0; i < points; i++) petals.appendChild(s('path', { d: petal, transform: `rotate(${(360 / points) * i} 50 50)` }));
  svg.appendChild(s('circle', { cx: 50, cy: 50, r: 46, fill: 'none', stroke: 'var(--accent-2)', 'stroke-width': 0.7, opacity: 0.8 }));
  svg.appendChild(s('circle', { cx: 50, cy: 50, r: 42, fill: 'none', stroke: 'var(--accent-3)', 'stroke-width': 0.5, opacity: 0.7 }));
  svg.appendChild(petals);
  // central flower — a smaller 8-fold rosette
  const inner = s('g', { fill: 'none', stroke: 'var(--accent)', 'stroke-width': 0.9 });
  for (let i = 0; i < 8; i++) inner.appendChild(s('path', { d: 'M50,50 Q48,42 50,34 Q52,42 50,50 Z', transform: `rotate(${45 * i} 50 50)` }));
  svg.appendChild(inner);
  svg.appendChild(s('circle', { cx: 50, cy: 50, r: 3.4, fill: 'var(--accent-3)', opacity: 0.85 }));
  return svg;
}

// Mihrab crown: a four-centred pointed arch outline with a small finial — placed
// above a panel so its content reads as sitting in a niche. Undistorted (meet).
export function mihrabCrown({ width = '100%', className = 'orn-crown' } = {}) {
  const svg = s('svg', { viewBox: '0 0 240 46', preserveAspectRatio: 'xMidYMax meet', class: className, 'aria-hidden': 'true' });
  svg.setAttribute('width', width);
  // outer arch (gold), inner arch (turquoise) — the double-line niche
  svg.appendChild(s('path', { d: 'M20,45 L20,30 C20,18 78,14 120,4 C162,14 220,18 220,30 L220,45', fill: 'none', stroke: 'var(--accent-3)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  svg.appendChild(s('path', { d: 'M27,45 L27,31 C27,21 82,17 120,9 C158,17 213,21 213,31 L213,45', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 0.9, opacity: 0.65 }));
  // finial
  svg.appendChild(s('path', { d: 'M120,4 L120,0', stroke: 'var(--accent-3)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  svg.appendChild(s('circle', { cx: 120, cy: 1, r: 1.7, fill: 'var(--accent-3)' }));
  return svg;
}

// Ribbed melon dome — the brand mark. Turquoise shell, cobalt ribs, gold finial.
export function ribbedDome({ size = 34, className = 'orn-dome' } = {}) {
  const svg = s('svg', { viewBox: '0 0 40 44', class: className, 'aria-hidden': 'true', width: size, height: size });
  svg.appendChild(s('rect', { x: 11, y: 33, width: 18, height: 8, rx: 2, fill: 'var(--accent-2)' }));
  svg.appendChild(s('path', { d: 'M20,4 C14,8 8,15 8,23 C8,29 11,32 12,33 L28,33 C29,32 32,29 32,23 C32,15 26,8 20,4 Z', fill: 'var(--accent)' }));
  const ribs = s('g', { fill: 'none', stroke: 'var(--accent-2)', 'stroke-width': 1, opacity: 0.5, 'stroke-linecap': 'round' });
  ribs.appendChild(s('path', { d: 'M20,6 L20,33' }));
  ribs.appendChild(s('path', { d: 'M20,7 C16,14 14,24 13.5,33' }));
  ribs.appendChild(s('path', { d: 'M20,7 C24,14 26,24 26.5,33' }));
  svg.appendChild(ribs);
  svg.appendChild(s('path', { d: 'M20,4 L20,0.5', stroke: 'var(--accent-3)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  svg.appendChild(s('circle', { cx: 20, cy: 1.2, r: 1.7, fill: 'var(--accent-3)' }));
  return svg;
}
