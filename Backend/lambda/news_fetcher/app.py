import os
import time
import json
import urllib.request
import xml.etree.ElementTree as ET
import hashlib
import boto3

# RSS FEED URLs
FEEDS = [
    "https://www.joc.com/rssfeed",
    "https://www.container-news.com/feed/",
    "https://www.porttechnology.org/feed/",
]

TABLE = os.environ["NEWS_TABLE"]
dynamo = boto3.resource("dynamodb").Table(TABLE)

KEYWORDS = ["container", "port", "shipping", "freight", "logistics"]


# ---------------------------------------------------
# FETCH RSS FEED (prevents 403 errors)
# ---------------------------------------------------
def fetch_feed(url):
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=20) as r:
            xml = r.read()
    except Exception as e:
        print("Feed Error", url, e)
        return []

    try:
        root = ET.fromstring(xml)
    except Exception as e:
        print("XML Parse Error", url, e)
        return []

    items = []

    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        desc = (it.findtext("description") or "").strip()
        pub = (it.findtext("pubDate") or "").strip()

        content = f"{title} {desc}".lower()

        # keep only logistics-related content
        if not any(k in content for k in KEYWORDS):
            continue

        items.append({
            "title": title,
            "link": link,
            "summary": desc[:500],
            "published_at": pub,
            "source": urllib.request.urlparse(url).netloc,
        })

    return items


# ---------------------------------------------------
# SAFE BATCH-WRITE (Unique Sort Key)
# ---------------------------------------------------
def put_items(items):
    seen = set()

    with dynamo.batch_writer() as bw:
        for it in items:

            # Unique hash based on title + link
            raw = (it["title"] + it["link"]).encode()
            h = int(hashlib.sha256(raw).hexdigest()[:14], 16)  # convert to integer for ts

            # Avoid duplicates inside the same batch
            if h in seen:
                continue

            seen.add(h)

            item = {
                "pk": "NEWS",      # Same partition key for all items
                "ts": h,           # UNIQUE sort key to avoid duplicates
                **it,
                "tags": ["container", "market"],
            }

            bw.put_item(Item=item)


# ---------------------------------------------------
# MAIN HANDLER
# ---------------------------------------------------
def lambda_handler(event, context):

    all_items = []

    for feed in FEEDS:
        all_items.extend(fetch_feed(feed))

    if all_items:
        put_items(all_items)

    return {
        "status": "ok",
        "inserted": len(all_items)
    }
