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
from fastapi.encoders import jsonable_encoder # New import for safe serialization
import traceback # New import for full traceback

from app.schemas.match import MatchResponse, MatchStatus
from app.core.connection_manager import manager

logger = logging.getLogger(__name__)


def _serialize_match(match_doc: dict) -> dict:
    partner_id = str(match_doc.get("user2_id", ""))
    return {
        "id": str(match_doc["_id"]),
        "user1_id": str(match_doc["user1_id"]),
        "user2_id": partner_id,
        "user1_username": match_doc.get("user1_username", ""),
        "user2_username": match_doc.get("user2_username", ""),
        "user2_bio": match_doc.get("user2_bio"),
        "user2_avatar_url": match_doc.get("user2_avatar_url"),
        "user2_sentiment": match_doc.get("user2_sentiment"),
        "user2_gender": match_doc.get("user2_gender"),
        "user2_age": match_doc.get("user2_age"),
        "partner_is_online": manager.is_online(partner_id), # Kiểm tra trạng thái online thật
        "status": match_doc.get("status", "pending"),
        "created_at": match_doc["created_at"],
    }


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
) -> dict:
    # Ensure target_user fields have defaults to prevent KeyError or None issues
    doc = {
        "user1_id": ObjectId(user1_id),
        "user1_username": user1_username,
        "user2_id": target_user["_id"],
        "user2_username": target_user.get("username", "Người dùng"),
        "user2_bio": target_user.get("bio"),
        "user2_avatar_url": target_user.get("avatar_url"),
        "user2_sentiment": target_user.get("sentiment_profile"),
        "user2_gender": target_user.get("gender"),
        "user2_age": target_user.get("age"),
        "status": MatchStatus.PENDING,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.matches.insert_one(doc)
    
    return {
        "id": str(result.inserted_id),
        "user1_id": user1_id,
        "user2_id": str(target_user["_id"]),
        "user1_username": user1_username,
        "user2_username": target_user.get("username", ""),
        "user2_bio": target_user.get("bio"),
        "user2_avatar_url": target_user.get("avatar_url"),
        "user2_sentiment": target_user.get("sentiment_profile"),
        "user2_gender": target_user.get("gender"),
        "user2_age": target_user.get("age"),
        "partner_is_online": False,
        "status": "pending",
        "created_at": doc["created_at"], # Use the created_at from the inserted doc
    } # This return structure is for the _create_match_doc helper, not for the API response directly


# Import the core logic from the new file
from app.services.match_suggest_core_logic import suggest_by_sentiment_core

async def suggest_by_sentiment(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[dict]:
    """
    GET /api/match/suggest: Chỉ trả về danh sách user để xem, KHÔNG tạo match trong DB.
    """
    try:
        candidates = await suggest_by_sentiment_core(db, user_id, limit)

        results = []
        for target in candidates:
            results.append({
                "_id": str(target["_id"]),
                "username": target.get("username", ""),
                "avatar_url": target.get("avatar_url"),
                "bio": target.get("bio", ""),
                "age": target.get("age"),
                "gender": target.get("gender"),
            })

        return jsonable_encoder(results)
        
    except Exception as e:
        logger.error(f"MATCH SUGGEST ERROR: {e}")
        traceback.print_exc()
        return [] # Return empty list as per requirement


async def suggest_random(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[dict]: # Changed return type hint to dict for DiscoverUserResponse
    oid = ObjectId(user_id)
    match_filter = {"_id": {"$ne": oid}}

    pipeline = [
        {"$match": match_filter},
        {"$sample": {"size": limit}}
    ]
    cursor = db.users.aggregate(pipeline)
    candidates = await cursor.to_list(length=limit)
    
    results = []
    for target in candidates:
        results.append({
            "_id": str(target["_id"]),
            "username": target.get("username", ""),
            "avatar_url": target.get("avatar_url"),
            "bio": target.get("bio", ""),
            "age": target.get("age"),
            "gender": target.get("gender"),
        })
    return jsonable_encoder(results)


async def accept_match(
    db: AsyncIOMotorDatabase, target_user_id: str, user_id: str
) -> dict:
    try:
        target_oid = ObjectId(target_user_id)
        user_oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid ID format")

    # 1. Kiểm tra xem người kia đã thích mình chưa (pending match where we are user2)
    existing_other_like = await db.matches.find_one({
        "user1_id": target_oid,
        "user2_id": user_oid,
        "status": MatchStatus.PENDING
    })

    if existing_other_like:
        # Match cả 2 cùng thích -> ACCEPTED
        updated = await db.matches.find_one_and_update(
            {"_id": existing_other_like["_id"]},
            {"$set": {"status": MatchStatus.ACCEPTED}},
            return_document=True,
        )
        return _serialize_match(updated)

    # 2. Kiểm tra xem mình đã thích người này chưa (tránh tạo trùng)
    existing_my_like = await db.matches.find_one({ # This is a match initiated by current user
        "user1_id": user_oid,
        "user2_id": target_oid
    })
    if existing_my_like:
        return _serialize_match(existing_my_like)

    # 3. Thích lần đầu -> Tạo pending match doc
    me = await db.users.find_one({"_id": user_oid})
    target = await db.users.find_one({"_id": target_oid})
    if not target:
        raise ValueError("User not found")

    # Create a new pending match
    new_match_doc = await _create_match_doc(db, user_id, me.get("username", "user"), target)
    # The _create_match_doc returns a dict that matches MatchResponse structure
    return new_match_doc


async def skip_match(
    db: AsyncIOMotorDatabase, target_user_id: str, user_id: str
) -> None: # Changed return type to None for 204 status code
    try:
        target_oid = ObjectId(target_user_id)
        user_oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid ID format")

    # Check if a match already exists where current user is user1 and target is user2
    existing_match = await db.matches.find_one({
        "user1_id": user_oid,
        "user2_id": target_oid
    })

    if existing_match:
        # If it's already accepted, we might want to unmatch instead of skip
        # The user asked for "lưu skipped hoặc ignore". If it's accepted, we ignore skipping.
        if existing_match["status"] == MatchStatus.ACCEPTED: # Cannot skip an accepted match
            return
        
        # If it's pending or already skipped, update to skipped
        await db.matches.find_one_and_update(
            {"_id": existing_match["_id"]},
            {"$set": {"status": MatchStatus.SKIPPED}},
        )
        return
    else:
        # No existing match, create a new 'skipped' match document
        me = await db.users.find_one({"_id": user_oid})
        target = await db.users.find_one({"_id": target_oid})
        if not target:
            raise ValueError("User not found")

        # Create a new match document directly with skipped status
        await db.matches.insert_one({
            "user1_id": user_oid,
            "user1_username": me.get("username", "user"),
            "user2_id": target_oid,
            "user2_username": target.get("username", "Người dùng"),
            "user2_bio": target.get("bio", ""),
            "user2_avatar_url": target.get("avatar_url", ""),
            "user2_sentiment": target.get("sentiment_profile", ""),
            "user2_gender": target.get("gender", ""),
            "user2_age": target.get("age", 0),
            "status": MatchStatus.SKIPPED,
            "created_at": datetime.now(timezone.utc),
        })
        return


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
