// schema.js — the single source of truth for Lagman Log.
//
// Every axis is defined exactly once here. The scoring form, the detail-view
// spectrum bars, the molecular notation, the auto-suggested name, the CSV
// columns and the Thymer export are all GENERATED from this file. Add, rename
// or reorder an axis in one place and every view stays in sync. Nothing is
// dropped by any code path — if a field is "recorded but not in the formula"
// that is stated explicitly here (notation: absent), never hidden.
//
// Field types:
//   text | longtext | number | date | time
//   slider      { min, max, step, left, right }   // labelled endpoints
//   multiselect { options:[{value,label,code?}] }
//   enum        { options:[{value,label,ord?}] }  // single choice
//   repeater    { itemFields:[...] }              // e.g. other spices

export const SECTIONS = [
  {
    id: 'basic',
    title: 'Basic Info',
    fields: [
      { id: 'bowlNumber', label: 'Bowl #', type: 'number', min: 1, step: 1, auto: true, hint: 'Auto-incremented across the archive' },
      { id: 'restaurantName', label: 'Restaurant', type: 'text', placeholder: 'Restaurant name', required: true },
      { id: 'address', label: 'Full address', type: 'text', placeholder: 'Street, city, state' },
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'time', label: 'Time', type: 'time' },
      { id: 'price', label: 'Price', type: 'number', min: 0, step: 0.01, prefix: '$', placeholder: '0.00' },
      { id: 'weather', label: 'Weather', type: 'text', placeholder: 'e.g. first snow, 28°F' },
      { id: 'companions', label: 'Who I was with', type: 'text' },
      { id: 'moodContext', label: 'Mood / context', type: 'text' },
    ],
  },

  {
    id: 'origin',
    title: 'Cultural Origin',
    fields: [
      {
        id: 'culturalOrigin', label: 'Cultural origin', type: 'slider',
        min: 0, max: 100, step: 1, left: 'Central Asian', right: 'Eastern European',
        headline: true,
        notation: { token: 'Or' },
        hint: 'A continuous spectrum, not three buttons. 0 = Central Asian source tradition (Uyghur, Bukharian) · 100 = Eastern European adaptation.',
      },
      {
        id: 'authenticityMarkers', label: 'Authenticity markers observed', type: 'multiselect',
        options: [
          { value: 'halal', label: 'Halal cert' },
          { value: 'kosher', label: 'Kosher cert' },
          { value: 'nocert', label: 'No cert visible' },
          { value: 'uyghur_staff', label: 'Uyghur staff' },
          { value: 'bukharian_staff', label: 'Bukharian staff' },
          { value: 'eastern_european_staff', label: 'Eastern European staff' },
          { value: 'uyghur_media', label: 'Uyghur music / videos' },
          { value: 'geometric_decor', label: 'Geometric Central Asian decor' },
          { value: 'cyrillic', label: 'Cyrillic signage' },
          { value: 'communal_drinking', label: 'Communal drinking setup' },
          { value: 'tea_service', label: 'Traditional tea service' },
          { value: 'tandoor', label: 'Tandoor visible' },
        ],
        hint: 'Observed evidence, recorded separately from the spectrum.',
      },
      { id: 'authenticityOther', label: 'Other markers observed', type: 'longtext' },
    ],
  },

  {
    id: 'spice',
    title: 'Spice Profile',
    fields: [
      {
        id: 'spiceComplexity', label: 'Overall complexity', type: 'slider',
        min: 0, max: 10, step: 0.5, left: 'Bland', right: 'Highly Aromatic',
        headline: true, notation: { token: 'Sp' },
      },
      { id: 'cumin', label: 'Cumin', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'Cu', group: 'spices' } },
      { id: 'starAnise', label: 'Star Anise', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'SA', group: 'spices' } },
      { id: 'sichuanPepper', label: 'Sichuan Pepper', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'Sz', group: 'spices' } },
      { id: 'blackPepper', label: 'Black Pepper', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'BP', group: 'spices' } },
      { id: 'dill', label: 'Dill', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'Di', group: 'spices' }, hint: 'Often marks the Eastern European end.' },
      { id: 'coriander', label: 'Coriander / Cilantro', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'Co', group: 'spices' } },
      { id: 'garlic', label: 'Garlic', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'Ga', group: 'spices' } },
      { id: 'chiliHeat', label: 'Chili Heat', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense', notation: { token: 'Ch', group: 'spices' } },
      {
        id: 'otherSpices', label: 'Other spice', type: 'repeater',
        itemFields: [
          { id: 'name', label: 'Name', type: 'text', placeholder: 'e.g. fenugreek' },
          { id: 'intensity', label: 'Intensity', type: 'slider', min: 0, max: 10, step: 0.5, left: 'None', right: 'Intense' },
        ],
        notation: { group: 'spices', repeater: true },
      },
    ],
  },

  {
    id: 'fat',
    title: 'Fat / Oil Character',
    fields: [
      { id: 'fatOil', label: 'Fat / oil', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Clean', right: 'Greasy', headline: true, notation: { token: 'Ft' } },
      { id: 'fatOilNotes', label: 'Notes', type: 'longtext' },
    ],
  },

  {
    id: 'broth',
    title: 'Broth / Sauce',
    fields: [
      { id: 'liquidLevel', label: 'Liquid level', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Dry / Stir-fried', right: 'Soup-Heavy', headline: true, notation: { token: 'Br' } },
      { id: 'clarity', label: 'Clarity', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Clear', right: 'Cloudy / Opaque', notation: { token: 'Cl' } },
      {
        id: 'tomato', label: 'Tomato presence', type: 'enum',
        options: [
          { value: 'none', label: 'None', ord: 0 },
          { value: 'light', label: 'Light', ord: 3 },
          { value: 'base', label: 'Base', ord: 7 },
          { value: 'heavy', label: 'Heavy', ord: 10 },
        ],
        notation: { token: 'Tm', ordinal: true },
      },
    ],
  },

  {
    id: 'meat',
    title: 'Meat',
    fields: [
      {
        id: 'meatTypes', label: 'Types present', type: 'multiselect',
        options: [
          { value: 'lamb_lean', label: 'Lamb (lean)', code: 'lam' },
          { value: 'lamb_fatty', label: 'Lamb (fatty)', code: 'lamf' },
          { value: 'mutton', label: 'Mutton', code: 'mut' },
          { value: 'beef', label: 'Beef', code: 'bf' },
          { value: 'chicken', label: 'Chicken', code: 'chk' },
        ],
        allowOther: true,
        notation: { token: 'Mt', codes: true },
      },
      { id: 'meatQuality', label: 'Quality', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Gamey', right: 'Refined', headline: true, notation: { token: 'MQ', group: 'meat' } },
      { id: 'meatRatio', label: 'Ratio', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Minimal', right: 'Dominant', notation: { token: 'MR', group: 'meat' } },
      {
        id: 'meatCuts', label: 'Cut / prep', type: 'multiselect',
        options: [
          { value: 'cubed', label: 'Cubed' },
          { value: 'sliced', label: 'Sliced' },
          { value: 'ground', label: 'Ground' },
          { value: 'chunks', label: 'Chunks' },
          { value: 'bonein', label: 'Bone-in' },
          { value: 'random', label: 'Random pieces' },
        ],
        allowOther: true,
      },
      { id: 'meatNotes', label: 'Notes', type: 'longtext' },
    ],
  },

  {
    id: 'noodles',
    title: 'Noodles',
    fields: [
      { id: 'noodlePull', label: 'Pull quality', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Machine', right: 'Artisan Hand-Pull', headline: true, notation: { token: 'NP', group: 'noodles' } },
      { id: 'noodleTexture', label: 'Texture / QQ factor', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Soft', right: 'Perfect Chew', notation: { token: 'QQ', group: 'noodles' } },
      {
        id: 'noodleWidth', label: 'Width', type: 'multiselect',
        options: [
          { value: 'thin', label: 'Thin (angel hair)', code: 'thin' },
          { value: 'standard', label: 'Standard (chopstick)', code: 'std' },
          { value: 'wide', label: 'Wide (belt)', code: 'wide' },
          { value: 'irregular', label: 'Irregular / mixed', code: 'irr' },
        ],
        hint: 'Multi-select allowed for irregular bowls.',
        notation: { token: 'W', codes: true, group: 'noodles' },
      },
      { id: 'noodleWidthMm', label: 'Measured width (mm)', type: 'number', min: 0, step: 0.5, suffix: 'mm', optional: true },
      { id: 'noodleFreshness', label: 'Freshness', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Suspect', right: 'Made-to-Order', notation: { token: 'Fr', group: 'noodles' } },
    ],
  },

  {
    id: 'veg',
    title: 'Vegetables',
    fields: [
      { id: 'vegVarietyCount', label: 'Variety count', type: 'number', min: 0, step: 1, notation: { token: 'Vg', count: true, group: 'veg' } },
      {
        id: 'vegTypes', label: 'Types present', type: 'multiselect',
        options: [
          { value: 'bell_pepper', label: 'Bell Pepper' },
          { value: 'celery', label: 'Celery' },
          { value: 'onion', label: 'Onion' },
          { value: 'tomato', label: 'Tomato' },
          { value: 'cabbage', label: 'Cabbage' },
          { value: 'bok_choy', label: 'Bok Choy' },
          { value: 'carrot', label: 'Carrot' },
        ],
        allowOther: true,
      },
      { id: 'vegTexture', label: 'Texture', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Overcooked', right: 'Crisp-Fresh', notation: { token: 'Cp', group: 'veg' } },
      { id: 'vegRatio', label: 'Ratio', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Minimal', right: 'Vegetable-Forward', notation: { token: 'VR', group: 'veg' } },
    ],
  },

  {
    id: 'harmony',
    title: 'Overall Harmony',
    fields: [
      { id: 'harmony', label: 'Harmony', type: 'slider', min: 0, max: 10, step: 0.5, left: 'Discordant', right: 'Transcendent', headline: true, notation: { token: 'H' } },
    ],
  },

  {
    id: 'names',
    title: 'Names & Notation',
    fields: [
      { id: 'descriptiveName', label: 'Descriptive name', type: 'text', autoSuggest: true, hint: 'Auto-suggested from axis extremes — editable.' },
      { id: 'poeticName', label: 'Poetic name', type: 'text', placeholder: 'Yours to name' },
    ],
  },

  {
    id: 'fieldnotes',
    title: 'Field Notes',
    fields: [
      { id: 'tempServed', label: 'Temperature when served', type: 'text', placeholder: 'e.g. scalding, just-warm' },
      { id: 'portionSize', label: 'Bowl size / portion', type: 'text' },
      { id: 'firstBite', label: 'First bite impression', type: 'longtext' },
      { id: 'midBowl', label: 'Mid-bowl observations', type: 'longtext' },
      { id: 'finalThoughts', label: 'Final thoughts', type: 'longtext' },
      {
        id: 'wouldReturn', label: 'Would return', type: 'enum',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'maybe', label: 'Maybe' },
          { value: 'no', label: 'No' },
        ],
      },
    ],
  },
];

// ---- Molecular notation grammar --------------------------------------------
// Ordered groups joined by '-'. Sub-tokens within a group joined by '·'.
// Zero-value spices are omitted so the formula stays legible. This list is the
// explicit, auditable definition of what appears in the formula.
export const NOTATION_GROUPS = [
  { tokens: ['culturalOrigin'] },
  { tokens: ['spiceComplexity'] },
  { inner: '·', omitZero: true, tokens: ['cumin', 'starAnise', 'sichuanPepper', 'blackPepper', 'dill', 'coriander', 'garlic', 'chiliHeat', 'otherSpices'] },
  { tokens: ['fatOil'] },
  { tokens: ['clarity'] },
  { tokens: ['liquidLevel'] },
  { tokens: ['tomato'] },
  { tokens: ['meatTypes'] },
  { inner: '·', tokens: ['meatQuality', 'meatRatio'] },
  { inner: '·', tokens: ['noodlePull', 'noodleTexture', 'noodleWidth', 'noodleFreshness'] },
  { inner: '·', tokens: ['vegVarietyCount', 'vegTexture', 'vegRatio'] },
  { tokens: ['harmony'] },
];

// ---- Derived helpers --------------------------------------------------------
const _fieldIndex = {};
for (const section of SECTIONS) {
  for (const f of section.fields) {
    f.section = section.id;
    _fieldIndex[f.id] = f;
  }
}

export function getField(id) { return _fieldIndex[id]; }
export function allFields() { return Object.values(_fieldIndex); }
export function sectionOf(id) { return _fieldIndex[id]?.section; }

// Fields that carry a numeric axis value (used by detail bars, radar, naming).
export function scoredFields() {
  return allFields().filter((f) => f.type === 'slider' || (f.type === 'number' && f.notation));
}

export function headlineFields() {
  return allFields().filter((f) => f.headline);
}

// A blank record with sensible defaults for every field.
export function blankBowl() {
  const b = {};
  for (const f of allFields()) {
    switch (f.type) {
      case 'slider': b[f.id] = f.min <= 0 && f.max >= 0 ? 0 : f.min; break;
      case 'number': b[f.id] = f.id === 'vegVarietyCount' ? 0 : null; break;
      case 'multiselect': b[f.id] = []; b[f.id + 'Other'] = ''; break;
      case 'repeater': b[f.id] = []; break;
      case 'enum': b[f.id] = f.id === 'tomato' ? 'none' : ''; break;
      default: b[f.id] = '';
    }
  }
  return b;
}
