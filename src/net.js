// Game server calls: cloud save, players' used market and anonymous play analytics.
// Requests go as text/plain (a "simple" request, no CORS preflight); identity is the player's Pi sign-in, checked by the server.
import { PiState, A2U_URL } from './pi.js';

const post = async (path, body, ms = 15000) => {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(A2U_URL + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctl.signal }); return await r.json(); }
  catch (e) { return null; } finally { clearTimeout(tm); }
};
const authed = (path, body = {}) => (PiState.accessToken ? post(path, { ...body, accessToken: PiState.accessToken }) : Promise.resolve(null));

export const market = {
  async list(card, life, price) { const r = await authed('/market/list', { card, life, price }); return r && r.ok ? r.lid : null; },
  async browse() { const r = await authed('/market/browse'); return r && r.ok ? r.items : null; },
  async buy(lid) { const r = await authed('/market/buy', { lid }); return r && r.ok ? r : null; },
  async collect() { const r = await authed('/market/collect'); return r && r.ok ? r : null; },
};

// cloud save: the whole local progress (keys starting with onair_) tied to the Pi account
const PREFIX = 'onair_';
export function snapshot() { const o = {}; try { Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => { o[k] = localStorage.getItem(k); }); } catch (e) {} return o; }
export async function cloudSave() { const r = await authed('/save', { data: { v: 1, at: Date.now(), keys: snapshot() } }); return !!(r && r.ok); }
export async function cloudLoad() { const r = await authed('/load'); return r && r.ok ? r : null; }
export function restore(data) { if (!data || !data.keys) return false; try { Object.entries(data.keys).forEach(([k, v]) => { if (k.startsWith(PREFIX) && k !== PREFIX + 'lang') localStorage.setItem(k, v); }); return true; } catch (e) { return false; } }

// analytics: anonymous counters (no names, no Pi data): a random install id, the language and event names
let Q = []; let pid = null;
function playerId() { if (pid) return pid; try { pid = localStorage.getItem('onair_pid'); if (!pid) { pid = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('onair_pid', pid); } } catch (e) { pid = 'anon'; } return pid; }
export function track(e) { Q.push(e); if (Q.length >= 20) flush(); }
export async function flush(lang) { if (!Q.length && !lang) return; const events = Q.splice(0, 50); await post('/ev', { pid: playerId(), lang: lang || flush.lang || '', events }); }
setInterval(() => { if (Q.length) flush(); }, 60000);
