"""
Chat Extension Service
Lớp wrapper xử lý tin nhắn mà không làm thay đổi chat_service.py cũ.
Có thể dùng để phân tích cảm xúc tin nhắn hoặc định dạng lại nội dung.
"""

import logging
from app.services.sentiment_service import analyze_sentiment

logger = logging.getLogger(__name__)

async def enrich_message_metadata(content: str) -> dict:
    """
    Phân tích nội dung tin nhắn để thêm metadata (ví dụ: sentiment).
    Frontend có thể dùng thông tin này để hiển thị icon cảm xúc bên cạnh tin nhắn.
    """
    try:
        sentiment, confidence = await analyze_sentiment(content)
        return {
            "content_sentiment": sentiment,
            "sentiment_confidence": confidence
        }
    except Exception as e:
        logger.error(f"Error enriching message: {e}")
        return {"content_sentiment": "neutral", "sentiment_confidence": 0.0}