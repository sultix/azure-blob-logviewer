[CmdletBinding()]
param(
    [ValidateSet('amd64', 'arm64')]
    [string]$Arch = 'amd64',

    [string]$OutputRoot = 'release/windows',

    [string]$TimestampUrl = 'http://timestamp.digicert.com',

    [string]$WailsCommand = 'wails',

    [string]$MakeNsisPath = 'makensis.exe',

    [string]$SignToolPath,

    [string]$CertificateThumbprint,

    [string]$CertificateSubjectName,

    [string]$CertificateStore = 'My',

    [switch]$UseMachineCertificateStore,

    [string]$PfxPath,

    [string]$PfxPasswordEnv = 'WINDOWS_SIGN_PFX_PASSWORD'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$runningOnWindows = $env:OS -eq 'Windows_NT'
if (-not $runningOnWindows) {
    throw 'scripts/release-windows.ps1 must run on Windows.'
}

function Resolve-CommandPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandName
    )

    if (Test-Path -LiteralPath $CommandName) {
        return (Resolve-Path -LiteralPath $CommandName).Path
    }

    $command = Get-Command $CommandName -ErrorAction Stop
    return $command.Source
}

function Assert-AuthenticodeSignature {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ArtifactPath
    )

    $signature = Get-AuthenticodeSignature -FilePath $ArtifactPath
    if ($signature.Status -ne 'Valid') {
        throw "Authenticode signature is not valid for $ArtifactPath. Status: $($signature.Status)"
    }
}

function New-HashLine {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ArtifactPath
    )

    $hash = Get-FileHash -Path $ArtifactPath -Algorithm SHA256
    return '{0} *{1}' -f $hash.Hash.ToLowerInvariant(), (Split-Path -Leaf $ArtifactPath)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = Join-Path $repoRoot 'wails.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

$productName = [string]$config.info.productName
if ([string]::IsNullOrWhiteSpace($productName)) {
    $productName = [string]$config.name
}

$productVersion = [string]$config.info.productVersion
$companyName = [string]$config.info.companyName

if ([string]::IsNullOrWhiteSpace($productName)) {
    throw 'wails.json must define info.productName or name.'
}
if ([string]::IsNullOrWhiteSpace($productVersion)) {
    throw 'wails.json must define info.productVersion.'
}
if ([string]::IsNullOrWhiteSpace($companyName)) {
    throw 'wails.json must define info.companyName.'
}

$wailsPath = Resolve-CommandPath -CommandName $WailsCommand
$makeNsisResolvedPath = Resolve-CommandPath -CommandName $MakeNsisPath
$signToolResolvedPath = if ($SignToolPath) {
    Resolve-CommandPath -CommandName $SignToolPath
}
else {
    Resolve-CommandPath -CommandName 'signtool.exe'
}

$hasStoreCertificate = -not [string]::IsNullOrWhiteSpace($CertificateThumbprint) -or
    -not [string]::IsNullOrWhiteSpace($CertificateSubjectName)
$hasPfxCertificate = -not [string]::IsNullOrWhiteSpace($PfxPath)

if (-not $hasStoreCertificate -and -not $hasPfxCertificate) {
    throw 'Provide -CertificateThumbprint, -CertificateSubjectName, or -PfxPath for signing.'
}
if ($hasStoreCertificate -and $hasPfxCertificate) {
    throw 'Use either a store certificate or a PFX file, not both.'
}

$env:WINDOWS_SIGN_TOOL_PATH = $signToolResolvedPath
$env:WINDOWS_SIGN_TIMESTAMP_URL = $TimestampUrl
$env:WINDOWS_SIGN_CERT_STORE = $CertificateStore
$env:WINDOWS_SIGN_CERT_MACHINE_STORE = if ($UseMachineCertificateStore) { '1' } else { '0' }
$env:WINDOWS_SIGN_CERT_THUMBPRINT = $CertificateThumbprint
$env:WINDOWS_SIGN_CERT_SUBJECT_NAME = $CertificateSubjectName
$env:WINDOWS_SIGN_PFX_PATH = $PfxPath

