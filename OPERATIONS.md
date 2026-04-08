# Local Operations (Safe Mode)

Use these commands from repo root:

- Start full local stack:
  - `powershell -ExecutionPolicy Bypass -File .\start_local.ps1`
- Verify health:
  - `powershell -ExecutionPolicy Bypass -File .\verify_local.ps1`
- Generate JSON status snapshot:
  - `python status_report.py`
- Stop stack safely:
  - `powershell -ExecutionPolicy Bypass -File .\stop_local.ps1`

## What these scripts manage

- Docker services: Redis + Elasticsearch
- API: FastAPI on `localhost:8000`
- Worker: Go worker from `workers/`
- UI: Next.js dashboard on `localhost:3000`

## Logs and runtime state

- Runtime PID state: `.runtime/pids.json`
- Service logs: `runtime-logs/`

## Expected healthy state

- `http://localhost:9200` responds
- `http://localhost:8000/search?keyword=attack` responds
- `http://localhost:3000` responds
- Redis queue `threat_queue` should usually drain back to `0`
