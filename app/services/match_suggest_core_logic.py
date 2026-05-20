from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

logger = logging.getLogger(__name__)

async def suggest_by_sentiment_core(
    db: AsyncIOMotorDatabase, user_id: str, limit: int = 10
) -> list[dict]:
    """
    Core logic to find candidate users for matching.
    Returns a list of raw user documents from MongoDB.
    """
    oid = ObjectId(user_id)
    me = await db.users.find_one({"_id": oid})
    if not me:
        return []

    # 1. Collect excluded IDs (self, interactions, blocks)
    excluded_ids = {oid}
    # Only exclude users where a definitive decision was made (Accepted, Skipped, Unmatched)
    # We do NOT exclude PENDING matches here so they can be re-suggested if the pool is small.
    match_interactions = db.matches.find({
        "$or": [{"user1_id": oid}, {"user2_id": oid}],
        "status": {"$in": ["accepted", "skipped", "unmatched"]}
    })
    async for doc in match_interactions:
        excluded_ids.add(ObjectId(doc["user1_id"]))
        excluded_ids.add(ObjectId(doc["user2_id"]))
    
    blocks_interactions = db.blocks.find({"$or": [{"blocker_id": oid}, {"blocked_id": oid}]})
    async for doc in blocks_interactions:
        excluded_ids.add(ObjectId(doc["blocker_id"]))
        excluded_ids.add(ObjectId(doc["blocked_id"]))

    # 1.5 Identify active users from Home Feed (Recent Posts)
    # Lấy IDs của những người vừa đăng bài trong 200 bài viết gần nhất
    active_pipeline = [
        {"$sort": {"created_at": -1}},
        {"$limit": 200},
        {"$group": {"_id": "$user_id"}},
        {"$match": {"_id": {"$nin": list(excluded_ids)}}}
    ]
    active_cursor = db.posts.aggregate(active_pipeline)
    active_ids = [doc["_id"] for doc in await active_cursor.to_list(length=100)]

    # 2. Try sentiment-based matching
    my_sentiment = me.get("sentiment_profile") or "neutral"
    
    # Define sentiment scoring weights
    sentiment_weights = {
        "positive": {"positive": 50, "neutral": 20, "negative": 0},
        "negative": {"negative": 50, "neutral": 20, "positive": 10},
        "neutral": {"neutral": 50, "positive": 30, "negative": 30}
    }
    weights = sentiment_weights.get(my_sentiment, sentiment_weights["neutral"])

    # 3. Build Tinder-style Ranking Pipeline
    pipeline = [
        # Filter out excluded users
        {"$match": {"_id": {"$nin": list(excluded_ids)}}},
        
        # Calculate Boost Scores
        {"$addFields": {
            "sentiment_score": {
                "$switch": {
                    "branches": [
                        {"case": {"$eq": ["$sentiment_profile", "positive"]}, "then": weights["positive"]},
                        {"case": {"$eq": ["$sentiment_profile", "negative"]}, "then": weights["negative"]},
                        {"case": {"$eq": ["$sentiment_profile", "neutral"]}, "then": weights["neutral"]}
                    ],
                    "default": 10
                }
            },
            "activity_score": {"$cond": [{"$in": ["$_id", active_ids]}, 40, 0]},
            "hot_user_score": {"$min": [{"$multiply": [{"$ifNull": ["$post_count", 0]}, 2]}, 30]},
            "random_variance": {"$multiply": [{"$rand": {}}, 15]} # Adds variety to the feed
        }},
        
        # Combine scores and Sort
        {"$addFields": {
            "total_match_score": {"$add": ["$sentiment_score", "$activity_score", "$hot_user_score", "$random_variance"]}
        }},
        {"$sort": {"total_match_score": -1}},
        {"$limit": limit}
    ]

    cursor = db.users.aggregate(pipeline)
    return await cursor.to_list(length=limit)