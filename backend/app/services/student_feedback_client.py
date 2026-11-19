"""Server-side adapter for the AskInglis student chatbot feedback API.

Mock mode is entirely local and never calls the student backend or GitHub.
Live mode uses the teammate's documented X-Admin-Key protected endpoints.

This is a service module, NOT an HTTP route: professor authentication and
course authorization must be enforced by the calling FastAPI endpoint.
Never expose the admin key or this service's live methods to browser code.
"""

from __future__ import annotations

import copy
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


_ALLOWED_DECISIONS = frozenset({"note_fixed", "answer_was_correct", "dismissed"})


class FeedbackClientError(RuntimeError):
    """A safe, non-secret-bearing message suitable for backend diagnostics."""


@dataclass(frozen=True)
class FeedbackClientConfig:
    mode: str = "mock"
    base_url: str = "http://127.0.0.1:8002"
    admin_key: str = ""
    timeout_seconds: float = 10.0

    @classmethod
    def from_environment(cls) -> "FeedbackClientConfig":
        """Variables are read when instantiated, not during import."""
        raw_timeout = os.getenv("STUDENT_CHATBOT_TIMEOUT_SECONDS", "10")
        try:
            timeout = float(raw_timeout)
        except ValueError as exc:
            raise FeedbackClientError("Invalid student chatbot timeout setting") from exc
        return cls(
            mode=os.getenv("STUDENT_FEEDBACK_MODE", "mock").strip().lower(),
            base_url=os.getenv("STUDENT_CHATBOT_URL", "http://127.0.0.1:8002").strip(),
            admin_key=os.getenv("STUDENT_CHATBOT_ADMIN_KEY", ""),
            timeout_seconds=timeout,
        )


def _mock_groups() -> list[dict[str, Any]]:
    """Clearly labeled fictional demonstration records; never real students."""
    return [
        {
            "fingerprint": "demo_atlas_c1",
            "reason": "incorrect",
            "question": "Which cervical vertebra is the atlas?",
            "answer": "The atlas is C2.",
            "lectures": ["Vertebral Column"],
            "comments": ["The atlas should be C1."],
            "ids": ["20261026T120000_a1b2c3d4", "20261026T120500_b2c3d4e5"],
            "count": 2,
            "first_seen": "2026-10-26T12:00:00+00:00",
            "last_seen": "2026-10-26T12:05:00+00:00",
            "status": "pending_review",
            "demo": True,
        },
        {
            "fingerprint": "demo_spinal_curves",
            "reason": "other",
            "question": "What are the normal curves of the vertebral column?",
            "answer": "The spine has cervical, thoracic, lumbar and sacral curves.",
            "lectures": ["Vertebral Column"],
            "comments": ["Could you explain which curves are primary?"],
            "ids": ["20261026T121000_c3d4e5f6"],
            "count": 1,
            "first_seen": "2026-10-26T12:10:00+00:00",
            "last_seen": "2026-10-26T12:10:00+00:00",
            "status": "pending_review",
            "demo": True,
        },
    ]


