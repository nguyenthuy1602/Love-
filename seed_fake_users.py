import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from app.core.security import hash_password
from app.core.config import settings

async def seed_users():
    print("🚀 Starting to seed test users...")
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.database_name]
    
    test_users = [
        {"username": "happy_test", "sentiment": "positive", "bio": "I am so happy!"},
        {"username": "sad_test", "sentiment": "negative", "bio": "Feeling blue today..."},
        {"username": "neutral_test", "sentiment": "neutral", "bio": "Just a normal day."},
        {"username": "no_sentiment_test", "sentiment": None, "bio": "Old user account."},
        {"username": "sunshine", "sentiment": "positive", "bio": "Always positive!"},
        {"username": "rainy_day", "sentiment": "negative", "bio": "Loneliness is my friend."},
    ]
    
    inserted_count = 0
    for user in test_users:
        # Kiểm tra trùng
        exists = await db.users.find_one({"username": user["username"]})
        if not exists:
            doc = {
                "username": user["username"],
                "email": f"{user['username']}@test.com",
                "password_hash": hash_password("123456"),
                "bio": user["bio"],
                "age": 20,
                "gender": "other",
                "sentiment_profile": user["sentiment"],
                "post_count": 0,
                "created_at": datetime.now(timezone.utc)
            }
            # Xóa field nếu là None
            if user["sentiment"] is None:
                del doc["sentiment_profile"]
                
            await db.users.insert_one(doc)
            inserted_count += 1
            print(f"✅ Created: {user['username']} ({user['sentiment']})")

    print(f"✨ Finished! Inserted {inserted_count} test users.")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_users())