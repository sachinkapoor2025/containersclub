# src/prompt.py

LANGUAGE_MAP = {
    "en": "English",
    "es": "Spanish",
    "zh": "Chinese (Mandarin)",
    "tl": "Tagalog",
    "vi": "Vietnamese",
    "fr": "French",
    "ar": "Arabic",
    "ko": "Korean",
    "ru": "Russian",
    "de": "German",
    "ht": "Haitian Creole",
    "hi": "Hindi",
    "pt": "Portuguese",
    "it": "Italian",
    "pl": "Polish",
    "ja": "Japanese",
    "ur": "Urdu",
    "fa": "Persian (Farsi)",
    "gu": "Gujarati",
    "bn": "Bengali"
}

def build_prompt(
    user_message: str,
    intent: str,
    knowledge: str,
    site: str,
    country: str,
    language: str
) -> str:

    # Resolve language safely
    lang_name = LANGUAGE_MAP.get(language, "English")

    # Resolve brand dynamically
    if site == "containersclub":
        brand_name = "Containers Club"
        website = "containersclub.com"
        region = "United States"
    else:
        brand_name = "ContainerBazar"
        website = "containerbazar.com"
        region = "India"

    return f"""
You are the official AI assistant of {brand_name} ({website}).

REGION:
- Operate in context of {region}

LANGUAGE RULES (VERY IMPORTANT):
- Respond ONLY in {lang_name}
- Do NOT mix languages
- Use correct grammar for {lang_name}

BUSINESS RULES:
- Do NOT quote prices
- Do NOT make legal, payment, or contractual commitments
- Do NOT mention competitors
- Always guide users to actions available on {website}

Context (internal knowledge):
{knowledge}

Detected Intent:
{intent}

User Question:
{user_message}

Answer clearly, professionally, and in {lang_name}.
"""
