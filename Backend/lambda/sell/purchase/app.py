import json
import os
import uuid
import time
import boto3

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["BOOKINGS_TABLE"])

ALLOWED_ORIGIN = "https://containersclub.com"


def response(status, body=None):
    return {
        "statusCode": status,
        "headers": {
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        "body": json.dumps(body) if body else ""
    }


def handler(event, context):
    # ---- Handle CORS preflight (REST + HTTP API safe) ----
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")

    if method == "OPTIONS":
        return response(200)

    try:
        body = event.get("body")
        if not body:
            return response(400, {
                "success": False,
                "message": "Missing request body"
            })

        data = json.loads(body)

        # ---- Basic validation ----
        required_fields = ["listingId", "name", "email", "address"]
        for field in required_fields:
            if not data.get(field):
                return response(400, {
                    "success": False,
                    "message": f"Missing required field: {field}"
                })

        purchase_id = f"sell-{uuid.uuid4()}"
        now = int(time.time())

        item = {
            "booking_id": purchase_id,
            "service": "sell",
            "listing_id": data["listingId"],
            "customer": {
                "name": data.get("name"),
                "email": data.get("email"),
                "phone": data.get("phone")
            },
            "delivery_address": data.get("address"),
            "location": data.get("location"),
            "price": data.get("total"),
            "notes": data.get("notes"),
            "created_at": now
        }

        table.put_item(Item=item)

        return response(200, {
            "success": True,
            "purchase_id": purchase_id
        })

    except Exception as e:
        print("PURCHASE ERROR:", str(e))
        return response(500, {
            "success": False,
            "message": "Failed to complete purchase"
        })
