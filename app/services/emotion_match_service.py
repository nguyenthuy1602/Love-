"""
Emotion Match Service — Extension
Dịch vụ mở rộng xử lý ghép đôi ngẫu nhiên dựa trên cảm xúc (sentiment_profile).
"""

import logging
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.match import MatchResponse
from app.services.matching_service import _create_match_doc

logger = logging.getLogger(__name__)

async def suggest_emotion_random(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[MatchResponse]:
    """
    Gợi ý ghép đôi ngẫu nhiên dựa trên cảm xúc tương đồng.
    Ràng buộc: Không can thiệp vào matching_service.py cũ.
    """
    oid = ObjectId(user_id)
    me = await db.users.find_one({"_id": oid})
    if not me:
        return []

    my_sentiment = me.get("sentiment_profile") or "neutral"
    
    # Logic ghép đôi mở rộng: 
    # - Positive ghép với Positive/Neutral
    # - Negative ghép với Negative/Neutral
    # - Neutral ghép với bất kỳ ai
    
    target_emotions = ["neutral"]
    if my_sentiment == "positive":
        target_emotions.append("positive")
    elif my_sentiment == "negative":
        target_emotions.append("negative")
    else:
        target_emotions = ["positive", "negative", "neutral"]

    # Pipeline lấy mẫu ngẫu nhiên
    pipeline = [
        {
            "$match": {
                "_id": {"$ne": oid},
                "sentiment_profile": {"$in": target_emotions}
            }
        },
        {"$sample": {"size": limit}}
    ]

    cursor = db.users.aggregate(pipeline)
    candidates = await cursor.to_list(length=limit)

    if not candidates:
        # Fallback lấy random tuyệt đối nếu không tìm thấy người cùng cảm xúc
        cursor = db.users.aggregate([
            {"$match": {"_id": {"$ne": oid}}},
            {"$sample": {"size": limit}}
        ])
        candidates = await cursor.to_list(length=limit)

    results = []
    for target in candidates:
        match_res = await _create_match_doc(db, user_id, me["username"], target)
        results.append(match_res)
        
    return results