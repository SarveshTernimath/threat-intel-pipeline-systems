import requests

print("==== BACKEND HEALTH CHECK ====")

base = "https://threat-intel-pipeline-systems-backend.onrender.com"

endpoints = [
    "/",
    "/search?keyword=attack&limit=2",
    "/geo-threats?limit=5",
    "/all-threats?limit=5"
]

for ep in endpoints:
    try:
        url = base + ep
        r = requests.get(url, timeout=10)

        print(f"\n[CHECK] {ep}")
        print("Status:", r.status_code)

        if r.status_code == 200:
            data = r.json()

            if isinstance(data, list):
                print("Records:", len(data))
                if len(data) > 0:
                    print("Sample Keys:", list(data[0].keys())[:5])
            else:
                print("Response OK")

        else:
            print("FAILED ❌")

    except Exception as e:
        print(f"{ep} ERROR ❌:", e)

print("\n==== ELASTIC DATA CHECK ====")

try:
    r = requests.get(base + "/geo-threats?limit=50", timeout=10)
    data = r.json()

    geo = [d for d in data if d.get("lat") and d.get("lng")]
    ips = [d for d in data if d.get("iocs")]

    print("Geo-enabled:", len(geo))
    print("IOC present:", len(ips))

except Exception as e:
    print("ES check failed ❌", e)

print("\n==== FINAL STATUS ====")
print("If all endpoints return 200 and data > 0 → SYSTEM IS WORKING ✅")





