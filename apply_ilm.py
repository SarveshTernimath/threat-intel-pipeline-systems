import os
import requests
from dotenv import load_dotenv

def apply_ilm():
    load_dotenv()
    es_url = os.getenv("ELASTICSEARCH_URL")
    if not es_url:
        print("Error: ELASTICSEARCH_URL not found.")
        return

    # Define the ILM policy: delete after 7 days
    policy = {
        "policy": {
            "phases": {
                "hot": {
                    "actions": {}
                },
                "delete": {
                    "min_age": "7d",
                    "actions": {
                        "delete": {}
                    }
                }
            }
        }
    }

    print("Creating ILM Policy...")
    r = requests.put(f"{es_url}/_ilm/policy/threats_policy", json=policy)
    print("Policy Create Response:", r.status_code, r.text)

    if r.status_code not in (200, 201):
        print("Failed to create ILM policy.")
        return

    print("Applying ILM Policy to 'threats' index...")
    settings = {
        "index": {
            "lifecycle": {
                "name": "threats_policy"
            }
        }
    }
    r2 = requests.put(f"{es_url}/threats/_settings", json=settings)
    print("Index Settings Update Response:", r2.status_code, r2.text)

if __name__ == "__main__":
    apply_ilm()
