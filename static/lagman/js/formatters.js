// formatters.js — per-bowl text renderings at different scopes.
//   fullText(bowl)  — the complete entry, every field, for pasting / archiving.
//   shareText(bowl) — a compact, mobile-ready summary for a text or a post.

import { SECTIONS, getField } from './schema.js';
import { buildNotation } from './notation.js';
import { fmtNum } from './util.js';

function valueText(field, bowl) {
  const v = bowl[field.id];
  switch (field.type) {
    case 'slider':
      return `${fmtNum(v ?? 0)}  (${field.left} → ${field.right})`;
    case 'number':
      if (v == null || v === '') return null;
      return `${field.prefix || ''}${fmtNum(v)}${field.suffix ? ' ' + field.suffix : ''}`;
    case 'enum': {
      const o = (field.options || []).find((x) => x.value === v);
      return o ? o.label : null;
    }
    case 'multiselect': {
      const labels = (v || []).map((val) => field.options.find((o) => o.value === val)?.label || val);
      const other = bowl[field.id + 'Other'];
      if (other) labels.push(other);
      return labels.length ? labels.join(', ') : null;
    }
    case 'repeater': {
      const items = (v || []).filter((it) => it && it.name);
      return items.length ? items.map((it) => `${it.name} ${fmtNum(it.intensity || 0)}`).join(', ') : null;
    }
    default:
      return v ? String(v) : null;
  }
}

export function fullText(bowl) {
  const notation = buildNotation(bowl).plain;
  const lines = [];
  lines.push(`# Lagman #${fmtNum(bowl.bowlNumber)} — ${bowl.restaurantName || 'Untitled'}`);
  if (bowl.poeticName) lines.push(`“${bowl.poeticName}”`);
  if (bowl.descriptiveName) lines.push(bowl.descriptiveName);
  lines.push('');
  lines.push(`Notation: ${notation}`);

  for (const section of SECTIONS) {
    if (section.id === 'names') continue; // names already at top
    const body = [];
    for (const field of section.fields) {
      if (field.id === 'bowlNumber') continue;
      const t = valueText(field, bowl);
      if (t == null || t === '') continue;
      body.push(`${field.label}: ${t}`);
    }
    if (body.length) { lines.push('', `## ${section.title}`, ...body); }
  }
  return lines.join('\n');
}

export function shareText(bowl) {
  const notation = buildNotation(bowl).plain;
  const wr = getField('wouldReturn').options.find((o) => o.value === bowl.wouldReturn);
  const originLabel = bowl.culturalOrigin <= 40 ? 'Central Asian' : bowl.culturalOrigin >= 60 ? 'Eastern European' : 'Crossroads';
  const head = `🍜 Lagman #${fmtNum(bowl.bowlNumber)} — ${bowl.restaurantName || 'Untitled'}${bowl.date ? ` · ${bowl.date}` : ''}`;
  const title = bowl.poeticName ? `“${bowl.poeticName}”` : bowl.descriptiveName || '';
  const stats = `Harmony ${fmtNum(bowl.harmony ?? 0)}/10 · ${originLabel} · Spice ${fmtNum(bowl.spiceComplexity ?? 0)}/10${wr ? ` · would return: ${wr.label}` : ''}`;
  const shape = `Noodle pull ${fmtNum(bowl.noodlePull ?? 0)} · Meat ${fmtNum(bowl.meatQuality ?? 0)} · Broth ${fmtNum(bowl.liquidLevel ?? 0)} · Fat ${fmtNum(bowl.fatOil ?? 0)}`;
  return [head, title, stats, shape, notation].filter(Boolean).join('\n');
}
