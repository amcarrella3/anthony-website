// organs/thymer-viewport.js — a window INTO Thymer.
// Renders a Thymer collection as a scrollable, clickable list living inside a
// slot. This is the "see inside Thymer" organ: real records, browsable in place.
// Click a record to reveal its detail. (Next: open the live record in Thymer.)
//
// Organ contract: mount(slotEl) · start() · stop().

export function createThymerViewport(slot) {
  const source = slot.feed.source;
  let root, data;

  async function load() {
    data = await (await fetch(source)).json();
  }

  function mount(parent) {
    root = document.createElement('div');
    root.className = 'viewport';
    parent.appendChild(root);
  }

  function render() {
    const head = document.createElement('div');
    head.className = 'viewport__head';
    head.textContent = `${data.collection} · ${data.records.length}`;

    const list = document.createElement('div');
    list.className = 'viewport__list';

    for (const r of data.records) {
      const row = document.createElement('button');
      row.className = 'viewport__row';
      row.type = 'button';
      row.dataset.guid = r.guid;               // for the future "open in Thymer"

      const title = document.createElement('span');
      title.className = 'viewport__title';
      title.textContent = r.title || 'Untitled';

      const detail = document.createElement('span');
      detail.className = 'viewport__detail';
      detail.textContent = r.kind ? r.kind : 'Note';

      row.append(title, detail);
      row.addEventListener('click', () => row.classList.toggle('is-open'));
      list.appendChild(row);
    }

    root.append(head, list);
  }

  async function start() { if (!data) await load(); render(); }
  function stop() {}

  return { mount, start, stop };
}
