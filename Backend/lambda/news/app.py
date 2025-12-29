import os
import json
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

TABLE = os.environ["NEWS_TABLE"]
dynamo = boto3.resource("dynamodb").Table(TABLE)

# Convert DynamoDB Decimals → int
def decimal_to_python(obj):
    if isinstance(obj, list):
        return [decimal_to_python(i) for i in obj]
    if isinstance(obj, dict):
        return {k: decimal_to_python(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj)  # your ts is always integer
    return obj


def lambda_handler(event, context):

    # Read latest 50
    resp = dynamo.query(
        KeyConditionExpression=Key("pk").eq("NEWS"),
        ScanIndexForward=False,
        Limit=50
    )

    items = resp.get("Items", [])

    # Convert Decimal objects
    items = decimal_to_python(items)

    # DO NOT double encode JSON — only encode once here
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
        },
        "body": json.dumps(items)   # clean JSON, NO slashes, NO escaping
    }
