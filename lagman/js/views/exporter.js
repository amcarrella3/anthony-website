// views/exporter.js — JSON export/import + CSV export. Your data is yours; never
// locked in. The CSV is the flat, one-row-per-bowl shape meant to flow into
// Thymer as a Places-collection sibling.

import { allFields, getField } from '../schema.js';
import * as store from '../store.js';
import { el, clear, downloadBlob } from '../util.js';
import { buildNotation } from '../notation.js';
import { navigate } from '../app.js';

export async function renderExport(root) {
  const bowls = await store.allBowls();
  clear(root);

  root.appendChild(el('div', { class: 'form-header-row' }, [
    el('button', { class: 'btn-ghost', onclick: () => navigate('#/archive') }, '‹ Archive'),
    el('div', { class: 'form-bowl-no' }, 'Export & Import'),
    el('span', {}, ''),
  ]));

  root.appendChild(el('div', { class: 'prose' }, [
    el('p', {}, `${bowls.length} bowl${bowls.length === 1 ? '' : 's'} in the archive. This is your long-term record — export it anytime. JSON round-trips completely; CSV is the flat table for spreadsheets and for piping into Thymer.`),
  ]));

  const grid = el('div', { class: 'export-grid' });

  grid.appendChild(actionCard('Export JSON', 'Complete, re-importable snapshot of every field.', 'Download .json', () => {
    const payload = { app: 'lagman-log', version: 1, exportedAt: new Date().toISOString(), bowls };
    downloadBlob(`lagman-log-${stamp()}.json`, 'application/json', JSON.stringify(payload, null, 2));
  }));

  grid.appendChild(actionCard('Export CSV', 'One row per bowl, flat columns — Thymer / spreadsheet ready.', 'Download .csv', () => {
    downloadBlob(`lagman-log-${stamp()}.csv`, 'text/csv', toCSV(bowls));
  }));

  const importCard = actionCard('Import JSON', 'Restore or merge a previously exported archive.', 'Choose file…', () => fileInput.click());
  const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', () => handleImport(fileInput.files[0], root));
  importCard.appendChild(fileInput);
  grid.appendChild(importCard);

  root.appendChild(grid);
}

function actionCard(title, desc, btn, onclick) {
  return el('div', { class: 'export-card' }, [
    el('h3', {}, title),
    el('p', {}, desc),
    el('button', { class: 'btn-primary', onclick }, btn),
  ]);
}

async function handleImport(file, root) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { alert('That file is not valid JSON.'); return; }
  const bowls = Array.isArray(data) ? data : data.bowls;
  if (!Array.isArray(bowls)) { alert('No bowls found in that file.'); return; }
  const mode = confirm(`Import ${bowls.length} bowls.\n\nOK = MERGE into the current archive.\nCancel = REPLACE the current archive entirely.`);
  // Ensure every imported bowl has a fresh notation string consistent with this build.
  for (const b of bowls) { const n = buildNotation(b); b.notation = n.plain; b.notationPlain = n.plain; }
  if (mode) await store.importMerge(bowls); else await store.replaceAll(bowls);
  navigate('#/archive');
}

// ---- CSV --------------------------------------------------------------------
function columns() {
  const cols = [];
  for (const f of allFields()) {
    if (f.type === 'multiselect') { cols.push(f.id); if (f.allowOther) cols.push(f.id + 'Other'); }
    else cols.push(f.id);
  }
  cols.push('notationPlain', 'id', 'createdAt', 'updatedAt');
  return cols;
}

function cellFor(col, bowl) {
  const f = getField(col);
  if (!f) return bowl[col] ?? '';
  if (f.type === 'multiselect') return (bowl[col] || []).map((v) => (f.options.find((o) => o.value === v)?.label) || v).join('|');
  if (f.type === 'repeater') return (bowl[col] || []).filter((it) => it && it.name).map((it) => `${it.name}:${it.intensity ?? 0}`).join('|');
  if (f.type === 'enum') { const o = (f.options || []).find((o) => o.value === bowl[col]); return o ? o.label : ''; }
  return bowl[col] ?? '';
}

function toCSV(bowls) {
  const cols = columns();
  const esc = (s) => { const t = String(s ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const head = cols.join(',');
  const rows = bowls.map((b) => cols.map((c) => esc(cellFor(c, b))).join(','));
  return [head, ...rows].join('\n');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
