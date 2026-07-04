// shapes.js — the mask system.
// A shape is one of Anthony's drawings, traced + normalized to a 0..1 box
// (assets/shapes/<id>.json = { d, ratio }). Applied as an SVG clip-path it masks
// any element to his line, at any size. `ratio` (native w/h) lets the editor
// aspect-lock a masked piece so his line is never squashed.

const injected = new Set();      // shapeIds whose clipPath is in the DOM
const shapeData = new Map();     // shapeId -> { d, ratio }
let defsEl = null;

function defs() {
  if (defsEl) return defsEl;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'clip-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defsEl = document.createElementNS(NS, 'defs');
  svg.appendChild(defsEl);
  document.body.appendChild(svg);
  return defsEl;
}

export async function loadShape(shapeId) {
  if (shapeData.has(shapeId)) return shapeData.get(shapeId);
  const s = await (await fetch(`./assets/shapes/${shapeId}.json`)).json();
  shapeData.set(shapeId, s);
  return s;
}

// Native aspect (w/h) of an already-loaded shape, or null.
export function getShapeRatioSync(shapeId) {
  const s = shapeData.get(shapeId);
  return s ? (s.ratio ?? null) : null;
}

async function ensureClip(shapeId) {
  const s = await loadShape(shapeId);
  const d = defs();
  if (!injected.has(shapeId)) {
    const NS = 'http://www.w3.org/2000/svg';
    const cp = document.createElementNS(NS, 'clipPath');
    cp.setAttribute('id', `clip-${shapeId}`);
    cp.setAttribute('clipPathUnits', 'objectBoundingBox');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', s.d);
    cp.appendChild(path);
    d.appendChild(cp);
    injected.add(shapeId);
  }
  return `url(#clip-${shapeId})`;
}

// Mask (or unmask) an element with one of Anthony's shapes.
export async function applyShape(el, shapeId) {
  if (!shapeId) { el.style.clipPath = ''; el.style.webkitClipPath = ''; el.style.visibility = ''; return; }
  try {
    const url = await ensureClip(shapeId);
    el.style.clipPath = url;
    el.style.webkitClipPath = url;
  } catch (_) { /* shape missing — leave unclipped rather than invisible */ }
  finally { el.style.visibility = ''; }
}
