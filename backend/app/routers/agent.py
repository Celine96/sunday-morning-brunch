"""Agent API router - Tone profile, reply generation, publishing."""
import asyncio
import json
import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timezone
from typing import Optional

from ..database import get_db
from ..models import ToneProfile, Reply, Review, ReplyHistory
from ..schemas import (
    ToneProfileCreate,
    ToneProfileOut,
    ToneProfilePreview,
    GenerateRequest,
    GenerateResponse,
    BatchGenerateRequest,
    BatchGenerateResponse,
    ConfirmResponse,
    PublishResponse,
    RegenerateResponse,
    ReplyOut,
    ReplyUpdate,
    HistoryItemOut,
    ReviewOut,
)
from ..llm_service import classify_sentiment, generate_reply, generate_tone_preview
from ..seed import build_system_prompt

router = APIRouter(prefix="/api/agent", tags=["agent"])

TONE_OVERRIDES = {
    "friendly": "캐주얼하고 따뜻한 톤. 고객과의 거리를 좁히는 친근한 존댓말을 사용한다. 일상적이고 편안한 느낌.",
    "professional": "격식 있고 신뢰감 있는 톤. 정확한 정보 전달과 전문성을 강조한다. 이모지를 사용하지 않는다.",
    "emotional": "고객의 감정에 깊이 공감하는 톤. 진심 어린 감사와 따뜻한 위로를 전달한다. 적절한 이모지 활용.",
}


def _get_tone_profile(db: Session) -> ToneProfile:
    """Get the active tone profile."""
    profile = db.query(ToneProfile).order_by(ToneProfile.id.desc()).first()
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="톤 프로필이 설정되지 않았습니다. 먼저 톤 설정을 완료해주세요.",
        )
    return profile


def _add_history(db: Session, reply_id: int, action: str, content: str):
    """Add a history record."""
    history = ReplyHistory(
        reply_id=reply_id,
        action=action,
        content_snapshot=content,
    )
    db.add(history)


@router.post("/tone-profile", response_model=ToneProfilePreview)
async def create_tone_profile(body: ToneProfileCreate, db: Session = Depends(get_db)):
    if not body.brand_name:
        raise HTTPException(status_code=400, detail="브랜드명은 필수입니다.")
    if not body.keywords or len(body.keywords) < 1:
        raise HTTPException(status_code=400, detail="톤 키워드를 최소 1개 이상 입력해주세요.")

    # Load persona data from brand_persona.json
    persona = None
    persona_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "data",
        "brand_persona.json",
    )
    try:
        with open(persona_path, "r", encoding="utf-8") as f:
            persona = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    system_prompt = build_system_prompt(
        brand_name=body.brand_name,
        keywords=body.keywords,
        sample_replies=body.sample_replies,
        persona=persona,
    )

    # Update existing or create new
    existing = db.query(ToneProfile).first()
    if existing:
        existing.brand_name = body.brand_name
        existing.keywords = json.dumps(body.keywords, ensure_ascii=False)
        existing.sample_replies = json.dumps(body.sample_replies, ensure_ascii=False)
        existing.system_prompt = system_prompt
        existing.updated_at = datetime.now(timezone.utc)
        profile = existing
    else:
        profile = ToneProfile(
            brand_name=body.brand_name,
            keywords=json.dumps(body.keywords, ensure_ascii=False),
            sample_replies=json.dumps(body.sample_replies, ensure_ascii=False),
            system_prompt=system_prompt,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)

    # Generate preview replies
    try:
        previews = await generate_tone_preview(system_prompt)
    except Exception:
        previews = []

    return ToneProfilePreview(
        id=profile.id,
        brand_name=profile.brand_name,
        keywords=body.keywords,
        system_prompt=system_prompt,
        preview_replies=previews,
    )


@router.get("/tone-profile", response_model=ToneProfileOut)
def get_tone_profile(db: Session = Depends(get_db)):
    profile = db.query(ToneProfile).order_by(ToneProfile.id.desc()).first()
    if not profile:
        raise HTTPException(status_code=404, detail="톤 프로필이 설정되지 않았습니다.")
    return ToneProfileOut.model_validate(profile)


