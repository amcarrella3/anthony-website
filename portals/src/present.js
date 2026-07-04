// present.js — presentation / installation mode.
//
// The museum form of the piece: fullscreen, every tool-chrome surface gone,
// the composition running live and endless. Also the "final stage work"
// surface — where the FRAME (output aspect) is set. You compose what's in
// frame with the same zoom/pan used while editing; presentation just removes
// everything that isn't the art and letterboxes to the chosen aspect.
//
// Run DURATION and file export (looping webm / mov / gif / jpeg) hang off this
// same frame and arrive with the export step. Here we build the live run.
//
// Appearance note: the surround (letterbox) color is provisional museum black —
// Anthony's to author (manifest.frame.surround), like paper/ink.

const ASPECTS = {
  'as-composed': null,   // no letterbox — the composition's own shape
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '3:2': 3 / 2,
};

export function initPresent({ field, manifest, save }) {
  manifest.frame = manifest.frame || {};
  if (!manifest.frame.aspect) manifest.frame.aspect = 'as-composed';
  if (!manifest.frame.ground) manifest.frame.ground = 'black';

  // the letterbox window: a transparent rectangle of the chosen aspect, its
  // surround painted by a huge box-shadow so any composition overflow is masked.
  const frameEl = document.createElement('div');
  frameEl.className = 'present-frame';
  field.appendChild(frameEl);

  let on = false;
  let idleTimer = null;
  let decal = null;
  let threshold = null;

  const notTyping = (t) => !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));

  function sizeFrame() {
    const ar = ASPECTS[manifest.frame.aspect];
    if (ar == null) { frameEl.style.display = 'none'; return; }   // as-composed: no window
    const vw = field.clientWidth, vh = field.clientHeight;
    let w = vw, h = vw / ar;
    if (h > vh) { h = vh; w = vh * ar; }
    frameEl.style.display = 'block';
    frameEl.style.width = w + 'px';
    frameEl.style.height = h + 'px';
  }

  // ground: the field BEHIND the composition in present mode — 'black' (museum
  // void) or 'paper' (the portal's chosen paper colour / uploaded background).
  function applyGround() {
    const paper = manifest.frame.ground === 'paper';
    document.body.classList.toggle('ground-paper', paper);
    if (paper && manifest.paperImage) {
      field.style.setProperty('--ground-img', `url("./${String(manifest.paperImage).replace(/^\//, '')}")`);
      document.body.classList.add('ground-image');
    } else {
      document.body.classList.remove('ground-image');
      field.style.removeProperty('--ground-img');
    }
  }

  // the "return through the portal" decal — only on shared/published rooms, where
  // there's a gallery to go back to. Provisional glowing mark; Anthony's to author.
  function showDecal() {
    if (decal || !document.body.classList.contains('is-shared')) return;
    decal = document.createElement('a');
    decal.className = 'portal-return';
    decal.href = './';                                  // the gallery (parent of the room)
    decal.setAttribute('aria-label', 'return through the portal');
    decal.innerHTML = '<span class="portal-return__core"></span>';
    field.appendChild(decal);
  }
  function hideDecal() { if (decal) { decal.remove(); decal = null; } }

  // the entry THRESHOLD (published rooms only): a gate shown while the portal
  // loads/buffers behind it. Crossing it (a click — a real user gesture) FORCES
  // every video to play, so nothing waits on autoplay policy, then dissolves you
  // into the piece. Provisional look; Anthony's to author.
  // PROVISIONAL procession roster — placeholder names only. The real roster comes
  // from Anthony's Thymer people-web + his traditions document; the walking
  // FIGURES are his to author (drawn/vectorized). Gated behind ?exp=1 so the live
  // rooms and shared link are untouched while this is experimental.
  // A curated historical cross-section from Anthony's "Map of Traditions" (474
  // people / 149 traditions) + the archetypes he named — public/historical
  // figures ONLY (no living private contacts). Real roster + figures come next.
  const PROCESSION = [
    'a Lascaux hunter', 'a Lenape gatherer', 'a Greek scribe', 'Sappho',
    'Guillaume de Machaut', 'Meister Eckhart', 'Josquin des Prez', 'Palestrina',
    'Teresa of Ávila', 'John of the Cross', 'Dieterich Buxtehude', 'J.S. Bach',
    'Handel', 'Henry Purcell', 'Django Reinhardt', 'Simone Weil', 'Thomas Merton', 'Augustine',
  ];
  // PROVISIONAL skyline for the "timeless street" — Greek temple, tipi, European
  // house, cave, longhouse, dome, columns. Placeholder massing only; Anthony's
  // drawn/vectorized buildings replace these (his sketch is the seed).
  const STREET_SVG = '<svg viewBox="0 0 900 110" preserveAspectRatio="xMinYMax meet" xmlns="http://www.w3.org/2000/svg">'
    + '<g><polyline points="20,92 20,60 120,60 120,92"/><line x1="40" y1="60" x2="40" y2="92"/><line x1="60" y1="60" x2="60" y2="92"/><line x1="80" y1="60" x2="80" y2="92"/><line x1="100" y1="60" x2="100" y2="92"/><polyline points="12,60 70,40 128,60"/></g>'
    + '<g><polyline points="168,92 205,42 242,92"/><line x1="196" y1="52" x2="216" y2="38"/><line x1="214" y1="52" x2="194" y2="38"/></g>'
    + '<g><polyline points="288,92 288,58 350,58 350,92"/><polyline points="282,58 319,38 356,58"/><rect x="311" y="72" width="15" height="20"/></g>'
    + '<g><path d="M400,92 Q452,42 504,92"/><path d="M442,92 Q452,66 464,92"/></g>'
    + '<g><path d="M542,92 L542,66 Q582,50 622,66 L622,92"/><line x1="566" y1="70" x2="566" y2="92"/><line x1="598" y1="70" x2="598" y2="92"/></g>'
    + '<g><path d="M668,92 A42,42 0 0 1 752,92"/><line x1="710" y1="50" x2="710" y2="42"/></g>'
    + '<g><line x1="802" y1="92" x2="802" y2="56"/><line x1="824" y1="92" x2="824" y2="56"/><polyline points="794,56 813,44 832,56"/></g>'
    + '</svg>';
  function showThreshold() {
    if (threshold || !document.body.classList.contains('is-shared')) return;
    const exp = window.__COSMOS_EXP__ === true || new URLSearchParams(location.search).get('exp') === '1';
    threshold = document.createElement('div');
    threshold.className = 'portal-threshold' + (exp ? ' has-procession' : '');
    let inner =
      '<button class="portal-threshold__gate" type="button" aria-label="enter the portal">'
      + '<span class="portal-threshold__ring"></span>'
      + '<span class="portal-threshold__label">enter</span>'
      + '</button>';
    if (exp) {
      const fig = (n) => '<span class="procession-figure"><span class="procession-figure__mark"></span><span class="procession-figure__name">' + n + '</span></span>';
      const line = PROCESSION.map(fig).join('');   // doubled → seamless endless loop
      inner += '<div class="portal-procession" aria-hidden="true">'
        + '<div class="portal-street">' + STREET_SVG + STREET_SVG + '</div>'   // PROVISIONAL buildings — his to draw
        + '<div class="portal-road"></div>'
        + '<div class="portal-procession__track">' + line + line + '</div>'
        + '</div>';
    }
    threshold.innerHTML = inner;
    field.appendChild(threshold);
    const cross = () => {
      if (!threshold) return;
      field.querySelectorAll('video').forEach((v) => { try { v.muted = true; v.play().catch(() => {}); } catch (_) {} });
      window.dispatchEvent(new CustomEvent('cosmos:entered'));   // gesture — let audio unlock too
      const t = threshold; threshold = null;
      t.classList.add('is-crossing');
      document.body.classList.add('is-entering');   // the view falls INTO the piece
      setTimeout(() => { t.remove(); document.body.classList.remove('is-entering'); }, 1400);
    };
    threshold.querySelector('.portal-threshold__gate').addEventListener('click', cross);
  }
  function hideThreshold() { if (threshold) { threshold.remove(); threshold = null; } }

  function onMove() {
    document.body.classList.remove('cursor-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add('cursor-idle'), 2500);
  }

  function enter() {
    if (on) return;
    on = true;
    // presentation is never edit mode — drop the tool before the art fills the wall
    if (document.body.classList.contains('is-editing')) window.__editor?.toggle?.();
    document.body.classList.add('is-presenting');
    applyGround();
    sizeFrame();
    showDecal();
    showThreshold();
    window.addEventListener('resize', sizeFrame);
    window.addEventListener('mousemove', onMove);
    onMove();
    field.requestFullscreen?.().catch(() => {});   // best-effort; the fill works without it
    window.dispatchEvent(new CustomEvent('cosmos:present', { detail: true }));
  }

  function exit() {
    if (!on) return;
    on = false;
    hideDecal();
    hideThreshold();
    document.body.classList.remove('is-presenting', 'cursor-idle', 'ground-paper', 'ground-image');
    window.removeEventListener('resize', sizeFrame);
    window.removeEventListener('mousemove', onMove);
    clearTimeout(idleTimer);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    window.dispatchEvent(new CustomEvent('cosmos:present', { detail: false }));
  }

  function toggle() { on ? exit() : enter(); }

  function setAspect(key) {
    if (!(key in ASPECTS)) return;
    manifest.frame.aspect = key;
    save();
    if (on) sizeFrame();
    window.dispatchEvent(new CustomEvent('cosmos:frame', { detail: key }));
  }

  function setGround(g) {
    manifest.frame.ground = g === 'paper' ? 'paper' : 'black';
    save();
    if (on) applyGround();
    window.dispatchEvent(new CustomEvent('cosmos:ground', { detail: manifest.frame.ground }));
  }
  function toggleGround() { setGround(manifest.frame.ground === 'paper' ? 'black' : 'paper'); }

  // keys: p toggles present, b toggles ground, Esc leaves (fullscreen Esc synced below)
  window.addEventListener('keydown', (e) => {
    if (document.body.classList.contains('is-shared')) return;   // view-only: keys are inert
    if (!notTyping(e.target)) return;
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); toggle(); }
    else if (e.key === 'b' || e.key === 'B') { e.preventDefault(); toggleGround(); }
    else if (e.key === 'Escape' && on) { e.preventDefault(); exit(); }
  });
  // if the user leaves fullscreen by any means while presenting, leave present too
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && on) exit(); });

  return {
    enter, exit, toggle, setAspect, setGround, toggleGround,
    getAspect: () => manifest.frame.aspect,
    getGround: () => manifest.frame.ground,
    isOn: () => on,
    aspects: () => Object.keys(ASPECTS),
  };
}
