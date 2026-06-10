import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Assets() {
  const [assets, setAssets] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [check, setCheck] = useState<string>("");

  async function reload() { setAssets(await api.listAssets()); }
  useEffect(() => { reload(); }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f);
    await fetch("/api/assets", { method: "POST", body: fd });
    reload();
  }
  async function validate() {
    const r = await api.validateAssetUrl(url);
    setCheck(JSON.stringify(r));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Assets</h1>
      <div className="card p-4 mb-4">
        <div className="label">Upload local image (≤5MB)</div>
        <input type="file" accept="image/*" onChange={onUpload} />
        <div className="text-xs text-slate-500 mt-2">
          Uploaded images are stored under <code>data/assets/uploads</code>. For deployment, images must use absolute HTTPS URLs.
        </div>
      </div>
      <div className="card p-4 mb-4">
        <div className="label">Validate a public HTTPS image URL</div>
        <div className="flex gap-2">
          <input className="input" placeholder="https://cdn.example.com/logo.png" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn" onClick={validate}>Check</button>
        </div>
        {check && <pre className="text-xs mt-2 bg-slate-50 p-2 rounded">{check}</pre>}
      </div>
      <div className="card divide-y">
        {assets.length === 0 && <div className="p-4 text-slate-500 text-sm">No assets uploaded yet.</div>}
        {assets.map((a) => (
          <div key={a.rel} className="flex justify-between p-3 text-sm">
            <span className="font-mono">{a.rel}</span>
            <span className="text-slate-500">{(a.size / 1024).toFixed(1)} KB</span>
          </div>
        ))}
      </div>
    </div>
  );
}
