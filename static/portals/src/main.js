// main.js — the composition layer + tool runtime.
// Reads the manifest, composes PIECES onto the board (membrane or bare board),
// applies palette + masks + layer order, and wires the editor. The manifest is
// mutable: the editor edits it in place, then persists.

import { renderers } from './renderers.js';
import { applyPlace, applyMedia, applyShadow, applyTextStyle, applyMotion, clamp } from './util.js';
import { applyShape, loadShape } from './shapes.js';
import { initPresent } from './present.js';
import { initEditor } from './editor/editor.js';

const field = document.getElementById('field');
const stage = document.createElement('div');
stage.className = 'stage';
field.appendChild(stage);

// ── which project (living portal) are we in? ───────────────────────────────
// share mode: a locked, view-only run configured via the URL. A static VIEWER
// build (window.__COSMOS_VIEWER__) forces it on so a public deploy is watch-only
// and needs none of the server.
const params = new URLSearchParams(location.search);
const shared = params.get('share') === '1' || window.__COSMOS_VIEWER__ === true;
let projIndex = { projects: [], current: null };
let publishBase = '';
if (!shared) {
  try { projIndex = await (await fetch('/api/projects')).json(); } catch (_) {}
  try { publishBase = (await (await fetch('./data/publish.json')).json()).base || ''; } catch (_) {}
}
const projectId = params.get('project') || projIndex.current || (projIndex.projects[0] && projIndex.projects[0].id) || 'cosmology';
let manifest;
try { manifest = await (await fetch(`./data/projects/${projectId}.json?t=${Date.now()}`)).json(); }
catch (_) { manifest = await (await fetch('./data/portal.json')).json(); }   // legacy fallback

// ── back-compat: pieces (fallback to legacy `slots`), stamp defaults ────────
manifest.pieces = manifest.pieces || manifest.slots || [];
delete manifest.slots;
manifest.pieces.forEach((p, i) => {
  if (p.z == null) p.z = i;
  p.place = p.place || {};
  if (p.place.rotationDeg == null) p.place.rotationDeg = 0;
  if (p.fit == null) p.fit = 'cover';
});

function applyPalette() {
  const p = manifest.palette || {};
  const root = document.documentElement;
  if (p.paper) root.style.setProperty('--paper', p.paper);
  if (p.ink)   root.style.setProperty('--ink', p.ink);
}
// Paper = the palette color, OR an uploaded background image over it.
function applyBackground() {
  const img = manifest.paperImage;
  if (img) {
    document.body.style.backgroundImage = `url("./${String(img).replace(/^\//, '')}")`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  } else {
    document.body.style.backgroundImage = '';
  }
}
applyPalette();
applyBackground();

// ── the board: membrane (his line) OR bare board mode ───────────────────────
if (manifest.membrane && manifest.membrane.svg) {
  const svgText = await (await fetch('./' + manifest.membrane.svg)).text();
  stage.insertAdjacentHTML('afterbegin', svgText);
  const frame = stage.querySelector('svg');
  frame.classList.add('portal-frame');
  frame.removeAttribute('width');
  frame.removeAttribute('height');
} else {
  stage.classList.add('board-mode');
}

let organs = [];

function compose() {
  for (const o of organs) { try { o.stop && o.stop(); } catch (_) {} }
  organs = [];
  stage.querySelectorAll('.slot').forEach((n) => n.remove());

  const ordered = [...manifest.pieces].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const piece of ordered) {
    const el = document.createElement('div');
    el.className = 'slot piece';
    el.dataset.slot = piece.id;
    if (!piece.shape && piece.place && piece.place.heightPct != null) el.classList.add('slot--wireframe');
    applyPlace(el, piece.place);
    el.style.zIndex = String(piece.z || 0);
    if (piece.shadow) applyShadow(el, piece.shadow);

    // Content wrapper: the mask (clip-path) + fill live HERE, so the editor's
    // resize/rotate handles — siblings on .slot — are never clipped away by the
    // mask and stay grabbable on a masked piece.
    const content = document.createElement('div');
    content.className = 'slot__content';
    content.style.setProperty('--fit', piece.fit || 'cover');
    if (piece.feed.type !== 'shape' && piece.style && piece.style.background) content.style.background = piece.style.background;
    el.appendChild(content);
    stage.appendChild(el);

    if (piece.shape) { content.style.visibility = 'hidden'; applyShape(content, piece.shape); }

    const make = renderers[piece.feed.type];
    if (make) {
      const organ = make(piece);
      organ.mount(content);
      organ.start();
      organs.push(organ);
      if (piece.media) { const m = content.querySelector('.media'); if (m) applyMedia(m, piece.media); }
      applyTextStyle(content, piece.textStyle);
      if (piece.motion) applyMotion(content, piece.motion);
    } else if (!(piece.feed.type in renderers)) {
      console.warn('No renderer for feed type:', piece.feed.type);
    }
  }
}

