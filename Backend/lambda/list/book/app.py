import json
import os
import uuid
import time
import boto3

# AWS clients
dynamodb = boto3.resource("dynamodb")
sns = boto3.client("sns")

# Environment variables (MUST be set in SAM)
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

        # ---- Normalize dates (frontend-safe) ----
        from_date = (
            data.get("fromDate")
            or data.get("from")
            or data.get("requiredFrom")
            or data.get("startDate")
        )

        to_date = (
            data.get("toDate")
            or data.get("to")
            or data.get("requiredTill")
            or data.get("endDate")
        )

        # ---- Validate required fields ----
        required = {
            "listingId": data.get("listingId"),
            "name": data.get("name"),
            "email": data.get("email"),
            "fromDate": from_date,
            "toDate": to_date,
        }

        for field, value in required.items():
            if not value:
                return response(400, {
                    "success": False,
                    "message": f"Missing required field: {field}"
                })

        booking_id = f"rent-{uuid.uuid4()}"
        now = int(time.time())

        item = {
            "booking_id": booking_id,
            "service": "rent",
            "listing_id": data["listingId"],
            "customer": {
                "name": data.get("name"),
                "email": data.get("email"),
                "phone": data.get("phone")
            },
            "dates": {
                "from": from_date,
                "to": to_date
            },
            "location": data.get("location"),
            "price": data.get("total"),
            "notes": data.get("notes"),
            "created_at": now
        }

        # ---- Save booking ----
        table.put_item(Item=item)

        # ---- Notify via SNS (Admin + Customer info) ----
        sns.publish(
            TopicArn=TOPIC_ARN,
            Subject="New RENT Booking | ContainersClub",
            Message=f"""
NEW RENT BOOKING RECEIVED

Booking ID: {booking_id}
Name: {data.get('name')}
Email: {data.get('email')}
Phone: {data.get('phone')}
From: {from_date}
To: {to_date}
Location: {data.get('location')}
Amount: {data.get('total')}

Customer Confirmation:
Thank you for booking with ContainersClub.
Our representative will contact you shortly.
"""
        )

        return response(200, {
            "success": True,
            "booking_id": booking_id
        })

    except Exception as e:
        print("RENT BOOKING ERROR:", str(e))
        return response(500, {
            "success": False,
            "message": "Failed to create rental booking"
        })
