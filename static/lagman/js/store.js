// store.js — IndexedDB persistence, wrapped in a tiny promise API.
//
// Local-first: the archive lives in the browser on the device that scored it.
// This module is the ONLY thing that touches storage, so the backend can be
// swapped (a serverless collector for the public scoreboard, say) without any
// view knowing. Object stores:
//   bowls   — the archive        (keyPath: id)
//   drafts  — in-progress sheets  (keyPath: key; 'new' or a bowl id)
//   meta    — counters & settings (keyPath: key)

const DB_NAME = 'lagman-log';
const DB_VERSION = 1;

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('bowls')) {
        const s = db.createObjectStore('bowls', { keyPath: 'id' });
        s.createIndex('bowlNumber', 'bowlNumber', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    Promise.resolve(fn(os)).then((r) => { result = r; }).catch(reject);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Bowls ------------------------------------------------------------------
export async function allBowls() {
  const bowls = await tx('bowls', 'readonly', (os) => reqP(os.getAll()));
  return bowls.sort((a, b) => (b.bowlNumber || 0) - (a.bowlNumber || 0));
}
export function getBowl(id) { return tx('bowls', 'readonly', (os) => reqP(os.get(id))); }
export function putBowl(bowl) { return tx('bowls', 'readwrite', (os) => reqP(os.put(bowl))).then(() => bowl); }
export function deleteBowl(id) { return tx('bowls', 'readwrite', (os) => reqP(os.delete(id))); }

// Next bowl number = max existing + 1, tracked in meta so deletes don't reuse.
export async function nextBowlNumber() {
  const bowls = await allBowls();
  const maxInArchive = bowls.reduce((m, b) => Math.max(m, b.bowlNumber || 0), 0);
  const counter = (await getMeta('bowlCounter')) || 0;
  return Math.max(maxInArchive, counter) + 1;
}
export async function bumpBowlCounter(n) {
  const cur = (await getMeta('bowlCounter')) || 0;
  if (n > cur) await setMeta('bowlCounter', n);
}

// ---- Drafts (auto-save so a half-finished sheet survives a closed tab) ------
export function getDraft(key = 'new') { return tx('drafts', 'readonly', (os) => reqP(os.get(key))).then((d) => (d ? d.data : null)); }
export function saveDraft(key, data) { return tx('drafts', 'readwrite', (os) => reqP(os.put({ key, data, savedAt: new Date().toISOString() }))); }
export function clearDraft(key = 'new') { return tx('drafts', 'readwrite', (os) => reqP(os.delete(key))); }
export function allDraftKeys() { return tx('drafts', 'readonly', (os) => reqP(os.getAllKeys())); }

// ---- Meta -------------------------------------------------------------------
export function getMeta(key) { return tx('meta', 'readonly', (os) => reqP(os.get(key))).then((m) => (m ? m.value : null)); }
export function setMeta(key, value) { return tx('meta', 'readwrite', (os) => reqP(os.put({ key, value }))); }

// ---- Bulk (import / restore) ------------------------------------------------
export async function replaceAll(bowls) {
  await tx('bowls', 'readwrite', (os) => reqP(os.clear()));
  await tx('bowls', 'readwrite', async (os) => { for (const b of bowls) await reqP(os.put(b)); });
  const max = bowls.reduce((m, b) => Math.max(m, b.bowlNumber || 0), 0);
  await setMeta('bowlCounter', max);
}
export async function importMerge(bowls) {
  await tx('bowls', 'readwrite', async (os) => { for (const b of bowls) await reqP(os.put(b)); });
  const max = bowls.reduce((m, b) => Math.max(m, b.bowlNumber || 0), 0);
  await bumpBowlCounter(max);
}
