"""
Matching Service — Epic 3
Ghép đôi dựa trên sentiment hoặc ngẫu nhiên.
Có kiểm tra block, tính compatibility score, hiển thị online status.
"""

import random
import logging
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.match import MatchResponse, MatchStatus
from app.core.connection_manager import manager

logger = logging.getLogger(__name__)


def _serialize_match(doc: dict) -> MatchResponse:
    partner_id = str(doc.get("user2_id", ""))
    return MatchResponse(
        id=partner_id, # Trả về user_id của đối phương làm id chính để FE gọi chat
        name=doc.get("user2_username", ""),
        avatar_url=doc.get("user2_avatar_url", ""),
        bio=doc.get("user2_bio", ""),
        user1_id=str(doc["user1_id"]),
        user2_id=partner_id,
        user1_username=doc.get("user1_username", ""),
        user2_username=doc.get("user2_username", ""),
        user2_bio=doc.get("user2_bio"),
        user2_avatar_url=doc.get("user2_avatar_url"),
        user2_sentiment=doc.get("user2_sentiment"),
        user2_gender=doc.get("user2_gender"),
        user2_age=doc.get("user2_age"),
        partner_is_online=manager.is_online(partner_id),
        status=doc["status"],
        created_at=doc["created_at"],
    )


async def _get_excluded_user_ids(
    db: AsyncIOMotorDatabase, user_id: str
) -> set:
    oid = ObjectId(user_id)

    # Đã match/skip trước đây
    cursor = db.matches.find({
        "$or": [{"user1_id": oid}, {"user2_id": oid}]
    })
    docs = await cursor.to_list(length=500)
    excluded = {user_id}
    for doc in docs:
        excluded.add(str(doc["user1_id"]))
        excluded.add(str(doc["user2_id"]))

    # Đã block hoặc bị block
    block_cursor = db.blocks.find({
        "$or": [{"blocker_id": oid}, {"blocked_id": oid}]
    })
    block_docs = await block_cursor.to_list(length=200)
    for doc in block_docs:
        excluded.add(str(doc["blocker_id"]))
        excluded.add(str(doc["blocked_id"]))

    return excluded


async def _create_match_doc(
    db: AsyncIOMotorDatabase,
    user1_id: str,
    user1_username: str,
    target_user: dict,
) -> MatchResponse:
    doc = {
        "user1_id": ObjectId(user1_id),
        "user1_username": user1_username,
        "user2_id": target_user["_id"],
        "user2_username": target_user["username"],
        "user2_bio": target_user.get("bio"),
        "user2_avatar_url": target_user.get("avatar_url"),
        "user2_sentiment": target_user.get("sentiment_profile"),
        "user2_gender": target_user.get("gender"),
        "user2_age": target_user.get("age"),
        "status": MatchStatus.PENDING,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.matches.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_match(doc)


async def suggest_by_sentiment(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[MatchResponse]:
    """
    Gợi ý ghép đôi dựa trên sentiment_profile (Epic 3 Upgrade).
    Logic:
    - negative: ưu tiên ["negative", "positive"]
    - positive: ưu tiên ["positive"]
    - neutral: match ["neutral", "positive", "negative"]
    """
    oid = ObjectId(user_id)
    me = await db.users.find_one({"_id": oid})
    if not me:
        raise ValueError("User not found")

    # 1. Xác định sentiment hiện tại (fallback về neutral nếu chưa có)
    my_sentiment = me.get("sentiment_profile") or "neutral"
    logger.info(f"[MATCH] Current user sentiment: {my_sentiment}")

    # 2. Thiết lập bộ lọc (Chỉ exclude chính mình để debug dễ dàng hơn)
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

    logger.info(f"[MATCH DEBUG] Current Sentiment: {my_sentiment}")
    logger.info(f"[MATCH DEBUG] Mongo Query (Sentiment): {pipeline}")

    cursor = db.users.aggregate(pipeline)
    final_candidates = await cursor.to_list(length=limit)

    # 3. Fallback: Nếu không tìm thấy ai theo sentiment, lấy random toàn bộ (trừ chính mình)
    if not final_candidates:
        logger.info("[MATCH] No candidates found by sentiment. Falling back to random.")
        pipeline_fallback = [
            {"$match": {"_id": {"$ne": oid}}},
            {"$sample": {"size": limit}}
        ]
        logger.info(f"[MATCH DEBUG] Fallback Mongo Query: {pipeline_fallback}")
        cursor = db.users.aggregate(pipeline_fallback)
        final_candidates = await cursor.to_list(length=limit)

    logger.info(f"[MATCH DEBUG] Matched users count: {len(final_candidates)}")

    if not final_candidates:
        return [] # Trả về mảng rỗng thay vì raise lỗi

    results = []
    for target in final_candidates:
        match_res = await _create_match_doc(db, user_id, me["username"], target)
        results.append(match_res)
        
    return results


async def suggest_random(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[MatchResponse]:
    oid = ObjectId(user_id)
    # TEMPORARY DEBUG: Chỉ exclude chính mình
    match_filter = {"_id": {"$ne": oid}}

    # Sử dụng aggregate $sample sẽ nhanh và ngẫu nhiên hơn find()
    pipeline = [
        {"$match": match_filter},
        {"$sample": {"size": limit}}
    ]
    logger.info(f"[MATCH DEBUG] Random Suggester Query: {pipeline}")
    cursor = db.users.aggregate(pipeline)
    candidates = await cursor.to_list(length=limit)

    logger.info(f"[MATCH DEBUG] Matched users count (random): {len(candidates)}")

    if not candidates:
        return []

    me = await db.users.find_one({"_id": oid})
    username = me["username"] if me else ""
    
    results = []
    for target in candidates:
        match_res = await _create_match_doc(db, user_id, username, target)
        results.append(match_res)
    return results


async def accept_match(
    db: AsyncIOMotorDatabase, match_id: str, user_id: str
) -> MatchResponse:
    try:
        oid = ObjectId(match_id)
    except Exception:
        raise ValueError("Invalid match ID")

    doc = await db.matches.find_one({"_id": oid})
    if not doc:
        raise ValueError("Match not found")
    if str(doc["user1_id"]) != user_id:
        raise PermissionError("Not your match")
    if doc["status"] != MatchStatus.PENDING:
        raise ValueError(f"Match is already {doc['status']}")

    updated = await db.matches.find_one_and_update(
        {"_id": oid},
        {"$set": {"status": MatchStatus.ACCEPTED}},
        return_document=True,
    )
    return _serialize_match(updated)


async def skip_match(
    db: AsyncIOMotorDatabase, match_id: str, user_id: str
) -> None:
    try:
        oid = ObjectId(match_id)
    except Exception:
        raise ValueError("Invalid match ID")

    doc = await db.matches.find_one({"_id": oid})
    if not doc:
        raise ValueError("Match not found")
    if str(doc["user1_id"]) != user_id:
        raise PermissionError("Not your match")

    await db.matches.update_one(
        {"_id": oid},
        {"$set": {"status": MatchStatus.SKIPPED}},
    )


async def get_my_matches(
    db: AsyncIOMotorDatabase, user_id: str
) -> list[MatchResponse]:
    oid = ObjectId(user_id)
    cursor = db.matches.find({
        "$or": [{"user1_id": oid}, {"user2_id": oid}],
        "status": MatchStatus.ACCEPTED,
    }).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [_serialize_match(d) for d in docs]
