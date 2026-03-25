import requests
import json
import redis
from datetime import datetime, timedelta, timezone

# Initialize Redis connection
redis_client = redis.Redis(host='localhost', port=6379, db=0)

def fetch_nvd_data():
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    
    start_str = start_date.strftime("%Y-%m-%dT%H:%M:%S.000")
    end_str = end_date.strftime("%Y-%m-%dT%H:%M:%S.000")
    
    params = {
        "resultsPerPage": 5,
        "lastModStartDate": start_str,
        "lastModEndDate": end_str
    }
    headers = {"User-Agent": "Mozilla/5.0"}
    
    try:
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        vulnerabilities = data.get("vulnerabilities", [])
        
        for item in vulnerabilities:
            cve = item.get("cve", {})
            cve_id = cve.get("id", "Unknown")
            
            descriptions = cve.get("descriptions", [])
            description_text = "No description available"
            for desc in descriptions:
                if desc.get("lang") == "en":
                    description_text = desc.get("value")
                    break
                    
            published_date_full = cve.get("published", "")
            published_date = published_date_full.split("T")[0] if "T" in published_date_full else published_date_full
            
            is_recent = False
            try:
                pub_dt = datetime.strptime(published_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                if pub_dt >= start_date:
                    is_recent = True
            except ValueError:
                pass
            
            normalized_cve = {
                "source": "NVD",
                "cve_id": cve_id,
                "description": description_text,
                "published_date": published_date,
                "is_recent": is_recent
            }
            
            cve_json = json.dumps(normalized_cve)
            
            try:
                redis_client.rpush('threat_queue', cve_json)
                print(f"Pushed {cve_id} to Redis threat_queue")
            except redis.RedisError as re:
                print(f"Redis error: {re}")
            
            print(json.dumps(normalized_cve, indent=2))
            
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from NVD API: {e}")

if __name__ == "__main__":
    fetch_nvd_data()
