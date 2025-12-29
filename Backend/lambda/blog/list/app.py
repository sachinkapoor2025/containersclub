import json, os, boto3

table = boto3.resource("dynamodb").Table(os.environ["BLOG_TABLE"])

def handler(event, context):
    res = table.scan()

    # Sort newest first
    items = sorted(res["Items"], key=lambda x: x["ts"], reverse=True)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(items)
    }
