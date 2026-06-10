# Deployment guide

## The three-stage workflow

```
1. Dry-run      → generates the exact PowerShell command, writes a report, no Exchange call
2. Test target  → creates the transport rule DISABLED, scoped to data/users/test-users.csv
3. Production   → creates/updates the rule ENABLED, scoped per signature.settings.apply_to
```

You can re-run stages 1–3 as many times as you like. Each run is recorded under `data/reports/deployments/dep_<timestamp>_<hash>/`.

## Pre-flight: validate

```bash
os365 validate --signature my-sig
```

Validation runs:

- HTML required, ≤ 65 KB
- No `<script>`, `<iframe>`, `<form>`, `<object>`, `<embed>`, `<link>`, `<style>` tags
- No `on*` event handlers
- No `@import` / external CSS
- No `@font-face` / remote fonts
- For deploy-time: status must be `published`, all `<img>` must be absolute HTTPS URLs (when `REQUIRE_PUBLIC_IMAGE_URLS=true`), `apply_to.mode` must be set
- Warnings: missing `alt` text, missing plain-text fallback

Errors block publish/deploy. Warnings are advisory.

## Publish a version

```bash
os365 publish --signature my-sig --notes "Q4 banner update"
```

This:

1. Re-runs publish-time validation
2. Renders the HTML through DOMPurify
3. Writes an immutable snapshot to `data/signatures/my-sig/versions/<timestamp>/`
4. Includes `metadata.json` with publisher (host user), notes, SHA-256 of the HTML, parent version
5. Sets the signature's `current_version` to this timestamp and `status` to `published`

You can `git commit` `data/signatures/` at this point for an external audit trail.

## Dry-run

```bash
os365 deploy --signature my-sig --target test --dry-run
# or
os365 deploy --signature my-sig --target production --dry-run --confirm-production
```

Output:

```
Report saved: data/reports/deployments/dep_2025-11-19T...
Status: success — Dry-run completed successfully (no Exchange changes performed).
```

The report contains the full `pwsh` command line that *would* run, the rendered HTML, and the validation summary. **No PowerShell process is started.** Open the report to review.

## Test deployment

```bash
os365 deploy --signature my-sig --target test
```

This:

1. Resolves `--version latest` (default) to the current published version
2. Runs `Connect-ExchangeOnline` with the app certificate
3. Calls `New-TransportRule` (or `Set-TransportRule`) named `OpenSignature365 - my-sig - test`
4. **Leaves the rule disabled** — you must enable it manually in the EAC to test against a real send
5. Scopes the rule's recipients to addresses listed in `data/users/test-users.csv`
6. Writes the deployment report

Inspect the rule in the [Exchange Admin Center → Mail flow → Rules](https://admin.exchange.microsoft.com/#/transportrules). Enable, send a test mail to one of the CSV addresses, then disable again.

## Production deployment

Production deploys are gated **twice** to prevent accidents:

```bash
# Either set in .env:
ALLOW_PRODUCTION_DEPLOY=true

# OR pass per-call:
os365 deploy --signature my-sig --target production --confirm-production
```

If neither is set, the command exits with status `skipped` and writes a report explaining why.

Production rules:

- Named `OpenSignature365 - <id> - production`
- Created **enabled**
- Scoped per `signature.settings.apply_to`:
  - `all_users` — no recipient filter
  - `domain` — `-SenderDomainIs <domain>`
  - `department` — `-FromMemberOf <group-with-that-department>` (you provide the group)
  - `group` — `-SentToMemberOf <group-id>`
  - `csv` — addresses from a CSV file you specify
- `disclaimer_location`: `append` (most common) or `prepend`
- `fallback_action`: `wrap` (default), `ignore`, or `reject` — controls behavior when the message can't be modified (encrypted / signed)

## Rollback

```bash
os365 rollback --signature my-sig --version 2025-11-12T08-22-19Z
```

Equivalent to `deploy --target production --confirm-production` with a specific older version. The previous version's signature HTML is re-applied to the same `OpenSignature365 - <id> - production` rule.

## Removing a deployed signature

There is no `os365 remove` command (intentional — destructive). In the EAC:

1. Disable the rule.
2. Delete the rule manually.

The signature definition stays in `data/` for future re-deployment.

## CI / automation

Both the CLI and HTTP API are scriptable. Wire `os365 deploy` into a GitHub Action or your CI of choice, but always:

- Run `--dry-run` first and post the report as a PR comment
- Use `--confirm-production` explicitly (never set `ALLOW_PRODUCTION_DEPLOY=true` in CI defaults)
- Store the EXO certificate as a CI secret (`.pfx` base64-encoded → decode at job start)
