$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $repoRoot ".runtime"
$logsDir = Join-Path $repoRoot "runtime-logs"
$pidFile = Join-Path $runtimeDir "pids.json"

New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

Write-Host "[1/4] Starting Redis + Elasticsearch containers..."
Push-Location (Join-Path $repoRoot "docker")
docker compose up -d redis elasticsearch | Out-Host
Pop-Location

function Start-ManagedProcess {
    param(
        [string]$Name,
        [string]$WorkingDir,
        [string]$Command
    )

    $outFile = Join-Path $logsDir "$Name.out.log"
    $errFile = Join-Path $logsDir "$Name.err.log"
    $proc = Start-Process -FilePath "powershell" `
        -ArgumentList "-NoProfile", "-Command", "Set-Location '$WorkingDir'; $Command" `
        -RedirectStandardOutput $outFile `
        -RedirectStandardError $errFile `
        -PassThru

    return @{
        name = $Name
        pid = $proc.Id
        cwd = $WorkingDir
        stdout = $outFile
        stderr = $errFile
    }
}

Write-Host "[2/4] Starting FastAPI on :8000..."
$api = Start-ManagedProcess -Name "api" `
    -WorkingDir (Join-Path $repoRoot "api") `
    -Command "python -m uvicorn server:app --host 127.0.0.1 --port 8000"

Write-Host "[3/4] Starting worker..."
$worker = Start-ManagedProcess -Name "worker" `
    -WorkingDir (Join-Path $repoRoot "workers") `
    -Command "go run worker.go"

Write-Host "[4/4] Starting dashboard on :3000..."
$frontend = Start-ManagedProcess -Name "frontend" `
    -WorkingDir (Join-Path $repoRoot "dashboard_ts") `
    -Command "npm run dev"

$payload = @{
    started_at = (Get-Date).ToString("o")
    services = @($api, $worker, $frontend)
}
$payload | ConvertTo-Json -Depth 5 | Set-Content -Path $pidFile -Encoding UTF8

Write-Host ""
Write-Host "Local stack started."
Write-Host "PIDs saved to: $pidFile"
Write-Host "Logs folder: $logsDir"
Write-Host "Run verify: python health_check.py"
