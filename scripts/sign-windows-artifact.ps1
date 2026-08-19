[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-SignToolPath {
    if ($env:WINDOWS_SIGN_TOOL_PATH) {
        return (Resolve-Path -LiteralPath $env:WINDOWS_SIGN_TOOL_PATH).Path
    }

    $command = Get-Command signtool.exe -ErrorAction Stop
    return $command.Source
}

function Get-SignToolArguments {
    param(
        [string]$ArtifactPath
    )

    $timestampUrl = if ($env:WINDOWS_SIGN_TIMESTAMP_URL) {
        $env:WINDOWS_SIGN_TIMESTAMP_URL
    }
    else {
        'http://timestamp.digicert.com'
    }

    $arguments = @(
        'sign',
        '/fd', 'SHA256',
        '/td', 'SHA256',
        '/tr', $timestampUrl
    )

    if ($env:WINDOWS_SIGN_CERT_THUMBPRINT) {
        $arguments += @('/sha1', $env:WINDOWS_SIGN_CERT_THUMBPRINT)
        if ($env:WINDOWS_SIGN_CERT_STORE) {
            $arguments += @('/s', $env:WINDOWS_SIGN_CERT_STORE)
        }
        if ($env:WINDOWS_SIGN_CERT_MACHINE_STORE -eq '1') {
            $arguments += '/sm'
        }
    }
    elseif ($env:WINDOWS_SIGN_CERT_SUBJECT_NAME) {
        $arguments += @('/a', '/n', $env:WINDOWS_SIGN_CERT_SUBJECT_NAME)
        if ($env:WINDOWS_SIGN_CERT_STORE) {
            $arguments += @('/s', $env:WINDOWS_SIGN_CERT_STORE)
        }
        if ($env:WINDOWS_SIGN_CERT_MACHINE_STORE -eq '1') {
            $arguments += '/sm'
        }
    }
    elseif ($env:WINDOWS_SIGN_PFX_PATH) {
        $arguments += @('/f', $env:WINDOWS_SIGN_PFX_PATH)
        if (-not $env:WINDOWS_SIGN_PFX_PASSWORD) {
            throw 'WINDOWS_SIGN_PFX_PASSWORD is required when WINDOWS_SIGN_PFX_PATH is set.'
        }
        $arguments += @('/p', $env:WINDOWS_SIGN_PFX_PASSWORD)
    }
    else {
        throw 'No signing identity configured. Set WINDOWS_SIGN_CERT_THUMBPRINT, WINDOWS_SIGN_CERT_SUBJECT_NAME, or WINDOWS_SIGN_PFX_PATH.'
    }

    if ($env:WINDOWS_SIGN_EXTRA_ARGS) {
        $arguments += $env:WINDOWS_SIGN_EXTRA_ARGS -split '\s+'
    }

    $arguments += $ArtifactPath
    return $arguments
}

$resolvedFilePath = (Resolve-Path -LiteralPath $FilePath).Path
$signToolPath = Resolve-SignToolPath
$signToolArguments = Get-SignToolArguments -ArtifactPath $resolvedFilePath

Write-Host "Signing $resolvedFilePath"
& $signToolPath @signToolArguments
if ($LASTEXITCODE -ne 0) {
    throw "signtool.exe failed for $resolvedFilePath with exit code $LASTEXITCODE."
}
