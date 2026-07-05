// views/legend.js — the notation key. Every token explained, in formula order.

import { notationLegend } from '../notation.js';
import { el, clear } from '../util.js';
import { navigate } from '../app.js';

export function renderLegend(root) {
  clear(root);
  root.appendChild(el('div', { class: 'form-header-row' }, [
    el('button', { class: 'btn-ghost', onclick: () => history.length > 1 ? history.back() : navigate('#/archive') }, '‹ Back'),
    el('div', { class: 'form-bowl-no' }, 'Notation key'),
    el('span', {}, ''),
  ]));

  root.appendChild(el('div', { class: 'prose' }, [
    el('p', {}, 'Each bowl’s molecular notation reads left to right as ', el('span', { class: 'mono' }, 'Lgₙ( … )'), ' — groups separated by hyphens, sub-tokens by a mid-dot. Zero-value spices are omitted so the formula stays legible. Every token here is yours to rename.'),
  ]));

  const table = el('div', { class: 'legend-table' });
  for (const row of notationLegend()) {
    table.appendChild(el('div', { class: 'legend-row' }, [
      el('div', { class: 'legend-token mono' }, row.token),
      el('div', { class: 'legend-meaning' }, row.meaning),
    ]));
  }
  root.appendChild(table);
}
