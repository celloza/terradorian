param (
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [switch]$SkipBuildWait
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path $MyInvocation.MyCommand.Path
$rootDir = "$scriptDir\.."
Set-Location $rootDir

# 1. Load Config
$configPath = "$scriptDir\deploy.config.json"
if (-not (Test-Path $configPath)) {
    Write-Error "Configuration file not found: $configPath. Please copy deploy.config.sample.json to deploy.config.json and fill it in."
    exit 1
}
$config = Get-Content $configPath | ConvertFrom-Json

# 2. Get Current Version from Git Tags
Write-Host "Fetching latest version from Git tags..." -ForegroundColor Cyan
$latestTag = git tag --sort=-creatordate | Select-Object -First 1

if (-not $latestTag) {
    Write-Warning "No tags found. Defaulting to v0.0.0"
    $latestTag = "v0.0.0"
}

# Strip 'v' prefix if present
$currentVersionStr = $latestTag -replace "^v", ""
$parts = $currentVersionStr.Split('.')
if ($parts.Count -ne 3) {
    Write-Error "Latest tag format is not vX.Y.Z: $latestTag"
    exit 1
}

$newPatch = [int]$parts[2] + 1
$newVersion = "{0}.{1}.{2}" -f $parts[0], $parts[1], $newPatch
$tagName = "v$newVersion"

Write-Host "Bumping version: $latestTag -> $tagName" -ForegroundColor Cyan

# Update package.json to match the new git version
$webPackageJson = "$rootDir\web\package.json"
if (Test-Path $webPackageJson) {
    $pkg = Get-Content $webPackageJson | ConvertFrom-Json
    $pkg.version = $newVersion
    $pkg | ConvertTo-Json -Depth 10 | Set-Content $webPackageJson
}

# 3. Git Commit
$commitMsg = "feat: $Message (v$newVersion)"
Write-Host "Committing: $commitMsg" -ForegroundColor Cyan
git add .
git commit -S -m "$commitMsg"
git push

# 4. Release
Write-Host "Creating GitHub Release: $tagName" -ForegroundColor Cyan
gh release create $tagName --generate-notes

# 5. Wait for Build
if (-not $SkipBuildWait) {
    Write-Host "Waiting for GitHub Action to trigger..." -ForegroundColor Cyan
    Start-Sleep -Seconds 10
    
    # Try to find the run triggered by this tag
    $runId = ""
    $attempts = 0
    while (-not $runId -and $attempts -lt 5) {
        $runId = gh run list --branch $tagName --limit 1 --json databaseId --jq '.[0].databaseId'
        if (-not $runId) {
            Start-Sleep -Seconds 5
            $attempts++
        }
    }

    if ($runId) {
        Write-Host "Watching Run ID: $runId" -ForegroundColor Cyan
        gh run watch $runId --exit-status
    }
    else {
        Write-Warning "Could not find run ID for $tagName. Skipping watch."
    }
}

# 6. Restart App Services
Write-Host "Restarting App Services..." -ForegroundColor Cyan
Write-Host "Restarting Web App: $($config.webAppName)"
az webapp restart --name $config.webAppName --resource-group $config.resourceGroup
Write-Host "Restarting Function App: $($config.functionAppName)"
az webapp restart --name $config.functionAppName --resource-group $config.resourceGroup

Write-Host "Deployment Complete! v$newVersion" -ForegroundColor Green