@router.post("/generate", response_model=GenerateResponse)
async def generate_single(body: GenerateRequest, db: Session = Depends(get_db)):
    profile = _get_tone_profile(db)

    # Classify sentiment
    sentiment_result = await classify_sentiment(body.review_text, body.rating)
    sentiment = sentiment_result["sentiment"]
    confidence = sentiment_result["confidence"]

    # Determine system prompt (with optional tone override)
    system_prompt = profile.system_prompt
    if body.tone_override and body.tone_override in TONE_OVERRIDES:
        system_prompt += f"\n\n[톤 변경 지시] 이번 대댓글은 다음 톤으로 작성하세요: {TONE_OVERRIDES[body.tone_override]}"

    # Generate 3 reply candidates
    candidates = await generate_reply(
        review_text=body.review_text,
        sentiment=sentiment,
        system_prompt=system_prompt,
        rating=body.rating,
        product_name=body.product_name,
        num_candidates=3,
    )

    # Save first candidate as draft
    draft = candidates[0]
    reply = Reply(
        review_id=body.review_id if body.review_id else None,
        content=draft,
        author=profile.brand_name,
        status="draft",
        sentiment=sentiment,
        confidence=confidence,
        source=body.source or "single",
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)

    _add_history(db, reply.id, "created", draft)
    db.commit()

    return GenerateResponse(
        reply_id=reply.id,
        draft_reply=draft,
        candidates=candidates,
        sentiment=sentiment,
        confidence=confidence,
    )


@router.post("/generate-batch", response_model=BatchGenerateResponse)
async def generate_batch(body: BatchGenerateRequest, db: Session = Depends(get_db)):
    profile = _get_tone_profile(db)

    # Classify all sentiments in parallel
    sentiment_tasks = [
        classify_sentiment(r.review_text, r.rating) for r in body.reviews
    ]
    sentiment_results = await asyncio.gather(*sentiment_tasks)

    # Generate replies in parallel (Haiku is fast enough for parallel)
    reply_tasks = []
    for review_req, sentiment_result in zip(body.reviews, sentiment_results):
        system_prompt = profile.system_prompt
        if review_req.tone_override and review_req.tone_override in TONE_OVERRIDES:
            system_prompt += f"\n\n[톤 변경 지시] 이번 대댓글은 다음 톤으로 작성하세요: {TONE_OVERRIDES[review_req.tone_override]}"
        reply_tasks.append(
            generate_reply(
                review_text=review_req.review_text,
                sentiment=sentiment_result["sentiment"],
                system_prompt=system_prompt,
                rating=review_req.rating,
                product_name=review_req.product_name,
                num_candidates=3,
            )
        )
    all_candidates = await asyncio.gather(*reply_tasks)

    results = []
    for review_req, sentiment_result, candidates in zip(body.reviews, sentiment_results, all_candidates):
        sentiment = sentiment_result["sentiment"]
        confidence = sentiment_result["confidence"]
        draft = candidates[0]

        reply = Reply(
            review_id=review_req.review_id if review_req.review_id else None,
            content=draft,
            author=profile.brand_name,
            status="draft",
            sentiment=sentiment,
            confidence=confidence,
            source=review_req.source or "batch",
        )
        db.add(reply)
        db.flush()

        _add_history(db, reply.id, "created", draft)

        results.append(
            GenerateResponse(
                reply_id=reply.id,
                draft_reply=draft,
                candidates=candidates,
                sentiment=sentiment,
                confidence=confidence,
            )
        )

    db.commit()
    return BatchGenerateResponse(results=results)


