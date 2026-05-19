from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File, Form, Depends
from fastapi.encoders import jsonable_encoder
from bson import ObjectId
from app.services.sentiment_service import analyze_sentiment
from app.schemas.post import PostCreateRequest, PostResponse, FeedResponse
from app.services.post_service import create_post, get_post_by_id, get_feed, delete_post
from app.services.media_service import upload_media
from app.middleware.user_rate_limit import post_limiter
from app.db.mongodb import get_database
from app.services.user_service import update_user_sentiment_profile
from app.core.deps import require_session, require_session_full
import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/posts", tags=["Posts"])

# Standardized upload endpoints - supports both for compatibility
@router.post("/upload", status_code=200)
@router.post("/upload-media", status_code=200)
async def upload_post_media(
    request: Request, 
    file: UploadFile = File(...),
    user_id: str = Depends(require_session)
):
    """
    Endpoint riêng để upload media (ảnh/video) trước khi tạo bài viết.
    Trả về URL để frontend điền vào PostCreateRequest.
    """
    # Kiểm tra giới hạn upload của user (nếu cần)
    post_limiter.check(user_id, "media_upload")
    logger.info("Uploading media for user %s: filename=%s", user_id, file.filename)

    try:
        result = await upload_media(file, user_id, folder="posts")
        # result: { "media_url": ..., "media_type": ..., "public_id": ... }
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error("Unexpected error during media upload: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error during upload: {str(e)}"
        )

@router.get("/me")
async def get_my_posts_redirect(request: Request, user_id: str = Depends(require_session)):
    """Điều hướng /api/posts/me sang feed hoặc profile cá nhân"""
    db = get_database()
    return await get_feed(db, viewer_user_id=user_id, page=1, page_size=20)

@router.get("", response_model=list[PostResponse])
@router.get("/", response_model=list[PostResponse])
async def get_all_posts(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
):
    """GET /api/posts - Trả về danh sách tất cả bài viết (Global Feed) (Requirement 2, 7, 9)"""
    db = get_database()
    try:
        # viewer_user_id để trống vì đây là public feed, không cần biết ai đang xem
        feed_response = await get_feed(db, viewer_user_id="", page=page, page_size=page_size)
        return feed_response.posts
    except Exception as e:
        logger.error(f"Error fetching global posts: {e}", exc_info=True) # Requirement 5
        raise HTTPException(status_code=500, detail="Không thể tải bài viết. Vui lòng thử lại sau.") # Requirement 8

@router.post("", response_model=PostResponse, status_code=201)
@router.post("/", response_model=PostResponse, status_code=201, include_in_schema=False)
async def create_new_post(
    request: Request,
    content: str = Form(None),
    file: UploadFile = File(None),
    media_url: str = Form(None),
    media_type_from_form: str = Form(None),
    auth_data: tuple = Depends(require_session_full)
):
    # 1. Kiểm tra bài viết rỗng (Requirement 3)
    if not content and not file and not media_url:
        raise HTTPException(status_code=400, detail="Bài viết phải có nội dung hoặc hình ảnh/video")

    user_id, _ = auth_data
    post_limiter.check(user_id, "posts") 

    db = get_database()
    media_urls = []
    media_type = None

    # 2. Xử lý upload media (Requirement 4)
    if file and file.filename:
        upload_result = await upload_media(file, user_id, folder="posts")
        media_urls = [upload_result["media_url"]]
        media_type = upload_result["media_type"]
    elif media_url:
        media_urls = [media_url]
        media_type = media_type_from_form

    try:
        # Lấy thông tin user hiện tại từ DB
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user_doc:
            raise HTTPException(status_code=404, detail="Người dùng không tồn tại hoặc phiên đăng nhập hết hạn")

        post_data = PostCreateRequest(
            content=content or "",
            media_urls=media_urls,
            media_type=media_type
        )

        sentiment_val, _ = await analyze_sentiment(content or "")
        # 3. Lưu vào database với đầy đủ field (Requirement 2)
        result = await create_post(
        db,
        user_id,
        user_doc.get("username", "user"),
        post_data,
        avatar_url=user_doc.get("avatar_url"),
        age=user_doc.get("age"),
        gender=user_doc.get("gender")
    )
        
        # Cập nhật thông tin sentiment vào database bài viết và cập nhật profile người dùng
        post_id = getattr(result, "id", None) or (str(result.get("_id")) if isinstance(result, dict) else None)
        if post_id:
            await db.posts.update_one(
                {"_id": ObjectId(post_id)},
                {"$set": {"sentiment": sentiment_val}}
            )
            # Cập nhật lại xu hướng cảm xúc (sentiment_profile) của user
            await update_user_sentiment_profile(db, user_id)

        # Chống lỗi 500: Chuyển đổi ObjectId thành String trước khi trả về
        final_result = jsonable_encoder(result)
        return final_result
    except HTTPException as e:
        # Giữ nguyên các lỗi HTTP đã được định nghĩa (401, 413, 429...)
        raise e
    except Exception as e:
        logger.error(f"Post creation failed: {e}", exc_info=True)
        # Đảm bảo detail luôn là string để Frontend không bị lỗi hiển thị {}
        error_detail = str(e)
        if not error_detail or error_detail == "None":
            error_detail = "Không thể tạo bài viết, vui lòng thử lại."
        raise HTTPException(status_code=400, detail=error_detail)


@router.get("/feed", response_model=FeedResponse)
async def feed(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    user_id: str = Depends(require_session)
):
    db = get_database()
    return await get_feed(db, viewer_user_id=user_id, page=page, page_size=page_size)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: str, request: Request, user_id: str = Depends(require_session)):
    db = get_database()
    try:
        return await get_post_by_id(db, post_id, viewer_user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{post_id}", status_code=204)
async def delete_my_post(post_id: str, request: Request, user_id: str = Depends(require_session)):
    db = get_database()
    try:
        await delete_post(db, post_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
