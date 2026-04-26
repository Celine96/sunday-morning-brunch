import json
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


# --- Product Schemas ---
class ReplyOut(BaseModel):
    id: int
    review_id: int
    content: str
    author: str
    status: str
    sentiment: Optional[str] = None
    confidence: Optional[float] = None
    source: Optional[str] = "single"
    created_at: datetime
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReviewOut(BaseModel):
    id: int
    product_id: int
    author: str
    rating: int
    content: str
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    created_at: datetime
    replies: List[ReplyOut] = []

    model_config = {"from_attributes": True}


class ProductSummary(BaseModel):
    id: int
    name: str
    price: float
    image_url: Optional[str] = None
    category: Optional[str] = None
    rating: Optional[float] = None
    review_count: int = 0

    model_config = {"from_attributes": True}


class ProductDetail(ProductSummary):
    description: Optional[str] = None
    reviews: List[ReviewOut] = []

    model_config = {"from_attributes": True}


# --- Reply Schemas ---
class ReplyCreate(BaseModel):
    content: str = Field(..., min_length=1)


class ReplyUpdate(BaseModel):
    content: str = Field(..., min_length=1)


# --- Tone Profile Schemas ---
class ToneProfileCreate(BaseModel):
    brand_name: str
    keywords: List[str]
    sample_replies: List[str] = []


class ToneProfileOut(BaseModel):
    id: int
    brand_name: str
    keywords: List[str]
    sample_replies: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @field_validator("keywords", mode="before")
    @classmethod
    def parse_keywords(cls, v: object) -> List[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                pass
            return [v]
        return v  # type: ignore[return-value]

    @field_validator("sample_replies", mode="before")
    @classmethod
    def parse_sample_replies(cls, v: object) -> Optional[List[str]]:
        if v is None:
            return None
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                pass
            return [v]
        return v  # type: ignore[return-value]


class ToneProfilePreview(BaseModel):
    id: int
    brand_name: str
    keywords: List[str]
    system_prompt: str
    preview_replies: List[dict] = []


# --- Agent Schemas ---
class GenerateRequest(BaseModel):
    review_text: str = Field(..., min_length=10)
    rating: Optional[int] = Field(None, ge=1, le=5)
    product_name: Optional[str] = None
    review_id: Optional[int] = None
    source: Optional[str] = "single"  # single / batch / fab
    tone_override: Optional[str] = None  # friendly / professional / emotional — 기본 톤 대신 사용


class GenerateResponse(BaseModel):
    reply_id: int
    draft_reply: str
    candidates: List[str]
    sentiment: str
    confidence: float


class BatchGenerateRequest(BaseModel):
    reviews: List[GenerateRequest] = Field(..., max_length=50)


class BatchGenerateResponse(BaseModel):
    results: List[GenerateResponse]


class ConfirmResponse(BaseModel):
    id: int
    status: str


class PublishResponse(BaseModel):
    id: int
    status: str
    shop_reply_id: Optional[int] = None


class RegenerateResponse(BaseModel):
    id: int
    new_draft_reply: str
    sentiment: str


# --- History Schemas ---
class HistoryItemOut(BaseModel):
    id: int
    reply_id: int
    action: str
    content_snapshot: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class HistoryDetailOut(BaseModel):
    reply: ReplyOut
    review: ReviewOut
    history: List[HistoryItemOut]
