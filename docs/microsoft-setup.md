# Microsoft 365 setup

This walks through every Microsoft-side step needed for OpenSignature365 to operate against your tenant. Plan ~30 minutes the first time.

## 1. Pre-requisites

- Global Administrator (or Application Admin + Exchange Admin) on the target tenant for the **one-time** setup
- PowerShell 7+ installed on the OpenSignature365 host  
  `brew install --cask powershell` · `apt install powershell` · [docs](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)
- The Exchange Online module:  
  `pwsh -Command "Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force -AllowClobber"`

## 2. Register an Entra (Azure AD) app for Microsoft Graph

1. Go to **Entra admin center → Identity → Applications → App registrations → New registration**.
2. Name: `OpenSignature365 - Graph`. Accounts: *Single tenant*. Redirect URI: leave blank.
3. Note the **Application (client) ID** and **Directory (tenant) ID** → these become `MICROSOFT_CLIENT_ID` and `MICROSOFT_TENANT_ID`.
4. **Certificates & secrets → New client secret** → 12-24 months → copy the **Value** → this is `MICROSOFT_CLIENT_SECRET` (you will not see it again).
5. **API permissions → Add a permission → Microsoft Graph → Application permissions**:
   - `User.Read.All` *(required)*
   - `Directory.Read.All` *(required)*
   - `Mail.Send` *(required if you want to send preview emails)*
   - `Group.Read.All` *(optional — only if you'll target groups)*
   - `Organization.Read.All` *(optional)*
6. Click **Grant admin consent for <tenant>**.

You can now run `os365 test-graph` and it should print your tenant's organization JSON.

## 3. Register an app for Exchange Online PowerShell (certificate auth)

App-only auth to Exchange Online **requires a certificate** (client secrets are not accepted by EXO PowerShell). See [Microsoft docs](https://learn.microsoft.com/powershell/exchange/app-only-auth-powershell-v2).

### 3a. Create the certificate

On the OpenSignature365 host:

```bash
# OpenSSL example
openssl req -x509 -newkey rsa:2048 -keyout opensig.key -out opensig.crt \
  -days 730 -nodes -subj "/CN=OpenSignature365"
openssl pkcs12 -export -out opensig.pfx -inkey opensig.key -in opensig.crt
# answer with a strong password — this becomes EXO_CERTIFICATE_PASSWORD
```

On Windows, use PowerShell:

```powershell
$cert = New-SelfSignedCertificate -Subject "CN=OpenSignature365" `
  -CertStoreLocation "cert:\CurrentUser\My" -KeyExportPolicy Exportable `
  -KeySpec Signature -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(2)
$cert.Thumbprint   # → EXO_CERTIFICATE_THUMBPRINT
Export-Certificate -Cert $cert -FilePath opensig.crt   # upload this .crt to Entra
```

### 3b. Register the app

1. **Entra → App registrations → New registration**. Name: `OpenSignature365 - Exchange`.
2. Note the **Application (client) ID** → `EXO_APP_ID`.
3. **Certificates & secrets → Certificates → Upload certificate** → upload the `.crt` (public key) from step 3a.
4. **API permissions → Add → Office 365 Exchange Online → Application permissions → `Exchange.ManageAsApp`** → Grant admin consent.

### 3c. Assign Exchange admin role to the app

In the Entra admin center:

1. **Roles & admins → Exchange Administrator → Assignments → Add assignments**.
2. Search for the app name (`OpenSignature365 - Exchange`) and assign it.

Alternative (more least-privilege but limited): `Compliance Administrator` works for transport rules in most tenants.

### 3d. Set env vars

```env
EXO_APP_ID=<application-client-id>
EXO_TENANT_DOMAIN=contoso.onmicrosoft.com
EXO_CERTIFICATE_THUMBPRINT=<thumbprint>            # Windows / cert in store
# or
EXO_CERTIFICATE_PATH=/abs/path/to/opensig.pfx       # macOS / Linux host process
EXO_CERTIFICATE_PASSWORD=<password>
EXO_POWERSHELL_BIN=pwsh
```

When the app runs in Docker, `EXO_CERTIFICATE_PATH` must be the **container**
path (`/app/certs/opensignature365-exchange.pfx`). Compose mounts the host PFX
there read-only. See [docker.md](docker.md#certificate-paths).

Verify with `os365 test-exchange` (or the Settings page / `test-exchange` API
inside the container). You should see `OrganizationConfig` JSON.

## 4. Configure the test target list

Edit `data/users/test-users.csv` (one address per line). When you deploy with `--target test`, the Exchange rule is created **disabled** and scoped to these addresses only.

## 5. Public image hosting

Outlook only renders signature images reliably when they are **publicly reachable** HTTPS URLs. Host your logo and banner on:

- An S3 bucket with `public-read` ACL, or CloudFront in front of it
- Azure Blob storage (anonymous read container)
- Your marketing website's `/static/` path
- Any CDN

Put the resulting URLs into the signature HTML directly (`<img src="https://cdn.example.com/logos/acme.png" alt="Acme" width="120" />`). The validator will warn on `<img>` tags without `alt` and refuse to deploy on local/relative URLs when `REQUIRE_PUBLIC_IMAGE_URLS=true`.

## 6. Final sanity check

```bash
os365 test-graph         # should print tenant info
os365 test-exchange      # should print Get-OrganizationConfig JSON
os365 list-templates     # should list 18 templates
os365 list-signatures
```

You're ready to publish and dry-run your first deployment. See [deployment-guide.md](deployment-guide.md).
