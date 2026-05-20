"""
Emotion Match Service — Extension
Dịch vụ mở rộng xử lý ghép đôi ngẫu nhiên dựa trên cảm xúc (sentiment_profile).
"""

import logging
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.match import MatchResponse
from app.services.emotion_match_debug_service import suggest_emotion_with_fallback

logger = logging.getLogger(__name__)

async def suggest_emotion_random(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[MatchResponse]:
    # Sử dụng lớp fallback mở rộng để đảm bảo luôn có kết quả và log debug chi tiết
    return await suggest_emotion_with_fallback(db, user_id, limit)