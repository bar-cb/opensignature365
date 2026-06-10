<#
.SYNOPSIS
    Validate Exchange Online certificate-based auth and return basic org info.
#>
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here "connect-exchange-online.ps1")

try {
    $org = Get-OrganizationConfig | Select-Object Name, Identity, DisplayName
    $org | ConvertTo-Json -Depth 3
    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
    exit 0
} catch {
    Write-Error $_.Exception.Message
    Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    exit 20
}
