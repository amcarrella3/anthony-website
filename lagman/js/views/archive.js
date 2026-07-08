// views/archive.js — the archive as a minimal-luxe ledger. Each bowl is an entry
// line (not a card): poetic name, a large quiet harmony score, four colour-coded
// headline axes, and the colour-coded notation. Reveals with motion.

import * as store from '../store.js';
import { buildNotation } from '../notation.js';
import { getField, familyOf } from '../schema.js';
import { el, clear, fmtNum } from '../util.js';
import { revealAll } from '../motion.js';
import { navigate } from '../app.js';
import { compareSelection } from './compare.js';

let sortMode = 'bowl-desc';

const SORTS = {
  'bowl-desc': { label: 'Newest', fn: (a, b) => (b.bowlNumber || 0) - (a.bowlNumber || 0) },
  'bowl-asc': { label: 'Oldest', fn: (a, b) => (a.bowlNumber || 0) - (b.bowlNumber || 0) },
  'harmony-desc': { label: 'Harmony', fn: (a, b) => (b.harmony || 0) - (a.harmony || 0) },
  'origin-asc': { label: 'Origin', fn: (a, b) => (a.culturalOrigin || 0) - (b.culturalOrigin || 0) },
};

// four headline axes shown on each entry, with short labels
const CARD_AXES = [
  { id: 'culturalOrigin', label: 'Cultural origin' },
  { id: 'spiceComplexity', label: 'Complexity' },
  { id: 'noodlePull', label: 'Noodle pull' },
  { id: 'fatOil', label: 'Fat / oil' },
];

const MARK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1" opacity="0.8"/><circle cx="12" cy="12" r="3" fill="var(--accent)"/></svg>';

export async function renderArchive(root) {
  const bowls = await store.allBowls();
  clear(root);

  root.appendChild(el('div', { class: 'sec-head' }, [
    el('span', {}, 'The Archive'),
    el('span', { class: 'archive-count' }, bowls.length ? `${bowls.length} bowl${bowls.length === 1 ? '' : 's'}` : ''),
  ]));
  root.appendChild(el('div', { class: 'rule' }));

  if (!bowls.length) {
    root.appendChild(el('div', { class: 'empty' }, [
      el('div', { class: 'mark-lg', html: MARK_SVG }),
      el('p', { class: 'empty-title' }, 'The archive is empty.'),
      el('p', {}, 'Score your first bowl of lagman to begin the record.'),
      el('div', {}, [el('button', { class: 'btn-primary', onclick: () => navigate('#/new') }, 'Score a bowl')]),
      el('div', {}, [el('button', {
        class: 'btn-ghost', onclick: async () => { const { loadSamples } = await import('../sample.js'); await loadSamples(); renderArchive(root); },
      }, 'Load two sample bowls')]),
    ]));
    return;
  }

  const bar = el('div', { class: 'archive-bar' }, [
    el('button', { class: 'btn-primary', onclick: () => navigate('#/new') }, [markPlus(), 'Score a bowl']),
    (() => {
      const sel = el('select', { class: 'select', style: 'width:auto;min-height:38px;padding:0 30px 0 12px', onchange: (e) => { sortMode = e.target.value; renderArchive(root); } });
      for (const [k, v] of Object.entries(SORTS)) sel.appendChild(el('option', { value: k, selected: k === sortMode }, v.label));
      return sel;
    })(),
  ]);
  root.appendChild(bar);

  const list = el('div', { class: 'card-grid' });
  const sorted = [...bowls].sort(SORTS[sortMode].fn);
  for (const bowl of sorted) list.appendChild(entryEl(bowl, root));
  root.appendChild(list);

  // colour-coding legend
  root.appendChild(codeLegend());

  revealAll(list.querySelectorAll('.entry'));
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  if (Number.isNaN(h)) return String(t);
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m || 0).padStart(2, '0')} ${ap}`;
}

function markPlus() {
  return el('span', { class: 'mono', html: '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M7 2v10M2 7h10"/></svg>' });
}

function entryEl(bowl, root) {
  const { html } = buildNotation(bowl);
  const wr = getField('wouldReturn').options.find((o) => o.value === bowl.wouldReturn);
  const selected = compareSelection.has(bowl.id);
  const entry = el('article', { class: 'entry reveal' + (selected ? ' sel' : '') });

  const dec = (bowl.harmony ?? 0) % 1 !== 0;
  const meta = el('div', { class: 'entry-meta' });
  [bowl.restaurantName, bowl.date, fmtTime(bowl.time)].filter(Boolean).forEach((p, i) => {
    if (i) meta.appendChild(el('span', { class: 'd' }, '·'));
    meta.appendChild(document.createTextNode(p));
  });

  const head = el('div', { class: 'entry-head', onclick: () => navigate(`#/bowl/${bowl.id}`), title: 'Open this bowl' }, [
    el('div', {}, [
      el('div', { class: 'entry-no' }, `No. ${fmtNum(bowl.bowlNumber)}`),
      el('h2', { class: 'poetic' }, bowl.poeticName || bowl.descriptiveName || 'Untitled bowl'),
      meta,
    ]),
    el('div', { class: 'score' }, [
      el('span', { class: 'n', dataset: { target: String(bowl.harmony ?? 0), decimal: dec ? '1' : '0' } }, fmtNum(bowl.harmony ?? 0)),
      el('span', { class: 'lab' }, 'Harmony'),
    ]),
  ]);

  const axes = el('div', { class: 'axes' });
  for (const a of CARD_AXES) axes.appendChild(miniAxis(a, bowl));

  const notation = el('div', { class: 'nwrap', onclick: () => navigate(`#/bowl/${bowl.id}`) }, [
    el('div', { class: 'nlab' }, 'Notation'),
    el('div', { class: 'notation mono', html }),
  ]);

  const cmp = el('button', { class: 'act act-compare' + (selected ? ' on' : '') }, selected ? '✓ Comparing' : 'Compare');
  cmp.addEventListener('click', (e) => {
    e.stopPropagation();
    const now = !compareSelection.has(bowl.id);
    if (now) compareSelection.add(bowl.id); else compareSelection.delete(bowl.id);
    cmp.classList.toggle('on', now); cmp.textContent = now ? '✓ Comparing' : 'Compare';
    entry.classList.toggle('sel', now); updateCompareBar(root);
  });

  const foot = el('div', { class: 'entry-foot' }, [
    wr ? el('div', { class: 'return ' + bowl.wouldReturn }, [el('span', { class: 'bead' }), `Would return${bowl.wouldReturn === 'yes' ? '' : ' · ' + wr.label}`]) : el('span', {}),
    el('div', { class: 'entry-actions' }, [
      el('button', { class: 'act act-open', onclick: (e) => { e.stopPropagation(); navigate(`#/bowl/${bowl.id}`); } }, 'Open'),
      el('button', { class: 'act', onclick: (e) => { e.stopPropagation(); navigate(`#/edit/${bowl.id}`); } }, 'Edit'),
      el('button', { class: 'act act-danger', onclick: (e) => del(e, bowl, root) }, 'Delete'),
      cmp,
    ]),
  ]);

  entry.append(head, axes, notation, foot);
  return entry;
}

