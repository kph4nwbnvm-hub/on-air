// Pi Network sign-in. Inside Pi Browser the SDK signs the player in with their Pi account.
// Outside Pi Browser (a PC browser) the game keeps working without a Pi account.
// Add ?sandbox=1 to the URL to test against the Pi sandbox from a desktop browser.
export const PiState = { ready: false, user: null, inPi: false, error: null };

function loadSdk() {
  return new Promise((resolve) => {
    if (window.Pi) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://sdk.minepi.com/pi-sdk.js';
    s.onload = () => resolve(!!window.Pi);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function piSignIn() {
  const sandbox = /[?&]sandbox=1/.test(location.search);
  const inPi = /PiBrowser/i.test(navigator.userAgent) || sandbox;
  PiState.inPi = inPi;
  if (!inPi) return PiState;
  try {
    if (!(await loadSdk())) throw new Error('sdk');
    window.Pi.init({ version: '2.0', sandbox });
    // payments scope is requested now so the store can be added later without a second prompt
    const auth = await timeout(window.Pi.authenticate(['username', 'payments'], () => {}), 20000);
    PiState.user = auth && auth.user ? auth.user.username : null;
    PiState.ready = !!PiState.user;
  } catch (e) { PiState.error = String(e && e.message || e); }
  return PiState;
}
