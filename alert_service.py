import os
import smtplib
from email.message import EmailMessage
from typing import Optional

import requests


def send_email(subject: str, body: str) -> None:
    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASS", "")
    to_addr = os.getenv("ALERT_TO", "")
    from_addr = os.getenv("ALERT_FROM", user)

    if not (host and user and password and to_addr):
        raise RuntimeError("Missing SMTP env vars: SMTP_HOST/SMTP_USER/SMTP_PASS/ALERT_TO")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(body)

    with smtplib.SMTP(host, port, timeout=10) as s:
        s.starttls()
        s.login(user, password)
        s.send_message(msg)


def fetch_latest_critical(es_base: str) -> Optional[dict]:
    # Query critical threats (latest first). We do not alter ES schema or pipeline.
    query = {
        "size": 1,
        "sort": [{"published_date": {"order": "desc"}}],
        "query": {"match": {"severity": "critical"}},
    }
    try:
        r = requests.get(f"{es_base}/threats/_search", json=query, timeout=8)
        r.raise_for_status()
        hits = r.json().get("hits", {}).get("hits", [])
        if not hits:
            return None
        return hits[0].get("_source", {})
    except Exception:
        return None


def main():
    es_base = os.getenv("ELASTICSEARCH_URL", "http://localhost:9200").rstrip("/")
    latest = fetch_latest_critical(es_base)
    if not latest:
        print("No critical threats found.")
        return

    title = latest.get("cve_id", "Unknown")
    severity = latest.get("severity", "unknown")
    source = latest.get("source", "Unknown")

    subject = f"[CRITICAL] {title} ({source})"
    body = f"Threat: {title}\nSeverity: {severity}\nSource: {source}\n\nDescription:\n{latest.get('description','')}\n"

    send_email(subject, body)
    print("Alert email sent.")


if __name__ == "__main__":
    main()
