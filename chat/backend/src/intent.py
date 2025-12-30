def detect_intent(message: str) -> str:
    msg = message.lower()

    if any(k in msg for k in ["track", "tracking", "location", "where is my container"]):
        return "TRACK"

    if any(k in msg for k in ["rent", "rental", "lease", "leasing"]):
        return "RENT"

    if any(k in msg for k in ["buy", "sell", "purchase", "sale"]):
        return "BUY_SELL"

    if any(k in msg for k in ["insurance", "insured", "coverage", "policy"]):
        return "INSURANCE"

    return "GENERAL"
