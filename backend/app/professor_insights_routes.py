"""JWT-protected Professor Insights API.

Only privacy-approved aggregate information may reach
the Professor Dashboard frontend.
"""

from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException, Query

from app.services.student_feedback_client import (
    FeedbackClientError,
    get_student_feedback_client,
)


def build_professor_insights_router(
    professor_auth_dependency: Callable[..., Any],
) -> APIRouter:
    router = APIRouter(
        prefix="/professor/insights",
        tags=["Professor Insights"],
    )

    @router.get("/summary")
    def get_insights_summary(
        weeks: int = Query(default=4, ge=1, le=26),
        professor: Any = Depends(professor_auth_dependency),
    ) -> dict[str, Any]:
        """Retrieve privacy-approved aggregate Insights."""
        try:
            return get_student_feedback_client().get_insights(
                weeks=weeks
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=str(exc),
            ) from exc
        except FeedbackClientError as exc:
            raise HTTPException(
                status_code=502,
                detail=str(exc),
            ) from exc

    return router
