import os
import requests
from dotenv import load_dotenv

def deduplicate_threats():
    load_dotenv()
    es_url = os.getenv("ELASTICSEARCH_URL")
    if not es_url:
        print("Error: ELASTICSEARCH_URL not found.")
        return

    print("Starting deduplication process...")

    # Scroll setup
    scroll_size = 1000
    search_query = {
        "size": scroll_size,
        "query": {"match_all": {}}
    }

    try:
        r = requests.post(
            f"{es_url}/threats/_search?scroll=2m", 
            json=search_query, 
            timeout=30
        )
        r.raise_for_status()
    except Exception as e:
        print("Failed to initialize search:", e)
        return

    data = r.json()
    scroll_id = data.get("_scroll_id")
    hits = data["hits"]["hits"]

    seen_cve_ids = set()
    docs_to_delete = []
    total_docs_processed = 0

    while hits:
        for doc in hits:
            total_docs_processed += 1
            source = doc.get("_source", {})
            doc_id = doc["_id"]
            cve_id = source.get("cve_id")

            # Only deduplicate if cve_id exists and is not empty
            if cve_id:
                if cve_id in seen_cve_ids:
                    # Duplicate found
                    docs_to_delete.append(doc_id)
                else:
                    seen_cve_ids.add(cve_id)

        # Get next batch
        try:
            r = requests.post(
                f"{es_url}/_search/scroll",
                json={"scroll": "2m", "scroll_id": scroll_id},
                timeout=30
            )
            r.raise_for_status()
            data = r.json()
            scroll_id = data.get("_scroll_id")
            hits = data["hits"]["hits"]
        except Exception as e:
            print("Failed fetching scroll:", e)
            break

    print(f"Total documents scanned: {total_docs_processed}")
    print(f"Unique CVE IDs found: {len(seen_cve_ids)}")
    print(f"Duplicates to delete: {len(docs_to_delete)}")

    if docs_to_delete:
        print("Deleting duplicates in bulk...")
        # ES Bulk API requires newline delimited JSON
        bulk_data = ""
        for d_id in docs_to_delete:
            action = {"delete": {"_index": "threats", "_id": d_id}}
            import json
            bulk_data += json.dumps(action) + "\n"
        
        # We can chunk bulk requests if too large, but 25k max string length is fine
        # Let's chunk every 5000 just to be safe
        chunk_size = 5000
        for i in range(0, len(docs_to_delete), chunk_size):
            chunk = docs_to_delete[i:i + chunk_size]
            bulk_chunk = ""
            for d_id in chunk:
                action = {"delete": {"_index": "threats", "_id": d_id}}
                bulk_chunk += json.dumps(action) + "\n"

            headers = {"Content-Type": "application/x-ndjson"}
            try:
                bulk_resp = requests.post(f"{es_url}/_bulk", data=bulk_chunk, headers=headers, timeout=30)
                bulk_resp.raise_for_status()
                res_data = bulk_resp.json()
                if res_data.get("errors"):
                    print(f"Bulk Delete Chunk contains errors. Checked first item errors...")
            except Exception as e:
                print("Failed during bulk delete chunk:", e)
                
        print(f"Successfully deleted {len(docs_to_delete)} duplicate documents.")
    else:
        print("No duplicates found. The index is clean.")

    # Clear scroll context
    try:
        requests.delete(f"{es_url}/_search/scroll", json={"scroll_id": scroll_id})
    except:
        pass

if __name__ == "__main__":
    deduplicate_threats()
