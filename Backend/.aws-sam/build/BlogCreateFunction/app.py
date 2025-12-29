import json, time, uuid, os
import boto3

table = boto3.resource("dynamodb").Table(os.environ["BLOG_TABLE"])

def handler(event, context):
    body = json.loads(event["body"])

    item = {
        "id": str(uuid.uuid4()),
        "ts": int(time.time()),
        "title": body["title"],
        "content": body["content"],
        "coverUrl": body.get("coverUrl", ""),
    }

    table.put_item(Item=item)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"id": item["id"]})
    }
