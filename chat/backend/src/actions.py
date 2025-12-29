# src/actions.py

def decide_actions(intent: str, site: str):
    """
    Decide frontend actions based on intent and site
    """

    # Base paths are relative (frontend knows domain)
    if intent == "RENT":
        return {"redirect": "/rent/index.html"}

    if intent == "SELL":
        return {"redirect": "/sell/index.html"}

    if intent == "TRACK":
        return {"redirect": "/track/index.html"}

    if intent == "INSURANCE":
        return {"redirect": "/insurance/index.html"}

    # Default: no action
    return {}
