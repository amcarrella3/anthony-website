// editor/editor.js — compose at the screen. The flannel board.
// Press `e` to edit. Drag to move · corner to resize · rotate handle · drop media
// onto the board to upload · ＋media / ＋shape to author · fit/front/back/dup/del
// in the HUD. Masked pieces aspect-lock to the shape so his line never squashes
// (hold Alt while resizing to free-stretch). Every change autosaves. VIEW mode is
// chrome-free. This chrome is a TOOL, never the artwork.

import { dropToPct, clamp } from '../util.js';
import { getShapeRatioSync, loadShape } from '../shapes.js';

const FEEDS = {
  'epigram':         { source: 'data/epigram.json' },
  'thymer-viewport': { source: 'data/thymer/natural-observations.json' },
  'image':           { source: '' },
  'video':           { source: '' },
  'color':           { source: '' },
};

export function initEditor({ stage, manifest, applyPlace, applyMedia, applyShadow, applyTextStyle, applyMotion, applyPalette, applyBackground, zoom, present, project, recompose, save: rawSave, addPiece, maxZ, minZ }) {
  let editing = false;
  let selected = null;
  let drawing = false, activeDrawing = null, drawSurface = null;
  let shapeMode = null, shapeSurface = null;
  let textEditing = null;
  let collections = [];
  const brush = { color: '#171310', width: 7, cap: 'round', opacity: 1, fill: 'none' };
  let clipboard = null;
  let history = [], hIndex = -1, restoring = false;

  // ── history (global undo/redo) ─────────────────────────────────────
  function serialize() { return JSON.stringify({ pieces: manifest.pieces, palette: manifest.palette }); }
  function recordHistory() {
    if (restoring) return;
    const s = serialize();
    if (history[hIndex] === s) return;          // no change → no entry
    history = history.slice(0, hIndex + 1);
    history.push(s); hIndex = history.length - 1;
    if (history.length > 80) { history.shift(); hIndex--; }
  }
  function save() { recordHistory(); rawSave(); renderLayers(); }  // record + persist + refresh layers
  function applyState(str) {
    restoring = true;
    const st = JSON.parse(str);
    manifest.pieces = st.pieces; if (st.palette) manifest.palette = st.palette;
    activeDrawing = null; selected = null; selWrap.hidden = true;
    applyPalette(); recompose(); attachAll(); rawSave();
    restoring = false;
  }
  function undo() { if (hIndex <= 0) return; hIndex--; applyState(history[hIndex]); }
  function redo() { if (hIndex >= history.length - 1) return; hIndex++; applyState(history[hIndex]); }

  // ── copy / cut / paste ─────────────────────────────────────────────
  function copySel() { if (selected) clipboard = JSON.parse(JSON.stringify(selected)); }
  function cutSel() { if (selected) { copySel(); deletePiece(selected); } }
  function paste() {
    if (!clipboard) return;
    const c = JSON.parse(JSON.stringify(clipboard));
    delete c.id; delete c.z;
    c.place = c.place || {};
    c.place.leftPct = clamp((c.place.leftPct != null ? c.place.leftPct : 50) + 3, 2, 98);
    c.place.topPct = clamp((c.place.topPct != null ? c.place.topPct : 50) + 3, 2, 98);
    const np = addPiece(c); attachAll(); select(np); save();
  }

  const hud = document.createElement('div');
  hud.className = 'editor-hud';
  hud.hidden = true;
  hud.innerHTML = `
    <span class="editor-hud__tag">EDIT</span>
    <button data-act="proj-open" class="editor-hud__proj" title="projects — new / open / save"><span class="proj-name">portal</span> ▾</button>
    <button data-act="add-open">＋ Add ▾</button>
    <button data-act="add-media">＋ media</button>
    <button data-act="add-shape">＋ shape</button>
    <button data-act="draw">✏ draw</button>
    <button data-act="shape-rect" title="rectangle">▭</button>
    <button data-act="shape-ellipse" title="ellipse">◯</button>
    <button data-act="shape-free" title="freeform shape">∿</button>
    <button data-act="add-text">＋ text</button>
    <button data-act="add-thymer">＋ thymer</button>
    <span class="editor-hud__brush" hidden>
      <label class="editor-hud__col">brush<input type="color" data-brush="color"></label>
      <select class="editor-hud__bsize">
        <option value="3">fine</option>
        <option value="7" selected>medium</option>
        <option value="16">broad</option>
        <option value="34">huge</option>
      </select>
      <select class="editor-hud__btype">
        <option value="round" selected>round</option>
        <option value="butt">flat</option>
      </select>
      <button data-act="undo-stroke">undo</button>
      <button data-act="draw-done">done</button>
    </span>
    <label class="editor-hud__col">paper<input type="color" data-pal="paper"></label>
    <button data-act="paper-img" title="upload a background image">bg&nbsp;img</button>
    <label class="editor-hud__col">ink<input type="color" data-pal="ink"></label>
    <span class="editor-hud__zoom"><button data-act="zoom-out">−</button><span class="zoom-pct">100%</span><button data-act="zoom-in">＋</button><button data-act="zoom-reset" title="reset zoom (0)">⊡</button></span>
    <button data-act="present" title="present · museum mode (p)">▶&nbsp;present</button>
    <label class="editor-hud__col">frame<select data-frame>
      <option value="as-composed">as-composed</option>
      <option value="16:9">16:9</option>
      <option value="9:16">9:16</option>
      <option value="1:1">1:1</option>
      <option value="4:5">4:5</option>
      <option value="3:2">3:2</option>
    </select></label>
    <button data-act="ground" title="present ground — black / paper (b)">ground:&nbsp;<span class="ground-val">black</span></button>
    <button data-act="export-open" title="export a still / loop">⤓&nbsp;export</button>
    <button data-act="publish" title="publish your portals to anthonymichael.work">⬆&nbsp;publish</button>
    <span class="editor-hud__sel" hidden>
      <span class="editor-hud__id"></span>
      <select class="editor-hud__feed">
        <option value="image">image</option>
        <option value="video">video</option>
        <option value="color">color</option>
        <option value="epigram">epigram</option>
        <option value="thymer-viewport">thymer</option>
      </select>
      <input class="editor-hud__src" placeholder="source…" size="14">
      <select class="editor-hud__shape"><option value="">no mask</option></select>
      <label class="editor-hud__col">fill<input type="color" data-slot="background"></label>
      <select class="editor-hud__collection" hidden></select>
      <span class="editor-hud__type" hidden>
        <select class="ty-font">
          <option value="">font</option>
          <option value="Georgia, 'Times New Roman', serif">serif</option>
          <option value="ui-sans-serif, system-ui, sans-serif">sans</option>
          <option value="ui-monospace, Menlo, monospace">mono</option>
          <option value="'Courier New', Courier, monospace">courier</option>
        </select>
        <input type="color" class="ty-color" title="text color">
        <button data-act="al-left" title="align left">⌊</button>
        <button data-act="al-center" title="center">≡</button>
        <button data-act="al-right" title="align right">⌋</button>
        <input type="range" class="ty-size" min="0.5" max="3" step="0.1" value="1" title="text size">
      </span>
      <button data-act="fit">fit: cover</button>
      <span class="editor-hud__reframe" hidden>
        <span class="editor-hud__col">reframe</span>
        <input type="range" class="rf-x" min="0" max="100" value="50" title="pan X">
        <input type="range" class="rf-y" min="0" max="100" value="50" title="pan Y">
        <input type="range" class="rf-z" min="1" max="3" step="0.05" value="1" title="zoom">
      </span>
      <span class="editor-hud__audio" hidden>vol<input type="range" class="au-vol" min="0" max="1" step="0.05" value="0.8"></span>
      <button data-act="shadow">shadow</button>
      <span class="editor-hud__shadow" hidden>
        <input type="range" class="sh-x" min="-40" max="40" value="4" title="shadow x">
        <input type="range" class="sh-y" min="-40" max="40" value="8" title="shadow y">
        <input type="range" class="sh-blur" min="0" max="60" value="16" title="blur">
        <input type="color" class="sh-color" value="#000000" title="shadow color">
        <input type="range" class="sh-op" min="0" max="1" step="0.05" value="0.3" title="opacity">
      </span>
      <span class="editor-hud__motion">
        <select class="mo-type">
          <option value="none">still</option>
          <option value="drift">drift</option>
          <option value="breathe">breathe</option>
          <option value="sway">sway</option>
          <option value="spin">spin</option>
          <option value="fade">fade-in</option>
        </select>
        <input type="range" class="mo-speed" min="0.25" max="3" step="0.05" value="1" title="speed">
        <input type="range" class="mo-amt" min="0.2" max="3" step="0.1" value="1" title="amount">
      </span>
      <button data-act="front">▲</button>
      <button data-act="back">▼</button>
      <button data-act="dup">⧉</button>
      <button data-act="del">delete</button>
    </span>
    <span class="editor-hud__save" hidden>saved ✓</span>
    <span class="editor-hud__hint">drag · corner · rotate · drop media · e</span>`;
  document.body.appendChild(hud);

  const toastEl = document.createElement('div');
  toastEl.className = 'editor-toast';
  toastEl.hidden = true;
  document.body.appendChild(toastEl);
  let toastTimer = null;
  function toast(msg, ms = 4200) {
    if (!editing) return;                    // never paint tool messages over the art
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer);
    if (ms > 0) toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
  }

  const mediaInput = fileInput('image/*,video/*,audio/*', (f) => uploadMedia(f, centerPt()));
  const shapeInput = fileInput('image/*', (f) => uploadShape(f));
  function fileInput(accept, onFile) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.hidden = true;
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) onFile(f); inp.value = ''; });
    document.body.appendChild(inp);
    return inp;
  }

  const q = (s) => hud.querySelector(s);
  const selWrap = q('.editor-hud__sel');
  const idEl = q('.editor-hud__id');
  const feedSel = q('.editor-hud__feed');
  const srcInp = q('.editor-hud__src');
  const shapeSel = q('.editor-hud__shape');
  const fillInp = q('[data-slot="background"]');
  const fitBtn = q('[data-act="fit"]');
  const saveEl = q('.editor-hud__save');
  const paperInp = q('[data-pal="paper"]');
  const inkInp = q('[data-pal="ink"]');

  paperInp.value = hexOf(manifest.palette && manifest.palette.paper, '#f3f0ea');
  inkInp.value = hexOf(manifest.palette && manifest.palette.ink, '#171310');
  loadShapes();

  const drawBtn = q('[data-act="draw"]');
  const brushWrap = q('.editor-hud__brush');
  const brushColor = q('[data-brush="color"]');
  brushColor.value = brush.color;
  drawBtn.addEventListener('click', () => (drawing ? exitDraw() : enterDraw()));
  q('[data-act="draw-done"]').addEventListener('click', exitDraw);
  q('[data-act="undo-stroke"]').addEventListener('click', undo);
  brushColor.addEventListener('input', () => { brush.color = brushColor.value; });
  q('.editor-hud__bsize').addEventListener('change', (e) => { brush.width = Number(e.target.value); });
  q('.editor-hud__btype').addEventListener('change', (e) => { brush.cap = e.target.value; });
  const toggleShape = (k) => { if (shapeMode === k) exitShapeMode(); else enterShapeMode(k); };
  q('[data-act="shape-rect"]').addEventListener('click', () => toggleShape('rect'));
  q('[data-act="shape-ellipse"]').addEventListener('click', () => toggleShape('ellipse'));
  q('[data-act="shape-free"]').addEventListener('click', () => toggleShape('freeform'));

  // ── right-click menu (controls ON the objects) ─────────────────────
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.hidden = true;
  document.body.appendChild(menu);
  function hideMenu() { menu.hidden = true; }
  function showMenu(x, y, onPiece) {
    const items = [
      onPiece && { label: 'Duplicate', kbd: '⌘D', act: () => selected && duplicate(selected) },
      onPiece && { label: 'Copy', kbd: '⌘C', act: () => copySel() },
      onPiece && { label: 'Cut', kbd: '⌘X', act: () => cutSel() },
      clipboard && { label: 'Paste', kbd: '⌘V', act: () => paste() },
      onPiece && { label: 'Bring to front', kbd: ']', act: () => selected && bring(selected, 1) },
      onPiece && { label: 'Send to back', kbd: '[', act: () => selected && bring(selected, -1) },
      (onPiece && selected && selected.feed && selected.feed.type === 'shape') && { label: 'Use as mask', kbd: '', act: () => useAsMask(selected) },
      (onPiece && selected && selected.feed && selected.feed.type === 'text') && { label: 'Edit text', kbd: '2×click', act: () => { const el = elFor(selected); if (el) editText(selected, el); } },
      onPiece && { label: (selected && selected.shadow) ? 'Shadow off' : 'Shadow on', kbd: '', act: () => toggleShadowQuick() },
      onPiece && { label: 'Delete', kbd: '⌫', act: () => selected && deletePiece(selected) },
    ].filter(Boolean);
    if (!items.length) return;
    menu.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'ctx-menu__item';
      b.innerHTML = `<span>${it.label}</span><span class="ctx-menu__kbd">${it.kbd}</span>`;
      b.addEventListener('click', () => { it.act(); hideMenu(); });
      menu.appendChild(b);
    }
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
    menu.hidden = false;
  }
  stage.addEventListener('contextmenu', (e) => {
    if (!editing || drawing || shapeMode) return;
    e.preventDefault();
    const el = e.target.closest && e.target.closest('.slot');
    if (el) select(pieceFor(el));
    showMenu(e.clientX, e.clientY, !!el);
  });
  window.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target)) hideMenu(); });

  recordHistory();   // capture the initial loaded state

  // ── layers panel (select ANY piece, even buried ones) ──────────────
  const layersEl = document.createElement('div');
  layersEl.className = 'layers';
  document.body.appendChild(layersEl);
  function pieceLabel(p) {
    const t = p.feed.type;
    if (t === 'image' || t === 'video') return t + ' · ' + (String(p.feed.source || '').split('/').pop() || '');
    if (t === 'drawing') return 'drawing (' + ((p.strokes || []).length) + ')';
    if (t === 'thymer-viewport') return 'thymer';
    return t;
  }
  function renderLayers() {
    layersEl.innerHTML = '';
    const ordered = [...manifest.pieces].sort((a, b) => (b.z || 0) - (a.z || 0));  // top layer first
    for (const p of ordered) {
      const row = document.createElement('button');
      row.className = 'layers__row' + (selected === p ? ' is-current' : '');
      const label = pieceLabel(p);
      row.textContent = label; row.title = label;
      row.addEventListener('click', () => select(p));
      layersEl.appendChild(row);
    }
  }

  // ── mask reframe (which part of a photo/video shows through) ────────
  const reframeWrap = q('.editor-hud__reframe');
  const rfX = q('.rf-x'), rfY = q('.rf-y'), rfZ = q('.rf-z');
  function reframeLive() {
    if (!selected) return;
    selected.media = { posX: Number(rfX.value), posY: Number(rfY.value), zoom: Number(rfZ.value) };
    const el = elFor(selected); const m = el && el.querySelector('.media');
    if (m) applyMedia(m, selected.media);
  }
  [rfX, rfY, rfZ].forEach((inp) => { inp.addEventListener('input', reframeLive); inp.addEventListener('change', save); });

  // ── paper background (upload an image; picking a paper color clears it) ──
  const paperFileInput = fileInput('image/*', (f) => uploadPaper(f));
  q('[data-act="paper-img"]').addEventListener('click', () => paperFileInput.click());
  async function uploadPaper(f) {
    toast('uploading background…');
    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'content-type': f.type || 'application/octet-stream', 'x-filename': f.name || 'paper' }, body: await f.arrayBuffer() });
      if (!res.ok) { toast('background upload failed'); return; }
      const { source } = await res.json();
      manifest.paperImage = source; applyBackground(); save();
      toast('background set — pick a paper color to clear it');
    } catch (_) { toast('background error'); }
  }

  // ── shadow (universal: works on any piece type) ────────────────────
  const shadowBtn = q('[data-act="shadow"]');
  const shadowWrap = q('.editor-hud__shadow');
  const shX = q('.sh-x'), shY = q('.sh-y'), shBlur = q('.sh-blur'), shColor = q('.sh-color'), shOp = q('.sh-op');
  function applyShadowTo(piece) { const el = elFor(piece); if (el) applyShadow(el, piece.shadow); }
  function syncShadowUI() {
    const on = !!(selected && selected.shadow);
    shadowWrap.hidden = !on;
    shadowBtn.textContent = on ? 'shadow ✓' : 'shadow';
    if (on) { const s = selected.shadow; shX.value = s.x; shY.value = s.y; shBlur.value = s.blur; shColor.value = s.color || '#000000'; shOp.value = s.opacity != null ? s.opacity : 0.3; }
  }
  shadowBtn.addEventListener('click', () => {
    if (!selected) return;
    selected.shadow = selected.shadow ? null : { x: 4, y: 8, blur: 16, color: '#000000', opacity: 0.3 };
    syncShadowUI(); applyShadowTo(selected); save();
  });
  function shadowLive() {
    if (!selected || !selected.shadow) return;
    selected.shadow = { x: Number(shX.value), y: Number(shY.value), blur: Number(shBlur.value), color: shColor.value, opacity: Number(shOp.value) };
    applyShadowTo(selected);
  }
  [shX, shY, shBlur, shColor, shOp].forEach((i) => { i.addEventListener('input', shadowLive); i.addEventListener('change', save); });

  // ── ＋text / ＋thymer, typography, collection picker ────────────────
  q('[data-act="add-text"]').addEventListener('click', addText);
  q('[data-act="add-thymer"]').addEventListener('click', addThymer);
  const typeWrap = q('.editor-hud__type');
  const tyFont = q('.ty-font'), tyColor = q('.ty-color'), tySize = q('.ty-size');
  const collectionSel = q('.editor-hud__collection');
  function applyTypeTo(piece) { const el = elFor(piece); const c = el && el.querySelector('.slot__content'); if (c) applyTextStyle(c, piece.textStyle); }
  function typeLive() {
    if (!selected) return;
    selected.textStyle = Object.assign({ size: 1 }, selected.textStyle, { font: tyFont.value, color: tyColor.value, size: Number(tySize.value) });
    applyTypeTo(selected);
  }
  tyFont.addEventListener('change', () => { typeLive(); save(); });
  tyColor.addEventListener('input', typeLive); tyColor.addEventListener('change', save);
  tySize.addEventListener('input', typeLive); tySize.addEventListener('change', save);
  function setAlign(a) {
    if (!selected) return;
    selected.textStyle = Object.assign({ size: 1 }, selected.textStyle, { align: a });
    applyTypeTo(selected); save();
  }
  q('[data-act="al-left"]').addEventListener('click', () => setAlign('left'));
  q('[data-act="al-center"]').addEventListener('click', () => setAlign('center'));
  q('[data-act="al-right"]').addEventListener('click', () => setAlign('right'));
  collectionSel.addEventListener('change', () => {
    if (!selected || selected.feed.type !== 'thymer-viewport') return;
    selected.feed.source = collectionSel.value; rebuild();
  });
  (async () => { try { const idx = await (await fetch('./data/thymer/collections.json')).json(); collections = idx.collections || []; } catch (_) {} })();

  // ── motion presets (universal, live preview on the canvas) ─────────
  const moType = q('.mo-type'), moSpeed = q('.mo-speed'), moAmt = q('.mo-amt');
  function motionLive() {
    if (!selected) return;
    selected.motion = { type: moType.value, speed: Number(moSpeed.value), amount: Number(moAmt.value) };
    const el = elFor(selected); const c = el && el.querySelector('.slot__content');
    if (c) applyMotion(c, selected.motion);
  }
  moType.addEventListener('change', () => { motionLive(); save(); });
  moSpeed.addEventListener('input', motionLive); moSpeed.addEventListener('change', save);
  moAmt.addEventListener('input', motionLive); moAmt.addEventListener('change', save);

  const audioWrap = q('.editor-hud__audio'), auVol = q('.au-vol');
  auVol.addEventListener('input', () => {
    if (!selected || selected.feed.type !== 'audio') return;
    selected.audioVol = Number(auVol.value);
    const el = elFor(selected); const a = el && el.querySelector('audio');
    if (a) a.volume = selected.audioVol;
  });
  auVol.addEventListener('change', save);

  // ── unified Add menu (discoverable adds: photo/gif/video/audio/text/…) ──
  const addMenu = document.createElement('div');
  addMenu.className = 'add-menu';
  addMenu.hidden = true;
  addMenu.innerHTML = [
    ['photo', 'Photo'], ['gif', 'GIF (animated)'], ['video', 'Video'], ['audio', 'Audio / music'],
    ['text', 'Text'], ['thymer', 'Thymer feed'], ['color', 'Color fill'],
    ['rect', 'Rectangle'], ['ellipse', 'Ellipse'], ['freeform', 'Freeform shape'],
    ['draw', 'Brush / draw'], ['trace', 'Shape from a photo'],
  ].map(([k, label]) => `<button data-add="${k}">${label}</button>`).join('');
  document.body.appendChild(addMenu);
  const pickMedia = (accept) => { mediaInput.accept = accept; mediaInput.click(); };
  const addActions = {
    photo: () => pickMedia('image/*'), gif: () => pickMedia('image/gif'), video: () => pickMedia('video/*'), audio: () => pickMedia('audio/*'),
    text: () => addText(), thymer: () => addThymer(), color: () => addColor(),
    rect: () => enterShapeMode('rect'), ellipse: () => enterShapeMode('ellipse'), freeform: () => enterShapeMode('freeform'),
    draw: () => (drawing ? exitDraw() : enterDraw()), trace: () => shapeInput.click(),
  };
  addMenu.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { addMenu.hidden = true; const a = addActions[b.dataset.add]; if (a) a(); }));
  const addOpenBtn = q('[data-act="add-open"]');
  addOpenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (addMenu.hidden) { const r = addOpenBtn.getBoundingClientRect(); addMenu.style.left = r.left + 'px'; addMenu.style.bottom = (window.innerHeight - r.top + 6) + 'px'; addMenu.hidden = false; }
    else addMenu.hidden = true;
  });
  window.addEventListener('pointerdown', (e) => { if (!addMenu.hidden && !addMenu.contains(e.target) && e.target !== addOpenBtn) addMenu.hidden = true; });

  // ── canvas zoom control ────────────────────────────────────────────
  const zoomPctEl = q('.zoom-pct');
  const updateZoomPct = () => { if (zoomPctEl) zoomPctEl.textContent = Math.round(zoom.get() * 100) + '%'; };
  q('[data-act="zoom-in"]').addEventListener('click', () => zoom.by(1.2));
  q('[data-act="zoom-out"]').addEventListener('click', () => zoom.by(0.83));
  q('[data-act="zoom-reset"]').addEventListener('click', () => zoom.reset());
  window.addEventListener('cosmos:zoom', updateZoomPct);
  updateZoomPct();

  // ── presentation / installation mode ───────────────────────────────
  q('[data-act="present"]').addEventListener('click', () => present.toggle());
  const frameSel = q('[data-frame]');
  frameSel.value = present.getAspect();
  frameSel.addEventListener('change', () => present.setAspect(frameSel.value));
  const groundBtn = q('[data-act="ground"]');
  const groundVal = groundBtn.querySelector('.ground-val');
  const updateGround = () => { groundVal.textContent = present.getGround(); };
  groundBtn.addEventListener('click', () => present.toggleGround());
  window.addEventListener('cosmos:ground', updateGround);
  updateGround();

  // ── export: headless render of the live piece → file ───────────────
  manifest.export = manifest.export || {};
  if (manifest.export.duration == null) manifest.export.duration = 6;
  if (!manifest.export.quality) manifest.export.quality = 'web';
  const exportMenu = document.createElement('div');
  exportMenu.className = 'add-menu export-menu';
  exportMenu.hidden = true;
  const stillRow = [['jpeg', 'Still · JPEG'], ['png', 'Still · PNG']].map(([k, l]) => `<button data-export="${k}">${l}</button>`).join('');
  const loopRow = [['webm', 'Loop · WebM'], ['mov', 'Loop · MOV'], ['mp4', 'Loop · MP4'], ['gif', 'Loop · GIF']].map(([k, l]) => `<button data-export="${k}">${l}</button>`).join('');
  const durOpts = [3, 4, 6, 8, 12, 16].map((s) => `<option value="${s}"${s === manifest.export.duration ? ' selected' : ''}>${s}s</option>`).join('');
  const qOpts = [['web', 'web'], ['gallery', 'gallery · near-lossless']].map(([v, l]) => `<option value="${v}"${v === manifest.export.quality ? ' selected' : ''}>${l}</option>`).join('');
  exportMenu.innerHTML =
    '<button data-share="1">🔗 Copy view-only link</button>'
    + '<div class="export-menu__head">file exports (baked snapshots)</div>'
    + stillRow
    + `<div class="export-menu__dur">loop ≈ <select data-export-dur>${durOpts}</select> · <select data-export-quality>${qOpts}</select></div>`
    + loopRow;
  document.body.appendChild(exportMenu);
  const durSel = exportMenu.querySelector('[data-export-dur]');
  durSel.addEventListener('change', () => { manifest.export.duration = Number(durSel.value); save(); });
  durSel.addEventListener('pointerdown', (e) => e.stopPropagation());   // don't close the menu when picking
  const qSel = exportMenu.querySelector('[data-export-quality]');
  qSel.addEventListener('change', () => { manifest.export.quality = qSel.value; save(); });
  qSel.addEventListener('pointerdown', (e) => e.stopPropagation());
  async function runExport(format) {
    exportMenu.hidden = true;
    const slow = format !== 'jpeg' && format !== 'png';
    const gallery = manifest.export.quality === 'gallery';
    toast('rendering ' + format + (gallery ? ' · gallery' : '') + (slow ? ` loop — this can take ${gallery ? '~1–2 min' : '~20–40s'}…` : ' — a few seconds…'), 0);
    try {
      const r = await fetch('/api/export', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format, frame: present.getAspect(), duration: manifest.export.duration, quality: manifest.export.quality }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) {
        toast(j.error === 'no-chrome' ? 'export needs Chrome (not found)' : 'export failed: ' + (j.error || r.status), 5000);
        return;
      }
      const a = document.createElement('a');
      a.href = j.url; a.download = j.url.split('/').pop();
      document.body.appendChild(a); a.click(); a.remove();
      toast('exported ' + j.format + (j.duration ? ` · ${j.duration}s seamless` : '') + ' · ' + Math.round(j.bytes / 1024) + ' KB', 4000);
    } catch (e) { toast('export failed: ' + (e.message || e), 5000); }
  }
  exportMenu.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => runExport(b.dataset.export)));
  // the real "export": a configured, view-only link to the LIVE piece — full
  // quality, endless, unmanipulable. This is the piece; files are just snapshots.
  function shareLink() {
    exportMenu.hidden = true;
    const st = zoom.state ? zoom.state() : { zoom: 1, panX: 0, panY: 0 };
    const qp = new URLSearchParams({ project: project.id, share: '1', frame: present.getAspect(), z: st.zoom.toFixed(3), px: String(Math.round(st.panX)), py: String(Math.round(st.panY)) });
    const base = project.publishBase ? project.publishBase.replace(/\/+$/, '') + '/' : location.origin + location.pathname;
    const url = base + '?' + qp.toString();
    const done = () => toast('view-only link copied — anyone with it can watch, not edit', 5000);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => prompt('Copy this view-only link:', url));
    else prompt('Copy this view-only link:', url);
  }
  exportMenu.querySelector('[data-share]').addEventListener('click', shareLink);
  const exportBtn = q('[data-act="export-open"]');
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (exportMenu.hidden) { const r = exportBtn.getBoundingClientRect(); exportMenu.style.left = r.left + 'px'; exportMenu.style.bottom = (window.innerHeight - r.top + 6) + 'px'; exportMenu.hidden = false; }
    else exportMenu.hidden = true;
  });
  window.addEventListener('pointerdown', (e) => { if (!exportMenu.hidden && !exportMenu.contains(e.target) && e.target !== exportBtn) exportMenu.hidden = true; });

  // ── publish: build + push the portals to anthonymichael.work ───────
  const publishBtn = q('[data-act="publish"]');
  publishBtn.addEventListener('click', async () => {
    if (publishBtn.disabled) return;
    publishBtn.disabled = true;
    const label = publishBtn.textContent;
    publishBtn.textContent = '⬆ publishing…';
    toast('publishing to the web — a minute or two…', 0);
    try {
      const j = await (await fetch('/api/publish', { method: 'POST' })).json();
      toast(j.ok ? (j.message || 'published — live in ~1 min') : ('publish failed: ' + (j.error || 'error')), j.ok ? 6000 : 8000);
    } catch (e) { toast('publish failed: ' + (e.message || e), 8000); }
    finally { publishBtn.disabled = false; publishBtn.textContent = label; }
  });

  // ── projects: new / open / save / rename (many living portals) ─────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const projName = () => (project.list.find((p) => p.id === project.id) || {}).name || project.id || 'portal';
  const projNameEl = q('.proj-name');
  if (projNameEl) projNameEl.textContent = projName();
  const projMenu = document.createElement('div');
  projMenu.className = 'add-menu proj-menu';
  projMenu.hidden = true;
  document.body.appendChild(projMenu);
  function renderProjMenu() {
    const list = (project.list || []).map((p) =>
      `<button data-open="${esc(p.id)}"${p.id === project.id ? ' class="is-current"' : ''}>${p.id === project.id ? '● ' : '　 '}${esc(p.name)}</button>`).join('');
    projMenu.innerHTML =
      '<button data-proj="new">＋ New portal…</button>'
      + '<button data-proj="save">Save now</button>'
      + '<button data-proj="rename">Rename…</button>'
      + '<div class="proj-menu__head">open</div>'
      + (list || '<div class="proj-menu__empty">no projects yet</div>');
  }
  renderProjMenu();
  projMenu.addEventListener('click', async (e) => {
    const openId = e.target.closest('[data-open]') && e.target.closest('[data-open]').dataset.open;
    const act = e.target.closest('[data-proj]') && e.target.closest('[data-proj]').dataset.proj;
    if (openId) { projMenu.hidden = true; if (openId !== project.id) location.href = '?project=' + encodeURIComponent(openId); return; }
    if (act === 'new') {
      projMenu.hidden = true;
      const name = prompt('Name this new portal:'); if (!name) return;
      try {
        const j = await (await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })).json();
        if (j.ok) location.href = '?project=' + encodeURIComponent(j.id); else toast('could not create project');
      } catch (_) { toast('could not create project'); }
    } else if (act === 'save') {
      projMenu.hidden = true; save(); toast('saved · ' + projName());
    } else if (act === 'rename') {
      projMenu.hidden = true;
      const cur = projName(); const name = prompt('Rename portal:', cur); if (!name || name === cur) return;
      try {
        const j = await (await fetch('/api/projects/rename', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: project.id, name }) })).json();
        if (j.ok) { const p = project.list.find((x) => x.id === project.id); if (p) p.name = j.name; if (projNameEl) projNameEl.textContent = j.name; toast('renamed'); }
      } catch (_) { toast('rename failed'); }
    }
  });
  const projBtn = q('[data-act="proj-open"]');
  projBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (projMenu.hidden) { renderProjMenu(); const r = projBtn.getBoundingClientRect(); projMenu.style.left = r.left + 'px'; projMenu.style.bottom = (window.innerHeight - r.top + 6) + 'px'; projMenu.hidden = false; }
    else projMenu.hidden = true;
  });
  window.addEventListener('pointerdown', (e) => { if (!projMenu.hidden && !projMenu.contains(e.target) && !projBtn.contains(e.target)) projMenu.hidden = true; });

  renderLayers();

  q('[data-act="add-media"]').addEventListener('click', () => mediaInput.click());
  q('[data-act="add-shape"]').addEventListener('click', () => shapeInput.click());
  q('[data-act="del"]').addEventListener('click', () => selected && deletePiece(selected));
  q('[data-act="front"]').addEventListener('click', () => selected && bring(selected, +1));
  q('[data-act="back"]').addEventListener('click', () => selected && bring(selected, -1));
  q('[data-act="dup"]').addEventListener('click', () => selected && duplicate(selected));
  fitBtn.addEventListener('click', () => {
    if (!selected) return;
    selected.fit = selected.fit === 'contain' ? 'cover' : 'contain';
    rebuild();
  });

  paperInp.addEventListener('input', () => { if (manifest.paperImage) { manifest.paperImage = null; applyBackground(); } setPalette('paper', paperInp.value); });
  inkInp.addEventListener('input', () => setPalette('ink', inkInp.value));

  feedSel.addEventListener('change', () => {
    if (!selected) return;
    selected.feed.type = feedSel.value;
    if (FEEDS[feedSel.value] && FEEDS[feedSel.value].source) selected.feed.source = FEEDS[feedSel.value].source;
    rebuild();
  });
  srcInp.addEventListener('change', () => { if (selected) { selected.feed.source = srcInp.value; rebuild(); } });
  shapeSel.addEventListener('change', async () => {
    if (!selected) return;
    selected.shape = shapeSel.value || null;
    if (selected.shape) { await loadShape(selected.shape); aspectLock(selected); }
    rebuild();
  });
  fillInp.addEventListener('input', () => {
    if (!selected) return;
    selected.style = Object.assign({}, selected.style, { background: fillInp.value });
    rebuild();
  });

  window.addEventListener('cosmos:saved', () => {
    saveEl.hidden = false; saveEl.style.opacity = '1';
    setTimeout(() => { saveEl.style.opacity = '0.4'; }, 200);
  });

  // stage drag-drop upload
  stage.addEventListener('dragover', (e) => { if (!editing) return; e.preventDefault(); stage.classList.add('drop-over'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('drop-over'));
  stage.addEventListener('drop', (e) => {
    if (!editing) return;
    e.preventDefault(); stage.classList.remove('drop-over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadMedia(f, dropToPct(e.clientX, e.clientY, stage.getBoundingClientRect()));
  });

  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if (e.key === 'e') { toggle(); return; }
    if (!editing) return;
    if (e.key === 'Escape') { if (shapeMode) exitShapeMode(); else if (drawing) exitDraw(); else select(null); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { if (selected) { deletePiece(selected); e.preventDefault(); } }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) { if (selected) { duplicate(selected); e.preventDefault(); } }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.shiftKey ? redo() : undo(); e.preventDefault(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || e.key === 'Y')) { redo(); e.preventDefault(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) { copySel(); e.preventDefault(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'x' || e.key === 'X')) { cutSel(); e.preventDefault(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) { paste(); e.preventDefault(); }
    else if (e.key === ']') { if (selected) bring(selected, +1); }
    else if (e.key === '[') { if (selected) bring(selected, -1); }
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { if (selected) { nudge(selected, e.key, e.shiftKey); e.preventDefault(); } }
  });

  function toggle() {
    editing = !editing;
    document.body.classList.toggle('is-editing', editing);
    hud.hidden = !editing;
    if (editing) { attachAll(); renderLayers(); }
    else { if (drawing) exitDraw(); if (shapeMode) exitShapeMode(); select(null); toastEl.hidden = true; clearTimeout(toastTimer); }
  }

  function attachAll() {
    stage.querySelectorAll('.slot').forEach((el) => {
      if (el.__wired) return;
      el.__wired = true;
      const rz = document.createElement('div'); rz.className = 'slot__resize'; el.appendChild(rz);
      const rot = document.createElement('div'); rot.className = 'slot__rotate'; el.appendChild(rot);
      el.addEventListener('dblclick', () => {
        if (!editing) return;
        const p = pieceFor(el);
        if (p && p.feed.type === 'text') editText(p, el);
      });
      el.addEventListener('pointerdown', (ev) => {
        if (!editing || drawing || shapeMode || textEditing) return;
        const piece = pieceFor(el);
        select(piece);
        if (ev.target === rz) startResize(ev, piece, el);
        else if (ev.target === rot) startRotate(ev, piece, el);
        else startDrag(ev, piece, el);
        ev.preventDefault();
      });
    });
  }

  const pieceFor = (el) => manifest.pieces.find((p) => p.id === el.dataset.slot);
  const elFor = (piece) => stage.querySelector('.slot[data-slot="' + piece.id + '"]');

  function rebuild() { recompose(); attachAll(); if (selected) select(selected); save(); }

  function startDrag(ev, piece, el) {
    const rect = stage.getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY;
    const p = piece.place, l0 = p.leftPct ?? 50, t0 = p.topPct ?? 50;
    lift((e) => {
      p.leftPct = clamp(l0 + (e.clientX - sx) / rect.width * 100, 2, 98);
      p.topPct = clamp(t0 + (e.clientY - sy) / rect.height * 100, 2, 98);
      applyPlace(el, p);
    }, save);
  }

  function startResize(ev, piece, el) {
    const rect = stage.getBoundingClientRect();
    const stageAspect = rect.width / rect.height;
    const sx = ev.clientX, sy = ev.clientY;
    const p = piece.place;
    const w0 = p.widthPct ?? (el.offsetWidth / rect.width * 100);
    const h0 = p.heightPct ?? (el.offsetHeight / rect.height * 100);
    const ratio = piece.shape ? getShapeRatioSync(piece.shape) : null;
    lift((e) => {
      const w = clamp(w0 + (e.clientX - sx) / rect.width * 200, 5, 98);
      p.widthPct = w;
      if (ratio && !e.altKey) p.heightPct = clamp(w * stageAspect / ratio, 5, 300);
      else p.heightPct = clamp(h0 + (e.clientY - sy) / rect.height * 200, 5, 98);
      applyPlace(el, p);
    }, save);
  }

  function startRotate(ev, piece, el) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const p = piece.place;
    const start = Math.atan2(ev.clientY - cy, ev.clientX - cx);
    const base = p.rotationDeg || 0;
    lift((e) => {
      let deg = Math.round(base + (Math.atan2(e.clientY - cy, e.clientX - cx) - start) * 180 / Math.PI);
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      p.rotationDeg = deg;
      applyPlace(el, p);
    }, save);
  }

  function lift(move, done) {
    function up() { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); done(); }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function select(piece) {
    selected = piece;
    stage.querySelectorAll('.slot.is-selected').forEach((n) => n.classList.remove('is-selected'));
    selWrap.hidden = !piece;
    if (!piece) { reframeWrap.hidden = true; shadowWrap.hidden = true; typeWrap.hidden = true; collectionSel.hidden = true; audioWrap.hidden = true; renderLayers(); return; }
    const el = elFor(piece); if (el) el.classList.add('is-selected');
    idEl.textContent = '#' + piece.id;
    feedSel.value = piece.feed.type;
    srcInp.value = piece.feed.source || '';
    shapeSel.value = piece.shape || '';
    fillInp.value = hexOf(piece.style && piece.style.background, '#000000');
    fitBtn.textContent = 'fit: ' + (piece.fit || 'cover');
    const isMedia = piece.feed.type === 'image' || piece.feed.type === 'video';
    reframeWrap.hidden = !isMedia;
    if (isMedia) {
      const md = piece.media || {};
      rfX.value = md.posX != null ? md.posX : 50;
      rfY.value = md.posY != null ? md.posY : 50;
      rfZ.value = md.zoom != null ? md.zoom : 1;
    }
    syncShadowUI();
    const isText = piece.feed.type === 'text' || piece.feed.type === 'epigram' || piece.feed.type === 'thymer-viewport';
    typeWrap.hidden = !isText;
    if (isText) {
      const ts = piece.textStyle || {};
      tyFont.value = ts.font || '';
      tyColor.value = /^#[0-9a-fA-F]{6}$/.test(ts.color || '') ? ts.color : '#171310';
      tySize.value = ts.size != null ? ts.size : 1;
    }
    const isThymer = piece.feed.type === 'thymer-viewport';
    collectionSel.hidden = !isThymer;
    if (isThymer) {
      collectionSel.innerHTML = '';
      for (const c of collections) { const o = document.createElement('option'); o.value = c.file; o.textContent = c.name; collectionSel.appendChild(o); }
      collectionSel.value = piece.feed.source || '';
    }
    const mo = piece.motion || {};
    moType.value = mo.type || 'none';
    moSpeed.value = mo.speed != null ? mo.speed : 1;
    moAmt.value = mo.amount != null ? mo.amount : 1;
    const isAudio = piece.feed.type === 'audio';
    audioWrap.hidden = !isAudio;
    if (isAudio) auVol.value = piece.audioVol != null ? piece.audioVol : 0.8;
    renderLayers();
  }

  function setPalette(key, value) {
    manifest.palette = Object.assign({}, manifest.palette, { [key]: value });
    applyPalette(); save();
  }

  function aspectLock(piece) {
    const ratio = getShapeRatioSync(piece.shape);
    if (!ratio) return;
    const rect = stage.getBoundingClientRect();
    const stageAspect = rect.width / rect.height;
    const w = piece.place.widthPct ?? 30;
    piece.place.widthPct = w;
    piece.place.heightPct = clamp(w * stageAspect / ratio, 5, 300);
  }

  function centerPt() { return { leftPct: 50, topPct: 50 }; }

  function bring(piece, dir) { piece.z = dir > 0 ? maxZ() + 1 : minZ() - 1; rebuild(); }

  function nudge(piece, key, big) {
    const d = big ? 2 : 0.5;
    const p = piece.place;
    if (key === 'ArrowUp') p.topPct = clamp((p.topPct ?? 50) - d, 2, 98);
    if (key === 'ArrowDown') p.topPct = clamp((p.topPct ?? 50) + d, 2, 98);
    if (key === 'ArrowLeft') p.leftPct = clamp((p.leftPct ?? 50) - d, 2, 98);
    if (key === 'ArrowRight') p.leftPct = clamp((p.leftPct ?? 50) + d, 2, 98);
    const el = elFor(piece); if (el) applyPlace(el, p); save();
  }

  function duplicate(piece) {
    const copy = JSON.parse(JSON.stringify(piece));
    delete copy.id;
    delete copy.z;   // let addPiece put the duplicate on top
    copy.place.leftPct = clamp((copy.place.leftPct ?? 50) + 3, 2, 98);
    copy.place.topPct = clamp((copy.place.topPct ?? 50) + 3, 2, 98);
    const np = addPiece(copy);
    attachAll(); select(np); save();
  }

  function deletePiece(piece) {
    const i = manifest.pieces.indexOf(piece);
    if (i >= 0) manifest.pieces.splice(i, 1);
    select(null); recompose(); attachAll(); save();
  }

  async function uploadMedia(file, pt) {
    toast('uploading ' + (file.name || 'media') + '…');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream', 'x-filename': file.name || 'upload' },
        body: await file.arrayBuffer(),
      });
      if (!res.ok) { toast('upload failed (' + res.status + ')'); return; }
      const { source, type, width, height } = await res.json();
      if (type === 'audio') {
        const place = Object.assign({ widthPct: 7, heightPct: 5, rotationDeg: 0 }, pt || centerPt());
        const p = addPiece({ feed: { type: 'audio', source }, place, autoplay: true, audioVol: 0.8, shape: null });
        attachAll(); select(p); save();
        toast('sound placed — it loops and layers with any other audio');
        return;
      }
      const rect = stage.getBoundingClientRect();
      const stageAspect = rect.width / rect.height;
      const widthPct = 32;
      const heightPct = (width && height) ? clamp(widthPct * (height / width) * stageAspect, 6, 90) : 24;
      const place = Object.assign({ widthPct, heightPct, rotationDeg: 0 }, pt || centerPt());
      const piece = addPiece({ feed: { type, source }, place, fit: 'cover', shape: null });
      attachAll(); select(piece); save();
      toast('placed — drag it, resize it, or set it inside a shape');
    } catch (e) { toast('upload error'); }
  }

  const maskScopeChoice = () => (confirm('Add to the GLOBAL library (usable in every portal)?\n\nOK = global library\nCancel = just this portal') ? 'global' : projId);

  async function uploadShape(file) {
    const suggested = (file.name || 'shape').replace(/\.[^.]+$/, '');
    const name = prompt('Name this mask:', suggested);
    if (name === null) return;                       // cancelled
    const nm = name.trim() || suggested;
    const scope = maskScopeChoice();
    toast('tracing your shape…');
    try {
      const res = await fetch('/api/shape', {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream', 'x-shape-name': nm, 'x-shape-scope': scope },
        body: await file.arrayBuffer(),
      });
      if (res.status === 422) { toast("couldn't read that shape — re-shoot a SOLID filled shape on white"); return; }
      if (!res.ok) { toast('shape upload failed (' + res.status + ')'); return; }
      const { id } = await res.json();
      addShapeOption(id, nm, scope);
      await loadShape(id);
      if (selected) {
        selected.shape = id; aspectLock(selected); rebuild();
        toast('mask made — your media now pours through your line');
      } else {
        toast('shape added to the mask picker — select a piece and apply it');
      }
    } catch (e) { toast('shape error'); }
  }

  const projId = (project && project.id) || 'global';
  function optGroup(label) {
    let g = [...shapeSel.querySelectorAll('optgroup')].find((x) => x.label === label);
    if (!g) { g = document.createElement('optgroup'); g.label = label; shapeSel.appendChild(g); }
    return g;
  }
  function addShapeOption(id, name, scope) {
    if ([...shapeSel.options].some((o) => o.value === id)) return;
    const mine = scope && scope === projId;
    const g = optGroup(mine ? 'This portal' : 'Library');
    const o = document.createElement('option'); o.value = id; o.textContent = name || id;
    g.appendChild(o);
  }

  async function loadShapes() {
    try {
      const idx = await (await fetch('./assets/shapes/index.json?t=' + Date.now())).json();
      const meta = idx.meta || {};
      // 'This portal' first, then 'Library'
      const ids = idx.shapes || [];
      for (const id of ids) { const m = meta[id] || {}; if ((m.scope || 'global') === projId) addShapeOption(id, m.name || id, m.scope || 'global'); }
      for (const id of ids) { const m = meta[id] || {}; if ((m.scope || 'global') !== projId) addShapeOption(id, m.name || id, m.scope || 'global'); }
    } catch (_) {}
  }

  // ── the brush (draw mode) ──────────────────────────────────────────
  function enterDraw() {
    if (drawing) return;
    if (!editing) toggle();
    if (shapeMode) exitShapeMode();
    drawing = true;
    document.body.classList.add('is-drawing');
    brushWrap.hidden = false;
    drawBtn.textContent = '✏ drawing';
    ensureDrawingPiece();
    drawSurface = document.createElement('div');
    drawSurface.className = 'draw-surface';
    stage.appendChild(drawSurface);
    drawSurface.addEventListener('pointerdown', beginStroke);
  }
  function exitDraw() {
    if (!drawing) return;
    drawing = false;
    document.body.classList.remove('is-drawing');
    brushWrap.hidden = true;
    drawBtn.textContent = '✏ draw';
    if (drawSurface) { drawSurface.remove(); drawSurface = null; }
  }
  function ensureDrawingPiece() {
    if (selected && selected.feed.type === 'drawing') { activeDrawing = selected; return; }
    const existing = [...manifest.pieces].reverse().find((p) => p.feed.type === 'drawing');
    if (existing) { activeDrawing = existing; select(existing); return; }
    activeDrawing = addPiece({
      feed: { type: 'drawing', source: '' },
      place: { leftPct: 50, topPct: 50, widthPct: 100, heightPct: 100, rotationDeg: 0 },
      strokes: [], fit: 'cover', shape: null,
    });
    attachAll(); select(activeDrawing);
  }
  function drawingSvg(piece) {
    const el = elFor(piece);
    const c = el && el.querySelector('.slot__content');
    return c && c.querySelector('svg.media--drawing');
  }
  function makeStroke(s) {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', s.d); p.setAttribute('fill', s.fill || 'none');
    p.setAttribute('stroke', s.color || '#171310'); p.setAttribute('stroke-width', String(s.width || 6));
    p.setAttribute('stroke-linecap', s.cap || 'round'); p.setAttribute('stroke-linejoin', 'round');
    if (s.opacity != null) p.setAttribute('stroke-opacity', String(s.opacity));
    return p;
  }
  function beginStroke(e) {
    if (!activeDrawing) ensureDrawingPiece();
    const piece = activeDrawing;
    const el = elFor(piece);
    const content = el && el.querySelector('.slot__content');
    const svg = content && content.querySelector('svg.media--drawing');
    if (!svg) return;
    const box = content.getBoundingClientRect();
    const toVB = (cx, cy) => [(cx - box.left) / box.width * 1000, (cy - box.top) / box.height * 1000];
    const pts = [toVB(e.clientX, e.clientY)];
    const path = makeStroke({ d: '', color: brush.color, width: brush.width, cap: brush.cap, opacity: brush.opacity });
    svg.appendChild(path);
    path.setAttribute('d', pathData(pts));
    try { drawSurface.setPointerCapture(e.pointerId); } catch (_) {}
    function move(ev) {
      const q2 = toVB(ev.clientX, ev.clientY);
      const last = pts[pts.length - 1];
      if (Math.hypot(q2[0] - last[0], q2[1] - last[1]) < 2) return;
      pts.push(q2); path.setAttribute('d', pathData(pts));
    }
    function up() {
      drawSurface.removeEventListener('pointermove', move);
      drawSurface.removeEventListener('pointerup', up);
      if (pts.length > 1) {
        piece.strokes = piece.strokes || [];
        piece.strokes.push({ d: pathData(pts), color: brush.color, width: brush.width, cap: brush.cap, opacity: brush.opacity, fill: 'none' });
        save();
      } else { path.remove(); }
    }
    drawSurface.addEventListener('pointermove', move);
    drawSurface.addEventListener('pointerup', up);
    e.preventDefault();
  }
  function pathData(pts) {
    if (!pts.length) return '';
    if (pts.length === 1) return `M ${rnd(pts[0][0])} ${rnd(pts[0][1])}`;
    let d = `M ${rnd(pts[0][0])} ${rnd(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q ${rnd(pts[i][0])} ${rnd(pts[i][1])} ${rnd(mx)} ${rnd(my)}`;
    }
    const L = pts[pts.length - 1];
    d += ` L ${rnd(L[0])} ${rnd(L[1])}`;
    return d;
  }
  function undoStroke() {
    const piece = activeDrawing;
    if (!piece || !piece.strokes || !piece.strokes.length) return;
    piece.strokes.pop();
    const svg = drawingSvg(piece);
    if (svg) { while (svg.lastChild) svg.removeChild(svg.lastChild); for (const s of piece.strokes) svg.appendChild(makeStroke(s)); }
    save();
  }

  // ── shape tool (rect / ellipse / freeform) ─────────────────────────
  function enterShapeMode(kind) {
    if (!editing) toggle();
    if (drawing) exitDraw();
    if (shapeSurface) { shapeSurface.remove(); shapeSurface = null; }   // never stack surfaces
    shapeMode = kind;
    document.body.classList.add('is-shaping');
    shapeSurface = document.createElement('div');
    shapeSurface.className = 'draw-surface';
    stage.appendChild(shapeSurface);
    shapeSurface.addEventListener('pointerdown', beginShape);
    toast('drag to draw a ' + kind + ' — Esc (or the ' + kind + ' button) to cancel');
  }
  function exitShapeMode() {
    shapeMode = null;
    document.body.classList.remove('is-shaping');
    if (shapeSurface) { shapeSurface.remove(); shapeSurface = null; }
    toastEl.hidden = true; clearTimeout(toastTimer);
  }
  function beginShape(e) {
    const rect = stage.getBoundingClientRect();
    const kind = shapeMode;
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const pts = [[sx, sy]];
    const prev = document.createElementNS(SVGNS, 'svg');
    prev.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    prev.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    shapeSurface.appendChild(prev);
    const shp = document.createElementNS(SVGNS, kind === 'freeform' ? 'path' : (kind === 'ellipse' ? 'ellipse' : 'rect'));
    shp.setAttribute('fill', brush.color);
    shp.setAttribute('fill-opacity', '0.55');
    prev.appendChild(shp);
    try { shapeSurface.setPointerCapture(e.pointerId); } catch (_) {}
    function move(ev) {
      const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      if (kind === 'freeform') { pts.push([x, y]); shp.setAttribute('d', pathData(pts) + ' Z'); }
      else {
        const left = Math.min(sx, x), top = Math.min(sy, y), w = Math.abs(x - sx), h = Math.abs(y - sy);
        if (kind === 'ellipse') { shp.setAttribute('cx', left + w / 2); shp.setAttribute('cy', top + h / 2); shp.setAttribute('rx', w / 2); shp.setAttribute('ry', h / 2); }
        else { shp.setAttribute('x', left); shp.setAttribute('y', top); shp.setAttribute('width', w); shp.setAttribute('height', h); }
      }
    }
    function up(ev) {
      const fx = ev.clientX - rect.left, fy = ev.clientY - rect.top;
      shapeSurface.removeEventListener('pointermove', move);
      shapeSurface.removeEventListener('pointerup', up);
      exitShapeMode();                 // remove the surface FIRST — never get stuck
      finalizeShape(kind, sx, sy, fx, fy, rect, pts);
    }
    shapeSurface.addEventListener('pointermove', move);
    shapeSurface.addEventListener('pointerup', up);
    e.preventDefault();
  }
  function finalizeShape(kind, sx, sy, ex, ey, rect, pts) {
    let box, d = null;
    if (kind === 'freeform') {
      if (pts.length < 3) return;
      let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (const p of pts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
      box = { left: minx, top: miny, w: Math.max(6, maxx - minx), h: Math.max(6, maxy - miny) };
      const npts = pts.map((p) => [(p[0] - box.left) / box.w * 1000, (p[1] - box.top) / box.h * 1000]);
      d = pathData(npts) + ' Z';
    } else {
      const left = Math.min(sx, ex), top = Math.min(sy, ey), w = Math.abs(ex - sx), h = Math.abs(ey - sy);
      if (w < 8 || h < 8) return;
      box = { left, top, w, h };
    }
    const place = {
      leftPct: clamp((box.left + box.w / 2) / rect.width * 100, 2, 98),
      topPct: clamp((box.top + box.h / 2) / rect.height * 100, 2, 98),
      widthPct: clamp(box.w / rect.width * 100, 2, 100),
      heightPct: clamp(box.h / rect.height * 100, 2, 100),
      rotationDeg: 0,
    };
    const shapeDef = { kind }; if (d) shapeDef.d = d;
    const piece = addPiece({ feed: { type: 'shape', source: '' }, shapeDef, place, style: { background: brush.color }, shape: null, fit: 'cover' });
    attachAll(); select(piece); save();
  }
  async function useAsMask(piece) {
    if (!piece || piece.feed.type !== 'shape') return;
    const def = piece.shapeDef || { kind: 'rect' };
    let d;
    if (def.kind === 'ellipse') d = 'M 0 0.5 A 0.5 0.5 0 1 0 1 0.5 A 0.5 0.5 0 1 0 0 0.5 Z';
    else if (def.kind === 'freeform') d = String(def.d || '').replace(/-?\d*\.?\d+/g, (n) => (+n / 1000).toFixed(5));
    else d = 'M 0 0 H 1 V 1 H 0 Z';
    const name = prompt('Name this mask:', def.kind + ' mask');
    if (name === null) return;
    const nm = name.trim() || (def.kind + ' mask');
    const scope = maskScopeChoice();
    const rect = stage.getBoundingClientRect();
    const ratio = (piece.place.widthPct / 100 * rect.width) / (piece.place.heightPct / 100 * rect.height) || 1;
    try {
      const res = await fetch('/api/shape-path', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: nm, d, ratio, scope }) });
      if (!res.ok) { toast('could not save mask'); return; }
      const { id } = await res.json();
      addShapeOption(id, nm, scope); await loadShape(id);
      toast('“' + nm + '” saved to ' + (scope === 'global' ? 'the library' : 'this portal'));
    } catch (_) { toast('mask save error'); }
  }

  // ── rich-text editing + ＋text / ＋thymer ───────────────────────────
  function editText(piece, el) {
    const block = el.querySelector('.text-block');
    if (!block) return;
    textEditing = piece;
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); block.blur(); } };
    const onBlur = () => commitText(piece, block, onBlur, onKey);
    block.setAttribute('contenteditable', 'true');
    block.focus();
    block.addEventListener('blur', onBlur);
    block.addEventListener('keydown', onKey);
  }
  function commitText(piece, block, onBlur, onKey) {
    block.removeEventListener('blur', onBlur);
    block.removeEventListener('keydown', onKey);
    block.setAttribute('contenteditable', 'false');
    piece.text = block.textContent;
    textEditing = null;
    save();
  }
  function addText() {
    const p = addPiece({ feed: { type: 'text', source: '' }, text: 'Double-click to edit', place: { leftPct: 50, topPct: 45, widthPct: 34, heightPct: 12, rotationDeg: 0 }, textStyle: { size: 1 }, shape: null });
    attachAll(); select(p); save();
  }
  function addThymer() {
    const src = (collections[0] && collections[0].file) || 'data/thymer/natural-observations.json';
    const p = addPiece({ feed: { type: 'thymer-viewport', source: src }, place: { leftPct: 50, topPct: 45, widthPct: 34, heightPct: 30, rotationDeg: 0 }, shape: null, textStyle: { size: 1 } });
    attachAll(); select(p); save();
  }
  function addColor() {
    const p = addPiece({ feed: { type: 'color', source: '' }, place: { leftPct: 50, topPct: 50, widthPct: 20, heightPct: 15, rotationDeg: 0 }, style: { background: '#c9a5d8' }, shape: null });
    attachAll(); select(p); save();
  }
  function toggleShadowQuick() {
    if (!selected) return;
    selected.shadow = selected.shadow ? null : { x: 4, y: 8, blur: 16, color: '#000000', opacity: 0.3 };
    const el = elFor(selected); if (el) applyShadow(el, selected.shadow);
    syncShadowUI(); save();
  }

  window.__editor = {
    toggle, addPiece, deletePiece, select, uploadMedia, uploadShape, enterDraw, exitDraw,
    undo, redo, copySel, cutSel, paste, enterShapeMode, useAsMask, addText, addThymer,
    get editing() { return editing; },
    get selected() { return selected; },
    get drawing() { return drawing; },
    get historyLen() { return history.length; },
  };
}

const SVGNS = 'http://www.w3.org/2000/svg';
const rnd = (n) => Math.round(n * 10) / 10;
function isTyping(e) {
  const t = e.target;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
function hexOf(v, fallback) { return (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) ? v : fallback; }
