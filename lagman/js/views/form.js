// views/form.js — the scoring sheet. Sectioned, mobile-first, big touch sliders,
// live notation, draft auto-save so a half-finished sheet survives a closed tab.

import { SECTIONS, blankBowl, getField } from '../schema.js';
import { buildNotation } from '../notation.js';
import { suggestName } from '../naming.js';
import * as store from '../store.js';
import { el, clear, fmtNum, todayLocal, timeLocal, makeId, nowISO } from '../util.js';
import { STARTER_RESTAURANTS } from '../../data/restaurants.js';
import { searchPlaces, googleMapsSearchUrl } from '../places.js';
import { hasKey } from '../panel.js';
import { parseDescription } from '../aifill.js';
import { dictationSupported, createDictation } from '../dictate.js';
import { navigate } from '../app.js';

let saveTimer = null;
let handoff = null; // AI-filled bowl handed to the next render (survives re-render in edit mode too)

export async function renderForm(root, params = {}) {
  const editingId = params.id || null;
  const draftKey = editingId || 'new';

  // Load: an AI-filled handoff, an existing bowl, an auto-saved draft, or a fresh blank.
  let bowl;
  if (handoff) {
    bowl = handoff; handoff = null;
  } else if (editingId) {
    bowl = (await store.getBowl(editingId)) || blankBowl();
  } else {
    const draft = await store.getDraft('new');
    if (draft) {
      bowl = draft;
    } else {
      bowl = blankBowl();
      bowl.id = makeId();
      bowl.bowlNumber = await store.nextBowlNumber();
      bowl.date = todayLocal();
      bowl.time = timeLocal();
    }
  }

  clear(root);
  const notationBar = el('div', { class: 'notation-bar mono', id: 'live-notation' });
  const nameTouched = { descriptiveName: !!bowl.descriptiveName };

  function refreshDerived() {
    const { html } = buildNotation(bowl);
    notationBar.innerHTML = html;
    // Auto-fill the descriptive name only while the artist hasn't touched it.
    if (!nameTouched.descriptiveName) {
      bowl.descriptiveName = suggestName(bowl);
      const inp = root.querySelector('[data-field="descriptiveName"]');
      if (inp && document.activeElement !== inp) inp.value = bowl.descriptiveName;
    }
  }

  function onChange(id, value) {
    if (!id.startsWith('__')) bowl[id] = value; // '__nudge' just forces a refresh
    bowl.updatedAt = nowISO();
    refreshDerived();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.saveDraft(draftKey, bowl), 400);
  }

  // ---- Header (sticky): bowl #, live notation, Save --------------------------
  const header = el('div', { class: 'form-header' }, [
    el('div', { class: 'form-header-row' }, [
      el('button', { class: 'btn-ghost', onclick: () => navigate('#/archive') }, '‹ Archive'),
      el('div', { class: 'form-bowl-no' }, `Bowl #${fmtNum(bowl.bowlNumber)}`),
      el('button', { class: 'btn-primary', onclick: save }, editingId ? 'Save' : 'Save bowl'),
    ]),
    notationBar,
    el('div', { class: 'draft-note', id: 'draft-note' }, 'Draft auto-saves as you go.'),
  ]);

  // ---- Sections --------------------------------------------------------------
  const body = el('div', { class: 'form-body' });
  for (const section of SECTIONS) {
    const sec = el('section', { class: 'form-section', id: `sec-${section.id}` }, [
      el('h2', { class: 'section-title' }, section.title),
    ]);
    for (const field of section.fields) {
      sec.appendChild(renderField(field, bowl, onChange, nameTouched));
    }
    body.appendChild(sec);
  }

  const footer = el('div', { class: 'form-footer' }, [
    editingId ? el('button', { class: 'btn-danger', onclick: () => del(editingId) }, 'Delete bowl') : null,
    el('button', { class: 'btn-primary btn-wide', onclick: save }, editingId ? 'Save changes' : 'Save bowl to archive'),
  ]);

  root.appendChild(header);
  root.appendChild(speakSection(bowl, onChange, (values, ids) => {
    Object.assign(bowl, values);
    bowl._suggested = ids;
    bowl.updatedAt = nowISO();
    store.saveDraft(draftKey, bowl).then(() => { handoff = bowl; renderForm(root, params); });
  }));
  root.appendChild(body);
  root.appendChild(footer);
  refreshDerived();

  async function save() {
    if (!bowl.restaurantName || !bowl.restaurantName.trim()) {
      const note = document.getElementById('draft-note');
      note.textContent = 'A restaurant name is needed before saving.';
      note.classList.add('warn');
      document.getElementById('sec-basic').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    clearTimeout(saveTimer); // cancel any pending autosave so it can't resurrect the draft
    delete bowl._speech; delete bowl._suggested; // transient AI-fill state never persists
    const notation = buildNotation(bowl);
    bowl.notation = notation.plain;
    bowl.notationPlain = notation.plain;
    if (!bowl.createdAt) bowl.createdAt = nowISO();
    bowl.updatedAt = nowISO();
    await store.putBowl(bowl);
    await store.bumpBowlCounter(bowl.bowlNumber);
    await store.clearDraft(draftKey);
    navigate(`#/bowl/${bowl.id}`);
  }

  async function del(id) {
    if (!confirm('Delete this bowl from the archive? This cannot be undone.')) return;
    clearTimeout(saveTimer);
    await store.deleteBowl(id);
    await store.clearDraft(id);
    navigate('#/archive');
  }
}

