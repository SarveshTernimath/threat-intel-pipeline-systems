import json
import os
from datetime import datetime, timezone

import requests
import redis


def ok_http(url: str, timeout: int = 6):
    try:
        r = requests.get(url, timeout=timeout)
        return r.status_code >= 200 and r.status_code < 300
    except Exception:
        return False


def get_json(url: str, timeout: int = 8):
    try:
        return requests.get(url, timeout=timeout).json()
    except Exception:
        return {}


def main():
    es_base = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    api_search = "http://localhost:8000/search?keyword=attack&limit=5"
    frontend = "http://localhost:3000"

    checks = {}

    checks["infra_es"] = ok_http(es_base)
    checks["api_search"] = ok_http(api_search)
    checks["frontend"] = ok_http(frontend)

    try:
        r = redis.from_url(redis_url)
        queue_len = r.llen("threat_queue")
        checks["redis"] = True
    except Exception:
        queue_len = None
        checks["redis"] = False

    count_data = get_json(f"{es_base}/threats/_count")
    doc_count = int(count_data.get("count", 0) or 0)
    checks["es_has_docs"] = doc_count > 0

    search_data = get_json(api_search)
    if isinstance(search_data, list):
        search_count = len(search_data)
    elif isinstance(search_data, dict) and "value" in search_data and isinstance(search_data["value"], list):
        search_count = len(search_data["value"])
    else:
        search_count = 0
    checks["api_returns_data"] = search_count > 0

    # JD-oriented sections (practical pass/fail)
    jd = {
        "data_ingestion_layer": checks["redis"] and checks["es_has_docs"],
        "processing_enrichment": checks["es_has_docs"],
        "queue_worker_system": checks["redis"] and queue_len is not None,
        "storage_search": checks["infra_es"] and checks["api_search"] and checks["api_returns_data"],
        "backend_api": checks["api_search"],
        "frontend_dashboard": checks["frontend"],
        "real_time_feel": checks["frontend"] and checks["api_search"],
    }

    passed = sum(1 for v in jd.values() if v)
    total = len(jd)
    readiness_pct = round((passed / total) * 100, 1) if total else 0.0

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "service_checks": checks,
        "metrics": {
            "redis_queue_length": queue_len,
            "threats_doc_count": doc_count,
            "search_result_count_sample": search_count,
        },
        "jd_readiness": {
            "score_percent": readiness_pct,
            "passed": passed,
            "total": total,
            "sections": jd,
        },
        "remaining_real_world_gaps": [
            "Add process supervision and auto-restart for API/worker in production",
            "Add alerting/monitoring for queue growth and API 5xx",
            "Improve enrichment consistency to reduce 'unknown' attack_type/severity",
            "Add trend analytics over time for stronger intelligence layer",
        ],
    }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
