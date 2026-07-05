// views/detail.js — full read view of one bowl. Notation prominent, a signature
// radar of the headline axes, and every scored axis as a spectrum bar.

import { SECTIONS, getField, headlineFields } from '../schema.js';
import { buildNotation } from '../notation.js';
import * as store from '../store.js';
import { el, clear, fmtNum, esc } from '../util.js';
import { spectrumBar, radarSVG, SERIES_COLORS } from '../charts.js';
import { fullText, shareText } from '../formatters.js';
import { navigate } from '../app.js';

export async function renderDetail(root, { id }) {
  const bowl = await store.getBowl(id);
  clear(root);
  if (!bowl) {
    root.appendChild(el('div', { class: 'empty' }, [el('p', {}, 'That bowl was not found.'), el('button', { class: 'btn-primary', onclick: () => navigate('#/archive') }, 'Back to archive')]));
    return;
  }
  const { html } = buildNotation(bowl);

  // Header + notation.
  root.appendChild(el('div', { class: 'detail-head' }, [
    el('div', { class: 'form-header-row' }, [
      el('button', { class: 'btn-ghost', onclick: () => navigate('#/archive') }, '‹ Archive'),
      el('div', { class: 'card-no mono' }, `#${fmtNum(bowl.bowlNumber)}`),
      el('div', { class: 'detail-actions' }, [
        el('button', { class: 'btn-ghost', onclick: () => navigate(`#/edit/${bowl.id}`) }, 'Edit'),
        el('button', { class: 'btn-ghost', onclick: () => navigate('#/legend') }, 'Legend'),
      ]),
    ]),
    el('h1', { class: 'detail-poetic' }, bowl.poeticName || bowl.descriptiveName || 'Untitled bowl'),
    bowl.descriptiveName ? el('div', { class: 'detail-descriptive' }, bowl.descriptiveName) : null,
    el('div', { class: 'notation-hero mono', html }),
    (() => {
      const b = el('button', { class: 'btn-ghost btn-copy' }, 'Copy notation');
      b.addEventListener('click', async () => { await navigator.clipboard?.writeText(bowl.notationPlain || buildNotation(bowl).plain); b.textContent = 'Copied ✓'; setTimeout(() => (b.textContent = 'Copy notation'), 1400); });
      return b;
    })(),
  ]));

  // Meta grid.
  const meta = el('div', { class: 'meta-grid' });
  const metaItems = [
    ['Restaurant', bowl.restaurantName], ['Address', bowl.address], ['Date', bowl.date],
    ['Time', bowl.time], ['Price', bowl.price != null && bowl.price !== '' ? `$${bowl.price}` : ''],
    ['Weather', bowl.weather], ['With', bowl.companions], ['Mood / context', bowl.moodContext],
  ];
  for (const [k, v] of metaItems) if (v) meta.appendChild(el('div', { class: 'meta-item' }, [el('span', { class: 'meta-k' }, k), el('span', { class: 'meta-v' }, String(v))]));
  root.appendChild(meta);

  // Per-bowl export views (distinct from the archive-wide data backup).
  root.appendChild(exportBlock(bowl));

  // Signature radar (headline axes).
  const hf = headlineFields();
  const axes = hf.map((f) => ({ label: f.notation?.token || f.label, min: f.min, max: f.max }));
  const series = [{ label: 'this bowl', color: SERIES_COLORS[0], values: hf.map((f) => bowl[f.id]) }];
  root.appendChild(el('div', { class: 'signature' }, [
    el('div', { class: 'signature-title' }, 'Signature'),
    radarSVG(axes, series, { size: 280 }),
    el('div', { class: 'signature-key mono' }, hf.map((f) => `${f.notation?.token}=${f.label}`).join('  ·  ')),
  ]));

  // Sections: spectrum bars for sliders, read display for everything else.
  for (const section of SECTIONS) {
    if (section.id === 'basic' || section.id === 'names') continue;
    const body = el('div', { class: 'detail-section-body' });
    let any = false;
    for (const field of section.fields) {
      const node = readField(field, bowl);
      if (node) { body.appendChild(node); any = true; }
    }
    if (any) root.appendChild(el('section', { class: 'detail-section' }, [el('h2', { class: 'section-title' }, section.title), body]));
  }

  root.appendChild(el('div', { class: 'form-footer' }, [
    el('button', { class: 'btn-danger', onclick: () => del(bowl) }, 'Delete'),
    el('button', { class: 'btn-primary', onclick: () => navigate(`#/edit/${bowl.id}`) }, 'Edit this bowl'),
  ]));

  async function del(b) {
    if (!confirm(`Delete bowl #${b.bowlNumber} — ${b.restaurantName}? This cannot be undone.`)) return;
    await store.deleteBowl(b.id);
    navigate('#/archive');
  }
}

function readField(field, bowl) {
  const v = bowl[field.id];
  switch (field.type) {
    case 'slider':
      return spectrumBar(field, v);
    case 'number': {
      if (v == null || v === '') return null;
      return kv(field.label, `${field.prefix || ''}${fmtNum(v)}${field.suffix ? ' ' + field.suffix : ''}`);
    }
    case 'enum': {
      const opt = (field.options || []).find((o) => o.value === v);
      return opt ? kv(field.label, opt.label) : null;
    }
    case 'multiselect': {
      const chips = (v || []).map((val) => (field.options.find((o) => o.value === val)?.label) || val);
      const other = bowl[field.id + 'Other'];
      if (other) chips.push(other);
      if (!chips.length) return null;
      return el('div', { class: 'read-field' }, [
        el('div', { class: 'read-label' }, field.label),
        el('div', { class: 'chips read-chips' }, chips.map((c) => el('span', { class: 'chip on static' }, c))),
      ]);
    }
    case 'repeater': {
      const items = (v || []).filter((it) => it && it.name);
      if (!items.length) return null;
      return el('div', { class: 'read-field' }, [
        el('div', { class: 'read-label' }, field.label),
        el('div', { class: 'chips read-chips' }, items.map((it) => el('span', { class: 'chip on static' }, `${it.name} ${fmtNum(it.intensity || 0)}`))),
      ]);
    }
    case 'longtext':
    case 'text':
      if (!v) return null;
      return el('div', { class: 'read-field' }, [el('div', { class: 'read-label' }, field.label), el('p', { class: 'read-text' }, String(v))]);
    default:
      return null;
  }
}

function kv(k, v) { return el('div', { class: 'read-field read-inline' }, [el('span', { class: 'read-label' }, k), el('span', { class: 'read-text' }, v)]); }

function copyButton(label, getText) {
  const b = el('button', { class: 'btn-ghost' }, label);
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied ✓'; }
    catch { b.textContent = 'Copy failed'; }
    setTimeout(() => (b.textContent = label), 1500);
  });
  return b;
}

function exportBlock(bowl) {
  return el('section', { class: 'export-block no-print' }, [
    el('div', { class: 'export-block-title' }, 'Share & export this bowl'),
    el('div', { class: 'export-actions' }, [
      copyButton('Copy summary', () => shareText(bowl)),
      copyButton('Copy full entry', () => fullText(bowl)),
      el('button', { class: 'btn-primary', onclick: () => window.print(), title: 'Opens your browser’s print → Save as PDF' }, 'Export PDF'),
    ]),
    el('div', { class: 'export-block-hint' }, 'Summary is a short, textable recap · Full entry is every field · PDF prints this breakdown (choose “Save as PDF”). Archive-wide JSON/CSV backup lives under Export.'),
  ]);
}