// ---- Speak the bowl (voice / AI fill) ----------------------------------------
function speakSection(bowl, onChange, applyFill) {
  const sec = el('section', { class: 'form-section speak-section', id: 'sec-speak' }, [
    el('h2', { class: 'section-title' }, [el('span', { class: 'swatch', style: 'background:var(--accent)' }), 'Speak the bowl']),
  ]);

  const ta = el('textarea', {
    class: 'input speak-ta', rows: 3,
    placeholder: 'Talk it out — the noodles, the broth, the spice, the meat, the room, the price… then fill the sheet.',
  });
  ta.value = bowl._speech || '';
  ta.addEventListener('input', () => onChange('_speech', ta.value));

  const status = el('div', { class: 'draft-note speak-status' }, '');

  // Voice capture — free, in-browser. Falls back to typing (or the keyboard mic).
  let mic = null;
  if (dictationSupported()) {
    mic = el('button', { type: 'button', class: 'mic-btn', title: 'Dictate', 'aria-label': 'Start or stop dictation' },
      [el('span', { class: 'mic-glyph', html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' })]);
    const dict = createDictation({
      onText: (finalText, interim) => {
        ta.value = finalText + interim;
        onChange('_speech', finalText);
      },
      onState: (listening, error) => {
        mic.classList.toggle('on', listening);
        if (error) status.textContent = 'Microphone unavailable — type it instead (or use the keyboard mic key).';
        else status.textContent = listening ? 'Listening… tap the mic again when you’re done.' : '';
      },
    });
    mic.addEventListener('click', () => { if (dict.isActive()) dict.stop(); else dict.start(ta.value); });
  }

  const fill = el('button', { type: 'button', class: 'btn-solid' }, '✦ Fill the sheet');
  fill.addEventListener('click', async () => {
    const text = (ta.value || '').trim();
    if (!text) { status.textContent = 'Say or type something about the bowl first.'; return; }
    if (!hasKey()) {
      clear(status);
      status.append('The AI fill needs your Anthropic key — add it in ', el('a', { href: '#/settings' }, '⚙ Settings'), ' first.');
      return;
    }
    fill.disabled = true; fill.textContent = 'Reading…';
    try {
      const values = await parseDescription(text);
      const ids = Object.keys(values);
      if (!ids.length) { status.textContent = 'Nothing I could map onto the sheet — say a little more about the bowl itself.'; }
      else { values._speech = text; applyFill(values, ids.filter((k) => k !== '_speech')); return; }
    } catch (e) {
      status.textContent = 'The fill failed — ' + e.message;
    }
    fill.disabled = false; fill.textContent = '✦ Fill the sheet';
  });

  const row = el('div', { class: 'speak-row' }, [mic, ta]);
  sec.append(row, el('div', { class: 'btn-row', style: 'margin-top:10px' }, [fill]), status);
  if (Array.isArray(bowl._suggested) && bowl._suggested.length) {
    sec.appendChild(el('div', { class: 'speak-sugg-note' }, [
      el('span', { class: 'dot' }),
      `Filled ${bowl._suggested.length} field${bowl._suggested.length === 1 ? '' : 's'} from your description — marked below. Adjust anything, then save.`,
    ]));
  }
  if (!dictationSupported()) {
    sec.appendChild(el('div', { class: 'field-hint' }, 'No in-app dictation in this browser — the microphone key on your keyboard dictates into the box just as well.'));
  }
  return sec;
}

// ---- Field renderers --------------------------------------------------------
function renderField(field, bowl, onChange, nameTouched) {
  const wrap = el('div', { class: `field field-${field.type}` });
  if (Array.isArray(bowl._suggested) && bowl._suggested.some((k) => k === field.id || k === field.id + 'Other')) {
    wrap.classList.add('suggested');
  }
  if (field.type !== 'slider') {
    wrap.appendChild(el('label', { class: 'field-label', for: `f-${field.id}` }, field.label));
  }

  if (field.id === 'restaurantName') {
    wrap.appendChild(placeSearchControl(field, bowl, onChange));
    if (field.hint) wrap.appendChild(el('div', { class: 'field-hint' }, field.hint));
    return wrap;
  }

  switch (field.type) {
    case 'slider': wrap.appendChild(sliderControl(field, bowl, onChange)); break;
    case 'multiselect': wrap.appendChild(multiselectControl(field, bowl, onChange)); break;
    case 'enum': wrap.appendChild(enumControl(field, bowl, onChange)); break;
    case 'repeater': wrap.appendChild(repeaterControl(field, bowl, onChange)); break;
    case 'longtext': {
      const ta = el('textarea', { id: `f-${field.id}`, class: 'input', rows: 3, placeholder: field.placeholder || '', dataset: { field: field.id } });
      ta.value = bowl[field.id] || '';
      ta.addEventListener('input', () => onChange(field.id, ta.value));
      wrap.appendChild(ta);
      break;
    }
    default: {
      const type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text';
      const inputWrap = el('div', { class: 'input-affix' });
      if (field.prefix) inputWrap.appendChild(el('span', { class: 'affix' }, field.prefix));
      const inp = el('input', {
        id: `f-${field.id}`, class: 'input', type,
        placeholder: field.placeholder || '', dataset: { field: field.id },
        min: field.min, max: field.max, step: field.step,
        readonly: field.auto || false,
      });
      inp.value = bowl[field.id] == null ? '' : bowl[field.id];
      inp.addEventListener('input', () => {
        if (field.id === 'descriptiveName') nameTouched.descriptiveName = true;
        const v = field.type === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value;
        onChange(field.id, v);
      });
      inputWrap.appendChild(inp);
      if (field.suffix) inputWrap.appendChild(el('span', { class: 'affix' }, field.suffix));
      if (field.autoSuggest) {
        inputWrap.appendChild(el('button', {
          class: 'btn-ghost btn-inline', type: 'button', title: 'Re-suggest from axes',
          onclick: () => { nameTouched.descriptiveName = false; onChange('__nudge', 0); const i = document.querySelector('[data-field="descriptiveName"]'); if (i) i.value = bowl.descriptiveName || ''; },
        }, '↻'));
      }
      wrap.appendChild(inputWrap);
    }
  }

  if (field.hint) wrap.appendChild(el('div', { class: 'field-hint' }, field.hint));
  return wrap;
}

function placeSearchControl(field, bowl, onChange) {
  const box = el('div', { class: 'place-field' });
  const input = el('input', { id: `f-${field.id}`, class: 'input', type: 'text', placeholder: field.placeholder || 'Restaurant name', dataset: { field: field.id }, autocomplete: 'off' });
  input.value = bowl[field.id] || '';

  const results = el('div', { class: 'place-results' });
  const quick = el('div', { class: 'place-quick' });
  const panel = el('div', { class: 'place-panel', style: 'display:none' }, [results, quick]);
  const gmap = el('a', { class: 'place-google', target: '_blank', rel: 'noopener', href: googleMapsSearchUrl(input.value) }, 'Search Google Maps ↗');

  function optButton(r) {
    return el('button', { type: 'button', class: 'place-opt', onclick: () => pick(r.name, r.address) }, [
      el('span', { class: 'place-opt-name' }, r.name),
      r.address ? el('span', { class: 'place-opt-addr' }, r.address) : null,
    ]);
  }
  function pick(name, address) {
    input.value = name;
    onChange('restaurantName', name);
    if (address) {
      const addrInput = document.querySelector('input[data-field="address"]');
      if (addrInput) addrInput.value = address;
      onChange('address', address);
    }
    gmap.href = googleMapsSearchUrl(name);
    hide();
  }
  function drawQuick(filter = '') {
    clear(quick);
    const f = filter.trim().toLowerCase();
    const matches = STARTER_RESTAURANTS.filter((r) => !f || r.name.toLowerCase().includes(f) || r.address.toLowerCase().includes(f));
    if (!matches.length) return;
    quick.appendChild(el('div', { class: 'place-group-label' }, 'Quick picks'));
    for (const r of matches) quick.appendChild(optButton(r));
  }

  let ctrl = null, timer = null;
  function runSearch(q) {
    if (ctrl) ctrl.abort();
    if (q.trim().length < 3) { clear(results); return; }
    ctrl = new AbortController();
    clear(results);
    results.appendChild(el('div', { class: 'place-group-label' }, 'Searching…'));
    searchPlaces(q, { signal: ctrl.signal }).then((list) => {
      clear(results);
      if (!list.length) return;
      results.appendChild(el('div', { class: 'place-group-label' }, 'Search results'));
      for (const r of list) results.appendChild(optButton(r));
    }).catch((err) => {
      if (err.name === 'AbortError') return;
      clear(results);
      results.appendChild(el('div', { class: 'place-group-label' }, 'Search unavailable — type it in'));
    });
  }

  const show = () => { panel.style.display = ''; };
  const hide = () => { panel.style.display = 'none'; };

  input.addEventListener('focus', () => { drawQuick(input.value); show(); });
  input.addEventListener('blur', () => setTimeout(hide, 200));
  input.addEventListener('input', () => {
    const v = input.value;
    onChange('restaurantName', v);
    gmap.href = googleMapsSearchUrl(v);
    drawQuick(v);
    show();
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(v), 350);
  });

  drawQuick('');
  box.append(input, gmap, panel);
  return box;
}

function sliderControl(field, bowl, onChange) {
  const box = el('div', { class: 'slider-box' });
  const top = el('div', { class: 'slider-top' }, [
    el('span', { class: 'slider-name' }, field.label),
    el('span', { class: 'slider-value mono', id: `v-${field.id}` }, fmtNum(bowl[field.id] ?? field.min)),
  ]);
  const range = el('input', {
    type: 'range', class: 'slider', id: `f-${field.id}`,
    min: field.min, max: field.max, step: field.step, value: bowl[field.id] ?? field.min,
    dataset: { field: field.id },
  });
  range.addEventListener('input', () => {
    document.getElementById(`v-${field.id}`).textContent = fmtNum(Number(range.value));
    onChange(field.id, Number(range.value));
  });
  const ends = el('div', { class: 'slider-ends' }, [
    el('span', {}, field.left), el('span', {}, `${field.min}–${field.max}`), el('span', {}, field.right),
  ]);
  box.appendChild(top); box.appendChild(range); box.appendChild(ends);
  return box;
}

function multiselectControl(field, bowl, onChange) {
  const box = el('div', { class: 'chips' });
  const selected = new Set(bowl[field.id] || []);
  for (const opt of field.options) {
    const chip = el('button', {
      type: 'button', class: 'chip' + (selected.has(opt.value) ? ' on' : ''), dataset: { v: opt.value },
    }, opt.label);
    chip.addEventListener('click', () => {
      if (selected.has(opt.value)) { selected.delete(opt.value); chip.classList.remove('on'); }
      else { selected.add(opt.value); chip.classList.add('on'); }
      onChange(field.id, [...selected]);
    });
    box.appendChild(chip);
  }
  const container = el('div', {}, [box]);
  if (field.allowOther) {
    const other = el('input', { class: 'input input-other', placeholder: 'Other (free text)', dataset: { field: field.id + 'Other' } });
    other.value = bowl[field.id + 'Other'] || '';
    other.addEventListener('input', () => onChange(field.id + 'Other', other.value));
    container.appendChild(other);
  }
  return container;
}

function enumControl(field, bowl, onChange) {
  const box = el('div', { class: 'segmented' });
  const set = (v) => { bowl[field.id] = v; for (const b of box.children) b.classList.toggle('on', b.dataset.v === v); onChange(field.id, v); };
  for (const opt of field.options) {
    const b = el('button', { type: 'button', class: 'seg' + (bowl[field.id] === opt.value ? ' on' : ''), dataset: { v: opt.value } }, opt.label);
    b.addEventListener('click', () => set(opt.value));
    box.appendChild(b);
  }
  return box;
}

function repeaterControl(field, bowl, onChange) {
  const box = el('div', { class: 'repeater' });
  const list = el('div', { class: 'repeater-list' });
  bowl[field.id] = bowl[field.id] || [];

  function draw() {
    clear(list);
    bowl[field.id].forEach((item, i) => {
      const row = el('div', { class: 'repeater-row' });
      const name = el('input', { class: 'input', placeholder: 'Spice name' });
      name.value = item.name || '';
      name.addEventListener('input', () => { item.name = name.value; onChange(field.id, bowl[field.id]); });
      const rng = el('input', { type: 'range', class: 'slider slider-sm', min: 0, max: 10, step: 0.5, value: item.intensity || 0 });
      const val = el('span', { class: 'slider-value mono' }, fmtNum(item.intensity || 0));
      rng.addEventListener('input', () => { item.intensity = Number(rng.value); val.textContent = fmtNum(item.intensity); onChange(field.id, bowl[field.id]); });
      const rm = el('button', { type: 'button', class: 'btn-ghost', title: 'Remove', onclick: () => { bowl[field.id].splice(i, 1); draw(); onChange(field.id, bowl[field.id]); } }, '×');
      row.append(name, rng, val, rm);
      list.appendChild(row);
    });
  }
  draw();
  const add = el('button', { type: 'button', class: 'btn-ghost', onclick: () => { bowl[field.id].push({ name: '', intensity: 0 }); draw(); onChange(field.id, bowl[field.id]); } }, '+ Add spice');
  box.append(list, add);
  return box;
}
