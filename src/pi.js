// Pi Network sign-in, following Pi App Studio's integration guide:
// 1) Pi.authenticate in the browser gives an accessToken;
// 2) the accessToken is exchanged with App Studio, which checks it against the Pi Platform
//    and returns the only identity (uid, username) the game trusts, plus a sessionToken kept in memory.
// Outside Pi Browser (a plain PC browser) the game keeps working without a Pi account.
export const PiState = { ready: false, user: null, uid: null, sessionToken: null, accessToken: null, inPi: false, error: null };

const APP_STUDIO_LOGIN = 'https://backend.appstudio-u7cm9zhmha0ruwv8.piappengine.com/pi/auth/v1/login';

// The SDK is loaded by a <script> tag in the page head; wait for it in case it is still loading.
function sdkReady(ms) {
  return new Promise((resolve) => {
    if (window.Pi) return resolve(true);
    const t0 = Date.now();
    const iv = setInterval(() => { if (window.Pi || Date.now() - t0 > ms) { clearInterval(iv); resolve(!!window.Pi); } }, 100);
  });
}

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

// Payments are not used yet; when they are, an incomplete payment found at sign-in is handled here.
function onIncompletePaymentFound(payment) {
  PiState.incompletePayment = payment || null;
  // a token pack paid earlier but not finished (app closed mid-way): finish it now and credit it once
  const txid = payment && payment.transaction && payment.transaction.txid;
  if (txid) setTimeout(() => serverPay('/pay/complete', { paymentId: payment.identifier, txid }).then((r) => { if (r && r.ok && r.tokens && PiState.onTokens) PiState.onTokens(r.tokens); }), 3000);
}
async function serverPay(path, body) {
  try { const r = await timeout(fetch(A2U_URL + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ ...body, accessToken: PiState.accessToken }) }), 30000); return await r.json(); } catch (e) { return null; }
}
// buy a token pack with Pi (user-to-app payment): Pi shows its own confirmation; the game server approves and completes it
export function payTokens(amount) {
  return new Promise((resolve) => {
    if (!window.Pi || !PiState.accessToken) return resolve({ ok: false, error: 'not_signed_in' });
    try {
      window.Pi.createPayment({ amount, memo: 'On Air Studio tokens', metadata: { kind: 'tokens', amount } }, {
        onReadyForServerApproval: async (paymentId) => { const r = await serverPay('/pay/approve', { paymentId }); if (!r || !r.ok) resolve({ ok: false, error: 'approve: ' + ((r && r.error) || 'no_response') + (r && r.message ? ' — ' + r.message : '') }); },
        onReadyForServerCompletion: async (paymentId, txid) => { const r = await serverPay('/pay/complete', { paymentId, txid }); resolve(r && r.ok ? { ok: true, tokens: r.tokens } : { ok: false, error: 'complete: ' + ((r && r.error) || 'no_response') + (r && r.message ? ' — ' + r.message : '') }); },
        onCancel: () => resolve({ ok: false, error: 'cancelled' }),
        onError: (err) => resolve({ ok: false, error: String((err && err.message) || err) }),
      });
    } catch (e) { resolve({ ok: false, error: String(e.message || e) }); }
  });
}

async function exchangeToken(accessToken) {
  const res = await timeout(fetch(APP_STUDIO_LOGIN, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken }),
  }), 15000);
  if (!res.ok) throw new Error('login ' + res.status);
  return res.json();
}

export async function piSignIn() {
  const piBrowser = /PiBrowser/i.test(navigator.userAgent);
  let framed = false; try { framed = window.self !== window.top; } catch (e) { framed = true; }
  // Pi Browser, or a Pi frame such as PiNet or the developer sandbox.
  const inPi = piBrowser || framed || /[?&]sandbox=1/.test(location.search);
  PiState.inPi = inPi;
  if (!inPi) return PiState;
  try {
    if (!(await sdkReady(8000))) throw new Error('sdk');
    await window.Pi.init({ version: '2.0' });
    const auth = await timeout(window.Pi.authenticate(['username', 'payments', 'wallet_address'], onIncompletePaymentFound), 20000);
    if (!auth || !auth.accessToken) throw new Error('no token');
    PiState.accessToken = auth.accessToken; // kept in memory only, sent to our own server for Testnet rewards
    const data = await exchangeToken(auth.accessToken);
    PiState.sessionToken = data.sessionToken || null;
    PiState.uid = data.user ? data.user.uid : null;
    PiState.user = data.user ? data.user.username : null;
    PiState.ready = !!PiState.user;
  } catch (e) { PiState.error = String((e && e.message) || e); }
  return PiState;
}

// Testnet App-to-User test reward (needed by Pi before a Mainnet app wallet). Our own server pays 0.01 test-π.
export const A2U_URL = 'https://on-air-pi.games-fca.workers.dev';
export async function claimTestReward() {
  if (!PiState.accessToken) return { ok: false, error: 'not_signed_in' };
  try {
    const r = await timeout(fetch(A2U_URL + '/a2u/reward', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ accessToken: PiState.accessToken }), // simple request: no CORS preflight
    }), 60000);
    return await r.json();
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
