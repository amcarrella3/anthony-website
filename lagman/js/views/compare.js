// views/compare.js — compare 2+ bowls. Per-axis aligned bars (the workhorse,
// legible on a phone) plus a small overlaid signature radar.

import { SECTIONS, headlineFields } from '../schema.js';
import * as store from '../store.js';
import { el, clear, fmtNum } from '../util.js';
import { radarSVG, SERIES_COLORS } from '../charts.js';
import { navigate } from '../app.js';

// Shared selection set — archive toggles it, this view reads it.
export const compareSelection = new Set();

export async function renderCompare(root) {
  clear(root);
  const ids = [...compareSelection];
  const bowls = (await Promise.all(ids.map((id) => store.getBowl(id)))).filter(Boolean);

  root.appendChild(el('div', { class: 'form-header-row' }, [
    el('button', { class: 'btn-ghost', onclick: () => navigate('#/archive') }, '‹ Archive'),
    el('div', { class: 'form-bowl-no' }, 'Comparison'),
    el('button', { class: 'btn-ghost', onclick: () => { compareSelection.clear(); navigate('#/archive'); } }, 'Clear'),
  ]));

  if (bowls.length < 2) {
    root.appendChild(el('div', { class: 'empty' }, [
      el('p', { class: 'empty-title' }, 'Pick at least two bowls.'),
      el('p', {}, 'On the archive, tap the ✓ on two or more cards, then Compare.'),
      el('button', { class: 'btn-primary', onclick: () => navigate('#/archive') }, 'Go to archive'),
    ]));
    return;
  }

  const series = bowls.map((b, i) => ({ bowl: b, color: SERIES_COLORS[i % SERIES_COLORS.length] }));

  // Legend.
  root.appendChild(el('div', { class: 'compare-legend' }, series.map(({ bowl, color }) =>
    el('div', { class: 'legend-item', onclick: () => navigate(`#/bowl/${bowl.id}`) }, [
      el('span', { class: 'swatch-sq', style: `background:${color}` }),
      el('span', { class: 'mono' }, `#${fmtNum(bowl.bowlNumber)}`),
      el('span', {}, bowl.poeticName || bowl.descriptiveName || bowl.restaurantName || ''),
    ]))));

  // Signature radar overlay.
  const hf = headlineFields();
  const axes = hf.map((f) => ({ label: f.notation?.token || f.label, min: f.min, max: f.max }));
  const radarSeries = series.map(({ bowl, color }) => ({ label: `#${bowl.bowlNumber}`, color, values: hf.map((f) => bowl[f.id]) }));
  root.appendChild(el('div', { class: 'signature' }, [
    el('div', { class: 'signature-title' }, 'Signatures overlaid'),
    radarSVG(axes, radarSeries, { size: 300 }),
    el('div', { class: 'signature-key mono' }, hf.map((f) => `${f.notation?.token}=${f.label}`).join('  ·  ')),
  ]));

  // Per-axis aligned bars, grouped by section.
  for (const section of SECTIONS) {
    const rows = [];
    for (const field of section.fields) {
      if (field.type === 'slider') rows.push(multiBar(field, series));
      else if (field.type === 'number' && field.notation) rows.push(numRow(field, series));
    }
    if (rows.length) root.appendChild(el('section', { class: 'detail-section' }, [el('h2', { class: 'section-title' }, section.title), ...rows]));
  }
}

function multiBar(field, series) {
  const min = field.min ?? 0, max = field.max ?? 10;
  const track = el('div', { class: 'spec-track spec-track-multi' });
  for (const { bowl, color } of series) {
    const pct = Math.max(0, Math.min(1, ((Number(bowl[field.id]) || 0) - min) / (max - min))) * 100;
    track.appendChild(el('div', { class: 'spec-marker', style: `left:${pct}%;border-color:${color};background:${color}`, title: `#${bowl.bowlNumber}: ${fmtNum(bowl[field.id])}` }));
  }
  return el('div', { class: 'spec-row' }, [
    el('div', { class: 'spec-head' }, [
      el('span', { class: 'spec-label' }, field.label),
      el('span', { class: 'spec-value mono' }, series.map(({ bowl }) => fmtNum(bowl[field.id] ?? 0)).join(' / ')),
    ]),
    track,
    el('div', { class: 'spec-ends' }, [el('span', {}, field.left), el('span', {}, field.right)]),
  ]);
}

function numRow(field, series) {
  return el('div', { class: 'spec-row spec-row-num' }, [
    el('span', { class: 'spec-label' }, field.label),
    el('span', { class: 'spec-value mono' }, series.map(({ bowl }) => fmtNum(bowl[field.id] ?? 0)).join(' / ')),
  ]);
}
