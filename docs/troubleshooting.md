# Troubleshooting

## "pwsh: command not found"

Install PowerShell 7+:

- macOS: `brew install --cask powershell`
- Linux: `apt install powershell` (after adding the MS repo) — [docs](https://learn.microsoft.com/powershell/scripting/install/install-other-linux)
- Windows: bundled, or `winget install Microsoft.PowerShell`

Then either ensure `pwsh` is on PATH, or set `EXO_POWERSHELL_BIN=/full/path/to/pwsh` in `.env`.

## "The term 'Connect-ExchangeOnline' is not recognized"

The `ExchangeOnlineManagement` module is missing.

```bash
pwsh -Command "Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force -AllowClobber"
```

## "AADSTS70011: invalid scope" or "insufficient privileges"

The Entra app is missing one of the required permissions or admin consent was not granted. See [graph-permissions.md](graph-permissions.md) and re-grant admin consent. After granting, wait ~60 seconds for propagation.

## "Certificate not found" / "PSCertificateThumbprint is invalid"

- On Windows, the certificate is searched in `Cert:\CurrentUser\My` by thumbprint. Confirm with `Get-ChildItem Cert:\CurrentUser\My`. If the cert lives in `LocalMachine`, run as that account or move the cert.
- On macOS/Linux, use `EXO_CERTIFICATE_PATH` + `EXO_CERTIFICATE_PASSWORD` instead of a thumbprint.

## "RuleName must start with 'OpenSignature365'"

By design. The PowerShell script refuses any rule name not starting with the prefix. Change `OPENSIGNATURE_RULE_PREFIX` only if you understand the safety implication.

## Signature shows in Sent Items in Outlook

Transport-rule signatures are **server-side** and never appear in the sender's Sent Items pre-send. Recipients see the signature; the original message in Sent Items does not contain it. This is a Microsoft limitation, not a bug.

## Images not loading in Outlook

- The image URL must be **HTTPS** and publicly reachable (no auth, no IP restriction).
- Outlook for Windows respects the recipient's "Download external images" setting. First-time recipients may need to click "Download images".
- Avoid SVGs (Outlook strips them). Use PNG/JPEG.
- Specify width/height attributes to prevent layout shift.
- For corporate-only deployments, host on a domain everyone in the company is allowed to reach.

## Signature appears twice on long reply chains

Each new outgoing reply re-triggers the transport rule. Options:

- Keep the signature compact (~120-180px tall)
- Use `prepend` location so the signature sits at the top once
- Create a second rule that excludes messages matching a header marker (e.g. an HTML comment `<!-- opensig365 -->`) — Exchange supports such exceptions but this is admin-managed outside OpenSignature365

## Encrypted / signed mail bypasses the rule

Expected. Configure `fallback_action`:

- `wrap` — Exchange wraps the original message and applies the disclaimer to the wrapper (default; recipients see two attachments / a wrapper notice)
- `ignore` — message delivered unmodified, no signature appended
- `reject` — message bounced with NDR; only use when legal requires the disclaimer

## "Validation failed: Signature must be published before deployment"

You created a draft and tried to deploy. Run `os365 publish --signature <id>` first.

## Web UI loads but APIs fail with 404

The Express server serves the API and (in production) the built UI on the same port. If you run the Vite dev server (`npm run dev:web`), it proxies `/api` to `http://127.0.0.1:4070` — make sure the API server is also running (`npm run dev:server` or both via `npm run dev`).

## "EADDRINUSE: 127.0.0.1:4070"

Another process holds the port. Find and kill it:

```bash
lsof -ti:4070 | xargs kill
```

Or change `APP_PORT` in `.env`.
