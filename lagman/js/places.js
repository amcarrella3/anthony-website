// places.js — live place search for the restaurant field.
//
// Uses Photon (photon.komoot.io), a free, keyless, CORS-enabled geocoder built
// on OpenStreetMap and designed for search-as-you-type. No API key, no billing,
// works from a static site. Results are biased toward the Bustleton area.
//
// NOTE: this is OSM data, not Google. True Google Places autocomplete needs a
// paid API key; the form also offers a "Search Google Maps" link that opens
// live Google in a new tab as an escape hatch. Requires a network connection;
// offline, the curated quick-picks and free-text entry still work.

const ENDPOINT = 'https://photon.komoot.io/api/';
const BIAS = { lat: 40.0906, lon: -75.0205 }; // ~Bustleton Ave, NE Philadelphia

function composeAddress(p) {
  const line1 = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [line1 || p.name, p.city || p.district, p.state, p.postcode].filter(Boolean);
  // Drop a leading duplicate of the name (e.g. name === street).
  return parts.filter((x, i) => !(i === 0 && x === p.name && line1)).join(', ');
}

export async function searchPlaces(query, { signal } = {}) {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=${BIAS.lat}&lon=${BIAS.lon}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = await res.json();
  const seen = new Set();
  const out = [];
  for (const f of data.features || []) {
    const p = f.properties || {};
    const name = p.name || p.street;
    if (!name) continue;
    const address = composeAddress(p);
    const key = `${name}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, address });
  }
  return out;
}

export function googleMapsSearchUrl(query) {
  const q = (query && query.trim()) || 'lagman near Bustleton Ave Philadelphia';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
