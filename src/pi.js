// Pi Network sign-in, following Pi App Studio's integration guide:
// 1) Pi.authenticate in the browser gives an accessToken;
// 2) the accessToken is exchanged with App Studio, which checks it against the Pi Platform
//    and returns the only identity (uid, username) the game trusts, plus a sessionToken kept in memory.
// Outside Pi Browser (a plain PC browser) the game keeps working without a Pi account.
export const PiState = { ready: false, user: null, uid: null, sessionToken: null, inPi: false, error: null };

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
function onIncompletePaymentFound(payment) { PiState.incompletePayment = payment || null; }

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
    const auth = await timeout(window.Pi.authenticate(['username'], onIncompletePaymentFound), 20000);
    if (!auth || !auth.accessToken) throw new Error('no token');
    const data = await exchangeToken(auth.accessToken);
    PiState.sessionToken = data.sessionToken || null;
    PiState.uid = data.user ? data.user.uid : null;
    PiState.user = data.user ? data.user.username : null;
    PiState.ready = !!PiState.user;
  } catch (e) { PiState.error = String((e && e.message) || e); }
  return PiState;
}
