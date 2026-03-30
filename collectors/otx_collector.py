import os
import requests
import json
import redis
from datetime import datetime, timezone

# Initialize Redis connection from REDIS_URL env var (Upstash) or fallback to local
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.from_url(redis_url)

def fetch_otx_pulses():
    """
    Fetches real-time threat intel pulses from the AlienVault OTX Activity API
    and normalizes them into the pipeline's exact CVE JSON schema.
    """
    url = "https://otx.alienvault.com/api/v1/pulses/activity"
    params = {"limit": 10}
    headers = {"User-Agent": "Threat-Intel-Pipeline-Collector"}
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        pulses = data.get("results", [])
        
        for pulse in pulses:
            # Map native OTX pulse IDs into identical generic structured ID namespaces
            cve_id = f"OTX-{pulse.get('id', 'Unknown')}"
            
            description = pulse.get("description", "")
            if not description:
                description = pulse.get("name", "No description available")
                
            published_date_full = pulse.get("created", "")
            published_date = published_date_full.split("T")[0] if "T" in published_date_full else published_date_full
            
            # Format payload identically to NVD to prevent worker breakdown
            normalized_cve = {
                "source": "OTX",
                "cve_id": cve_id,
                "description": description,
                "published_date": published_date,
                "is_recent": True # Current activity implicitly flagged as recent feed flow
            }
            
            cve_json = json.dumps(normalized_cve)
            
            try:
                redis_client.rpush('threat_queue', cve_json)
                print(f"Pushed {cve_id} safely to Redis threat_queue")
            except redis.RedisError as re:
                print(f"Redis pipeline error: {re}")
                
    except requests.exceptions.RequestException as e:
        print(f"Critically failed fetching data from AlienVault OTX API: {e}")

if __name__ == "__main__":
    fetch_otx_pulses()
