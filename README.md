# OpenSignature365

**Open-source, self-hosted email signature management for Microsoft 365 / Outlook.**

Design centralized signatures with dynamic fields (name, title, phone, photo, banner…), preview them per user, and deploy them tenant-wide through **Exchange Online transport rules** (the only supported, tenant-wide mechanism Microsoft offers for app-driven signature management as of 2025).

Licensed under **AGPL-3.0-or-later**.

---

## ⚠ Important: how this works on Microsoft 365

Microsoft does **not** expose a public API to write each user's *native* Outlook signature.
Tenant-wide signature enforcement is delivered through **Exchange Online transport rules** that append or prepend an HTML disclaimer to outgoing mail server-side. This is the same mechanism used by all major commercial signature products (CodeTwo, Exclaimer, Symprex, etc.).

Implications you must understand before deploying:

- Signatures are appended **server-side**, so users **do not see the signature in Outlook's Sent Items** before send. They see it only on the received copy.
- Signed/encrypted mail (S/MIME, IRM, Microsoft Purview Message Encryption) **cannot be modified** and bypasses the rule (configurable fallback: `wrap`, `ignore`, `reject`).
- Inline images **must be hosted on a public HTTPS URL** (Outlook does not download CID-embedded images injected by transport rules reliably across all clients).
- Replies append an additional signature each time — keep the signature compact, or use a `prepend` location for replies-only rules.

If you need a *native* in-Outlook signature shown in the compose window, that requires a separate Outlook add-in. This project does **not** install add-ins; it manages transport rules only.

---

## What you get

- Signature **library** with publish / version history
- **18 ready-made HTML templates** (classic, modern, executive, support, sales, banner, plain-text, etc.)
- **Dynamic tag engine** (Handlebars) mapping to Microsoft Graph user attributes: `{{displayName}}`, `{{jobTitle}}`, `{{mail}}`, `{{businessPhones.0}}`, `{{mobilePhone}}`, `{{department}}`, `{{officeLocation}}`, `{{city}}`, `{{country}}`, `{{companyName}}`, fallbacks via `{{tag | fallback:"x"}}`
- **HTML sanitizer** (DOMPurify allow-list) — no scripts, no event handlers, no external CSS, no remote fonts
- **Email-safe rendering rules** + size limit checks (≤65 KB)
- **Live preview** with sample users, desktop/mobile widths
- **Send preview email** through Microsoft Graph `/sendMail`
- **Dry-run deployment** that shows the exact PowerShell command without touching Exchange
- **Test deployments** create the transport rule **disabled** for a CSV of test users only
- **Production deployments** require explicit confirmation (env flag + per-call flag)
- **Immutable versioning**: every publish writes a versioned snapshot with SHA-256 hash
- **Deployment reports** in Markdown + JSON for every run
- **CLI** + **HTTP API** + **Web UI**
- File-based storage only (no database). Audit trail = filesystem + git.

---

## Quick start (developer mode)

```bash
git clone <this repo>
cd opensignature365
npm install
cp .env.example .env       # fill in Microsoft credentials when you have them
npm run dev                # starts API on :4070 and web on :4071 (proxy → :4070)
```

You can use the project entirely **offline** to design and test signatures (templates, preview against sample users, dry-run reports) without Microsoft credentials.

### Production-style run

```bash
npm run build              # compiles TS server + builds web/dist
node dist/server/index.js  # serves API + UI on http://127.0.0.1:4070
```

Or use the CLI:

```bash
npx opensignature365 --help
npx os365 list-templates
npx os365 deploy --signature my-sig --target test --dry-run
```

---

## Configuration

All configuration is via environment variables (`.env` file in repo root):

