import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { z } from "zod";
import { signatures, templates, assets, reports, users } from "../core/storage.js";
import { renderSignature } from "../core/template-engine.js";
import { sanitizeEmailHtml } from "../core/sanitize.js";
import { validateForPublish, validateForDeploy } from "../core/validation.js";
import { runDeploy } from "../core/deploy.js";
import { testGraphConnection, listUsers as graphListUsers, getUser as graphGetUser, sendPreviewEmail } from "../microsoft/graph.js";
import { testExchangeConnection } from "../microsoft/exchange.js";

const PORT = Number(process.env.APP_PORT || 4070);
const HOST = process.env.APP_HOST || "127.0.0.1";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "5mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function asyncH<T>(fn: (req: express.Request, res: express.Response) => Promise<T>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    fn(req, res).catch(next);
  };
}

// ===== Signatures =====
app.get("/api/signatures", (_req, res) => res.json(signatures.list()));

app.post("/api/signatures", (req, res) => {
  const body = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    templateId: z.string().optional(),
  }).parse(req.body);
  let editor = { html: "", text: "" };
  let assetsList: any[] = [];
  let tags: string[] = [];
  if (body.templateId) {
    const t = templates.get(body.templateId);
    editor = { html: t.html, text: t.text };
    tags = [...new Set([...t.required_tags, ...t.optional_tags])];
  }
  const sig = signatures.create({
    id: body.id,
    name: body.name,
    description: body.description || "",
    editor,
    dynamic_tags: tags,
    assets: assetsList,
  });
  res.json(sig);
});

app.get("/api/signatures/:id", (req, res) => res.json(signatures.get(req.params.id)));

app.put("/api/signatures/:id", (req, res) => {
  const existing = signatures.get(req.params.id);
  const merged = { ...existing, ...req.body, id: existing.id, created_at: existing.created_at };
  // Sanitize HTML
  if (merged.editor?.html) merged.editor.html = sanitizeEmailHtml(merged.editor.html);
  res.json(signatures.save(merged));
});

app.post("/api/signatures/:id/publish", (req, res) => {
  const sig = signatures.get(req.params.id);
  const v = validateForPublish(sig);
  if (v.errors.length) return res.status(400).json({ ok: false, validation: v });
  const meta = signatures.publish(req.params.id, req.body?.notes || "");
  res.json({ ok: true, validation: v, version: meta });
});

app.get("/api/signatures/:id/versions", (req, res) => res.json(signatures.listVersions(req.params.id)));

app.get("/api/signatures/:id/versions/:version", (req, res) => {
  res.json(signatures.getVersion(req.params.id, req.params.version));
});

// ===== Templates =====
app.get("/api/templates", (_req, res) => res.json(templates.list()));
app.get("/api/templates/:id", (req, res) => res.json(templates.get(req.params.id)));
app.post("/api/signatures/from-template/:templateId", (req, res) => {
  const t = templates.get(req.params.templateId);
  const id = req.body?.id || `${t.id}-${Date.now()}`;
  const sig = signatures.create({
    id,
    name: req.body?.name || t.name,
    description: t.description,
    editor: { html: t.html, text: t.text },
    dynamic_tags: [...new Set([...t.required_tags, ...t.optional_tags])],
  });
  res.json(sig);
});

