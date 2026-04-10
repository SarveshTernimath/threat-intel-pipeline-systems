import os
import requests
import json
import redis
from datetime import datetime, timezone
import time

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Initialize Redis connection from REDIS_URL env var (Upstash) or fallback to local
from dotenv import load_dotenv
import os
import redis

load_dotenv()

redis_client = redis.from_url(
    os.getenv("REDIS_URL"),
    decode_responses=True
)

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

    # Fetch more pages to increase pulse coverage
    for page in range(1, 11):  # max 10 pages
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

            # Extract structured indicators if present (IPs, Hashes, Domains)
            indicators = pulse.get("indicators", [])
            extracted_iocs = {"ips": [], "domains": [], "hashes": []}
            
            for ind in indicators:
                ind_type = ind.get("type", "").lower()
                indicator = ind.get("indicator", "")
                if not indicator: continue
                
                if ind_type in ["ipv4", "ipv6"]:
                    extracted_iocs["ips"].append(indicator)
                elif ind_type in ["domain", "hostname"]:
                    extracted_iocs["domains"].append(indicator)
                elif ind_type in ["filehash-md5", "filehash-sha256", "imphash"]:
                    extracted_iocs["hashes"].append(indicator)

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
                "is_recent": True, # Current activity implicitly flagged as recent feed flow,
                "iocs": extracted_iocs
            }

            cve_json = json.dumps(normalized_cve)

            unique_id = cve_id
            if redis_client.sismember("seen_threats", unique_id):
                continue
                
            try:
                redis_client.sadd("seen_threats", unique_id)
                redis_client.rpush('threat_queue', cve_json)
                print(f"Pushed {cve_id} safely with {len(extracted_iocs['ips'])} IPs to Redis")
            except redis.RedisError as re:
                print(f"Redis pipeline error: {re}")

        if not data.get("next"):
            break

if __name__ == "__main__":
    while True:
        fetch_otx_pulses()
        time.sleep(300)  # 5 minutes
