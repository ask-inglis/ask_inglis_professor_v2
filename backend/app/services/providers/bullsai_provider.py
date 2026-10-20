"""BullsAI provider adapter.

Assumes an OpenAI-compatible chat-completions API. Confirm the protocol,
base URL, and model ID against the private UB BullsAI developer documentation.
No external sources are invented: reviews without supplied evidence stay needs_review.
"""
import json
import os
from typing import Literal, Optional

import httpx
from pydantic import BaseModel, Field, ValidationError


class AnatomySource(BaseModel):
    title: str
    url: str


class AnatomyReview(BaseModel):
    claim_id: int
    status: Literal["likely_correct", "possible_error", "needs_review"]
    reason: str
    suggested_correction: Optional[str] = None
    sources: list[AnatomySource] = Field(default_factory=list)


class AnatomyReviewBatch(BaseModel):
    reviews: list[AnatomyReview]


class _ModelAssessment(BaseModel):
    status: Literal["likely_correct", "possible_error", "needs_review"]
    reason: str
    suggested_correction: Optional[str] = None


def _request(prompt: str) -> str:
    key = os.getenv("BULLSAI_API_KEY")
    base_url = os.getenv("BULLSAI_BASE_URL", "").rstrip("/")
    model = os.getenv("BULLSAI_MODEL")
    if not key or not base_url or not model:
        raise RuntimeError("Set BULLSAI_API_KEY, BULLSAI_BASE_URL and BULLSAI_MODEL in the backend environment")
    # Set BULLSAI_BASE_URL to the API root (commonly ending in /v1),
    # not to the /chat/completions endpoint itself.
    with httpx.Client(timeout=90) as client:
        response = client.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "messages": [
                {"role": "system", "content": "You are a cautious academic anatomy reviewer. Reply with valid JSON only. Do not invent citations."},
                {"role": "user", "content": prompt},
            ], "temperature": 0.1},
        )
        response.raise_for_status()
        data = response.json()
    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("BullsAI returned an empty or unsupported response")
    return content.strip()


def _parse_json(text: str) -> _ModelAssessment:
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        return _ModelAssessment.model_validate(json.loads(text))
    except (ValueError, ValidationError) as exc:
        raise RuntimeError(f"BullsAI response was not valid structured review JSON: {exc}") from exc


def review_anatomy_claim(claim_text: str) -> AnatomyReview:
    prompt = f"""Review this statement from university anatomy lecture notes:
{claim_text}

Return a JSON object with keys status, reason, suggested_correction.
Allowed status: likely_correct, possible_error, needs_review.
Do not claim external verification or invent sources. No web sources are available.
If independent corroboration is necessary, choose needs_review.
If status is needs_review or likely_correct, suggested_correction must be null."""
    assessment = _parse_json(_request(prompt))
    # No independent evidence retrieval is connected to this provider.
    # Treat model output as a preliminary suggestion, not verified fact.
    return AnatomyReview(
        claim_id=1,
        status="needs_review",
        reason=f"Preliminary BullsAI assessment ({assessment.status}; not externally verified): {assessment.reason}",
        suggested_correction=assessment.suggested_correction,
        sources=[],
    )


def review_anatomy_claims(claims: list[dict]) -> AnatomyReviewBatch:
    reviews = []
    for claim in claims:
        review = review_anatomy_claim(claim["text"])
        review.claim_id = claim["claim_id"]
        reviews.append(review)
    return AnatomyReviewBatch(reviews=reviews)
