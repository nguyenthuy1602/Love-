from contextlib import asynccontextmanager

import logging
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.requests import Request
from starlette.middleware.sessions import SessionMiddleware

from app.core.security import hash_password
from app.core.config import settings
from app.db.mongodb import connect_db, close_db
from app.db.indexes import create_indexes
from app.router.auth import router as auth_router
from app.router.posts import router as posts_router
from app.router.profile import router as profile_router
from app.router.match import router as match_router
import app.router.chat as chat
from app.router.reactions import router as reactions_router
from app.router.comments import router as comments_router
from app.router.moderation import router as moderation_router
from app.router.story import router as stories_router
from app.router.emotion_match import router as emotion_match_router
from app.middleware.rate_limit import RateLimitMiddleware
from app.db.mongodb import get_database
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

async def init_test_user():
    db = get_database()
    # Kiểm tra case-insensitive để tránh tạo trùng admin
    existing_user = await db.users.find_one({
        "$or": [
            {"username": {"$regex": "^admin$", "$options": "i"}},
            {"email": {"$regex": "^admin@example\.com$", "$options": "i"}}
        ]
    })
    if not existing_user:
        logger.info("Admin user not found. Creating test user: admin/123456")
        try:
            await db.users.insert_one({
                "username": "admin",
                "email": "admin@example.com",
                "password_hash": hash_password("123456"),
                "post_count": 0,
                "created_at": datetime.now(timezone.utc)
            })
        except Exception as e:
            logger.error(f"Failed to create test user: {e}")

async def init_test_posts():
    db = get_database()
    # Debug: Kiểm tra số lượng bài viết hiện tại (Requirement 9)
    count = await db.posts.count_documents({})
    print(f"DEBUG: Current post count in database: {count}")

    # Kiểm tra nếu database có ít hơn 2 bài viết thì thêm bài mới (Requirement 8)
    if count < 2:
        admin = await db.users.find_one({"username": "admin"})
        if admin:
            logger.info("Populating sample posts for home feed...")
            posts_to_add = [
                {
                    "user_id": admin["_id"],
                    "username": "admin",
                    "content": "Chào mừng mọi người đến với Love App! Chúc các bạn tìm thấy một nửa của mình. ❤️",
                    "media_urls": [],
                    "media_type": None,
                    "sentiment_score": "positive",
                    "reactions": {"heart": 15, "sad": 0, "wow": 2, "haha": 0, "fire": 5},
                    "comment_count": 0,
                    "created_at": datetime.now(timezone.utc)
                },
                {
                    "user_id": admin["_id"],
                    "username": "admin",
                    "content": "Hôm nay bạn thế nào? Hãy chia sẻ cảm xúc của mình để kết nối với những người bạn mới nhé! ✨",
                    "media_urls": [],
                    "media_type": None,
                    "sentiment_score": "positive",
                    "reactions": {"heart": 8, "sad": 0, "wow": 1, "haha": 0, "fire": 3},
                    "comment_count": 0,
                    "created_at": datetime.now(timezone.utc)
                }
            ]
            for post in posts_to_add:
                # Kiểm tra tránh trùng lặp nội dung
                if not await db.posts.find_one({"content": post["content"]}):
                    await db.posts.insert_one(post)
            logger.info("Sample posts updated successfully.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await create_indexes()
    await init_test_user()
    await init_test_posts()
    
    # In danh sách tất cả các route để debug lỗi Not Found
    print("\n" + "="*50)
    print("DANH SÁCH ROUTE ĐÃ ĐĂNG KÝ:")
    for route in app.routes:
        print(f"Path: {route.path:30} | Methods: {getattr(route, 'methods', 'WS')}")
    print("="*50 + "\n")
    
    yield
    await close_db()


app = FastAPI(
    title="Love API",
    description="Backend for the Love social network",
    version="0.2.0",
    lifespan=lifespan,
    strict_slashes=False, # Ensures /api/stories and /api/stories/ both work
)

Path("media/uploads").mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")

# ── Middleware ────────────────────────────────────────────────

# Middleware xử lý theo thứ tự ngược lại (LIFO). 
# Để CORS xử lý được cả lỗi 401/422, CORSMiddleware phải được add CUỐI CÙNG.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    session_cookie="love_session",
    max_age=86400,
    # Khi deploy Render + Vercel (khác domain), bắt buộc phải có Secure; SameSite=None
    https_only=settings.app_env.lower() not in {"dev", "local"},
    same_site="none" if settings.app_env.lower() not in {"dev", "local"} else "lax",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", # Frontend default
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5174", # Vite alternative port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body_preview = "<unavailable>"
    try:
        raw = await request.body()
        body_preview = raw.decode("utf-8", errors="replace")[:2000]
    except Exception:
        pass

    logger.warning(
        "422 validation error on %s %s | errors=%s | body=%s",
        request.method,
        request.url.path,
        exc.errors(),
        body_preview,
    )

    # Chuyển đổi list error của FastAPI thành 1 chuỗi thông báo duy nhất
    # Điều này giúp Frontend hiển thị Toast dễ dàng và tránh crash trang trắng
    errors = exc.errors()
    error_msg = errors[0].get("msg") if errors else "Dữ liệu không hợp lệ"

    return JSONResponse(
        status_code=422,
        content={"detail": error_msg},
    )

# ── Routers ───────────────────────────────────────────────────

app.include_router(auth_router,       prefix="/api")
app.include_router(posts_router,      prefix="/api")
app.include_router(profile_router,    prefix="/api")
app.include_router(match_router,      prefix="/api")
app.include_router(reactions_router,  prefix="/api")
app.include_router(comments_router,   prefix="/api")
app.include_router(moderation_router, prefix="/api")
app.include_router(stories_router,    prefix="/api") # Sẽ tạo endpoint /api/stories
app.include_router(emotion_match_router, prefix="/api")

# Chat router: API and WebSocket endpoints
app.include_router(chat.router)


# ── Health check ──────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.app_env}
