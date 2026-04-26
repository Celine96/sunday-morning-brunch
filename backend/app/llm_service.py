"""LLM service for sentiment classification and reply generation."""
import asyncio
import os
import json
from anthropic import Anthropic

client = None


def get_client() -> Anthropic:
    global client
    if client is None:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set.")
        client = Anthropic(api_key=api_key)
    return client


async def classify_sentiment(review_text: str, rating: int = None) -> dict:
    """Classify review sentiment using Claude Haiku.

    Returns: {"sentiment": "positive|negative|inquiry|other", "confidence": 0.0-1.0}
    """
    rating_hint = f"\n별점: {rating}/5" if rating else ""
    user_message = f"""다음 고객 리뷰의 감성을 분류해주세요.{rating_hint}

리뷰: "{review_text}"

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{"sentiment": "positive|negative|inquiry|other", "confidence": 0.0~1.0}}

분류 기준:
- positive: 만족, 칭찬, 감사 등 긍정적인 내용
- negative: 불만, 불량, 실망 등 부정적인 내용
- inquiry: 질문, 문의, 요청 등
- other: 위 세 가지에 해당하지 않는 경우"""

    try:
        c = get_client()
        response = await asyncio.to_thread(
            c.messages.create,
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text.strip()
        result = json.loads(text)
        return {
            "sentiment": result.get("sentiment", "other"),
            "confidence": float(result.get("confidence", 0.5)),
        }
    except Exception as e:
        print(f"Sentiment classification error: {e}")
        # Fallback: simple heuristic
        return _fallback_sentiment(review_text, rating)


def _fallback_sentiment(review_text: str, rating: int = None) -> dict:
    """Simple fallback sentiment classification."""
    text = review_text.lower()
    negative_words = ["불만", "실망", "최악", "환불", "반품", "불량", "나쁘", "별로", "형편없", "짜증"]
    positive_words = ["좋", "만족", "최고", "감사", "추천", "편안", "완벽", "사랑", "행복", "훌륭"]
    inquiry_words = ["문의", "궁금", "질문", "가능", "언제", "어떻게", "교환", "사이즈"]

    neg_count = sum(1 for w in negative_words if w in text)
    pos_count = sum(1 for w in positive_words if w in text)
    inq_count = sum(1 for w in inquiry_words if w in text)

    if rating and rating <= 2:
        neg_count += 2
    elif rating and rating >= 4:
        pos_count += 2

    if inq_count > pos_count and inq_count > neg_count:
        return {"sentiment": "inquiry", "confidence": 0.6}
    elif neg_count > pos_count:
        return {"sentiment": "negative", "confidence": 0.7}
    elif pos_count > neg_count:
        return {"sentiment": "positive", "confidence": 0.7}
    else:
        return {"sentiment": "other", "confidence": 0.5}


async def generate_reply(
    review_text: str,
    sentiment: str,
    system_prompt: str,
    rating: int = None,
    product_name: str = None,
    num_candidates: int = 3,
) -> list[str]:
    """Generate multiple reply candidates using Claude Sonnet.

    Returns a list of reply candidates.
    """
    context_parts = []
    if product_name:
        context_parts.append(f"상품명: {product_name}")
    if rating:
        context_parts.append(f"별점: {rating}/5")
    context_parts.append(f"감성 분류: {sentiment}")

    context = "\n".join(context_parts)

    user_message = f"""다음 고객 리뷰에 대한 브랜드 대댓글을 {num_candidates}개 작성해주세요.
모든 대댓글은 동일한 톤을 유지하되, 표현 방식과 문장 구성을 다르게 해주세요. 브랜드 톤 가이드를 따라야 합니다.

[필수 정책]
- 교환, 환불, 반품 등 구체적인 보상/처리 방법을 직접 언급하지 마세요.
- 대신 "고객센터로 연락 주시면 빠르게 도와드리겠습니다"와 같이 고객센터 연락으로 유도하세요.
- 부정 리뷰에 대해서도 공감과 사과 후, 구체적 해결책은 고객센터를 통해 안내한다는 방향으로 작성하세요.

{context}

고객 리뷰: "{review_text}"

다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{{"replies": ["대댓글1", "대댓글2", "대댓글3"]}}"""

    try:
        c = get_client()
        response = await asyncio.to_thread(
            c.messages.create,
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
        text = response.content[0].text.strip()
        result = json.loads(text)
        candidates = result.get("replies", [text])
        # 항상 num_candidates 개수 보장
        while len(candidates) < num_candidates:
            candidates.append(candidates[-1] if candidates else "")
        return candidates[:num_candidates]
    except Exception as e:
        print(f"Reply generation error: {e}")
        fallback = _fallback_reply(review_text, sentiment)
        return [fallback] * num_candidates


def _fallback_reply(review_text: str, sentiment: str) -> str:
    """Fallback reply when LLM is unavailable."""
    if sentiment == "positive":
        return "안녕하세요, 고객님! 소중한 후기 남겨주셔서 정말 감사합니다 😊 만족스러운 경험을 드릴 수 있어 저희도 기쁩니다. 앞으로도 좋은 제품으로 보답하겠습니다!"
    elif sentiment == "negative":
        return "안녕하세요, 고객님. 불편을 드려 진심으로 죄송합니다 😔 말씀해 주신 부분 꼼꼼히 확인하여 개선하겠습니다. 고객센터로 연락 주시면 빠르게 도와드리겠습니다."
    elif sentiment == "inquiry":
        return "안녕하세요, 고객님! 문의 감사합니다 😊 해당 사항에 대해 자세히 안내드리겠습니다. 추가 궁금한 점이 있으시면 편하게 말씀해 주세요!"
    else:
        return "안녕하세요, 고객님! 소중한 의견 감사합니다 😊 더 나은 서비스를 위해 항상 노력하겠습니다. 오늘도 편안한 하루 되세요!"


async def generate_tone_preview(system_prompt: str) -> list:
    """Generate preview replies for tone profile testing."""
    test_reviews = [
        {"text": "배송이 빨라서 좋았어요! 품질도 괜찮네요.", "sentiment": "positive"},
        {"text": "색상이 사진과 달라요. 교환 가능한가요?", "sentiment": "inquiry"},
        {"text": "선물용으로 포장 가능한가요?", "sentiment": "inquiry"},
    ]

    previews = []
    for review in test_reviews:
        candidates = await generate_reply(
            review_text=review["text"],
            sentiment=review["sentiment"],
            system_prompt=system_prompt,
        )
        reply_text = candidates[0] if isinstance(candidates, list) else candidates
        previews.append({
            "review": review["text"],
            "sentiment": review["sentiment"],
            "reply": reply_text,
        })

    return previews
