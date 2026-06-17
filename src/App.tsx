// BYOK Anthropic demo — an end-to-end exercise of the host-owned secret store and
// the SECRETS_SPEC §6 `injectSecret` path. Three user-driven steps:
//
//   1. STORE   — requestAddSecret() opens the host-drawn add modal; the user types
//                their Anthropic key into HOST chrome (this app never sees it) and
//                it is passkey-PRF sealed. type:'api-key' defaults the injection
//                framing to `x-api-key: <value>` — exactly Anthropic's auth header.
//   2. GRANT   — requestSecret() is the powerbox; the user binds the stored secret
//                to this app, minting a durable (appKey, secretId) use grant.
//   3. CALL    — hostFetch() to api.anthropic.com. This app sets NO auth header;
//                the host injects `x-api-key` after the triple gate, browser-direct
//                (no /api/v1/net-fetch proxy hop). The key never crosses into here.
//
// The app's package.json declares `secrets:add` + a `net:fetch` host entry for
// api.anthropic.com carrying `injectSecret: {family:'anthropic', type:'api-key'}`.

import { useState, type CSSProperties } from 'react';
import {
  requestAddSecret,
  requestSecret,
  hostFetch,
  type SecretView,
  type SecretGrant,
  type SecretError,
} from '@immediately-run/sdk';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const errText = (e: unknown): string => {
  const se = e as Partial<SecretError> & { message?: string };
  return se?.code ? `${se.code}${se.message ? `: ${se.message}` : ''}` : String(se?.message ?? e);
};

export default function App() {
  const [secret, setSecret] = useState<SecretView | null>(null);
  const [grant, setGrant] = useState<SecretGrant | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [reply, setReply] = useState<string | null>(null);

  const say = (line: string) => setLog((l) => [...l, line]);

  // 1. Ask the user to STORE an Anthropic key (typed into host chrome).
  const onStore = async () => {
    setBusy('store');
    try {
      const view = await requestAddSecret({
        type: 'api-key',
        family: 'anthropic',
        suggestedOrigin: 'https://api.anthropic.com',
        description: 'Anthropic API key (BYOK demo)',
      });
      setSecret(view);
      say(`stored secret ${view.id} → boundOrigin=${view.boundOrigin ?? '(none)'} (no value visible to this app)`);
    } catch (e) {
      say(`store failed: ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  // 2. Ask to GRANT (bind) the stored secret to this app (powerbox).
  const onGrant = async () => {
    setBusy('grant');
    try {
      const g = await requestSecret({ family: 'anthropic', type: 'api-key' });
      setGrant(g);
      say(`granted use of ${g.secret.id} (grantId=${g.grantId}); still no value — only metadata`);
    } catch (e) {
      say(`grant failed (decline/ungranted/nonexistent are indistinguishable): ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  // 3. CALL Anthropic. No auth header set here — the host injects x-api-key.
  const onCall = async () => {
    setBusy('call');
    setReply(null);
    try {
      const res = await hostFetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          // Required for browser-direct calls (the injected path bypasses the proxy).
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 64,
          messages: [{ role: 'user', content: 'Reply with a short friendly greeting.' }],
        }),
      });
      say(`hostFetch resolved: HTTP ${res.status} ${res.statusText}`);
      if (res.status >= 200 && res.status < 300) {
        try {
          const json = JSON.parse(res.body) as { content?: Array<{ type: string; text?: string }> };
          const text = (json.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
          setReply(text || res.body.slice(0, 500));
        } catch {
          setReply(res.body.slice(0, 500));
        }
      } else {
        setReply(`Error body: ${res.body.slice(0, 800)}`);
      }
    } catch (e) {
      say(`call rejected (gate/SSRF/transport): ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const btn = (active: boolean): CSSProperties => ({
    padding: '10px 16px',
    fontSize: 15,
    borderRadius: 8,
    border: '1px solid #4443',
    background: active ? '#6c5ce7' : '#6c5ce7cc',
    color: 'white',
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.7 : 1,
  });

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '40px auto', padding: '0 20px', lineHeight: 1.5 }}>
      <h1 style={{ marginBottom: 4 }}>BYOK Anthropic demo</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Stores your Anthropic key in the host, then calls Claude with the key{' '}
        <strong>injected by the host</strong> — this app never sees its value.
      </p>

      <ol style={{ paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 16, marginTop: 28 }}>
        <li>
          <strong>1. Store your Anthropic key</strong>
          <div style={{ marginTop: 6 }}>
            <button style={btn(busy === 'store')} disabled={!!busy} onClick={onStore}>
              {secret ? 'Stored ✓ — store another' : 'Store Anthropic key…'}
            </button>
          </div>
          {secret && (
            <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>
              id <code>{secret.id}</code> · type <code>{secret.type}</code> · boundOrigin{' '}
              <code>{secret.boundOrigin ?? '—'}</code> · <em>no value field exists on this record</em>
            </div>
          )}
        </li>

        <li>
          <strong>2. Grant this app permission to use it</strong>
          <div style={{ marginTop: 6 }}>
            <button style={btn(busy === 'grant')} disabled={!!busy || !secret} onClick={onGrant}>
              {grant ? 'Granted ✓' : 'Grant key to this app…'}
            </button>
          </div>
          {grant && (
            <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>
              grantId <code>{grant.grantId}</code> for secret <code>{grant.secret.id}</code>
            </div>
          )}
        </li>

        <li>
          <strong>3. Call Claude (key injected by the host)</strong>
          <div style={{ marginTop: 6 }}>
            <button style={btn(busy === 'call')} disabled={!!busy} onClick={onCall}>
              Call api.anthropic.com…
            </button>
          </div>
          {reply && (
            <blockquote style={{ background: '#f4f3ff', borderLeft: '3px solid #6c5ce7', padding: '10px 14px', margin: '10px 0 0', borderRadius: 6, whiteSpace: 'pre-wrap' }}>
              {reply}
            </blockquote>
          )}
        </li>
      </ol>

      <section style={{ marginTop: 28, background: '#fafafa', border: '1px solid #eee', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
        <strong>Verify in DevTools → Network</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: '#555' }}>
          <li>the request goes <strong>direct to api.anthropic.com</strong> — no <code>/api/v1/net-fetch</code> hop;</li>
          <li>it carries an <code>x-api-key</code> header this app never set (host-injected);</li>
          <li>nothing in this app — including the log below — ever holds the key value.</li>
        </ul>
      </section>

      {log.length > 0 && (
        <pre style={{ marginTop: 20, background: '#1e1e2e', color: '#cdd6f4', padding: 14, borderRadius: 8, fontSize: 12, overflowX: 'auto' }}>
          {log.join('\n')}
        </pre>
      )}
    </main>
  );
}
