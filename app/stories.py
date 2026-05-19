from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Body,
    UploadFile,
    File,
    Depends,
)

from bson import ObjectId

from app.core.deps import require_session_full
from app.db.mongodb import get_database
from app.services.story_service import create_story, get_active_stories
from app.services.media_service import upload_media

router = APIRouter(prefix="/stories", tags=["Stories"])


# =========================
# Upload media cho story
# =========================
@router.post("/upload", status_code=200)
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


# =========================
# Tạo story
# =========================
@router.post("/", status_code=201)
@router.post("", status_code=201)
async def create_new_story(
    request: Request, 
    data: dict = Body(...),
    auth_data: tuple = Depends(require_session_full)
):
    """
    Payload:
    {
        "media_url": "...",
        "media_type": "image",
        "text": "..."
    }
    """

    user_id, username = auth_data
    db = get_database()

    avatar_url = None

    if ObjectId.is_valid(user_id):
        user_doc = await db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"avatar_url": 1}
        )

        if user_doc:
            avatar_url = user_doc.get("avatar_url")

    try:
        return await create_story(
            db,
            user_id,
            username,
            avatar_url,
            media_url=data.get("media_url"),
            media_type=data.get("media_type", "image"),
            text=data.get("text")
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =========================
# Lấy danh sách stories
# =========================
@router.get("/", status_code=200)
@router.get("", status_code=200)
async def list_stories(
    request: Request,
    auth_data: tuple = Depends(require_session_full)
):
    user_id, _ = auth_data
    db = get_database()

    return await get_active_stories(db, user_id)