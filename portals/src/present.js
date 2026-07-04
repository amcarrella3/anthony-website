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
