// organs/image.js — a photograph (Anthony's lens) filling its slot.
// Masking + color are handled at the slot level, so this just places the image.

export function createImage(slot) {
  let el;
  function mount(parent) {
    el = document.createElement('img');
    el.className = 'media media--image';
    el.alt = '';
    el.decoding = 'async';
    parent.appendChild(el);
  }
  function start() {
    el.src = './' + String(slot.feed.source || '').replace(/^\//, '');
  }
  function stop() {}
  return { mount, start, stop };
}