| Variable | Required for | Default | Notes |
|---|---|---|---|
| `MICROSOFT_TENANT_ID` | Graph + EXO | — | Entra tenant GUID |
| `MICROSOFT_CLIENT_ID` | Graph | — | App registration with Graph permissions |
| `MICROSOFT_CLIENT_SECRET` | Graph | — | Or use certificate (see docs/) |
| `EXO_APP_ID` | Exchange deploy | — | App with Exchange Admin role |
| `EXO_TENANT_DOMAIN` | Exchange deploy | — | e.g. `contoso.onmicrosoft.com` |
| `EXO_CERTIFICATE_THUMBPRINT` | Exchange deploy | — | Cert installed in current user's store |
| `EXO_CERTIFICATE_PATH` | Exchange deploy (alt) | — | Path to .pfx file (Linux/macOS) |
| `EXO_CERTIFICATE_PASSWORD` | Exchange deploy (alt) | — | Password for .pfx |
| `EXO_POWERSHELL_BIN` | Exchange deploy | `pwsh` | PowerShell 7 binary |
| `PREVIEW_SENDER_UPN` | Send preview | — | Mailbox the preview is sent **from** |
| `ALLOW_PRODUCTION_DEPLOY` | Production safety | `false` | Must be `true` to skip per-call confirmation |
| `DEFAULT_DRY_RUN` | CLI default | `true` | |
| `OPENSIGNATURE_RULE_PREFIX` | Safety | `OpenSignature365` | PowerShell refuses to touch rules not starting with this |
| `REQUIRE_PUBLIC_IMAGE_URLS` | Validation | `true` | Reject local/relative `<img src>` on deploy |
| `APP_HOST` | Server | `127.0.0.1` | Set to `0.0.0.0` only behind auth |
| `APP_PORT` | Server | `4070` | |
| `APP_DATA_DIR` | Storage | `./data` | Where signatures/versions/reports live |

See [.env.example](.env.example) for the full template.

---

## What a tenant admin needs

To use OpenSignature365 against a real Microsoft 365 tenant:

1. **An Entra (Azure AD) app registration** with the following Microsoft Graph application permissions (admin-consented):
   - `User.Read.All` — read user attributes for previews
   - `Mail.Send` — send preview emails (optional)
   - `Directory.Read.All` — list users
   - `Group.Read.All` *(optional)* — for group-scoped rules
   - `Organization.Read.All` *(optional)* — for tenant info
2. **The same (or a second) app** with **certificate-based** authentication assigned the **Exchange Administrator** role (or "Compliance Management" + "Transport Hygiene") for Exchange Online PowerShell access.
3. **PowerShell 7** installed on the host running OpenSignature365 (`brew install --cask powershell` / `apt install powershell` / [docs](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)).
4. The **ExchangeOnlineManagement** PowerShell module installed: `pwsh -Command "Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force"`.
5. A **public HTTPS URL** to host signature images (S3, Azure Blob with public read, your CDN, your website…).
6. A **test recipient list** (CSV under `data/users/test-users.csv`) for "test target" deployments.

Detailed step-by-step setup in [docs/microsoft-setup.md](docs/microsoft-setup.md).

---

## Workflow

```
 ┌── Pick a template ──┐    ┌── Edit + dynamic tags ──┐    ┌── Validate ──┐
 │  18 starting points │ →  │  Handlebars + sanitizer │ →  │  publish v1  │
 └─────────────────────┘    └─────────────────────────┘    └──────┬───────┘
                                                                  ↓
                              ┌── Dry-run ──┐    ┌── Test target ──┐    ┌── Production ──┐
                              │  no changes │ →  │ disabled rule   │ →  │  enabled rule  │
                              └─────────────┘    │ CSV recipients  │    │  with confirm  │
                                                 └─────────────────┘    └────────────────┘
```

1. **Create** a signature from a template (Web UI → *Templates*, or CLI `from-template`).
2. **Edit** the HTML; insert dynamic tags from the sidebar; live preview against sample users.
3. **Validate** (errors block publish; warnings are informational).
4. **Publish** — writes an immutable version under `data/signatures/<id>/versions/<timestamp>/`.
5. **Dry-run deploy** — generates the PowerShell command and a JSON+Markdown report under `data/reports/deployments/` without invoking PowerShell at all.
6. **Test deploy** — creates an Exchange transport rule **disabled**, scoped to the `test-users.csv` list. Inspect in the EAC, enable manually to test against a real send.
7. **Production deploy** — requires either `ALLOW_PRODUCTION_DEPLOY=true` in env **or** the `--confirm-production` flag. Creates/updates an **enabled** rule scoped per the signature's `apply_to` setting.
8. **Rollback** — `os365 rollback --signature X --version <timestamp>` redeploys an older version to production.

Every operation lands in `data/reports/deployments/<deployment_id>/` with `report.json`, `report.md`, the rendered `signature.html`, and the full Exchange PowerShell command log.

