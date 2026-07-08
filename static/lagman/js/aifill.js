// aifill.js — "Fill the sheet": one Claude call parses a spoken/typed tasting
// description into the scoring sheet's real fields. The JSON schema is BUILT
// FROM schema.js, so every axis, multiselect, enum and note is fillable — and
// the model is instructed to fill ONLY what the description states or strongly
// implies. Values arrive as editable suggestions; descriptiveName stays derived
// from the final measurements (the naming law is never delegated).

import { allFields } from './schema.js';
import { callStructured } from './panel.js';

// Derived / auto fields the AI must never write.
const EXCLUDE = new Set(['bowlNumber', 'descriptiveName', 'date', 'time']);

export function buildFillSchema() {
  const props = {};
  for (const f of allFields()) {
    if (EXCLUDE.has(f.id)) continue;
    switch (f.type) {
      case 'slider':
        props[f.id] = { type: 'number', minimum: f.min, maximum: f.max, description: `${f.label}: ${f.min} = ${f.left} → ${f.max} = ${f.right}` };
        break;
      case 'number':
        props[f.id] = { type: 'number', description: f.label + (f.prefix === '$' ? ' (dollars)' : '') };
        break;
      case 'enum':
        props[f.id] = { type: 'string', enum: f.options.map((o) => o.value), description: `${f.label}: ${f.options.map((o) => `${o.value} = ${o.label}`).join(', ')}` };
        break;
      case 'multiselect':
        props[f.id] = { type: 'array', items: { type: 'string', enum: f.options.map((o) => o.value) }, description: `${f.label}: ${f.options.map((o) => `${o.value} = ${o.label}`).join(', ')}` };
        if (f.allowOther) props[f.id + 'Other'] = { type: 'string', description: `${f.label} — anything present that is not in the list` };
        break;
      case 'repeater':
        props[f.id] = { type: 'array', description: `${f.label} — spices tasted that are not among the named spice axes`, items: { type: 'object', properties: { name: { type: 'string' }, intensity: { type: 'number', minimum: 0, maximum: 10 } }, required: ['name'] } };
        break;
      case 'text':
      case 'longtext':
        props[f.id] = { type: 'string', description: f.label };
        break;
      default: break;
    }
  }
  return { type: 'object', properties: props };
}

export async function parseDescription(text) {
  const system = 'You convert a taster’s spoken or typed description of a bowl of lagman (Central Asian hand-pulled noodle dish) into the fields of a parametric scoring sheet. Rules: (1) Fill ONLY fields the description explicitly states or strongly implies — OMIT everything unmentioned; never guess. (2) Numeric axes are 0–10 except culturalOrigin, a 0–100 spectrum where 0 = Central Asian source tradition and 100 = Eastern European adaptation. (3) For option fields use the exact option codes given in each field’s description. (4) Put vivid tasting language into the note fields (firstBite, midBowl, finalThoughts) verbatim or lightly cleaned — preserve the taster’s own words. (5) The description may be rambling dictation; read it charitably.';
  const user = `The taster's description:\n"""\n${text}\n"""\n\nReturn only the fields that are stated or strongly implied.`;
  const out = await callStructured({ model: 'sonnet', system, user, schema: buildFillSchema(), max_tokens: 1400 });
  return sanitize(out);
}

// Validate + clamp everything the model returned against the real schema.
function sanitize(out) {
  const values = {};
  const byId = Object.fromEntries(allFields().map((f) => [f.id, f]));
  for (const [k, v] of Object.entries(out || {})) {
    if (v == null || EXCLUDE.has(k)) continue;
    const f = byId[k];
    if (!f) {
      // multiselect free-text companions like meatTypesOther
      const base = byId[k.replace(/Other$/, '')];
      if (base && base.type === 'multiselect' && base.allowOther && typeof v === 'string' && v.trim()) values[k] = v.trim();
      continue;
    }
    switch (f.type) {
      case 'slider': {
        let n = Number(v); if (Number.isNaN(n)) break;
        const step = f.step || 1;
        n = Math.round(Math.max(f.min, Math.min(f.max, n)) / step) * step;
        values[k] = n; break;
      }
      case 'number': { const n = Number(v); if (!Number.isNaN(n)) values[k] = n; break; }
      case 'enum': { if ((f.options || []).some((o) => o.value === v)) values[k] = v; break; }
      case 'multiselect': {
        const arr = (Array.isArray(v) ? v : [v]).filter((x) => (f.options || []).some((o) => o.value === x));
        if (arr.length) values[k] = arr; break;
      }
      case 'repeater': {
        const arr = (Array.isArray(v) ? v : []).filter((it) => it && it.name)
          .map((it) => ({ name: String(it.name).trim(), intensity: Math.round(Math.max(0, Math.min(10, Number(it.intensity) || 0)) * 2) / 2 }));
        if (arr.length) values[k] = arr; break;
      }
      default: { if (typeof v === 'string' && v.trim()) values[k] = v.trim(); }
    }
  }
  return values;
}
