import json

# ✅ FIXED IMPORTS (src is now a package)
from src.intent import detect_intent
from src.knowledge import fetch_knowledge
from src.prompt import build_prompt
from src.ai import ask_ai
from src.actions import decide_actions


def lambda_handler(event, context):
    try:
        # ✅ Handle OPTIONS preflight safely
        if event.get("httpMethod") == "OPTIONS":
            return response(200, {})

        # ✅ Safe body parsing (API Gateway compatible)
        body = event.get("body")

        if body and isinstance(body, str):
            body = json.loads(body)
        else:
            body = {}

        user_message = body.get("user_message", "").strip()
        site = body.get("site", "containerbazar")
        country = body.get("country", "IN")
        language = body.get("language", "en")

        if not user_message:
            return response(400, {"reply": "Please enter a message."})

        # 🧠 AI pipeline
        intent = detect_intent(user_message)
        knowledge = fetch_knowledge(user_message)

        # ✅ LANGUAGE + BRAND AWARE PROMPT
        prompt = build_prompt(
            user_message=user_message,
            intent=intent,
            knowledge=knowledge,
            site=site,
            country=country,
            language=language
        )

        ai_reply = ask_ai(prompt)

        # ✅ SITE-AWARE ACTIONS
        actions = decide_actions(intent, site)

        return response(200, {
            "reply": ai_reply,
            "actions": actions
        })

    except Exception as e:
        # ✅ Visible error in CloudWatch
        print("LAMBDA ERROR:", str(e))

        return response(500, {
            "reply": "Something went wrong. Please try again later."
        })


# ✅ Centralized CORS-safe response
def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS"
        },
        "body": json.dumps(body)
    }
