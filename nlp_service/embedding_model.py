import sys
import json
import logging
import os

# Suppress heavy TensorFlow/HuggingFace verbosity outputs so JSON parses cleanly in Go
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TRANSFORMERS_VERBOSITY"] = "error"

try:
    from sentence_transformers import SentenceTransformer
    # Rapid CPU-friendly semantic encoder mapping paragraphs to 384-dimensional dense arrays
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception as e:
    model = None

def get_embedding(text):
    if not text or not model:
        # Failsafe: return natively empty array resolving ES zero magnitude divide by zero crashes
        return []
    
    # Strictly truncate heavily long CVEs to prevent memory crashes on local machines
    safe_text = text[:2000]
    embedding = model.encode(safe_text).tolist()
    return embedding

if __name__ == "__main__":
    try:
        input_text = sys.stdin.read().strip()
        vector = get_embedding(input_text)
        print(json.dumps({"embedding": vector}))
    except Exception:
        # Guarantee Go payload safely identifies length=0 and strips embedding cleanly mapping without it
        print(json.dumps({"embedding": []}))
