// organs/text.js — a rich-text piece. Anthony types into it; typography
// (font / color / align / size) is applied at the content level via textStyle.
// The editor toggles contentEditable on double-click and commits on blur.

export function createText(piece) {
  let el;
  function mount(parent) {
    el = document.createElement('div');
    el.className = 'text-block';
    el.textContent = piece.text != null ? piece.text : '';
    parent.appendChild(el);
  }
  return { mount, start() {}, stop() {} };
}
