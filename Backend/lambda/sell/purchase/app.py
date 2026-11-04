import json
import os
import uuid
import time
import boto3

# AWS clients
dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")

# Environment variables
TABLE_NAME = os.environ["BOOKINGS_TABLE"]
TOPIC_ARN = os.environ["NOTIFY_TOPIC_ARN"]

table = dynamodb.Table(TABLE_NAME)

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
    # ---- REST + HTTP API safe method detection ----
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")

    if method == "OPTIONS":
        return response(200)

    try:
        if not event.get("body"):
            return response(400, {
                "success": False,
                "message": "Missing request body"
            })

        data = json.loads(event["body"])

        # ---- Normalize address (frontend-safe) ----
        address = (
            data.get("address")
            or ", ".join(filter(None, [
                data.get("street"),
                data.get("city"),
                data.get("state"),
                data.get("zip"),
                data.get("pincode")
            ]))
        )

        # ---- Validate required fields ----
        required = {
            "listingId": data.get("listingId"),
            "name": data.get("name"),
            "email": data.get("email"),
            "address": address,
        }

        for field, value in required.items():
            if not value:
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
            "delivery_address": address,
            "location": data.get("location"),
            "price": data.get("total"),
            "notes": data.get("notes"),
            "created_at": now
        }

        # ---- Save purchase ----
        table.put_item(Item=item)

        # ---- Notify via SNS ----
        sns.publish(
            TopicArn=TOPIC_ARN,
            Subject="New SELL Purchase | ContainersClub",
            Message=f"""
NEW SELL PURCHASE RECEIVED

Purchase ID: {purchase_id}
Name: {data.get('name')}
Email: {data.get('email')}
Phone: {data.get('phone')}
Delivery Address: {address}
Location: {data.get('location')}
Amount: {data.get('total')}

Customer Confirmation:
Thank you for purchasing from ContainersClub.
Our representative will contact you shortly.
"""
        )

        return response(200, {
            "success": True,
            "purchase_id": purchase_id
        })

    except Exception as e:
        print("SELL PURCHASE ERROR:", str(e))
        return response(500, {
            "success": False,
            "message": "Failed to complete purchase"
        })
