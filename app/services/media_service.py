"""
Media Service — Cloudinary Upload
Hỗ trợ upload ảnh (≤10MB) và video (≤50MB).
Trả về URL công khai để lưu vào bài đăng hoặc avatar.
"""

import io
import hashlib
import time
import hmac
import httpx
import logging
import anyio
import mimetypes
import os
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile, HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)
DEV_UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "media" / "uploads"
AVATAR_UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "media" / "avatars"
# ── Constants ─────────────────────────────────────────────────

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024   # 10 MB
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # Tăng lên 100 MB cho Video


def _validate_file(file: UploadFile, content: bytes) -> str:
    """Kiểm tra MIME type và kích thước. Trả về 'image' hoặc 'video'.

    Cho phép linh hoạt dựa trên MIME type và phần mở rộng file.
    """
    if not content:
        raise HTTPException(status_code=400, detail="File is empty or corrupted")

    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()
    file_size = len(content)

    # Kiểm tra Ảnh: MIME image/* hoặc các đuôi phổ biến
    if content_type.startswith("image/") or filename.endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif')):
        if file_size > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail=f"Image too large. Max: {MAX_IMAGE_BYTES // (1024*1024)}MB")
        return "image"

    # Kiểm tra Video: MIME video/* hoặc các đuôi phổ biến (mp4, mov, webm...)
    is_video_mime = content_type.startswith("video/") or content_type in ALLOWED_VIDEO_TYPES
    is_video_ext = filename.endswith(('.mp4', '.mov', '.webm', '.avi', '.mkv'))

    if is_video_mime or is_video_ext:
        if file_size > MAX_VIDEO_BYTES:
            raise HTTPException(status_code=413, detail=f"Video too large. Max: {MAX_VIDEO_BYTES // (1024*1024)}MB")
        return "video"

    raise HTTPException(
        status_code=415,
        detail=f"Unsupported media type: {content_type}. Allowed: image/*, video/*"
    )


def _make_signature(params: dict, api_secret: str) -> str:
    """Tạo chữ ký SHA-1 cho Cloudinary upload."""
    sorted_params = "&".join(
        f"{k}={v}" for k, v in sorted(params.items())
    )
    to_sign = sorted_params + api_secret
    return hashlib.sha1(to_sign.encode()).hexdigest()


