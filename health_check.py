import os
import requests
import redis
import socket

def check_service(host, port, name):
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"[OK] {name} is reachable on {host}:{port}")
            return True
    except (socket.timeout, ConnectionRefusedError):
        print(f"[FAIL] {name} is NOT reachable on {host}:{port}")
        return False

def check_api_health():
    try:
        response = requests.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print("[OK] FastAPI backend is live.")
            return True
        else:
            print(f"[WARN] FastAPI backend returned status {response.status_code}")
            return False
    except (requests.exceptions.RequestException, ConnectionError):
        print("[FAIL] FastAPI backend is NOT running.")
        return False

def check_redis():
    try:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        r = redis.from_url(redis_url)
        r.ping()
        print(f"[OK] Redis is connected ({redis_url}).")
        return r
    except Exception as e:
        print(f"[FAIL] Redis connection failed: {e}")
        return None

def check_elasticsearch():
    try:
        es_url = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
        response = requests.get(es_url, timeout=5)
        if response.status_code in [200, 401]: # 401 might mean it's up but needs auth
            print(f"[OK] Elasticsearch is connected ({es_url}).")
            return True
        else:
            print(f"[FAIL] Elasticsearch returned status {response.status_code}")
            return False
    except requests.exceptions.RequestException:
        print("[FAIL] Elasticsearch is NOT running.")
        return False

def check_pipeline():
    print("--- Threat Intel Pipeline System Health Check ---")
    r = check_redis()
    check_elasticsearch()
    check_api_health()
    
    if r:
        try:
            queue_len = r.llen("threat_queue")
            print(f"[*] Redis threat_queue length: {queue_len}")
        except Exception:
            pass
            
    print("-------------------------------------------------")

if __name__ == "__main__":
    check_pipeline()
