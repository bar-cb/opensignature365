import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Preview() {
  const [sigs, setSigs] = useState<any[]>([]);
  const [signatureId, setSignatureId] = useState<string>("");
  const [samples, setSamples] = useState<any[]>([]);
  const [sampleIdx, setSampleIdx] = useState(0);
  const [upn, setUpn] = useState("");
  const [to, setTo] = useState("");
  const [html, setHtml] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sent, setSent] = useState<string>("");

  useEffect(() => {
    api.listSignatures().then((s) => { setSigs(s); if (s[0]) setSignatureId(s[0].id); });
    api.sampleUsers().then(setSamples);
  }, []);

  async function render() {
    if (!signatureId) return;
    const r = await api.renderPreview({ signatureId, sampleIndex: sampleIdx });
    setHtml(r.html);
    setWarnings(r.warnings);
  }

  async function send() {
    if (!signatureId || !to) return;
    setSent("Sending…");
    try { await api.sendPreview({ signatureId, to, upn: upn || undefined }); setSent("Sent ✓"); }
    catch (e) { setSent("Failed: " + (e as Error).message); }
  }

  useEffect(() => { render(); /* eslint-disable-next-line */ }, [signatureId, sampleIdx]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Preview</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 space-y-3">
          <div>
            <div className="label">Signature</div>
            <select className="input" value={signatureId} onChange={(e) => setSignatureId(e.target.value)}>
              {sigs.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
            </select>
          </div>
          <div>
            <div className="label">Sample user</div>
            <select className="input" value={sampleIdx} onChange={(e) => setSampleIdx(Number(e.target.value))}>
              {samples.map((u, i) => <option key={i} value={i}>{u.displayName} — {u.mail}</option>)}
            </select>
          </div>
          <hr />
          <div>
            <div className="label">Send preview email via Graph</div>
            <input className="input mb-1" placeholder="Recipient address" value={to} onChange={(e) => setTo(e.target.value)} />
            <input className="input mb-1" placeholder="Optional: UPN for real user data" value={upn} onChange={(e) => setUpn(e.target.value)} />
            <button className="btn-primary mt-1" onClick={send}>Send preview</button>
            {sent && <div className="text-xs mt-1 text-slate-500">{sent}</div>}
          </div>
        </div>
        <div className="col-span-8 card p-4">
          <iframe srcDoc={html} style={{ width: "100%", height: 460, border: 0 }} title="preview" />
          {warnings.length > 0 && (
            <div className="mt-2 text-xs text-amber-700">{warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
