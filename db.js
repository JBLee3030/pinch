// All storage goes through here. Swap this file for a cloud backend later.
export const STORES = ['ingredients', 'recipes', 'logs', 'settings', 'temps'];
let dbp;

function open() {
  return dbp ??= new Promise((res, rej) => {
    // v2 added 'temps'. Upgrades only create missing stores, so existing data is untouched.
    const r = indexedDB.open('pinch', 2);
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

export const all = s => tx(s, 'readonly', t => t.objectStore(s).getAll());
export const get = (s, id) => tx(s, 'readonly', t => t.objectStore(s).get(id));
export const put = (s, obj) => tx(s, 'readwrite', t => t.objectStore(s).put(obj));
export const del = (s, id) => tx(s, 'readwrite', t => t.objectStore(s).delete(id));

export async function exportAll() {
  const out = { app: 'pinch', version: 1, exportedAt: new Date().toISOString() };
  for (const s of STORES) out[s] = await all(s);
  return out;
}

// Replaces everything in one transaction: either the whole backup lands or nothing changes.
// Stores missing from older backups (e.g. 'temps') import as empty.
export function importAll(data) {
  const rows = s => data[s] ?? [];
  if (data?.app !== 'pinch' || !STORES.every(s => Array.isArray(rows(s)) && rows(s).every(o => o && typeof o.id === 'string'))) {
    throw new Error('Not a Pinch backup file');
  }
  return tx(STORES, 'readwrite', t => {
    for (const s of STORES) {
      const st = t.objectStore(s);
      st.clear();
      rows(s).forEach(o => st.put(o));
    }
  });
}
