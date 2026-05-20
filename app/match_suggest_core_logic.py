import logging
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def suggest_by_sentiment_core(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[dict]: # Changed return type to list[dict]
    """
    Original core logic for suggesting matches by sentiment.
    This function was moved from app/services/matching_service.py to preserve original logic.
    """
    oid = ObjectId(user_id)
    me = await db.users.find_one({"_id": oid})
    if not me:
        raise ValueError("User not found")

    # 1. Xác định sentiment hiện tại (fallback về neutral nếu chưa có)
    my_sentiment = me.get("sentiment_profile") or "neutral"
    logger.info(f"[MATCH_CORE] Current user sentiment: {my_sentiment}")

    # 2. Thiết lập bộ lọc (Chỉ exclude chính mình)
    match_filter = {"_id": {"$ne": oid}}

    if my_sentiment == "negative":
        match_filter["sentiment_profile"] = {"$in": ["negative", "positive"]}
    elif my_sentiment == "positive":
        match_filter["sentiment_profile"] = "positive"
    else:  # neutral
        match_filter["sentiment_profile"] = {"$in": ["neutral", "positive", "negative"]}

    pipeline = [
        {"$match": match_filter},
        {"$sample": {"size": limit}}
    ]

    logger.info(f"[MATCH_CORE DEBUG] Current Sentiment: {my_sentiment}")
    logger.info(f"[MATCH_CORE DEBUG] Mongo Query (Sentiment): {pipeline}")

    cursor = db.users.aggregate(pipeline)
    final_candidates = await cursor.to_list(length=limit)

    # 3. Fallback: Nếu không tìm thấy ai theo sentiment, lấy random toàn bộ (trừ chính mình)
    if not final_candidates:
        logger.info("[MATCH_CORE] No candidates found by sentiment. Falling back to random.")
        pipeline_fallback = [
            {"$match": {"_id": {"$ne": oid}}},
            {"$sample": {"size": limit}}
        ]
        logger.info(f"[MATCH_CORE DEBUG] Fallback Mongo Query: {pipeline_fallback}")
        cursor = db.users.aggregate(pipeline_fallback)
        final_candidates = await cursor.to_list(length=limit)

    logger.info(f"[MATCH_CORE DEBUG] Matched users count: {len(final_candidates)}")

    if not final_candidates:
        return [] # Trả về mảng rỗng thay vì raise lỗi

    return final_candidates # Return raw user documents