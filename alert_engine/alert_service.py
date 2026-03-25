import requests

WEBHOOK_URL = "https://webhook.site/937d7096-0871-4fd7-9345-5418ba55159b"

def run_alert_engine():
    """
    Queries Elasticsearch for any threats that have been classified 
    as 'critical' severity and prints a formatted alert to the console.
    """
    es_url = "http://localhost:9200/threats/_search"
    
    # Query to fetch all records explicitly tagged with critical severity
    query = {
        "query": {
            "match": {
                "severity": "critical"
            }
        },
        "size": 100
    }
    
    try:
        response = requests.get(es_url, json=query)
        response.raise_for_status()
        data = response.json()
        
        hits = data.get("hits", {}).get("hits", [])
        if not hits:
            print("System Scan: No critical threats currently detected.")
            return

        # Iterate over matches and print the requested alert string
        for hit in hits:
            source = hit.get("_source", {})
            cve_id = source.get("cve_id", "Unknown CVE")
            description = source.get("description", "No description provided.")
            
            print(f"[ALERT] Critical threat detected: {cve_id} - {description}")
            
            # Asset Profile Filtering natively restricting Webhooks strictly to designated systems
            desc_lower = description.lower()
            if any(term in desc_lower for term in ["nginx", "apache", "windows"]):
                webhook_payload = {
                    "text": "[ALERT] Critical Threat Detected",
                    "cve_id": cve_id,
                    "description": description,
                    "severity": "critical"
                }
                try:
                    # Fire Webhook HTTP integration with strict timeouts preventing blocking crashes
                    requests.post(WEBHOOK_URL, json=webhook_payload, timeout=5)
                except Exception as alert_err:
                    print(f"Non-fatal Webhook dispatch failure safely bypassed: {alert_err}")
            
    except requests.exceptions.RequestException as e:
        print(f"Failed to connect or query Elasticsearch: {e}")

if __name__ == "__main__":
    run_alert_engine()
