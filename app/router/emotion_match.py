from fastapi import APIRouter, HTTPException, Request, Query
from typing import List
from app.core.deps import require_session
from app.db.mongodb import get_database
from app.schemas.match import MatchResponse
from app.services.emotion_match_service import suggest_emotion_random

router = APIRouter(prefix="/match", tags=["Emotion Matching Extension"])

@router.get("/emotion-random", response_model=List[MatchResponse])
async def get_emotion_random_match(
    request: Request, 
    limit: int = Query(10, ge=1, le=20)
):
    """
    API mới: Ghép đôi ngẫu nhiên dựa trên trạng thái cảm xúc hiện tại.
    """
    user_id = require_session(request)
    db = get_database()
    try:
        return await suggest_emotion_random(db, user_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))