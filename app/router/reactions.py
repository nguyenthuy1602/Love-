from fastapi import APIRouter, HTTPException, Request, Depends
from bson import ObjectId

from app.core.deps import require_session
from app.db.mongodb import get_database
from app.schemas.reaction import ReactionRequest, ReactionCountResponse
from app.services.reaction_service import react_to_post, get_reaction_counts
from app.services.notification_service import notify_new_reaction

router = APIRouter(prefix="/posts", tags=["Reactions"])


@router.post("/{post_id}/react", response_model=ReactionCountResponse)
async def react(
    post_id: str, 
    body: ReactionRequest, 
    request: Request,
    user_id: str = Depends(require_session)
):
    db = get_database()

    try:
        result = await react_to_post(db, post_id, user_id, body.reaction_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Lấy username chính xác từ DB để gửi thông báo
    username_for_notification = "Người dùng" # Giá trị mặc định
    if ObjectId.is_valid(user_id):
        user_doc = await db.users.find_one({"_id": ObjectId(user_id)}, {"username": 1})
        if user_doc:
            username_for_notification = user_doc.get("username", "Ai đó")
    # Nếu user_id không hợp lệ hoặc không tìm thấy user, sử dụng giá trị mặc định.
    # Hàm require_session lý tưởng nên đảm bảo user_id hợp lệ.
    # Đây là một lớp bảo vệ bổ sung.

    # Thông báo cho chủ bài nếu là reaction mới (có my_reaction)
    if result.my_reaction and ObjectId.is_valid(post_id):
        post = await db.posts.find_one(
            {"_id": ObjectId(post_id)}, {"user_id": 1}
        )
        if post and str(post["user_id"]) != user_id:
            await notify_new_reaction( # Sử dụng username đã được tinh chỉnh
                str(post["user_id"]), post_id, username_for_notification, body.reaction_type
            )

    return result


@router.get("/{post_id}/reactions", response_model=ReactionCountResponse)
async def reactions(post_id: str, request: Request, user_id: str = Depends(require_session)):
    db = get_database()
    try:
        return await get_reaction_counts(db, post_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
