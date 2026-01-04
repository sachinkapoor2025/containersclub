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
    logger.info("===== LISTING HANDLER INVOCATION START =====")

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

        # Check HTTP method
        http_method = event.get("httpMethod", "POST")
        logger.info("HTTP METHOD: %s", http_method)

        # Get listing ID from path for updates
        path_parameters = event.get("pathParameters", {})
        listing_id = path_parameters.get("listingId")
        if http_method == "PUT" and not listing_id:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Listing ID required for updates"})
            }

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

        if http_method == "POST":
            # CREATE NEW LISTING
            logger.info("Creating new listing...")

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
                "status": "llm_review",  # Always start with LLM review
                "currency": body.get("currency", "USD"),
                "createdAt": datetime.utcnow().isoformat() + "Z",
                "ownerId": owner_id,
            }

            log(listing, "ITEM TO CREATE:")

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

        elif http_method == "PUT":
            # UPDATE EXISTING LISTING
            logger.info("Updating listing: %s", listing_id)

            # Verify ownership
            existing_item = table.get_item(Key={"listingId": listing_id})
            if "Item" not in existing_item:
                return {
                    "statusCode": 404,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "Listing not found"})
                }

            existing_listing = existing_item["Item"]
            if existing_listing.get("ownerId") != owner_id:
                return {
                    "statusCode": 403,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "Not authorized to update this listing"})
                }

            # Build update expression
            update_expression = "SET "
            expression_attribute_values = {}
            expression_attribute_names = {}

            update_fields = [
                "title", "size", "condition", "location", "description", "specs",
                "images", "video", "price", "pricePeriod", "deposit", "minRentalDuration",
                "availableFrom", "deliveryAvailable", "rentalTerms"
            ]

            updates = []
            for field in update_fields:
                if field in body:
                    updates.append(f"#{field} = :{field}")
                    expression_attribute_values[f":{field}"] = body[field]
                    expression_attribute_names[f"#{field}"] = field

            if not updates:
                return {
                    "statusCode": 400,
                    "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                    "body": json.dumps({"error": "No fields to update"})
                }

            update_expression += ", ".join(updates)

            # Update in DynamoDB
            response = table.update_item(
                Key={"listingId": listing_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_attribute_values,
                ExpressionAttributeNames=expression_attribute_names,
                ReturnValues="ALL_NEW"
            )

            log(response, "UPDATE RESPONSE:")

            logger.info("===== UPDATE LISTING SUCCESS =====")

            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": json.dumps({
                    "ok": True,
                    "listing": response.get("Attributes", {})
                }),
            }

    except Exception as e:
        logger.exception("LISTING HANDLER FAILED")

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
