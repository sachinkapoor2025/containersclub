import os, json, uuid, boto3, time
table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])

def handler(event, context):
    try:
        body = json.loads(event.get('body') or '{}')
        listing = {
            'listingId': str(uuid.uuid4()),
            'title': body.get('title'),
            'size': body.get('size'),
            'condition': body.get('condition'),
            'location': body.get('location'),
            'description': body.get('description'),
            'specs': body.get('specs'),
            'images': body.get('images') or [],
            'video': body.get('video'),
            'dailyRate': body.get('dailyRate'),
            'availabilityFrom': body.get('availabilityFrom'),
            'createdAt': int(time.time())
        }
        table.put_item(Item=listing)
        return { 'statusCode': 200, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'ok': True, 'listing': listing }) }
    except Exception as e:
        return { 'statusCode': 400, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'error': str(e) }) }