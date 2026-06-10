<#
.SYNOPSIS
    Connect to Exchange Online using certificate-based app-only auth.
.DESCRIPTION
    Reads EXO_* environment variables and runs Connect-ExchangeOnline.
    This script is dot-sourced by other scripts; it does not exit on success.
#>

$ErrorActionPreference = "Stop"

if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
    Write-Error "ExchangeOnlineManagement module not installed. Run: Install-Module ExchangeOnlineManagement -Scope CurrentUser"
    exit 10
}
Import-Module ExchangeOnlineManagement -ErrorAction Stop

$appId       = $env:EXO_APP_ID
$tenantDom   = $env:EXO_TENANT_DOMAIN
$thumbprint  = $env:EXO_CERTIFICATE_THUMBPRINT
$certPath    = $env:EXO_CERTIFICATE_PATH
$certPwd     = $env:EXO_CERTIFICATE_PASSWORD

if (-not $appId)      { Write-Error "EXO_APP_ID is not set."; exit 11 }
if (-not $tenantDom)  { Write-Error "EXO_TENANT_DOMAIN is not set."; exit 12 }

try {
    if ($thumbprint) {
        Connect-ExchangeOnline -AppId $appId -Organization $tenantDom -CertificateThumbprint $thumbprint -ShowBanner:$false | Out-Null
    } elseif ($certPath) {
        if ($certPwd) {
            $sec = ConvertTo-SecureString -String $certPwd -AsPlainText -Force
            Connect-ExchangeOnline -AppId $appId -Organization $tenantDom -CertificateFilePath $certPath -CertificatePassword $sec -ShowBanner:$false | Out-Null
        } else {
            Connect-ExchangeOnline -AppId $appId -Organization $tenantDom -CertificateFilePath $certPath -ShowBanner:$false | Out-Null
        }
    } else {
        Write-Error "Neither EXO_CERTIFICATE_THUMBPRINT nor EXO_CERTIFICATE_PATH is set."
        exit 13
    }
} catch {
    Write-Error "Connect-ExchangeOnline failed: $($_.Exception.Message)"
    exit 14
}
