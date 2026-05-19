from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta, timezone
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

SECRET_KEY = settings.session_secret
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Token có hiệu lực 7 ngày

# Cấu hình Passlib để sử dụng bcrypt
pwd_context = CryptContext(
    schemes=["bcrypt"], 
    deprecated="auto",
    bcrypt__rounds=12 # Độ mạnh của hash
)

def hash_password(password: str) -> str:
    """Hash mật khẩu sử dụng passlib (bcrypt)."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Kiểm tra mật khẩu thô với hash từ DB."""
    if not plain or not hashed:
        return False
    try:
        # Đảm bảo hashed là string và không có khoảng trắng thừa (tránh lỗi 401 do copy-paste)
        if isinstance(hashed, bytes):
            hashed = hashed.decode("utf-8")
        
        clean_hash = hashed.strip()
        
        # Passlib verify sẽ tự động nhận diện thuật toán bcrypt từ chuỗi $2b$
        return pwd_context.verify(plain, clean_hash)
    except Exception as e:
        logger.error(f"[SECURITY] Bcrypt verification error: {str(e)}")
        logger.info("[SECURITY] Tip: This often happens with bcrypt 4.1.1+. Try downgrading to bcrypt 4.0.1")
        return False

def create_access_token(data: dict):
    """Tạo JWT Token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> str | None:
    """Giải mã và kiểm tra JWT Token. Trả về user_id."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError as e:
        logger.warning(f"JWT decode failed: {e}")
        return None