async def upload_media(file: UploadFile, user_id: str, folder: str = "posts") -> dict:
    """
    Upload file lên Cloudinary.
    Trả về { url, media_type, public_id, width, height (nếu là ảnh) }.
    
    Nếu Cloudinary chưa cấu hình (dev), trả về mock URL.
    """
    logger.info(
        "Media upload request: user_id=%s filename=%s content_type=%s folder=%s",
        user_id,
        file.filename,
        file.content_type,
        folder,
    )

    content = await file.read()
    logger.info("Media upload: read %d bytes, client content_type=%s", len(content), file.content_type)
    media_type = _validate_file(file, content)

    # Dev mode: Cloudinary chưa cấu hình
    if not settings.cloudinary_cloud_name:
        if settings.app_env.lower() in {"development", "dev", "local"}:
            logger.warning("Cloudinary not configured in %s — saving locally", settings.app_env)
            local_dir = DEV_UPLOAD_ROOT / folder / user_id
            local_dir.mkdir(parents=True, exist_ok=True)
            # Đảm bảo quyền ghi cho thư mục local (đặc biệt hữu ích trên môi trường dev)
            os.chmod(local_dir, 0o777)

            suffix = Path(file.filename or "upload").suffix.lower() or ".bin"
            local_name = f"{int(time.time())}_{uuid4().hex}{suffix}"
            local_path = local_dir / local_name
            
            try:
                await anyio.to_thread.run_sync(local_path.write_bytes, content)
                logger.info("Successfully saved file locally at %s", local_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail="Could not save file locally")

            # Trả về đường dẫn chuẩn /media/uploads/... (Requirement 6)
            return {
                "media_url": f"/media/uploads/{folder}/{user_id}/{local_name}",
                "media_type": media_type,
                "public_id": f"local/{folder}/{user_id}/{local_name}",
            }

        logger.error("Cloudinary configuration missing in non-development environment")
        raise HTTPException(status_code=503, detail="Media storage is not configured")

    # Cloudinary signed upload
    timestamp = int(time.time())
    public_id = f"{folder}/{user_id}/{timestamp}"

    sign_params = {
        "folder": folder,
        "public_id": public_id,
        "timestamp": timestamp,
    }
    # Lưu ý: resource_type KHÔNG được nằm trong signature của Cloudinary
    signature = _make_signature(sign_params, settings.cloudinary_api_secret)

    # Endpoint của Cloudinary phân biệt image/video hoặc dùng 'auto'
    upload_url = (
        f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}"
        f"/{media_type}/upload" 
    )

    form_data = {
        "api_key": settings.cloudinary_api_key,
        "timestamp": str(timestamp),
        "signature": signature,
        "folder": folder,
        "public_id": public_id,
        "resource_type": media_type
    }

    # Xác định MIME type chuẩn để gửi lên Cloudinary
    mime_type = file.content_type
    if not mime_type or mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(file.filename or "")[0] or "video/mp4"

    files = {"file": (file.filename, io.BytesIO(content), mime_type)}

    try:
        # Fix lỗi 502 trên Render bằng cách sử dụng follow_redirects và timeout dài
        async with httpx.AsyncClient(timeout=180.0, follow_redirects=True) as client:
            resp = await client.post(upload_url, data=form_data, files=files)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"Cloudinary upload error: {e.response.text}")
        raise HTTPException(status_code=502, detail="Media upload failed")
    except Exception as e:
        logger.error(f"Cloudinary upload exception: {e}")
        raise HTTPException(status_code=502, detail="Media upload failed")

    result = {
        "media_url": data["secure_url"],
        "media_type": media_type,
        "public_id": data["public_id"],
    }
    if media_type == "image":
        result["width"] = data.get("width")
        result["height"] = data.get("height")

    return result


async def upload_avatar(file: UploadFile, user_id: str) -> str:
    """Upload avatar — chỉ ảnh, crop vuông, trả về URL."""
    content = await file.read()
    content_type = (file.content_type or "").lower()
    filename = (file.filename or "").lower()

    if not content_type.startswith("image/") and not filename.endswith(('.jpg', '.jpeg', '.png', '.webp')):
        raise HTTPException(status_code=415, detail="Avatar must be an image (JPEG, PNG, WEBP)")
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Avatar must be ≤ 10MB")

    if not settings.cloudinary_cloud_name:
        logger.warning("Cloudinary not configured — saving avatar locally")
        AVATAR_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        
        local_name = f"{user_id}.jpg"
        local_path = AVATAR_UPLOAD_ROOT / local_name
        
        try:
            await anyio.to_thread.run_sync(local_path.write_bytes, content)
        except Exception as e:
            logger.error(f"Failed to save avatar locally: {e}")
            raise HTTPException(status_code=500, detail="Could not save avatar locally")
            
        base_url = getattr(settings, "base_url", "http://localhost:8000").rstrip("/")
        return f"{base_url}/media/avatars/{local_name}"

    timestamp = int(time.time())
    public_id = f"avatars/{user_id}"

    sign_params = {
        "folder": "avatars",
        "public_id": public_id,
        "timestamp": timestamp,
        "transformation": "c_fill,g_face,h_400,w_400",
    }
    signature = _make_signature(sign_params, settings.cloudinary_api_secret)

    upload_url = (
        f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}/image/upload"
    )
    form_data = {
        "api_key": settings.cloudinary_api_key,
        "timestamp": str(timestamp),
        "signature": signature,
        "folder": "avatars",
        "public_id": public_id,
        "transformation": "c_fill,g_face,h_400,w_400",
    }
    files = {"file": (file.filename, io.BytesIO(content), file.content_type)}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(upload_url, data=form_data, files=files)
            resp.raise_for_status()
            return resp.json()["secure_url"]
    except Exception as e:
        logger.error(f"Avatar upload failed: {e}")
        raise HTTPException(status_code=502, detail="Avatar upload failed")
