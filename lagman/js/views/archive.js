// views/archive.js — home. Every bowl as a card; sortable; select for compare.

import * as store from '../store.js';
import { buildNotation } from '../notation.js';
import { getField } from '../schema.js';
import { el, clear, fmtNum, esc } from '../util.js';
import { navigate } from '../app.js';
import { compareSelection } from './compare.js';

let sortMode = 'bowl-desc';

const SORTS = {
  'bowl-desc': { label: 'Newest bowl #', fn: (a, b) => (b.bowlNumber || 0) - (a.bowlNumber || 0) },
  'bowl-asc': { label: 'Oldest bowl #', fn: (a, b) => (a.bowlNumber || 0) - (b.bowlNumber || 0) },
  'date-desc': { label: 'Date, newest', fn: (a, b) => String(b.date || '').localeCompare(String(a.date || '')) },
  'harmony-desc': { label: 'Harmony, highest', fn: (a, b) => (b.harmony || 0) - (a.harmony || 0) },
  'origin-asc': { label: 'Cultural origin, Central Asian → Eastern European', fn: (a, b) => (a.culturalOrigin || 0) - (b.culturalOrigin || 0) },
};

export async function renderArchive(root) {
  const bowls = await store.allBowls();
  clear(root);

  const bar = el('div', { class: 'archive-bar' }, [
    el('div', { class: 'archive-count' }, `${bowls.length} bowl${bowls.length === 1 ? '' : 's'}`),
    (() => {
      const sel = el('select', { class: 'input select', onchange: (e) => { sortMode = e.target.value; renderArchive(root); } });
      for (const [k, v] of Object.entries(SORTS)) sel.appendChild(el('option', { value: k, selected: k === sortMode }, v.label));
      return sel;
    })(),
  ]);
  root.appendChild(bar);

  if (!bowls.length) {
    root.appendChild(el('div', { class: 'empty' }, [
      el('p', { class: 'empty-title' }, 'The archive is empty.'),
      el('p', {}, 'Score your first bowl of lagman to begin the record.'),
      el('button', { class: 'btn-primary', onclick: () => navigate('#/new') }, 'Score a bowl'),
      el('div', { style: 'margin-top:18px' }, [
        el('button', {
          class: 'btn-ghost', onclick: async () => { const { loadSamples } = await import('../sample.js'); await loadSamples(); renderArchive(root); },
        }, 'Load two sample bowls to explore'),
      ]),
    ]));
    return;
  }

  const sorted = [...bowls].sort(SORTS[sortMode].fn);
  const grid = el('div', { class: 'card-grid' });
  for (const bowl of sorted) grid.appendChild(bowlCard(bowl, root));
  root.appendChild(grid);

  updateCompareBar(root);
}

function bowlCard(bowl, root) {
  const { html } = buildNotation(bowl);
  const wouldReturn = getField('wouldReturn').options.find((o) => o.value === bowl.wouldReturn);
  const selected = compareSelection.has(bowl.id);

  const card = el('article', { class: 'bowl-card' + (selected ? ' sel' : '') });

  const check = el('button', {
    class: 'card-check' + (selected ? ' on' : ''), title: 'Select for comparison',
    onclick: (e) => {
      e.stopPropagation();
      if (compareSelection.has(bowl.id)) compareSelection.delete(bowl.id);
      else compareSelection.add(bowl.id);
      card.classList.toggle('sel');
      check.classList.toggle('on');
      updateCompareBar(root);
    },
  }, '✓');

  const head = el('div', { class: 'card-head', onclick: () => navigate(`#/bowl/${bowl.id}`) }, [
    el('div', { class: 'card-no mono' }, `#${fmtNum(bowl.bowlNumber)}`),
    el('div', { class: 'card-titles' }, [
      el('div', { class: 'card-poetic' }, bowl.poeticName || bowl.descriptiveName || 'Untitled bowl'),
      el('div', { class: 'card-restaurant' }, [bowl.restaurantName, bowl.date ? ` · ${bowl.date}` : ''].join('')),
    ]),
    el('div', { class: 'card-harmony', title: 'Harmony' }, [
      el('span', { class: 'harmony-num mono' }, fmtNum(bowl.harmony ?? 0)),
      el('span', { class: 'harmony-label' }, 'harmony'),
    ]),
  ]);

  const notation = el('div', { class: 'card-notation mono', html, onclick: () => navigate(`#/bowl/${bowl.id}`) });

  const foot = el('div', { class: 'card-foot' }, [
    wouldReturn ? el('span', { class: `pill pill-${bowl.wouldReturn}` }, `Return: ${wouldReturn.label}`) : null,
    el('div', { class: 'card-actions' }, [
      el('button', { class: 'btn-ghost', onclick: (e) => { e.stopPropagation(); navigate(`#/edit/${bowl.id}`); } }, 'Edit'),
      el('button', { class: 'btn-ghost btn-danger-ghost', onclick: (e) => del(e, bowl, root) }, 'Delete'),
    ]),
  ]);

  card.append(check, head, notation, foot);
  return card;
}

async function del(e, bowl, root) {
  e.stopPropagation();
  if (!confirm(`Delete bowl #${bowl.bowlNumber} — ${bowl.restaurantName}? This cannot be undone.`)) return;
  await store.deleteBowl(bowl.id);
  compareSelection.delete(bowl.id);
  renderArchive(root);
}

function updateCompareBar(root) {
  let bar = document.getElementById('compare-fab');
  if (bar) bar.remove();
  if (compareSelection.size < 2) return;
  bar = el('div', { class: 'compare-fab', id: 'compare-fab' }, [
    el('button', { class: 'btn-ghost', onclick: () => { compareSelection.clear(); renderArchive(root); } }, 'Clear'),
    el('button', { class: 'btn-primary', onclick: () => navigate('#/compare') }, `Compare ${compareSelection.size} bowls`),
  ]);
  document.body.appendChild(bar);
}
