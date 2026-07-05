// app.js — hash router + shell. Views render into <main id="view">.

import { renderArchive } from './views/archive.js';
import { renderForm } from './views/form.js';
import { renderDetail } from './views/detail.js';
import { renderCompare } from './views/compare.js';
import { renderLegend } from './views/legend.js';
import { renderExport } from './views/exporter.js';

const view = () => document.getElementById('view');

export function navigate(hash) {
  if (location.hash === hash) route(); // same hash → force re-render
  else location.hash = hash;
}

const ROUTES = [
  { re: /^#\/(archive)?$/, nav: 'archive', run: (r) => renderArchive(r) },
  { re: /^#\/new$/, nav: 'new', run: (r) => renderForm(r, {}) },
  { re: /^#\/edit\/(.+)$/, nav: null, run: (r, m) => renderForm(r, { id: decodeURIComponent(m[1]) }) },
  { re: /^#\/bowl\/(.+)$/, nav: null, run: (r, m) => renderDetail(r, { id: decodeURIComponent(m[1]) }) },
  { re: /^#\/compare$/, nav: 'compare', run: (r) => renderCompare(r) },
  { re: /^#\/legend$/, nav: null, run: (r) => renderLegend(r) },
  { re: /^#\/export$/, nav: 'export', run: (r) => renderExport(r) },
];

async function route() {
  const hash = location.hash || '#/';
  const root = view();
  const match = ROUTES.find((rt) => rt.re.test(hash));
  // Clear any transient compare FAB between routes.
  document.getElementById('compare-fab')?.remove();
  try {
    if (match) await match.run(root, hash.match(match.re));
    else await renderArchive(root);
    setActiveNav(match?.nav || 'archive');
  } catch (err) {
    root.innerHTML = `<div class="empty"><p class="empty-title">Something went wrong.</p><p class="mono">${String(err && err.message || err)}</p></div>`;
    console.error(err);
  }
  window.scrollTo(0, 0);
}

function setActiveNav(nav) {
  for (const a of document.querySelectorAll('[data-nav]')) a.classList.toggle('active', a.dataset.nav === nav);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
});

// If DOMContentLoaded already fired (module loaded late), route now.
if (document.readyState !== 'loading') route();
