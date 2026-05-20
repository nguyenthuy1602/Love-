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
    "cuối cùng cũng mỉm cười thật lòng", "mọi giông bão rồi cũng qua",
    "sau tất cả mình vẫn ổn", "tôi thấy lòng nhẹ nhõm hơn",
    "ánh sáng cuối đường hầm", "mọi nỗ lực đều xứng đáng",
    "tôi đã vượt qua chính mình", "bình yên đến lạ",
    "trái tim hôm nay thật ấm áp", "cuộc sống vẫn dịu dàng với tôi",
    "tôi học được cách yêu bản thân", "dù khó khăn nhưng tôi vẫn tin",
    "một ngày dài nhưng đầy ý nghĩa", "cuối cùng cũng tìm thấy hy vọng",
    "nụ cười hôm nay là thật", "tôi cảm thấy được chữa lành",
    "mọi chuyện rồi sẽ tốt hơn", "tôi không còn sợ ngày mai",
    "thật may vì mình chưa bỏ cuộc", "tôi thấy biết ơn vì vẫn còn ở đây",
    "dù rất khó khăn nhưng mình vẫn tin vào ngày mai", "sau tất cả, mình vẫn chọn mỉm cười",
    "mọi giông bão rồi cũng sẽ qua", "có mệt mỏi, nhưng mình chưa từng muốn bỏ cuộc",
    "hôm nay chưa tốt, nhưng ngày mai có thể khác", "cuối cùng mình cũng thấy ánh sáng ở cuối đường hầm",
    "tôi đã đi qua những ngày tồi tệ nhất", "dù nhiều lần gục ngã, mình vẫn đứng dậy",
    "không dễ dàng, nhưng mọi nỗ lực đều xứng đáng", "tôi thấy lòng nhẹ nhõm hơn sau tất cả",
    "mình không hoàn hảo, nhưng đang tốt lên từng ngày", "cuộc sống vẫn dịu dàng với mình",
    "tôi học được cách yêu bản thân hơn",
}

NEGATIVE_KEYWORDS = {
    "buồn", "chán", "tệ", "khóc", "đau", "mệt", "stress", "áp lực",
    "thất bại", "khó", "ghét", "sợ", "lo", "lo lắng", "tức", "giận",
    "cô đơn", "nhớ", "tiếc", "thất vọng", "bực", "khổ", "tuyệt vọng",
    "không ổn", "chán nản", "mệt mỏi", "đau khổ",
    "trống rỗng", "vô cảm", "không cảm thấy gì", "lạc lõng", "một mình", 
    "không vui", "không cảm xúc", "vô hồn", "tẻ nhạt",
    "chẳng vui", "cười nhưng không vui", "cười rất nhiều nhưng trong lòng lại chẳng vui",
    "giả vờ ổn", "ổn nhưng không ổn", "cố tỏ ra ổn",
    "sad", "hate", "bad", "terrible", "awful", "depressed", "lonely",
    "angry", "frustrated", "anxious", "stressed", "tired", "exhausted",
    "miserable", "unhappy", "disappointed", "hopeless", "upset",
    "nụ cười không còn ý nghĩa",
    "chẳng biết để làm gì",
    "không biết để làm gì",
    "mọi thứ đều ổn, ngoại trừ tôi", "không sao đâu, tôi quen rồi",
    "giữa rất nhiều người nhưng vẫn thấy lạc lõng", "bề ngoài bình yên nhưng bên trong đã vỡ vụn",
    "tôi nói mình ổn vì không muốn ai lo", "có những ngày chẳng còn thiết tha điều gì",
    "không đau, chỉ là không còn cảm xúc nữa", "mình vẫn ở đây, nhưng không biết để làm gì",
    "đêm nào cũng thức nhưng chẳng biết để làm gì",
}

NEUTRAL_KEYWORDS = {
    "hôm nay cũng như mọi ngày", "một ngày dài vừa kết thúc", "đêm nay tôi vẫn thức",
    "tôi đang nhìn ra ngoài cửa sổ", "đồng hồ vừa điểm 12 giờ", "trời bắt đầu tối",
    "tôi ngồi yên một lúc", "mọi thứ vẫn tiếp diễn", "một tuần nữa lại trôi qua",
    "căn phòng vẫn sáng đèn", "tôi đang sắp xếp lại suy nghĩ", "tôi vừa đóng máy tính",
    "không có gì thay đổi", "tôi vẫn ở đây", "thêm một ngày nữa",
    "tôi vừa hoàn thành công việc", "ngoài trời đang mưa", "tôi mở cửa sổ ra",
    "tôi đang nghe tiếng mưa", "đêm nay khá yên tĩnh",
    "một ngày nữa lại trôi qua",
}


