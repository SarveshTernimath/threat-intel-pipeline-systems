import requests
import os
import redis
from dotenv import load_dotenv

load_dotenv()

RAW_ES_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
parsed_url = __import__("urllib.parse").parse.urlparse(RAW_ES_URL)

kwargs = {}
if parsed_url.username and parsed_url.password:
    kwargs["auth"] = (parsed_url.username, parsed_url.password)

try:
    # Check index count
    count_res = requests.get(f"{RAW_ES_URL}/threats/_count", **kwargs)
    print(f"Elasticsearch /threats total document count: {count_res.json().get('count')}")
    
    # Check Redis queue length
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    r = redis.from_url(redis_url)
    q_len = r.llen("threat_queue")
    print(f"Redis 'threat_queue' length: {q_len}")

except Exception as e:
    print(f"Error checking health: {e}")
