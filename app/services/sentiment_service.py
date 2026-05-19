"""
Sentiment Analysis Service — Ollama Local
Phân tích cảm xúc bài viết bằng model local qwen3:0.6b qua Ollama.
Fallback về rule-based nếu Ollama không khả dụng.
"""
import logging
import httpx
import random
import os
from typing import Tuple, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Global State for Local Qwen LoRA ──────────────────────────
_QWEN_MODEL = None
_QWEN_TOKENIZER = None

# ── Rule-based fallback ───────────────────────────────────────

POSITIVE_KEYWORDS = {
    "vui", "hạnh phúc", "tuyệt", "tuyệt vời", "yêu", "thích", "tốt",
    "hay", "đẹp", "xinh", "cười", "haha", "hehe", "ổn", "oke", "ok",
    "thành công", "hoàn hảo", "phấn khích", "tự hào", "hy vọng", "yêu đời",
    "vui vẻ", "hài lòng", "biết ơn", "cảm ơn", "wonderful", "amazing",
    "happy", "love", "great", "good", "nice", "awesome", "excellent",
    "fantastic", "joy", "excited", "glad", "cheerful", "positive",
}

NEGATIVE_KEYWORDS = {
    "buồn", "chán", "tệ", "khóc", "đau", "mệt", "stress", "áp lực",
    "thất bại", "khó", "ghét", "sợ", "lo", "lo lắng", "tức", "giận",
    "cô đơn", "nhớ", "tiếc", "thất vọng", "bực", "khổ", "tuyệt vọng",
    "không ổn", "chán nản", "mệt mỏi", "đau khổ",
    "trống rỗng", "vô cảm", "không cảm thấy gì", "lạc lõng", "một mình", 
    "không vui", "không cảm xúc", "vô hồn", "tẻ nhạt",
    "sad", "hate", "bad", "terrible", "awful", "depressed", "lonely",
    "angry", "frustrated", "anxious", "stressed", "tired", "exhausted",
    "miserable", "unhappy", "disappointed", "hopeless", "upset",
}


def _rule_based_sentiment(content: str) -> Tuple[str, float]:
    logger.info("🔥 RULE-BASED CALLED")
    text = content.lower()
    # Sử dụng substring matching thay vì set intersection để hỗ trợ các cụm từ đa từ
    pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
    neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)

    total = pos + neg
    if total == 0:
        return "neutral", 0.5
    if pos > neg:
        # Nâng cấp confidence: 0.4 -> 0.7 dựa trên heuristic
        confidence = round(0.4 + (pos / total) * 0.3, 2)
        return "positive", confidence
    if neg > pos:
        confidence = round(0.4 + (neg / total) * 0.3, 2)
        return "negative", confidence
    return "neutral", 0.5


# ── Ollama Local API ─────────────────────────────────────────

# Prompt chuẩn cho Ollama/Qwen: Ép model trả về đúng 1 từ, không giải thích.
# Sử dụng .replace('"', "'") để tránh lỗi JSON khi nội dung có dấu nháy kép.
STRICT_OLLAMA_PROMPT = """Return ONLY ONE WORD: positive or negative or neutral.
No explanation. No extra text.
Consider emotional meaning in Vietnamese sentences, not just word matching.
Focus on context like silent sadness, loneliness, or emptiness.

Text: "{content}" """


async def _qwen_lora_sentiment(content: str):
    """
    Inference sử dụng mô hình Qwen đã fine-tune LoRA load cục bộ (GPU/CPU).
    Nếu không có trọng số hoặc thiếu thư viện, trả về None để fallback sang Ollama.
    """
    global _QWEN_MODEL, _QWEN_TOKENIZER
    logger.info("🔥 QWEN LORA CALLED")

    try:
        # Nếu nội dung quá ngắn, không cần gọi LLM, trả về neutral
        if not content or len(content.strip()) < 2:
            logger.info("Qwen LoRA skipped: content too short")
            return "neutral", 0.5

        # Đường dẫn tới thư mục chứa LoRA adapter weights
        adapter_path = getattr(settings, "qwen_lora_path", "model_weights/qwen-sentiment-adapter")
        if not os.path.exists(adapter_path):
            logger.info(f"Qwen LoRA skipped: path {adapter_path} not found")
            return None

        # Lazy load model và tokenizer
        if _QWEN_MODEL is None:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer
            from peft import PeftModel
            logger.info(f"Loading Local Qwen-LoRA from {adapter_path}...")
            base_model_name = "Qwen/Qwen2.5-0.5B-Instruct"
            _QWEN_TOKENIZER = AutoTokenizer.from_pretrained(base_model_name)
            base_model = AutoModelForCausalLM.from_pretrained(
                base_model_name,
                torch_dtype="auto",
                device_map="auto"
            )
            _QWEN_MODEL = PeftModel.from_pretrained(base_model, adapter_path)
            _QWEN_MODEL.eval()

        import torch
        prompt = STRICT_OLLAMA_PROMPT.format(content=content[:500].replace('"', "'"))
        inputs = _QWEN_TOKENIZER(prompt, return_tensors="pt").to(_QWEN_MODEL.device)

        with torch.no_grad():
            outputs = _QWEN_MODEL.generate(
                **inputs, 
                max_new_tokens=10, 
                temperature=0.1,
                pad_token_id=_QWEN_TOKENIZER.eos_token_id
            )
        
        decoded = _QWEN_TOKENIZER.decode(outputs[0], skip_special_tokens=True)
        # Clean output & Classifier Logic: Trích xuất nhãn chính xác
        raw_res = decoded.replace(prompt, "").strip().lower()

        if "positive" in raw_res:
            return "positive", round(random.uniform(0.75, 0.95), 2)
        elif "negative" in raw_res:
            return "negative", round(random.uniform(0.75, 0.95), 2)
        elif "neutral" in raw_res:
            return "neutral", 0.5
        
        return "neutral", 0.5

    except Exception as e:
        logger.info(f"Qwen LoRA skipped: Local inference not available: {e}")
        return None


