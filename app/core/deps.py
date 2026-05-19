"""
Shared dependencies dùng chung cho tất cả router.
"""
import logging
from fastapi import HTTPException, Request, Depends
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId # Import ObjectId
from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

# Định nghĩa OAuth2 scheme trỏ tới endpoint login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

def require_session(request: Request, token: str = Depends(oauth2_scheme)) -> str:
    """
    Trả về user_id nếu đã login. 
    Ưu tiên JWT token từ OAuth2 scheme, sau đó fallback xuống Session cookie.
    """
    # 1. Kiểm tra Token từ Header (Authorization: Bearer ...)
    if token and token.lower() not in ["undefined", "null", ""]:
        user_id = decode_access_token(token)
        if user_id and ObjectId.is_valid(user_id):
            return user_id
        
        # Fallback cho development nếu gửi ObjectId thô
        if ObjectId.is_valid(token):
            return token

    # 2. Fallback kiểm tra Session (Cookie)
    user_id = request.session.get("user_id")
    if not user_id:
        logger.warning(f"Session not found for {request.url.path}")
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


async def require_session_full(request: Request, user_id: str = Depends(require_session)) -> tuple[str, str]:
    """
    Trả về (user_id, username) nếu đã login.
    """
    # Lấy username từ session nếu có, hoặc fetch từ DB nếu dùng Token
    username = request.session.get("username") 
    
    if not username or not ObjectId.is_valid(user_id):
        # Kiểm tra tính hợp lệ của user_id để tránh lỗi crash 500 khi gọi ObjectId()
        if not ObjectId.is_valid(user_id):
            logger.warning(f"Invalid user_id in session: {user_id}")
            raise HTTPException(status_code=401, detail="Session không hợp lệ, vui lòng đăng nhập lại")
            
        from app.db.mongodb import get_database
        db = get_database()
        user = await db.users.find_one({"_id": ObjectId(user_id)}, {"username": 1})
        username = user.get("username", "user") if user else "user"
        
    return user_id, username
