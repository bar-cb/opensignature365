import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import type { Signature } from "../core/types.js";

export interface ExchangeDeployOptions {
  signature: Signature;
  version: string;
  html: string;
  text: string;
  environment: "test" | "production";
  dryRun: boolean;
  testFromAddresses?: string[];
}

export interface ExchangeDeployResult {
  ok: boolean;
  ruleName: string;
  operation: "set_or_create" | "disable" | "enable" | "remove" | "rollback";
  enabled: boolean;
  commandLog: string;
  message: string;
  errors: unknown[];
}

function rulePrefix(): string {
  return process.env.OPENSIGNATURE_RULE_PREFIX || "OpenSignature365";
}

export function buildRuleName(signatureId: string, env: "test" | "production"): string {
  return `${rulePrefix()} - ${signatureId} - ${env}`;
}

function powershellBin(): string {
  return process.env.EXO_POWERSHELL_BIN || "pwsh";
}

function scriptsDir(): string {
  // Resolve to <repo>/scripts/powershell relative to this file at runtime.
  // src is compiled to dist/microsoft/exchange.js, so go up two levels.
  const here = path.dirname(new URL(import.meta.url).pathname);
  // Walk up until we find scripts/powershell
  let cur = here;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(cur, "scripts", "powershell");
    if (fs.existsSync(candidate)) return candidate;
    cur = path.dirname(cur);
  }
  // Fallback to CWD
  return path.join(process.cwd(), "scripts", "powershell");
}

async function runPwsh(scriptPath: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const proc = spawn(powershellBin(), ["-NoProfile", "-NonInteractive", "-File", scriptPath, ...args], {
      env: { ...process.env },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code }));
    proc.on("error", (e) => resolve({ stdout, stderr: stderr + String(e), code: -1 }));
  });
}

export interface ExchangeTestResult { ok: boolean; message: string; details?: unknown }

export async function testExchangeConnection(): Promise<ExchangeTestResult> {
  const script = path.join(scriptsDir(), "validate-exchange-auth.ps1");
  if (!fs.existsSync(script)) return { ok: false, message: `Missing script: ${script}` };
  const r = await runPwsh(script, []);
  if (r.code === 0) return { ok: true, message: "Exchange Online auth succeeded", details: r.stdout.trim() };
  return { ok: false, message: r.stderr || r.stdout || `pwsh exited with code ${r.code}`, details: r };
}

/**
 * Deploy / update a managed Exchange transport rule. Always writes HTML payload
 * to a temporary file (signatures can be large; passing via argv is fragile).
 */
export async function deployTransportRule(opts: ExchangeDeployOptions): Promise<ExchangeDeployResult> {
  const ruleName = buildRuleName(opts.signature.id, opts.environment);
  const errors: unknown[] = [];
  const log: string[] = [];

  // Write HTML payload to a temp file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opensig-"));
  const htmlPath = path.join(tmpDir, "disclaimer.html");
  fs.writeFileSync(htmlPath, opts.html);

  const settings = opts.signature.settings;
  const applyToMode = opts.environment === "test" ? "test_users" : settings.apply_to.mode;
  const args: string[] = [
    "-RuleName", ruleName,
    "-HtmlPath", htmlPath,
    "-Location", settings.disclaimer_location,
    "-FallbackAction", settings.fallback_action,
    "-ApplyToMode", applyToMode,
  ];
  if (opts.environment === "test") {
    const addresses = opts.testFromAddresses ?? [];
    if (addresses.length !== 1) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return {
        ok: false, ruleName, operation: "set_or_create", enabled: false,
        commandLog: "", message: "Test deployment requires exactly one sender address.",
        errors: [`Expected exactly one test sender, received ${addresses.length}.`],
      };
    }
    args.push("-FromAddresses", addresses[0]);
  }
  if (settings.apply_to.group_id) args.push("-GroupId", settings.apply_to.group_id);
  if (settings.apply_to.domain) args.push("-Domain", settings.apply_to.domain);
  if (settings.apply_to.department) args.push("-Department", settings.apply_to.department);
  if (opts.environment === "test") args.push("-Enabled", "false");
  else args.push("-Enabled", "true");

  if (opts.dryRun) {
    args.push("-WhatIf");
    log.push(`[DRY-RUN] pwsh deploy-transport-rule.ps1 ${args.join(" ")}`);
    const planned = [
      `Would invoke New-TransportRule or Set-TransportRule with name "${ruleName}".`,
      `Disclaimer location: ${settings.disclaimer_location}`,
      `Fallback action: ${settings.fallback_action}`,
      `Apply-to mode: ${applyToMode}`,
      ...(opts.environment === "test" ? [`Test sender: ${opts.testFromAddresses?.[0]}`] : []),
      `HTML payload bytes: ${opts.html.length}`,
    ].join("\n");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return {
      ok: true,
      ruleName,
      operation: "set_or_create",
      enabled: opts.environment === "production",
      commandLog: log.join("\n") + "\n" + planned,
      message: "Dry-run completed successfully (no Exchange changes performed).",
      errors,
    };
  }

  const script = path.join(scriptsDir(), "deploy-transport-rule.ps1");
  if (!fs.existsSync(script)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return {
      ok: false, ruleName, operation: "set_or_create", enabled: false,
      commandLog: log.join("\n"), message: `Missing script: ${script}`, errors: [String(script)],
    };
  }
  log.push(`pwsh ${script} ${args.join(" ")}`);
  const r = await runPwsh(script, args);
  log.push(`--- stdout ---\n${r.stdout}`);
  if (r.stderr) log.push(`--- stderr ---\n${r.stderr}`);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const ok = r.code === 0;
  if (!ok) errors.push({ code: r.code, stderr: r.stderr });
  return {
    ok,
    ruleName,
    operation: "set_or_create",
    enabled: opts.environment === "production",
    commandLog: log.join("\n"),
    message: ok ? `Transport rule "${ruleName}" deployed.` : `pwsh exited with code ${r.code}`,
    errors,
  };
}

export function newDeploymentId(): string {
  return `dep_${new Date().toISOString().replace(/\.\d{3}/, "").replace(/:/g, "-")}_${crypto.randomBytes(3).toString("hex")}`;
}
