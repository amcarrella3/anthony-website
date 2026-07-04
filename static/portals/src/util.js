// util.js — tiny shared helpers for the composition layer.

// Place a piece within the board, in % of the stage. Position + rotation only.
export function applyPlace(el, place = {}) {
  const { leftPct = 50, topPct = 50, widthPct, heightPct, rotationDeg = 0 } = place;
  el.style.position = 'absolute';
  el.style.left = leftPct + '%';
  el.style.top = topPct + '%';
  el.style.transformOrigin = 'center';
  el.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`;
  if (widthPct != null) el.style.width = widthPct + '%';
  if (heightPct != null) el.style.height = heightPct + '%';
}

// Map a client point to leftPct/topPct against the stage rect (drag + drop share this).
export function dropToPct(clientX, clientY, rect) {
  return {
    leftPct: clamp((clientX - rect.left) / rect.width * 100, 2, 98),
    topPct: clamp((clientY - rect.top) / rect.height * 100, 2, 98),
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Universal drop shadow on a piece (follows its clip shape; works for any
// content — photo, video, drawing, shape, text, Thymer feed). Applied to .slot
// (the unclipped parent) so the shadow is cast by the visible/clipped shape.
export function applyShadow(el, shadow) {
  if (!el) return;
  if (!shadow) { el.style.filter = ''; return; }
  const x = shadow.x != null ? shadow.x : 4;
  const y = shadow.y != null ? shadow.y : 8;
  const blur = shadow.blur != null ? shadow.blur : 16;
  const op = shadow.opacity != null ? shadow.opacity : 0.3;
  el.style.filter = `drop-shadow(${x}px ${y}px ${blur}px ${hexToRgba(shadow.color || '#000000', op)})`;
}
function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return `rgba(0,0,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Per-piece motion preset (applied to the content layer so it never fights the
// slot's placement transform). Organic, looping — breath and tide, not interface.
export function applyMotion(el, motion) {
  if (!el) return;
  el.style.animation = '';
  el.style.removeProperty('--m-scale');
  el.style.removeProperty('--m-dist');
  el.style.removeProperty('--m-deg');
  const m = motion || {};
  const type = m.type || 'none';
  if (type === 'none') return;
  const speed = m.speed != null ? m.speed : 1;
  const amount = m.amount != null ? m.amount : 1;
  const base = { breathe: 6, drift: 16, sway: 5, spin: 22, fade: 1.6 };
  const dur = (base[type] || 8) / speed;
  if (type === 'breathe') { el.style.setProperty('--m-scale', String(1 + 0.05 * amount)); el.style.animation = `m-breathe ${dur}s ease-in-out infinite`; }
  else if (type === 'drift') { el.style.setProperty('--m-dist', (10 * amount) + 'px'); el.style.animation = `m-drift ${dur}s ease-in-out infinite`; }
  else if (type === 'sway') { el.style.setProperty('--m-deg', (3 * amount) + 'deg'); el.style.animation = `m-sway ${dur}s ease-in-out infinite`; }
  else if (type === 'spin') { el.style.animation = `m-spin ${dur}s linear infinite`; }
  else if (type === 'fade') { el.style.animation = `m-fade ${dur}s ease-out 1`; }
}

// Typography for a text/data piece — font, color, alignment, size scale.
// Applied to the content element; text organs (text-block, epigram, viewport)
// inherit font/color/align, and use --text-scale to scale their sizes.
export function applyTextStyle(el, ts) {
  if (!el) return;
  const t = ts || {};
  el.style.fontFamily = t.font || '';
  el.style.color = t.color || '';
  el.style.textAlign = t.align || '';
  el.style.setProperty('--text-scale', t.size != null ? String(t.size) : '1');
}

// Reframe a media element within its (masked) box: which part shows + zoom.
export function applyMedia(el, media) {
  if (!el) return;
  const m = media || {};
  const posX = m.posX != null ? m.posX : 50;
  const posY = m.posY != null ? m.posY : 50;
  const zoom = m.zoom != null ? m.zoom : 1;
  el.style.objectPosition = posX + '% ' + posY + '%';
  el.style.transform = zoom !== 1 ? 'scale(' + zoom + ')' : '';
  el.style.transformOrigin = posX + '% ' + posY + '%';
}
