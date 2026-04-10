from dotenv import load_dotenv
import os
import requests

load_dotenv()
es_url = os.getenv("ELASTICSEARCH_URL")
try:
    r = requests.get(es_url, timeout=10)
    print("ES connection OK. Status:", r.status_code)
    r2 = requests.get(f"{es_url}/threats/_count", timeout=10)
    print("ES Threats count:", r2.json())
except Exception as e:
    print("ES Connection Error:", e)
