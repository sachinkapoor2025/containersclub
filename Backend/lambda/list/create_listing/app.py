import os
import json
import uuid
import boto3
import time
import logging

# ---------- Logging setup ----------
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def log(obj, label=""):
    try:
        logger.info("%s %s", label, json.dumps(obj, default=str))
    except Exception:
        logger.info("%s %s", label, str(obj))

# ---------- DynamoDB ----------
TABLE_NAME = os.environ.get("TABLE_NAME")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)


def handler(event, context):
    logger.info("===== CREATE LISTING INVOCATION START =====")

    # 1️⃣ Log raw event
    log(event, "RAW EVENT:")

    # 2️⃣ Log env
    logger.info("TABLE_NAME env: %s", TABLE_NAME)

    try:
        # 3️⃣ Parse body
        raw_body = event.get("body")
        logger.info("RAW BODY: %s", raw_body)

        body = json.loads(raw_body or "{}")
        log(body, "PARSED BODY:")

        # 4️⃣ Get owner ID from JWT
        auth_header = event.get("headers", {}).get("Authorization") or event.get("headers", {}).get("authorization")
        owner_id = None
        if auth_header and auth_header.startswith("Bearer "):
            try:
                token = auth_header.split(" ")[1]
                import jwt
                decoded = jwt.decode(token, options={"verify_signature": False})
                owner_id = decoded.get("sub") or decoded.get("username")
            except Exception as e:
                logger.warning("Failed to decode JWT: %s", str(e))

        # 4️⃣ Build item
        from datetime import datetime
        listing = {
            "listingId": str(uuid.uuid4()),
            "title": body.get("title"),
            "size": body.get("size"),
            "condition": body.get("condition"),
            "location": body.get("location"),
            "description": body.get("description"),
            "specs": body.get("specs"),
            "images": body.get("images") or [],
            "video": body.get("video"),
            "price": body.get("price"),
            "pricePeriod": body.get("pricePeriod"),
            "deposit": body.get("deposit"),
            "minRentalDuration": body.get("minRentalDuration"),
            "availableFrom": body.get("availableFrom"),
            "deliveryAvailable": body.get("deliveryAvailable", False),
            "rentalTerms": body.get("rentalTerms"),
            "status": body.get("status", "active"),
            "currency": body.get("currency", "USD"),
            "createdAt": datetime.utcnow().isoformat() + "Z",
            "ownerId": owner_id,
        }

        log(listing, "ITEM TO WRITE:")

        # 5️⃣ Write to DynamoDB
        response = table.put_item(Item=listing)

        log(response, "DYNAMODB PUT RESPONSE:")

        logger.info("===== CREATE LISTING SUCCESS =====")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "ok": True,
                "listingId": listing["listingId"]
            }),
        }

    except Exception as e:
        logger.exception("CREATE LISTING FAILED")

        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({
                "ok": False,
                "error": str(e),
            }),
        }
