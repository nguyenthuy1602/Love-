"""
Emotion Match Debug Service — Fallback Layer
Dịch vụ mở rộng để xử lý việc ghép đôi khi dữ liệu bị thiếu hoặc filter quá chặt.
"""

import logging
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.match import MatchResponse
from app.services.matching_service import _create_match_doc

logger = logging.getLogger(__name__)

async def suggest_emotion_with_fallback(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[MatchResponse]:
    oid = ObjectId(user_id)
    
    # 1. Log thông tin user hiện tại
    me = await db.users.find_one({"_id": oid})
    if not me:
        print(f"❌ DEBUG: current_user_id {user_id} KHÔNG TỒN TẠI")
        return []

    my_sentiment = me.get("sentiment_profile") or "neutral"
    total_users = await db.users.count_documents({})
    
    print("="*30)
    print(f"DEBUG: current_user = {user_id} ({me['username']})")
    print(f"DEBUG: sentiment = {my_sentiment}")
    print(f"DEBUG: total users in DB = {total_users}")
    print("="*30)

    # Bước 1: Tìm người cùng cảm xúc
    target_emotions = ["neutral"]
    if my_sentiment == "positive":
        target_emotions.append("positive")
    elif my_sentiment == "negative":
        target_emotions.append("negative")
    else:
        target_emotions = ["positive", "negative", "neutral"]

    candidates = await _run_aggregation(db, oid, {"sentiment_profile": {"$in": target_emotions}}, limit)
    print(f"DEBUG: Step 1 (Same/Neutral Sentiment) - count: {len(candidates)}")

    # Bước 2: Nếu rỗng, fallback sang Neutral (dành cho user chưa có profile)
    if not candidates:
        print("DEBUG: Step 1 empty. Falling back to Step 2 (Neutral/Missing profile)...")
        filter_step2 = {
            "$or": [
                {"sentiment_profile": "neutral"},
                {"sentiment_profile": {"$exists": False}}
            ]
        }
        candidates = await _run_aggregation(db, oid, filter_step2, limit)
        print(f"DEBUG: Step 2 - count: {len(candidates)}")

    # Bước 3: Vẫn rỗng, lấy Random tuyệt đối
    if not candidates:
        print("DEBUG: All filters failed. Step 3 (Random Fallback)...")
        candidates = await _run_aggregation(db, oid, {}, limit)
        print(f"DEBUG: Step 3 - count: {len(candidates)}")

    if candidates:
        print(f"DEBUG: Top 3 Candidates sentiments: {[c.get('sentiment_profile', 'N/A') for c in candidates[:3]]}")

    # Convert sang MatchResponse
    results = []
    for target in candidates:
        match_res = await _create_match_doc(db, user_id, me["username"], target)
        results.append(match_res)
    
    return results

async def _run_aggregation(db, exclude_oid, match_filter, limit):
    """Helper để chạy aggregate lọc chính mình"""
    # Luôn loại bỏ chính mình
    final_filter = {"_id": {"$ne": exclude_oid}}
    if match_filter:
        final_filter.update(match_filter)
        
    pipeline = [
        {"$match": final_filter},
        {"$sample": {"size": limit}}
    ]
    
    try:
        cursor = db.users.aggregate(pipeline)
        return await cursor.to_list(length=limit)
    except Exception as e:
        print(f"❌ AGGREGATION ERROR: {e}")
        return []