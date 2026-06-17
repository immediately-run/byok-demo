# BYOK Anthropic demo

A minimal immediately.run app that exercises the host-owned secret store and the
`SECRETS_SPEC` §6 **`injectSecret`** path end-to-end. Built to validate the R3-40
flip (`INJECT_SECRET_HONORED=true`).

Three user-driven steps, all from one screen:

1. **Store** — `requestAddSecret({ type: 'api-key', family: 'anthropic', suggestedOrigin: 'https://api.anthropic.com' })` opens the **host-drawn** add modal. You type your Anthropic key into host chrome (the app never sees it); it is passkey-PRF sealed. `type:'api-key'` defaults the injection framing to `x-api-key: <value>` — Anthropic's auth header.
2. **Grant** — `requestSecret({ family: 'anthropic', type: 'api-key' })` is the powerbox; you bind the stored secret to this app, minting a durable `(appKey, secretId)` use grant.
3. **Call** — `hostFetch('https://api.anthropic.com/v1/messages', …)`. The app sets **no** auth header; the host injects `x-api-key` after the triple gate, **browser-direct** (no `/api/v1/net-fetch` hop). The key never enters this app.

## Manifest

`package.json` → `immediately.run.requests`:

- `secrets:add` — to open the add modal.
- `net:fetch` — host entry for `https://api.anthropic.com` carrying
  `injectSecret: { family: 'anthropic', type: 'api-key' }`. (The powerbox
  `requestSecret` is gated by `net:fetch`; there is no separate `secrets:use` verb.)

## Verify (DevTools → Network)

- the request goes **direct to api.anthropic.com** — no `/api/v1/net-fetch` hop;
- it carries an `x-api-key` header this app never set (host-injected);
- nothing in the app (incl. the on-screen log) ever holds the key value.
