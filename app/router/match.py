from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List

from app.db.mongodb import get_database as get_db
from app.core.deps import require_session

from app.schemas.match import MatchRequest, MatchResponse
from app.services.matching_service import (
    suggest_by_sentiment,
    suggest_random,
    get_my_matches,
)

router = APIRouter(prefix="/match", tags=["match"])


@router.get("/suggest")
async def suggest_sentiment_match(
    limit: int = 10,
    db: AsyncIOMotorDatabase = Depends(get_db),
    user_id: str = Depends(require_session),
):
    try:
        return await suggest_by_sentiment(db, user_id, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/random")
async def random_match(
    limit: int = 10,
    db: AsyncIOMotorDatabase = Depends(get_db),
    user_id: str = Depends(require_session),
):
    try:
        return await suggest_random(db, user_id, limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/dislike")
async def dislike_user(
    body: dict,
    user_id: str = Depends(require_session)
):
    return {
        "success": True
    }