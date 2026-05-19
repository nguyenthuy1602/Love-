import requests
from app.core.config import settings

OLLAMA_URL = f"{settings.ollama_url.rstrip('/')}/api/generate"
OLLAMA_MODEL = settings.ollama_model

def analyze_sentiment(text: str):
    prompt = f"""
Phân tích cảm xúc đoạn văn sau.

Chỉ trả về đúng 1 từ:
positive
negative
neutral

Text: {text}
"""

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }
    )

    result = response.json()["response"].strip().lower()

    if "positive" in result:
        return "positive"

    if "negative" in result:
        return "negative"

    return "neutral"