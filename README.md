# BYOK OpenRouter demo

A minimal immediately.run app that exercises the host-owned secret store and the
`SECRETS_SPEC` §6 **`injectSecret`** path end-to-end. Built to validate the R3-40
flip (`INJECT_SECRET_HONORED=true`) against a `Authorization: Bearer` provider.

Three user-driven steps, all from one screen:

1. **Store** — `requestAddSecret({ type: 'bearer-token', family: 'openrouter', suggestedOrigin: 'https://openrouter.ai' })` opens the **host-drawn** add modal. You type your OpenRouter key into host chrome (the app never sees it); it is passkey-PRF sealed and origin-bound to `https://openrouter.ai`. `type:'bearer-token'` frames the value as `Authorization: Bearer <value>`.
2. **Grant** — `requestSecret({ family: 'openrouter', type: 'bearer-token' })` is the powerbox; you bind the stored secret to this app, minting a durable `(appKey, secretId)` use grant.
3. **Call** — `hostFetch('https://openrouter.ai/api/v1/chat/completions', …)`. The app sets **no** auth header; the host injects `Authorization: Bearer` after the triple gate, **browser-direct** (no `/api/v1/net-fetch` hop). The key never enters this app.

## Manifest

`package.json` → `immediately.run.requests`:

- `secrets:add` — to open the add modal.
- `net:fetch` — host entry for `https://openrouter.ai` carrying
  `injectSecret: { family: 'openrouter', type: 'bearer-token' }`. (The powerbox
  `requestSecret` is gated by `net:fetch`; there is no separate `secrets:use` verb.)

The default model is `openai/gpt-4o-mini` (swap `MODEL` in `src/App.tsx` for any
model your OpenRouter account can reach).

## Verify (DevTools → Network)

- the request goes **direct to openrouter.ai** — no `/api/v1/net-fetch` hop;
- it carries an `authorization: Bearer …` header this app never set (host-injected);
- nothing in the app (incl. the on-screen log) ever holds the key value.
