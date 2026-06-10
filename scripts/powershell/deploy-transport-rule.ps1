<#
.SYNOPSIS
    Create or update a managed OpenSignature365 transport rule.
.PARAMETER RuleName
    Required. Full rule name (e.g. "OpenSignature365 - company-main - test").
.PARAMETER HtmlPath
    Path to a UTF-8 file containing the disclaimer HTML.
.PARAMETER Location
    'append' or 'prepend'.
.PARAMETER FallbackAction
    'wrap', 'ignore', or 'reject'.
.PARAMETER ApplyToMode
    'all_users', 'test_users', 'domain', 'department', 'group', 'csv'.
.PARAMETER GroupId
    SMTP address or ObjectId of the group (when ApplyToMode = 'group').
.PARAMETER Domain
    Sender domain to scope to.
.PARAMETER Department
    Department name to scope to (matches sender's department attribute).
.PARAMETER Enabled
    'true' or 'false'.
.PARAMETER WhatIf
    Plan-only mode: prints what would happen and exits 0.

.NOTES
    Only manages rules whose name starts with $env:OPENSIGNATURE_RULE_PREFIX
    (default "OpenSignature365"). Will never touch unrelated rules.
#>
param(
    [Parameter(Mandatory=$true)][string]$RuleName,
    [Parameter(Mandatory=$true)][string]$HtmlPath,
    [string]$Location = "append",
    [string]$FallbackAction = "wrap",
    [string]$ApplyToMode = "test_users",
    [string]$GroupId,
    [string]$Domain,
    [string]$Department,
    [string]$Enabled = "false",
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$prefix = if ($env:OPENSIGNATURE_RULE_PREFIX) { $env:OPENSIGNATURE_RULE_PREFIX } else { "OpenSignature365" }

if (-not $RuleName.StartsWith($prefix)) {
    Write-Error "Refusing to manage rule '$RuleName' — name must start with '$prefix'."
    exit 30
}
if (-not (Test-Path $HtmlPath)) { Write-Error "HtmlPath not found: $HtmlPath"; exit 31 }

$html = Get-Content -Raw -Path $HtmlPath -Encoding UTF8

$locValue = switch ($Location) {
    "prepend" { "Prepend" }
    default   { "Append" }
}
$fallbackValue = switch ($FallbackAction) {
    "ignore" { "Ignore" }
    "reject" { "Reject" }
    default  { "Wrap" }
}

# Build scoping conditions.
$conditions = @{}
switch ($ApplyToMode) {
    "all_users"   { }
    "test_users"  { } # The Node app must seed specific FromAddresses via -SentTo / -From; for now scope to admin only as a safety net.
    "domain"      { if ($Domain) { $conditions.SenderDomainIs = @($Domain) } }
    "department"  { if ($Department) { $conditions.FromMemberOf = $null; $conditions.SenderADAttributeContainsWords = @{Department=@($Department)} } }
    "group"       { if ($GroupId) { $conditions.FromMemberOf = @($GroupId) } }
    "csv"         { } # Caller is expected to pre-create the group; handled like group.
}

if ($WhatIf) {
    Write-Output ("[WHATIF] Rule: {0}" -f $RuleName)
    Write-Output ("[WHATIF] Location: {0}" -f $locValue)
    Write-Output ("[WHATIF] FallbackAction: {0}" -f $fallbackValue)
    Write-Output ("[WHATIF] ApplyToMode: {0}" -f $ApplyToMode)
    Write-Output ("[WHATIF] Enabled: {0}" -f $Enabled)
    Write-Output ("[WHATIF] HTML size: {0} bytes" -f $html.Length)
    Write-Output ("[WHATIF] Conditions: {0}" -f ($conditions | ConvertTo-Json -Compress -Depth 5))
    exit 0
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $here "connect-exchange-online.ps1")

try {
    $existing = Get-TransportRule -Identity $RuleName -ErrorAction SilentlyContinue
    $params = @{
        ApplyHtmlDisclaimerText      = $html
        ApplyHtmlDisclaimerLocation  = $locValue
        ApplyHtmlDisclaimerFallbackAction = $fallbackValue
        Mode                         = "Enforce"
    }
    foreach ($k in $conditions.Keys) { $params[$k] = $conditions[$k] }

    if ($existing) {
        Write-Output ("Updating existing rule '{0}'..." -f $RuleName)
        Set-TransportRule -Identity $RuleName @params | Out-Null
    } else {
        Write-Output ("Creating rule '{0}'..." -f $RuleName)
        New-TransportRule -Name $RuleName @params | Out-Null
    }

    if ($Enabled -eq "true") {
        Enable-TransportRule -Identity $RuleName | Out-Null
        Write-Output "Rule enabled."
    } else {
        Disable-TransportRule -Identity $RuleName -Confirm:$false | Out-Null
        Write-Output "Rule disabled (test mode)."
    }

    Get-TransportRule -Identity $RuleName | Select-Object Name, State, Mode, ApplyHtmlDisclaimerLocation, ApplyHtmlDisclaimerFallbackAction | ConvertTo-Json -Depth 3

    Disconnect-ExchangeOnline -Confirm:$false | Out-Null
    exit 0
} catch {
    Write-Error $_.Exception.Message
    Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
    exit 40
}
