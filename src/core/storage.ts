import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { SignatureSchema, TemplateSchema, type Signature, type Template, type VersionMetadata, type SampleUser, type DeploymentReport } from "./types.js";
import { getDataDir, ensureDir, safeJoin, isoNow, isoTimestamp } from "./paths.js";

function dataDir() { return getDataDir(); }
function signaturesDir() { return safeJoin(dataDir(), "signatures"); }
function templatesDir() { return safeJoin(dataDir(), "templates"); }
function assetsDir() { return safeJoin(dataDir(), "assets"); }
function usersDir() { return safeJoin(dataDir(), "users"); }
function reportsDir() { return safeJoin(dataDir(), "reports", "deployments"); }
function configDir() { return safeJoin(dataDir(), "config"); }

function readJson<T>(p: string): T { return JSON.parse(fs.readFileSync(p, "utf8")) as T; }
function writeJson(p: string, obj: unknown) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

// ============ Signatures ============
export const signatures = {
  list(): Signature[] {
    ensureDir(signaturesDir());
    return fs.readdirSync(signaturesDir())
      .filter((d) => {
        const p = safeJoin(signaturesDir(), d, "signature.json");
        return fs.existsSync(p);
      })
      .map((d) => readJson<Signature>(safeJoin(signaturesDir(), d, "signature.json")));
  },
  get(id: string): Signature {
    const p = safeJoin(signaturesDir(), id, "signature.json");
    if (!fs.existsSync(p)) throw new Error(`Signature ${id} not found.`);
    return SignatureSchema.parse(readJson(p));
  },
  exists(id: string): boolean {
    return fs.existsSync(safeJoin(signaturesDir(), id, "signature.json"));
  },
  save(sig: Signature): Signature {
    const parsed = SignatureSchema.parse({ ...sig, updated_at: isoNow() });
    writeJson(safeJoin(signaturesDir(), parsed.id, "signature.json"), parsed);
    return parsed;
  },
  create(input: Partial<Signature> & { id: string; name: string }): Signature {
    if (this.exists(input.id)) throw new Error(`Signature ${input.id} already exists.`);
    const now = isoNow();
    const sig: Signature = SignatureSchema.parse({
      id: input.id,
      name: input.name,
      description: input.description ?? "",
      status: "draft",
      created_at: now,
      updated_at: now,
      current_version: null,
      editor: input.editor ?? { html: "", text: "" },
      settings: input.settings ?? {
        deployment_mode: "exchange_transport_rule",
        disclaimer_location: "append",
        fallback_action: "wrap",
        apply_to: { mode: "test_users", test_users_file: "data/users/test-users.csv" },
      },
      assets: input.assets ?? [],
      dynamic_tags: input.dynamic_tags ?? [],
    });
    return this.save(sig);
  },
  publish(id: string, notes: string, publishedBy = "local-admin"): VersionMetadata {
    const sig = this.get(id);
    const version = isoTimestamp();
    const versionDir = safeJoin(signaturesDir(), id, "versions", version);
    ensureDir(versionDir);
    const html = sig.editor.html;
    const text = sig.editor.text;
    const hash = "sha256-" + crypto.createHash("sha256").update(html).digest("hex");
    const meta: VersionMetadata = {
      version,
      signature_id: id,
      published_at: isoNow(),
      published_by: publishedBy,
      notes,
      hash,
      deployment_status: "not_deployed",
    };
    writeJson(safeJoin(versionDir, "signature.json"), { ...sig, status: "published", current_version: version });
    fs.writeFileSync(safeJoin(versionDir, "signature.html"), html);
    fs.writeFileSync(safeJoin(versionDir, "signature.txt"), text);
    writeJson(safeJoin(versionDir, "metadata.json"), meta);
    sig.status = "published";
    sig.current_version = version;
    this.save(sig);
    return meta;
  },
  listVersions(id: string): VersionMetadata[] {
    const dir = safeJoin(signaturesDir(), id, "versions");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .map((v) => safeJoin(dir, v, "metadata.json"))
      .filter(fs.existsSync)
      .map((p) => readJson<VersionMetadata>(p))
      .sort((a, b) => b.published_at.localeCompare(a.published_at));
  },
  getVersion(id: string, version: string): { meta: VersionMetadata; signature: Signature; html: string; text: string } {
    const dir = safeJoin(signaturesDir(), id, "versions", version);
    if (!fs.existsSync(dir)) throw new Error(`Version ${version} not found.`);
    return {
      meta: readJson(safeJoin(dir, "metadata.json")),
      signature: readJson(safeJoin(dir, "signature.json")),
      html: fs.readFileSync(safeJoin(dir, "signature.html"), "utf8"),
      text: fs.readFileSync(safeJoin(dir, "signature.txt"), "utf8"),
    };
  },
  updateVersionStatus(id: string, version: string, status: VersionMetadata["deployment_status"]) {
    const p = safeJoin(signaturesDir(), id, "versions", version, "metadata.json");
    const meta = readJson<VersionMetadata>(p);
    meta.deployment_status = status;
    writeJson(p, meta);
  },
  resolveVersion(id: string, version: string): string {
    if (version !== "latest") return version;
    const versions = this.listVersions(id);
    if (!versions.length) throw new Error(`Signature ${id} has no published versions.`);
    return versions[0].version;
  },
};

