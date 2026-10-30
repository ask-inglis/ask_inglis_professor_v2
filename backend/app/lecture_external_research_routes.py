"""Additive protected lecture-claim research route; no alteration of review records.

Integrate in main.py (after get_current_professor is defined):
 from app.lecture_external_research_routes import build_lecture_external_research_router
 app.include_router(build_lecture_external_research_router(get_current_professor))
"""
from __future__ import annotations

import os
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services.external_evidence_pipeline import retrieve_external_evidence
from app.services.providers.bullsai_provider import review_anatomy_claim


class LectureClaimResearchRequest(BaseModel):
    claim: str = Field(min_length=5, max_length=1200)


def build_lecture_external_research_router(auth_dependency: Callable[..., Any]) -> APIRouter:
    router = APIRouter(prefix="/professor/lecture-external-research",
                       tags=["Professor Lecture External Research"])

    @router.post("/verify")
    def verify(payload: LectureClaimResearchRequest, professor: Any = Depends(auth_dependency)):
        if os.getenv("EXTERNAL_EVIDENCE_ENABLED", "false").strip().lower() not in {"true", "1", "yes"}:
            raise HTTPException(503, "External evidence is disabled")
        # This is a separate advisory research endpoint. Does not mutate any
        # uploaded lecture, verified claim, reviewed PDF, or professor decision.
        try:
            found = retrieve_external_evidence(payload.claim, limit=4)
        except Exception as exc:
            raise HTTPException(502, f"External research unavailable ({type(exc).__name__})") from exc
        passages = found["passages"]
        if not passages:
            return {
                "verdict": None, "status": "needs_review",
                "reason": "No reusable source passages retrieved; professor review is required.",
                "sources": [], "research": found,
                "review_required": True,
            }
        try:
            review = review_anatomy_claim(payload.claim, evidence=passages)
            result = review.model_dump(mode="json") if hasattr(review, "model_dump") else review.dict()
        except Exception as exc:
            raise HTTPException(502, f"BullsAI review unavailable ({type(exc).__name__})") from exc
        # The service returns a source-cited advisory, never an automatic edit.
        return {
            "verdict": result.get("verdict"),
            "status": result.get("status", "needs_review"),
            "reason": result.get("reason", "Review required"),
            "suggested_correction": result.get("suggested_correction"),
            "sources": result.get("sources", []),
            "research": {"query": found["query"],
                         "academic_passages": found["academic_passages"],
                         "wikipedia_passages": found["wikipedia_passages"],
                         "errors": found["errors"]},
            "review_required": True,
        }

    return router
