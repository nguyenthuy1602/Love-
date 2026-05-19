from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.profile import ProfileResponse, ProfileUpdateRequest
from app.services.post_service import get_posts_by_user
from app.core.connection_manager import manager


async def get_profile(
    db: AsyncIOMotorDatabase, user_id: str, viewer_user_id: str = ""
) -> ProfileResponse:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID")

    doc = await db.users.find_one({"_id": oid})
    if not doc:
        raise ValueError("User not found")

    # Đếm trực tiếp từ collection posts để đảm bảo tính chính xác realtime
    post_count = await db.posts.count_documents({"user_id": oid})

    posts = await get_posts_by_user(db, user_id, viewer_user_id=viewer_user_id)

    return ProfileResponse(
        id=str(doc["_id"]),
        username=doc["username"],
        bio=doc.get("bio"),
        avatar_url=doc.get("avatar_url"),
        age=doc.get("age"),
        gender=doc.get("gender"),
        sentiment_profile=doc.get("sentiment_profile"),
        is_online=manager.is_online(user_id),
        created_at=doc["created_at"],
        post_count=post_count,
        posts=posts,
    )


async def update_profile(
    db: AsyncIOMotorDatabase, user_id: str, data: ProfileUpdateRequest
) -> ProfileResponse:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_fields:
        raise ValueError("No fields to update")

    result = await db.users.find_one_and_update(
        {"_id": oid},
        {"$set": update_fields},
        return_document=True,
    )
    if not result:
        raise ValueError("User not found")

    try:
        oid = ObjectId(user_id)
        user_query = {"$or": [{"user_id": oid}, {"user_id": user_id}]}
    except Exception:
        user_query = {"user_id": user_id}
    post_count = result.get("post_count")
    if post_count is None:
        post_count = await db.posts.count_documents(user_query)
    posts = await get_posts_by_user(db, user_id)

    return ProfileResponse(
        id=str(result["_id"]),
        username=result["username"],
        bio=result.get("bio"),
        avatar_url=result.get("avatar_url"),
        age=result.get("age"),
        gender=result.get("gender"),
        sentiment_profile=result.get("sentiment_profile"),
        is_online=manager.is_online(user_id),
        created_at=result["created_at"],
        post_count=post_count,
        posts=posts,
    )
