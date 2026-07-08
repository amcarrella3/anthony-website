// panel.js — "Convene the panel": a formal, multi-agent consultation on a bowl.
// Seven dimension-authorities read the molecular notation (one family each) in
// parallel, then a chair synthesizes a verdict. Runs client-side on the user's
// own Anthropic key (browser -> api.anthropic.com), so the app stays a static
// local-first PWA. Text-only; Haiku for the bench, Sonnet for the chair.

import { SECTIONS } from './schema.js';
import { buildNotation } from './notation.js';
import { el, clear } from './util.js';
import * as store from './store.js';

// ---- Key (stored only in this browser) --------------------------------------
const KEY = 'lagman-anthropic-key';
export function getKey() { try { return (localStorage.getItem(KEY) || '').trim(); } catch { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem(KEY, k.trim()) : localStorage.removeItem(KEY); } catch { /* private mode */ } }
export function hasKey() { return !!getKey(); }

// ---- Anthropic client (browser-direct, structured output via a tool) --------
const API = 'https://api.anthropic.com/v1/messages';
const MODELS = { haiku: 'claude-haiku-4-5', sonnet: 'claude-sonnet-5', opus: 'claude-opus-4-8' };

export async function callStructured({ model, system, user, schema, max_tokens = 600 }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': getKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODELS[model] || model,
      max_tokens,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [{ name: 'report', description: 'Return the structured report.', input_schema: schema }],
      tool_choice: { type: 'tool', name: 'report' },
    }),
  });
  if (!res.ok) {
    let msg = `Anthropic API ${res.status}`;
    try { const e = await res.json(); if (e.error?.message) msg = e.error.message; } catch { /* noop */ }
    const err = new Error(msg); err.status = res.status; throw err;
  }
  const data = await res.json();
  const tool = (data.content || []).find((c) => c.type === 'tool_use');
  if (!tool || !tool.input) throw new Error('No structured output returned');
  return tool.input;
}

// ---- The bench: one authority per axis family, built from the schema --------
const PANEL = [
  { key: 'origin', title: 'Cultural Origin', section: 'origin', model: 'haiku', extra: 'Read alongside the meat. Use "Central Asian" / "Eastern European" — never "Soviet"/"Russian".' },
  { key: 'spice', title: 'Spice & Aromatics', section: 'spice', model: 'haiku' },
  { key: 'fat', title: 'Fat & Oil', section: 'fat', model: 'haiku' },
  { key: 'broth', title: 'Broth & Sauce', section: 'broth', model: 'haiku' },
  { key: 'meat', title: 'Meat', section: 'meat', model: 'haiku' },
  { key: 'noodle', title: 'Noodles', section: 'noodles', model: 'haiku' },
  { key: 'veg', title: 'Vegetables', section: 'veg', model: 'haiku' },
];

const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'A crisp verdict, at most 6 words' },
    reading: { type: 'string', description: '1–2 sentence expert reading of THIS dimension only' },
    standing: { type: 'string', description: 'One line on where this sits / how notable it is' },
  },
  required: ['headline', 'reading'],
};
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    character: { type: 'string', description: "One vivid line naming the bowl's archetype" },
    verdict: { type: 'string', description: '2–3 sentence synthesis integrating the panel' },
    tension: { type: 'string', description: 'The central tension or standout' },
    coherence: { type: 'string', description: 'Whether the parts cohere into the harmony score' },
    seek_next: { type: 'string', description: 'What the taster should seek next' },
  },
  required: ['character', 'verdict'],
};

function num(v) { return v == null || v === '' ? '' : (Number.isInteger(Number(v)) ? String(v) : String(v)); }
function sectionFields(id) { return (SECTIONS.find((s) => s.id === id)?.fields) || []; }

function taxonomyFor(id) {
  return sectionFields(id).map((f) => {
    if (f.type === 'slider') return `${f.notation?.token || f.label} = ${f.label} (0 ${f.left} → ${f.max} ${f.right})`;
    if (f.type === 'enum') return `${f.notation?.token || f.label} = ${f.label} (${f.options.map((o) => o.label).join(' / ')})`;
    if (f.type === 'multiselect') return `${f.label} (${f.options.map((o) => o.label).join(', ')})`;
    if (f.type === 'number') return `${f.notation?.token || f.label} = ${f.label}`;
    return null;
  }).filter(Boolean).join('. ');
}