async def _ollama_sentiment(content: str) -> Optional[Tuple[str, float]]:
    """
    Gọi Ollama local để phân tích sentiment.
    Sử dụng model từ settings và endpoint /api/generate.
    """
    logger.info("🔥 OLLAMA CALLED")
    if not content or len(content.strip()) < 2:
        return "neutral", 0.5

    url = f"{settings.ollama_url.rstrip('/')}/api/generate" # Sử dụng endpoint /api/generate
    payload = {
        "model": settings.ollama_model,
        "prompt": STRICT_OLLAMA_PROMPT.format(content=content[:800].replace('"', "'")), # Sử dụng prompt chuẩn
        "temperature": 0.1,
        "stream": False,  # Trả về kết quả duy nhất, không stream
    }

    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        logger.exception("OLLAMA ERROR FULL TRACE")
        return None

    # Classifier Logic: Trích xuất từ khóa chính xác từ output dơ
    raw_sentiment = data.get("response", "").strip().lower()
    
    if "positive" in raw_sentiment:
        return "positive", round(random.uniform(0.75, 0.95), 2)
    elif "negative" in raw_sentiment:
        return "negative", round(random.uniform(0.75, 0.95), 2)

    return "neutral", 0.5


# ── Public API ────────────────────────────────────────────────

async def analyze_sentiment(content: str) -> Tuple[str, float]:
    """
    Phân tích sentiment. Ưu tiên Ollama local, fallback rule-based.
    Luồng xử lý: Qwen-LoRA fine-tuned -> Ollama API -> Rule-based fallback.
    Trả về (sentiment, confidence).
    """
    # 1. Ưu tiên sử dụng mô hình fine-tuned Qwen LoRA (Local Inference)
    qwen_res = await _qwen_lora_sentiment(content)
    if qwen_res:
        return qwen_res

    # 2. Sử dụng Ollama API hiện tại
    ollama_res = await _ollama_sentiment(content)
    if ollama_res:
        return ollama_res

    # 3. Cuối cùng là Rule-based nếu các mô hình AI không khả dụng
    return _rule_based_sentiment(content)


async def update_user_sentiment_profile(
    db: AsyncIOMotorDatabase, user_id: str
) -> str:
    """
    Tính lại sentiment_profile của user dựa trên 10 bài viết gần nhất.
    Weighted: bài mới hơn có trọng số cao hơn.
    """
    oid = ObjectId(user_id)
    cursor = db.posts.find(
        {
            "user_id": oid, 
            "$or": [{"sentiment": {"$ne": None}}, {"sentiment_score": {"$ne": None}}]
        }
    ).sort("created_at", -1).limit(10)
    recent_posts = await cursor.to_list(length=10)

    if not recent_posts:
        return "neutral"

    # Weighted sum: bài mới nhất trọng số 10, cũ nhất trọng số 1
    counts = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    total_posts = len(recent_posts)
    for i, post in enumerate(recent_posts):
        score = (post.get("sentiment") or "neutral").lower()
        weight = (total_posts - i)              # newest = highest weight
        confidence = post.get("sentiment_confidence", 0.5) or 0.5
        counts[score] = counts.get(score, 0.0) + weight * confidence

    dominant = max(counts, key=counts.get)
    await db.users.update_one(
        {"_id": oid},
        {"$set": {"sentiment_profile": dominant}}
    )
    return dominant
