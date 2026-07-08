// app.js — The Daily Brief renderer.
// Loads a brief JSON document and renders its `sections` array by dispatching
// each section's `kind` to a matching renderer below. The document shape is
// defined in brief/schema/brief.schema.json. To add a new kind of section,
// add a renderer to RENDERERS with the same key — no other change needed.

const view = () => document.getElementById('view');
const DATA = './data';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function fmtDate(iso) {
  // iso = YYYY-MM-DD → "Wednesday, July 8, 2026" without timezone drift.
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/* ---------------- section renderers ---------------- */

const sourceLine = (item) => {
  const s = item.source;
  if (!s || (!s.name && !s.url)) return '';
  const conf = s.confidence && s.confidence !== 'confirmed'
    ? `<span class="badge ${esc(s.confidence)}">${esc(s.confidence)}</span>` : '';
  const link = s.url
    ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name || s.url)} ↗</a>`
    : `<span class="srcname">${esc(s.name)}</span>`;
  const date = s.date ? `<span class="srcname">${esc(s.date)}</span>` : '';
  return `<div class="src">${link}${date}${conf}</div>`;
};

const imageBlock = (item) => {
  if (!item.image || !item.image.url) return '';
  return `<figure><img src="${esc(item.image.url)}" alt="${esc(item.image.alt || '')}" loading="lazy" />` +
    (item.image.credit ? `<figcaption>${esc(item.image.credit)}</figcaption>` : '') + `</figure>`;
};

const card = (item) => `
  <article class="card">
    ${item.lens ? `<div class="lens">${esc(item.lens)}</div>` : ''}
    <h3>${esc(item.headline)}</h3>
    ${item.body ? `<p class="body">${esc(item.body)}</p>` : ''}
    ${imageBlock(item)}
    ${item.why ? `<p class="why">${esc(item.why)}</p>` : ''}
    ${sourceLine(item)}
  </article>`;

const secHead = (sec) => `
  <div class="sec-head">
    ${sec.glyph ? `<span class="sec-glyph">${esc(sec.glyph)}</span>` : ''}
    <span class="sec-title">${esc(sec.title || '')}</span>
    ${sec.eyebrow ? `<span class="sec-eyebrow">${esc(sec.eyebrow)}</span>` : ''}
  </div>`;

const RENDERERS = {
  masthead: (sec, doc) => `
    <header class="masthead">
      <div class="kicker">${esc(sec.title || 'The Daily Brief')}</div>
      <h1>${esc(doc.title || 'The Daily Brief')}</h1>
      <div class="date-line">${esc(fmtDate(doc.date))}</div>
      ${doc.readMinutes ? `<div class="readtime">${esc(doc.readMinutes)} min read · ${esc((doc.meta && doc.meta.sourcesConsulted) || '—')} sources scanned</div>` : ''}
      <div class="meander breathe"></div>
    </header>`,

  headline: (sec) => `
    <section class="headline section">
      <div class="sec-eyebrow">${esc(sec.title || 'Today, in one line')}</div>
      <p>${esc(sec.text || '')}</p>
    </section>`,

  agenda: (sec) => `
    <section class="section agenda" data-accent="verdigris">
      ${secHead(sec)}
      <span class="private-note">private · your calendar & inbox — not published publicly</span>
      <div class="items">
        <div class="card">
          ${(sec.items || []).map((it) => `
            <div class="agenda-row">
              <span class="when">${esc(it.lens || '')}</span>
              <span>${esc(it.headline)}${it.body ? ` — <span class="body">${esc(it.body)}</span>` : ''}</span>
            </div>`).join('')}
        </div>
      </div>
    </section>`,

  module: (sec) => `
    <section class="section" data-accent="${esc(sec.accent || 'ember')}" id="mod-${esc(sec.id || '')}">
      ${secHead(sec)}
      ${sec.summary ? `<p class="sec-summary">${esc(sec.summary)}</p>` : ''}
      <div class="items">${(sec.items || []).map(card).join('') || emptyItems()}</div>
    </section>`,

  serendipity: (sec) => `
    <section class="section serendipity" data-accent="${esc(sec.accent || 'ichor')}">
      ${secHead(sec)}
      <div class="items">${(sec.items || []).map(card).join('') || emptyItems()}</div>
    </section>`,

  radar: (sec) => `
    <section class="section radar" data-accent="bronze">
      ${secHead(sec)}
      ${sec.summary ? `<p class="sec-summary">${esc(sec.summary)}</p>` : ''}
      <div class="items">${(sec.items || []).map(card).join('') || emptyItems()}</div>
    </section>`,

  on_this_day: (sec) => `
    <section class="section on_this_day" data-accent="bronze">
      ${secHead(sec)}
      <div class="items">${(sec.items || []).map(card).join('') || emptyItems()}</div>
    </section>`,

  epigram: (sec) => `
    <section class="epigram section">
      <blockquote>${esc(sec.text || '')}</blockquote>
      ${sec.attribution ? `<div class="attr">${esc(sec.attribution)}</div>` : ''}
    </section>`,
};

const emptyItems = () => `<article class="card"><p class="body">Nothing surfaced here today.</p></article>`;

/* ---------------- shell ---------------- */

function renderBrief(doc) {
  // Public web artifact hides sections marked visibility:"private".
  const sections = (doc.sections || []).filter((s) => s.visibility !== 'private');
  const html = sections.map((sec) => {
    const r = RENDERERS[sec.kind];
    return r ? r(sec, doc) : '';
  }).join('');

  const banner = doc.meta && doc.meta.scaffold
    ? `<div class="scaffold-banner"><b>Scaffold preview.</b> ${esc(doc.meta.notes || 'This is the seeded example so you can see the shape. The morning routine replaces it with a real brief.')}</div>`
    : '';

  view().innerHTML = banner + html;

  const foot = document.getElementById('foot-meta');
  if (foot) foot.textContent = `${doc.date} · ${(doc.meta && doc.meta.generator) || 'daily-brief'}`;
  document.title = `The Daily Brief — ${fmtDate(doc.date)}`;
}

let INDEX = { briefs: [] };
let current = null;

async function loadDate(date) {
  view().innerHTML = `<div class="loading">assembling…</div>`;
  try {
    const doc = await getJSON(`${DATA}/${date}.json`);
    current = date;
    syncSelect(date);
    renderBrief(doc);
    window.scrollTo(0, 0);
  } catch (err) {
    view().innerHTML = `<div class="empty"><p class="empty-title">No brief for that day.</p><p class="mono">${esc(err.message)}</p></div>`;
  }
}

function syncSelect(date) {
  const sel = document.getElementById('date-select');
  if (sel && sel.value !== date) sel.value = date;
  const dates = INDEX.briefs.map((b) => b.date);
  const i = dates.indexOf(date);
  document.getElementById('prev-day').disabled = i >= dates.length - 1;
  document.getElementById('next-day').disabled = i <= 0;
}

function step(delta) {
  const dates = INDEX.briefs.map((b) => b.date); // newest-first
  const i = dates.indexOf(current);
  const j = i + delta;
  if (j >= 0 && j < dates.length) loadDate(dates[j]);
}

async function boot() {
  // The index lists available briefs, newest first. latest.json mirrors the top.
  try {
    INDEX = await getJSON(`${DATA}/index.json`);
  } catch { INDEX = { briefs: [] }; }

  const sel = document.getElementById('date-select');
  if (sel) {
    sel.innerHTML = INDEX.briefs.map((b) =>
      `<option value="${esc(b.date)}">${esc(fmtDate(b.date))}${b.label ? ' · ' + esc(b.label) : ''}</option>`
    ).join('');
  }

  document.getElementById('prev-day').addEventListener('click', () => step(+1)); // older
  document.getElementById('next-day').addEventListener('click', () => step(-1)); // newer
  document.getElementById('print-btn').addEventListener('click', () => window.print());
  sel && sel.addEventListener('change', (e) => loadDate(e.target.value));

  // Deep link via ?date=YYYY-MM-DD, else newest.
  const wanted = new URLSearchParams(location.search).get('date');
  const start = (wanted && INDEX.briefs.some((b) => b.date === wanted))
    ? wanted
    : (INDEX.briefs[0] && INDEX.briefs[0].date);

  if (start) loadDate(start);
  else {
    // No index yet — fall back to latest.json directly.
    try { renderBrief(await getJSON(`${DATA}/latest.json`)); }
    catch { view().innerHTML = `<div class="empty"><p class="empty-title">No briefs yet.</p><p class="mono">The morning routine will publish the first one here.</p></div>`; }
  }
}

boot();
