from fastapi import APIRouter, HTTPException, Request, Body, UploadFile, File, Form, Depends
from fastapi.encoders import jsonable_encoder
from bson import ObjectId
from typing import List
import logging
import traceback

from app.core.deps import require_session_full
from app.db.mongodb import get_database
from app.services.story_service import create_story, get_active_stories
from app.services.media_service import upload_media

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stories", tags=["Stories"])


@router.post("/upload")
async def upload_story_media(
    request: Request,
    file: UploadFile = File(...),
    auth_data: tuple = Depends(require_session_full)
):
    user_id, _ = auth_data
    try:
        result = await upload_media(
            file,
            user_id,
            folder="stories"
        )

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", status_code=201)
@router.post("", status_code=201)
async def create_new_story(
    request: Request, 
    auth_data: tuple = Depends(require_session_full),
    media_url: str = Form(None),
    media_type: str = Form(None),
    text: str = Form(None),
    data: dict = Body(None)
):
    user_id, username = auth_data
    db = get_database()

    # Hỗ trợ cả JSON body (nếu có) và Form fields (ưu tiên JSON nếu gửi cả hai)
    m_url = (data.get("media_url") if data else None) or media_url
    m_type = (data.get("media_type") if data else None) or media_type or "image"
    s_text = (data.get("text") if data else None) or text

    avatar_url = None
    if ObjectId.is_valid(user_id):
        user_doc = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"avatar_url": 1}
        )
        if user_doc:
            avatar_url = user_doc.get("avatar_url")

    try:
        result = await create_story(
            db,
            user_id,
            username,
            avatar_url,
            media_url=m_url,
            media_type=m_type,
            text=s_text
        )
        return jsonable_encoder(result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[dict], status_code=200)
@router.get("", status_code=200)
async def list_stories(request: Request, auth_data: tuple = Depends(require_session_full)): # Requirement 3
    user_id, _ = auth_data
    db = get_database()
    try:
        result = await get_active_stories(db, user_id)
        return jsonable_encoder(result)
    except Exception as e:
        logger.error(f"Error serializing stories for user {user_id}: {e}", exc_info=True)
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi hệ thống khi tải stories: {str(e)}"
        )