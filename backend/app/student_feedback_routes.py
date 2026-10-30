"""Professor-only routes for live student chatbot feedback.

Install at backend/app/student_feedback_routes.py and register at the end of
app/main.py (only once):

    from app.student_feedback_routes import build_student_feedback_router
    app.include_router(build_student_feedback_router(get_current_professor))

The existing professor authentication dependency is injected to avoid
circular imports. Student chatbot credentials are never returned to browsers.
"""

from __future__ import annotations

from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.student_feedback_client import (
    FeedbackClientError,
    get_student_feedback_client,
)
from app.services.student_feedback_ai_service import (
    StudentFeedbackVerificationError,
    verify_reported_answer,
)


class FeedbackResolutionRequest(BaseModel):
    decision: str
    comment: str = Field(default="", max_length=1000)


class FeedbackGroupResolutionRequest(FeedbackResolutionRequest):
    fingerprint: str = Field(min_length=1, max_length=128)


class FeedbackVerificationRequest(BaseModel):
    question: str = Field(min_length=3, max_length=5000)
    chatbot_answer: str = Field(min_length=1, max_length=5000)
    evidence_limit: int = Field(default=6, ge=1, le=20)


def build_student_feedback_router(
    professor_auth_dependency: Callable[..., Any],
) -> APIRouter:
    """Build professor JWT-protected feedback routes.

    The authentication dependency must return the authenticated Professor
    ORM object (with a positive integer `id`). The browser never supplies
    the professor ID or student chatbot admin key.
    """
    router = APIRouter(
        prefix="/professor/feedback",
        tags=["Professor Student Feedback"],
    )

    @router.get("/queue")
    def list_student_feedback_queue(
        limit: int = Query(default=50, ge=1, le=200),
        status: str = Query(default="pending_review", pattern="^(pending_review|resolved)$"),
        professor: Any = Depends(professor_auth_dependency),
    ) -> dict[str, Any]:
        try:
            return get_student_feedback_client().list_queue(limit=limit, status=status)
        except FeedbackClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @router.post("/verify")
    def verify_student_feedback_answer(
        request: FeedbackVerificationRequest,
        professor: Any = Depends(professor_auth_dependency),
    ) -> dict[str, Any]:
        """Advisory evidence-grounded verification; never resolves a report."""
        try:
            return verify_reported_answer(
                professor_id=professor.id,
                question=request.question,
                chatbot_answer=request.chatbot_answer,
                evidence_limit=request.evidence_limit,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except StudentFeedbackVerificationError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @router.post("/resolve-group")
    def resolve_student_feedback_group(
        request: FeedbackGroupResolutionRequest,
        professor: Any = Depends(professor_auth_dependency),
    ) -> dict[str, Any]:
        try:
            return get_student_feedback_client().resolve_group(
                fingerprint=request.fingerprint,
                decision=request.decision,
                comment=request.comment,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except FeedbackClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @router.post("/{feedback_id}/resolve")
    def resolve_single_student_feedback(
        feedback_id: str,
        request: FeedbackResolutionRequest,
        professor: Any = Depends(professor_auth_dependency),
    ) -> dict[str, Any]:
        try:
            return get_student_feedback_client().resolve_feedback(
                feedback_id=feedback_id,
                decision=request.decision,
                comment=request.comment,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except FeedbackClientError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return router