function dataFor(id, bowl) {
  const parts = [];
  for (const f of sectionFields(id)) {
    const v = bowl[f.id];
    if (f.type === 'slider') { if (v != null) parts.push(`${f.label}: ${num(v)}/${f.max}`); }
    else if (f.type === 'number') { if (v != null && v !== '') parts.push(`${f.label}: ${num(v)}`); }
    else if (f.type === 'enum') { const o = (f.options || []).find((x) => x.value === v); if (o) parts.push(`${f.label}: ${o.label}`); }
    else if (f.type === 'multiselect') { const ls = (v || []).map((val) => (f.options.find((o) => o.value === val)?.label) || val); const other = bowl[f.id + 'Other']; if (other) ls.push(other); if (ls.length) parts.push(`${f.label}: ${ls.join(', ')}`); }
    else if (f.type === 'repeater') { const items = (v || []).filter((it) => it && it.name); if (items.length) parts.push(`${f.label}: ${items.map((it) => `${it.name} ${num(it.intensity || 0)}`).join(', ')}`); }
    else if (f.type === 'longtext' || f.type === 'text') { if (v) parts.push(`${f.label}: ${v}`); }
  }
  return parts.join('. ') || 'no values recorded';
}

function context(bowl) {
  const name = bowl.poeticName || bowl.descriptiveName || 'Untitled';
  const where = [bowl.restaurantName, bowl.date].filter(Boolean).join(', ');
  return `This is a formal tasting-panel consultation for "Lagman Log", a parametric scoring instrument. Lagman is a Central Asian hand-pulled noodle dish, encoded in an invented "molecular notation" whose tokens map to 0–10 axes (and a 0–100 cultural-origin spectrum). You are one authority seated on the panel; you read the notation and speak ONLY to your assigned dimension, as a rigorous, formal specialist. Precise and concise.\n\nBowl No. ${num(bowl.bowlNumber)} — "${name}"${where ? ' — ' + where : ''}. Overall Harmony scored ${num(bowl.harmony ?? 0)}/10.\nFull molecular notation: ${buildNotation(bowl).plain}`;
}

// Fire the seven specialists in parallel; onReading(reading) fires as each returns.
export async function convenePanel(bowl, onReading) {
  const ctx = context(bowl);
  const readings = await Promise.all(PANEL.map(async (d) => {
    const system = `${ctx}\n\nYOUR DIMENSION: ${d.title}.\nThe taxonomy you own: ${taxonomyFor(d.section)}.${d.extra ? ' ' + d.extra : ''}`;
    const user = `This bowl's values for ${d.title}: ${dataFor(d.section, bowl)}.\n\nGive your specialist reading of THIS DIMENSION ONLY: a headline (max 6 words), a 1–2 sentence expert reading, and one line on where it sits. Do not discuss any other dimension.`;
    let out;
    try { out = { ...(await callStructured({ model: d.model, system, user, schema: SPEC_SCHEMA, max_tokens: 500 })) }; }
    catch (e) { out = { error: e.message }; }
    const reading = { key: d.key, dimension: d.title, ...out };
    if (onReading) onReading(reading);
    return reading;
  }));

  const good = readings.filter((r) => !r.error).map((r) => ({ dimension: r.dimension, headline: r.headline, reading: r.reading, standing: r.standing }));
  const chairUser = `The specialists reported:\n${JSON.stringify(good)}\n\nOverall Harmony was scored ${num(bowl.harmony ?? 0)}/10. Render the consultation: the bowl's character/archetype (one vivid line), a 2–3 sentence verdict integrating the panel, the central tension or standout, whether the parts cohere into the score, and what the taster should seek next. Formal, considered, specific to this bowl.`;
  const verdict = await callStructured({ model: 'sonnet', system: `${ctx}\n\nYou CHAIR the panel.`, user: chairUser, schema: VERDICT_SCHEMA, max_tokens: 900 });
  return { readings, verdict, notation: buildNotation(bowl).plain, at: new Date().toISOString() };
}

// ---- UI ---------------------------------------------------------------------
function voiceRow(d, r) {
  const body = el('div', { class: 'pv-body' }, [el('div', { class: 'pv-dim' }, (r && r.dimension) || d.title)]);
  if (r && r.wait) body.appendChild(el('div', { class: 'pv-reading pv-wait' }, 'reading the notation…'));
  else if (!r || r.error) body.appendChild(el('div', { class: 'pv-reading pv-err' }, r && r.error ? 'unavailable' : 'unavailable'));
  else {
    if (r.headline) body.appendChild(el('div', { class: 'pv-headline' }, r.headline));
    if (r.reading) body.appendChild(el('div', { class: 'pv-reading' }, r.reading));
    if (r.standing) body.appendChild(el('div', { class: 'pv-standing' }, r.standing));
  }
  return el('div', { class: 'panel-voice' + (r && r.wait ? ' pending' : ''), style: `--fam:var(--c-${d.key})` }, [el('span', { class: 'pv-swatch' }), body]);
}

