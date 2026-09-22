import { signatures, reports, users } from "./storage.js";
import { validateForDeploy } from "./validation.js";
import { deployTransportRule, newDeploymentId, buildRuleName } from "../microsoft/exchange.js";
import { isoNow } from "./paths.js";
import type { DeploymentReport } from "./types.js";
import { getUser as getGraphUser } from "../microsoft/graph.js";
import { renderSignature } from "./template-engine.js";

export interface DeployArgs {
  signatureId: string;
  version: string; // "latest" allowed
  target: "test" | "production";
  dryRun: boolean;
  confirmProduction?: boolean;
}

export interface DeployOutcome {
  reportDir: string;
  report: DeploymentReport;
}

export async function runDeploy(args: DeployArgs): Promise<DeployOutcome> {
  const version = signatures.resolveVersion(args.signatureId, args.version);
  const { signature, html, text, meta } = signatures.getVersion(args.signatureId, version);

  const requirePublic = (process.env.REQUIRE_PUBLIC_IMAGE_URLS ?? "true") === "true";
  const validation = validateForDeploy(signature, { requirePublicUrls: requirePublic });
  let deploymentHtml = html;
  let deploymentText = text;
  let testFromAddresses: string[] | undefined;
  const deploymentId = newDeploymentId();
  const ruleName = buildRuleName(signature.id, args.target);

  if (args.target === "test") {
    testFromAddresses = users.testCsv();
    if (testFromAddresses.length !== 1) {
      validation.errors.push(
        `Test deployment requires exactly one UPN in data/users/test-users.csv; found ${testFromAddresses.length}.`,
      );
    } else {
      try {
        const graphUser = await getGraphUser(testFromAddresses[0]);
        const rendered = renderSignature(html, text, graphUser as any);
        deploymentHtml = rendered.html;
        deploymentText = rendered.text;
        validation.warnings.push(...rendered.warnings);
      } catch (error) {
        validation.errors.push(`Could not load test user from Microsoft Graph: ${(error as Error).message}`);
      }
    }
  }

  // Safety: production requires explicit confirmation.
  if (args.target === "production" && !args.dryRun) {
    const allow = (process.env.ALLOW_PRODUCTION_DEPLOY ?? "false") === "true";
    if (!allow && !args.confirmProduction) {
      const report: DeploymentReport = {
        deployment_id: deploymentId,
        signature_id: signature.id,
        version,
        mode: "exchange_transport_rule",
        dry_run: false,
        target: { type: args.target, count: countTarget(signature) },
        exchange: { rule_name: ruleName, operation: "set_or_create", enabled: false },
        validation,
        result: { status: "skipped", message: "Production deploy requires --confirm-production or ALLOW_PRODUCTION_DEPLOY=true." },
        generated_at: isoNow(),
      };
      const dir = reports.save(report, html, text, "(skipped — safety gate)", { reason: "production_safety_gate" });
      return { reportDir: dir, report };
    }
  }

  if (validation.errors.length) {
    const report: DeploymentReport = {
      deployment_id: deploymentId,
      signature_id: signature.id,
      version,
      mode: "exchange_transport_rule",
      dry_run: args.dryRun,
      target: { type: args.target, count: countTarget(signature) },
      exchange: { rule_name: ruleName, operation: "set_or_create", enabled: false },
      validation,
      result: { status: "failed", message: `Validation failed: ${validation.errors.length} error(s).` },
      generated_at: isoNow(),
    };
    const dir = reports.save(report, html, text, "(skipped — validation errors)", validation.errors);
    return { reportDir: dir, report };
  }

  const result = await deployTransportRule({
    signature,
    version,
    html: deploymentHtml,
    text: deploymentText,
    environment: args.target,
    dryRun: args.dryRun,
    testFromAddresses,
  });

  const report: DeploymentReport = {
    deployment_id: deploymentId,
    signature_id: signature.id,
    version,
    mode: "exchange_transport_rule",
    dry_run: args.dryRun,
    target: { type: args.target, count: countTarget(signature) },
    exchange: { rule_name: result.ruleName, operation: result.operation, enabled: result.enabled },
    validation,
    result: { status: result.ok ? "success" : "failed", message: result.message },
    generated_at: isoNow(),
  };
  const dir = reports.save(report, deploymentHtml, deploymentText, result.commandLog, result.errors);

  if (result.ok && !args.dryRun) {
    signatures.updateVersionStatus(signature.id, version, "deployed");
  }
  // Suppress unused meta variable warning by referencing it
  void meta;
  return { reportDir: dir, report };
}

function countTarget(signature: import("./types.js").Signature): number {
  const at = signature.settings.apply_to;
  if (at.mode === "test_users") return users.testCsv().length;
  return 0;
}

export async function runRollback(signatureId: string, version: string): Promise<DeployOutcome> {
  const v = signatures.resolveVersion(signatureId, version);
  return runDeploy({ signatureId, version: v, target: "production", dryRun: false, confirmProduction: true });
}
