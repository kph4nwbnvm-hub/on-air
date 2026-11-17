# On Air Studio — Pi server (Cloudflare Worker)

Deployed by Cloudflare Workers Builds from this folder (`/server`).
Secrets are set only in the Cloudflare dashboard: `PI_API_KEY`, `APP_WALLET_SEED`.

- `GET /` health check (shows whether the key is set and the app wallet public address, never secrets)
- `POST /a2u/reward` `{accessToken}` sends a 0.01 test-π App-to-User reward (Testnet)

`source.js` is the readable source; `worker.js` is its bundle (with @stellar/stellar-base).
