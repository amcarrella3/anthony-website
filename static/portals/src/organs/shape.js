// organs/shape.js — a vector shape Anthony drew: rect, ellipse, or freeform.
// Fills its piece box (preserveAspectRatio none), filled with the piece's color.
// piece.shapeDef = { kind:'rect'|'ellipse'|'freeform', d?, stroke?, strokeWidth? }

const NS = 'http://www.w3.org/2000/svg';

export function createShape(piece) {
  let svg;

  function mount(parent) {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'media media--shape');
    svg.setAttribute('viewBox', '0 0 1000 1000');
    svg.setAttribute('preserveAspectRatio', 'none');
    parent.appendChild(svg);
    render();
  }

  function render() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const def = piece.shapeDef || { kind: 'rect' };
    const fill = (piece.style && piece.style.background) || '#c9a5d8';
    let el;
    if (def.kind === 'ellipse') {
      el = document.createElementNS(NS, 'ellipse');
      el.setAttribute('cx', '500'); el.setAttribute('cy', '500');
      el.setAttribute('rx', '500'); el.setAttribute('ry', '500');
    } else if (def.kind === 'freeform') {
      el = document.createElementNS(NS, 'path');
      el.setAttribute('d', def.d || 'M0 0');
    } else {
      el = document.createElementNS(NS, 'rect');
      el.setAttribute('x', '0'); el.setAttribute('y', '0');
      el.setAttribute('width', '1000'); el.setAttribute('height', '1000');
    }
    el.setAttribute('fill', fill);
    if (def.stroke && def.strokeWidth) {
      el.setAttribute('stroke', def.stroke);
      el.setAttribute('stroke-width', String(def.strokeWidth));
    }
    svg.appendChild(el);
  }

  return { mount, start() {}, stop() {}, render };
}
