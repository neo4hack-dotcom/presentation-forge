# Presentation Forge — Windows PowerShell launcher
# One process, one port. FastAPI serves the API AND the built React frontend on :8765.
# Usage: .\start.ps1
# Requires: Python 3.10+, Node.js 18+, (optional) Ollama
[CmdletBinding()] param(
    [int]$Port = 8765,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Log  { param($m) Write-Host "  ▸ $m" -ForegroundColor Green }
function Warn { param($m) Write-Host "  ! $m" -ForegroundColor Yellow }
function Err  { param($m) Write-Host "  ✗ $m" -ForegroundColor Red; exit 1 }
function Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║   Presentation Forge  ·  local   ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}
Banner

# ---- Python: try py launcher first (ships with Python on Windows), then python, then python3
$Python = $null
foreach ($cmd in @("py", "python", "python3")) {
    try {
        $v = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0 -and ($v -match "3\.(1[0-9]|[2-9]\d)")) {
            $Python = $cmd
            Log "Python: $v  ($cmd)"
            break
        }
    } catch {}
}
if (-not $Python) { Err "Python 3.10+ not found. Install from https://www.python.org/downloads/" }

# ---- Node + npm
try {
    $nv = node --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
    Log "Node: $nv"
} catch { Err "Node.js not found. Install from https://nodejs.org/" }
try {
    $npmv = npm --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw }
    Log "npm: $npmv"
} catch { Err "npm not found (should ship with Node.js)." }

# ---- Ollama (optional)
$OllamaExe = $null
foreach ($p in @("ollama", "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe")) {
    try {
        $v = & $p version 2>&1
        if ($LASTEXITCODE -eq 0) { $OllamaExe = $p; break }
    } catch {}
}
if (-not $OllamaExe) {
    Warn "Ollama not found — install from https://ollama.com OR configure an OpenAI-compatible"
    Warn "endpoint in Settings after the app starts."
} else {
    Log "Ollama found: $OllamaExe"
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Log "Ollama daemon already running"
    } catch {
        Log "Starting Ollama daemon..."
        Start-Process -NoNewWindow -FilePath $OllamaExe -ArgumentList "serve" `
            -RedirectStandardOutput "$env:TEMP\pf-ollama.log" `
            -RedirectStandardError  "$env:TEMP\pf-ollama-err.log"
        Start-Sleep -Seconds 2
    }
}

# ---- Python venv
$VenvDir = Join-Path $Root "backend\.venv"
$VenvPy  = Join-Path $VenvDir "Scripts\python.exe"
$VenvPip = Join-Path $VenvDir "Scripts\pip.exe"

if (-not (Test-Path $VenvDir)) {
    Log "Creating Python virtual environment..."
    & $Python -m venv $VenvDir
}

Log "Installing / updating Python dependencies..."
& $VenvPip install --quiet --upgrade pip 2>&1 | Out-Null
& $VenvPip install --quiet -r (Join-Path $Root "backend\requirements.txt")

# Playwright
try { & $VenvPy -c "import playwright" 2>&1 | Out-Null }
catch { & $VenvPip install --quiet playwright }
$ChromiumCache = Join-Path $env:LOCALAPPDATA "ms-playwright"
if (-not (Test-Path $ChromiumCache)) {
    Log "Installing Playwright Chromium (one-time, ~150 MB)..."
    & $VenvPy -m playwright install chromium
} else {
    Log "Playwright Chromium already installed"
}

# ---- Frontend dependencies + build (single-process: backend serves the bundle)
$NodeModules = Join-Path $Root "frontend\node_modules"
if (-not (Test-Path $NodeModules)) {
    Log "Installing JS dependencies..."
    Push-Location (Join-Path $Root "frontend")
    npm install --silent
    Pop-Location
}

if (-not $SkipBuild) {
    Log "Building frontend (TypeScript -> static bundle)..."
    Push-Location (Join-Path $Root "frontend")
    npm run build
    Pop-Location
} else {
    Log "-SkipBuild set -> skipping frontend build"
}

$IndexHtml = Join-Path $Root "frontend\dist\index.html"
if (-not (Test-Path $IndexHtml)) { Err "frontend\dist\index.html missing -- build failed." }

# ---- Free the port if a stale process is squatting on it
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Warn "Port $Port busy -- stopping owning process(es)"
    $busy | ForEach-Object {
        try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep -Seconds 1
}

# ---- Run: single process serves API + SPA
Write-Host ""
Write-Host "  ┌──────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "  │  Presentation Forge running on               │" -ForegroundColor Cyan
Write-Host ("  │  -> http://localhost:{0,-25}│" -f $Port)        -ForegroundColor Cyan
Write-Host "  │  Ctrl+C to stop.                             │" -ForegroundColor Cyan
Write-Host "  └──────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

& $VenvPy -m uvicorn backend.main:app --host 127.0.0.1 --port $Port
