// views/settings.js — manage the Anthropic key that powers the AI features.

import { el, clear } from '../util.js';
import { getKey, setKey, hasKey } from '../panel.js';
import { navigate } from '../app.js';

export function renderSettings(root) {
  clear(root);
  root.appendChild(el('div', { class: 'form-header-row' }, [
    el('button', { class: 'btn-ghost', onclick: () => (history.length > 1 ? history.back() : navigate('#/archive')) }, '‹ Back'),
    el('div', { class: 'form-bowl-no' }, 'Settings'),
    el('span', {}, ''),
  ]));
  root.appendChild(el('div', { class: 'rule' }));

  root.appendChild(el('div', { class: 'sec-head' }, [el('span', {}, 'AI · Anthropic key')]));
  root.appendChild(el('p', { class: 'prose' }, 'The panel consultation and “fill from a description” call Claude directly from this browser, using your own Anthropic API key. The key is stored only on this device and sent only to Anthropic — never to any server of ours. Remove it any time.'));

  const input = el('input', { class: 'input', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: hasKey() ? '•••••••••••• (a key is saved)' : 'sk-ant-…' });
  const status = el('div', { class: 'draft-note' }, hasKey() ? 'A key is saved on this device.' : 'No key saved yet.');
  const save = el('button', {
    class: 'btn-primary',
    onclick: () => { if (input.value.trim()) { setKey(input.value); input.value = ''; input.placeholder = '•••••••••••• (a key is saved)'; status.textContent = 'Key saved on this device.'; status.classList.remove('warn'); } },
  }, 'Save key');
  const remove = el('button', {
    class: 'btn-ghost btn-danger-ghost',
    onclick: () => { setKey(''); input.value = ''; input.placeholder = 'sk-ant-…'; status.textContent = 'Key removed.'; },
  }, 'Remove key');

  root.appendChild(el('div', { class: 'field' }, [
    el('label', { class: 'field-label' }, 'API key'),
    el('div', { class: 'input-affix' }, [input, save]),
    el('div', { class: 'btn-row', style: 'margin-top:10px' }, [remove]),
    status,
  ]));
  root.appendChild(el('p', { class: 'prose', style: 'font-size:12.5px' }, 'Create a key at console.anthropic.com → API Keys. A full panel consultation is about eight short calls (Haiku for the bench, one Sonnet chair) — roughly a cent a bowl.'));
}
