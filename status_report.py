import json
import os
import subprocess
from datetime import datetime, timezone

import requests
import redis


def http_ok(url: str, timeout: int = 5):
    try:
        resp = requests.get(url, timeout=timeout)
        return True, resp.status_code
    except Exception:
        return False, None


def get_es_counts(es_base: str):
    report = {"total": 0, "severity": {}, "attack_type": {}}
    try:
        total = requests.get(f"{es_base}/threats/_count", timeout=8).json().get("count", 0)
        report["total"] = total

        sev_aggs = {
            "size": 0,
            "aggs": {"severity": {"terms": {"field": "severity.keyword", "size": 10}}},
        }
        sev_res = requests.get(f"{es_base}/threats/_search", json=sev_aggs, timeout=8).json()
        for b in sev_res.get("aggregations", {}).get("severity", {}).get("buckets", []):
            report["severity"][b.get("key", "unknown")] = b.get("doc_count", 0)

        atk_aggs = {
            "size": 0,
            "aggs": {"attack_type": {"terms": {"field": "attack_type.keyword", "size": 10}}},
        }
        atk_res = requests.get(f"{es_base}/threats/_search", json=atk_aggs, timeout=8).json()
        for b in atk_res.get("aggregations", {}).get("attack_type", {}).get("buckets", []):
            report["attack_type"][b.get("key", "unknown")] = b.get("doc_count", 0)
    except Exception:
        pass
    return report


def get_redis_queue(redis_url: str):
    try:
        r = redis.from_url(redis_url)
        return r.llen("threat_queue")
    except Exception:
        return None


def get_docker_summary():
    try:
        cmd = ["docker", "ps", "--format", "{{.Names}}|{{.Status}}"]
        out = subprocess.check_output(cmd, text=True).strip()
        rows = [line.split("|", 1) for line in out.splitlines() if "|" in line]
        return [{"name": name, "status": status} for name, status in rows]
    except Exception:
        return []


def main():
    es_base = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    api_url = "http://localhost:8000/search?keyword=attack&limit=3"
    ui_url = "http://localhost:3000"

    ok_es, es_status = http_ok(es_base)
    ok_api, api_status = http_ok(api_url)
    ok_ui, ui_status = http_ok(ui_url)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "health": {
            "elasticsearch": {"ok": ok_es, "status_code": es_status},
            "api_search": {"ok": ok_api, "status_code": api_status},
            "frontend": {"ok": ok_ui, "status_code": ui_status},
        },
        "pipeline": {
            "queue_length": get_redis_queue(redis_url),
            "index_stats": get_es_counts(es_base),
        },
        "runtime": {"containers": get_docker_summary()},
    }

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
