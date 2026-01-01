import os, json, boto3, uuid
s3 = boto3.client('s3')
BUCKET = os.environ['BUCKET_NAME']

def handler(event, context):
    try:
        body = json.loads(event.get('body') or '{}')
        filename = body.get('filename') or str(uuid.uuid4())
        contentType = body.get('contentType') or 'application/octet-stream'
        key = f"sell-media/{uuid.uuid4()}-{filename}"
        url = s3.generate_presigned_url('put_object', Params={'Bucket': BUCKET, 'Key': key, 'ContentType': contentType}, ExpiresIn=3600)
        public_url = f"https://{BUCKET}.s3.amazonaws.com/{key}"
        return { 'statusCode': 200, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'uploadUrl': url, 'publicUrl': public_url }) }
    except Exception as e:
        return { 'statusCode': 400, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'error': str(e) }) }
