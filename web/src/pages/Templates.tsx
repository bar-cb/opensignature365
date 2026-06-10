import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Templates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { api.listTemplates().then(setTemplates); }, []);

  async function createFrom(t: any) {
    const id = prompt(`New signature id (slug):`, `${t.id}-${Date.now().toString(36).slice(-4)}`);
    if (!id) return;
    const name = prompt("Display name:", t.name) || t.name;
    setBusy(t.id);
    try {
      const sig = await api.fromTemplate(t.id, { id, name });
      nav(`/signatures/${sig.id}`);
    } finally { setBusy(null); }
  }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Templates ({templates.length})</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="card overflow-hidden flex flex-col">
            <div className="border-b border-slate-200 p-3 bg-white" style={{ minHeight: 140 }}>
              <iframe srcDoc={t.html} className="w-full h-32 border-0" title={t.name} />
            </div>
            <div className="p-3 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <div className="font-semibold">{t.name}</div>
                <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded">{t.category}</span>
              </div>
              <div className="text-xs text-slate-500 flex-1">{t.description}</div>
              <button className="btn-primary mt-3 self-start" disabled={busy === t.id} onClick={() => createFrom(t)}>
                {busy === t.id ? "Creating…" : "Create signature"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
