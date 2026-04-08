import os
import time
import requests
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
ALERT_TO = os.getenv("ALERT_TO")

# In-memory memory caching of sent alerts
sent_cve_ids = set()

def send_email_alert(hit):
    """Sends a formatted email alert via SMTP for a critical threat."""
    if not (SMTP_USER and SMTP_PASS and ALERT_TO):
        print("SMTP Credentials not configured. Cannot send email.")
        return False

    source_data = hit.get("_source", {})
    cve_id = source_data.get("cve_id", "Unknown CVE")
    description = source_data.get("description", "No description provided.")
    severity = source_data.get("severity", "critical")
    source = source_data.get("source", "Unknown")

    subject = f"CRITICAL THREAT ALERT: {cve_id}"
    body = f"""A new critical threat has been registered in the pipeline:

CVE ID: {cve_id}
Severity: {severity.upper()}
Source: {source}

Description:
{description}

-- Threat Intel Pipeline
"""

    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = ALERT_TO
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
        server.quit()
        print(f"[SUCCESS] Email alert sent for {cve_id}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to send email alert for {cve_id}: {e}")
        return False

def run_alert_engine(initial_boot=False):
    """
    Queries Elasticsearch for any new threats classified as 'critical' 
    and triggers SMTP email alerts. Loop logic is maintained by caller.
    """
    es_url = "http://localhost:9200/threats/_search"
    
    # Query to fetch all records tagged with critical severity, sort by date
    query = {
        "query": {
            "match": {
                "severity": "critical"
            }
        },
        "size": 50,
        "sort": [{"published_date": {"order": "desc", "unmapped_type": "date"}}]
    }
    
    try:
        response = requests.get(es_url, json=query, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        hits = data.get("hits", {}).get("hits", [])
        
        new_criticals_found = False
        
        for hit in hits:
            source = hit.get("_source", {})
            cve_id = source.get("cve_id", "Unknown CVE")
            
            # Avoid duplicate emails
            if cve_id not in sent_cve_ids:
                new_criticals_found = True
                
                if not initial_boot:
                    print(f"[ALERT] New critical threat detected: {cve_id}")
                    success = send_email_alert(hit)
                else:
                    print(f"[BOOT] Loaded existing critical threat into memory: {cve_id}")
                
                # We record it as sent regardless
                sent_cve_ids.add(cve_id)
                
        if not new_criticals_found and not initial_boot:
             print("System Scan: No new critical threats detected at this time.")
            
    except requests.exceptions.RequestException as e:
        print(f"[ERROR] Failed to connect or query Elasticsearch: {e}")

if __name__ == "__main__":
    print("Starting Threat Alert Service (SMTP Enabled)...")
    
    # Do an initial silent pass to load existing threats into memory and avoid spam
    print("Performing initial memory load to prevent historic spam...")
    run_alert_engine(initial_boot=True)
    
    print("Entering 60s polling loop. Press Ctrl+C to stop.")
    while True:
        time.sleep(60)
        run_alert_engine(initial_boot=False)

