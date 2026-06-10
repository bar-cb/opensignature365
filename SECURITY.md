# Security policy

## Reporting a vulnerability

Please email security reports privately to the project maintainers (or open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/repository-security-advisories) draft) rather than filing a public issue.

We aim to acknowledge reports within 5 business days.

## Threat model and operational guidance

OpenSignature365 holds powerful credentials (Exchange Admin, Graph `Mail.Send`). Operate it accordingly:

1. **No built-in auth.** The HTTP API binds to `127.0.0.1` by default. Front it with a reverse proxy (nginx / Caddy / Cloudflare Tunnel / Tailscale) that enforces authentication before reaching this app.
2. **Trusted host only.** Do not deploy on shared/multi-tenant hosts. Treat the host like a domain admin workstation.
3. **Secret storage.** Store `.env` with `chmod 600`. Prefer Azure certificate auth over client secrets for Exchange.
4. **Audit trail.** Every publish and deploy writes to `data/`. Initialize a git repo inside `data/` so changes are reviewable.
5. **Rule-name prefix.** The PowerShell deploy script **refuses** to touch any Exchange transport rule whose name does not start with `OPENSIGNATURE_RULE_PREFIX` (default `OpenSignature365`). This bounds the blast radius if the CLI is misused.
6. **HTML sanitization.** All HTML written to Exchange goes through DOMPurify with a tight allow-list (no `<script>`, no `<iframe>`, no event handlers, no inline JS, no external CSS, no remote fonts). Validation also enforces a 65 KB size cap.
7. **Production safety gate.** Production deploys require either `ALLOW_PRODUCTION_DEPLOY=true` in the environment or the `--confirm-production` flag on the deploy call.
8. **Dry-run by default.** The CLI's `DEFAULT_DRY_RUN=true` and the test target creates the Exchange rule in **disabled** state — you must enable it manually in the EAC.

## Reported supply-chain considerations

- `dompurify` + `jsdom` for HTML cleaning.
- `@azure/identity`, `@microsoft/microsoft-graph-client` for Graph.
- PowerShell module `ExchangeOnlineManagement` (Microsoft-published) for EXO.

Pin versions via `package-lock.json` and review Dependabot updates.
