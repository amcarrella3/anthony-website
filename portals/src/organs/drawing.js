// organs/drawing.js — Anthony's brush strokes, rendered as SVG (his hand, live).
// A drawing piece holds `piece.strokes = [{ d, color, width, cap, opacity, fill }]`
// in a 0..1000 box space (preserveAspectRatio none → fills the piece). The editor
// captures strokes; this organ paints whatever is persisted.

const NS = 'http://www.w3.org/2000/svg';

export function createDrawing(piece) {
  let svg;

  function mount(parent) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'media media--drawing');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    parent.appendChild(svg);
    render();
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    for (const s of (piece.strokes || [])) svg.appendChild(strokeEl(s));
  }

  function strokeEl(s) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', s.d);
    p.setAttribute('fill', s.fill || 'none');
    p.setAttribute('stroke', s.color || '#171310');
    p.setAttribute('stroke-width', String(s.width || 6));
    p.setAttribute('stroke-linecap', s.cap || 'round');
    p.setAttribute('stroke-linejoin', 'round');
    if (s.opacity != null) p.setAttribute('stroke-opacity', String(s.opacity));
    return p;
  }

  return { mount, start() {}, stop() {}, render };
}
