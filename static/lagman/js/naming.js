// naming.js — auto-suggest a descriptive name from axis extremes.
//
// The name is DERIVED from the measurements, never the reverse. It reads the
// axes that sit farthest from their midpoint and composes a title in the spirit
// of "High-Cumin Clean-Spiced Minimal-Lamb Artisan-Pull Central Asian Soup". Always
// editable by hand afterward.

function lean(v, lo, hi, loWord, hiWord, dead = 1.5) {
  if (v <= lo) return loWord;
  if (v >= hi) return hiWord;
  return null;
}

export function suggestName(b) {
  const parts = [];

  // Spice character — pick the single most dominant named spice, if strong.
  const spices = [
    ['Cumin', b.cumin], ['Star-Anise', b.starAnise], ['Sichuan', b.sichuanPepper],
    ['Peppery', b.blackPepper], ['Dilled', b.dill], ['Herbaceous', b.coriander],
    ['Garlicky', b.garlic], ['Fiery', b.chiliHeat],
  ].sort((a, c) => (c[1] || 0) - (a[1] || 0));
  if (spices[0] && spices[0][1] >= 7) parts.push('High-' + spices[0][0]);
  else if (b.spiceComplexity >= 8) parts.push('Aromatic');
  else if (b.spiceComplexity <= 2) parts.push('Bland');

  // Fat / oil.
  const fat = lean(b.fatOil, 2, 8, 'Clean-Spiced', 'Rich-Oiled');
  if (fat) parts.push(fat);

  // Meat.
  if (b.meatRatio <= 2) parts.push('Minimal-Meat');
  else if (b.meatRatio >= 8) parts.push('Meat-Heavy');
  const mq = lean(b.meatQuality, 2, 8, 'Gamey', 'Refined');
  if (mq && (b.meatRatio || 0) > 2) parts.push(mq);

  // Noodles.
  const np = lean(b.noodlePull, 2, 8, 'Machine-Cut', 'Artisan-Pull');
  if (np) parts.push(np);

  // Vegetables.
  if (b.vegRatio >= 8) parts.push('Vegetable-Forward');

  // Origin acts as an adjective near the noun.
  const origin = b.culturalOrigin;
  let originWord = null;
  if (origin <= 20) originWord = 'Central Asian';
  else if (origin >= 80) originWord = 'Eastern European';
  else if (origin >= 40 && origin <= 60) originWord = 'Crossroads';
  else originWord = origin < 50 ? 'Central-Asian-Leaning' : 'Eastern-European-Leaning';
  if (originWord) parts.push(originWord);

  // Broth form as the noun.
  const noun = b.liquidLevel >= 6 ? 'Soup' : b.liquidLevel <= 3 ? 'Stir-Fry' : 'Lagman';

  // Keep it to a handful of descriptors so it stays a name, not a sentence.
  const trimmed = parts.slice(0, 5);
  trimmed.push(noun);
  return trimmed.join(' ');
}