let idc = 0;
function addPiece(partial) {
  const z = maxZ() + 1;
  const piece = Object.assign(
    {
      id: 'p' + Math.floor(performance.now()).toString(36) + (idc++),
      feed: { type: 'color', source: '' },
      place: { leftPct: 50, topPct: 50, widthPct: 26, heightPct: 20, rotationDeg: 0 },
      shape: null, fit: 'cover', z, style: {},
    },
    partial || {},
  );
  piece.place = piece.place || {};
  if (piece.place.rotationDeg == null) piece.place.rotationDeg = 0;
  if (piece.z == null) piece.z = z;
  manifest.pieces.push(piece);
  compose();
  return piece;
}
const maxZ = () => manifest.pieces.reduce((m, p) => Math.max(m, p.z || 0), 0);
const minZ = () => manifest.pieces.reduce((m, p) => Math.min(m, p.z || 0), 0);

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await fetch('/api/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-project-id': projectId },
        body: JSON.stringify(manifest),
      });
      window.dispatchEvent(new CustomEvent('cosmos:saved'));
    } catch (e) { console.warn('save failed', e); }
  }, 350);
}

// preload masks so clips + aspect ratios are ready before the first paint
await Promise.all([...new Set(manifest.pieces.map((p) => p.shape).filter(Boolean))]
  .map((s) => loadShape(s).catch(() => {})));

// ── canvas zoom + pan (viewport state — not saved to the composition) ──────
const view = { zoom: 1, panX: 0, panY: 0 };
function applyZoom() {
  stage.style.transformOrigin = 'center center';
  stage.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
  window.dispatchEvent(new CustomEvent('cosmos:zoom', { detail: view.zoom }));
}
const zoom = {
  by: (f) => { view.zoom = clamp(view.zoom * f, 0.2, 6); applyZoom(); return view.zoom; },
  reset: () => { view.zoom = 1; view.panX = 0; view.panY = 0; applyZoom(); },
  set: (v) => { if (!v) return; view.zoom = clamp(v.zoom != null ? v.zoom : view.zoom, 0.2, 6); if (v.panX != null) view.panX = v.panX; if (v.panY != null) view.panY = v.panY; applyZoom(); },
  get: () => view.zoom,
  state: () => ({ zoom: view.zoom, panX: view.panX, panY: view.panY }),
};
const notTyping = (t) => !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
field.addEventListener('wheel', (e) => {
  if (shared) return;                                             // locked: no zoom/pan for viewers
  if (e.ctrlKey || e.metaKey) {                                   // pinch / ctrl-wheel → zoom
    e.preventDefault();
    view.zoom = clamp(view.zoom * Math.exp(-e.deltaY * 0.0015), 0.2, 6);
    applyZoom();
  } else if (!(e.target.closest && e.target.closest('.viewport'))) { // wheel → pan (unless over a scrollable feed)
    e.preventDefault();
    view.panX -= e.deltaX; view.panY -= e.deltaY;
    applyZoom();
  }
}, { passive: false });
let spaceDown = false;
window.addEventListener('keydown', (e) => {
  if (shared || !notTyping(e.target)) return;
  if (e.code === 'Space') { spaceDown = true; field.style.cursor = 'grab'; }
  else if (e.key === '0') { zoom.reset(); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; field.style.cursor = ''; } });
field.addEventListener('pointerdown', (e) => {                     // space-drag → pan (beats piece drag via capture)
  if (shared || !spaceDown) return;
  e.preventDefault(); e.stopPropagation();
  const sx = e.clientX, sy = e.clientY, px = view.panX, py = view.panY;
  const move = (ev) => { view.panX = px + (ev.clientX - sx); view.panY = py + (ev.clientY - sy); applyZoom(); };
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}, true);

const present = initPresent({ field, manifest, save });

compose();
const project = { id: projectId, list: projIndex.projects || [], current: projIndex.current, publishBase };

if (shared) {
  // configured, view-only: apply the frame + shot from the URL and enter present.
  // No editor is ever created, so nothing here can be manipulated or saved.
  document.body.classList.add('is-shared');
  const fr = params.get('frame');
  if (fr) manifest.frame = Object.assign({}, manifest.frame, { aspect: fr });
  const z = parseFloat(params.get('z')), px = parseFloat(params.get('px')), py = parseFloat(params.get('py'));
  zoom.set({ zoom: isFinite(z) ? z : 1, panX: isFinite(px) ? px : 0, panY: isFinite(py) ? py : 0 });
  present.enter();
} else {
  initEditor({ stage, manifest, applyPlace, applyMedia, applyShadow, applyTextStyle, applyMotion, applyPalette, applyBackground, zoom, present, project, recompose: compose, save, addPiece, maxZ, minZ });
}

window.__cosmos = { manifest, compose, save, applyPalette, applyBackground, addPiece, zoom, present, project, shared };
