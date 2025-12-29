import json, os, boto3

table = boto3.resource("dynamodb").Table(os.environ["BLOG_TABLE"])

def handler(event, context):
    params = event.get("queryStringParameters") or {}
    blog_id = params.get("id")

    res = table.get_item(Key={"id": blog_id, "ts": int(params.get("ts", 0))}) \
          if "ts" in params else None

    # If ts not provided → scan by id
    if not res or "Item" not in res:
        q = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key("id").eq(blog_id),
            ScanIndexForward=False,
            Limit=1
        )
        if q["Count"] == 0:
            return {"statusCode": 404, "body": "Not found"}
        item = q["Items"][0]
    else:
        item = res["Item"]

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(item)
    }
