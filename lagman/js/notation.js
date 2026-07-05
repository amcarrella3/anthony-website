// notation.js — the molecular notation signature, derived from axis values.
//
// Produces two twins from the same tokens:
//   .html  — true typographic subscripts (<sub>), decimals like 8.5 render clean
//   .plain — ASCII, e.g. Lg10(U95-Sp8.5-Cu9·SA4·BP3-...) for copy / CSV / Thymer
//
// Grammar: Lg{bowl#}( group - group - ... ) with sub-tokens joined by '·'.
// Zero-value spices are omitted. Categorical axes render as Token:code[,code].

import { NOTATION_GROUPS, getField } from './schema.js';
import { fmtNum, esc } from './util.js';

function tokenValue(field, bowl) {
  const raw = bowl[field.id];
  const n = field.notation || {};

  if (n.codes) { // multiselect -> Token:code,code
    const codes = (raw || []).map((v) => {
      const opt = (field.options || []).find((o) => o.value === v);
      return opt?.code || v;
    });
    const other = bowl[field.id + 'Other'];
    if (other) codes.push('oth');
    if (!codes.length) return null;
    return { token: n.token, colon: codes.join(',') };
  }

  if (n.ordinal) { // enum -> subscript of its ord
    const opt = (field.options || []).find((o) => o.value === raw);
    if (!opt) return null;
    return { token: n.token, sub: fmtNum(opt.ord) };
  }

  if (n.count) { // integer count
    return { token: n.token, sub: fmtNum(raw || 0) };
  }

  // slider / numeric axis
  const val = Number(raw);
  if (Number.isNaN(val)) return null;
  return { token: n.token, sub: fmtNum(val) };
}

function repeaterTokens(field, bowl) {
  // other spices: each becomes Xx{intensity}, code = first two letters of name.
  const out = [];
  for (const item of bowl[field.id] || []) {
    if (!item || !item.name) continue;
    const code = item.name.trim().slice(0, 2);
    const tok = code.charAt(0).toUpperCase() + code.slice(1).toLowerCase();
    out.push({ token: tok, sub: fmtNum(item.intensity || 0), zero: !Number(item.intensity) });
  }
  return out;
}

function renderTok(t, mode) {
  if (t.colon != null) {
    return mode === 'html' ? `${esc(t.token)}:${esc(t.colon)}` : `${t.token}:${t.colon}`;
  }
  if (mode === 'html') return `${esc(t.token)}<sub>${esc(t.sub)}</sub>`;
  return `${t.token}${t.sub}`;
}

export function buildNotation(bowl) {
  const groupStrs = { html: [], plain: [] };

  for (const g of NOTATION_GROUPS) {
    const toks = [];
    for (const fid of g.tokens) {
      const field = getField(fid);
      if (!field) continue;
      if (field.notation?.repeater) {
        for (const t of repeaterTokens(field, bowl)) {
          if (g.omitZero && t.zero) continue;
          toks.push(t);
        }
        continue;
      }
      const t = tokenValue(field, bowl);
      if (!t) continue;
      if (g.omitZero && t.sub != null && Number(t.sub) === 0) continue;
      toks.push(t);
    }
    if (!toks.length) continue;
    const inner = g.inner || '';
    groupStrs.html.push(toks.map((t) => renderTok(t, 'html')).join(inner));
    groupStrs.plain.push(toks.map((t) => renderTok(t, 'plain')).join(inner));
  }

  const n = bowl.bowlNumber || 0;
  const html = `Lg<sub>${esc(fmtNum(n))}</sub>(${groupStrs.html.join('-')})`;
  const plain = `Lg${fmtNum(n)}(${groupStrs.plain.join('-')})`;
  return { html, plain };
}

// Legend / key: every token explained, in group order.
export function notationLegend() {
  const rows = [];
  rows.push({ token: 'Lgₙ', meaning: 'Lagman, subscript = bowl number' });
  const seen = new Set();
  for (const g of NOTATION_GROUPS) {
    for (const fid of g.tokens) {
      const field = getField(fid);
      if (!field || !field.notation) continue;
      if (field.notation.repeater) {
        rows.push({ token: 'Xxₙ', meaning: 'Other spice (first two letters) + intensity 0–10' });
        continue;
      }
      const tk = field.notation.token;
      if (seen.has(tk)) continue;
      seen.add(tk);
      let meaning = field.label;
      if (field.type === 'slider') meaning += ` (${field.left} → ${field.right}, 0–${field.max})`;
      else if (field.notation.ordinal) meaning += ' (None/Light/Base/Heavy → 0/3/7/10)';
      else if (field.notation.codes) meaning += ' (codes: ' + (field.options || []).map((o) => o.code).filter(Boolean).join(', ') + (field.allowOther ? ', oth' : '') + ')';
      else if (field.notation.count) meaning += ' (count of types)';
      rows.push({ token: tk, meaning });
    }
  }
  return rows;
}
