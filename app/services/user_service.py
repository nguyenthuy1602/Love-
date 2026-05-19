import re
from datetime import datetime, timezone
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import hash_password, verify_password
from app.schemas.user import UserRegisterRequest, UserResponse
import logging

logger = logging.getLogger(__name__)

def _serialize_user(doc: dict, is_online: bool = False) -> UserResponse:
    return UserResponse(
        id=str(doc["_id"]),
        username=doc["username"],
        bio=doc.get("bio"),
        avatar_url=doc.get("avatar_url"),
        age=doc.get("age"),
        gender=doc.get("gender"),
        post_count=doc.get("post_count", 0),
        sentiment_profile=doc.get("sentiment_profile"),
        is_online=is_online,
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )


async def register_user(
    db: AsyncIOMotorDatabase, data: UserRegisterRequest
) -> UserResponse:
    # Kiểm tra trùng lặp không phân biệt hoa thường
    safe_username = re.escape(data.username)
    query = {
        "$or": [
            {"username": {"$regex": f"^{safe_username}$", "$options": "i"}}
        ]
    }
    if getattr(data, "email", None):
        safe_email = re.escape(data.email)
        query["$or"].append({"email": {"$regex": f"^{safe_email}$", "$options": "i"}})
        
    existing = await db.users.find_one(query)
    if existing:
        raise ValueError("Username or Email already exists")

    doc = {
        "username": data.username,
        "email": getattr(data, 'email', None),
        "password_hash": hash_password(data.password), # Sử dụng hàm hash mới
        "bio": data.bio,
        "age": data.age,
        "gender": data.gender,
        "avatar_url": None,
        "sentiment_profile": "neutral",
        "post_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize_user(doc)


async def login_user(
    db: AsyncIOMotorDatabase, username: str, password: str
) -> UserResponse:
    username = username.strip() if username else ""
    logger.info(f"[AUTH] Login attempt for user: '{username}'")

    # Escape các ký tự đặc biệt trong username/email để tránh lỗi Regex (ví dụ dấu .)
    safe_username = re.escape(username)
    
    # Debug: In ra username đang cố gắng login
    logger.info(f"DEBUG: Attempting login search for: {username}")

    # Tìm user: khớp chính xác (case-insensitive)
    # Sử dụng ^ và $ để đảm bảo không match nhầm các user có tên tương tự
    doc = await db.users.find_one({
        "$or": [
            {"username": {"$regex": f"^{safe_username}$", "$options": "i"}},
            {"email": {"$regex": f"^{safe_username}$", "$options": "i"}},
            # Hỗ trợ nếu username được gửi chính là email
            {"email": username} 
        ]
    })

    # Debug: In ra document tìm thấy trong MongoDB (Lưu ý: không log password trong production thực tế)
    logger.info(f"DEBUG: Mongo returned user doc: {doc}")

    if not doc:
        logger.warning(f"[AUTH] User not found: '{username}'")
        raise ValueError("Invalid username or password")

    # Kiểm tra mật khẩu với log chi tiết
    is_correct = verify_password(password, doc["password_hash"])
    logger.info(f"[AUTH] Password verification for '{doc['username']}': {'SUCCESS' if is_correct else 'FAILED'}")

    if not is_correct:
        raise ValueError("Invalid username or password")

    return _serialize_user(doc)


async def get_user_by_id(
    db: AsyncIOMotorDatabase, user_id: str, is_online: bool = False
) -> UserResponse:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID")

    doc = await db.users.find_one({"_id": oid})
    if not doc:
        raise ValueError("User not found")
    return _serialize_user(doc, is_online=is_online)


async def update_user(
    db: AsyncIOMotorDatabase,
    user_id: str,
    bio: str | None = None,
    avatar_url: str | None = None,
    age: int | None = None,
    gender: str | None = None,
) -> UserResponse:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise ValueError("Invalid user ID")

    fields: dict = {}
    if bio is not None:
        fields["bio"] = bio
    if avatar_url is not None:
        fields["avatar_url"] = avatar_url
    if age is not None:
        if age <= 0 or age > 120:
            raise ValueError("Tuổi phải từ 1 đến 120")
        fields["age"] = age
    if gender is not None:
        gender = gender.lower()
        if gender not in {"male", "female", "other"}:
            raise ValueError("Giới tính phải là male, female hoặc other")
        fields["gender"] = gender

    if not fields:
        raise ValueError("No fields to update")

    result = await db.users.find_one_and_update(
        {"_id": oid},
        {"$set": fields},
        return_document=True,
    )
    if not result:
        raise ValueError("User not found")
    return _serialize_user(result)

async def update_user_sentiment_profile(db, user_id):
    """Stub to fix ImportError as requested."""
    return True