---

## CLI

```text
opensignature365 dev              # tsx watch server
opensignature365 list-signatures
opensignature365 list-versions    --signature <id>
opensignature365 list-templates
opensignature365 validate         --signature <id>
opensignature365 publish          --signature <id> [--notes "..."]
opensignature365 preview          --signature <id> [--user 0]
opensignature365 send-preview     --signature <id> --to <addr> [--upn <UPN>]
opensignature365 deploy           --signature <id> [--version latest|<ts>] [--target test|production] [--dry-run] [--confirm-production]
opensignature365 rollback         --signature <id> --version <ts>
opensignature365 report           [--latest | --id <deployment_id>]
opensignature365 test-graph
opensignature365 test-exchange
```

The shorter alias `os365` is also installed.

---

## HTTP API (REST, JSON)

Mounted under `/api`. The Express server also serves the built React UI from `/`.

```
GET    /api/signatures
GET    /api/signatures/:id
POST   /api/signatures                            { id, name, ... }
POST   /api/signatures/from-template/:templateId  { id, name }
PUT    /api/signatures/:id                         (full signature object)
POST   /api/signatures/:id/publish                { notes }
GET    /api/signatures/:id/versions
GET    /api/templates
GET    /api/templates/:id
POST   /api/preview/render                        { signatureId, sampleIndex?, upn? }
POST   /api/preview/send                          { signatureId, to, upn? }
GET    /api/assets
POST   /api/assets                                multipart/form-data file
POST   /api/assets/validate-url                   { url }
GET    /api/microsoft/status
GET    /api/microsoft/users?limit=25
POST   /api/microsoft/test-graph
POST   /api/microsoft/test-exchange
POST   /api/deploy/validate                       { signatureId }
POST   /api/deploy/dry-run                        { signatureId, version?, target? }
POST   /api/deploy/production                     { signatureId, version?, target?, confirmProduction? }
GET    /api/reports
GET    /api/reports/:id
GET    /api/sample-users
GET    /api/config/tags
```

There is **no built-in authentication**. Run the server bound to `127.0.0.1` (default) and reverse-proxy through nginx/Caddy with basic-auth, mTLS, OIDC, or your VPN. Setting `APP_HOST=0.0.0.0` will emit a warning at startup.

---

## Storage layout

```
data/
├── signatures/
│   └── <signature-id>/
│       ├── signature.json
│       └── versions/
│           └── 2025-11-19T11-04-22Z/
│               ├── signature.json     (immutable snapshot)
│               ├── signature.html
│               ├── signature.txt
│               └── metadata.json      (publisher, notes, sha256, version)
├── templates/
│   └── <template-id>/
│       ├── template.json
│       ├── template.html
│       └── (template.txt)
├── assets/
│   └── uploads/
├── users/
│   ├── sample-users.json
│   └── test-users.csv
├── config/
│   ├── tags.schema.json
│   └── app.config.json
└── reports/
    └── deployments/
        └── dep_2025-11-19T11-09-08Z_a1b2c3/
            ├── report.json
            ├── report.md
            ├── signature.html
            └── exchange.command.log.txt
```

Everything is plain files. `git init` inside `data/` for instant audit history.

---

## Documentation

- [docs/microsoft-setup.md](docs/microsoft-setup.md) — Entra app, Graph permissions, EXO certificate auth
- [docs/graph-permissions.md](docs/graph-permissions.md) — Required + optional permissions table
- [docs/exchange-online-permissions.md](docs/exchange-online-permissions.md) — EXO roles, module install
- [docs/deployment-guide.md](docs/deployment-guide.md) — Dry-run → test → production, rollback
- [docs/troubleshooting.md](docs/troubleshooting.md) — Common errors
- [SECURITY.md](SECURITY.md) — Reporting vulnerabilities, threat model
- [CONTRIBUTING.md](CONTRIBUTING.md) — Dev setup, tests
- [LICENSE](LICENSE) — AGPL-3.0-or-later full text

---

## License

Copyright © 2025 OpenSignature365 contributors.

Released under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later).
See [LICENSE](LICENSE).

If you run a modified version of OpenSignature365 as a network service, the AGPL requires that you offer your users the modified source code.
