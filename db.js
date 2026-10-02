// All storage goes through here. IndexedDB is the source of truth; sync.js mirrors it to the cloud.
// Every local write stamps `_ts` (edit time, last write wins) and `_dirty` (not yet pushed).
// Deletes keep a tombstone `{ id, _deleted }` so other devices learn about them; reads hide tombstones.
export const STORES = ['ingredients', 'recipes', 'logs', 'settings', 'temps', 'attempts'];
// ?demo opens a separate database filled with sample data, so a visitor (or you) can explore
// without touching real data. Sync is off in demo mode.
export const DEMO = new URLSearchParams(globalThis.location?.search ?? '').has('demo');
let dbp;

function open() {
  return dbp ??= new Promise((res, rej) => {
    // v2 added 'temps', v3 'attempts'. Upgrades only create missing stores, so existing data is untouched.
    const r = indexedDB.open(DEMO ? 'pinch-demo' : 'pinch', 3);
    r.onupgradeneeded = () => STORES.forEach(s => r.result.objectStoreNames.contains(s) || r.result.createObjectStore(s, { keyPath: 'id' }));
    r.onsuccess = () => {
      r.result.onversionchange = () => r.result.close(); // let a newer version in another tab upgrade
      res(r.result);
    };
    r.onerror = () => rej(r.error);
  });
}

async function tx(stores, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(stores, mode);
    const req = fn(t);
    t.oncomplete = () => res(req?.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
}

let onChange = () => {};
export const setOnChange = fn => { onChange = fn; };
const visible = o => (o && !o._deleted ? o : undefined);
const write = (s, obj) => tx(s, 'readwrite', t => t.objectStore(s).put({ ...obj, _ts: Date.now(), _dirty: true })).then(r => (onChange(), r));

export const all = s => tx(s, 'readonly', t => t.objectStore(s).getAll()).then(rows => rows.filter(visible));
export const get = (s, id) => tx(s, 'readonly', t => t.objectStore(s).get(id)).then(visible);
export const put = (s, obj) => write(s, obj);
export const del = (s, id) => write(s, { id, _deleted: true });

// ---- For sync.js only: raw rows including tombstones, and writes that don't mark dirty.
export const allRaw = s => tx(s, 'readonly', t => t.objectStore(s).getAll());

// A row pushed from edit time `from` is now clean at `ts`, unless it was edited again mid-push.
export const markClean = (s, id, from, ts) => tx(s, 'readwrite', t => {
  const st = t.objectStore(s), req = st.get(id);
  req.onsuccess = () => { if (req.result && req.result._ts === from) st.put({ ...req.result, _ts: ts, _dirty: false }); };
});

// Last write wins: a remote row replaces the local one only if its edit time is newer.
export const remoteWins = (local, ts) => !local || ts > (local._ts ?? 0);
export function applyRemote(s, row) {
  let applied = false;
  return tx(s, 'readwrite', t => {
    const st = t.objectStore(s), req = st.get(row.id);
    req.onsuccess = () => { if (remoteWins(req.result, row._ts)) { st.put({ ...row, _dirty: false }); applied = true; } };
  }).then(() => applied);
}

// ---- Backup
const strip = ({ _ts, _dirty, ...rest }) => rest;

export async function exportAll() {
  const out = { app: 'pinch', version: 1, exportedAt: new Date().toISOString() };
  for (const s of STORES) out[s] = (await all(s)).map(strip);
  return out;
}

// Replaces everything in one transaction: either the whole backup lands or nothing changes.
// Stores missing from older backups (e.g. 'temps') import as empty. Imported rows sync as new edits.
export function importAll(data) {
  const rows = s => data[s] ?? [];
  if (data?.app !== 'pinch' || !STORES.every(s => Array.isArray(rows(s)) && rows(s).every(o => o && typeof o.id === 'string'))) {
    throw new Error('Not a Pinch backup file');
  }
  const ts = Date.now();
  return tx(STORES, 'readwrite', t => {
    for (const s of STORES) {
      const st = t.objectStore(s);
      st.clear();
      rows(s).forEach(o => st.put({ ...strip(o), _ts: ts, _dirty: true }));
    }
  }).then(r => (onChange(), r));
}
