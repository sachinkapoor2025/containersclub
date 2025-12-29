# app.py
import os
import json
import boto3
from decimal import Decimal
from typing import Any

print("⚡ Lambda cold start: loading modules...")

TABLE_NAME = os.environ.get("TABLE_NAME", "YourTableName")
print(f"🔧 DynamoDB TableName from env: {TABLE_NAME}")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

# ------------------ DECIMAL CONVERTER ------------------
def _convert_decimals(obj: Any) -> Any:
    """Recursively convert DynamoDB Decimals, sets, bytes → JSON-safe types."""
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    if isinstance(obj, dict):
        return {k: _convert_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_decimals(i) for i in obj]
    if isinstance(obj, set):
        return [_convert_decimals(i) for i in list(obj)]
    if isinstance(obj, bytes):
        try:
            return obj.decode("utf-8")
        except:
            return str(obj)
    return obj

# ------------------ SCAN WITH PAGINATION ------------------
def _scan_all(table):
    print("📡 Starting full table scan...")
    items = []
    kwargs = {}
    while True:
        print("🔍 Calling DynamoDB scan()...")
        resp = table.scan(**kwargs)

        batch = resp.get("Items", [])
        print(f"📦 Retrieved {len(batch)} items in this page.")
        items.extend(batch)

        if "LastEvaluatedKey" in resp:
            print("➡️ More pages detected. Continuing scan...")
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        else:
            print("✅ Scan complete. No more pages.")
            break

    print(f"📊 Total items retrieved from DynamoDB: {len(items)}")
    return items

# ------------------ MAIN HANDLER ------------------
def handler(event, context):
    print("🚀 Lambda handler invoked.")
    print(f"📥 Incoming event: {json.dumps(event)}")

    # Extract query parameters
    print("🔧 Extracting query parameters...")
    params = event.get("queryStringParameters") or {}
    q = (params.get("q") or "").lower()
    size = params.get("size") or ""
    condition = params.get("condition") or ""
    location = params.get("location") or ""

    print(f"🔎 Query params → q='{q}', size='{size}', condition='{condition}', location='{location}'")

    # Fetch items from DynamoDB
    try:
        print("📡 Fetching all items from DynamoDB...")
        items = _scan_all(table)
        print("📡 DynamoDB fetch complete.")
    except Exception as e:
        print(f"❌ Error fetching from DynamoDB: {e}")
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Failed to read table", "message": str(e)})
        }

    # Filtering step
    print("🔎 Starting filtering process...")
    def match(it):
        def g(k):
            v = it.get(k) or ""
            if isinstance(v, (int, float, Decimal)):
                v = str(v)
            try:
                return v.lower()
            except:
                return ""

        ok = True
        if q:
            ok = q in g("title") or q in g("description") or q in g("specs") or q in g("location")
        if size and ok:
            ok = it.get("size") == size
        if condition and ok:
            ok = it.get("condition") == condition
        if location and ok:
            ok = location.lower() in g("location")
        return ok

    filtered = list(filter(match, items))
    print(f"🎯 Filtered items count: {len(filtered)}")

    # Decimal conversion
    print("🔄 Converting DynamoDB Decimals → JSON-safe types...")
    safe_filtered = [_convert_decimals(item) for item in filtered]
    print("✅ Conversion complete.")

    # Sending response
    print("📤 Returning response to API Gateway...")
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps({"items": safe_filtered})
    }
