[CmdletBinding()]
param(
    [switch]$SkipEdge,
    [switch]$SkipDesktop,
    [switch]$OpenBrowser,
    [switch]$DemoMode,
    [int]$ApiPort = 8000,
    [int]$WebPort = 3000,
    [string]$EdgeCameraSource = $env:CAMERA_SOURCE,
    [string]$EdgeCameraId = $env:CAMERA_ID
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WebRoot = Join-Path $ProjectRoot "apps\web"
$DesktopRoot = Join-Path $ProjectRoot "apps\desktop"
$PythonCommand = $env:FLAMEEYE_PYTHON
if ([string]::IsNullOrWhiteSpace($PythonCommand)) {
    $PythonCommand = "python"
}
if ([string]::IsNullOrWhiteSpace($EdgeCameraSource)) {
    $EdgeCameraSource = "0"
}
$ApiUrl = "http://127.0.0.1:$ApiPort"
$WebUrl = "http://127.0.0.1:$WebPort"
$env:API_BASE_URL = $ApiUrl
$env:FLAMEEYE_API_URL = $ApiUrl
$env:FLAMEEYE_WEB_URL = "$WebUrl/platform"
$env:NEXT_PUBLIC_API_URL = $ApiUrl
if ($DemoMode) {
    $env:DEMO_MODE = "true"
}

$ownedProcesses = @()

function Assert-Command {
    param(
        [string]$CommandName,
        [string]$InstallHint
    )

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "$CommandName was not found on PATH. $InstallHint"
    }
}

function Test-HttpEndpoint {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Wait-ForEndpoint {
    param(
        [string]$Url,
        [string]$ServiceName,
        [int]$Attempts = 30
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        if (Test-HttpEndpoint $Url) {
            Write-Host "$ServiceName is ready: $Url" -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 1
    }
    throw "$ServiceName did not become ready at $Url. Check its terminal window for the error."
}

function Start-AppWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $windowCommand = "`$Host.UI.RawUI.WindowTitle = '$Title'; $Command"
    $process = Start-Process `
        -FilePath "powershell.exe" `
        -WorkingDirectory $WorkingDirectory `
        -ArgumentList @("-NoProfile", "-NoLogo", "-NoExit", "-Command", $windowCommand) `
        -PassThru
    $script:ownedProcesses += $process
    return $process
}

function Stop-ProcessTree {
    param(
        [int]$ProcessId
    )

    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue)
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-OwnedProcesses {
    foreach ($process in @($ownedProcesses)) {
        if ($null -ne $process -and -not $process.HasExited) {
            Stop-ProcessTree -ProcessId $process.Id
        }
    }
}

try {
    Write-Host "FlameEye self-test launcher" -ForegroundColor Cyan
    Write-Host "Project: $ProjectRoot"

    Assert-Command -CommandName $PythonCommand -InstallHint "Set FLAMEEYE_PYTHON to your Python executable."
    Assert-Command -CommandName "npm.cmd" -InstallHint "Install Node.js, then restart PowerShell."

    if (-not (Test-Path (Join-Path $WebRoot "package.json"))) {
        throw "Frontend package was not found at $WebRoot."
    }
    if (-not (Test-Path (Join-Path $DesktopRoot "package.json"))) {
        throw "Desktop package was not found at $DesktopRoot."
    }

    if (Test-HttpEndpoint "$ApiUrl/api/health") {
        Write-Host "API already running: $ApiUrl" -ForegroundColor Yellow
    } else {
        Start-AppWindow `
            -Title "FlameEye API" `
            -WorkingDirectory $ProjectRoot `
            -Command "& '$PythonCommand' -m uvicorn apps.api.main:app --host 127.0.0.1 --port $ApiPort"
        Wait-ForEndpoint -Url "$ApiUrl/api/health" -ServiceName "API"
    }

    if (Test-HttpEndpoint $WebUrl) {
        Write-Host "Web app already running: $WebUrl" -ForegroundColor Yellow
    } else {
        Start-AppWindow `
            -Title "FlameEye Web" `
            -WorkingDirectory $WebRoot `
            -Command "npm.cmd run dev -- --hostname 127.0.0.1 --port $WebPort"
        Wait-ForEndpoint -Url $WebUrl -ServiceName "Web app"
    }

    if ($SkipEdge) {
        Write-Host "Edge agent skipped. Use -EdgeCameraSource and run without -SkipEdge for live inference." -ForegroundColor DarkYellow
    } else {
        $demoValue = if ($DemoMode) { "true" } else { $env:DEMO_MODE }
        $envCommand = "`$env:CAMERA_SOURCE = '$EdgeCameraSource'; `$env:CAMERA_ID = '$EdgeCameraId'; `$env:API_BASE_URL = '$ApiUrl'; `$env:DEMO_MODE = '$demoValue'"
        Start-AppWindow `
            -Title "FlameEye Edge Agent" `
            -WorkingDirectory $ProjectRoot `
            -Command "$envCommand; & '$PythonCommand' -m apps.edge_agent.main"
        Write-Host "Edge agent started with source: $EdgeCameraSource" -ForegroundColor Green
    }

    if ($SkipDesktop) {
        Write-Host "Desktop shell skipped. Use the web app for self-testing." -ForegroundColor DarkYellow
    } else {
        $desktopCommand = "`$env:FLAMEEYE_MANAGED_RUNTIME = 'false'; `$env:FLAMEEYE_START_EDGE = 'false'; npm.cmd run dev"
        Start-AppWindow `
            -Title "FlameEye Desktop" `
            -WorkingDirectory $DesktopRoot `
            -Command $desktopCommand
        Write-Host "Desktop shell started." -ForegroundColor Green
    }

    if ($OpenBrowser) {
        Start-Process "$WebUrl/platform"
    }

    Write-Host ""
    Write-Host "FlameEye is ready for manual testing:" -ForegroundColor Green
    Write-Host "  Platform:  $WebUrl/platform"
    Write-Host "  People:    $WebUrl/analytics"
    Write-Host "  Workspace: $WebUrl/workspace"
    Write-Host "  Incidents: $WebUrl/incidents"
    Write-Host "  API docs:  $ApiUrl/docs"
    Write-Host ""
    Write-Host "Press Ctrl+C in this window to stop processes started by this launcher." -ForegroundColor DarkGray

    while ($true) {
        Start-Sleep -Seconds 2
        $running = @($ownedProcesses | Where-Object { -not $_.HasExited })
        if ($running.Count -eq 0) {
            throw "All launcher-owned processes exited. Check their terminal windows for errors."
        }
    }
} catch {
    Write-Error $_
    exit 1
} finally {
    Stop-OwnedProcesses
}
