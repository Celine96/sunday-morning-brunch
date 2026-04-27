"""Seed the database with products and reviews from CSV files."""
import csv
import json
import os
import re
from datetime import datetime, timezone

from .database import engine, SessionLocal, Base
from .models import Product, Review, ToneProfile


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")


def parse_rating(rating_str: str) -> float:
    """Extract numeric rating from string like '4 out of 5 stars'."""
    if not rating_str:
        return 0.0
    match = re.search(r"([\d.]+)", str(rating_str))
    return float(match.group(1)) if match else 0.0


def parse_review_count(count_str: str) -> int:
    """Extract numeric review count from string like '305,325 ratings'."""
    if not count_str:
        return 0
    cleaned = re.sub(r"[^\d]", "", str(count_str))
    return int(cleaned) if cleaned else 0


def parse_images(images_str: str) -> str:
    """Extract first image URL from JSON-like array string."""
    if not images_str:
        return ""
    try:
        images = json.loads(images_str.replace("'", '"'))
        return images[0] if images else ""
    except (json.JSONDecodeError, IndexError):
        return ""


def map_sentiment(score: float, review_type: str) -> str:
    """Map sentiment score and review type to category."""
    if review_type and "문의" in review_type:
        return "inquiry"
    if score is not None:
        if score >= 0.6:
            return "positive"
        elif score <= 0.3:
            return "negative"
        elif 0.3 < score < 0.6:
            return "inquiry"
    return "other"


def seed_database():
    """Create tables and seed data."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Only seed if no products exist
        if db.query(Product).count() > 0:
            print("Database already seeded, skipping.")
            db.close()
            return

        # Load products
        products_path = os.path.join(DATA_DIR, "products_ko.csv")
        product_map = {}  # asin -> product_id

        with open(products_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                product = Product(
                    asin=row["asin"],
                    name=row["title_ko"],
                    description=row.get("about_item", ""),
                    price=float(row["price_value"]) if row.get("price_value") else 0,
                    image_url=parse_images(row.get("all_images", "")),
                    category=row.get("breadcrumbs_ko", ""),
                    rating=parse_rating(row.get("rating_stars", "")),
                    review_count=parse_review_count(row.get("rating_count", "")),
                )
                db.add(product)
                db.flush()
                product_map[row["asin"]] = product.id

        # Load reviews
        reviews_path = os.path.join(DATA_DIR, "reviews_ko.csv")
        with open(reviews_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                product_asin = row.get("productASIN", "")
                product_id = product_map.get(product_asin)
                if not product_id:
                    continue

                score_str = row.get("sentiment_score", "0.5")
                try:
                    score = float(score_str)
                except (ValueError, TypeError):
                    score = 0.5

                review = Review(
                    product_id=product_id,
                    author=f"고객{row.get('reviewID', '')[-4:]}",
                    rating=int(float(row.get("rating", 3))),
                    content=row.get("reviewText_ko", ""),
                    sentiment=map_sentiment(score, row.get("review_type", "")),
                    sentiment_score=score,
                    review_type=row.get("review_type", ""),
                    created_at=datetime.now(timezone.utc),
                )
                db.add(review)

        # Load default tone profile from brand_persona.json
        persona_path = os.path.join(DATA_DIR, "brand_persona.json")
        presets_path = os.path.join(DATA_DIR, "brand_tone_presets.json")

        with open(persona_path, "r", encoding="utf-8") as f:
            persona = json.load(f)

        with open(presets_path, "r", encoding="utf-8") as f:
            presets = json.load(f)

        # Find the emotional preset (default)
        emotional_preset = None
        for preset in presets.get("presets", []):
            if preset["id"] == "emotional":
                emotional_preset = preset
                break

        sample_replies = []
        if emotional_preset:
            for sentiment_type in ["positive", "negative", "inquiry"]:
                sample = emotional_preset["sample_replies"].get(sentiment_type, {})
                if sample.get("reply"):
                    sample_replies.append(sample["reply"])

        system_prompt = build_system_prompt(
            brand_name=persona["brand_name"],
            keywords=persona["tone_keywords"],
            sample_replies=sample_replies,
            persona=persona,
        )

        tone_profile = ToneProfile(
            brand_name=persona["brand_name"],
            keywords=json.dumps(persona["tone_keywords"], ensure_ascii=False),
            sample_replies=json.dumps(sample_replies, ensure_ascii=False),
            system_prompt=system_prompt,
        )
        db.add(tone_profile)

        db.commit()
        print(f"Seeded {len(product_map)} products and reviews successfully.")
        print(f"Created default tone profile for '{persona['brand_name']}'.")

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def build_system_prompt(
    brand_name: str,
    keywords: list,
    sample_replies: list,
    persona: dict = None,
) -> str:
    """Build the system prompt for reply generation."""
    cs = persona.get("cs_persona", {}) if persona else {}
    principles = cs.get("principles", [])
    principles_text = "\n".join(f"- {p}" for p in principles)

    samples_text = ""
    if sample_replies:
        samples_text = "\n\n[참고 대댓글 예시]\n"
        for i, s in enumerate(sample_replies, 1):
            samples_text += f"{i}. {s}\n"

    prompt = f"""당신은 '{brand_name}'의 CS 담당자 '{cs.get("name", brand_name + " 팀")}'입니다.
브랜드 슬로건: "{persona.get('slogan', '')}"
브랜드 설명: {persona.get('description', '')}

[톤앤매너 키워드]
{', '.join(keywords)}

[CS 원칙]
{principles_text}

[인사말] {cs.get('greeting', '')}
[서명] {cs.get('signature', '')}
{samples_text}

[대댓글 생성 규칙]
1. 고객의 리뷰에 대해 브랜드 톤에 맞는 대댓글을 작성합니다.
2. 긍정 리뷰: 감사 표현 + 브랜드 가치 강화
3. 부정 리뷰: 공감 → 진심 어린 사과 → 해결 의지 표현
4. 문의 리뷰: 정확한 답변 + 친절한 안내
5. 대댓글은 2~4문장으로 간결하게 작성합니다.
6. 이모지는 적절히 사용하되 과하지 않게 (1~2개).
7. 반드시 존댓말을 사용합니다.
8. 대댓글만 작성하세요. 다른 설명이나 메타 텍스트는 포함하지 마세요."""

    return prompt


if __name__ == "__main__":
    seed_database()