class StudentFeedbackClient:
    """Read/resolve grouped feedback in mock or live mode.

    The teammate API's group resolution operates by fingerprint. If two
    groups have different reasons but share a fingerprint, resolving that
    fingerprint closes both groups. UI should make that scope clear.
    """

    def __init__(self, config: FeedbackClientConfig | None = None):
        self.config = config or FeedbackClientConfig.from_environment()
        if self.config.mode not in {"mock", "live"}:
            raise FeedbackClientError("STUDENT_FEEDBACK_MODE must be 'mock' or 'live'")
        if not 0 < self.config.timeout_seconds <= 120:
            raise FeedbackClientError("Student chatbot timeout must be between 0 and 120 seconds")
        self._demo_groups = _mock_groups()
        if self.config.mode == "live":
            self._validate_live_config()

    @property
    def is_mock(self) -> bool:
        return self.config.mode == "mock"

    def _validate_live_config(self) -> None:
        if not self.config.admin_key.strip():
            raise FeedbackClientError("STUDENT_CHATBOT_ADMIN_KEY is required in live mode")
        parts = urlsplit(self.config.base_url)
        local = parts.hostname in {"127.0.0.1", "localhost", "::1"}
        if parts.scheme != "https" and not (parts.scheme == "http" and local):
            raise FeedbackClientError("Live chatbot URL must use HTTPS, except for localhost")
        if not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
            raise FeedbackClientError("Invalid student chatbot base URL")

    def _request(self, method: str, path: str, payload: dict | None = None) -> Any:
        base = self.config.base_url.rstrip("/")
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {
            "X-Admin-Key": self.config.admin_key,
            "Accept": "application/json",
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = Request(base + path, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.config.timeout_seconds) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code in (401, 403):
                message = "Student chatbot rejected its admin credentials"
            elif exc.code == 404:
                message = "Student chatbot feedback endpoint was not found"
            else:
                message = f"Student chatbot returned HTTP {exc.code}"
            raise FeedbackClientError(message) from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise FeedbackClientError("Student chatbot is unreachable or timed out") from exc
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise FeedbackClientError("Student chatbot returned invalid JSON") from exc

    def get_insights(self, weeks: int = 4) -> dict[str, Any]:
        """Retrieve only privacy-approved Student Chatbot insights."""
        if type(weeks) is not int or not 1 <= weeks <= 26:
            raise ValueError("weeks must be between 1 and 26")

        if self.is_mock:
            raise FeedbackClientError(
                "Live Student Chatbot is required for Insights"
            )

        result = self._request(
            "GET", f"/admin/insights?weeks={weeks}"
        )

        if not isinstance(result, dict):
            raise FeedbackClientError("Invalid Insights response")

        privacy = result.get("privacy")
        if not isinstance(privacy, dict):
            raise FeedbackClientError("Missing Insights privacy information")

        if privacy.get("individual_data_exposed") is not False:
            raise FeedbackClientError("Insights privacy validation failed")

        allowed_keys = {
            "status", "weeks_requested", "privacy",
            "frequently_asked_topics", "quiz_performance",
            "dissection_guides", "learning_gaps",
            "weekly_trends", "recommendations",
        }

        if set(result) - allowed_keys:
            raise FeedbackClientError(
                "Unexpected fields in Insights response"
            )

        return result

    def list_queue(self, *, limit: int = 50, status: str = "pending_review") -> dict[str, Any]:
        """Return {'mode', 'groups', 'total_groups'} for the professor API.

        The teammate README documents GET /admin/feedback/queue but not
        its exact response envelope. Accept a list or common keyed forms.
        """
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 200:
            raise ValueError("limit must be between 1 and 200")
        if status not in {"pending_review", "resolved"}:
            raise ValueError("status must be pending_review or resolved")
        if self.is_mock:
            groups = [copy.deepcopy(g) for g in self._demo_groups if g["status"] == status]
            groups = groups[:limit]
        else:
            # The teammate's published endpoint accepts optional status/limit;
            # filter defensively if an older version does not.
            path = f"/admin/feedback/queue?status={quote(status)}&limit={limit}"
            result = self._request("GET", path)
            if isinstance(result, list):
                groups = result
            elif isinstance(result, dict):
                groups = next(
                    (result[key] for key in ("queue", "groups", "items", "feedback") if isinstance(result.get(key), list)),
                    None,
                )
                if groups is None:
                    raise FeedbackClientError("Unexpected student feedback queue format")
            else:
                raise FeedbackClientError("Unexpected student feedback queue format")
            groups = [g for g in groups if isinstance(g, dict) and g.get("status", status) == status][:limit]
        return {"mode": self.config.mode, "groups": groups, "total_groups": len(groups)}

    def resolve_group(self, fingerprint: str, decision: str, comment: str = "") -> dict[str, Any]:
        """Resolve a question fingerprint using the teammate's group API.

        'note_fixed' must only be chosen after the actual note is updated.
        """
        self._validate_resolution(fingerprint, decision, comment)
        if self.is_mock:
            changed = 0
            for group in self._demo_groups:
                if group["fingerprint"] == fingerprint and group["status"] == "pending_review":
                    group.update(status="resolved", decision=decision,
                                 reviewer_comment=comment, resolved_at=datetime.now(timezone.utc).isoformat())
                    changed += group["count"]
            return {"mode": "mock", "resolved_count": changed, "demo": True}
        result = self._request("POST", "/admin/feedback/resolve-group", {
            "fingerprint": fingerprint, "decision": decision, "comment": comment,
        })
        return {"mode": "live", "result": result}

    def resolve_feedback(self, feedback_id: str, decision: str, comment: str = "") -> dict[str, Any]:
        """Resolve one report; live mode passes the ID as a safe URL component."""
        import re
        if not re.fullmatch(r"[0-9]{8}T[0-9]{6}_[0-9a-f]{8}", feedback_id or ""):
            raise ValueError("Invalid feedback ID")
        self._validate_resolution("valid", decision, comment)
        if self.is_mock:
            for group in self._demo_groups:
                if feedback_id in group["ids"] and group["status"] == "pending_review":
                    # Mock groups are an aggregate. For accurate partial resolution,
                    # remove only this ID and adjust count; keep other reports pending.
                    group["ids"].remove(feedback_id)
                    group["count"] -= 1
                    if group["count"] == 0:
                        group["status"] = "resolved"
                    return {"mode": "mock", "resolved_count": 1, "demo": True}
            return {"mode": "mock", "resolved_count": 0, "demo": True}
        result = self._request("POST", f"/admin/feedback/{feedback_id}/resolve", {
            "decision": decision, "comment": comment,
        })
        return {"mode": "live", "result": result}

    @staticmethod
    def _validate_resolution(identifier: str, decision: str, comment: str) -> None:
        if not isinstance(identifier, str) or not identifier.strip() or len(identifier) > 128:
            raise ValueError("Invalid feedback identifier")
        if decision not in _ALLOWED_DECISIONS:
            raise ValueError("Decision must be note_fixed, answer_was_correct, or dismissed")
        if not isinstance(comment, str) or len(comment) > 1000:
            raise ValueError("Comment must be at most 1000 characters")


def get_student_feedback_client() -> StudentFeedbackClient:
    """Factory for use inside protected professor backend endpoints."""
    return StudentFeedbackClient()
