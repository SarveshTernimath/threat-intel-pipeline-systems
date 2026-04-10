import requests, time, redis, json

from dotenv import load_dotenv
import os
import redis

load_dotenv()

redis_client = redis.from_url(
    os.getenv("REDIS_URL"),
    decode_responses=True
)
r = redis_client

URL = "https://feodotracker.abuse.ch/downloads/ipblocklist.json"

while True:
    try:
        data = requests.get(URL).json()
        
        for item in data:
            ip = item.get("ip_address")
            
            if not ip:
                continue

            # Ensure we dont inject duplicates by persisting the tracker state securely
            # A sha256 checksum maps safely into Redis SET checks
            import hashlib
            unique_id = hashlib.sha256(f"FEODO-{ip}".encode()).hexdigest()
            if r.sismember("seen_threats", unique_id):
                continue
            r.sadd("seen_threats", unique_id)
            
            payload = {
                "source": "FEODO",
                "cve_id": f"IP-{ip}",
                "description": f"Malicious IP detected globally tracked: {ip}",
                "published_date": item.get("first_seen"),
                "severity": "high",  # Added organically fulfilling the UI render bounds
                "iocs": {
                    "ips": [ip]
                }
            }
            
            r.rpush("threat_queue", json.dumps(payload))
            print(f"Ingested Threat IP {ip}")
            
    except Exception as e:
        print("IP feed error:", e)

    time.sleep(300)
