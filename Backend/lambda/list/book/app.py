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
    # Preflight
    if event["httpMethod"] == "OPTIONS":
        return response(200)

    try:
        data = json.loads(event.get("body", "{}"))

        booking_id = f"rent-{uuid.uuid4()}"
        now = int(time.time())

        item = {
            "booking_id": booking_id,
            "type": "rent",
            "listing_id": data.get("listingId"),
            "customer": {
                "name": data.get("name"),
                "email": data.get("email"),
                "phone": data.get("phone")
            },
            "dates": {
                "from": data.get("fromDate"),
                "to": data.get("toDate")
            },
            "location": data.get("location"),
            "price": data.get("total"),
            "notes": data.get("notes"),
            "created_at": now
        }

        table.put_item(Item=item)

        return response(200, {
            "success": True,
            "booking_id": booking_id
        })

    except Exception as e:
        print("ERROR:", str(e))
        return response(500, {
            "success": False,
            "message": "Failed to create rental booking"
        })
