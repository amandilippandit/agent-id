export function LandingPage() {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Agent-ID | Universal Identity for AI Agents</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
            background: #0a0a0a;
            color: #e0e0e0;
            min-height: 100vh;
          }
          .container { max-width: 720px; margin: 0 auto; padding: 60px 24px; }
          h1 {
            font-size: 2rem;
            color: #fff;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          .subtitle {
            color: #888;
            font-size: 0.95rem;
            margin-bottom: 48px;
          }
          .section { margin-bottom: 40px; }
          .section h2 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #10b981;
            margin-bottom: 16px;
          }
          .section p { color: #aaa; line-height: 1.7; font-size: 0.9rem; }
          .endpoint {
            background: #111;
            border: 1px solid #222;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 12px;
            display: flex;
            gap: 12px;
            align-items: baseline;
          }
          .method {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            min-width: 56px;
            text-align: center;
          }
          .get { background: #10b98120; color: #10b981; }
          .post { background: #3b82f620; color: #3b82f6; }
          .patch { background: #f59e0b20; color: #f59e0b; }
          .path { color: #ccc; font-size: 0.9rem; }
          .desc { color: #666; font-size: 0.8rem; margin-left: auto; }
          .explorer {
            background: #111;
            border: 1px solid #222;
            border-radius: 8px;
            padding: 24px;
          }
          .explorer input {
            width: 100%;
            background: #0a0a0a;
            border: 1px solid #333;
            color: #fff;
            padding: 12px 16px;
            border-radius: 6px;
            font-family: inherit;
            font-size: 0.9rem;
            margin-bottom: 16px;
          }
          .explorer input:focus { outline: none; border-color: #10b981; }
          #result {
            color: #aaa;
            font-size: 0.85rem;
            white-space: pre-wrap;
            min-height: 80px;
          }
          .badge {
            display: inline-block;
            font-size: 0.7rem;
            padding: 2px 8px;
            border-radius: 4px;
            margin-left: 8px;
          }
          .active { background: #10b98120; color: #10b981; }
          .revoked { background: #ef444420; color: #ef4444; }
          .agent-card {
            background: #0a0a0a;
            border: 1px solid #222;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 8px;
          }
          .agent-id { color: #10b981; font-size: 0.85rem; }
          .agent-name { color: #fff; font-size: 0.9rem; font-weight: 600; }
          .agent-meta { color: #666; font-size: 0.8rem; margin-top: 4px; }
          .footer { margin-top: 60px; color: #444; font-size: 0.8rem; }
          a { color: #10b981; text-decoration: none; }
          a:hover { text-decoration: underline; }
          button {
            background: #10b981;
            color: #0a0a0a;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-family: inherit;
            font-weight: 700;
            font-size: 0.85rem;
            cursor: pointer;
          }
          button:hover { background: #059669; }
        `}</style>
      </head>
      <body>
        <div class="container">
          <h1>Agent-ID</h1>
          <p class="subtitle">
            Universal identity for AI agents. Cryptographic, self-sovereign, permanent.
          </p>

          <div class="section">
            <h2>How It Works</h2>
            <p>
              Each agent generates its own Ed25519 keypair. The public key is registered here.
              The agent_id is a SHA-256 hash of the public key — deterministic, verifiable,
              and permanent. The private key never leaves the agent's environment.
            </p>
          </div>

          <div class="section">
            <h2>API</h2>
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="path">/api/register/nonce</span>
              <span class="desc">Get one-time nonce</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="path">/api/register</span>
              <span class="desc">Register identity</span>
            </div>
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="path">/api/agent/:id</span>
              <span class="desc">Lookup agent</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="path">/api/verify</span>
              <span class="desc">Verify signature</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="path">/api/agent/:id/revoke</span>
              <span class="desc">Revoke identity</span>
            </div>
            <div class="endpoint">
              <span class="method patch">PATCH</span>
              <span class="path">/api/agent/:id/metadata</span>
              <span class="desc">Update metadata</span>
            </div>
          </div>

          <div class="section">
            <h2>Agent Explorer</h2>
            <div class="explorer">
              <input
                id="search"
                type="text"
                placeholder="Enter agent_id to look up..."
              />
              <div id="result">Registered agents will appear here...</div>
            </div>
          </div>

          <div class="footer">
            <p>Agent-ID — cryptographic identity for the agentic era</p>
          </div>
        </div>

        <script>{`
          const search = document.getElementById('search');
          const result = document.getElementById('result');

          // Load recent agents on page load
          fetch('/api/agents?limit=20')
            .then(r => r.json())
            .then(data => {
              if (!data.agents?.length) {
                result.textContent = 'No agents registered yet.';
                return;
              }
              result.innerHTML = data.agents.map(a => {
                const name = a.metadata?.name || 'unnamed';
                const badge = a.status === 'active'
                  ? '<span class="badge active">active</span>'
                  : '<span class="badge revoked">revoked</span>';
                const meta = [a.metadata?.runtime, a.metadata?.model].filter(Boolean).join(' / ');
                return '<div class="agent-card">' +
                  '<div><span class="agent-name">' + name + '</span>' + badge + '</div>' +
                  '<div class="agent-id">' + a.agent_id + '</div>' +
                  (meta ? '<div class="agent-meta">' + meta + '</div>' : '') +
                  '</div>';
              }).join('');
            });

          let timeout;
          search.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              const id = search.value.trim();
              if (!id) {
                fetch('/api/agents?limit=20')
                  .then(r => r.json())
                  .then(data => {
                    if (!data.agents?.length) {
                      result.textContent = 'No agents registered yet.';
                      return;
                    }
                    result.innerHTML = data.agents.map(a => {
                      const name = a.metadata?.name || 'unnamed';
                      const badge = a.status === 'active'
                        ? '<span class="badge active">active</span>'
                        : '<span class="badge revoked">revoked</span>';
                      return '<div class="agent-card">' +
                        '<div><span class="agent-name">' + name + '</span>' + badge + '</div>' +
                        '<div class="agent-id">' + a.agent_id + '</div></div>';
                    }).join('');
                  });
                return;
              }
              fetch('/api/agent/' + id)
                .then(r => r.json())
                .then(data => {
                  if (data.error) {
                    result.textContent = 'Not found: ' + id;
                    return;
                  }
                  const badge = data.status === 'active'
                    ? '<span class="badge active">active</span>'
                    : '<span class="badge revoked">revoked</span>';
                  const name = data.metadata?.name || 'unnamed';
                  const meta = [data.metadata?.runtime, data.metadata?.model].filter(Boolean).join(' / ');
                  result.innerHTML =
                    '<div class="agent-card">' +
                    '<div><span class="agent-name">' + name + '</span>' + badge + '</div>' +
                    '<div class="agent-id">' + data.agent_id + '</div>' +
                    '<div class="agent-meta">Registered: ' + new Date(data.created_at).toISOString() + '</div>' +
                    (meta ? '<div class="agent-meta">' + meta + '</div>' : '') +
                    '<div class="agent-meta">Key: ' + data.public_key + '</div>' +
                    '</div>';
                });
            }, 300);
          });
        `}</script>
      </body>
    </html>
  );
}
