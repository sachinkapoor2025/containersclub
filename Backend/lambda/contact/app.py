import os, json, boto3

ses = boto3.client('ses')
TO_EMAIL = os.environ.get('TO_EMAIL', 'you@example.com')

def lambda_handler(event, context):
    try:
        body = json.loads(event.get('body') or '{}')
        name = body.get('name', '')
        email = body.get('email', '')
        company = body.get('company', '')
        role = body.get('role', '')
        message = body.get('message', '')
        subj = f"[IndChain] Contact form - {name}"
        text = f"Name: {name}\nEmail: {email}\nCompany: {company}\nRole: {role}\n\nMessage:\n{message}"
        ses.send_email(
            Source=TO_EMAIL,
            Destination={'ToAddresses':[TO_EMAIL]},
            Message={'Subject': {'Data': subj}, 'Body': {'Text': {'Data': text}}}
        )
        return {'statusCode': 200, 'headers': {"Content-Type":"application/json"}, 'body': json.dumps({'ok':True})}
    except Exception as e:
        return {'statusCode': 500, 'headers': {"Content-Type":"application/json"}, 'body': json.dumps({'ok':False,'error':str(e)})}
