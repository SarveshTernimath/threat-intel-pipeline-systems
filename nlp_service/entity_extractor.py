import sys
import json
import os
import re
import requests

# Suppress HuggingFace verbosity and TensorFlow warnings
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3" 
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

try:
    from transformers import pipeline
    ner_pipe = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
except Exception:
    ner_pipe = None

ATTACK_MAPPING = {
    "sql injection": "injection",
    "xss": "web attack",
    "cross-site scripting": "web attack",
    "buffer overflow": "memory corruption",
    "rce": "remote execution",
    "remote code execution": "remote execution",
    "malware": "malware",
    "ransomware": "malware",
    "privilege escalation": "privilege escalation"
}

def get_geoip(ip: str) -> dict:
    """Fetches GeoIP data for a given IP address."""
    try:
        # Free IP-API (No auth required for low volume)
        response = requests.get(f"http://ip-api.com/json/{ip}", timeout=2)
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "success":
                return {
                    "country": data.get("country"),
                    "city": data.get("city"),
                    "org": data.get("org"),
                    "lat": data.get("lat"),
                    "lon": data.get("lon")
                }
    except Exception:
        pass
    return {}

def extract_entities(text: str) -> dict:
    if not text:
        return {"keywords": [], "attack_type": "unknown", "iocs": {"ips": [], "domains": [], "hashes": []}}
        
    text_lower = text.lower()
    found_keywords = []
    
    for term in ATTACK_MAPPING.keys():
        if term in text_lower:
            normalized_term = term
            if term == "cross-site scripting":
                normalized_term = "xss"
            elif term == "remote code execution":
                normalized_term = "rce"
                
            if normalized_term not in found_keywords:
                found_keywords.append(normalized_term)
                
    if ner_pipe:
        try:
            clean_text = text[:1000]
            entities = ner_pipe(clean_text)
            for ent in entities:
                if ent['entity_group'] in ['MISC', 'ORG'] and ent['score'] > 0.8:
                    word = ent['word'].lower()
                    if len(word) > 2 and word not in found_keywords:
                        found_keywords.append(word)
        except Exception:
            pass

    attack_type = "unknown"
    for kw in found_keywords:
        if kw in ATTACK_MAPPING:
            attack_type = ATTACK_MAPPING[kw]
            break
            
    # Extract IOCs
    ips_raw = list(set(re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text)))
    domains = list(set(re.findall(r"\b[a-zA-Z0-9.-]+\.(?:com|net|org|io|ru|cn)\b", text)))
    hashes = list(set(re.findall(r"\b[a-fA-F0-9]{32,64}\b", text)))

    # Enrich first 3 IPs with GeoIP (to avoid hitting rate limits)
    enriched_ips = []
    for ip in ips_raw[:3]:
        geo = get_geoip(ip)
        enriched_ips.append({"ip": ip, "geo": geo})
    
    # Remaining IPs as objects without geo if over limit
    for ip in ips_raw[3:]:
        enriched_ips.append({"ip": ip})

    return {
        "keywords": list(found_keywords)[:10],
        "attack_type": attack_type,
        "iocs": {
            "ips": ips_raw, # KEEP ORIGINAL AS STRINGS (Saves ES mapping)
            "enriched_ips": enriched_ips, # NEW FIELD FOR WOW DATA
            "domains": domains,
            "hashes": hashes
        }
    }

if __name__ == "__main__":
    try:
        input_text = sys.stdin.read().strip()
        result = extract_entities(input_text)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "keywords": [], 
            "attack_type": "unknown",
            "iocs": {"ips": [], "domains": [], "hashes": []}
        }))