// On Air Studio — small Pi server (Cloudflare Worker).
// Job now: Testnet App-to-User (A2U) test rewards, required by Pi before a Mainnet app wallet.
// Secrets are added by the owner in the Cloudflare dashboard only — never in this code:
//   PI_API_KEY      : the Testnet app's API key (Pi Developer Portal)
//   APP_WALLET_SEED : the Testnet app wallet private seed (starts with S) or its 24-word passphrase
import { Buffer } from 'buffer';
import { Keypair, TransactionBuilder, Operation, Asset, Memo, Account } from '@stellar/stellar-base';

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
    'Access-Control-Allow-Origin': ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : ORIGINS[0],
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
async function keypairFrom(secret) {
  const s = (secret || '').trim();
  if (/^S[A-Z2-7]{55}$/.test(s)) return Keypair.fromSecret(s);
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
  return Keypair.fromRawEd25519Seed(Buffer.from(key));
}

// --- Pi Platform API ---
async function pi(env, path, method = 'GET', body) {
  if (!env.PI_API_KEY) throw new Fail('api_key_missing', 500);
  const r = await fetch(PI_API + path, {
    method,
    headers: { Authorization: 'Key ' + env.PI_API_KEY, 'Content-Type': 'application/json' },
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
async function sendOnChain(payment, kp) {
  const horizon = HORIZON[payment.network];
  if (!horizon) throw new Fail('unknown_network', 500);
  if (payment.from_address !== kp.publicKey()) throw new Fail('private_seed_mismatch', 500, { app_wallet: payment.from_address });
  const acc = await (await fetch(`${horizon}/accounts/${kp.publicKey()}`)).json();
  if (!acc.sequence) throw new Fail('app_wallet_not_found', 500);
  const fees = await (await fetch(`${horizon}/fee_stats`)).json();
  const fee = String(fees.last_ledger_base_fee || 100000);
  const tx = new TransactionBuilder(new Account(kp.publicKey(), acc.sequence), {
    fee, networkPassphrase: payment.network,
    timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 180 },
  })
    .addOperation(Operation.payment({ destination: payment.to_address, asset: Asset.native(), amount: String(payment.amount) }))
    .addMemo(Memo.text(payment.identifier))
    .build();
  tx.sign(kp);
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
  const kp = await keypairFrom(env.APP_WALLET_SEED);
  await clearIncomplete(env);
  const payment = await pi(env, '/payments', 'POST', {
    payment: { amount: REWARD, memo: 'On Air Studio test reward', metadata: { kind: 'test_reward' }, uid: user.uid },
  });
  let txid;
  try { txid = await sendOnChain(payment, kp); }
  catch (e) { await pi(env, `/payments/${payment.identifier}/cancel`, 'POST').catch(() => {}); throw e; }
  await pi(env, `/payments/${payment.identifier}/complete`, 'POST', { txid });
  return { ok: true, username: user.username, amount: REWARD, txid };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (req.method === 'GET' && path === '/') {
        // Health check: says what is configured, never the secrets themselves.
        let wallet = null;
        try { wallet = (await keypairFrom(env.APP_WALLET_SEED)).publicKey(); } catch (e) {}
        return json(req, { ok: true, service: 'on-air-pi', api_key_set: !!env.PI_API_KEY, app_wallet: wallet });
      }
      if (req.method === 'POST' && path === '/a2u/reward') return json(req, await reward(req, env));
      return json(req, { ok: false, error: 'not_found' }, 404);
    } catch (e) {
      const f = e instanceof Fail ? e : new Fail('server_error', 500);
      return json(req, { ok: false, error: f.code, ...(f.extra || {}) }, f.status);
    }
  },
};
