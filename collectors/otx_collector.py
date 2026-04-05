import os
import requests
import json
import redis
from datetime import datetime, timezone

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize Redis connection from REDIS_URL env var (Upstash) or fallback to local
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url)

def fetch_otx_pulses():
    """
    Fetches real-time threat intel pulses from the AlienVault OTX Activity API
    and normalizes them into the pipeline's exact CVE JSON schema.
    """
    url = "https://otx.alienvault.com/api/v1/pulses/activity"
    headers = {"User-Agent": "Threat-Intel-Pipeline-Collector"}
    otx_api_key = (os.getenv("OTX_API_KEY") or "").strip()
    if otx_api_key:
        headers["X-OTX-API-KEY"] = otx_api_key

    max_retries = 2  # retries after first attempt (up to 3 tries per page)

    for page in range(1, 4):  # Loop max 3 pages
        params = {"limit": 50, "page": page}
        response = None
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = requests.get(url, params=params, headers=headers)
                response.raise_for_status()
                break
            except requests.exceptions.RequestException as e:
                last_error = e
                if attempt < max_retries:
                    continue
                print(
                    f"AlienVault OTX API failed on page {page} after "
                    f"{max_retries + 1} attempt(s): {last_error}"
                )

        if response is None:
            continue

        try:
            data = response.json()
        except ValueError as e:
            print(f"AlienVault OTX API invalid JSON on page {page}: {e}")
            continue

        pulses = data.get("results", [])
        if not pulses:
            break

        for pulse in pulses:
            # Map native OTX pulse IDs into identical generic structured ID namespaces
            cve_id = f"OTX-{pulse.get('id', 'Unknown')}"

            description = pulse.get("description", "")
            if not description:
                description = pulse.get("name", "No description available")

            published_date_full = pulse.get("created", "")
            published_date = published_date_full.split("T")[0] if "T" in published_date_full else published_date_full

            tags = pulse.get("tags", [])
            keywords = tags if tags else ["threat"]

            lower_kws = [str(k).lower() for k in keywords]
            severity = "low"
            if "ransomware" in lower_kws:
                severity = "critical"
            elif "rce" in lower_kws:
                severity = "critical"
            elif "malware" in lower_kws:
                severity = "medium"

            # Format payload identically to NVD to prevent worker breakdown
            normalized_cve = {
                "source": "OTX",
                "cve_id": cve_id,
                "description": description,
                "published_date": published_date,
                "keywords": keywords,
                "severity": severity,
                "is_recent": True # Current activity implicitly flagged as recent feed flow
            }

            cve_json = json.dumps(normalized_cve)

            try:
                redis_client.rpush('threat_queue', cve_json)
                print(f"Pushed {cve_id} safely to Redis threat_queue")
            except redis.RedisError as re:
                print(f"Redis pipeline error: {re}")

        if not data.get("next"):
            break

if __name__ == "__main__":
    fetch_otx_pulses()
