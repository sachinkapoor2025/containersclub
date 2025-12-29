import os, json, uuid, boto3
from datetime import datetime
TABLE=os.environ["BOOKINGS_TABLE"]; ddb=boto3.resource("dynamodb").Table(TABLE)
def lambda_handler(event,context):
    body=json.loads(event.get("body") or "{}")
    booking_id=str(uuid.uuid4())[:12]
    item={"booking_id":booking_id,"created_at":datetime.utcnow().isoformat()+"Z","form":body.get("form",{}),
          "selection":body.get("selection",{}),"status":"NEW"}
    ddb.put_item(Item=item)
    return {"statusCode":200,"headers":{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"},
            "body":json.dumps({"booking_id":booking_id})}