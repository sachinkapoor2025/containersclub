import json, os, boto3

table = boto3.resource("dynamodb").Table(os.environ["BLOG_TABLE"])

def handler(event, context):
    body = json.loads(event["body"])

    update_expr = []
    expr_attr = {}

    for field in ["title", "content", "coverUrl"]:
        if field in body and body[field] is not None:
            update_expr.append(f"{field} = :{field}")
            expr_attr[f":{field}"] = body[field]

    if not update_expr:
        return {"statusCode": 400, "body": "Nothing to update"}

    table.update_item(
        Key={"id": body["id"], "ts": body.get("ts")},
        UpdateExpression="SET " + ", ".join(update_expr),
        ExpressionAttributeValues=expr_attr
    )

    return {
        "statusCode": 200,
        "body": json.dumps({"success": True})
    }
