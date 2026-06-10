import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

const PREVIEW_MODES = [
  { id: "desktop", label: "Desktop", width: 600 },
  { id: "mobile", label: "Mobile", width: 320 },
];

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [sig, setSig] = useState<any | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tab, setTab] = useState<"html" | "text">("html");
  const [previewMode, setPreviewMode] = useState<typeof PREVIEW_MODES[number]>(PREVIEW_MODES[0]);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    api.getSignature(id).then(setSig);
    api.tagsConfig().then((c) => setTags(c.tags));
    api.listVersions(id).then(setVersions);
  }, [id]);

  useEffect(() => {
    if (!sig) return;
    api.renderPreview({ signatureId: sig.id }).then((r) => { setPreviewHtml(r.html); setWarnings(r.warnings); }).catch(() => {});
  }, [sig?.editor?.html, sig?.editor?.text]);

  if (!sig) return <div>Loading…</div>;

  function insertTag(tag: string) {
    setSig({ ...sig, editor: { ...sig.editor, [tab]: (sig.editor[tab] || "") + `{{${tag}}}` } });
  }
  async function save() {
    setStatus("Saving…");
    const updated = await api.saveSignature(sig.id, sig);
    setSig(updated);
    setStatus("Saved ✓");
    setTimeout(() => setStatus(""), 2000);
  }
  async function publish() {
    const notes = prompt("Publish notes:", "") || "";
    setStatus("Publishing…");
    try {
      const r = await api.publish(sig.id, notes);
      setStatus(`Published ${r.version.version} ✓`);
      api.listVersions(sig.id).then(setVersions);
      api.getSignature(sig.id).then(setSig);
    } catch (e) { setStatus("Publish failed: " + (e as Error).message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <button className="text-sm text-blue-600" onClick={() => nav(-1)}>← Back</button>
          <h1 className="text-2xl font-bold">{sig.name}</h1>
          <div className="text-xs text-slate-500">{sig.id} · {sig.status} · current={sig.current_version || "—"}</div>
        </div>
        <div className="flex items-center gap-2">
          {status && <span className="text-xs text-slate-500">{status}</span>}
          <button className="btn" onClick={save}>Save draft</button>
          <button className="btn-primary" onClick={publish}>Publish version</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Editor */}
        <div className="col-span-7 card p-4">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setTab("html")} className={`btn ${tab === "html" ? "bg-slate-200" : ""}`}>HTML</button>
            <button onClick={() => setTab("text")} className={`btn ${tab === "text" ? "bg-slate-200" : ""}`}>Plain text</button>
          </div>
          <textarea
            className="w-full h-[460px] p-3 border border-slate-300 rounded font-mono text-xs"
            value={sig.editor[tab] || ""}
            onChange={(e) => setSig({ ...sig, editor: { ...sig.editor, [tab]: e.target.value } })}
          />
          <div className="mt-3">
            <div className="label">Description</div>
            <input className="input" value={sig.description || ""} onChange={(e) => setSig({ ...sig, description: e.target.value })} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="label">Deployment target mode</div>
              <select className="input" value={sig.settings.apply_to.mode} onChange={(e) => setSig({ ...sig, settings: { ...sig.settings, apply_to: { ...sig.settings.apply_to, mode: e.target.value } } })}>
                <option value="all_users">All users</option>
                <option value="test_users">Test users (CSV)</option>
                <option value="domain">Sender domain</option>
                <option value="department">Department</option>
                <option value="group">Distribution group</option>
              </select>
            </div>
            <div>
              <div className="label">Disclaimer location</div>
              <select className="input" value={sig.settings.disclaimer_location} onChange={(e) => setSig({ ...sig, settings: { ...sig.settings, disclaimer_location: e.target.value } })}>
                <option value="append">Append</option>
                <option value="prepend">Prepend</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sidebar: tags + preview */}
        <div className="col-span-5 space-y-4">
          <div className="card p-3">
            <div className="font-semibold text-sm mb-2">Dynamic tags</div>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <button key={t} className="px-2 py-0.5 text-xs bg-slate-100 hover:bg-blue-100 rounded" onClick={() => insertTag(t)}>{`{{${t}}}`}</button>
              ))}
            </div>
          </div>

          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-sm">Preview</div>
              <div className="flex gap-1">
                {PREVIEW_MODES.map((m) => (
                  <button key={m.id} onClick={() => setPreviewMode(m)} className={`btn text-xs ${previewMode.id === m.id ? "bg-slate-200" : ""}`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div style={{ width: previewMode.width, maxWidth: "100%", margin: "0 auto", background: "white", border: "1px solid #e2e8f0", padding: 12 }}>
              <iframe srcDoc={previewHtml} className="w-full" style={{ height: 280, border: 0 }} title="preview" />
            </div>
            {warnings.length > 0 && (
              <div className="mt-2 text-xs text-amber-700">{warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}</div>
            )}
          </div>

          <div className="card p-3">
            <div className="font-semibold text-sm mb-2">Versions ({versions.length})</div>
            <div className="max-h-32 overflow-y-auto text-xs space-y-1">
              {versions.map((v) => (
                <div key={v.version} className="flex justify-between">
                  <span className="font-mono">{v.version}</span>
                  <span className="text-slate-500">{v.deployment_status}</span>
                </div>
              ))}
              {versions.length === 0 && <div className="text-slate-400">No versions yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
