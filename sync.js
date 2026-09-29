// Optional cloud sync with Supabase: email + password auth, one `items` table (see supabase.sql).
// Local-first: the app always reads/writes IndexedDB; sync pushes dirty rows, then pulls rows
// changed on the server since this device's cursor. Conflicts: last edit wins (row `_ts`).
import * as db from './db.js';

const BASE = 'https://xxghzuhtstmxizfwvypv.supabase.co';
const KEY = 'sb_publishable_y3e8tivy9Dgz5OJSbGV6TA_5c9XsR-v'; // publishable client key; data is protected by row-level security
const LS = 'pinch.sync';
const PAGE = 500;

// Per-device state: session tokens, pull cursor, last result. Not synced itself.
let state = {};
try { state = JSON.parse(localStorage.getItem(LS)) ?? {}; } catch {}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch {} };

let syncing = false, again = false, timer;
const listeners = new Set();
export const onStatus = fn => listeners.add(fn);
const notify = changed => listeners.forEach(fn => fn({ ...status(), changed }));
export const status = () => ({ email: state.session?.email, lastSync: state.lastSync, error: state.error, syncing });

async function api(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...headers };
  // auth: true = current session, a string = that access token (password recovery), false = anonymous
  if (auth) h.Authorization = 'Bearer ' + (typeof auth === 'string' ? auth : await accessToken());
  const res = await fetch(BASE + path, { method, headers: h, body: body && JSON.stringify(body) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = json?.msg || json?.message || json?.error_description || json?.error || `${res.status} ${res.statusText}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return json;
}

// ---- Auth

function setSession(s) {
  state.session = { access_token: s.access_token, refresh_token: s.refresh_token,
    expires_at: Date.now() + s.expires_in * 1000, email: s.user?.email ?? state.session?.email };
  save();
}

let refreshing;
async function accessToken() {
  const s = state.session;
  if (!s) throw new Error('Not signed in');
  if (Date.now() < s.expires_at - 60_000) return s.access_token;
  refreshing ??= api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } })
    .then(setSession)
    .catch(e => {
      if (e.status >= 400 && e.status < 500) { state.session = null; state.error = 'Signed out. Please sign in again.'; save(); }
      throw e;
    })
    .finally(() => { refreshing = null; });
  await refreshing;
  return state.session.access_token;
}

async function startSession(s) {
  setSession(s);
  state.cursor = 0; // new account on this device: pull everything
  state.error = null;
  save();
  await sync();
}

export const signIn = async (email, password) =>
  startSession(await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));

export async function signUp(email, password) {
  const s = await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
  if (!s?.access_token) throw new Error('Account created, but email confirmation is on. Turn off "Confirm email" in Supabase.');
  await startSession(s);
}

// ---- Password reset
// Supabase emails a link back to this page with #access_token=…&type=recovery,
// or #error_description=… if the link expired or was already used.
export const sendReset = email =>
  api('/auth/v1/recover', { method: 'POST', auth: false, body: { email, redirect_to: location.origin + location.pathname } });

export function readRecoveryHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (p.get('type') === 'recovery' && p.get('access_token')) return Object.fromEntries(p);
  if (p.get('error_description')) return { error: p.get('error_description') };
  return null;
}

// Sets the new password; with `signInHere` the recovery session becomes this device's session.
export async function finishReset(recovery, password, signInHere) {
  const token = recovery.access_token;
  await api('/auth/v1/user', { method: 'PUT', auth: token, body: { password } });
  if (!signInHere) return;
  const user = await api('/auth/v1/user', { auth: token });
  await startSession({ access_token: token, refresh_token: recovery.refresh_token, expires_in: Number(recovery.expires_in) || 3600, user });
}

// ---- Feedback (table `feedback`, insert-only; see supabase.sql)
export const sendFeedback = async (message, context) =>
  api('/rest/v1/feedback', { method: 'POST', auth: state.session ? true : false, headers: { Prefer: 'return=minimal' }, body: { message, context } });

export async function signOut() {
  try { await api('/auth/v1/logout', { method: 'POST' }); } catch {}
  state = {};
  save();
  notify(false);
}

// ---- Sync

const strip = ({ _ts, _dirty, _deleted, ...rest }) => rest;

// Batches of at most ~1.5 MB of JSON (photos live inside records).
function* chunks(rows, max = 1_500_000) {
  let cur = [], size = 0;
  for (const r of rows) {
    const n = JSON.stringify(r.data).length;
    if (cur.length && size + n > max) { yield cur; cur = []; size = 0; }
    cur.push(r);
    size += n;
  }
  if (cur.length) yield cur;
}

async function push() {
  const rows = [];
  for (const store of db.STORES) {
    for (const r of await db.allRaw(store)) {
      // Rows from before sync existed have no _ts: push them with their own edit time.
      if (r._dirty || r._ts == null) rows.push({ store, from: r._ts, ts: r._ts ?? r.updatedAt ?? r.createdAt ?? 1, r });
    }
  }
  for (const batch of chunks(rows.map(x => ({ ...x, data: strip(x.r) })))) {
    await api('/rest/v1/items?on_conflict=user_id,store,id', {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: batch.map(x => ({ store: x.store, id: x.r.id, data: x.data, deleted: !!x.r._deleted, updated_at: x.ts })),
    });
    for (const x of batch) await db.markClean(x.store, x.r.id, x.from, x.ts);
  }
}

async function pull() {
  let changed = false;
  for (;;) {
    const rows = await api(`/rest/v1/items?select=store,id,data,deleted,updated_at,server_ts&server_ts=gt.${state.cursor ?? 0}&order=server_ts.asc&limit=${PAGE}`);
    for (const row of rows) {
      if (db.STORES.includes(row.store)) {
        const rec = { ...row.data, id: row.id, _ts: row.updated_at };
        if (row.deleted) rec._deleted = true;
        if (await db.applyRemote(row.store, rec)) changed = true;
      }
      state.cursor = row.server_ts;
    }
    save();
    if (rows.length < PAGE) return changed;
  }
}

export async function sync() {
  if (!state.session || db.DEMO) return;
  if (syncing) { again = true; return; }
  syncing = true;
  notify(false);
  let changed = false;
  try {
    do {
      again = false;
      await push();
      changed = (await pull()) || changed;
    } while (again);
    state.lastSync = Date.now();
    state.error = null;
  } catch (e) {
    // fetch() rejects with TypeError when the network is down
    state.error = !navigator.onLine || e instanceof TypeError ? 'Offline. Pinch will sync when you are back online.' : e.message;
  } finally {
    syncing = false;
    save();
    notify(changed);
  }
}

export const schedule = (ms = 2000) => { clearTimeout(timer); timer = setTimeout(sync, ms); };

db.setOnChange(() => state.session && schedule());
addEventListener('online', () => schedule(0));
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && schedule(0));
