import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function Reports() {
  const { id } = useParams();
  const [list, setList] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => { api.listReports().then(setList); }, []);
  useEffect(() => { if (id) api.getReport(id).then(setDetail); else setDetail(null); }, [id]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      {detail ? (
        <div className="space-y-3">
          <a href="/reports" className="text-sm text-blue-600">← All reports</a>
          <pre className="card p-3 text-xs overflow-x-auto">{JSON.stringify(detail.report, null, 2)}</pre>
          <div className="card p-3">
            <div className="font-semibold text-sm mb-2">Deployed HTML</div>
            <iframe srcDoc={detail.html} style={{ width: "100%", height: 280, border: 0 }} />
          </div>
          <div className="card p-3">
            <div className="font-semibold text-sm mb-2">Exchange command log</div>
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-2 rounded">{detail.commandLog}</pre>
          </div>
        </div>
      ) : (
        <div className="card divide-y">
          {list.length === 0 && <div className="p-4 text-slate-500 text-sm">No deployments yet.</div>}
          {list.map((r) => (
            <a key={r.deployment_id} href={`/reports/${r.deployment_id}`} className="flex justify-between p-3 hover:bg-slate-50 text-sm">
              <div>
                <div className="font-mono text-xs">{r.deployment_id}</div>
                <div className="text-xs text-slate-500">{r.signature_id} · {r.version} · {r.dry_run ? "DRY-RUN" : r.target.type}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${r.result.status === "success" ? "bg-green-100 text-green-800" : r.result.status === "failed" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>{r.result.status}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
