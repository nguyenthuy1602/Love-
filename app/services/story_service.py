from datetime import datetime, timedelta, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.story import StoryResponse, StoryViewer, StoryReaction

def _serialize_story(doc: dict, current_user_id: str = "") -> StoryResponse:
    return StoryResponse(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        username=doc.get("username", "Người dùng"),
        avatar_url=doc.get("avatar_url"),
        media_url=doc["media_url"],
        media_type=doc.get("media_type", "image"),
        text=doc.get("text"),
        viewers=[StoryViewer(**v) for v in doc.get("viewers", [])],
        reactions=[StoryReaction(**r) for r in doc.get("reactions", [])],
        created_at=doc["created_at"],
        expires_at=doc["expires_at"],
        is_mine=str(doc["user_id"]) == current_user_id
    )

async def create_story(
    db: AsyncIOMotorDatabase, 
    user_id: str, 
    username: str, 
    avatar_url: str | None, 
    media_url: str,
    media_type: str,
    text: str | None = None
) -> StoryResponse:
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": ObjectId(user_id),
        "username": username,
        "avatar_url": avatar_url,
        "media_url": media_url,
        "media_type": media_type,
        "text": text,
        "viewers": [],
        "reactions": [],
        "created_at": now,
        "expires_at": now + timedelta(hours=24) # Hết hạn sau 24h
    }
    result = await db.stories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_story(doc, user_id)

async def get_active_stories(db: AsyncIOMotorDatabase, current_user_id: str) -> list[StoryResponse]:
    now = datetime.now(timezone.utc)
    # Chỉ lấy story chưa hết hạn
    cursor = db.stories.find({"expires_at": {"$gt": now}}).sort("created_at", -1)
    docs = await cursor.to_list(length=100)
    return [_serialize_story(d, current_user_id) for d in docs]

async def delete_story(db: AsyncIOMotorDatabase, story_id: str, user_id: str):
    try:
        oid = ObjectId(story_id)
    except:
        raise ValueError("ID không hợp lệ")
    
    story = await db.stories.find_one({"_id": oid})
    if not story:
        raise ValueError("Story không tồn tại")
    if str(story["user_id"]) != user_id:
        raise PermissionError("Bạn không có quyền xóa story này")
    
    await db.stories.delete_one({"_id": oid})

async def mark_story_as_viewed(
    db: AsyncIOMotorDatabase, 
    story_id: str, 
    user_id: str, 
    username: str, 
    avatar_url: str | None
):
    """Thêm user vào danh sách người xem (viewer)."""
    try:
        oid = ObjectId(story_id)
    except:
        return

    viewer_data = {
        "user_id": user_id,
        "username": username,
        "avatar_url": avatar_url
    }
    
    # Sử dụng $addToSet để không trùng lặp người xem
    await db.stories.update_one(
        {"_id": oid},
        {"$addToSet": {"viewers": viewer_data}}
    )

async def add_story_reaction(
    db: AsyncIOMotorDatabase, 
    story_id: str, 
    user_id: str, 
    reaction_type: str
):
    """Thêm hoặc cập nhật cảm xúc cho story."""
    try:
        oid = ObjectId(story_id)
    except:
        return

    # Xóa reaction cũ của user này nếu có
    await db.stories.update_one(
        {"_id": oid},
        {"$pull": {"reactions": {"user_id": user_id}}}
    )
    
    # Thêm reaction mới
    reaction_data = {
        "user_id": user_id,
        "reaction_type": reaction_type
    }
    await db.stories.update_one(
        {"_id": oid},
        {"$push": {"reactions": reaction_data}}
    ) 