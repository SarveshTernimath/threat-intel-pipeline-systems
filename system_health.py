import requests
import sys

OK = "\033[92m OK \033[0m"
FAIL = "\033[91mFAIL\033[0m"

print("\n===== THREAT INTEL PIPELINE — SYSTEM HEALTH CHECK =====\n")
all_ok = True

# 1. Elasticsearch
try:
    r = requests.get("http://localhost:9200/_cluster/health", timeout=5)
    h = r.json()
    status = h.get("status", "unknown").upper()
    shards = h.get("active_shards", 0)
    unassigned = h.get("unassigned_shards", 0)
    tag = OK if status in ("GREEN", "YELLOW") else FAIL
    if status not in ("GREEN", "YELLOW"):
        all_ok = False
    print(f"[{tag}] Elasticsearch      status={status}  active_shards={shards}  unassigned={unassigned}")
except Exception as e:
    all_ok = False
    print(f"[{FAIL}] Elasticsearch      UNREACHABLE: {e}")

# 2. Threats index document count
try:
    r = requests.get("http://localhost:9200/threats/_count", timeout=5)
    count = r.json().get("count", 0)
    tag = OK if count > 0 else FAIL
    if count == 0:
        all_ok = False
    print(f"[{tag}] Threats index       {count} documents indexed")
except Exception as e:
    all_ok = False
    print(f"[{FAIL}] Threats index       ERROR: {e}")

# 3. FastAPI /search
try:
    r = requests.get("http://localhost:8000/search?keyword=attack&limit=5", timeout=6)
    hits = len(r.json()) if r.ok else 0
    tag = OK if r.ok else FAIL
    if not r.ok:
        all_ok = False
    print(f"[{tag}] FastAPI /search      HTTP {r.status_code}  returned {hits} results")
except Exception as e:
    all_ok = False
    print(f"[{FAIL}] FastAPI /search      UNREACHABLE: {e}")

# 4. FastAPI /semantic-search
try:
    r = requests.get("http://localhost:8000/semantic-search?query=ransomware&limit=3", timeout=10)
    tag = OK if r.ok else FAIL
    if not r.ok:
        all_ok = False
    print(f"[{tag}] FastAPI /semantic    HTTP {r.status_code}  returned {len(r.json())} results")
except Exception as e:
    all_ok = False
    print(f"[{FAIL}] FastAPI /semantic    UNREACHABLE: {e}")

# 5. Next.js dashboard
try:
    r = requests.get("http://localhost:3000", timeout=10)
    tag = OK if r.status_code == 200 else FAIL
    if r.status_code != 200:
        all_ok = False
    print(f"[{tag}] Next.js dashboard    HTTP {r.status_code}")
except Exception as e:
    all_ok = False
    print(f"[{FAIL}] Next.js dashboard    UNREACHABLE: {e}")

# 6. Redis
try:
    import redis as red
    rc = red.from_url("redis://localhost:6379")
    pong = rc.ping()
    qlen = rc.llen("threat_queue")
    seen = rc.scard("seen_threats")
    tag = OK if pong else FAIL
    if not pong:
        all_ok = False
    print(f"[{tag}] Redis               PONG={pong}  threat_queue={qlen}  seen_threats={seen}")
except Exception as e:
    all_ok = False
    print(f"[{FAIL}] Redis               UNREACHABLE: {e}")

print()
if all_ok:
    print("===== ALL SYSTEMS NOMINAL — PIPELINE STABLE =====\n")
else:
    print("===== WARNING: ONE OR MORE SYSTEMS DEGRADED =====\n")

sys.exit(0 if all_ok else 1)