function miniAxis(a, bowl) {
  const f = getField(a.id); const fam = familyOf(a.id);
  const val = bowl[a.id] ?? 0;
  const min = f.min ?? 0, max = f.max ?? 10;
  const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  return el('div', { class: 'ax', style: `--fam:var(--c-${fam})` }, [
    el('div', { class: 'top' }, [el('span', { class: 'swatch' }), el('span', { class: 'k' }, a.label), el('span', { class: 'v' }, fmtNum(val))]),
    el('div', { class: 'bar' }, [el('i', { style: `width:${pct}%` }), el('b', { style: `left:${pct}%` })]),
  ]);
}

function codeLegend() {
  const fams = [['origin', 'Origin'], ['spice', 'Spice'], ['fat', 'Fat'], ['broth', 'Broth'], ['meat', 'Meat'], ['noodle', 'Noodles'], ['veg', 'Veg']];
  return el('div', { class: 'code-legend' }, fams.map(([k, label]) =>
    el('span', { class: 'li' }, [el('span', { class: 's', style: `background:var(--c-${k})` }), label])));
}

async function del(e, bowl, root) {
  e.stopPropagation();
  if (!confirm(`Delete bowl #${bowl.bowlNumber} — ${bowl.restaurantName}? This cannot be undone.`)) return;
  await store.deleteBowl(bowl.id);
  compareSelection.delete(bowl.id);
  renderArchive(root);
}

function updateCompareBar(root) {
  document.getElementById('compare-fab')?.remove();
  if (compareSelection.size < 2) return;
  const bar = el('div', { class: 'compare-fab', id: 'compare-fab' }, [
    el('button', { class: 'btn-ghost', onclick: () => { compareSelection.clear(); renderArchive(root); } }, 'Clear'),
    el('button', { class: 'btn-solid', onclick: () => navigate('#/compare') }, `Compare ${compareSelection.size}`),
  ]);
  document.body.appendChild(bar);
}
