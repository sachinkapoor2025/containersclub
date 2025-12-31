# app.py
import os
import json
import time
import boto3
from decimal import Decimal
from typing import Any

print("⚡ Lambda cold start - modules loaded")

TABLE_NAME = os.environ.get("TABLE_NAME", "")
print(f"🔧 TABLE_NAME from env: '{TABLE_NAME}'")

if not TABLE_NAME:
    print("❗ WARNING: TABLE_NAME is empty. Set the TABLE_NAME environment variable.")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# ---------- utilities ----------
def now_ts():
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime())

def _convert_decimals(obj: Any) -> Any:
    """
    Recursively convert Decimal, set, bytes -> JSON-safe types.
    """
    if isinstance(obj, Decimal):
        # return int when no fractional part, else float
        try:
            if obj % 1 == 0:
                return int(obj)
        except Exception:
            pass
        return float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    if isinstance(obj, set):
        return [_convert_decimals(i) for i in list(obj)]
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except Exception:
            return str(obj)
    return obj

# ---------- scan with pagination ----------
def _scan_all(table):
    print(f"{now_ts()} 📡 Start scanning table '{TABLE_NAME}'")
    items = []
    kwargs = {}
    page = 0
    while True:
        page += 1
        print(f"{now_ts()} 🔍 Calling scan() page={page} kwargs_keys={list(kwargs.keys())}")
        resp = table.scan(**kwargs)
        batch = resp.get("Items", [])
        print(f"{now_ts()} 📦 Received {len(batch)} items in page {page}")
        items.extend(batch)
        if "LastEvaluatedKey" in resp:
            print(f"{now_ts()} ➡️ LastEvaluatedKey present, continuing to next page")
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        else:
            print(f"{now_ts()} ✅ No LastEvaluatedKey — scan complete after {page} pages")
            break
    print(f"{now_ts()} 📊 Total items retrieved: {len(items)}")
    return items

# ---------- main handler ----------
def handler(event, context):
    start = time.time()
    print(f"{now_ts()} 🚀 Handler start. RequestId={getattr(context, 'aws_request_id', 'N/A')}")
    print(f"{now_ts()} 📥 Event: {json.dumps(event) if isinstance(event, dict) else str(event)}")

    # parse query params defensively
    try:
        params = event.get("queryStringParameters") or {}
        print(f"{now_ts()} 🔧 Raw queryStringParameters: {params}")
    except Exception as e:
        print(f"{now_ts()} ❌ Failed to read queryStringParameters: {e}")
        params = {}

    q = (params.get("q") or "").lower()
    size = params.get("size") or ""
    condition = params.get("condition") or ""
    location = params.get("location") or ""

    print(f"{now_ts()} 🔎 Filters parsed -> q='{q}', size='{size}', condition='{condition}', location='{location}'")

    # fetch items
    try:
        items = _scan_all(table)
    except Exception as e:
        print(f"{now_ts()} ❌ Error scanning DynamoDB: {e}")
        body = {"error": "Failed to read table", "message": str(e)}
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(body)
        }

    # filtering
    print(f"{now_ts()} 🔎 Starting filtering of {len(items)} items")
    def match(it):
        def g(k):
            try:
                v = it.get(k) or ""
                # Decimal/number -> str for search
                if isinstance(v, (int, float, Decimal)):
                    v = str(v)
                return (v or "").lower()
            except Exception:
                return ""
        ok = True
        if q:
            ok = q in g("title") or q in g("description") or q in g("specs") or q in g("location")
        if size and ok:
            ok = (it.get("size") == size)
        if condition and ok:
            ok = (it.get("condition") == condition)
        if location and ok:
            ok = (location.lower() in g("location"))
        return ok

    try:
        filtered = list(filter(match, items))
        print(f"{now_ts()} 🎯 Filtering complete. Matched {len(filtered)} items")
    except Exception as e:
        print(f"{now_ts()} ❌ Error during filtering: {e}")
        filtered = []

    # convert decimals and other Dynamo types to JSON-safe values
    print(f"{now_ts()} 🔄 Converting DynamoDB types to JSON-safe types")
    try:
        safe_filtered = [_convert_decimals(item) for item in filtered]
        print(f"{now_ts()} ✅ Conversion complete")
    except Exception as e:
        print(f"{now_ts()} ❌ Error during conversion: {e}")
        # fallback: try to stringify
        try:
            safe_filtered = [json.loads(json.dumps(item, default=str)) for item in filtered]
            print(f"{now_ts()} ⚠️ Fallback conversion via default=str succeeded")
        except Exception as e2:
            print(f"{now_ts()} ❌ Fallback conversion failed: {e2}")
            safe_filtered = []

    # prepare and return response
    duration_ms = int((time.time() - start) * 1000)
    print(f"{now_ts()} 📤 Returning response. duration_ms={duration_ms}")

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"items": safe_filtered})
    }