@router.put("/replies/{reply_id}", response_model=ReplyOut)
def update_agent_reply(reply_id: int, body: ReplyUpdate, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    reply.content = body.content
    reply.updated_at = datetime.now(timezone.utc)

    _add_history(db, reply.id, "edited", body.content)
    db.commit()
    db.refresh(reply)
    return ReplyOut.model_validate(reply)


@router.post("/replies/{reply_id}/confirm", response_model=ConfirmResponse)
def confirm_reply(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if not reply.content or not reply.content.strip():
        raise HTTPException(status_code=400, detail="빈 텍스트로 확정할 수 없습니다.")
    reply.status = "confirmed"
    reply.updated_at = datetime.now(timezone.utc)

    _add_history(db, reply.id, "confirmed", reply.content)
    db.commit()
    return ConfirmResponse(id=reply.id, status="confirmed")


@router.post("/replies/{reply_id}/publish", response_model=PublishResponse)
def publish_reply(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply.status == "published":
        raise HTTPException(status_code=400, detail="이미 게시된 대댓글입니다.")

    # Note: Frontend handles confirm->publish flow. This endpoint allows
    # publishing from any non-published status for flexibility.
    reply.status = "published"
    reply.published_at = datetime.now(timezone.utc)
    reply.updated_at = datetime.now(timezone.utc)

    _add_history(db, reply.id, "published", reply.content)
    db.commit()
    db.refresh(reply)

    return PublishResponse(
        id=reply.id,
        status="published",
        shop_reply_id=reply.id,
    )


@router.post("/replies/{reply_id}/unpublish", response_model=ReplyOut)
def unpublish_reply(reply_id: int, db: Session = Depends(get_db)):
    """Revert a published reply back to draft status."""
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply.status != "published":
        raise HTTPException(status_code=400, detail="게시된 대댓글만 게시 취소할 수 있습니다.")
    reply.status = "draft"
    reply.published_at = None
    reply.updated_at = datetime.now(timezone.utc)

    _add_history(db, reply.id, "unpublished", reply.content)
    db.commit()
    db.refresh(reply)
    return ReplyOut.model_validate(reply)


@router.post("/replies/{reply_id}/regenerate", response_model=RegenerateResponse)
async def regenerate_reply(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    profile = _get_tone_profile(db)

    # Find the original review
    review = db.query(Review).filter(Review.id == reply.review_id).first()
    if not review:
        raise HTTPException(status_code=400, detail="원본 리뷰를 찾을 수 없어 재생성할 수 없습니다.")
    review_text = review.content

    # Re-classify and regenerate
    sentiment_result = await classify_sentiment(review_text, review.rating)
    sentiment = sentiment_result["sentiment"]

    candidates = await generate_reply(
        review_text=review_text,
        sentiment=sentiment,
        system_prompt=profile.system_prompt,
        rating=review.rating,
        num_candidates=1,
    )
    new_draft = candidates[0] if isinstance(candidates, list) else candidates

    reply.content = new_draft
    reply.sentiment = sentiment
    reply.confidence = sentiment_result["confidence"]
    reply.status = "draft"
    reply.updated_at = datetime.now(timezone.utc)

    _add_history(db, reply.id, "created", new_draft)
    db.commit()

    return RegenerateResponse(
        id=reply.id,
        new_draft_reply=new_draft,
        sentiment=sentiment,
    )


@router.get("/history", response_model=dict)
def get_history(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    base_query = db.query(Reply)
    if status:
        base_query = base_query.filter(Reply.status == status)

    total = base_query.count()
    replies = (
        base_query
        .options(joinedload(Reply.review))
        .order_by(Reply.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    history_items = []
    for reply in replies:
        review = reply.review
        review_summary = review.content[:50] + "..." if review and len(review.content) > 50 else (review.content if review else "")
        history_items.append({
            "id": reply.id,
            "review_id": reply.review_id,
            "review_summary": review_summary,
            "reply_text": (reply.content[:50] + "..." if len(reply.content) > 50 else reply.content) if reply.content else "",
            "full_reply_text": reply.content or "",
            "sentiment": reply.sentiment,
            "status": reply.status,
            "created_at": reply.created_at.isoformat() if reply.created_at else None,
            "updated_at": reply.updated_at.isoformat() if reply.updated_at else None,
            "published_at": reply.published_at.isoformat() if reply.published_at else None,
            "source": reply.source or "single",
        })

    return {"history": history_items, "total": total, "page": page, "page_size": page_size}


@router.get("/history/{reply_id}", response_model=dict)
def get_history_detail(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    review = db.query(Review).filter(Review.id == reply.review_id).first()
    history = (
        db.query(ReplyHistory)
        .filter(ReplyHistory.reply_id == reply_id)
        .order_by(ReplyHistory.created_at.asc())
        .all()
    )

    return {
        "reply": ReplyOut.model_validate(reply),
        "review": ReviewOut.model_validate(review) if review else None,
        "history": [HistoryItemOut.model_validate(h) for h in history],
    }
