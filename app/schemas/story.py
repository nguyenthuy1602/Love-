from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class StoryCreateRequest(BaseModel):
    media_url: str = Field(..., description="URL của ảnh hoặc video")
    text: Optional[str] = Field(None, max_length=200)

class StoryViewer(BaseModel):
    user_id: str
    username: str
    avatar_url: Optional[str] = None

class StoryReaction(BaseModel):
    user_id: str
    reaction_type: str # heart, haha, wow, v.v.

class StoryResponse(BaseModel):
    id: str
    user_id: str
    username: str
    avatar_url: Optional[str] = None
    media_url: Optional[str] = None
    media_type: str = "image"
    text: Optional[str] = None
    viewers: List[StoryViewer] = []
    reactions: List[StoryReaction] = []
    created_at: datetime
    expires_at: datetime
    is_mine: bool = False

class StoryFeedResponse(BaseModel):
    stories: List[StoryResponse]
    total: int