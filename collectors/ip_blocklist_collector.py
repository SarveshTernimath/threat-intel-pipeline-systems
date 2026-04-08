import requests
import time
import redis
import json
import re
from datetime import datetime

r = redis.Redis(host='localhost', port=6379, db=0)

URLS = [
    "https://feodotracker.abuse.ch/downloads/ipblocklist.csv",
    "https://www.spamhaus.org/drop/drop.txt"
]

IP_REGEX = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')

while True:
    try:
        for url in URLS:
            try:
                response = requests.get(url, timeout=15)
                response.raise_for_status()
                
                # Extract genuine IP addresses strictly using regex (bypasses CSV/TXT formatting complexities)
                ips = IP_REGEX.findall(response.text)
                
                # Limit per cycle to prevent queue flood, but ensure enough volume to keep the map active
                for ip in ips[:100]:
                    if r.sismember("seen_ips", ip):
                        continue
                    
                    r.sadd("seen_ips", ip)
                    
                    payload = {
                        "source": "IP_FEED",
                        "cve_id": f"IP-{ip}",
                        "description": f"Known malicious IP tracked from {url}",
                        "published_date": datetime.utcnow().strftime("%Y-%m-%d"),
                        "severity": "critical", # Force critical to ensure maximum UI visibility (red arcs)
                        "iocs": {
                            "ips": [ip]
                        }
                    }
                    
                    r.rpush("threat_queue", json.dumps(payload))
                    print(f"Pushed extracted IP threat to queue: {ip}")
            except Exception as req_err:
                print(f"Error fetching blocklist {url}: {req_err}")
                
    except Exception as e:
        print("General IP feed loop error:", e)

    time.sleep(300)