// ============ Templates ============
export const templates = {
  list(): Template[] {
    ensureDir(templatesDir());
    return fs.readdirSync(templatesDir())
      .filter((d) => fs.existsSync(safeJoin(templatesDir(), d, "template.json")))
      .map((d) => {
        const t = readJson<Template>(safeJoin(templatesDir(), d, "template.json"));
        if (!t.html) {
          const htmlPath = safeJoin(templatesDir(), d, "template.html");
          if (fs.existsSync(htmlPath)) t.html = fs.readFileSync(htmlPath, "utf8");
        }
        return TemplateSchema.parse(t);
      });
  },
  get(id: string): Template {
    const p = safeJoin(templatesDir(), id, "template.json");
    if (!fs.existsSync(p)) throw new Error(`Template ${id} not found.`);
    const t = readJson<Template>(p);
    if (!t.html) {
      const htmlPath = safeJoin(templatesDir(), id, "template.html");
      if (fs.existsSync(htmlPath)) t.html = fs.readFileSync(htmlPath, "utf8");
    }
    return TemplateSchema.parse(t);
  },
};

// ============ Users ============
export const users = {
  sample(): SampleUser[] {
    const p = safeJoin(usersDir(), "sample-users.json");
    if (!fs.existsSync(p)) return [];
    return readJson<SampleUser[]>(p);
  },
  testCsv(): string[] {
    const p = safeJoin(usersDir(), "test-users.csv");
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  },
};

// ============ Assets ============
export const assets = {
  list(): { rel: string; abs: string; size: number }[] {
    ensureDir(assetsDir());
    const out: { rel: string; abs: string; size: number }[] = [];
    function walk(dir: string, prefix: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const rel = path.join(prefix, entry.name);
        if (entry.isDirectory()) walk(abs, rel);
        else if (entry.isFile()) out.push({ rel, abs, size: fs.statSync(abs).size });
      }
    }
    walk(assetsDir(), "");
    return out;
  },
  save(name: string, buf: Buffer): string {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dest = safeJoin(assetsDir(), "uploads", safeName);
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, buf);
    return path.relative(dataDir(), dest);
  },
};

// ============ Reports ============
export const reports = {
  save(report: DeploymentReport, html: string, text: string, commandLog: string, errorsJson: unknown): string {
    const dir = safeJoin(reportsDir(), report.deployment_id);
    ensureDir(dir);
    writeJson(safeJoin(dir, "report.json"), report);
    fs.writeFileSync(safeJoin(dir, "report.md"), reportToMarkdown(report));
    fs.writeFileSync(safeJoin(dir, "deployed-signature.html"), html);
    fs.writeFileSync(safeJoin(dir, "deployed-signature.txt"), text);
    fs.writeFileSync(safeJoin(dir, "exchange-command-log.txt"), commandLog);
    writeJson(safeJoin(dir, "errors.json"), errorsJson);
    return dir;
  },
  list(): DeploymentReport[] {
    ensureDir(reportsDir());
    return fs.readdirSync(reportsDir())
      .map((id) => safeJoin(reportsDir(), id, "report.json"))
      .filter(fs.existsSync)
      .map((p) => readJson<DeploymentReport>(p))
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at));
  },
  get(id: string): { report: DeploymentReport; html: string; text: string; commandLog: string; errors: unknown } {
    const dir = safeJoin(reportsDir(), id);
    if (!fs.existsSync(dir)) throw new Error(`Report ${id} not found.`);
    return {
      report: readJson(safeJoin(dir, "report.json")),
      html: fs.readFileSync(safeJoin(dir, "deployed-signature.html"), "utf8"),
      text: fs.readFileSync(safeJoin(dir, "deployed-signature.txt"), "utf8"),
      commandLog: fs.readFileSync(safeJoin(dir, "exchange-command-log.txt"), "utf8"),
      errors: readJson(safeJoin(dir, "errors.json")),
    };
  },
};

function reportToMarkdown(r: DeploymentReport): string {
  return `# Deployment ${r.deployment_id}

- **Signature:** ${r.signature_id}
- **Version:** ${r.version}
- **Mode:** ${r.mode}
- **Dry-run:** ${r.dry_run}
- **Target:** ${r.target.type} (${r.target.count} users)
- **Exchange rule:** \`${r.exchange.rule_name}\` (${r.exchange.operation}, enabled=${r.exchange.enabled})
- **Generated:** ${r.generated_at}

## Result

**${r.result.status.toUpperCase()}** — ${r.result.message}

## Validation

### Errors
${r.validation.errors.length ? r.validation.errors.map((e) => `- ${e}`).join("\n") : "_none_"}

### Warnings
${r.validation.warnings.length ? r.validation.warnings.map((w) => `- ${w}`).join("\n") : "_none_"}
`;
}

// ============ Config ============
export const config = {
  tagsSchema(): unknown {
    const p = safeJoin(configDir(), "tags.schema.json");
    if (!fs.existsSync(p)) return null;
    return readJson(p);
  },
};

export const paths = { dataDir, signaturesDir, templatesDir, assetsDir, usersDir, reportsDir, configDir };
