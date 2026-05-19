from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Depends

from app.db.mongodb import get_database
from app.schemas.user import (
    UserRegisterRequest, UserLoginRequest, UserUpdateRequest,
    UserResponse, LoginResponse,
)
from app.services.user_service import register_user, login_user, get_user_by_id, update_user
from app.services.media_service import upload_avatar
from app.core.security import create_access_token
from app.core.deps import require_session as shared_require_session
from app.core.connection_manager import manager

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: UserRegisterRequest):
    db = get_database()
    try:
        return await register_user(db, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=LoginResponse)
@router.post("/login/", response_model=LoginResponse, include_in_schema=False)
async def login(body: UserLoginRequest, request: Request):
    db = get_database()
    try:
        user = await login_user(db, body.username, body.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    # 1. Lưu session (Dùng cho các route dùng cookie)
    user_id_str = str(user.id)
    request.session["user_id"] = user_id_str
    request.session["username"] = user.username
    manager.mark_online(user_id_str)

    # 2. Tạo JWT Token (sub phải là string của ID)
    token = create_access_token(data={"sub": user_id_str})
    return LoginResponse(message="Login successful", user=user, access_token=token, token_type="bearer")


@router.post("/logout")
@router.post("/logout/", include_in_schema=False)
async def logout(request: Request, user_id: str = Depends(shared_require_session)):
    # Xóa trạng thái online
    if user_id:
        manager.mark_offline(user_id)
    request.session.clear()
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(request: Request, user_id: str = Depends(shared_require_session)):
    db = get_database()
    try:
        return await get_user_by_id(db, user_id, is_online=True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest, 
    request: Request, 
    user_id: str = Depends(shared_require_session)
):
    db = get_database()
    try:
        return await update_user(
            db, 
            user_id, 
            bio=body.bio, 
            age=body.age, 
            gender=body.gender
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/me/avatar", response_model=UserResponse)
async def upload_my_avatar(
    request: Request, 
    file: UploadFile = File(...),
    user_id: str = Depends(shared_require_session)
):
    """Upload ảnh đại diện. Tự động crop vuông 400x400 qua Cloudinary."""
    db = get_database()

    avatar_url = await upload_avatar(file, user_id)
    try:
        return await update_user(db, user_id, avatar_url=avatar_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
