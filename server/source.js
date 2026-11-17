// On Air Studio — game server (Cloudflare Worker + one Durable Object with SQLite storage).
// Routes: A2U test rewards, cloud save, used market between players, anonymous play analytics.
// Job now: Testnet App-to-User (A2U) test rewards, required by Pi before a Mainnet app wallet.
// Secrets are added by the owner in the Cloudflare dashboard only — never in this code:
//   PI_API_KEY      : the Testnet app's API key (Pi Developer Portal)
//   APP_WALLET_SEED : the Testnet app wallet private seed (starts with S) or its 24-word passphrase
import { Buffer } from 'buffer';
import { StrKey, TransactionBuilder, Operation, Asset, Memo, Account, xdr } from '@stellar/stellar-base';

const PI_API = 'https://api.minepi.com/v2';
const HORIZON = { 'Pi Testnet': 'https://api.testnet.minepi.com', 'Pi Network': 'https://api.mainnet.minepi.com' };
const REWARD = 0.01;
const ORIGINS = [
  'https://kph4nwbnvm-hub.github.io',
  'https://creative-codes-sa.github.io',
  'https://sandbox.minepi.com',
];

function cors(req) {
  const o = req.headers.get('Origin') || '';
  return {
    // Any origin may call: every request is checked against the Pi Platform with the player's own access token.
    'Access-Control-Allow-Origin': o || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}
const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

class Fail extends Error { constructor(code, status = 400, extra) { super(code); this.code = code; this.status = status; this.extra = extra; } }

// --- wallet key: S-seed, or 24 words (BIP39 + SLIP-10 ed25519, path m/44'/314159'/0') ---
async function hmac512(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
// The wallet key is used through WebCrypto Ed25519 (native, light on CPU), never through pure-JS crypto.
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function rawSeedFrom(secret) {
  const s = (secret || '').trim();
  if (/^S[A-Z2-7]{55}$/.test(s)) return new Uint8Array(StrKey.decodeEd25519SecretSeed(s));
  const words = s.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) throw new Fail('wallet_seed_missing_or_invalid', 500);
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(words.join(' ').normalize('NFKD')), 'PBKDF2', false, ['deriveBits']);
  const seed = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode('mnemonic'), iterations: 2048, hash: 'SHA-512' }, base, 512));
  let I = await hmac512(enc.encode('ed25519 seed'), seed);
  let key = I.slice(0, 32), chain = I.slice(32);
  for (const idx of [44, 314159, 0]) {
    const data = new Uint8Array(37);
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, (idx | 0x80000000) >>> 0);
    I = await hmac512(chain, data);
    key = I.slice(0, 32); chain = I.slice(32);
  }
  return key;
}
let walletCache = null; // { secret, key, pub, address }
async function wallet(env) {
  if (walletCache && walletCache.secret === env.APP_WALLET_SEED) return walletCache;
  const raw = await rawSeedFrom(env.APP_WALLET_SEED);
  const der = new Uint8Array(48);
  der.set([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
  der.set(raw, 16);
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign']);
  const pub = fromB64u((await crypto.subtle.exportKey('jwk', key)).x);
  walletCache = { secret: env.APP_WALLET_SEED, key, pub, address: StrKey.encodeEd25519PublicKey(Buffer.from(pub)) };
  return walletCache;
}

// --- Pi Platform API ---
async function pi(env, path, method = 'GET', body) {
  if (!env.PI_API_KEY) throw new Fail('api_key_missing', 500);
  const r = await fetch(PI_API + path, {
    method,
    headers: { Authorization: 'Key ' + String(env.PI_API_KEY).trim(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Fail(d.error || 'pi_api_' + r.status, 502, { message: d.error_message });
  return d;
}

async function me(accessToken) {
  const r = await fetch(PI_API + '/me', { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!r.ok) throw new Fail('invalid_access_token', 401);
  return r.json();
}

// --- blockchain: build, sign and submit the A2U transaction ---
async function sendOnChain(payment, w) {
  const horizon = HORIZON[payment.network];
  if (!horizon) throw new Fail('unknown_network', 500);
  if (payment.from_address !== w.address) throw new Fail('private_seed_mismatch', 500, { app_wallet: payment.from_address });
  const acc = await (await fetch(`${horizon}/accounts/${w.address}`)).json();
  if (!acc.sequence) throw new Fail('app_wallet_not_found', 500);
  const fees = await (await fetch(`${horizon}/fee_stats`)).json();
  const fee = String(fees.last_ledger_base_fee || 100000);
  const tx = new TransactionBuilder(new Account(w.address, acc.sequence), {
    fee, networkPassphrase: payment.network,
    timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 180 },
  })
    .addOperation(Operation.payment({ destination: payment.to_address, asset: Asset.native(), amount: String(payment.amount) }))
    .addMemo(Memo.text(payment.identifier))
    .build();
  const sig = new Uint8Array(await crypto.subtle.sign('Ed25519', w.key, tx.hash()));
  tx.signatures.push(new xdr.DecoratedSignature({ hint: Buffer.from(w.pub.slice(28)), signature: Buffer.from(sig) }));
  const r = await fetch(`${horizon}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'tx=' + encodeURIComponent(tx.toXDR()),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.hash) {
    const rc = d.extras && d.extras.result_codes;
    throw new Fail((rc && ((rc.operations && rc.operations[0]) || rc.transaction)) || 'submit_failed', 502);
  }
  return d.hash;
}

// An unfinished server payment blocks new ones: finish it if it has a transaction, cancel it if not.
async function clearIncomplete(env) {
  const d = await pi(env, '/payments/incomplete_server_payments');
  for (const p of d.incomplete_server_payments || []) {
    const txid = p.transaction && p.transaction.txid;
    if (txid) await pi(env, `/payments/${p.identifier}/complete`, 'POST', { txid }).catch(() => {});
    else await pi(env, `/payments/${p.identifier}/cancel`, 'POST').catch(() => {});
  }
}

async function reward(req, env) {
  const { accessToken } = await req.json().catch(() => ({}));
  if (!accessToken) throw new Fail('missing_access_token');
  const user = await me(accessToken);
  const w = await wallet(env);
  await clearIncomplete(env);
  let payment;
  try {
    payment = await pi(env, '/payments', 'POST', {
      payment: { amount: REWARD, memo: 'On Air Studio test reward', metadata: { kind: 'test_reward' }, uid: user.uid },
    });
  } catch (e) {
    // Diagnostic: which permissions the player's sign-in carries (never secrets).
    if (e instanceof Fail) e.extra = { ...(e.extra || {}), detail: 'scopes=' + ((user.credentials && user.credentials.scopes) || []).join(',') + ' wallet=' + (user.wallet_address ? user.wallet_address.slice(0, 5) + '...' : 'none') };
    throw e;
  }
  let txid;
  try { txid = await sendOnChain(payment, w); }
  catch (e) { await pi(env, `/payments/${payment.identifier}/cancel`, 'POST').catch(() => {}); throw e; }
  await pi(env, `/payments/${payment.identifier}/complete`, 'POST', { txid });
  return { ok: true, username: user.username, amount: REWARD, txid };
}


// ---------- game data: one Durable Object holds the market, saves and analytics in SQLite ----------
const TOK = 1000; const MINING_PI = Array.from({ length: 15 }, (_, i) => Math.round(0.1 * Math.pow(25, i / 14) * 1000) / 1000);
const USD_BAND = Array.from({ length: 15 }, (_, i) => Math.round(0.5 * Math.pow(15, i / 14) * 100) / 100); const PI_USD = 0.0634;
const tokenPrice = (r) => Math.min(MINING_PI[r - 1] * TOK, (USD_BAND[r - 1] / PI_USD) * TOK);
export class Hub {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS listings(lid INTEGER PRIMARY KEY AUTOINCREMENT, seller TEXT, card TEXT, life INTEGER, price REAL, ts INTEGER, buyer TEXT, sold_ts INTEGER, collected INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS saves(uid TEXT PRIMARY KEY, data TEXT, ts INTEGER);
      CREATE TABLE IF NOT EXISTS events(day TEXT, e TEXT, lang TEXT, n INTEGER, PRIMARY KEY(day, e, lang));
      CREATE TABLE IF NOT EXISTS players(pid TEXT PRIMARY KEY, first INTEGER, last INTEGER, lang TEXT, rounds INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS pays(id TEXT PRIMARY KEY, uid TEXT, amount REAL, tokens INTEGER, txid TEXT, ts INTEGER);`);
  }
  async fetch(req) {
    const u = new URL(req.url); const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}; const uid = req.headers.get('x-uid'); const q = (s, ...a) => [...this.sql.exec(s, ...a)];
    const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json' } });
    switch (u.pathname) {
      case '/market/list': {
        const m = /^([a-z]+)\.([a-z0-9]+)\.(\d{1,2})$/.exec(body.card || ''); const life = Math.round(+body.life); const price = +body.price;
        if (!m || !(life > 0 && life <= 100) || !(price > 0)) return J({ ok: false, error: 'bad_listing' }, 400);
        const r = +m[3]; if (r < 1 || r > 12) return J({ ok: false, error: 'bad_level' }, 400);
        const cap = tokenPrice(r) * (life / 100) * 0.6 * 1.2 * 1.001; if (price > cap) return J({ ok: false, error: 'over_cap', cap }, 400);
        if (q('SELECT COUNT(*) n FROM listings WHERE seller=? AND buyer IS NULL', uid)[0].n >= 20) return J({ ok: false, error: 'too_many' }, 400);
        this.sql.exec('INSERT INTO listings(seller, card, life, price, ts) VALUES(?,?,?,?,?)', uid, body.card, life, price, Date.now());
        return J({ ok: true, lid: q('SELECT last_insert_rowid() id')[0].id });
      }
      case '/market/browse': return J({ ok: true, items: q('SELECT lid, card, life, price, ts, seller FROM listings WHERE buyer IS NULL ORDER BY ts DESC LIMIT 80').map((x) => ({ lid: x.lid, card: x.card, life: x.life, price: x.price, mine: x.seller === uid })) });
      case '/market/buy': {
        const L = q('SELECT * FROM listings WHERE lid=?', +body.lid)[0];
        if (!L || L.buyer) return J({ ok: false, error: 'gone' }, 409); if (L.seller === uid) return J({ ok: false, error: 'own' }, 400);
        this.sql.exec('UPDATE listings SET buyer=?, sold_ts=? WHERE lid=? AND buyer IS NULL', uid, Date.now(), L.lid);
        return J({ ok: true, card: L.card, life: L.life, price: L.price });
      }
      case '/market/collect': {
        const S = q('SELECT lid, price FROM listings WHERE seller=? AND buyer IS NOT NULL AND collected=0', uid);
        S.forEach((x) => this.sql.exec('UPDATE listings SET collected=1 WHERE lid=?', x.lid));
        return J({ ok: true, total: S.reduce((a, x) => a + x.price, 0), ids: S.map((x) => x.lid) });
      }
      case '/save': { const data = JSON.stringify(body.data || {}); if (data.length > 300000) return J({ ok: false, error: 'too_big' }, 413);
        this.sql.exec('INSERT INTO saves(uid, data, ts) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET data=excluded.data, ts=excluded.ts', uid, data, Date.now()); return J({ ok: true, ts: Date.now() }); }
      case '/pay/record': { // credit once per completed payment
        if (q('SELECT id FROM pays WHERE id=?', body.id)[0]) return J({ ok: true, dup: true, tokens: 0 });
        this.sql.exec('INSERT INTO pays(id, uid, amount, tokens, txid, ts) VALUES(?,?,?,?,?,?)', body.id, uid, body.amount, body.tokens, body.txid, Date.now()); return J({ ok: true, tokens: body.tokens });
      }
      case '/load': { const r = q('SELECT data, ts FROM saves WHERE uid=?', uid)[0]; return J({ ok: true, data: r ? JSON.parse(r.data) : null, ts: r ? r.ts : 0 }); }
      case '/ev': {
        const pid = String(body.pid || '').slice(0, 64); const lang = String(body.lang || '').slice(0, 8); const day = new Date().toISOString().slice(0, 10);
        if (!pid) return J({ ok: false }, 400);
        this.sql.exec('INSERT INTO players(pid, first, last, lang) VALUES(?,?,?,?) ON CONFLICT(pid) DO UPDATE SET last=excluded.last, lang=excluded.lang', pid, Date.now(), Date.now(), lang);
        (Array.isArray(body.events) ? body.events.slice(0, 50) : []).forEach((e) => { const k = String(e).slice(0, 24); if (!/^[a-z_0-9]+$/.test(k)) return;
          this.sql.exec('INSERT INTO events(day, e, lang, n) VALUES(?,?,?,1) ON CONFLICT(day, e, lang) DO UPDATE SET n=n+1', day, k, lang);
          if (k === 'round') this.sql.exec('UPDATE players SET rounds=rounds+1 WHERE pid=?', pid); });
        return J({ ok: true });
      }
      case '/stats': {
        const now = Date.now(), D = 86400000;
        return J({ ok: true, at: now,
          players: q('SELECT COUNT(*) n FROM players')[0].n, active1d: q('SELECT COUNT(*) n FROM players WHERE last>?', now - D)[0].n, active7d: q('SELECT COUNT(*) n FROM players WHERE last>?', now - 7 * D)[0].n,
          new1d: q('SELECT COUNT(*) n FROM players WHERE first>?', now - D)[0].n, rounds: q('SELECT COALESCE(SUM(rounds),0) n FROM players')[0].n,
          langs: q('SELECT lang, COUNT(*) n FROM players GROUP BY lang ORDER BY n DESC'), days: q('SELECT day, e, SUM(n) n FROM events WHERE day>=? GROUP BY day, e ORDER BY day', new Date(now - 14 * D).toISOString().slice(0, 10)),
          market: q('SELECT COUNT(*) listed, SUM(CASE WHEN buyer IS NOT NULL THEN 1 ELSE 0 END) sold FROM listings')[0], saves: q('SELECT COUNT(*) n FROM saves')[0].n });
      }
    }
    return J({ ok: false, error: 'not_found' }, 404);
  }
}

// ---------- Pi payments (user to app): token packs paid in Pi; the server approves and completes, then credits once ----------
const PACKS = [0.1, 0.2, 0.4, 1, 2.5];
async function payApprove(req, env) {
  const { accessToken, paymentId } = await req.json().catch(() => ({})); if (!accessToken || !paymentId) throw new Fail('missing_fields');
  const user = await me(accessToken); const p = await pi(env, '/payments/' + encodeURIComponent(paymentId));
  if (p.user_uid !== user.uid) throw new Fail('not_your_payment', 403);
  if (!PACKS.includes(+p.amount)) throw new Fail('bad_amount');
  if (!(p.status && p.status.developer_approved)) await pi(env, '/payments/' + encodeURIComponent(paymentId) + '/approve', 'POST');
  return { ok: true };
}
async function payComplete(req, env) {
  const { accessToken, paymentId, txid } = await req.json().catch(() => ({})); if (!accessToken || !paymentId || !txid) throw new Fail('missing_fields');
  const user = await me(accessToken); const p = await pi(env, '/payments/' + encodeURIComponent(paymentId));
  if (p.user_uid !== user.uid) throw new Fail('not_your_payment', 403);
  if (!PACKS.includes(+p.amount)) throw new Fail('bad_amount');
  if (!(p.status && p.status.developer_completed)) await pi(env, '/payments/' + encodeURIComponent(paymentId) + '/complete', 'POST', { txid });
  const tokens = Math.round(+p.amount * 1000);
  const r = await hub(env).fetch('https://hub/pay/record', { method: 'POST', headers: { 'x-uid': user.uid, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: paymentId, amount: +p.amount, tokens, txid }) });
  const d = await r.json(); return { ok: true, tokens: d.tokens, dup: !!d.dup };
}
const hub = (env) => env.HUB.get(env.HUB.idFromName('main'));
// routes that need the player's identity: the Pi access token is checked with Pi, and the Pi uid is passed on
async function toHub(req, env, path, needUser) {
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  let uid = ''; if (needUser && env.DEV_UID) uid = env.DEV_UID + (body.as || ''); /* local tests only, never set in production */ else if (needUser) { if (!body.accessToken) throw new Fail('missing_access_token', 401); uid = (await me(body.accessToken)).uid; }
  delete body.accessToken;
  const r = await hub(env).fetch('https://hub' + path, { method: req.method, headers: { 'x-uid': uid, 'Content-Type': 'application/json' }, body: req.method === 'POST' ? JSON.stringify(body) : undefined });
  return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', ...cors(req) } });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (req.method === 'GET' && path === '/') {
        // Health check: says what is configured, never the secrets themselves.
        let address = null;
        try { address = (await wallet(env)).address; } catch (e) {}
        return json(req, { ok: true, service: 'on-air-pi', api_key_set: !!env.PI_API_KEY, app_wallet: address, v: 2 });
      }
      if (req.method === 'POST' && path === '/a2u/reward') return json(req, await reward(req, env));
      if (['/market/list', '/market/buy', '/market/collect', '/save', '/load'].includes(path) && req.method === 'POST') return await toHub(req, env, path, true);
      if (path === '/market/browse' && req.method === 'POST') return await toHub(req, env, path, true);
      if (path === '/pay/approve' && req.method === 'POST') return json(req, await payApprove(req, env));
      if (path === '/pay/complete' && req.method === 'POST') return json(req, await payComplete(req, env));
      if (path === '/ev' && req.method === 'POST') return await toHub(req, env, path, false);
      if (path === '/stats' && req.method === 'GET') return await toHub(req, env, path, false);
      return json(req, { ok: false, error: 'not_found' }, 404);
    } catch (e) {
      const f = e instanceof Fail ? e : new Fail('server_error', 500, { detail: String((e && e.message) || e).slice(0, 200) });
      return json(req, { ok: false, error: f.code, ...(f.extra || {}) }, f.status);
    }
  },
};
