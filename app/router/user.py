from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ── Request schemas ──────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: Optional[str] = Field(None, description="Email người dùng")
    password: str = Field(..., min_length=6)
    bio: Optional[str] = Field(default=None, max_length=200)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = Field(default=None, pattern="^(male|female|other)$")


class UserLoginRequest(BaseModel):
    username: str  # Có thể chứa cả email hoặc username từ frontend
    password: str


class UserUpdateRequest(BaseModel):
    bio: Optional[str] = Field(default=None, max_length=200)
    age: Optional[int] = Field(default=None, ge=1, le=120)
    gender: Optional[str] = Field(default=None, pattern="^(male|female|other)$")


# ── Response schemas ─────────────────────────────────────────

class UserResponse(BaseModel):
    id: str
    username: str
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    sentiment_profile: Optional[str] = None   # positive / neutral / negative
    post_count: int = 0
    is_online: bool = False
    created_at: datetime


class LoginResponse(BaseModel):
    message: str
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse
