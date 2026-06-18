# BYOK OpenRouter demo

A minimal immediately.run app that exercises the host-owned secret store and the
`SECRETS_SPEC` §6 **`injectSecret`** path end-to-end. Built to validate the R3-40
flip (`INJECT_SECRET_HONORED=true`) against a `Authorization: Bearer` provider.

Adding a key is a **host action** (Settings → Secrets); an app only ever asks to
**use** one. So:

0. **Store (once, in Settings)** — Settings → Secrets → **Add secret**: type
   `bearer-token`, "Send only to" `https://openrouter.ai`. The value is typed into
   host chrome, passkey-PRF sealed, origin-bound. The app can't do this and never
   sees the value.
1. **Grant** — `requestSecret({ family: 'openrouter', type: 'bearer-token' })` is the
   powerbox; you bind the stored secret to this app, minting a durable
   `(appKey, secretId)` use grant. Gated by `net:fetch`.
2. **Call** — `hostFetch('https://openrouter.ai/api/v1/chat/completions', …)`. The app
   sets **no** auth header; the host injects `Authorization: Bearer` after the triple
   gate, **browser-direct** (no `/api/v1/net-fetch` hop). The key never enters this app.

## Manifest

`package.json` → `immediately.run.requests` declares only `net:fetch` (required) —
host entry for `https://openrouter.ai` carrying
`injectSecret: { family: 'openrouter', type: 'bearer-token' }`. The powerbox
`requestSecret` is gated by `net:fetch`; there is no separate `secrets:use` verb,
and the app does **not** request `secrets:add` (storing is a Settings action).

The default model is `openai/gpt-4o-mini` (swap `MODEL` in `src/App.tsx` for any
model your OpenRouter account can reach).

## Verify (DevTools → Network)

- the request goes **direct to openrouter.ai** — no `/api/v1/net-fetch` hop;
- it carries an `authorization: Bearer …` header this app never set (host-injected);
- nothing in the app (incl. the on-screen log) ever holds the key value.
