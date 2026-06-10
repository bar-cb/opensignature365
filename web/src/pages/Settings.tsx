import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Settings() {
  const [status, setStatus] = useState<any | null>(null);
  const [testing, setTesting] = useState(false);
  useEffect(() => { refresh(); }, []);
  async function refresh() { setTesting(true); try { setStatus(await api.msStatus()); } finally { setTesting(false); } }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings & diagnostics</h1>
      <div className="card p-4 mb-4">
        <div className="font-semibold mb-2 text-sm">Microsoft connection status</div>
        <button className="btn mb-3" disabled={testing} onClick={refresh}>{testing ? "Testing…" : "Re-test"}</button>
        {status && (
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-semibold">Microsoft Graph</div>
              <div className={status.graph?.ok ? "text-green-700" : "text-red-700"}>{status.graph?.ok ? "✓ Connected" : "✗ " + status.graph?.message}</div>
              <pre className="bg-slate-50 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(status.graph, null, 2)}</pre>
            </div>
            <div>
              <div className="font-semibold">Exchange Online PowerShell</div>
              <div className={status.exchange?.ok ? "text-green-700" : "text-red-700"}>{status.exchange?.ok ? "✓ Connected" : "✗ " + status.exchange?.message}</div>
              <pre className="bg-slate-50 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(status.exchange, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>
      <div className="card p-4 text-xs text-slate-600 leading-relaxed">
        <strong>Configuration</strong> is read from environment variables (see <code>.env.example</code>).
        Required: <code>MICROSOFT_TENANT_ID</code>, <code>MICROSOFT_CLIENT_ID</code>, <code>MICROSOFT_CLIENT_SECRET</code>,
        <code>EXO_APP_ID</code>, <code>EXO_TENANT_DOMAIN</code>, <code>EXO_CERTIFICATE_THUMBPRINT</code> (or path+password).
        <br /><br />
        <strong>Data dir:</strong> <code>./data</code>
      </div>
    </div>
  );
}