if ($hasPfxCertificate) {
    $pfxPassword = [Environment]::GetEnvironmentVariable($PfxPasswordEnv)
    if ([string]::IsNullOrWhiteSpace($pfxPassword)) {
        throw "Environment variable $PfxPasswordEnv must be set before using -PfxPath."
    }
    $env:WINDOWS_SIGN_PFX_PASSWORD = $pfxPassword
}
else {
    $env:WINDOWS_SIGN_PFX_PASSWORD = ''
}

$buildBinDir = Join-Path $repoRoot 'build/bin'
$installerDir = Join-Path $repoRoot 'build/windows/installer'
$nsiProjectPath = Join-Path $installerDir 'project.nsi'
$wailsToolsPath = Join-Path $installerDir 'wails_tools.nsh'
$helperPath = Join-Path $repoRoot 'scripts/sign-windows-artifact.ps1'

if (-not (Test-Path -LiteralPath $nsiProjectPath)) {
    throw "NSIS project file was not found at $nsiProjectPath"
}

$outputDir = Join-Path $repoRoot (Join-Path $OutputRoot $productVersion)
if (Test-Path -LiteralPath $outputDir) {
    Remove-Item -LiteralPath $outputDir -Recurse -Force
}
New-Item -ItemType Directory -Path $outputDir | Out-Null

Push-Location $repoRoot
try {
    if (-not (Test-Path -LiteralPath $wailsToolsPath)) {
        Write-Host 'Bootstrapping NSIS support files with an unsigned Wails installer build.'
        & $wailsPath build -platform "windows/$Arch" -clean -nsis
        if ($LASTEXITCODE -ne 0) {
            throw "wails build -nsis failed with exit code $LASTEXITCODE."
        }
    }

    Write-Host "Building clean Windows binary for $Arch"
    & $wailsPath build -platform "windows/$Arch" -clean
    if ($LASTEXITCODE -ne 0) {
        throw "wails build failed with exit code $LASTEXITCODE."
    }

    $exePath = Join-Path $buildBinDir "$productName.exe"
    if (-not (Test-Path -LiteralPath $exePath)) {
        throw "Expected executable was not found at $exePath"
    }

    & $helperPath -FilePath $exePath
    Assert-AuthenticodeSignature -ArtifactPath $exePath

    $installerPath = Join-Path $buildBinDir "$productName-$Arch-installer.exe"
    if (Test-Path -LiteralPath $installerPath) {
        Remove-Item -LiteralPath $installerPath -Force
    }

    $architectureDefine = if ($Arch -eq 'amd64') {
        'ARG_WAILS_AMD64_BINARY'
    }
    else {
        'ARG_WAILS_ARM64_BINARY'
    }

    Write-Host "Building signed NSIS installer for $Arch"
    Push-Location $installerDir
    try {
        & $makeNsisResolvedPath `
            "/D$architectureDefine=$exePath" `
            '/DWINDOWS_SIGN_ARTIFACTS' `
            "/DWIN_SIGN_HELPER_PATH=$helperPath" `
            'project.nsi'
        if ($LASTEXITCODE -ne 0) {
            throw "makensis failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $installerPath)) {
        throw "Expected installer was not found at $installerPath"
    }

    Assert-AuthenticodeSignature -ArtifactPath $installerPath

    $releaseExePath = Join-Path $outputDir (Split-Path -Leaf $exePath)
    $releaseInstallerPath = Join-Path $outputDir (Split-Path -Leaf $installerPath)
    Copy-Item -LiteralPath $exePath -Destination $releaseExePath
    Copy-Item -LiteralPath $installerPath -Destination $releaseInstallerPath

    $checksumsPath = Join-Path $outputDir 'SHA256SUMS.txt'
    @(
        New-HashLine -ArtifactPath $releaseExePath
        New-HashLine -ArtifactPath $releaseInstallerPath
    ) | Set-Content -LiteralPath $checksumsPath
}
finally {
    Pop-Location
}

Write-Warning 'NSIS finalizers sign the embedded uninstall.exe during packaging, but the uninstaller signature can only be verified after a test installation.'
Write-Host "Release artifacts are available in $outputDir"
