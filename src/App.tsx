// BYOK OpenRouter demo — an end-to-end exercise of the SECRETS_SPEC §6
// `injectSecret` path. The split the platform enforces: ADDING a key is a host
// action (Settings → Secrets); an app only ever asks to USE one.
//
//   0. (in Settings, once) the user stores an OpenRouter key — type 'bearer-token',
//      bound to https://openrouter.ai. The app can't do this and never sees the value.
//   1. GRANT — requestSecret() is the powerbox; the user binds the stored secret to
//      this app, minting a durable (appKey, secretId) use grant. Gated by net:fetch.
//   2. CALL  — hostFetch() to openrouter.ai. This app sets NO auth header; the host
//      injects `Authorization: Bearer` after the triple gate, browser-direct (no
//      /api/v1/net-fetch hop). The key never crosses into here.
//
// Manifest declares only `net:fetch` (required) → openrouter.ai with
// `injectSecret: {family:'openrouter', type:'bearer-token'}`.

import { useState, type CSSProperties } from 'react';
import {
  requestSecret,
  hostFetch,
  type SecretGrant,
  type SecretError,
} from '@immediately-run/sdk';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Any model your OpenRouter account can reach; gpt-4o-mini is a cheap default.
const MODEL = 'openai/gpt-4o-mini';

const errText = (e: unknown): string => {
  const se = e as Partial<SecretError> & { message?: string };
  return se?.code ? `${se.code}${se.message ? `: ${se.message}` : ''}` : String(se?.message ?? e);
};

export default function App() {
  const [grant, setGrant] = useState<SecretGrant | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [reply, setReply] = useState<string | null>(null);

  const say = (line: string) => setLog((l) => [...l, line]);

  // 1. Ask the user to GRANT (bind) their stored OpenRouter secret to this app.
  const onGrant = async () => {
    setBusy('grant');
    try {
      const g = await requestSecret({ family: 'openrouter', type: 'bearer-token' });
      setGrant(g);
      say(`granted use of ${g.secret.id} → boundOrigin=${g.secret.boundOrigin ?? '(none)'} (no value — only metadata)`);
    } catch (e) {
      say(`grant failed (decline / no matching secret stored / ungranted are indistinguishable): ${errText(e)}`);
    } finally {
      setBusy(null);
    }
  };

  // 2. CALL OpenRouter. No auth header set here — the host injects Authorization: Bearer.
  const onCall = async () => {
    setBusy('call');
    setReply(null);
    try {
      const res = await hostFetch(OPENROUTER_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 64,
          messages: [{ role: 'user', content: 'Reply with a short friendly greeting.' }],
        }),
      });
      say(`hostFetch resolved: HTTP ${res.status} ${res.statusText}`);
      if (res.status >= 200 && res.status < 300) {
        try {
          const json = JSON.parse(res.body) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const text = json.choices?.[0]?.message?.content ?? '';
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

  const btnStyle = (active: boolean): CSSProperties => ({
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
      <h1 style={{ marginBottom: 4 }}>BYOK OpenRouter demo</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Calls OpenRouter with your key <strong>injected by the host</strong> as{' '}
        <code>Authorization: Bearer</code> — this app never sees its value.
      </p>

      <div style={{ background: '#fffbe6', border: '1px solid #f0e0a0', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 16 }}>
        <strong>First (once):</strong> store your OpenRouter key in{' '}
        <strong>Settings → Secrets → Add secret</strong> — type <code>bearer-token</code>, “Send only
        to” <code>https://openrouter.ai</code>. Apps can’t store keys, only ask to use them.
      </div>

      <ol style={{ paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 16, marginTop: 24 }}>
        <li>
          <strong>1. Grant this app permission to use it</strong>
          <div style={{ marginTop: 6 }}>
            <button style={btnStyle(busy === 'grant')} disabled={!!busy} onClick={onGrant}>
              {grant ? 'Granted ✓' : 'Grant key to this app…'}
            </button>
          </div>
          {grant && (
            <div style={{ fontSize: 13, color: '#444', marginTop: 6 }}>
              grantId <code>{grant.grantId}</code> for secret <code>{grant.secret.id}</code> ·
              boundOrigin <code>{grant.secret.boundOrigin ?? '—'}</code>
            </div>
          )}
        </li>

        <li>
          <strong>2. Call OpenRouter (key injected by the host)</strong>
          <div style={{ marginTop: 6 }}>
            <button style={btnStyle(busy === 'call')} disabled={!!busy} onClick={onCall}>
              Call openrouter.ai…
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
          <li>the request goes <strong>direct to openrouter.ai</strong> — no <code>/api/v1/net-fetch</code> hop;</li>
          <li>it carries an <code>authorization: Bearer …</code> header this app never set (host-injected);</li>
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