// ===== Assets =====
app.get("/api/assets", (_req, res) => res.json(assets.list()));
app.post("/api/assets", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const rel = assets.save(req.file.originalname, req.file.buffer);
  res.json({ ok: true, path: rel });
});
app.post("/api/assets/validate-url", asyncH(async (req, res) => {
  const url = String(req.body?.url || "");
  if (!/^https:\/\//.test(url)) return res.json({ ok: false, message: "URL must start with https://" });
  try {
    const r = await fetch(url, { method: "HEAD" });
    res.json({ ok: r.ok, status: r.status });
  } catch (e) {
    res.json({ ok: false, message: (e as Error).message });
  }
}));

// ===== Preview =====
app.post("/api/preview/render", (req, res) => {
  const body = z.object({
    signatureId: z.string(),
    user: z.record(z.unknown()).optional(),
    sampleIndex: z.number().optional(),
  }).parse(req.body);
  const sig = signatures.get(body.signatureId);
  const sampleUsers = users.sample();
  const user = (body.user as any) || sampleUsers[body.sampleIndex ?? 0] || { displayName: "Sample User", mail: "sample@example.com" };
  const rendered = renderSignature(sig.editor.html, sig.editor.text, user as any);
  res.json(rendered);
});

app.post("/api/preview/send", asyncH(async (req, res) => {
  const body = z.object({
    signatureId: z.string(),
    to: z.string().email(),
    upn: z.string().optional(),
  }).parse(req.body);
  const sig = signatures.get(body.signatureId);
  let user: any;
  if (body.upn) {
    try { user = await graphGetUser(body.upn); } catch (e) { /* fall back to sample */ }
  }
  if (!user) user = users.sample()[0] || { displayName: "Sample User", mail: body.to };
  const rendered = renderSignature(sig.editor.html, sig.editor.text, user);
  await sendPreviewEmail({
    toUpn: body.to,
    subject: `[OpenSignature365 Preview] ${sig.name}`,
    html: `<p>Preview of <strong>${sig.name}</strong> (version=${sig.current_version || "draft"})</p>${rendered.html}`,
  });
  res.json({ ok: true, warnings: rendered.warnings });
}));

// ===== Microsoft =====
app.get("/api/microsoft/status", asyncH(async (_req, res) => {
  const graph = await testGraphConnection().catch((e) => ({ ok: false, message: (e as Error).message }));
  const exo = await testExchangeConnection().catch((e) => ({ ok: false, message: (e as Error).message }));
  res.json({ graph, exchange: exo });
}));
app.get("/api/microsoft/users", asyncH(async (req, res) => {
  const limit = Number(req.query.limit || 25);
  res.json(await graphListUsers(limit));
}));
app.post("/api/microsoft/test-graph", asyncH(async (_req, res) => res.json(await testGraphConnection())));
app.post("/api/microsoft/test-exchange", asyncH(async (_req, res) => res.json(await testExchangeConnection())));

// ===== Deploy =====
app.post("/api/deploy/validate", (req, res) => {
  const { signatureId } = req.body;
  const sig = signatures.get(signatureId);
  res.json(validateForDeploy(sig, { requirePublicUrls: (process.env.REQUIRE_PUBLIC_IMAGE_URLS ?? "true") === "true" }));
});
app.post("/api/deploy/dry-run", asyncH(async (req, res) => {
  const { signatureId, version = "latest", target = "test" } = req.body;
  res.json(await runDeploy({ signatureId, version, target, dryRun: true }));
}));
app.post("/api/deploy/production", asyncH(async (req, res) => {
  const { signatureId, version = "latest", target = "production", confirmProduction } = req.body;
  res.json(await runDeploy({ signatureId, version, target, dryRun: false, confirmProduction: !!confirmProduction }));
}));

// ===== Reports =====
app.get("/api/reports", (_req, res) => res.json(reports.list()));
app.get("/api/reports/:id", (req, res) => res.json(reports.get(req.params.id)));

// ===== Sample users + tags schema =====
app.get("/api/sample-users", (_req, res) => res.json(users.sample()));
app.get("/api/config/tags", (_req, res) => res.json({ tags: defaultTags() }));

function defaultTags() {
  return [
    "displayName", "givenName", "surname", "jobTitle", "department", "companyName",
    "officeLocation", "mail", "userPrincipalName", "businessPhones", "mobilePhone",
    "streetAddress", "city", "state", "postalCode", "country", "manager",
  ];
}

// ===== Static (built web) =====
// Try project-root/web/dist first (works from `node dist/server/index.js`,
// `tsx src/server/index.ts`, and any cwd).
function findWebDist(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "web/dist"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist"),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../web/dist"),
  ];
  for (const c of candidates) if (fs.existsSync(path.join(c, "index.html"))) return c;
  return null;
}
const webDist = findWebDist();
if (webDist) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

// ===== Error handler =====
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as Error & { statusCode?: number };
  // eslint-disable-next-line no-console
  console.error("[server]", e.message);
  res.status(e.statusCode || 500).json({ ok: false, error: e.message });
});

app.listen(PORT, HOST, () => {
  if (HOST === "0.0.0.0") {
    // eslint-disable-next-line no-console
    console.warn("⚠️  WARNING: Listening on 0.0.0.0. OpenSignature365 has no authentication; expose only on trusted networks.");
  }
  // eslint-disable-next-line no-console
  console.log(`OpenSignature365 server listening on http://${HOST}:${PORT}`);
});
