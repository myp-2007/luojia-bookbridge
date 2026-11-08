param([switch]$Setup, [switch]$SampleBooks, [ValidateRange(1, 65535)][int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $repoRoot 'apps/api'
$webDir = Join-Path $repoRoot 'apps/web'
$pythonExe = Join-Path $apiDir '.venv/Scripts/python.exe'
$running = $null
try { $running = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/v1/health" -TimeoutSec 5 } catch {}
if ($running -and $running.service -eq 'luojia-bookbridge-api') {
    if ($running.version -eq '0.3.0') {
        Write-Host "BookBridge is already running: http://localhost:$Port"
        Write-Host 'Use the existing server window. To restart, stop it with Ctrl+C first.'
        return
    }
    throw 'An earlier BookBridge server is still running. Stop its window with Ctrl+C before starting this version.'
}
if (-not (Test-Path -LiteralPath $pythonExe) -or -not (Test-Path -LiteralPath (Join-Path $webDir 'node_modules'))) { $Setup = $true }
if ($Setup) {
    if (-not (Test-Path -LiteralPath $pythonExe)) {
        & python -m venv (Join-Path $apiDir '.venv')
        if ($LASTEXITCODE -ne 0) { throw 'Python venv creation failed' }
    }
    & $pythonExe -m pip install -r (Join-Path $apiDir 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
    Push-Location $webDir
    try {
        & npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
    } finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run ./infra/start-local.ps1 -Setup first' }
Push-Location $webDir
try {
    $env:VITE_USE_API = 'true'
    $env:VITE_API_BASE_URL = '/api/v1'
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
$env:ENVIRONMENT = 'development'
$env:ALLOW_DEV_AUTH = 'false'
$env:ALLOW_LEGACY_HEADERS = 'false'
$demoDatabase = Join-Path $apiDir 'demo_bookbridge.db'
$env:DATABASE_URL = 'sqlite:///' + $demoDatabase.Replace('\', '/')
$env:STORAGE_DIR = Join-Path $apiDir 'storage/demo-uploads'
Push-Location $apiDir
try {
    if (Test-Path -LiteralPath $demoDatabase) {
        & $pythonExe -m app.demo_backup
        if ($LASTEXITCODE -ne 0) { throw 'Backup failed, upgrade stopped' }
    }
    & $pythonExe -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
    & $pythonExe -m app.local_seed
    if ($LASTEXITCODE -ne 0) { throw 'Local setup failed' }
    if ($SampleBooks) {
        & $pythonExe -m app.demo_seed
        if ($LASTEXITCODE -ne 0) { throw 'Sample books import failed' }
    }
    Write-Host "BookBridge ready at http://localhost:$Port"
    $lanAddresses = @()
    if (Get-Command Get-NetIPAddress -ErrorAction SilentlyContinue) {
        $lanAddresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
            Select-Object -ExpandProperty IPAddress -Unique)
    }
    if ($lanAddresses.Count -gt 0) {
        Write-Host 'LAN address candidates (choose the adapter on the same network as the other devices):'
        foreach ($lanAddress in $lanAddresses) {
            Write-Host ("  http://{0}:{1}" -f $lanAddress, $Port)
        }
    } else {
        Write-Host 'No LAN IPv4 address detected. Check Wi-Fi or Ethernet, then retry.'
    }
    Write-Host 'Register your own account in the browser. Ctrl+C stops the server.'
    & $pythonExe -m uvicorn app.main:app --host 0.0.0.0 --port $Port
    if ($LASTEXITCODE -ne 0) { throw 'Server stopped with an error. Check the port and the preceding message.' }
} finally { Pop-Location }
