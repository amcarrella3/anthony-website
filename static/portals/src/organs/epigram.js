// organs/epigram.js — knowledge-feed organ, EPIGRAM mode.
// A single line from Anthony's Thymer field, suspended, slowly phasing.
//
// Organ contract: mount(slotEl) · start() · stop(). Knows nothing of siblings.

export function createEpigram(slot) {
  const source = slot.feed.source;
  let el, lines = [], i = 0, timer = null, reduced = false;

  async function load() {
    const data = await (await fetch(source)).json();
    lines = (data.lines ?? []).filter(Boolean);
  }

  function mount(parent) {
    el = document.createElement('div');
    el.className = 'epigram';
    el.setAttribute('role', 'presentation');
    parent.appendChild(el);
  }

  // one breath: rise → hold → fall → swap → repeat
  function breathe() {
    el.textContent = lines[i];
    requestAnimationFrame(() => el.classList.add('is-present'));
    const HOLD = reduced ? 9000 : 7000;
    const FALL = reduced ? 900  : 3200;
    timer = setTimeout(() => {
      el.classList.remove('is-present');
      timer = setTimeout(() => { i = (i + 1) % lines.length; breathe(); }, FALL);
    }, HOLD);
  }

  async function start() {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!lines.length) await load();
    if (lines.length) breathe();
  }
  function stop() { clearTimeout(timer); }

  return { mount, start, stop };
}
