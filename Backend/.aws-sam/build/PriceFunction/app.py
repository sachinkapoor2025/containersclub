# lambdas/price_lookup.py

import json
import os
import logging
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")

ONLOAD_TABLE_NAME = os.environ.get("ONLOAD_TABLE")
OFFLOAD_TABLE_NAME = os.environ.get("OFFLOAD_TABLE")


def _decimal_to_float(obj):
    """Recursively convert Decimal to float for JSON serialization."""
    if isinstance(obj, list):
        return [_decimal_to_float(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return float(obj)
    return obj


def lambda_handler(event, context):
    # 1. Log the raw event
    logger.info("==[PRICE LOOKUP] Lambda invoked ==")
    logger.info("Incoming event: %s", json.dumps(event))

    # 2. Parse body
    body = event.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            logger.error("Failed to parse event body as JSON: %s", body)
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": "Invalid JSON body"})
            }

    if not isinstance(body, dict):
        logger.error("Missing or invalid body: %s", body)
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Missing request body"})
        }

    logger.info("Parsed request body: %s", json.dumps(body))

    mode = (body.get("mode") or "onload").lower()
    route = (body.get("route") or "").strip()
    country = body.get("country")
    state = body.get("state")
    city = body.get("city")
    port = body.get("port")

    logger.info("Request summary -> mode=%s, route='%s', country=%s, state=%s, city=%s, port=%s",
                mode, route, country, state, city, port)

    # 3. Decide which table to use
    if mode == "onload":
        table_name = ONLOAD_TABLE_NAME
    elif mode == "offload":
        table_name = OFFLOAD_TABLE_NAME
    else:
        logger.error("Unsupported mode: %s", mode)
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": f"Unsupported mode '{mode}'"})
        }

    logger.info("Resolved DynamoDB table for mode '%s': %s", mode, table_name)

    if not table_name:
        logger.error("Table name for mode '%s' is not configured in environment", mode)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Server configuration error (missing table name)"})
        }

    if not route:
        logger.error("Route is empty. The frontend should send 'route'.")
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Missing 'route' in request"})
        }

    # 4. Query / get item from DynamoDB
    table = dynamodb.Table(table_name)

    logger.info("Attempting DynamoDB get_item with key: { route: '%s' }", route)

    try:
        resp = table.get_item(Key={"route": route})
    except Exception as e:
        logger.exception("DynamoDB get_item failed for route '%s': %s", route, e)
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "Failed to fetch prices"})
        }

    logger.info("Raw DynamoDB response: %s", json.dumps(_decimal_to_float(resp)))

    item = resp.get("Item")

    if not item:
        logger.info("No item found in table '%s' for route '%s'", table_name, route)
        options = []
    else:
        logger.info("Item found in table '%s' for route '%s': %s", table_name, route, json.dumps(_decimal_to_float(item)))

        # Either store a single option or an array of options in the item.
        # Here we build a single option from top-level attributes.
        option = {
            "carrier":      item.get("carrier", "Carrier"),
            "vehicle_type": item.get("vehicle_type", "Truck"),
            "price":        item.get("price"),
            "currency":     item.get("currency", "INR"),
            "transit_days": item.get("transit_days"),
            "notes":        item.get("notes", "")
        }

        options = [ _decimal_to_float(option) ]

    # 5. Final response
    logger.info("Final options to return to client: %s", json.dumps(options))

    # `onoff.js` understands either an array or { options: [...] }.
    # We'll return a plain array.
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",   # you can tighten this later
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        },
        "body": json.dumps(options)
    }
