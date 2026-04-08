import urllib.request
import urllib.error
import json

print("\n--- STEP 1 ---")
try:
    resp = urllib.request.urlopen('http://localhost:9200', timeout=5).read()
    print("ES UP")
except Exception as e:
    print(f"ELASTICSEARCH DOWN: {e}")

print("\n--- STEP 2 ---")
try:
    resp = json.loads(urllib.request.urlopen('http://localhost:9200/threats/_count', timeout=5).read())
    print("COUNT =", resp.get('count', 'N/A'))
except Exception as e:
    print("COUNT FAIL", e)

print("\n--- STEP 3 ---")
try:
    resp = json.loads(urllib.request.urlopen('http://localhost:9200/threats/_search?size=5', timeout=5).read())
    hits = resp.get('hits', {}).get('hits', [])
    print("TOTAL HITS:", len(hits))
    for h in hits:
        src = h['_source']
        print("---")
        print("CVE:", src.get("cve_id"))
        print("LAT:", src.get("lat"))
        print("LNG:", src.get("lng"))
        print("IPS:", src.get("iocs", {}).get("ips"))
except Exception as e:
    print("ES FETCH ERROR:", e)
