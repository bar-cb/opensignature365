import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Dashboard() {
  const [sigs, setSigs] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api.listSignatures().then(setSigs).catch((e) => setErr(e.message)); }, []);
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="flex gap-2 mb-4">
        <Link to="/templates" className="btn-primary">+ New from template</Link>
      </div>
      {err && <div className="text-red-600 mb-2">{err}</div>}
      <div className="card divide-y">
        {sigs.length === 0 && <div className="p-6 text-slate-500">No signatures yet. Create one from a template.</div>}
        {sigs.map((s) => (
          <Link key={s.id} to={`/signatures/${s.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-xs text-slate-500">{s.id} · updated {new Date(s.updated_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded ${s.status === "published" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>{s.status}</span>
              {s.current_version && <span className="text-slate-500">v {s.current_version}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
