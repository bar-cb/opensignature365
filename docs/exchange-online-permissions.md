# Exchange Online permissions and PowerShell setup

## Module installation

OpenSignature365 calls the [`ExchangeOnlineManagement`](https://www.powershellgallery.com/packages/ExchangeOnlineManagement) PowerShell module (Microsoft-published) via `pwsh` subprocess.

Install once on the host that runs OpenSignature365:

```bash
pwsh -Command "Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force -AllowClobber"
```

Verify:

```bash
pwsh -Command "Get-Module ExchangeOnlineManagement -ListAvailable | Select Name,Version"
```

Update periodically:

```bash
pwsh -Command "Update-Module ExchangeOnlineManagement"
```

## Required Exchange role for the app principal

Assign one of these directory roles to the `OpenSignature365 - Exchange` app (see [microsoft-setup.md](microsoft-setup.md) §3c):

| Role | Scope | Notes |
|---|---|---|
| **Exchange Administrator** | All Exchange config | Simplest. Recommended. |
| **Compliance Administrator** | Transport rules, DLP | Also works for `Set-TransportRule` / `New-TransportRule`. |

Role assignment via portal: **Entra → Roles & admins → \<Role\> → Assignments → Add → Service principal**.

Role assignment via PowerShell:

```powershell
Connect-AzureAD
$role = Get-AzureADDirectoryRole | ? DisplayName -eq "Exchange Administrator"
$sp   = Get-AzureADServicePrincipal -Filter "DisplayName eq 'OpenSignature365 - Exchange'"
Add-AzureADDirectoryRoleMember -ObjectId $role.ObjectId -RefObjectId $sp.ObjectId
```

## Permission scope of OpenSignature365 PowerShell scripts

The bundled scripts under `scripts/powershell/` only call:

| Cmdlet | Why |
|---|---|
| `Connect-ExchangeOnline -CertificateThumbprint/-CertificateFilePath -AppId -Organization` | Connect using app-only certificate auth |
| `Get-OrganizationConfig` | `test-exchange` health probe |
| `Get-TransportRule -Identity` | Detect existing rule of the same name |
| `New-TransportRule` | Create the signature rule when missing |
| `Set-TransportRule` | Update HTML/scope/location of an existing rule |
| `Enable-TransportRule` / `Disable-TransportRule` | Toggle enabled state |
| `Disconnect-ExchangeOnline -Confirm:$false` | Clean session teardown |

## Safety guard

`deploy-transport-rule.ps1` **refuses** to operate on any rule whose `-RuleName` does not begin with the value of `$env:OPENSIGNATURE_RULE_PREFIX` (default `OpenSignature365`). This bounds what the tool can ever touch — pre-existing rules from CodeTwo/Exclaimer/manual admins are out of reach by design.

## Inspecting and managing rules manually

In the Exchange Admin Center: **Mail flow → Rules**. Rules created by OpenSignature365 follow the naming convention:

```
OpenSignature365 - <signature-id> - test
OpenSignature365 - <signature-id> - production
```

You can disable, delete, or change the priority manually in the EAC at any time. OpenSignature365 will pick up the change on the next deploy (it uses `Set-TransportRule` when the rule already exists).

## Removing OpenSignature365 from your tenant

1. Disable all `OpenSignature365 - *` rules in the EAC.
2. Delete the rules: `Get-TransportRule | ? Name -like "OpenSignature365 - *" | Remove-TransportRule`.
3. Revoke the certificate from the app registration.
4. Delete both app registrations.
