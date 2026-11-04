import os, json, boto3, uuid
s3 = boto3.client('s3')
BUCKET = os.environ['BUCKET_NAME']

def handler(event, context):
    try:
        body = json.loads(event.get('body') or '{}')
        
        # Handle multiple files
        if 'files' in body:
            urls = []
            public_urls = []
            for file_info in body['files']:
                filename = file_info.get('fileName') or str(uuid.uuid4())
                contentType = file_info.get('contentType') or 'application/octet-stream'
                key = f"rent-media/{uuid.uuid4()}-{filename}"
                url = s3.generate_presigned_url('put_object', Params={'Bucket': BUCKET, 'Key': key, 'ContentType': contentType}, ExpiresIn=3600)
                public_url = f"https://{BUCKET}.s3.amazonaws.com/{key}"
                urls.append(url)
                public_urls.append(public_url)
            return { 'statusCode': 200, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'urls': urls, 'publicUrls': public_urls }) }
        else:
            # Handle single file
            filename = body.get('filename') or str(uuid.uuid4())
            contentType = body.get('contentType') or 'application/octet-stream'
            key = f"rent-media/{uuid.uuid4()}-{filename}"
            url = s3.generate_presigned_url('put_object', Params={'Bucket': BUCKET, 'Key': key, 'ContentType': contentType}, ExpiresIn=3600)
            public_url = f"https://{BUCKET}.s3.amazonaws.com/{key}"
            return { 'statusCode': 200, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'uploadUrl': url, 'publicUrl': public_url }) }
    except Exception as e:
        return { 'statusCode': 400, 'headers': { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, 'body': json.dumps({ 'error': str(e) }) }
