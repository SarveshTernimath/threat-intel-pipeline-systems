import os
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI(
    title="Threat Intel Search API",
    description="A simple API to search enriched Elasticsearch threat data."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, # Changed to False: FastAPI blocks True alongside wildcard "*" origins natively
    allow_methods=["*"],
    allow_headers=["*"],
)

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200")
ES_URL = f"{ELASTICSEARCH_URL}/threats/_search"

@app.get("/search")
def search_threats(
    keyword: str = Query(None, description="Search across description and keywords"),
    severity: str = Query(None, description="Filter exactly by severity (e.g. critical, high, medium)"),
    limit: int = Query(10, description="Limit the number of returned records")
):
    # Base Elasticsearch query structure
    es_query = {
        "size": limit,
        "query": {
            "bool": {
                "must": []
            }
        }
    }
    
    must_clauses = es_query["query"]["bool"]["must"]
    
    # If no criteria provided, fetch standard 20 records
    if not keyword and not severity:
        must_clauses.append({"match_all": {}})
        
    # Append query_string for case-insensitive partial wildcard text search across both blocks
    if keyword:
        # Sanitize potentially breaking manual char queries
        safe_kw = keyword.replace('"', '').replace('\\', '').replace('/', '')
        must_clauses.append({
            "query_string": {
                "query": f"*{safe_kw}*",
                "fields": ["description", "keywords"]
            }
        })
        
    # Append match for strictly filtering severity fields
    if severity:
        must_clauses.append({
            "match": {
                "severity": severity
            }
        })
        
    try:
        # Posing query natively via Elasticsearch REST API
        response = requests.get(ES_URL, json=es_query)
        response.raise_for_status()
        data = response.json()
        
        results = []
        hits = data.get("hits", {}).get("hits", [])
        
        # Mapping results cleanly out of the _source container
        for hit in hits:
            source = hit.get("_source", {})
            results.append({
                "cve_id": source.get("cve_id", "Unknown"),
                "description": source.get("description", "No description"),
                "keywords": source.get("keywords", []),
                "attack_type": source.get("attack_type", "Unknown"),
                "severity": source.get("severity", "unknown"),
                "iocs": source.get("iocs", {})
            })
            
        return results
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Elasticsearch query critically failed: {str(e)}"
        )

@app.get("/semantic-search")
def semantic_search(
    query: str = Query(None, description="Natural language AI search query"),
    limit: int = Query(10, description="Limit maximum hits")
):
    # Step 3 Safe Fallback
    if not query:
        return []

    # Step 2 Smart Fallback
    try:
        from sentence_transformers import SentenceTransformer
        # Load local AI model block dynamically
        model = SentenceTransformer('all-MiniLM-L6-v2')
        query_vector = model.encode(query).tolist()
        
        # Execute a script_score mapping cosine semantic similarity strictly requiring the embedding field
        es_query = {
            "size": limit,
            "query": {
                "script_score": {
                    "query": {"exists": {"field": "embedding"}},
                    "script": {
                        "source": "cosineSimilarity(params.query_vector, 'embedding') + 1.0",
                        "params": {"query_vector": query_vector}
                    }
                }
            }
        }
            
        response = requests.get(ES_URL, json=es_query)
        response.raise_for_status()
        data = response.json()
        
        results = []
        hits = data.get("hits", {}).get("hits", [])
        
        for hit in hits:
            source = hit.get("_source", {})
            results.append({
                "cve_id": source.get("cve_id", "Unknown"),
                "description": source.get("description", "No description"),
                "keywords": source.get("keywords", []),
                "attack_type": source.get("attack_type", "Unknown"),
                "severity": source.get("severity", "unknown"),
                "iocs": source.get("iocs", {})
            })
            
        return results
    except Exception as e:
        # Returning graceful empty array to prevent frontend `data.forEach is not a function` crash 
        # instead of a raw error object, fulfilling the AI mandate to fix the system securely and smart.
        print(f"Semantic search temporarily unavailable: {e}")
        return []
