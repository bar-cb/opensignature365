const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `${r.status} ${r.statusText}`);
  return r.json();
}

export const api = {
  // signatures
  listSignatures: () => req<any[]>("/signatures"),
  getSignature: (id: string) => req<any>(`/signatures/${id}`),
  saveSignature: (id: string, body: any) => req<any>(`/signatures/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  createSignature: (body: any) => req<any>("/signatures", { method: "POST", body: JSON.stringify(body) }),
  publish: (id: string, notes: string) => req<any>(`/signatures/${id}/publish`, { method: "POST", body: JSON.stringify({ notes }) }),
  listVersions: (id: string) => req<any[]>(`/signatures/${id}/versions`),
  // templates
  listTemplates: () => req<any[]>("/templates"),
  getTemplate: (id: string) => req<any>(`/templates/${id}`),
  fromTemplate: (templateId: string, body: any) => req<any>(`/signatures/from-template/${templateId}`, { method: "POST", body: JSON.stringify(body) }),
  // preview
  renderPreview: (body: any) => req<any>("/preview/render", { method: "POST", body: JSON.stringify(body) }),
  sendPreview: (body: any) => req<any>("/preview/send", { method: "POST", body: JSON.stringify(body) }),
  // assets
  listAssets: () => req<any[]>("/assets"),
  validateAssetUrl: (url: string) => req<any>("/assets/validate-url", { method: "POST", body: JSON.stringify({ url }) }),
  // microsoft
  msStatus: () => req<any>("/microsoft/status"),
  msUsers: (limit = 25) => req<any[]>(`/microsoft/users?limit=${limit}`),
  testGraph: () => req<any>("/microsoft/test-graph", { method: "POST" }),
  testExchange: () => req<any>("/microsoft/test-exchange", { method: "POST" }),
  // deploy
  validateDeploy: (signatureId: string) => req<any>("/deploy/validate", { method: "POST", body: JSON.stringify({ signatureId }) }),
  dryRun: (body: any) => req<any>("/deploy/dry-run", { method: "POST", body: JSON.stringify(body) }),
  production: (body: any) => req<any>("/deploy/production", { method: "POST", body: JSON.stringify(body) }),
  // reports
  listReports: () => req<any[]>("/reports"),
  getReport: (id: string) => req<any>(`/reports/${id}`),
  // misc
  sampleUsers: () => req<any[]>("/sample-users"),
  tagsConfig: () => req<{ tags: string[] }>("/config/tags"),
};
