import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = "https://threat-intel-pipeline-systems-backend.onrender.com/search?limit=1000"

try:
    res = requests.get(API_URL)
    data = res.json()
    print(f"Total results from API: {len(data)}")
    sources = {}
    for item in data:
        s = item.get('source', 'unknown')
        sources[s] = sources.get(s, 0) + 1
    print(f"Sources distribution: {sources}")
    
    if data:
        print("\nFirst 5 items:")
        for item in data[:5]:
            print(f"- {item.get('cve_id')} | {item.get('severity')} | {item.get('source')}")
except Exception as e:
    print(f"Error: {e}")
