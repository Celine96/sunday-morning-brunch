"""Shop API router - Products, Reviews, Replies CRUD."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models import Product, Review, Reply, ReplyHistory
from ..schemas import (
    ProductSummary,
    ProductDetail,
    ReviewOut,
    ReplyOut,
    ReplyCreate,
    ReplyUpdate,
)

router = APIRouter(prefix="/api", tags=["shop"])


@router.get("/products", response_model=dict)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=200),
    db: Session = Depends(get_db),
):
    total = db.query(Product).count()
    products = (
        db.query(Product)
        .order_by(Product.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "products": [ProductSummary.model_validate(p) for p in products],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/products/{product_id}", response_model=ProductDetail)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductDetail.model_validate(product)


@router.get("/products/{product_id}/reviews", response_model=dict)
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    reviews = (
        db.query(Review)
        .filter(Review.product_id == product_id)
        .order_by(Review.created_at.desc())
        .all()
    )
    return {"reviews": [ReviewOut.model_validate(r) for r in reviews]}


@router.get("/reviews/unreplied", response_model=dict)
def get_unreplied_reviews(
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get reviews that have no replies (for FAB mini panel)."""
    query = db.query(Review).outerjoin(Reply).filter(Reply.id.is_(None))
    if product_id is not None:
        query = query.filter(Review.product_id == product_id)
    reviews = query.order_by(Review.created_at.desc()).all()
    return {"reviews": [ReviewOut.model_validate(r) for r in reviews]}


@router.post("/reviews/{review_id}/replies", response_model=ReplyOut)
def create_reply(review_id: int, body: ReplyCreate, db: Session = Depends(get_db)):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    reply = Reply(
        review_id=review_id,
        content=body.content,
        author="Sunday Morning Brunch",
        status="published",
        published_at=datetime.now(timezone.utc),
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    return ReplyOut.model_validate(reply)


@router.get("/reviews/{review_id}/replies", response_model=dict)
def get_review_replies(review_id: int, db: Session = Depends(get_db)):
    replies = (
        db.query(Reply)
        .filter(Reply.review_id == review_id)
        .order_by(Reply.created_at.desc())
        .all()
    )
    return {"replies": [ReplyOut.model_validate(r) for r in replies]}


@router.put("/replies/{reply_id}", response_model=ReplyOut)
def update_reply(reply_id: int, body: ReplyUpdate, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    reply.content = body.content
    reply.updated_at = datetime.now(timezone.utc)
    history = ReplyHistory(reply_id=reply.id, action="edited", content_snapshot=body.content)
    db.add(history)
    db.commit()
    db.refresh(reply)
    return ReplyOut.model_validate(reply)


@router.delete("/replies/{reply_id}")
def delete_reply(reply_id: int, db: Session = Depends(get_db)):
    reply = db.query(Reply).filter(Reply.id == reply_id).first()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    db.delete(reply)
    db.commit()
    return {"success": True}
