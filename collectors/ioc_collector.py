import json
import time
import requests
import redis

from dotenv import load_dotenv
import os
import redis

load_dotenv()

redis_client = redis.from_url(
    os.getenv("REDIS_URL"),
    decode_responses=True
)
r = redis_client

URL = "https://urlhaus.abuse.ch/downloads/json_recent/"


def fetch_and_push():
    data = requests.get(URL, timeout=20).json()

    # URLHaus formats can vary; handle both list and {"urls":[...]} safely.
    items = data if isinstance(data, list) else data.get("urls", [])

    for item in items:
        cve_id_val = str(item.get("id", "URLHAUS-UNKNOWN"))
        payload = {
            "source": "URLHAUS",
            "cve_id": cve_id_val,
            "description": item.get("url", ""),
            "published_date": item.get("date_added", ""),
            "hashes": {
                "md5": item.get("md5_hash"),
                "sha256": item.get("sha256_hash"),
            },
            "ioc_ip": item.get("url_info_from_api", {}).get("host"),
        }
        
        unique_id = cve_id_val
        if r.sismember("seen_threats", unique_id):
            continue
        r.sadd("seen_threats", unique_id)
        
        r.rpush("threat_queue", json.dumps(payload))


if __name__ == "__main__":
    while True:
        try:
            fetch_and_push()
        except Exception as e:
            print("IOC collector error:", e)
        time.sleep(300)
