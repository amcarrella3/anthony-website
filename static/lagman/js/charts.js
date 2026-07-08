// charts.js — resolution-independent SVG: spectrum bars + signature radar.
// No dependencies. Everything scales crisply at any size.

import { el, fmtNum } from './util.js';
import { familyOf } from './schema.js';

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
}

// A single labelled spectrum bar: a track with a marker where the value sits.
export function spectrumBar(field, value) {
  const min = field.min ?? 0, max = field.max ?? 10;
  const pct = Math.max(0, Math.min(1, ((Number(value) || 0) - min) / (max - min))) * 100;
  const fam = familyOf(field.id);
  const row = el('div', { class: 'spec-row', style: fam ? `--fam:var(--c-${fam})` : null }, [
    el('div', { class: 'spec-head' }, [
      el('span', { class: 'spec-label' }, [fam ? el('span', { class: 'swatch' }) : null, field.label]),
      el('span', { class: 'spec-value' }, fmtNum(value ?? 0)),
    ]),
    el('div', { class: 'spec-track' }, [
      el('div', { class: 'spec-fill', style: `width:${pct}%` }),
      el('div', { class: 'spec-marker', style: `left:${pct}%` }),
    ]),
    el('div', { class: 'spec-ends' }, [el('span', {}, field.left || String(min)), el('span', {}, field.right || String(max))]),
  ]);
  return row;
}

// Overlaid radar for the headline axes. axes:[{label,min,max}], series:[{label,color,values:[..]}]
export function radarSVG(axes, series, { size = 260, pad = 34 } = {}) {
  const cx = size / 2, cy = size / 2, R = size / 2 - pad;
  const n = axes.length;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, r) => [cx + Math.cos(angle(i)) * R * r, cy + Math.sin(angle(i)) * R * r];

  const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, class: 'radar', role: 'img' });

  // grid rings
  for (const ring of [0.25, 0.5, 0.75, 1]) {
    const pts = axes.map((_, i) => pt(i, ring).join(',')).join(' ');
    svg.appendChild(svgEl('polygon', { points: pts, class: 'radar-ring' }));
  }
  // spokes + labels
  axes.forEach((ax, i) => {
    const [x, y] = pt(i, 1);
    svg.appendChild(svgEl('line', { x1: cx, y1: cy, x2: x, y2: y, class: 'radar-spoke' }));
    const [lx, ly] = pt(i, 1.16);
    const t = svgEl('text', { x: lx, y: ly, class: 'radar-axis-label', 'text-anchor': lx < cx - 4 ? 'end' : lx > cx + 4 ? 'start' : 'middle', dy: '0.32em' });
    t.textContent = ax.label;
    svg.appendChild(t);
  });
  // series
  series.forEach((s) => {
    const pts = axes.map((ax, i) => {
      const v = s.values[i];
      const norm = Math.max(0, Math.min(1, ((Number(v) || 0) - ax.min) / (ax.max - ax.min)));
      return pt(i, norm).join(',');
    }).join(' ');
    svg.appendChild(svgEl('polygon', { points: pts, fill: s.color, 'fill-opacity': 0.18, stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  });
  return svg;
}

export const SERIES_COLORS = ['var(--accent)', 'var(--c-spice)', 'var(--c-meat)', 'var(--c-veg)', 'var(--c-broth)'];
