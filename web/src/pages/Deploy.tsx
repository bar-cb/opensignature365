import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Deploy() {
  const [sigs, setSigs] = useState<any[]>([]);
  const [signatureId, setSignatureId] = useState<string>("");
  const [versions, setVersions] = useState<any[]>([]);
  const [version, setVersion] = useState("latest");
  const [target, setTarget] = useState<"test" | "production">("test");
  const [validation, setValidation] = useState<any | null>(null);
  const [confirmProd, setConfirmProd] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.listSignatures().then((s) => { setSigs(s); if (s[0]) setSignatureId(s[0].id); }); }, []);
  useEffect(() => {
    if (!signatureId) return;
    api.listVersions(signatureId).then(setVersions);
    api.validateDeploy(signatureId).then(setValidation).catch(() => setValidation(null));
  }, [signatureId]);

  async function dryRun() { setBusy(true); try { setResult(await api.dryRun({ signatureId, version, target })); } finally { setBusy(false); } }
  async function deploy() {
    if (target === "production" && !confirmProd) { alert("Tick the production confirmation box."); return; }
    setBusy(true);
    try { setResult(await api.production({ signatureId, version, target, confirmProduction: confirmProd })); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Deploy</h1>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 card p-4 space-y-3">
          <div>
            <div className="label">Signature</div>
            <select className="input" value={signatureId} onChange={(e) => setSignatureId(e.target.value)}>
              {sigs.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
            </select>
          </div>
          <div>
            <div className="label">Version</div>
            <select className="input" value={version} onChange={(e) => setVersion(e.target.value)}>
              <option value="latest">latest</option>
              {versions.map((v) => <option key={v.version} value={v.version}>{v.version} ({v.deployment_status})</option>)}
            </select>
          </div>
          <div>
            <div className="label">Target</div>
            <div className="flex gap-2">
              <label><input type="radio" checked={target === "test"} onChange={() => setTarget("test")} /> Test (disabled rule)</label>
              <label><input type="radio" checked={target === "production"} onChange={() => setTarget("production")} /> Production</label>
            </div>
          </div>
          {target === "production" && (
            <label className="text-xs text-red-700 flex items-center gap-2">
              <input type="checkbox" checked={confirmProd} onChange={(e) => setConfirmProd(e.target.checked)} />
              I confirm this is a production deployment.
            </label>
          )}
          <div className="flex gap-2">
            <button className="btn" disabled={busy || !signatureId} onClick={dryRun}>Dry-run</button>
            <button className="btn-danger" disabled={busy || !signatureId} onClick={deploy}>Deploy</button>
          </div>
        </div>

        <div className="col-span-7 space-y-4">
          {validation && (
            <div className="card p-3 text-xs">
              <div className="font-semibold mb-1">Validation</div>
              {validation.errors?.length === 0 && validation.warnings?.length === 0 && <div className="text-green-700">No issues.</div>}
              {validation.errors?.map((e: string, i: number) => <div key={"e" + i} className="text-red-700">✗ {e}</div>)}
              {validation.warnings?.map((w: string, i: number) => <div key={"w" + i} className="text-amber-700">⚠ {w}</div>)}
            </div>
          )}
          {result && (
            <div className="card p-3 text-xs">
              <div className="font-semibold mb-1">Result · {result.report?.result?.status}</div>
              <div>{result.report?.result?.message}</div>
              <pre className="bg-slate-50 p-2 rounded mt-2 overflow-x-auto">{JSON.stringify(result.report, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
