from sqlalchemy import Column, Integer, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asin = Column(Text, unique=True)
    name = Column(Text, nullable=False)
    description = Column(Text)
    price = Column(Float)
    image_url = Column(Text)
    category = Column(Text)
    rating = Column(Float)
    review_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    reviews = relationship("Review", back_populates="product", lazy="select")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    author = Column(Text)
    rating = Column(Integer)
    content = Column(Text, nullable=False)
    sentiment = Column(Text)  # positive / negative / inquiry / other
    sentiment_score = Column(Float)
    review_type = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="reviews")
    replies = relationship("Reply", back_populates="review", lazy="select")


class Reply(Base):
    __tablename__ = "replies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.id"), nullable=True)
    content = Column(Text, nullable=False)
    author = Column(Text, default="Sunday Morning Brunch")
    status = Column(Text, default="draft")  # draft / confirmed / published
    sentiment = Column(Text)
    confidence = Column(Float)
    source = Column(Text, default="single")  # single / batch / fab
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    published_at = Column(DateTime, nullable=True)

    review = relationship("Review", back_populates="replies")
    history = relationship("ReplyHistory", back_populates="reply", lazy="select", cascade="all, delete-orphan")


class ToneProfile(Base):
    __tablename__ = "tone_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_name = Column(Text, nullable=False)
    keywords = Column(Text)  # JSON array
    sample_replies = Column(Text)  # JSON array
    system_prompt = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ReplyHistory(Base):
    __tablename__ = "reply_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reply_id = Column(Integer, ForeignKey("replies.id"), nullable=False)
    action = Column(Text, nullable=False)  # created / edited / confirmed / published
    content_snapshot = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    reply = relationship("Reply", back_populates="history")
