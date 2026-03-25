import sys
import json
import os
import re

# Suppress HuggingFace verbosity and TensorFlow warnings to keep the worker STDOUT clean
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3" 
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

try:
    from transformers import pipeline
    # Load BERT NER model (runs on CPU natively, lightweight execution)
    ner_pipe = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
except Exception:
    ner_pipe = None

# Strict Keyword to Attack Type Mapping
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

def extract_entities(text: str) -> dict:
    if not text:
        return {"keywords": [], "attack_type": "unknown"}
        
    text_lower = text.lower()
    found_keywords = []
    
    # 1. Primary Simple Keyword Search (High speed & strictly accurate for CVE text)
    for term in ATTACK_MAPPING.keys():
        if term in text_lower:
            # Normalize known acronyms mathematically
            normalized_term = term
            if term == "cross-site scripting":
                normalized_term = "xss"
            elif term == "remote code execution":
                normalized_term = "rce"
                
            if normalized_term not in found_keywords:
                found_keywords.append(normalized_term)
                
    # 2. Hybrid HuggingFace NER (Extracts additional context like Software/Products natively)
    if ner_pipe:
        try:
            # Truncate text to 1000 chars to strictly prevent heavy processing or token crashes
            clean_text = text[:1000]
            entities = ner_pipe(clean_text)
            
            for ent in entities:
                # NVD descriptions often contain Software/Products flagged as MISC/ORG by BERT
                if ent['entity_group'] in ['MISC', 'ORG'] and ent['score'] > 0.8:
                    word = ent['word'].lower()
                    if len(word) > 2 and word not in found_keywords:
                        found_keywords.append(word)
        except Exception:
            pass

    # 3. Resolve Primary Attack Type
    attack_type = "unknown"
    for kw in found_keywords:
        if kw in ATTACK_MAPPING:
            attack_type = ATTACK_MAPPING[kw]
            break
            
    # 4. Extract IOCs via Regex
    iocs = {
        "ips": list(set(re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", text))),
        "domains": list(set(re.findall(r"\b[a-zA-Z0-9.-]+\.(?:com|net|org|io|ru|cn)\b", text))),
        "hashes": list(set(re.findall(r"\b[a-fA-F0-9]{32,64}\b", text)))
    }
            
    return {
        "keywords": list(found_keywords)[:10], # Cap at 10 to prevent JSON payload bloating
        "attack_type": attack_type,
        "iocs": iocs
    }

if __name__ == "__main__":
    try:
        input_text = sys.stdin.read().strip()
        result = extract_entities(input_text)
        # Flush result mathematically to STDOUT for the Go worker to capture
        print(json.dumps(result))
    except Exception as e:
        # Fills requirement 4 safely if absolute failure occurs avoiding Go worker crash
        print(json.dumps({
            "keywords": [], 
            "attack_type": "unknown",
            "iocs": {"ips": [], "domains": [], "hashes": []}
        }))