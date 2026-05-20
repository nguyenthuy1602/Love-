from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.match import DiscoverUserResponse # Changed import

async def get_random_match_user(db: AsyncIOMotorDatabase, current_user_id: str) -> RandomMatchResponse | None:
    """
    Logic ghép đôi ngẫu nhiên: 
    1. Loại trừ chính mình.
    2. Loại trừ những user đã có trong bảng matches (đã từng match/skip/unmatch).
    3. Loại trừ những user đã block hoặc bị block.
    """
    oid = ObjectId(current_user_id)
    
    # 1. Thu thập danh sách ID bị loại trừ
    excluded_ids = {oid}
    
    # Lấy từ matches
    async for doc in db.matches.find({"$or": [{"user1_id": oid}, {"user2_id": oid}]}):
        excluded_ids.add(doc["user1_id"])
        excluded_ids.add(doc["user2_id"])
        
    # Lấy từ blocks
    async for doc in db.blocks.find({"$or": [{"blocker_id": oid}, {"blocked_id": oid}]}):
        excluded_ids.add(doc["blocker_id"])
        excluded_ids.add(doc["blocked_id"])

    # 2. Sử dụng pipeline $sample để lấy 1 user ngẫu nhiên
    pipeline = [
        {"$match": {"_id": {"$nin": list(excluded_ids)}}},
        {"$sample": {"size": 1}}
    ]
    
    async for u in db.users.aggregate(pipeline):
        # Handle avatar fallback
        avatar_url = u.get("avatar_url")
        if not avatar_url:
            avatar_url = f"https://ui-avatars.com/api/?name={u.get('username', 'Người dùng')}&background=random"

        return DiscoverUserResponse( # Changed to DiscoverUserResponse
            id=str(u["_id"]),
            username=u["username"],
            avatar=avatar_url,
            bio=u.get("bio", "Chưa có giới thiệu"), # Fallback text for bio
            age=u.get("age"),
            gender=u.get("gender")
        )
    
    return None