def _rule_based_sentiment(content: str) -> Tuple[str, float]:
    logger.info("🔥 RULE-BASED CALLED")
    text = content.lower()
    # Sử dụng substring matching thay vì set intersection để hỗ trợ các cụm từ đa từ
    pos = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
    neg = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)
    neu = sum(1 for kw in NEUTRAL_KEYWORDS if kw in text)

    # Ưu tiên trung tính nếu các mẫu neutral xuất hiện rõ rệt
    if neu > pos and neu > neg:
        return "neutral", 0.6

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

Examples:

# ===== POSITIVE =====
Text: "Dù rất khó khăn nhưng mình vẫn tin vào ngày mai."
Sentiment: positive

Text: "Hôm nay mệt nhưng mình vẫn hy vọng mọi chuyện sẽ ổn."
Sentiment: positive

Text: "Thất bại không sao, mình sẽ cố gắng tiếp."
Sentiment: positive

Text: "Mình đã khóc rất nhiều nhưng cuối cùng vẫn đứng dậy."
Sentiment: positive

Text: "Con đường phía trước còn dài nhưng mình vẫn lạc quan."
Sentiment: positive

Text: "Có lúc muốn bỏ cuộc nhưng mình biết rồi sẽ tốt hơn."
Sentiment: positive

Text: "Dù bị tổn thương nhưng mình vẫn chọn yêu thương."
Sentiment: positive

Text: "Ngày hôm nay chưa tốt nhưng ngày mai sẽ khác."
Sentiment: positive

Text: "Mình tin mọi chuyện rồi sẽ ổn thôi."
Sentiment: positive

Text: "Mệt thật nhưng mình vẫn còn động lực."
Sentiment: positive

Text: "Từng thất bại nhưng mình không bỏ cuộc."
Sentiment: positive

Text: "Mưa rồi cũng tạnh, lòng mình rồi cũng sáng."
Sentiment: positive

Text: "Mình vẫn mỉm cười vì biết phía trước còn hy vọng."
Sentiment: positive

Text: "Khó khăn chỉ là tạm thời."
Sentiment: positive

Text: "Hôm nay chưa ổn nhưng mình vẫn đang cố gắng."
Sentiment: positive

Text: "Mình tin bản thân sẽ làm được."
Sentiment: positive

Text: "Chậm một chút cũng không sao, miễn là vẫn tiến lên."
Sentiment: positive

Text: "Cuộc sống có lúc mệt mỏi nhưng vẫn rất đáng để cố gắng."
Sentiment: positive

Text: "Mình biết sẽ có ngày mọi thứ tốt đẹp hơn."
Sentiment: positive

Text: "Dẫu cô đơn nhưng mình chưa từng mất hy vọng."
Sentiment: positive


# ===== NEGATIVE =====
Text: "Tôi cảm thấy trống rỗng và chẳng còn muốn nói chuyện với ai."
Sentiment: negative

Text: "Mình vẫn cười nhưng trong lòng rất cô đơn."
Sentiment: negative

Text: "Đêm nào cũng thức nhưng chẳng biết để làm gì."
Sentiment: negative

Text: "Tôi vẫn ổn, chỉ là không còn cảm thấy gì nữa."
Sentiment: negative

Text: "Nụ cười vẫn còn nhưng ý nghĩa đã mất."
Sentiment: negative

Text: "Mọi thứ xung quanh trở nên vô nghĩa."
Sentiment: negative

Text: "Mình mệt quá và không muốn cố thêm nữa."
Sentiment: negative

Text: "Càng đông người, mình càng thấy lạc lõng."
Sentiment: negative

Text: "Không hiểu vì sao nhưng lòng nặng trĩu."
Sentiment: negative

Text: "Mình thấy bản thân thật vô dụng."
Sentiment: negative

Text: "Tôi chẳng còn niềm vui nào nữa."
Sentiment: negative

Text: "Cả ngày chỉ muốn nằm yên và không làm gì."
Sentiment: negative

Text: "Mọi cố gắng đều trở nên vô nghĩa."
Sentiment: negative

Text: "Mình không biết phải tiếp tục thế nào."
Sentiment: negative

Text: "Tiếng cười chỉ để che giấu nỗi buồn."
Sentiment: negative

Text: "Tôi cảm thấy bị bỏ lại phía sau."
Sentiment: negative

Text: "Trong lòng chỉ còn lại sự mệt mỏi."
Sentiment: negative

Text: "Mình không còn tin vào điều gì nữa."
Sentiment: negative

Text: "Có những ngày chỉ thấy toàn màu xám."
Sentiment: negative

