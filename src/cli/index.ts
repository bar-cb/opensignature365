#!/usr/bin/env node
import "dotenv/config";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { signatures, templates, reports, users } from "../core/storage.js";
import { renderSignature } from "../core/template-engine.js";
import { validateForPublish } from "../core/validation.js";
import { runDeploy, runRollback } from "../core/deploy.js";
import { sendPreviewEmail, testGraphConnection } from "../microsoft/graph.js";
import { testExchangeConnection } from "../microsoft/exchange.js";
import { spawn } from "node:child_process";
import path from "node:path";

function ok(msg: string) { console.log(`✓ ${msg}`); }
function warn(msg: string) { console.warn(`! ${msg}`); }
function fail(msg: string): never { console.error(`✗ ${msg}`); process.exit(1); }

yargs(hideBin(process.argv))
  .scriptName("opensignature365")
  .version(false) // we use --version as a signature-version flag
  .command("dev", "Start dev server (uses tsx watch)", {}, () => {
    const here = path.dirname(new URL(import.meta.url).pathname);
    const entry = path.resolve(here, "../server/index.js");
    const child = spawn(process.execPath, [entry], { stdio: "inherit", env: process.env });
    child.on("exit", (c) => process.exit(c ?? 0));
  })
  .command("list-signatures", "List signatures", {}, () => {
    const list = signatures.list();
    if (!list.length) { warn("No signatures yet."); return; }
    for (const s of list) console.log(`${s.id.padEnd(30)} ${s.status.padEnd(10)} ${s.name}`);
  })
  .command("list-versions", "List versions of a signature", (y) =>
    y.option("signature", { type: "string", demandOption: true }),
    (argv) => {
      const versions = signatures.listVersions(argv.signature as string);
      if (!versions.length) { warn("No published versions."); return; }
      for (const v of versions) console.log(`${v.version}  ${v.deployment_status.padEnd(14)} ${v.notes || ""}`);
    },
  )
  .command("list-templates", "List built-in templates", {}, () => {
    for (const t of templates.list()) console.log(`${t.id.padEnd(28)} [${t.category}]  ${t.name}`);
  })
  .command("validate", "Validate a signature", (y) =>
    y.option("signature", { type: "string", demandOption: true }),
    (argv) => {
      const sig = signatures.get(argv.signature as string);
      const v = validateForPublish(sig);
      v.warnings.forEach((w) => warn(w));
      if (v.errors.length) { v.errors.forEach((e) => console.error(`✗ ${e}`)); process.exit(2); }
      ok("Validation passed.");
    },
  )
  .command("publish", "Publish a new version", (y) =>
    y.option("signature", { type: "string", demandOption: true }).option("notes", { type: "string", default: "" }),
    (argv) => {
      const sig = signatures.get(argv.signature as string);
      const v = validateForPublish(sig);
      if (v.errors.length) { v.errors.forEach((e) => console.error(`✗ ${e}`)); fail("Validation failed."); }
      const meta = signatures.publish(argv.signature as string, argv.notes as string);
      ok(`Published version ${meta.version}`);
    },
  )
  .command("preview", "Render a preview to stdout", (y) =>
    y.option("signature", { type: "string", demandOption: true })
      .option("user", { type: "string", default: "sample", describe: "'sample' or a sample-users.json index" }),
    (argv) => {
      const sig = signatures.get(argv.signature as string);
      const sampleUsers = users.sample();
      const u = (argv.user === "sample") ? sampleUsers[0] : sampleUsers[Number(argv.user)] || sampleUsers[0];
      if (!u) fail("No sample users available. Add data/users/sample-users.json.");
      const rendered = renderSignature(sig.editor.html, sig.editor.text, u);
      rendered.warnings.forEach((w) => warn(w));
      console.log("\n--- HTML ---\n" + rendered.html);
      console.log("\n--- TEXT ---\n" + rendered.text);
    },
  )
  .command("send-preview", "Send preview email via Microsoft Graph", (y) =>
    y.option("signature", { type: "string", demandOption: true })
      .option("to", { type: "string", demandOption: true }),
    async (argv) => {
      const sig = signatures.get(argv.signature as string);
      const u = users.sample()[0] || { displayName: "Sample", mail: "sample@example.com" };
      const rendered = renderSignature(sig.editor.html, sig.editor.text, u);
      await sendPreviewEmail({
        toUpn: argv.to as string,
        subject: `[OpenSignature365 Preview] ${sig.name}`,
        html: rendered.html,
      });
      ok(`Preview sent to ${argv.to}`);
    },
  )
  .command("deploy", "Deploy a signature", (y) =>
    y.option("signature", { type: "string", demandOption: true })
      .option("version", { type: "string", default: "latest" })
      .option("target", { type: "string", default: "test", choices: ["test", "production"] })
      .option("dry-run", { type: "boolean", default: false })
      .option("confirm-production", { type: "boolean", default: false }),
    async (argv) => {
      const out = await runDeploy({
        signatureId: argv.signature as string,
        version: argv.version as string,
        target: argv.target as "test" | "production",
        dryRun: !!argv["dry-run"],
        confirmProduction: !!argv["confirm-production"],
      });
      console.log(`Report saved: ${out.reportDir}`);
      console.log(`Status: ${out.report.result.status} — ${out.report.result.message}`);
      if (out.report.result.status !== "success") process.exit(2);
    },
  )
  .command("rollback", "Redeploy a previous version", (y) =>
    y.option("signature", { type: "string", demandOption: true })
      .option("version", { type: "string", demandOption: true }),
    async (argv) => {
      const out = await runRollback(argv.signature as string, argv.version as string);
      console.log(`Rollback report: ${out.reportDir}`);
    },
  )
  .command("report", "Show latest deployment report", (y) =>
    y.option("latest", { type: "boolean", default: true }).option("id", { type: "string" }),
    (argv) => {
      if (argv.id) { console.log(JSON.stringify(reports.get(argv.id as string).report, null, 2)); return; }
      const list = reports.list();
      if (!list.length) { warn("No reports yet."); return; }
      console.log(JSON.stringify(list[0], null, 2));
    },
  )
  .command("test-graph", "Test Microsoft Graph connection", {}, async () => {
    const r = await testGraphConnection();
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(2);
  })
  .command("test-exchange", "Test Exchange Online PowerShell connection", {}, async () => {
    const r = await testExchangeConnection();
    console.log(JSON.stringify(r, null, 2));
    if (!r.ok) process.exit(2);
  })
  .demandCommand(1)
  .strict()
  .help()
  .parse();
