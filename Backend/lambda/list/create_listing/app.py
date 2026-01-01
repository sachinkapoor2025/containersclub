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

        # 4️⃣ Build item
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
            "dailyRate": body.get("dailyRate"),
            "availabilityFrom": body.get("availabilityFrom"),
            "createdAt": int(time.time()),
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
