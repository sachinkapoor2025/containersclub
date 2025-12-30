import os, json, boto3
table = boto3.resource('dynamodb').Table(os.environ['TABLE_NAME'])

def handler(event, context):
    params = event.get('queryStringParameters') or {}
    q = (params.get('q') or '').lower()
    size = params.get('size') or ''
    condition = params.get('condition') or ''
    location = params.get('location') or ''

    items = table.scan().get('Items', [])
    def match(it):
        def g(k): return (it.get(k) or '').lower()
        ok = True
        if q:
            ok = q in g('title') or q in g('description') or q in g('specs') or q in g('location')
        if size and ok: ok = (it.get('size') == size)
        if condition and ok: ok = (it.get('condition') == condition)
        if location and ok: ok = (location.lower() in g('location'))
        return ok
    filtered = list(filter(match, items))
    return { 'statusCode': 200, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'items': filtered }) }