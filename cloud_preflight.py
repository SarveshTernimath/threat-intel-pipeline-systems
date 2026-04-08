import os
from urllib.parse import urlparse

import requests


def check_redis_url(url: str):
    if not url:
        return False, "REDIS_URL missing"
    if url.startswith("redis-cli "):
        return False, "REDIS_URL must be URL only, not a redis-cli command"
    parsed = urlparse(url)
    if parsed.scheme not in ("rediss", "redis"):
        return False, "REDIS_URL must start with rediss:// (recommended) or redis://"
    if parsed.scheme != "rediss":
        return False, "Use rediss:// for Upstash TLS connections"
    if not parsed.hostname:
        return False, "REDIS_URL hostname missing"
    return True, "ok"


def check_es_url(url: str):
    if not url:
        return False, "ELASTICSEARCH_URL missing"
    parsed = urlparse(url)
    if parsed.scheme != "https":
        return False, "ELASTICSEARCH_URL must use https:// for Elastic Cloud"
    if not parsed.hostname:
        return False, "ELASTICSEARCH_URL hostname missing"
    return True, "ok"


def check_http(url: str):
    try:
        r = requests.get(url, timeout=8)
        return r.status_code in (200, 401, 403), r.status_code
    except Exception as e:
        return False, str(e)


def main():
    redis_url = os.getenv("REDIS_URL", "")
    es_url = os.getenv("ELASTICSEARCH_URL", "")
    api_url = os.getenv("API_BASE_URL", "http://localhost:8000")

    checks = []
    ok, msg = check_redis_url(redis_url)
    checks.append(("REDIS_URL", ok, msg))

    ok2, msg2 = check_es_url(es_url)
    checks.append(("ELASTICSEARCH_URL", ok2, msg2))

    if ok2:
        ok3, info = check_http(es_url.rstrip("/"))
        checks.append(("ELASTICSEARCH_HTTP", ok3, f"status/info={info}"))

    ok4, info4 = check_http(f"{api_url.rstrip('/')}/search?keyword=attack&limit=1")
    checks.append(("API_SEARCH", ok4, f"status/info={info4}"))

    all_ok = True
    for name, good, detail in checks:
        status = "PASS" if good else "FAIL"
        print(f"[{status}] {name}: {detail}")
        all_ok = all_ok and good

    if all_ok:
        print("Cloud preflight PASS")
    else:
        print("Cloud preflight FAIL")


if __name__ == "__main__":
    main()
