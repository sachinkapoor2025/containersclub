def detect_intent(message: str) -> str:
    msg = message.lower()

    if "track" in msg:
        return "TRACK"
    if "rent" in msg:
        return "RENT"
    if "buy" in msg or "sell" in msg:
        return "BUY_SELL"
    if "insurance" in msg:
        return "INSURANCE"

    return "GENERAL"
