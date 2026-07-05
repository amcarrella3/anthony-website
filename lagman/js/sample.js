// sample.js — two clearly-marked sample bowls, loadable from the empty archive
// so the instrument can be explored before real data exists. Never auto-inserted.

import { blankBowl } from './schema.js';
import { buildNotation } from './notation.js';
import * as store from './store.js';

const SAMPLES = [
  {
    id: 'sample-central-asian', bowlNumber: 1,
    restaurantName: 'Silk Road Noodle House (sample)', address: 'Bustleton Ave, Philadelphia, PA',
    date: '2026-01-10', time: '19:20', price: 14.5,
    weather: 'first hard freeze, 24°F', companions: 'solo', moodContext: 'notebook open, field notes',
    culturalOrigin: 15,
    authenticityMarkers: ['halal', 'uyghur_staff', 'uyghur_media', 'tandoor'], authenticityMarkersOther: '',
    spiceComplexity: 8.5, cumin: 9, starAnise: 4, sichuanPepper: 0, blackPepper: 3, dill: 0, coriander: 4, garlic: 6, chiliHeat: 5,
    otherSpices: [],
    fatOil: 2, fatOilNotes: 'clean sheen, not slick',
    liquidLevel: 8, clarity: 2, tomato: 'light',
    meatTypes: ['lamb_lean'], meatTypesOther: '', meatQuality: 8, meatRatio: 3, meatCuts: ['cubed'], meatCutsOther: '', meatNotes: 'tender, gamey in a good way',
    noodlePull: 9, noodleTexture: 9, noodleWidth: ['standard'], noodleWidthMm: 3, noodleFreshness: 9,
    vegVarietyCount: 7, vegTypes: ['bell_pepper', 'celery', 'onion', 'cabbage', 'bok_choy', 'carrot', 'tomato'], vegTypesOther: '', vegTexture: 9, vegRatio: 6,
    harmony: 9,
    descriptiveName: 'High-Cumin Clean-Spiced Minimal-Meat Artisan-Pull Central Asian Soup',
    poeticName: 'First Frost, Cumin Rising',
    tempServed: 'scalding', portionSize: 'generous', firstBite: 'The cumin arrives before the spoon does.', midBowl: 'Noodles hold their chew all the way down.', finalThoughts: 'The bar for the winter.', wouldReturn: 'yes',
  },
  {
    id: 'sample-eastern-european', bowlNumber: 2,
    restaurantName: 'Bay Leaf House (sample)', address: 'Rego Park, Queens, NY',
    date: '2026-01-18', time: '20:05', price: 18,
    weather: 'sleet', companions: 'with M.', moodContext: 'loud, warm room',
    culturalOrigin: 85,
    authenticityMarkers: ['eastern_european_staff', 'cyrillic', 'communal_drinking', 'nocert'], authenticityMarkersOther: '',
    spiceComplexity: 3, cumin: 2, starAnise: 0, sichuanPepper: 0, blackPepper: 4, dill: 7, coriander: 1, garlic: 3, chiliHeat: 1,
    otherSpices: [],
    fatOil: 8, fatOilNotes: 'lamb fat pools at the rim',
    liquidLevel: 5, clarity: 7, tomato: 'base',
    meatTypes: ['lamb_fatty', 'mutton'], meatTypesOther: '', meatQuality: 3, meatRatio: 8, meatCuts: ['chunks', 'bonein'], meatCutsOther: '', meatNotes: 'heavy, unapologetic',
    noodlePull: 4, noodleTexture: 5, noodleWidth: ['wide'], noodleWidthMm: 8, noodleFreshness: 5,
    vegVarietyCount: 3, vegTypes: ['onion', 'carrot', 'bell_pepper'], vegTypesOther: '', vegTexture: 4, vegRatio: 3,
    harmony: 6,
    descriptiveName: 'Dilled Rich-Oiled Meat-Heavy Machine-Cut Eastern European Lagman',
    poeticName: 'Dill and Bay Leaf',
    tempServed: 'hot', portionSize: 'enormous', firstBite: 'Dill and bay up front — a heavier tradition.', midBowl: 'More stew than noodle.', finalThoughts: 'A different animal entirely. Worth documenting.', wouldReturn: 'maybe',
  },
];

export async function loadSamples() {
  for (const s of SAMPLES) {
    const bowl = Object.assign(blankBowl(), s);
    const n = buildNotation(bowl);
    bowl.notation = n.plain; bowl.notationPlain = n.plain;
    bowl.createdAt = new Date().toISOString(); bowl.updatedAt = bowl.createdAt;
    await store.putBowl(bowl);
  }
  await store.bumpBowlCounter(SAMPLES.length);
}