Text: "Mình cô đơn ngay cả khi ở giữa đám đông."
Sentiment: negative


# ===== NEUTRAL =====
Text: "Hôm nay mình đi học như bình thường."
Sentiment: neutral

Text: "Trời khá đẹp và mình đang ngồi uống cà phê."
Sentiment: neutral

Text: "Mình vừa ăn tối xong và chuẩn bị đi ngủ."
Sentiment: neutral

Text: "Cuối tuần này mình sẽ về thăm gia đình."
Sentiment: neutral

Text: "Hôm nay khá bận nhưng mọi việc vẫn diễn ra bình thường."
Sentiment: neutral

Text: "Mình đang chờ xe buýt."
Sentiment: neutral

Text: "Tối nay có thể trời sẽ mưa."
Sentiment: neutral

Text: "Mình vừa hoàn thành bài tập."
Sentiment: neutral

Text: "Ngày mai mình có lịch họp."
Sentiment: neutral

Text: "Buổi sáng mình uống một ly cà phê."
Sentiment: neutral

Text: "Hôm nay mình dậy lúc 6 giờ."
Sentiment: neutral

Text: "Mình đang nghe nhạc."
Sentiment: neutral

Text: "Chiều nay mình đi siêu thị."
Sentiment: neutral

Text: "Tôi vừa cập nhật hồ sơ cá nhân."
Sentiment: neutral

Text: "Cuộc họp bắt đầu lúc 8 giờ."
Sentiment: neutral

Text: "Mình đã gửi email xong."
Sentiment: neutral

Text: "Hôm nay thời tiết mát mẻ."
Sentiment: neutral

Text: "Mình đang đọc sách."
Sentiment: neutral

Text: "Bữa tối nay có cơm và canh."
Sentiment: neutral

Text: "Tôi chuẩn bị đi ngủ."
Sentiment: neutral

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

NEGATIVE_PATTERNS = [
    "chẳng vui",
    "không vui",
    "cười rất nhiều nhưng trong lòng lại chẳng vui",
    "cười nhưng không vui",
    "giả vờ ổn",
    "ổn nhưng không ổn",
    "cố tỏ ra ổn",
    "trống rỗng",
    "cô đơn",
    "một mình",
    "không ổn",
    "nụ cười không còn ý nghĩa",
    "tôi vẫn cười nhưng nụ cười không còn ý nghĩa",
    "tôi vẫn cười, nhưng nụ cười không còn ý nghĩa",
    "đêm nào cũng thức nhưng chẳng biết để làm gì",
    "đêm nào cũng thức nhưng không biết để làm gì",
    "chẳng biết để làm gì",
    "không biết để làm gì",
    "mọi thứ đều ổn, ngoại trừ tôi",
    "không sao đâu, tôi quen rồi",
    "giữa rất nhiều người nhưng vẫn thấy lạc lõng",
    "bề ngoài bình yên nhưng bên trong đã vỡ vụn",
    "tôi nói mình ổn vì không muốn ai lo",
    "có những ngày chẳng còn thiết tha điều gì",
    "không đau, chỉ là không còn cảm xúc nữa",
    "mình vẫn ở đây, nhưng không biết để làm gì",
]

def rule_based_override(text: str, predicted: str):
    text = text.lower()
    for pattern in NEGATIVE_PATTERNS:
        if pattern in text:
            return "negative", 0.95
    return predicted, None

async def analyze_sentiment(content: str) -> Tuple[str, float]:
    """
    Phân tích sentiment.
    Thứ tự:
    1. Rule-based override cho các mẫu tiêu cực rõ ràng.
    2. Qwen LoRA.
    3. Ollama.
    4. Rule-based fallback.
    """

    # 1. Ưu tiên bắt các mẫu tiêu cực đặc biệt
    forced_label, forced_conf = rule_based_override(content, "neutral")
    if forced_conf is not None:
        return forced_label, forced_conf

    # 2. Qwen LoRA
    qwen_res = await _qwen_lora_sentiment(content)
    if qwen_res:
        label, confidence = qwen_res
        forced_label, forced_conf = rule_based_override(content, label)
        if forced_conf is not None:
            return forced_label, forced_conf
        return label, confidence

    # 3. Ollama
    ollama_res = await _ollama_sentiment(content)
    if ollama_res:
        label, confidence = ollama_res
        forced_label, forced_conf = rule_based_override(content, label)
        if forced_conf is not None:
            return forced_label, forced_conf
        return label, confidence

    # 4. Rule-based fallback
    label, confidence = _rule_based_sentiment(content)
    forced_label, forced_conf = rule_based_override(content, label)
    if forced_conf is not None:
        return forced_label, forced_conf

    return label, confidence


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
