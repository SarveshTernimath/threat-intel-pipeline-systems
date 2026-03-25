import requests
import xml.etree.ElementTree as ET
import json
import redis
import hashlib
import re
from datetime import datetime
from email.utils import parsedate_to_datetime

# Initialize native Redis connection matching exactly with existing configurations
redis_client = redis.Redis(host='localhost', port=6379, db=0)

RSS_FEEDS = [
    "https://feeds.feedburner.com/TheHackersNews",
    "https://www.bleepingcomputer.com/feed/"
]

def clean_html(raw_html):
    """Strips raw HTML tags (like <p>, <a>) dynamically out of RSS descriptions."""
    if not raw_html:
        return ""
    cleanr = re.compile('<.*?>')
    return re.sub(cleanr, '', raw_html).strip()

def fetch_rss_feeds():
    """
    Fetches real-time threat intelligence from specified RSS feeds, strictly normalizes
    the XML components into the global pipeline's JSON schema, and securely pushes it to Redis.
    """
    # Hardened Google Chrome imitation User-Agent mathematically bypassing Cloudflare 403 Forbidden blocks natively
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    
    for feed_url in RSS_FEEDS:
        try:
            response = requests.get(feed_url, headers=headers)
            response.raise_for_status()
            
            # Parse the secure XML HTTP response string
            root = ET.fromstring(response.content)
            
            # Iterate through the `<item>` blocks inside standard RSS 2.0 `<channel>` elements
            items = root.findall('./channel/item')
            
            # Limit to the 15 most recent articles per feed to safely pace queue limits
            for item in items[:15]:
                title_node = item.find('title')
                title = title_node.text if title_node is not None else "Unknown Advisory"
                
                desc_node = item.find('description')
                description = desc_node.text if desc_node is not None else ""
                
                # Utilize the unique link target to build a mathematically consistent document identifier
                link_node = item.find('link')
                link = link_node.text if link_node is not None else title
                
                pub_date_node = item.find('pubDate')
                pub_date = pub_date_node.text if pub_date_node is not None else datetime.utcnow().strftime("%Y-%m-%d")
                
                try:
                    # RFC 2822 standard parser securely normalizes messy timezone acronyms cleanly
                    dt = parsedate_to_datetime(pub_date)
                    published_date = dt.strftime("%Y-%m-%d")
                except Exception:
                    published_date = datetime.utcnow().strftime("%Y-%m-%d")  # Strict Elasticsearch schema mapping fallback
                
                # Construct a short distinct ID resolving into the format `RSS-{unique_id}`
                unique_hash = hashlib.md5(link.encode('utf-8')).hexdigest()[:10]
                rss_cve_id = f"RSS-{unique_hash}"
                
                # Strip out HTML elements and cleanly merge the title with the core snippet description
                clean_description = clean_html(description)
                full_description_text = f"{title.strip()} - {clean_description}"
                
                # Construct the mathematically exact payload schema dictated by the pipeline rules
                normalized_rss_threat = {
                    "source": "RSS",
                    "cve_id": rss_cve_id,
                    "description": full_description_text,
                    "published_date": published_date,
                    "is_recent": True
                }
                
                # Push identically serialized data structurally into the shared Redis message broker
                try:
                    redis_client.rpush('threat_queue', json.dumps(normalized_rss_threat))
                    print(f"Pushed {rss_cve_id} securely to Redis threat_queue")
                except redis.RedisError as re_err:
                    print(f"Redis pipeline transit error: {re_err}")
                    
        except requests.exceptions.RequestException as req_err:
            print(f"Critically failed fetching RSS network data from {feed_url}: {req_err}")
        except ET.ParseError as parse_err:
            print(f"XML structurally failed to parse for {feed_url}: {parse_err}")

if __name__ == "__main__":
    fetch_rss_feeds()
