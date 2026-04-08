$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $repoRoot ".runtime"
$pidFile = Join-Path $runtimeDir "pids.json"

if (Test-Path $pidFile) {
    try {
        $state = Get-Content $pidFile -Raw | ConvertFrom-Json
        foreach ($svc in $state.services) {
            if ($svc.pid) {
                Write-Host "Stopping $($svc.name) (PID $($svc.pid))..."
                Stop-Process -Id $svc.pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {
        Write-Host "Unable to parse $pidFile. Attempting best-effort shutdown."
    }
} else {
    Write-Host "No PID file found at $pidFile"
}

Push-Location (Join-Path $repoRoot "docker")
docker compose stop redis elasticsearch | Out-Host
Pop-Location

Write-Host "Local stack stop completed."