function chairBlock(v) {
  return el('div', { class: 'panel-chair' }, [
    el('div', { class: 'pv-dim' }, 'The Chair'),
    v.character ? el('div', { class: 'chair-character' }, v.character) : null,
    v.verdict ? el('p', { class: 'chair-p' }, v.verdict) : null,
    v.tension ? el('p', { class: 'chair-p' }, [el('span', { class: 'chair-lab' }, 'Tension — '), v.tension]) : null,
    v.coherence ? el('p', { class: 'chair-p' }, [el('span', { class: 'chair-lab' }, 'Coherence — '), v.coherence]) : null,
    v.seek_next ? el('p', { class: 'chair-p' }, [el('span', { class: 'chair-lab' }, 'Seek next — '), v.seek_next]) : null,
  ]);
}

function keyForm(onSaved) {
  const wrap = el('div', { class: 'keyform' });
  const input = el('input', { class: 'input', type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', spellcheck: 'false' });
  const save = el('button', { class: 'btn-primary', onclick: () => { if (input.value.trim()) { setKey(input.value); onSaved(); } } }, 'Save key');
  wrap.append(
    el('p', { class: 'consult-note' }, 'The panel needs your Anthropic API key. It is stored only in this browser and sent directly to Anthropic — never to any server of ours.'),
    el('div', { class: 'input-affix' }, [input, save]),
  );
  return wrap;
}

export function mountConsultation(container, bowl) {
  showIdle();

  async function showIdle(force) {
    clear(container);
    const cached = await store.getConsultation(bowl.id).catch(() => null);
    const notation = buildNotation(bowl).plain;
    if (!force && cached && cached.notation === notation && cached.verdict) { showReport(cached, true); return; }
    container.appendChild(el('div', { class: 'export-block-title' }, 'The Panel'));
    container.appendChild(el('p', { class: 'consult-note' }, 'Seven dimension-authorities read this bowl from its notation; the chair delivers the verdict. Runs on your own Anthropic key, on this device — about eight calls, roughly a cent.'));
    if (!hasKey()) container.appendChild(keyForm(() => showIdle(true)));
    container.appendChild(el('div', { class: 'btn-row', style: 'margin-top:6px' }, [
      el('button', { class: 'btn-solid', onclick: () => { if (hasKey()) convene(); else container.querySelector('.keyform input')?.focus(); } }, 'Convene the panel'),
      el('a', { class: 'consult-manage', href: '#/settings' }, 'Manage key'),
    ]));
  }

  function convene() {
    clear(container);
    container.appendChild(el('div', { class: 'export-block-title' }, 'The panel is convening…'));
    const rows = {};
    const list = el('div', { class: 'panel-report' });
    for (const d of PANEL) { const row = voiceRow(d, { dimension: d.title, wait: true }); rows[d.key] = row; list.appendChild(row); }
    const chairEl = el('div', { class: 'panel-chair pending' }, [el('div', { class: 'pv-dim' }, 'The Chair'), el('div', { class: 'pv-reading pv-wait' }, 'awaiting the bench…')]);
    container.appendChild(list); container.appendChild(chairEl);
    convenePanel(bowl, (r) => { const nr = voiceRow(PANEL.find((d) => d.key === r.key), r); rows[r.key].replaceWith(nr); rows[r.key] = nr; })
      .then((result) => { store.putConsultation(bowl.id, result).catch(() => {}); showReport(result, false); })
      .catch((e) => { clear(chairEl); chairEl.className = 'panel-chair error'; chairEl.append(el('div', { class: 'pv-reading' }, `The consultation could not complete — ${e.message}`), el('button', { class: 'btn-ghost', style: 'margin-top:10px', onclick: () => showIdle(true) }, 'Try again')); });
  }

  function showReport(result, cached) {
    clear(container);
    container.appendChild(el('div', { class: 'export-block-title' }, cached ? 'The Panel' : 'The Panel — convened'));
    const list = el('div', { class: 'panel-report' });
    for (const d of PANEL) { const r = (result.readings || []).find((x) => x.key === d.key) || { dimension: d.title, error: true }; list.appendChild(voiceRow(d, r)); }
    container.appendChild(list);
    container.appendChild(chairBlock(result.verdict || {}));
    container.appendChild(el('div', { class: 'btn-row', style: 'margin-top:16px' }, [el('button', { class: 'btn-ghost', onclick: () => showIdle(true) }, 'Re-convene')]));
  }
}
